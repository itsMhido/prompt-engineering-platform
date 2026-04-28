import uuid

from sqlalchemy import Column, DateTime, String, Text, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(Text, unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    name = Column(Text, nullable=False)
    role = Column(String, nullable=False, default="member", server_default=text("'member'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    owned_workspaces = relationship("Workspace", back_populates="owner", cascade="all, delete-orphan")
    workspace_memberships = relationship("WorkspaceMember", back_populates="user", cascade="all, delete-orphan")
    prompts_created = relationship("Prompt", back_populates="creator")
    prompt_versions_created = relationship("PromptVersion", back_populates="creator")
    datasets_created = relationship("Dataset", back_populates="creator")
    experiments_created = relationship("Experiment", back_populates="creator")
