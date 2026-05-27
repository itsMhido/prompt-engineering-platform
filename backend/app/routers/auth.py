from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.auth import RegisterRequest, LoginRequest, AuthResponse, MeResponse, UpdateMeRequest
from app.models.user import User
from app.models.workspace import Workspace, WorkspaceMember
from app.core.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=AuthResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == request.email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    
    user = User(
        email=request.email,
        password_hash=hash_password(request.password),
        name=request.name
    )
    db.add(user)
    db.flush()

    workspace = Workspace(
        name=f"{user.name}'s Workspace",
        owner_id=user.id
    )
    db.add(workspace)
    db.flush()

    member = WorkspaceMember(
        workspace_id=workspace.id,
        user_id=user.id,
        role="admin"
    )
    db.add(member)
    db.commit()
    db.refresh(user)
    db.refresh(workspace)

    token = create_access_token({"sub": str(user.id), "email": user.email})

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else ""
        },
        "token": token,
        "workspace": {"id": str(workspace.id), "name": workspace.name}
    }


@router.post("/login", response_model=AuthResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    
    workspace_member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user.id).first()
    if not workspace_member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no workspace")
    workspace = db.query(Workspace).filter(Workspace.id == workspace_member.workspace_id).first()
    
    token = create_access_token({"sub": str(user.id), "email": user.email})

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "created_at": user.created_at.isoformat() if user.created_at else ""
        },
        "token": token,
        "workspace": {"id": str(workspace.id), "name": workspace.name}
    }


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace_member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == current_user.id).first()
    if not workspace_member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no workspace")
    workspace = db.query(Workspace).filter(Workspace.id == workspace_member.workspace_id).first()
    
    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else ""
        },
        "workspace": {"id": str(workspace.id), "name": workspace.name}
    }


@router.patch("/me", response_model=dict)
def update_me(request: UpdateMeRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    name = request.name.strip()
    if not name:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Name is required")

    current_user.name = name
    db.commit()
    db.refresh(current_user)

    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "role": current_user.role,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else ""
        }
    }
