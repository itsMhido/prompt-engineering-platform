from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_current_user, get_db
from app.models.prompt import Prompt, PromptVersion, Tag
from app.models.user import User
from app.schemas.prompt import PromptCreate, PromptDetailResponse, PromptResponse, PromptVersionCreate, PromptVersionResponse

router = APIRouter(prefix="/prompts", tags=["prompts"])


def _resolve_tags(db: Session, tag_names: list[str]) -> list[Tag]:
    tags: list[Tag] = []
    for name in sorted(set(t.strip().lower() for t in tag_names if t.strip())):
        existing = db.scalar(select(Tag).where(Tag.name == name))
        if existing:
            tags.append(existing)
            continue
        new_tag = Tag(name=name)
        db.add(new_tag)
        db.flush()
        tags.append(new_tag)
    return tags


def _prompt_to_response(prompt: Prompt) -> PromptResponse:
    latest = None
    sorted_versions = sorted(prompt.versions, key=lambda item: item.version_number, reverse=True)
    if sorted_versions:
        latest = PromptVersionResponse.model_validate(sorted_versions[0])
    return PromptResponse(
        id=prompt.id,
        title=prompt.title,
        description=prompt.description,
        model_name=prompt.model_name,
        temperature=prompt.temperature,
        metadata=prompt.prompt_metadata,
        current_version=prompt.current_version,
        tags=[tag.name for tag in prompt.tags],
        created_at=prompt.created_at,
        updated_at=prompt.updated_at,
        latest_prompt_version=latest,
    )


@router.post("", response_model=PromptResponse, status_code=status.HTTP_201_CREATED)
def create_prompt(payload: PromptCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> PromptResponse:
    prompt = Prompt(
        owner_id=user.id,
        title=payload.title,
        description=payload.description,
        model_name=payload.model_name,
        temperature=payload.temperature,
        prompt_metadata=payload.metadata,
        current_version=1,
    )
    prompt.tags = _resolve_tags(db, payload.tags)
    db.add(prompt)
    db.flush()

    version = PromptVersion(
        prompt_id=prompt.id,
        version_number=1,
        system_prompt=payload.initial_version.system_prompt,
        user_prompt_template=payload.initial_version.user_prompt_template,
        notes=payload.initial_version.notes,
        variables_schema=payload.initial_version.variables_schema,
    )
    db.add(version)
    db.commit()
    db.refresh(prompt)
    db.refresh(version)
    prompt.versions = [version]
    return _prompt_to_response(prompt)


@router.get("", response_model=list[PromptResponse])
def list_prompts(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[PromptResponse]:
    prompts = db.scalars(
        select(Prompt)
        .where(Prompt.owner_id == user.id)
        .options(selectinload(Prompt.tags), selectinload(Prompt.versions))
        .order_by(desc(Prompt.updated_at))
    ).all()
    return [_prompt_to_response(prompt) for prompt in prompts]


@router.get("/{prompt_id}", response_model=PromptDetailResponse)
def get_prompt(prompt_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> PromptDetailResponse:
    prompt = db.scalar(
        select(Prompt)
        .where(Prompt.id == prompt_id, Prompt.owner_id == user.id)
        .options(selectinload(Prompt.tags), selectinload(Prompt.versions))
    )
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    base = _prompt_to_response(prompt)
    versions = [PromptVersionResponse.model_validate(v) for v in sorted(prompt.versions, key=lambda item: item.version_number, reverse=True)]
    return PromptDetailResponse(**base.model_dump(), versions=versions)


@router.post("/{prompt_id}/versions", response_model=PromptVersionResponse, status_code=status.HTTP_201_CREATED)
def add_version(
    prompt_id: str,
    payload: PromptVersionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PromptVersionResponse:
    prompt = db.scalar(select(Prompt).where(Prompt.id == prompt_id, Prompt.owner_id == user.id))
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    next_version = prompt.current_version + 1
    version = PromptVersion(
        prompt_id=prompt.id,
        version_number=next_version,
        system_prompt=payload.system_prompt,
        user_prompt_template=payload.user_prompt_template,
        notes=payload.notes,
        variables_schema=payload.variables_schema,
    )
    prompt.current_version = next_version
    db.add(version)
    db.add(prompt)
    db.commit()
    db.refresh(version)
    return PromptVersionResponse.model_validate(version)
