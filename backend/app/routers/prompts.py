from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, func

from app.database import get_db
from app.models.user import User
from app.models.prompt import Prompt, PromptVersion
from app.models.experiment import Experiment
from app.schemas.prompt import PromptCreate, PromptUpdate, VersionCreate, VersionUpdate
from app.core.auth import get_current_user, get_user_workspace

router = APIRouter()

@router.get("", response_model=dict)
def list_prompts(
    search: Optional[str] = None, 
    tag: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_user_workspace(current_user, db)
    query = db.query(Prompt).filter(Prompt.workspace_id == workspace.id)
    
    if search:
        search_term = f"%{search.lower()}%"
        query = query.filter(
            (func.lower(Prompt.name).like(search_term)) |
            (func.lower(Prompt.description).like(search_term)) |
            (cast(Prompt.tags, String).ilike(search_term))
        )
    if tag:
        query = query.filter(Prompt.tags.any(tag))

    prompts = query.order_by(Prompt.updated_at.desc()).all()
    
    result = []
    for p in prompts:
        v_count = db.query(func.count(PromptVersion.id)).filter(PromptVersion.prompt_id == p.id).scalar()
        e_count = db.query(func.count(Experiment.id)).filter(Experiment.prompt_id == p.id).scalar()
        result.append({
            "id": str(p.id),
            "name": p.name,
            "description": p.description,
            "tags": p.tags,
            "versionCount": v_count or 0,
            "experimentCount": e_count or 0,
            "createdAt": p.created_at.isoformat() if p.created_at else "",
            "updatedAt": p.updated_at.isoformat() if p.updated_at else ""
        })
    return {"prompts": result}


@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_prompt(
    request: PromptCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_user_workspace(current_user, db)
    db_prompt = Prompt(
        workspace_id=workspace.id,
        name=request.name,
        description=request.description,
        tags=request.tags,
        created_by=current_user.id
    )
    db.add(db_prompt)
    db.flush()
    
    initial_version = PromptVersion(
        prompt_id=db_prompt.id,
        version_number=1,
        system_prompt="",
        user_template="",
        commit_message="Initial version",
        created_by=current_user.id
    )
    db.add(initial_version)
    db.commit()
    db.refresh(db_prompt)
    db.refresh(initial_version)
    
    return {
        "prompt": {
            "id": str(db_prompt.id),
            "name": db_prompt.name,
            "description": db_prompt.description,
            "tags": db_prompt.tags,
            "versionCount": 1,
            "experimentCount": 0,
            "createdAt": db_prompt.created_at.isoformat() if db_prompt.created_at else "",
            "updatedAt": db_prompt.updated_at.isoformat() if db_prompt.updated_at else ""
        },
        "initialVersion": {
            "id": str(initial_version.id),
            "promptId": str(initial_version.prompt_id),
            "versionNumber": initial_version.version_number,
            "versionDisplay": f"v{initial_version.version_number}",
            "systemPrompt": initial_version.system_prompt,
            "userTemplate": initial_version.user_template,
            "commitMessage": initial_version.commit_message,
            "createdAt": initial_version.created_at.isoformat() if initial_version.created_at else ""
        }
    }


@router.patch("/{prompt_id}", response_model=dict)
def update_prompt(
    prompt_id: str,
    request: PromptUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_user_workspace(current_user, db)
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.workspace_id == workspace.id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    update_data = request.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        if hasattr(db_prompt, key):
            setattr(db_prompt, key, value)
            
    db_prompt.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(db_prompt)
    
    v_count = db.query(func.count(PromptVersion.id)).filter(PromptVersion.prompt_id == db_prompt.id).scalar()
    e_count = db.query(func.count(Experiment.id)).filter(Experiment.prompt_id == db_prompt.id).scalar()
    
    return {
        "prompt": {
            "id": str(db_prompt.id),
            "name": db_prompt.name,
            "description": db_prompt.description,
            "tags": db_prompt.tags,
            "versionCount": v_count or 0,
            "experimentCount": e_count or 0,
            "createdAt": db_prompt.created_at.isoformat() if db_prompt.created_at else "",
            "updatedAt": db_prompt.updated_at.isoformat() if db_prompt.updated_at else ""
        }
    }


@router.post("/{prompt_id}/duplicate", status_code=status.HTTP_201_CREATED, response_model=dict)
def duplicate_prompt(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_user_workspace(current_user, db)
    orig_prompt = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.workspace_id == workspace.id).first()
    if not orig_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    new_prompt = Prompt(
        workspace_id=workspace.id,
        name=f"{orig_prompt.name} (copy)",
        description=orig_prompt.description,
        tags=orig_prompt.tags,
        created_by=current_user.id
    )
    db.add(new_prompt)
    db.flush()
    
    orig_versions = db.query(PromptVersion).filter(PromptVersion.prompt_id == orig_prompt.id).order_by(PromptVersion.version_number).all()
    
    new_versions = []
    for ov in orig_versions:
        nv = PromptVersion(
            prompt_id=new_prompt.id,
            version_number=ov.version_number,
            system_prompt=ov.system_prompt,
            user_template=ov.user_template,
            commit_message=ov.commit_message,
            created_by=current_user.id
        )
        db.add(nv)
        new_versions.append(nv)
        
    db.commit()
    db.refresh(new_prompt)
    
    return {
        "prompt": {
            "id": str(new_prompt.id),
            "name": new_prompt.name,
            "description": new_prompt.description,
            "tags": new_prompt.tags,
            "versionCount": len(new_versions),
            "experimentCount": 0,
            "createdAt": new_prompt.created_at.isoformat() if new_prompt.created_at else "",
            "updatedAt": new_prompt.updated_at.isoformat() if new_prompt.updated_at else ""
        },
        "versions": [{
            "id": str(nv.id),
            "promptId": str(nv.prompt_id),
            "versionNumber": nv.version_number,
            "versionDisplay": f"v{nv.version_number}",
            "systemPrompt": nv.system_prompt,
            "userTemplate": nv.user_template,
            "commitMessage": nv.commit_message,
            "createdAt": nv.created_at.isoformat() if nv.created_at else ""
        } for nv in new_versions]
    }


@router.delete("/{prompt_id}", response_model=dict)
def delete_prompt(
    prompt_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_user_workspace(current_user, db)
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.workspace_id == workspace.id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    experiments = db.query(Experiment).filter(Experiment.prompt_id == prompt_id).all()
    for exp in experiments:
        exp.prompt_id = None
        exp.prompt_version_id = None
        
    db.delete(db_prompt)
    db.commit()
    return {"ok": True}


@router.get("/{prompt_id}/versions", response_model=dict)
def list_prompt_versions(
    prompt_id: str,
    sort: Optional[str] = "version_desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_user_workspace(current_user, db)
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.workspace_id == workspace.id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    query = db.query(PromptVersion).filter(PromptVersion.prompt_id == prompt_id)
    if sort == "version_asc":
        query = query.order_by(PromptVersion.version_number.asc())
    else:
        query = query.order_by(PromptVersion.version_number.desc())
        
    versions = query.all()
    return {
        "versions": [{
            "id": str(v.id),
            "promptId": str(v.prompt_id),
            "versionNumber": v.version_number,
            "versionDisplay": f"v{v.version_number}",
            "systemPrompt": v.system_prompt,
            "userTemplate": v.user_template,
            "commitMessage": v.commit_message,
            "createdAt": v.created_at.isoformat() if v.created_at else ""
        } for v in versions]
    }


@router.post("/{prompt_id}/versions", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_prompt_version(
    prompt_id: str,
    request: VersionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_user_workspace(current_user, db)
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.workspace_id == workspace.id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    max_version = db.query(func.max(PromptVersion.version_number)).filter(PromptVersion.prompt_id == prompt_id).scalar()
    new_version_number = (max_version or 0) + 1
    
    new_version = PromptVersion(
        prompt_id=prompt_id,
        version_number=new_version_number,
        system_prompt=request.systemPrompt,
        user_template=request.userTemplate,
        commit_message=request.commitMessage,
        created_by=current_user.id
    )
    db.add(new_version)
    
    db_prompt.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(new_version)
    
    return {
        "version": {
            "id": str(new_version.id),
            "promptId": str(new_version.prompt_id),
            "versionNumber": new_version.version_number,
            "versionDisplay": f"v{new_version.version_number}",
            "systemPrompt": new_version.system_prompt,
            "userTemplate": new_version.user_template,
            "commitMessage": new_version.commit_message,
            "createdAt": new_version.created_at.isoformat() if new_version.created_at else ""
        }
    }


@router.get("/{prompt_id}/versions/{version_id}", response_model=dict)
def get_prompt_version(
    prompt_id: str,
    version_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    workspace = get_user_workspace(current_user, db)
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.workspace_id == workspace.id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    version = db.query(PromptVersion).filter(PromptVersion.id == version_id, PromptVersion.prompt_id == prompt_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
        
    return {
        "version": {
            "id": str(version.id),
            "promptId": str(version.prompt_id),
            "versionNumber": version.version_number,
            "versionDisplay": f"v{version.version_number}",
            "systemPrompt": version.system_prompt,
            "userTemplate": version.user_template,
            "commitMessage": version.commit_message,
            "createdAt": version.created_at.isoformat() if version.created_at else ""
        }
    }

@router.patch("/{prompt_id}/versions/{version_id}", response_model=dict)
def update_version(
    prompt_id: str,
    version_id: str,
    body: VersionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    workspace = get_user_workspace(current_user, db)
    db_prompt = db.query(Prompt).filter(Prompt.id == prompt_id, Prompt.workspace_id == workspace.id).first()
    if not db_prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
        
    version = db.query(PromptVersion).filter(PromptVersion.id == version_id, PromptVersion.prompt_id == prompt_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
        
    if body.systemPrompt is not None:
        version.system_prompt = body.systemPrompt
    if body.userTemplate is not None:
        version.user_template = body.userTemplate
    if body.commitMessage is not None:
        version.commit_message = body.commitMessage
        
    db_prompt.updated_at = datetime.now(timezone.utc)
    
    db.commit()
    db.refresh(version)
    
    return {
        "version": {
            "id": str(version.id),
            "promptId": str(version.prompt_id),
            "versionNumber": version.version_number,
            "versionDisplay": f"v{version.version_number}",
            "systemPrompt": version.system_prompt,
            "userTemplate": version.user_template,
            "commitMessage": version.commit_message,
            "createdAt": version.created_at.isoformat() if version.created_at else ""
        }
    }
