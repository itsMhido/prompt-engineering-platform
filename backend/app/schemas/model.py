from typing import Optional
from pydantic import BaseModel, ConfigDict

def to_camel(value: str) -> str:
    first, *rest = value.split("_")
    return first + "".join(part.capitalize() for part in rest)

class APIModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel, from_attributes=True)

class ModelCreate(APIModel):
    name: str
    provider: str
    modelId: str
    endpoint: str
    apiKey: str
    temperature: float = 0.7
    maxTokens: int = 1024
    topP: float = 1.0
    stopSequences: list[str] = []
    status: str = "active"

class ModelUpdate(APIModel):
    name: Optional[str] = None
    provider: Optional[str] = None
    modelId: Optional[str] = None
    endpoint: Optional[str] = None
    apiKey: Optional[str] = None
    temperature: Optional[float] = None
    maxTokens: Optional[int] = None
    topP: Optional[float] = None
    stopSequences: Optional[list[str]] = None
    status: Optional[str] = None

class ModelResponse(APIModel):
    id: str
    name: str
    provider: str
    modelId: str
    endpoint: str
    apiKey: str
    temperature: float
    maxTokens: int
    topP: float
    stopSequences: list[str]
    status: str
    createdAt: str
    updatedAt: str

class ValidateRequest(APIModel):
    modelId: Optional[str] = None
    provider: Optional[str] = None
    apiKey: Optional[str] = None
    endpoint: Optional[str] = None
    providerModelId: Optional[str] = None
