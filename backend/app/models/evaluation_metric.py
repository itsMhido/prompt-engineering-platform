from sqlalchemy import Column, String, Boolean, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
import uuid
from app.database import Base

class EvaluationMetric(Base):
    __tablename__ = "evaluation_metrics"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    is_inverse = Column(Boolean, default=False)  # True = lower is better (like Toxicity)
    is_default = Column(Boolean, default=False)  # True = selected by default in scoring modal
    order_index = Column(Integer, default=0)     # display order
    created_at = Column(DateTime(timezone=True), server_default=func.now())
