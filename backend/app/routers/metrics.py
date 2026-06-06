from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.database import get_db
from app.core.auth import get_current_user
from app.core.auth import get_user_workspace
from app.models.evaluation_metric import EvaluationMetric
import re

router = APIRouter()

# Injection protection
INJECTION_KEYWORDS = ['ignore', 'disregard', 'forget', 'system', 'instructions',
                      'prompt', 'jailbreak', 'override', 'bypass']
MAX_DESCRIPTION_LENGTH = 500
MAX_NAME_LENGTH = 50

def sanitize_metric_input(text: str) -> str:
    """Strip potential injection attempts from user-defined metric text"""
    # Remove any XML/HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Check for injection keywords
    lower = text.lower()
    for keyword in INJECTION_KEYWORDS:
        if keyword in lower:
            raise ValueError(f"Invalid metric description: contains reserved keyword '{keyword}'")
    # Truncate to max length
    return text.strip()[:MAX_DESCRIPTION_LENGTH]


@router.get("")
def get_metrics(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    workspace = get_user_workspace(current_user, db)
    metrics = db.query(EvaluationMetric).filter(
        EvaluationMetric.workspace_id == workspace.id
    ).order_by(EvaluationMetric.order_index).all()
    return {
        "metrics": [
            {
                "id": str(m.id),
                "name": m.name,
                "description": m.description,
                "isInverse": m.is_inverse,
                "isDefault": m.is_default,
                "orderIndex": m.order_index
            }
            for m in metrics
        ]
    }


@router.post("")
def create_metric(body: dict, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    workspace = get_user_workspace(current_user, db)

    try:
        name = sanitize_metric_input(body.get("name", ""))[:MAX_NAME_LENGTH]
        description = sanitize_metric_input(body.get("description", ""))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not name or not description:
        raise HTTPException(status_code=400, detail="Name and description are required")

    # Check for duplicate name in workspace
    existing = db.query(EvaluationMetric).filter(
        EvaluationMetric.workspace_id == workspace.id,
        EvaluationMetric.name == name
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"A metric named '{name}' already exists")

    # Get next order index
    max_order = db.query(func.max(EvaluationMetric.order_index)).filter(
        EvaluationMetric.workspace_id == workspace.id
    ).scalar() or 0

    metric = EvaluationMetric(
        workspace_id=workspace.id,
        name=name,
        description=description,
        is_inverse=bool(body.get("isInverse", False)),
        is_default=bool(body.get("isDefault", True)),
        order_index=max_order + 1
    )
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return {"metric": {"id": str(metric.id), "name": metric.name, "description": metric.description,
                       "isInverse": metric.is_inverse, "isDefault": metric.is_default}}


@router.patch("/{metric_id}")
def update_metric(metric_id: str, body: dict, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    workspace = get_user_workspace(current_user, db)
    metric = db.query(EvaluationMetric).filter(
        EvaluationMetric.id == metric_id,
        EvaluationMetric.workspace_id == workspace.id
    ).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    try:
        if "name" in body:
            metric.name = sanitize_metric_input(body["name"])[:MAX_NAME_LENGTH]
        if "description" in body:
            metric.description = sanitize_metric_input(body["description"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if "isInverse" in body:
        metric.is_inverse = bool(body["isInverse"])
    if "isDefault" in body:
        metric.is_default = bool(body["isDefault"])

    db.commit()
    db.refresh(metric)
    return {"metric": {"id": str(metric.id), "name": metric.name,
                       "description": metric.description, "isInverse": metric.is_inverse,
                       "isDefault": metric.is_default}}


@router.delete("/{metric_id}")
def delete_metric(metric_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    workspace = get_user_workspace(current_user, db)
    metric = db.query(EvaluationMetric).filter(
        EvaluationMetric.id == metric_id,
        EvaluationMetric.workspace_id == workspace.id
    ).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")

    # Prevent deleting all metrics
    count = db.query(EvaluationMetric).filter(
        EvaluationMetric.workspace_id == workspace.id
    ).count()
    if count <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last metric")

    db.delete(metric)
    db.commit()
    return {"ok": True}
