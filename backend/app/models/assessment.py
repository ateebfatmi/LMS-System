import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer, Boolean, Numeric, ForeignKey, JSON
from backend.app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class InstituteTest(Base):
    __tablename__ = "institute_tests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    pattern = Column(String(50), nullable=False)  # JEE_MAIN, JEE_ADVANCED, NEET, CUSTOM
    subject = Column(String(100), nullable=True)
    total_marks = Column(Integer, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    status = Column(String(50), default="PUBLISHED")
    question_count = Column(Integer, default=54)
    created_at = Column(DateTime, default=utc_now)

class TestAttempt(Base):
    __tablename__ = "test_attempts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_id = Column(String(36), ForeignKey("institute_tests.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(100), nullable=False, index=True)
    score = Column(Numeric(6, 2), default=0)
    percentage = Column(Numeric(5, 2), default=0)
    rank = Column(Integer, default=1)
    percentile = Column(Numeric(5, 2), default=0)
    submitted_at = Column(DateTime, default=utc_now)
