import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text, nullable=False, default="", server_default=text("''"))
    tags = Column(ARRAY(Text), nullable=False, default=list, server_default=text("'{}'"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="prompts")
    creator = relationship("User", back_populates="prompts_created")
    versions = relationship("PromptVersion", back_populates="prompt", cascade="all, delete-orphan")
    experiments = relationship("Experiment", back_populates="prompt")


class PromptVersion(Base):
    __tablename__ = "prompt_versions"
    __table_args__ = (UniqueConstraint("prompt_id", "version_number", name="uq_prompt_versions_prompt_version"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    system_prompt = Column(Text, nullable=False, default="", server_default=text("''"))
    user_template = Column(Text, nullable=False, default="", server_default=text("''"))
    commit_message = Column(Text, nullable=False, default="", server_default=text("''"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    prompt = relationship("Prompt", back_populates="versions")
    creator = relationship("User", back_populates="prompt_versions_created")
    experiments = relationship("Experiment", back_populates="prompt_version_ref")
