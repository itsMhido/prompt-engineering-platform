from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class PromptVersionCreate(BaseModel):
    system_prompt: str
    user_prompt_template: str
    notes: str | None = None
    variables_schema: dict | None = None


class PromptCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    model_name: str | None = None
    temperature: float | None = None
    metadata: dict | None = None
    tags: list[str] = []
    initial_version: PromptVersionCreate


class PromptVersionResponse(BaseModel):
    id: UUID
    version_number: int
    system_prompt: str
    user_prompt_template: str
    notes: str | None
    variables_schema: dict | None
    created_at: datetime

    class Config:
        from_attributes = True


class PromptResponse(BaseModel):
    id: UUID
    title: str
    description: str | None
    model_name: str | None
    temperature: float | None
    metadata: dict | None
    current_version: int
    tags: list[str]
    created_at: datetime
    updated_at: datetime
    latest_prompt_version: PromptVersionResponse | None


class PromptDetailResponse(PromptResponse):
    versions: list[PromptVersionResponse]
