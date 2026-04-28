from fastapi import APIRouter

router = APIRouter()


@router.post("/register")
def register():
    return {"message": "Not implemented yet"}


@router.post("/login")
def login():
    return {"message": "Not implemented yet"}


@router.get("/me")
def me():
    return {"message": "Not implemented yet"}
