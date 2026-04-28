from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_experiments():
    return {"experiments": []}


@router.post("")
def create_experiment():
    return {"message": "Not implemented yet"}


@router.patch("/{experiment_id}")
def update_experiment(experiment_id: str):
    return {"message": f"Not implemented yet for {experiment_id}"}


@router.delete("/{experiment_id}")
def delete_experiment(experiment_id: str):
    return {"ok": False, "experimentId": experiment_id}


@router.post("/bulk-delete")
def bulk_delete_experiments():
    return {"ok": False, "deletedCount": 0}
