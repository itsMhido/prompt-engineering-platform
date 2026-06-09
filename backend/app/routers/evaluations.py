import asyncio
import json
import re
from typing import Optional, Union
from uuid import uuid4

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.model import Model as DBModel
from app.models.prompt import Prompt, PromptVersion
from app.models.experiment import Experiment
from app.models.dataset import Dataset, DatasetRow
from app.models.evaluation_metric import EvaluationMetric
from app.core.auth import get_current_user, get_user_workspace
from app.services.ai_router import call_provider
from app.services.retry import with_exponential_backoff, ParseError
from app.services.experiment_logger import log_experiment, experiment_to_dict

router = APIRouter()


class ScoreRequest(BaseModel):
    experimentId: str
    metrics: list[str]
    expectedOutput: Optional[str] = None
    scorerModelId: Optional[str] = None


class BatchScoreRequest(BaseModel):
    experimentIds: list[str]
    metrics: list[str]
    scorerModelId: str
    expectedOutputCol: Optional[str] = None
    delayMs: int = 3000


class BatchRunRequest(BaseModel):
    promptId: str
    versionId: str
    datasetId: str
    modelId: str
    rowLimit: Union[int, str] = "all"
    variableMapping: dict
    delayMs: int = 300
    batchName: Optional[str] = None


def parse_score_response(text: str) -> dict:
    if not text:
        return {"scores": {}, "reasoning": {}}

    # Strip markdown fences
    cleaned = re.sub(r'```(?:json)?', '', text).strip()

    # Strategy 1: find the LAST { ... } block in the text
    # Chain of thought puts the JSON at the end
    all_json_blocks = list(re.finditer(r'\{[\s\S]*?\}(?=\s*$|\s*```)', cleaned))
    if not all_json_blocks:
        # Fallback: find any { } block
        all_json_blocks = list(re.finditer(r'\{[\s\S]*\}', cleaned))

    # Try blocks from last to first (CoT puts JSON last)
    for match in reversed(all_json_blocks):
        try:
            parsed = json.loads(match.group())
            if 'scores' in parsed and isinstance(parsed['scores'], dict):
                return {
                    "scores": parsed.get("scores", {}),
                    "reasoning": parsed.get("reasoning", {})
                }
        except json.JSONDecodeError:
            continue

    # Strategy 2: find the last opening brace and parse from there
    last_brace = cleaned.rfind('{')
    if last_brace != -1:
        try:
            parsed = json.loads(cleaned[last_brace:])
            if 'scores' in parsed:
                return {
                    "scores": parsed.get("scores", {}),
                    "reasoning": parsed.get("reasoning", {})
                }
        except json.JSONDecodeError:
            pass

    # Strategy 3: regex extraction of individual metric scores
    scores = {}
    reasoning = {}
    known_metrics = ["Relevance", "Correctness", "Fluency", "Toxicity"]

    for metric in known_metrics:
        score_match = re.search(
            rf'"{metric}"[\s\S]{{0,20}}?:\s*(\d{{1,3}})',
            cleaned, re.IGNORECASE
        )
        if score_match:
            scores[metric] = max(0, min(100, int(score_match.group(1))))
            reasoning[metric] = "Score extracted from partial response"

    if scores:
        return {"scores": scores, "reasoning": reasoning}

    return {"scores": {}, "reasoning": {}}

