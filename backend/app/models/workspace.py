import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Workspace(Base):
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    owner = relationship("User", back_populates="owned_workspaces")
    members = relationship("WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan")
    models = relationship("Model", back_populates="workspace", cascade="all, delete-orphan")
    prompts = relationship("Prompt", back_populates="workspace", cascade="all, delete-orphan")
    datasets = relationship("Dataset", back_populates="workspace", cascade="all, delete-orphan")
    experiments = relationship("Experiment", back_populates="workspace", cascade="all, delete-orphan")


class WorkspaceMember(Base):
    __tablename__ = "workspace_members"
    __table_args__ = (UniqueConstraint("workspace_id", "user_id", name="uq_workspace_members_workspace_user"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False, default="member", server_default=text("'member'"))

    workspace = relationship("Workspace", back_populates="members")
    user = relationship("User", back_populates="workspace_memberships")
