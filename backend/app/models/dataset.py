import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, Text, func, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import relationship

from app.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False)
    name = Column(Text, nullable=False)
    category = Column(Text, nullable=False, default="Custom", server_default=text("'Custom'"))
    version = Column(Text, nullable=False, default="v1", server_default=text("'v1'"))
    columns = Column(ARRAY(Text), nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

    workspace = relationship("Workspace", back_populates="datasets")
    creator = relationship("User", back_populates="datasets_created")
    rows = relationship("DatasetRow", back_populates="dataset", cascade="all, delete-orphan")
    experiments = relationship("Experiment", back_populates="dataset")


class DatasetRow(Base):
    __tablename__ = "dataset_rows"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    dataset_id = Column(UUID(as_uuid=True), ForeignKey("datasets.id", ondelete="CASCADE"), nullable=False)
    row_index = Column(Integer, nullable=False)
    row_data = Column(JSONB, nullable=False)

    dataset = relationship("Dataset", back_populates="rows")
