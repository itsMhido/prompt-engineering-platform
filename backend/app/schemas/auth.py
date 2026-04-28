from pydantic import BaseModel, ConfigDict, EmailStr

def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)

class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel, from_attributes=True)

class RegisterRequest(APIModel):
    email: EmailStr
    password: str
    name: str

class LoginRequest(APIModel):
    email: EmailStr
    password: str

class UserResponse(APIModel):
    id: str
    email: str
    name: str
    role: str
    created_at: str

class AuthResponse(APIModel):
    user: UserResponse
    token: str
    workspace: dict

class MeResponse(APIModel):
    user: UserResponse
    workspace: dict
