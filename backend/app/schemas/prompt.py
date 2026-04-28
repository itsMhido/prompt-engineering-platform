from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)


class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel, from_attributes=True)


class PromptCreate(APIModel):
    name: str
    description: str = ""
    tags: list[str] = Field(default_factory=list)


class PromptUpdate(APIModel):
    name: str | None = None
    description: str | None = None
    tags: list[str] | None = None


class PromptRead(APIModel):
    id: UUID
    name: str
    description: str
    tags: list[str] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
    version_count: int | None = None
    experiment_count: int | None = None


class PromptVersionCreate(APIModel):
    system_prompt: str = ""
    user_template: str = ""
    commit_message: str = ""


class PromptVersionRead(APIModel):
    id: UUID
    prompt_id: UUID
    version_number: int
    system_prompt: str
    user_template: str
    commit_message: str
    created_at: datetime


class PromptListResponse(APIModel):
    prompts: list[PromptRead]


class PromptVersionListResponse(APIModel):
    versions: list[PromptVersionRead]
