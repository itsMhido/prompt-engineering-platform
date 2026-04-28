from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel, from_attributes=True)


class DatasetCreate(APIModel):
    name: str
    category: str = "Custom"
    version: str = "v1"
    columns: list[str]
    rows: list[dict[str, Any]] = Field(default_factory=list)


class DatasetUpdate(APIModel):
    name: str | None = None
    category: str | None = None
    version: str | None = None
    columns: list[str] | None = None
    rows: list[dict[str, Any]] | None = None


class DatasetRead(APIModel):
    id: UUID
    name: str
    category: str
    version: str
    columns: list[str]
    rows: list[dict[str, Any]] = Field(default_factory=list)
    row_count: int | None = None
    created_at: datetime
    updated_at: datetime


class DatasetListResponse(APIModel):
    datasets: list[DatasetRead]
