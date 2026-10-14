import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Batch(Base):
    __tablename__ = "organization_batches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    target_exam = Column(String(50), nullable=False)  # JEE_MAIN, JEE_ADVANCED, NEET, etc.
    grade_level = Column(String(50), nullable=True)
    room_number = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utc_now)

    institute = relationship("Institute", back_populates="batches")
    members = relationship("BatchMember", back_populates="batch", cascade="all, delete-orphan")

class BatchMember(Base):
    __tablename__ = "organization_batch_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    batch_id = Column(String(36), ForeignKey("organization_batches.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # STUDENT or TEACHER
    roll_number = Column(String(100), nullable=True)
    enrolled_at = Column(DateTime, default=utc_now)

    batch = relationship("Batch", back_populates="members")
