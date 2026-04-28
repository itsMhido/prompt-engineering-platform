import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Experiment(Base):
    __tablename__ = "experiments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    prompt_id = Column(UUID(as_uuid=True), ForeignKey("prompts.id"), nullable=True)
    prompt_version_id = Column(UUID(as_uuid=True), ForeignKey("prompt_versions.id"), nullable=True)
    model_id = Column(UUID(as_uuid=True), ForeignKey("models.id"), nullable=True)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id"), nullable=True)
    dataset_row_index = Column(Integer, nullable=True)
    prompt_name = Column(Text, nullable=True)
    prompt_version = Column(Text, nullable=True)
    model_name = Column(Text, nullable=True)
    provider = Column(Text, nullable=True)
    system_prompt = Column(Text, nullable=True)
    user_template = Column(Text, nullable=True)
    variable_values = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    interpolated_prompt = Column(Text, nullable=True)
    output = Column(Text, nullable=True)
    latency_ms = Column(Integer, nullable=True)
    input_tokens = Column(Integer, nullable=True)
    output_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=False, default=0.0, server_default=text("0"))
    status = Column(Text, nullable=False, default="success", server_default=text("'success'"))
    error_message = Column(Text, nullable=True)
    score = Column(Float, nullable=True)
    scores = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    reasoning = Column(JSONB, nullable=False, default=dict, server_default=text("'{}'::jsonb"))
    tags = Column(ARRAY(Text), nullable=False, default=list, server_default=text("'{}'"))
    notes = Column(Text, nullable=False, default="", server_default=text("''"))
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    workspace = relationship("Workspace", back_populates="experiments")
    prompt = relationship("Prompt", back_populates="experiments")
    prompt_version_ref = relationship("PromptVersion", back_populates="experiments")
    model = relationship("Model", back_populates="experiments")
    dataset = relationship("Dataset", back_populates="experiments")
    creator = relationship("User", back_populates="experiments_created")
