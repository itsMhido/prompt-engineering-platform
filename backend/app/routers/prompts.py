from fastapi import APIRouter

router = APIRouter()


@router.get("")
def list_prompts():
    return {"prompts": []}


@router.post("")
def create_prompt():
    return {"message": "Not implemented yet"}


@router.patch("/{prompt_id}")
def update_prompt(prompt_id: str):
    return {"message": f"Not implemented yet for {prompt_id}"}


@router.post("/{prompt_id}/duplicate")
def duplicate_prompt(prompt_id: str):
    return {"message": f"Not implemented yet for {prompt_id}"}


@router.delete("/{prompt_id}")
def delete_prompt(prompt_id: str):
    return {"ok": False, "promptId": prompt_id}


@router.get("/{prompt_id}/versions")
def list_prompt_versions(prompt_id: str):
    return {"versions": [], "promptId": prompt_id}


@router.post("/{prompt_id}/versions")
def create_prompt_version(prompt_id: str):
    return {"message": f"Not implemented yet for {prompt_id}"}


@router.get("/{prompt_id}/versions/{version_id}")
def get_prompt_version(prompt_id: str, version_id: str):
    return {"message": f"Not implemented yet for {prompt_id}/{version_id}"}
