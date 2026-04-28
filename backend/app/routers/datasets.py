from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_datasets():
    return {"datasets": []}


@router.post("")
def create_dataset():
    return {"message": "Not implemented yet"}


@router.get("/{dataset_id}")
def get_dataset(dataset_id: str):
    return {"message": f"Not implemented yet for {dataset_id}"}


@router.put("/{dataset_id}")
def update_dataset(dataset_id: str):
    return {"message": f"Not implemented yet for {dataset_id}"}


@router.delete("/{dataset_id}")
def delete_dataset(dataset_id: str):
    return {"ok": False, "datasetId": dataset_id}


@router.post("/import")
def import_dataset():
    return {"message": "Not implemented yet"}
