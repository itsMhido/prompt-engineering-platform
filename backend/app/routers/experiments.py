from datetime import datetime, timezone, timedelta
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel
from sqlalchemy import func, cast, Text, or_, Integer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.experiment import Experiment
from app.models.user import User
from app.core.auth import get_current_user, get_user_workspace
from app.schemas.experiment import ExperimentCreate, ExperimentUpdate, ExperimentRead

router = APIRouter()


class BulkDeleteRequest(BaseModel):
    ids: list[str]


def format_experiment(exp: Experiment) -> dict:
    """Convert Experiment model to API response dict"""
    return {
        "id": str(exp.id),
        "workspaceId": str(exp.workspace_id),
        "promptId": str(exp.prompt_id) if exp.prompt_id else None,
        "promptVersionId": str(exp.prompt_version_id) if exp.prompt_version_id else None,
        "modelId": str(exp.model_id) if exp.model_id else None,
        "datasetId": str(exp.dataset_id) if exp.dataset_id else None,
        "datasetRowIndex": exp.dataset_row_index,
        "batchId": exp.batch_id,
        "batchName": exp.batch_name,
        "promptName": exp.prompt_name,
        "promptVersion": exp.prompt_version,
        "modelName": exp.model_name,
        "provider": exp.provider,
        "systemPrompt": exp.system_prompt,
        "userTemplate": exp.user_template,
        "variableValues": exp.variable_values or {},
        "interpolatedPrompt": exp.interpolated_prompt,
        "output": exp.output,
        "latencyMs": exp.latency_ms,
        "inputTokens": exp.input_tokens,
        "outputTokens": exp.output_tokens,
        "totalTokens": exp.total_tokens,
        "costEstimate": exp.cost_estimate,
        "status": exp.status,
        "errorMessage": exp.error_message,
        "score": exp.score,
        "scores": exp.scores or {},
        "reasoning": exp.reasoning or {},
        "tags": exp.tags or [],
        "notes": exp.notes,
        "createdBy": str(exp.created_by) if exp.created_by else None,
        "createdAt": exp.created_at.isoformat() if exp.created_at else "",
    }


