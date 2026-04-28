import uuid

from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Model(Base):
    __tablename__ = "models"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    provider = Column(Text, nullable=False)
    model_id = Column(Text, nullable=False)
    endpoint = Column(Text, nullable=False)
    api_key_encrypted = Column(Text, nullable=False)
    temperature = Column(Float, nullable=False, default=0.7, server_default=text("0.7"))
    max_tokens = Column(Integer, nullable=False, default=1024, server_default=text("1024"))
    top_p = Column(Float, nullable=False, default=1.0, server_default=text("1.0"))
    stop_sequences = Column(ARRAY(String), nullable=False, default=list, server_default=text("'{}'"))
    status = Column(String, nullable=False, default="active", server_default=text("'active'"))
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="models")
    experiments = relationship("Experiment", back_populates="model")