def build_scoring_prompt(metrics_config: list[dict], user_input: str,
                         ai_output: str, expected_output: str | None) -> str:
    """
    metrics_config: list of { name, description, isInverse }
    """
    expected_line = f"\nExpected/Reference output: {expected_output}" if expected_output else ""

    metric_defs = '\n'.join([
        f"- {m['name']}: {m['description']}"
        + (" (LOWER IS BETTER — 0 means best)" if m['isInverse'] else " (higher is better)")
        for m in metrics_config
    ])

    metric_names = [m['name'] for m in metrics_config]
    scores_template = ', '.join([f'"{m}": <0-100>' for m in metric_names])
    reasoning_template = ', '.join([f'"{m}": "<one sentence>"' for m in metric_names])

    return f"""You are an expert AI output evaluator.

## Input given to the AI:
<user_input>
{user_input}
</user_input>

## AI response to evaluate:
<ai_output>
{ai_output}
</ai_output>
{f'<expected_output>{expected_output}</expected_output>' if expected_output else ''}

## Metrics to evaluate:
{metric_defs}

## Instructions:
Evaluate the AI response on these metrics: {', '.join(metric_names)}
- If the output is JSON, evaluate the CONTENT within it
- If an expected output is provided, use it as your primary reference for accuracy metrics
- Be consistent — identical quality outputs should receive identical scores

## Step 1 — Think through your evaluation:
Reason carefully about each metric before scoring. Write 1-2 sentences per metric.

## Step 2 — Final scores (valid JSON, no markdown):
{{
  "scores": {{{scores_template}}},
  "reasoning": {{{reasoning_template}}}
}}"""

async def _score_experiment(experiment, scorer_model, metrics_config, expected_output):
    scoring_prompt = build_scoring_prompt(
        metrics_config=metrics_config,
        user_input=experiment.interpolated_prompt or experiment.user_template or 'N/A',
        ai_output=experiment.output or 'No output',
        expected_output=expected_output
    )

    requested_metric_names = [m["name"] for m in metrics_config]

    async def _score_once():
        result = await call_provider(
            scorer_model,
            "You are an objective AI evaluation assistant. Respond only in valid JSON.",
            scoring_prompt
        )

        parsed = parse_score_response(result.get("output", "") or "")
        _scores = parsed.get("scores", {})
        _reasoning = parsed.get("reasoning", {})

        missing = [m for m in requested_metric_names if m not in _scores or _scores[m] is None]
        if missing:
            raise ParseError(
                f"Scorer response missing metrics: {missing}. "
                f"Raw response: {result.get('output', '')[:200]}"
            )

        for metric in requested_metric_names:
            _scores[metric] = max(0, min(100, int(_scores[metric])))

        return _scores, _reasoning

    try:
        return await with_exponential_backoff(
            _score_once,
            max_retries=3,
            base_delay=1.0,
            max_delay=10.0
        )
    except ParseError as e:
        print(f"Scoring failed after retries: {e}")
        return {m: None for m in requested_metric_names}, {m: "Failed to score after retries" for m in requested_metric_names}
    except Exception as e:
        return {m: None for m in requested_metric_names}, {m: f"Scoring failed: {str(e)}" for m in requested_metric_names}


