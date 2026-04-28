from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel, from_attributes=True)


class UserRead(APIModel):
    id: UUID
    email: EmailStr
    name: str
    role: str
    created_at: datetime | None = None


class RegisterRequest(APIModel):
    email: EmailStr
    password: str
    name: str


class LoginRequest(APIModel):
    email: EmailStr
    password: str


class AuthResponse(APIModel):
    user: UserRead
    token: str


class MeResponse(APIModel):
    user: UserRead
