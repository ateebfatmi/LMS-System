import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Integer, Boolean, ForeignKey, JSON
from backend.app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"

    id = Column(String(50), primary_key=True)  # basic, growth, scale
    name = Column(String(100), nullable=False)
    price_inr = Column(Integer, nullable=False)
    billing_interval = Column(String(20), default="monthly")
    student_limit = Column(Integer, nullable=False)
    branch_limit = Column(Integer, default=1)
    storage_gb = Column(Integer, default=10)
    ai_credits_per_month = Column(Integer, default=100)
    features = Column(JSON, default=list)
    is_active = Column(Boolean, default=True)

class OrganizationSubscription(Base):
    __tablename__ = "organization_subscriptions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    organization_id = Column(String(36), ForeignKey("institutes.id", ondelete="CASCADE"), unique=True, nullable=False)
    plan_id = Column(String(50), ForeignKey("subscription_plans.id"), nullable=False)
    status = Column(String(50), default="ACTIVE")  # TRIAL, ACTIVE, PAST_DUE, CANCELLED, SUSPENDED
    current_period_start = Column(DateTime, default=utc_now)
    current_period_end = Column(DateTime, default=utc_now)
    trial_ends_at = Column(DateTime, nullable=True)
    razorpay_customer_id = Column(String(100), nullable=True)
    razorpay_subscription_id = Column(String(100), nullable=True)
    cancel_at_period_end = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)
