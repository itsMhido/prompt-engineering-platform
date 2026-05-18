"""Shared experiment logging logic used by both inference and batch-run endpoints"""

from sqlalchemy.orm import Session
from app.models.experiment import Experiment
from app.models.user import User


def log_experiment(
    db: Session,
    workspace_id,
    model_id,
    result: dict,
    user: User,
    prompt_id=None,
    prompt_version_id=None,
    dataset_id=None,
    dataset_row_index=None,
    prompt_name=None,
    prompt_version=None,
    model_name=None,
    provider=None,
    system_prompt=None,
    user_template=None,
    variable_values=None,
    interpolated_prompt=None,
) -> Experiment:
    """
    Log an experiment to the database.
    
    Args:
        db: Database session
        workspace_id: Workspace UUID
        model_id: Model UUID
        result: Response from call_provider() containing output, latency, tokens, cost, status, error_message
        user: Current user
        prompt_id, prompt_version_id, dataset_id, dataset_row_index: Optional references
        prompt_name, prompt_version, model_name, provider: Denormalized display fields
        system_prompt, user_template, variable_values, interpolated_prompt: Prompt content snapshot
    
    Returns:
        Experiment model instance (already committed to DB)
    """
    experiment = Experiment(
        workspace_id=workspace_id,
        prompt_id=prompt_id,
        prompt_version_id=prompt_version_id,
        model_id=model_id,
        dataset_id=dataset_id,
        dataset_row_index=dataset_row_index,
        prompt_name=prompt_name,
        prompt_version=prompt_version,
        model_name=model_name,
        provider=provider,
        system_prompt=system_prompt,
        user_template=user_template,
        variable_values=variable_values or {},
        interpolated_prompt=interpolated_prompt,
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
        created_by=user.id
    )
    db.add(experiment)
    db.commit()
    db.refresh(experiment)
    return experiment


def experiment_to_dict(experiment: Experiment) -> dict:
    """Convert an Experiment model instance to a response dictionary (camelCase)"""
    return {
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
