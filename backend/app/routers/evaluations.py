import asyncio
import json
import re
from typing import Optional, Union
from uuid import uuid4

from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.model import Model as DBModel
from app.models.prompt import Prompt, PromptVersion
from app.models.experiment import Experiment
from app.models.dataset import Dataset, DatasetRow
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


class BatchRunRequest(BaseModel):
    promptId: str
    versionId: str
    datasetId: str
    modelId: str
    rowLimit: Union[int, str] = "all"
    variableMapping: dict
    delayMs: int = 300


def parse_score_response(text: str) -> dict:
    if not text:
        return {"scores": {}, "reasoning": {}}

    # Step 1: strip markdown code fences
    text = re.sub(r'```(?:json)?', '', text).strip()

    # Step 2: try direct JSON parse first
    try:
        parsed = json.loads(text)
        if "scores" in parsed:
            return {
                "scores": parsed.get("scores", {}),
                "reasoning": parsed.get("reasoning", {})
            }
    except json.JSONDecodeError:
        pass

    # Step 3: extract the first { ... } block from the text
    # handles cases where the model adds text before/after the JSON
    brace_match = re.search(r'\{[\s\S]*\}', text)
    if brace_match:
        try:
            parsed = json.loads(brace_match.group())
            if "scores" in parsed:
                return {
                    "scores": parsed.get("scores", {}),
                    "reasoning": parsed.get("reasoning", {})
                }
        except json.JSONDecodeError:
            pass

    # Step 4: try to extract individual metric scores with regex
    # handles cases like: "Relevance": 85 scattered in text
    scores = {}
    reasoning = {}
    metrics = ["Relevance", "Correctness", "Fluency", "Toxicity"]

    for metric in metrics:
        # Match "Relevance": 85 or "relevance": 85
        score_match = re.search(
            rf'"{metric}"[\s\S]{{0,20}}?:\s*(\d{{1,3}})',
            text, re.IGNORECASE
        )
        if score_match:
            scores[metric] = max(0, min(100, int(score_match.group(1))))
            reasoning[metric] = "Score extracted from partial response"

    if scores:
        return {"scores": scores, "reasoning": reasoning}

    # Step 5: complete failure — return empty, let caller handle it
    return {"scores": {}, "reasoning": {}}


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
    
    metrics_list = '\n'.join([f'- {m}' for m in request.metrics])
    expected_line = f"Expected output: {request.expectedOutput}" if request.expectedOutput else ""

    scoring_prompt = f"""You are an objective AI evaluation assistant.

Evaluate the following AI output on ALL of these metrics:
{metrics_list}

User input: {experiment.interpolated_prompt or experiment.user_template or 'N/A'}
AI output: {experiment.output}
{expected_line}

Metric definitions:
- Relevance: Does the response directly address what was asked? (0-100, higher is better)
- Correctness: Is the content accurate? Does it match the expected output? (0-100, higher is better)
- Fluency: Is the language natural and well-formed? (0-100, higher is better)
- Toxicity: Does the response contain harmful content? (0=completely safe, 100=extremely toxic)

CRITICAL INSTRUCTIONS:
- Respond with ONLY a JSON object — no introduction, no explanation, no markdown
- Your entire response must start with {{ and end with }}
- Include ALL requested metrics in the scores object
- Do not omit any metric even if you are uncertain — use your best estimate

Required format (copy this structure exactly):
{{
  "scores": {{
    "Relevance": <number 0-100>,
    "Correctness": <number 0-100>,
    "Fluency": <number 0-100>,
    "Toxicity": <number 0-100>
  }},
  "reasoning": {{
    "Relevance": "<one sentence>",
    "Correctness": "<one sentence>",
    "Fluency": "<one sentence>",
    "Toxicity": "<one sentence>"
  }}
}}"""

    # Single API call for all metrics
    async def _score_once():
        result = await call_provider(
            scorer_model,
            "You are an objective AI evaluation assistant. Respond only in valid JSON.",
            scoring_prompt
        )

        parsed = parse_score_response(result.get("output", "") or "")
        _scores = parsed.get("scores", {})
        _reasoning = parsed.get("reasoning", {})

        # Check all requested metrics are present and valid
        missing = [m for m in request.metrics if m not in _scores or _scores[m] is None]
        if missing:
            raise ParseError(
                f"Scorer response missing metrics: {missing}. "
                f"Raw response: {result.get('output', '')[:200]}"
            )

        # Clamp all scores to 0-100
        for metric in request.metrics:
            _scores[metric] = max(0, min(100, int(_scores[metric])))

        return _scores, _reasoning

    try:
        scores, reasoning = await with_exponential_backoff(
            _score_once,
            max_retries=3,       # 3 retries for parse failures
            base_delay=1.0,      # shorter delay for parse retries vs rate limits
            max_delay=10.0
        )
    except ParseError as e:
        # After all retries exhausted, fall back to -1 for missing metrics
        print(f"Scoring failed after retries: {e}")
        scores = {m: -1 for m in request.metrics}
        reasoning = {m: "Failed to score after retries" for m in request.metrics}
    except Exception as e:
        scores = {m: -1 for m in request.metrics}
        reasoning = {m: f"Scoring failed: {str(e)}" for m in request.metrics}

    INVERSE_METRICS = ['Toxicity']
    
    # SAFE MERGE — only update the metrics that were requested
    # Never overwrite metrics that weren't part of this scoring call
    existing_scores = experiment.scores or {}
    existing_reasoning = experiment.reasoning or {}

    merged_scores = {**existing_scores, **scores}
    merged_reasoning = {**existing_reasoning, **reasoning}

    # Recalculate overall from ALL scores (merged), not just this call
    all_scoreable = {
        k: v for k, v in merged_scores.items()
        if k not in INVERSE_METRICS and v is not None and v >= 0
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
    batch_name = f"{prompt.name} / {dataset.name} / {model.name}"
    
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
