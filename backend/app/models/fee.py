import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Numeric, Integer, ForeignKey
from backend.app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class StudentFee(Base):
    __tablename__ = "organization_student_fees"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(100), nullable=False, index=True)
    batch_id = Column(String(36), ForeignKey("organization_batches.id", ondelete="SET NULL"), nullable=True)
    total_course_fee = Column(Numeric(12, 2), nullable=False)
    concession_amount = Column(Numeric(12, 2), default=0)
    concession_reason = Column(String(255), nullable=True)
    net_payable = Column(Numeric(12, 2), nullable=False)
    status = Column(String(50), default="UNPAID")  # PAID, PARTIAL, OVERDUE, UNPAID
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

class FeeTransaction(Base):
    __tablename__ = "organization_fee_transactions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True)
    student_id = Column(String(100), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    method = Column(String(50), nullable=False)  # UPI, NET_BANKING, CARD, CHEQUE, CASH
    reference_number = Column(String(100), nullable=False, unique=True)
    receipt_number = Column(String(100), nullable=False, unique=True)
    recorded_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=utc_now)
