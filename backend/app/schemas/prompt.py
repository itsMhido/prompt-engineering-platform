from typing import Optional
from pydantic import BaseModel, ConfigDict

def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)

class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel, from_attributes=True)

class PromptCreate(APIModel):
    name: str
    description: str = ""
    tags: list[str] = []

class PromptUpdate(APIModel):
    name: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None

class PromptResponse(APIModel):
    id: str
    name: str
    description: str
    tags: list[str]
    versionCount: int = 0
    experimentCount: int = 0
    createdAt: str
    updatedAt: str

class VersionCreate(APIModel):
    systemPrompt: str
    userTemplate: str
    commitMessage: str = ""

class VersionUpdate(APIModel):
    systemPrompt: Optional[str] = None
    userTemplate: Optional[str] = None
    commitMessage: Optional[str] = None

class VersionResponse(APIModel):
    id: str
    promptId: str
    versionNumber: int
    versionDisplay: str
    systemPrompt: str
    userTemplate: str
    commitMessage: str
    createdAt: str
