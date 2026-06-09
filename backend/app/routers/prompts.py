from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import cast, String, func

from app.database import get_db
from app.models.user import User
from app.models.prompt import Prompt, PromptVersion
from app.models.experiment import Experiment
from app.schemas.prompt import PromptCreate, PromptUpdate, VersionCreate
from app.core.auth import get_current_user, get_user_workspace

router = APIRouter()

@router.get("", response_model=dict)
def list_prompts(
    search: Optional[str] = None, 
    tag: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all prompts for the current user's workspace.
    
    Endpoint: GET /prompts
    
    Parameters:
        - search (optional): Search term to filter prompts by name, description, or tags (case-insensitive)
        - tag (optional): Filter prompts that have a specific tag
        - current_user: Authenticated user making the request
        - db: Database session
    
    Returns:
        Dictionary with "prompts" key containing list of prompt objects.
        Each prompt includes: id, name, description, tags, versionCount, experimentCount, createdAt, updatedAt
    
    Behavior:
        - Retrieves all prompts associated with the current user's workspace
        - Applies search filter across name, description, and tags if provided
        - Applies tag filter if specified
        - Orders results by most recently updated first
        - Counts associated versions and experiments for each prompt
    """
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
    """
    Create a new prompt in the current user's workspace.
    
    Endpoint: POST /prompts
    
    Parameters:
        - request (PromptCreate): Request body containing:
            - name: Name of the prompt
            - description: Description of the prompt
            - tags: List of tags for categorization
        - current_user: Authenticated user making the request
        - db: Database session
    
    Returns:
        Dictionary containing:
        - "prompt": The newly created prompt object with id, name, description, tags, etc.
        - "initialVersion": The automatically created initial version (v1) with empty system_prompt and user_template
    
    Behavior:
        - Creates a new Prompt record in the workspace
        - Automatically creates an initial PromptVersion (v1) with empty content
        - Sets created_by to the current user
        - Returns HTTP 201 Created status
    """
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
    """
    Update an existing prompt's metadata.
    
    Endpoint: PATCH /prompts/{prompt_id}
    
    Parameters:
        - prompt_id: ID of the prompt to update
        - request (PromptUpdate): Request body with fields to update (name, description, tags)
        - current_user: Authenticated user making the request
        - db: Database session
    
    Returns:
        Dictionary with "prompt" key containing the updated prompt object
    
    Behavior:
        - Only allows updating prompts in the current user's workspace
        - Updates only the fields provided in the request (PATCH semantics)
        - Updates the updated_at timestamp to current time
        - Returns 404 if prompt not found or not in user's workspace
        - Recalculates version count and experiment count
    """
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
    """
    Duplicate an existing prompt with all its versions.
    
    Endpoint: POST /prompts/{prompt_id}/duplicate
    
    Parameters:
        - prompt_id: ID of the prompt to duplicate
        - current_user: Authenticated user making the request
        - db: Database session
    
    Returns:
        Dictionary containing:
        - "prompt": The newly duplicated prompt (with " (copy)" appended to name)
        - "versions": List of all duplicated versions
    
    Behavior:
        - Creates a new Prompt with name appended with " (copy)"
        - Copies all existing versions from the original prompt
        - Preserves version numbers and content exactly
        - Returns HTTP 201 Created status
        - Returns 404 if source prompt not found or not in user's workspace
    """
    """

    """
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
    """
    Delete a prompt and update associated experiments.
    
    Endpoint: DELETE /prompts/{prompt_id}
    
    Parameters:
        - prompt_id: ID of the prompt to delete
        - current_user: Authenticated user making the request
        - db: Database session
    
    Returns:
        Dictionary with "ok": true on successful deletion
    
    Behavior:
        - Only allows deletion of prompts in the current user's workspace
        - Finds all experiments linked to this prompt
        - Nullifies prompt_id and prompt_version_id references in those experiments
        - Deletes the prompt record
        - Returns 404 if prompt not found or not in user's workspace
    """
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
    """
    List all versions of a specific prompt.
    
    Endpoint: GET /prompts/{prompt_id}/versions
    
    Parameters:
        - prompt_id: ID of the prompt to retrieve versions for
        - sort (optional): Sorting order - "version_asc" for ascending or "version_desc" (default) for descending
        - current_user: Authenticated user making the request
        - db: Database session
    
    Returns:
        Dictionary with "versions" key containing list of PromptVersion objects.
        Each version includes: id, promptId, versionNumber, versionDisplay, systemPrompt, userTemplate, commitMessage, createdAt
    
    Behavior:
        - Retrieves all versions for the specified prompt
        - Applies sorting based on version number
        - Returns 404 if prompt not found or not in user's workspace
    """
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
    """
    Create a new version of an existing prompt.
    
    Endpoint: POST /prompts/{prompt_id}/versions
    
    Parameters:
        - prompt_id: ID of the prompt to create a version for
        - request (VersionCreate): Request body containing:
            - systemPrompt: System prompt content
            - userTemplate: User template content
            - commitMessage: Description of changes in this version
        - current_user: Authenticated user making the request
        - db: Database session
    
    Returns:
        Dictionary with "version" key containing the newly created PromptVersion object
    
    Behavior:
        - Increments version number automatically (max existing version + 1)
        - Updates the prompt's updated_at timestamp
        - Returns HTTP 201 Created status
        - Returns 404 if prompt not found or not in user's workspace
    """
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
    """
    Retrieve a specific version of a prompt.
    
    Endpoint: GET /prompts/{prompt_id}/versions/{version_id}
    
    Parameters:
        - prompt_id: ID of the prompt
        - version_id: ID of the specific version to retrieve
        - current_user: Authenticated user making the request
        - db: Database session
    
    Returns:
        Dictionary with "version" key containing the PromptVersion object
    
    Behavior:
        - Returns 404 if prompt not found or not in user's workspace
        - Returns 404 if version not found or doesn't belong to the specified prompt
    """
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
