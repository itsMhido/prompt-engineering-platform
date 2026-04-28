from fastapi import APIRouter

router = APIRouter()


@router.post("/score")
def score_evaluation():
    return {"message": "Not implemented yet"}


@router.post("/batch-run")
def batch_run_evaluation():
    return {"message": "Not implemented yet"}
