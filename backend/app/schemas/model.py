from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel, from_attributes=True)


class ModelBase(APIModel):
    name: str
    provider: str
    model_id: str
    endpoint: str
    temperature: float = 0.7
    max_tokens: int = 1024
    top_p: float = 1.0
    stop_sequences: list[str] = Field(default_factory=list)
    status: str = "active"


class ModelCreate(ModelBase):
    api_key: str


class ModelUpdate(APIModel):
    name: str | None = None
    provider: str | None = None
    model_id: str | None = None
    endpoint: str | None = None
    api_key: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
    top_p: float | None = None
    stop_sequences: list[str] | None = None
    status: str | None = None


class ModelRead(ModelBase):
    id: UUID
    api_key: str = "????????"
    created_at: datetime
    updated_at: datetime


class ModelListResponse(APIModel):
    models: list[ModelRead]
