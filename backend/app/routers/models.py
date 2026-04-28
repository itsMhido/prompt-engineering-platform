from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_models():
    return {"models": []}


@router.post("")
def create_model():
    return {"message": "Not implemented yet"}


@router.patch("/{model_id}")
def update_model(model_id: str):
    return {"message": f"Not implemented yet for {model_id}"}


@router.delete("/{model_id}")
def delete_model(model_id: str):
    return {"ok": False, "modelId": model_id}


@router.post("/validate")
def validate_model():
    return {"valid": False, "error": "Not implemented yet"}
