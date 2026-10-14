import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from backend.app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class Institute(Base):
    __tablename__ = "institutes"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)
    institute_type = Column(String(50), default="COACHING")
    logo_url = Column(Text, nullable=True)
    primary_color = Column(String(20), default="#FACC15")
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    address = Column(JSON, default=dict)
    timezone = Column(String(50), default="Asia/Kolkata")
    owner_user_id = Column(String(100), nullable=False, index=True)
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    memberships = relationship("InstituteMember", back_populates="institute", cascade="all, delete-orphan")
    batches = relationship("Batch", back_populates="institute", cascade="all, delete-orphan")
    leads = relationship("Lead", back_populates="institute", cascade="all, delete-orphan")

class InstituteMember(Base):
    __tablename__ = "institute_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    institute_id = Column(String(36), ForeignKey("institutes.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(100), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # OWNER, COACHING_ADMIN, TEACHER, STUDENT, PARENT
    status = Column(String(50), default="ACTIVE")
    created_at = Column(DateTime, default=utc_now)

    institute = relationship("Institute", back_populates="memberships")
