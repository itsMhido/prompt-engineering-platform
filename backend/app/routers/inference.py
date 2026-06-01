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
from app.services.experiment_logger import log_experiment, experiment_to_dict

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
    batchId: Optional[str] = None
    batchName: Optional[str] = None

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

    experiment = log_experiment(
        db=db,
        workspace_id=workspace.id,
        model_id=model.id,
        result=result,
        user=current_user,
        prompt_id=prompt.id if prompt else None,
        prompt_version_id=version.id if version else None,
        prompt_name=prompt.name if prompt else None,
        prompt_version=f"v{version.version_number}" if version else None,
        model_name=model.name,
        provider=model.provider,
        system_prompt=request.systemPrompt,
        user_template=request.userTemplate,
        variable_values=request.variableValues or {},
        interpolated_prompt=request.userMessage,
        dataset_id=request.datasetId or None,
        dataset_row_index=request.datasetRowIndex,
        batch_id=request.batchId,
        batch_name=request.batchName
    )

    return {
        "output": result["output"],
        "latency": result["latency"],
        "inputTokens": result["input_tokens"],
        "outputTokens": result["output_tokens"],
        "totalTokens": result["total_tokens"],
        "costEstimate": result["cost_estimate"],
        "status": result["status"],
        "errorMessage": result["error_message"],
        "experiment": experiment_to_dict(experiment)
    }
