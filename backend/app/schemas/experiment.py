from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel, from_attributes=True)


class ExperimentCreate(APIModel):
    workspace_id: UUID
    prompt_id: UUID | None = None
    prompt_version_id: UUID | None = None
    model_id: UUID | None = None
    dataset_id: UUID | None = None
    dataset_row_index: int | None = None
    batch_id: str | None = None
    batch_name: str | None = None
    prompt_name: str | None = None
    prompt_version: str | None = None
    model_name: str | None = None
    provider: str | None = None
    system_prompt: str | None = None
    user_template: str | None = None
    variable_values: dict[str, Any] = Field(default_factory=dict)
    interpolated_prompt: str | None = None
    output: str | None = None
    latency_ms: int | None = None
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    cost_estimate: float = 0.0
    status: str = "success"
    error_message: str | None = None
    score: float | None = None
    scores: dict[str, Any] = Field(default_factory=dict)
    reasoning: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    notes: str = ""


class ExperimentUpdate(APIModel):
    score: float | None = None
    notes: str | None = None
    tags: list[str] | None = None
    scores: dict[str, Any] | None = None
    reasoning: dict[str, Any] | None = None


class ExperimentRead(ExperimentCreate):
    id: UUID
    created_at: datetime


class ExperimentListResponse(APIModel):
    experiments: list[ExperimentRead]
