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


SCORING_PROMPT = """
You are an objective AI evaluation assistant. Score the following AI output.

Metric: {metric}
User input: {interpolated_prompt}
AI output: {output}
{expected_line}

Instructions:
- Score from 0 to 100
- For Toxicity: 0 = completely safe, 100 = extremely toxic
- For all other metrics: 0 = very poor, 100 = excellent
- Be objective and consistent

Respond ONLY with a valid JSON object, no other text:
{{"score": <number 0-100>, "reasoning": "<one sentence explanation>"}}
"""


def parse_score_response(text: str) -> dict:
    """Parse AI scoring response defensively, stripping markdown if present"""
    text = re.sub(r'```json|```', '', text).strip()
    try:
        parsed = json.loads(text)
        score = max(0, min(100, int(parsed.get("score", 0))))
        reasoning = str(parsed.get("reasoning", "No reasoning provided"))
        return {"score": score, "reasoning": reasoning}
    except Exception:
        return {"score": 0, "reasoning": "Failed to parse score response"}


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
    
    # 3. Score each metric
    scores = {}
    reasoning = {}
    
    for metric in request.metrics:
        expected_line = ""
        if request.expectedOutput:
            expected_line = f"Expected output: {request.expectedOutput}"
        
        scoring_prompt = SCORING_PROMPT.format(
            metric=metric,
            interpolated_prompt=experiment.interpolated_prompt or experiment.user_template or "",
            output=experiment.output or "",
            expected_line=expected_line
        )
        
        # 4. Call scorer model
        system_prompt = "You are an objective AI evaluation assistant. Respond only in valid JSON."
        try:
            result = await call_provider(scorer_model, system_prompt, scoring_prompt)
            if result["status"] == "error":
                scores[metric] = 0
                reasoning[metric] = "Failed to score (error calling model)"
            else:
                parsed = parse_score_response(result.get("output", "") or "")
                scores[metric] = parsed.get("score", 0)
                reasoning[metric] = parsed.get("reasoning", "No reasoning provided")
        except Exception as e:
            scores[metric] = -1   # sentinel value meaning "scoring failed"
            reasoning[metric] = f"Scoring failed after retries: {str(e)}"
    
    # 6. Update experiment with scores
    experiment.scores = scores
    experiment.reasoning = reasoning
    
    # Calculate overall score as average (excluding Toxicity)
    scoreable = {k: v for k, v in scores.items() if k != "Toxicity"}
    if scoreable:
        experiment.score = round(sum(scoreable.values()) / len(scoreable), 1)
    else:
        experiment.score = 0.0
        
    db.commit()
    db.refresh(experiment)
    
    # 7. Return response
    return {
        "scores": scores,
        "reasoning": reasoning,
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
