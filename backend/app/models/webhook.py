import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, JSON
from backend.app.core.database import Base

def utc_now():
    return datetime.now(timezone.utc)

class ProcessedWebhookEvent(Base):
    __tablename__ = "processed_webhook_events"

    id = Column(String(100), primary_key=True)  # Razorpay event_id
    event_type = Column(String(100), nullable=False, index=True)
    payload_summary = Column(JSON, default=dict)
    processed_at = Column(DateTime, default=utc_now)
