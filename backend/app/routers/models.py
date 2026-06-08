import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User
from app.models.workspace import WorkspaceMember
from app.models.model import Model as DBModel
from app.schemas.model import ModelCreate, ModelUpdate, ModelResponse, ValidateRequest
from app.core.auth import get_current_user
from app.services.crypto import encrypt, decrypt

router = APIRouter()

def get_user_workspace_id(db: Session, user_id: str) -> str:
    member = db.query(WorkspaceMember).filter(WorkspaceMember.user_id == user_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User has no workspace")
    return member.workspace_id

def map_model(m: DBModel) -> dict:
    return {
        "id": str(m.id),
        "name": m.name,
        "provider": m.provider,
        "modelId": m.model_id,
        "endpoint": m.endpoint,
        "apiKey": "••••••••",
        "temperature": m.temperature,
        "maxTokens": m.max_tokens,
        "topP": m.top_p,
        "stopSequences": m.stop_sequences,
        "status": m.status,
        "createdAt": m.created_at.isoformat() if m.created_at else "",
        "updatedAt": m.updated_at.isoformat() if m.updated_at else ""
    }


@router.get("", response_model=dict)
def list_models(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace_id = get_user_workspace_id(db, current_user.id)
    models = db.query(DBModel).filter(DBModel.workspace_id == workspace_id).all()
    return {"models": [map_model(m) for m in models]}


@router.post("", status_code=status.HTTP_201_CREATED, response_model=dict)
def create_model(request: ModelCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace_id = get_user_workspace_id(db, current_user.id)

    db_model = DBModel(
        workspace_id=workspace_id,
        name=request.name,
        provider=request.provider,
        model_id=request.modelId,
        endpoint=request.endpoint,
        api_key_encrypted=encrypt(request.apiKey),
        temperature=request.temperature,
        max_tokens=request.maxTokens,
        top_p=request.topP,
        stop_sequences=request.stopSequences,
        status=request.status
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)

    return {"model": map_model(db_model)}


@router.patch("/{model_id}", response_model=dict)
def update_model(model_id: str, request: ModelUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace_id = get_user_workspace_id(db, current_user.id)
    db_model = db.query(DBModel).filter(DBModel.id == model_id, DBModel.workspace_id == workspace_id).first()
    if not db_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

    update_data = request.model_dump(exclude_unset=True)
    if "apiKey" in update_data and update_data["apiKey"] is not None:
        db_model.api_key_encrypted = encrypt(update_data["apiKey"])
        del update_data["apiKey"]

    if "modelId" in update_data:
        db_model.model_id = update_data["modelId"]
        del update_data["modelId"]

    if "maxTokens" in update_data:
        db_model.max_tokens = update_data["maxTokens"]
        del update_data["maxTokens"]

    if "topP" in update_data:
        db_model.top_p = update_data["topP"]
        del update_data["topP"]

    if "stopSequences" in update_data:
        db_model.stop_sequences = update_data["stopSequences"]
        del update_data["stopSequences"]

    for key, value in update_data.items():
        if hasattr(db_model, key):
            setattr(db_model, key, value)

    db.commit()
    db.refresh(db_model)

    return {"model": map_model(db_model)}


@router.delete("/{model_id}", response_model=dict)
def delete_model(model_id: str, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    workspace_id = get_user_workspace_id(db, current_user.id)
    db_model = db.query(DBModel).filter(DBModel.id == model_id, DBModel.workspace_id == workspace_id).first()
    if not db_model:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")

    db.delete(db_model)
    db.commit()
    return {"ok": True}


@router.post("/validate", response_model=dict)
async def validate_model(request: ValidateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if request.modelId:
        workspace_id = get_user_workspace_id(db, current_user.id)
        db_model = db.query(DBModel).filter(DBModel.id == request.modelId, DBModel.workspace_id == workspace_id).first()
        if not db_model:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Model not found")
        provider = db_model.provider
        api_key = decrypt(db_model.api_key_encrypted)
        endpoint = db_model.endpoint
        provider_model_id = db_model.model_id
    else:
        provider = request.provider
        api_key = request.apiKey
        endpoint = request.endpoint
        provider_model_id = request.providerModelId

    if not all([provider, api_key, provider_model_id]):
        raise HTTPException(status_code=400, detail="Missing required fields for validation")

    provider = provider.lower()

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            if provider == "anthropic":
                headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01", "content-type": "application/json"}
                payload = {
                    "model": provider_model_id,
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}]
                }
                url = f"{endpoint.rstrip('/')}/v1/messages"
                response = await client.post(url, headers=headers, json=payload)

            elif provider in ["openai", "groq", "mistral"]:
                headers = {"Authorization": f"Bearer {api_key}", "content-type": "application/json"}
                payload = {
                    "model": provider_model_id,
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}]
                }
                url = f"{endpoint.rstrip('/')}/v1/chat/completions"
                if "chat/completions" in endpoint:
                    url = endpoint
                elif "v1" not in endpoint and endpoint.endswith("/"):
                    url = f"{endpoint}v1/chat/completions"
                response = await client.post(url, headers=headers, json=payload)

            elif provider == "google":
                headers = {"content-type": "application/json"}
                payload = {
                    "contents": [{"parts": [{"text": "hi"}]}]
                }
                # Support endpoint missing full path
                if "generateContent" in endpoint:
                    url = endpoint
                    if "?" not in url:
                        url = f"{url}?key={api_key}"
                else:
                    url = f"{endpoint.rstrip('/')}/v1beta/models/{provider_model_id}:generateContent?key={api_key}"
                response = await client.post(url, headers=headers, json=payload)

            elif provider == "huggingface":
                # Use stored endpoint or fall back to HF Messages API default
                hf_endpoint = (endpoint or "").strip()
                if not hf_endpoint:
                    hf_endpoint = "https://api-inference.huggingface.co/v1/chat/completions"
                headers = {"Authorization": f"Bearer {api_key}", "content-type": "application/json"}
                payload = {
                    "model": provider_model_id,
                    "max_tokens": 1,
                    "messages": [{"role": "user", "content": "hi"}]
                }
                response = await client.post(hf_endpoint, headers=headers, json=payload)
                # 401/403 → bad token; 200/404/422 → token valid (model may not support chat)
                if response.status_code in [401, 403]:
                    return {"valid": False, "error": "invalid_api_key"}
                return {"valid": True}

            else:
                return {"valid": False, "error": f"Unsupported provider: {provider}"}

            if response.status_code in [401, 403]:
                return {"valid": False, "error": "invalid_api_key"}

            response_data = response.json()
            if "error" in response_data and isinstance(response_data["error"], dict):
                error_msg = str(response_data["error"].get("message", ""))
                if "invalid" in error_msg.lower() and "key" in error_msg.lower():
                    return {"valid": False, "error": "invalid_api_key"}
                if "authentication" in error_msg.lower():
                    return {"valid": False, "error": "invalid_api_key"}

            return {"valid": True}

    except Exception as e:
        # Surface the error — network errors aren't necessarily bad keys
        error_str = str(e).lower()
        if "auth" in error_str or "credential" in error_str or "unauthorized" in error_str:
            return {"valid": False, "error": "invalid_api_key"}
        return {"valid": False, "error": str(e)}
