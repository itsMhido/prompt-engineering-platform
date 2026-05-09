from typing import Optional
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.model import Model as DBModel
from app.models.prompt import Prompt, PromptVersion
from app.models.experiment import Experiment
from app.core.auth import get_current_user, get_user_workspace
from app.services.ai_router import call_provider

router = APIRouter()

class RunRequest(BaseModel):
    modelId: str
    systemPrompt: str
    userMessage: str
    promptId: Optional[str] = None
    promptVersionId: Optional[str] = None
    userTemplate: Optional[str] = None
    variableValues: Optional[dict] = {}
    datasetId: Optional[str] = None
    datasetRowIndex: Optional[int] = None

@router.post("/run", response_model=dict)
async def run_inference(
    request: RunRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_user_workspace(current_user, db)
    
    model = db.query(DBModel).filter(DBModel.id == request.modelId, DBModel.workspace_id == workspace.id).first()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")

    prompt = None
    if request.promptId:
        prompt = db.query(Prompt).filter(Prompt.id == request.promptId, Prompt.workspace_id == workspace.id).first()

    version = None
    if request.promptVersionId:
        version = db.query(PromptVersion).filter(PromptVersion.id == request.promptVersionId).first()

    result = await call_provider(model, request.systemPrompt, request.userMessage)

    experiment = Experiment(
        workspace_id=workspace.id,
        prompt_id=request.promptId or None,
        prompt_version_id=request.promptVersionId or None,
        model_id=model.id,
        dataset_id=request.datasetId or None,
        dataset_row_index=request.datasetRowIndex,
        prompt_name=prompt.name if prompt else None,
        prompt_version=f"v{version.version_number}" if version else None,
        model_name=model.name,
        provider=model.provider,
        system_prompt=request.systemPrompt,
        user_template=request.userTemplate,
        variable_values=request.variableValues or {},
        interpolated_prompt=request.userMessage,
        output=result["output"],
        latency_ms=result["latency"],
        input_tokens=result["input_tokens"],
        output_tokens=result["output_tokens"],
        total_tokens=result["total_tokens"],
        cost_estimate=result["cost_estimate"],
        status=result["status"],
        error_message=result["error_message"],
        score=None,
        scores={},
        reasoning={},
        tags=[],
        notes="",
        created_by=current_user.id
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)

    exp_dict = {
        "id": str(experiment.id),
        "promptId": str(experiment.prompt_id) if experiment.prompt_id else None,
        "promptVersionId": str(experiment.prompt_version_id) if experiment.prompt_version_id else None,
        "modelId": str(experiment.model_id) if experiment.model_id else None,
        "datasetId": str(experiment.dataset_id) if experiment.dataset_id else None,
        "datasetRowIndex": experiment.dataset_row_index,
        "promptName": experiment.prompt_name,
        "promptVersion": experiment.prompt_version,
        "modelName": experiment.model_name,
        "provider": experiment.provider,
        "systemPrompt": experiment.system_prompt,
        "userTemplate": experiment.user_template,
        "variableValues": experiment.variable_values,
        "interpolatedPrompt": experiment.interpolated_prompt,
        "output": experiment.output,
        "latencyMs": experiment.latency_ms,
        "inputTokens": experiment.input_tokens,
        "outputTokens": experiment.output_tokens,
        "totalTokens": experiment.total_tokens,
        "costEstimate": experiment.cost_estimate,
        "status": experiment.status,
        "errorMessage": experiment.error_message,
        "score": experiment.score,
        "scores": experiment.scores,
        "reasoning": experiment.reasoning,
        "tags": experiment.tags,
        "notes": experiment.notes,
        "createdAt": experiment.created_at.isoformat() if experiment.created_at else ""
    }

    return {
        "output": result["output"],
        "latency": result["latency"],
        "inputTokens": result["input_tokens"],
        "outputTokens": result["output_tokens"],
        "totalTokens": result["total_tokens"],
        "costEstimate": result["cost_estimate"],
        "status": result["status"],
        "errorMessage": result["error_message"],
        "experiment": exp_dict
    }
