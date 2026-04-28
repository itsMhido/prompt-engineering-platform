from fastapi import APIRouter

router = APIRouter()


@router.post("/run")
def run_inference():
    return {"message": "Not implemented yet"}