@router.get("/batches")
def get_batches(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all distinct batch runs with metadata, including an ungrouped entry"""
    workspace = get_user_workspace(current_user, db)

    # Get grouped batches
    batches = db.query(
        Experiment.batch_id,
        Experiment.batch_name,
        func.count(Experiment.id).label('row_count'),
        func.sum(func.cast(Experiment.status == 'success', Integer)).label('success_count'),
        func.max(Experiment.created_at).label('created_at')
    ).filter(
        Experiment.workspace_id == workspace.id,
        Experiment.batch_id.isnot(None)
    ).group_by(
        Experiment.batch_id,
        Experiment.batch_name
    ).order_by(
        func.max(Experiment.created_at).desc()
    ).all()

    result = [
        {
            "batchId": b.batch_id,
            "batchName": b.batch_name,
            "rowCount": b.row_count,
            "successCount": b.success_count,
            "createdAt": b.created_at.isoformat() if b.created_at else ""
        }
        for b in batches
    ]

    # Also count ungrouped experiments (batch_id is null)
    ungrouped_count = db.query(func.count(Experiment.id)).filter(
        Experiment.workspace_id == workspace.id,
        Experiment.batch_id.is_(None)
    ).scalar()

    ungrouped_success = db.query(func.count(Experiment.id)).filter(
        Experiment.workspace_id == workspace.id,
        Experiment.batch_id.is_(None),
        Experiment.status == 'success'
    ).scalar()

    ungrouped_latest = db.query(func.max(Experiment.created_at)).filter(
        Experiment.workspace_id == workspace.id,
        Experiment.batch_id.is_(None)
    ).scalar()

    if ungrouped_count and ungrouped_count > 0:
        result.append({
            "batchId": "ungrouped",
            "batchName": "Individual Runs (no batch)",
            "rowCount": ungrouped_count,
            "successCount": ungrouped_success or 0,
            "createdAt": ungrouped_latest.isoformat() if ungrouped_latest else None
        })

    result.sort(key=lambda batch: batch["createdAt"] or "", reverse=True)
    return { "batches": result }

@router.get("")
def list_experiments(
    search: Optional[str] = None,
    provider: Optional[str] = None,
    prompt_id: Optional[str] = Query(None, alias="promptId"),
    prompt_version: Optional[str] = Query(None, alias="promptVersion"),
    status: Optional[str] = None,
    date_range: Optional[str] = Query(None, alias="dateRange"),
    dataset_id: Optional[str] = Query(None, alias="datasetId"),
    batch_id: Optional[str] = Query(None, alias="batchId"),
    sort_field: Optional[str] = Query("created_at", alias="sortField"),
    sort_dir: Optional[str] = Query("desc", alias="sortDir"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List experiments with filtering and sorting"""
    workspace = get_user_workspace(current_user, db)
    
    # Base query: all experiments in workspace
    query = db.query(Experiment).filter(Experiment.workspace_id == workspace.id)
    
    # Apply filters
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(Experiment.prompt_name).ilike(search_term),
                func.lower(Experiment.output).ilike(search_term),
                func.lower(cast(Experiment.variable_values, Text)).ilike(search_term),
            )
        )
    
    if provider:
        query = query.filter(Experiment.provider == provider)
    
    if prompt_id:
        query = query.filter(Experiment.prompt_id == prompt_id)
    
    if prompt_version:
        query = query.filter(Experiment.prompt_version == prompt_version)
    
    if status:
        query = query.filter(Experiment.status == status)
    
    if dataset_id:
        query = query.filter(Experiment.dataset_id == dataset_id)
    
    if batch_id == "ungrouped":
        query = query.filter(Experiment.batch_id.is_(None))
    elif batch_id:
        query = query.filter(Experiment.batch_id == batch_id)
    
    # Apply date range filter
    if date_range:
        now = datetime.now(timezone.utc)
        if date_range == "today":
            start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
            query = query.filter(Experiment.created_at >= start_of_day)
        elif date_range == "week":
            seven_days_ago = now - timedelta(days=7)
            query = query.filter(Experiment.created_at >= seven_days_ago)
        elif date_range == "month":
            thirty_days_ago = now - timedelta(days=30)
            query = query.filter(Experiment.created_at >= thirty_days_ago)
        # "all" means no filter
    
    # Apply sorting
    sort_column = getattr(Experiment, sort_field, Experiment.created_at)
    if sort_dir.lower() == "asc":
        query = query.order_by(sort_column.asc())
    else:
        query = query.order_by(sort_column.desc())
    
    experiments = query.all()
    
    return {
        "experiments": [format_experiment(exp) for exp in experiments]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_experiment(
    request: ExperimentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually log an experiment"""
    workspace = get_user_workspace(current_user, db)
    
    # Verify workspace_id matches
    if request.workspace_id != workspace.id:
        raise HTTPException(status_code=403, detail="Cannot create experiment in different workspace")
    
    # Create experiment
    db_experiment = Experiment(
        **request.model_dump(),
        created_by=current_user.id,
    )
    db.add(db_experiment)
    db.commit()
    db.refresh(db_experiment)
    
    return {
        "experiment": format_experiment(db_experiment)
    }


@router.patch("/{experiment_id}")
def update_experiment(
    experiment_id: str,
    request: ExperimentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update experiment fields (score, notes, tags, scores, reasoning)"""
    workspace = get_user_workspace(current_user, db)
    
    db_experiment = db.query(Experiment).filter(
        Experiment.id == experiment_id,
        Experiment.workspace_id == workspace.id
    ).first()
    
    if not db_experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    # Update only provided fields
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if value is not None:
            setattr(db_experiment, key, value)
    
    db.commit()
    db.refresh(db_experiment)
    
    return {
        "experiment": format_experiment(db_experiment)
    }


@router.delete("/{experiment_id}")
def delete_experiment(
    experiment_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete an experiment"""
    workspace = get_user_workspace(current_user, db)
    
    db_experiment = db.query(Experiment).filter(
        Experiment.id == experiment_id,
        Experiment.workspace_id == workspace.id
    ).first()
    
    if not db_experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    
    db.delete(db_experiment)
    db.commit()
    
    return {"ok": True}


@router.post("/bulk-delete", status_code=status.HTTP_200_OK)
def bulk_delete_experiments(
    request: BulkDeleteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Bulk delete experiments"""
    workspace = get_user_workspace(current_user, db)
    ids = request.ids
    
    if not ids:
        return {"ok": True, "deletedCount": 0}
    
    # Verify all experiments belong to workspace
    count = db.query(Experiment).filter(
        Experiment.id.in_(ids),
        Experiment.workspace_id == workspace.id
    ).count()
    
    if count != len(ids):
        raise HTTPException(status_code=403, detail="Some experiments do not belong to this workspace")
    
    # Delete all
    deleted = db.query(Experiment).filter(
        Experiment.id.in_(ids),
        Experiment.workspace_id == workspace.id
    ).delete()
    
    db.commit()
    
    return {"ok": True, "deletedCount": deleted}
