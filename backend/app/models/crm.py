import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Lead(Base):
    __tablename__ = "organization_leads"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=False, index=True)
    guardian_name = Column(String(255), nullable=True)
    guardian_phone = Column(String(50), nullable=True)
    target_exam = Column(String(50), nullable=False)
    target_batch_id = Column(String(36), ForeignKey("organization_batches.id", ondelete="SET NULL"), nullable=True)
    source = Column(String(50), default="WALK_IN")
    assigned_counsellor_id = Column(String(100), nullable=True)
    assigned_counsellor_name = Column(String(255), nullable=True)
    stage = Column(String(50), default="NEW", index=True)  # NEW, CONTACTED, COUNSELLING_SCHEDULED, TRIAL_ATTENDED, CONVERTED, LOST
    follow_up_date = Column(String(20), nullable=True)
    estimated_fee = Column(Numeric(12, 2), default=0)
    notes = Column(Text, nullable=True)
    converted_student_id = Column(String(100), nullable=True)
    converted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    institute = relationship("Institute", back_populates="leads")