@router.post("/score")
async def score_evaluation(
    request: ScoreRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Score an experiment output on multiple metrics using an AI model"""
    workspace = get_user_workspace(current_user, db)
    
    # 1. Load experiment from DB
    experiment = db.query(Experiment).filter(
        Experiment.id == request.experimentId,
        Experiment.workspace_id == workspace.id
    ).first()
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # 2. Load scorer model
    if not request.scorerModelId:
        raise HTTPException(
            status_code=400,
            detail="scorerModelId is required. Choose which model will evaluate this output."
        )

    scorer_model = db.query(DBModel).filter(
        DBModel.id == request.scorerModelId,
        DBModel.workspace_id == workspace.id,
        DBModel.status == "active"
    ).first()
    if not scorer_model:
        raise HTTPException(status_code=404, detail="Scorer model not found or inactive")
    
    expected_output = request.expectedOutput

    # If not provided by frontend, try to look it up from the dataset
    if not expected_output and experiment.dataset_id and experiment.dataset_row_index is not None:
        dataset_row = db.query(DatasetRow).filter(
            DatasetRow.dataset_id == experiment.dataset_id,
            DatasetRow.row_index == experiment.dataset_row_index
        ).first()

        if dataset_row and dataset_row.row_data:
            # Look for any column that looks like an expected output
            # Check common column names in order of priority
            expected_col_candidates = [
                'expected_output', 'expected', 'reference',
                'ground_truth', 'answer', 'label', 'target'
            ]
            for col in expected_col_candidates:
                if col in dataset_row.row_data:
                    expected_output = str(dataset_row.row_data[col])
                    break

            # If none of the candidates matched, store the full row data
            # so the scorer at least has context about what the expected values were
            if not expected_output:
                expected_output = None  # don't guess further

    print(f"Scoring experiment {experiment.id} - expected_output: {'found' if expected_output else 'not found'}")

    requested_metric_names = request.metrics

    workspace_metrics = db.query(EvaluationMetric).filter(
        EvaluationMetric.workspace_id == workspace.id,
        EvaluationMetric.name.in_(requested_metric_names)
    ).all()

    # Fall back to basic config if metric not found in DB
    metrics_config = []
    for name in requested_metric_names:
        db_metric = next((m for m in workspace_metrics if m.name == name), None)
        if db_metric:
            metrics_config.append({
                "name": db_metric.name,
                "description": db_metric.description,
                "isInverse": db_metric.is_inverse
            })
        else:
            # Fallback for metrics not in DB
            metrics_config.append({
                "name": name,
                "description": f"Evaluate {name} on a scale of 0-100.",
                "isInverse": False
            })

    scores, reasoning = await _score_experiment(
        experiment=experiment,
        scorer_model=scorer_model,
        metrics_config=metrics_config,
        expected_output=expected_output
    )

    INVERSE_METRICS = [m['name'] for m in metrics_config if m['isInverse']]
    
    # SAFE MERGE — only update the metrics that were requested
    # Never overwrite metrics that weren't part of this scoring call
    existing_scores = experiment.scores or {}
    existing_reasoning = experiment.reasoning or {}

    merged_scores = {**existing_scores, **scores}
    merged_reasoning = {**existing_reasoning, **reasoning}

    # Recalculate overall from ALL scores (merged), not just this call
    all_scoreable = {
        k: v for k, v in merged_scores.items()
        if k not in INVERSE_METRICS
        and v is not None
        and isinstance(v, (int, float))
        and v >= 0
    }
    merged_overall = round(
        sum(all_scoreable.values()) / len(all_scoreable), 1
    ) if all_scoreable else None

    experiment.scores = merged_scores
    experiment.reasoning = merged_reasoning
    experiment.score = merged_overall
    db.commit()
    db.refresh(experiment)

    return {
        "scores": merged_scores,
        "reasoning": merged_reasoning,
        "expectedOutputUsed": expected_output is not None,
        "scorerModelId": str(scorer_model.id),
        "scorerModelName": scorer_model.name,
        "updatedExperiment": experiment_to_dict(experiment)
    }


@router.post("/batch-run")
async def batch_run_evaluation(
    request: BatchRunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Run a prompt version against all rows of a dataset sequentially"""
    workspace = get_user_workspace(current_user, db)
    
    # 1. Load and verify all required records
    prompt = db.query(Prompt).filter(
        Prompt.id == request.promptId,
        Prompt.workspace_id == workspace.id
    ).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    version = db.query(PromptVersion).filter(
        PromptVersion.id == request.versionId,
        PromptVersion.prompt_id == request.promptId
    ).first()
    if not version:
        raise HTTPException(status_code=404, detail="Prompt version not found")
    
    dataset = db.query(Dataset).filter(
        Dataset.id == request.datasetId,
        Dataset.workspace_id == workspace.id
    ).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    model = db.query(DBModel).filter(
        DBModel.id == request.modelId,
        DBModel.workspace_id == workspace.id
    ).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    # 2. Load dataset rows ordered by row_index
    all_rows = db.query(DatasetRow).filter(
        DatasetRow.dataset_id == request.datasetId
    ).order_by(DatasetRow.row_index).all()
    
    # 3. Apply row limit
    limit = len(all_rows) if request.rowLimit == "all" else int(request.rowLimit)
    rows_to_process = all_rows[:limit]
    batch_id = str(uuid4())
    batch_name = request.batchName if request.batchName else f"{prompt.name} / {dataset.name} / {model.name}"
    
    # 4. Process each row sequentially
    experiments = []
    errors = []
    success_count = 0
    fail_count = 0
    
    for i, row in enumerate(rows_to_process):
        try:
            # a. Interpolate variables into user_template
            interpolated = version.user_template
            for var_name, col_name in request.variableMapping.items():
                if not col_name:
                    continue
                value = row.row_data.get(col_name)
                if value is None:
                    continue
                interpolated = interpolated.replace(f"{{{var_name}}}", str(value))
            
            # b. Call provider
            result = await call_provider(model, version.system_prompt, interpolated)
            
            # c. Log experiment
            experiment = log_experiment(
                db=db,
                workspace_id=workspace.id,
                model_id=model.id,
                result=result,
                user=current_user,
                prompt_id=prompt.id,
                prompt_version_id=version.id,
                dataset_id=dataset.id,
                dataset_row_index=i,
                batch_id=batch_id,
                batch_name=batch_name,
                prompt_name=prompt.name,
                prompt_version=f"v{version.version_number}",
                model_name=model.name,
                provider=model.provider,
                system_prompt=version.system_prompt,
                user_template=version.user_template,
                variable_values=row.row_data,
                interpolated_prompt=interpolated
            )
            experiments.append(experiment)
            success_count += 1
            
        except Exception as e:
            fail_count += 1
            errors.append({
                "rowIndex": i,
                "message": str(e)
            })
        
        # d. Delay between rows (skip after last row)
        if i < len(rows_to_process) - 1:
            await asyncio.sleep(0.5)  # 500ms between rows — rate limiting handled by retry
    
    # 5. Return summary
    return {
        "successCount": success_count,
        "failCount": fail_count,
        "experiments": [experiment_to_dict(exp) for exp in experiments],
        "errors": errors
    }

@router.post("/score-batch")
async def score_batch(
    body: BatchScoreRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Triggers batch scoring as a background task.
    Returns immediately with a job_id.
    Frontend polls GET /api/evaluations/score-batch/{job_id} for progress.
    """
    workspace = get_user_workspace(current_user, db)

    # Validate scorer model belongs to workspace
    scorer_model = db.query(DBModel).filter(
        DBModel.id == body.scorerModelId,
        DBModel.workspace_id == workspace.id,
        DBModel.status == "active"
    ).first()
    if not scorer_model:
        raise HTTPException(status_code=404, detail="Scorer model not found or inactive")

    # Validate all experiments belong to workspace
    experiments = db.query(Experiment).filter(
        Experiment.id.in_(body.experimentIds),
        Experiment.workspace_id == workspace.id,
        Experiment.status == "success"   # only score successful experiments
    ).all()

    if not experiments:
        raise HTTPException(status_code=400, detail="No valid experiments found to score")

    # Generate a job ID to track progress
    job_id = str(uuid4())

    # Store initial job state in a simple in-memory dict
    SCORING_JOBS[job_id] = {
        "status": "running",
        "total": len(experiments),
        "completed": 0,
        "succeeded": 0,
        "failed": 0,
        "errors": [],
        "workspaceId": str(workspace.id)
    }

    # Launch background task
    background_tasks.add_task(
        run_batch_scoring,
        job_id=job_id,
        experiment_ids=[str(e.id) for e in experiments],
        metrics=body.metrics,
        scorer_model_id=str(scorer_model.id),
        expected_output_col=body.expectedOutputCol,
        delay_ms=body.delayMs,
        workspace_id=str(workspace.id)
    )

    return {
        "jobId": job_id,
        "total": len(experiments),
        "message": f"Scoring {len(experiments)} experiments in background"
    }


# In-memory job tracking (module-level dict)
SCORING_JOBS: dict = {}


async def run_batch_scoring(
    job_id: str,
    experiment_ids: list[str],
    metrics: list[str],
    scorer_model_id: str,
    expected_output_col: Optional[str],
    delay_ms: int,
    workspace_id: str
):
    """Background task — runs entirely on Railway, not affected by browser navigation"""
    from app.database import SessionLocal

    db = SessionLocal()
    try:
        scorer_model = db.query(DBModel).filter(DBModel.id == scorer_model_id).first()
        workspace_metrics = db.query(EvaluationMetric).filter(
            EvaluationMetric.workspace_id == workspace_id,
            EvaluationMetric.name.in_(metrics)
        ).all()

        metrics_config = [
            {"name": m.name, "description": m.description, "isInverse": m.is_inverse}
            for m in workspace_metrics
        ]

        for exp_id in experiment_ids:
            # Check if job was cancelled
            job = SCORING_JOBS.get(job_id, {})
            if job.get("status") == "cancelled":
                break

            experiment = db.query(Experiment).filter(Experiment.id == exp_id).first()
            if not experiment:
                continue

            try:
                # Get expected output from dataset if available
                expected_output = None
                if expected_output_col and experiment.dataset_id and experiment.dataset_row_index is not None:
                    row = db.query(DatasetRow).filter(
                        DatasetRow.dataset_id == experiment.dataset_id,
                        DatasetRow.row_index == experiment.dataset_row_index
                    ).first()
                    if row and row.row_data:
                        expected_output = str(row.row_data.get(expected_output_col, '')) or None

                # Score this experiment
                scores, reasoning = await _score_experiment(
                    experiment=experiment,
                    scorer_model=scorer_model,
                    metrics_config=metrics_config,
                    expected_output=expected_output
                )

                # Save scores
                existing_scores = experiment.scores or {}
                existing_reasoning = experiment.reasoning or {}
                merged_scores = {**existing_scores, **scores}
                merged_reasoning = {**existing_reasoning, **reasoning}

                INVERSE_METRICS = [m['name'] for m in metrics_config if m['isInverse']]
                scoreable = {
                    k: v for k, v in merged_scores.items()
                    if k not in INVERSE_METRICS and v is not None
                    and isinstance(v, (int, float)) and v >= 0
                }
                overall = round(sum(scoreable.values()) / len(scoreable), 1) if scoreable else None

                experiment.scores = merged_scores
                experiment.reasoning = merged_reasoning
                experiment.score = overall
                db.commit()

                SCORING_JOBS[job_id]["succeeded"] += 1

            except Exception as e:
                SCORING_JOBS[job_id]["failed"] += 1
                SCORING_JOBS[job_id]["errors"].append({
                    "experimentId": exp_id,
                    "message": str(e)
                })

            SCORING_JOBS[job_id]["completed"] += 1

            # Delay between experiments to avoid rate limits
            if delay_ms > 0:
                await asyncio.sleep(delay_ms / 1000)

        if SCORING_JOBS[job_id]["status"] == "running":
            SCORING_JOBS[job_id]["status"] = "completed"

    except Exception as e:
        SCORING_JOBS[job_id]["status"] = "failed"
        SCORING_JOBS[job_id]["errors"].append({"message": str(e)})
    finally:
        db.close()


@router.get("/score-batch/{job_id}")
def get_scoring_job(job_id: str, current_user: User = Depends(get_current_user)):
    """Poll this endpoint to check batch scoring progress"""
    job = SCORING_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    # need local db session to check workspace
    from app.database import SessionLocal
    db = SessionLocal()
    try:
        workspace = get_user_workspace(current_user, db)
        if job.get("workspaceId") != str(workspace.id):
            raise HTTPException(status_code=403, detail="Not authorized")
    finally:
        db.close()
    return job


@router.post("/score-batch/{job_id}/cancel")
def cancel_scoring_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel a running batch scoring job"""
    job = SCORING_JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    workspace = get_user_workspace(current_user, db)
    if job.get("workspaceId") != str(workspace.id):
        raise HTTPException(status_code=403, detail="Not authorized")
        
    if job.get("status") == "running":
        SCORING_JOBS[job_id]["status"] = "cancelled"
    return {"ok": True, "status": SCORING_JOBS[job_id]["status"]}
