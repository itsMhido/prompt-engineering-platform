from typing import Optional, Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.dataset import Dataset, DatasetRow
from app.models.user import User
from app.core.auth import get_current_user, get_user_workspace
from app.schemas.dataset import DatasetCreate, DatasetUpdate

router = APIRouter()


def format_dataset(dataset: Dataset, include_rows: bool = False) -> dict:
    """Convert Dataset model to API response dict"""
    row_count = len(dataset.rows) if dataset.rows else 0
    
    result = {
        "id": str(dataset.id),
        "name": dataset.name,
        "category": dataset.category,
        "version": dataset.version,
        "columns": dataset.columns,
        "rowCount": row_count,
        "createdAt": dataset.created_at.isoformat() if dataset.created_at else "",
        "updatedAt": dataset.updated_at.isoformat() if dataset.updated_at else "",
    }
    
    if include_rows:
        # Sort rows by row_index and extract row_data
        sorted_rows = sorted(dataset.rows, key=lambda r: r.row_index)
        result["rows"] = [row.row_data for row in sorted_rows]
    
    return result


@router.get("")
def list_datasets(
    search: Optional[str] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all datasets in workspace with optional filtering"""
    workspace = get_user_workspace(current_user, db)
    
    # Query datasets
    query = db.query(Dataset).filter(Dataset.workspace_id == workspace.id)
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(Dataset.name.ilike(search_term))
    
    if category:
        query = query.filter(Dataset.category == category)
    
    # Sort by updated_at descending
    datasets = query.order_by(Dataset.updated_at.desc()).all()
    
    return {
        "datasets": [format_dataset(ds) for ds in datasets]
    }


@router.post("", status_code=status.HTTP_201_CREATED)
def create_dataset(
    request: DatasetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new dataset with rows"""
    workspace = get_user_workspace(current_user, db)
    
    # Create dataset
    db_dataset = Dataset(
        workspace_id=workspace.id,
        name=request.name,
        category=request.category,
        version=request.version,
        columns=request.columns,
        created_by=current_user.id,
    )
    db.add(db_dataset)
    db.flush()  # Get the ID without committing yet
    
    # Create dataset rows
    for idx, row_data in enumerate(request.rows):
        db_row = DatasetRow(
            dataset_id=db_dataset.id,
            row_index=idx,
            row_data=row_data,
        )
        db.add(db_row)
    
    db.commit()
    db.refresh(db_dataset)
    
    return {
        "dataset": format_dataset(db_dataset)
    }


@router.get("/{dataset_id}")
def get_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single dataset with all rows"""
    workspace = get_user_workspace(current_user, db)
    
    db_dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.workspace_id == workspace.id
    ).first()
    
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return {
        "dataset": format_dataset(db_dataset, include_rows=True)
    }


@router.put("/{dataset_id}")
def update_dataset(
    dataset_id: str,
    request: DatasetUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a dataset (optionally replace all rows)"""
    workspace = get_user_workspace(current_user, db)
    
    db_dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.workspace_id == workspace.id
    ).first()
    
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    # Update dataset fields if provided
    update_data = request.model_dump(exclude_unset=True, exclude={"rows"})
    for key, value in update_data.items():
        if value is not None:
            setattr(db_dataset, key, value)
    
    # If rows provided, replace all existing rows
    if request.rows is not None:
        # Delete all existing rows
        db.query(DatasetRow).filter(DatasetRow.dataset_id == db_dataset.id).delete()
        
        # Insert new rows
        for idx, row_data in enumerate(request.rows):
            db_row = DatasetRow(
                dataset_id=db_dataset.id,
                row_index=idx,
                row_data=row_data,
            )
            db.add(db_row)
    
    db.commit()
    db.refresh(db_dataset)
    
    return {
        "dataset": format_dataset(db_dataset, include_rows=True)
    }


@router.delete("/{dataset_id}")
def delete_dataset(
    dataset_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a dataset (cascades to dataset_rows)"""
    workspace = get_user_workspace(current_user, db)
    
    db_dataset = db.query(Dataset).filter(
        Dataset.id == dataset_id,
        Dataset.workspace_id == workspace.id
    ).first()
    
    if not db_dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    db.delete(db_dataset)
    db.commit()
    
    return {"ok": True}


@router.post("/import", status_code=status.HTTP_201_CREATED)
def import_dataset(
    request: DatasetCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import a dataset (same as POST /api/datasets)"""
    # Delegate to create_dataset
    return create_dataset(request, current_user, db)
