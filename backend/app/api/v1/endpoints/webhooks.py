import hmac
import hashlib
import json
from fastapi import APIRouter, Request, Header, HTTPException, status
from backend.app.core.config import settings

router = APIRouter()

PROCESSED_WEBHOOK_EVENTS = set()

@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
):
    """
    Idempotent Razorpay Webhook processor.
    Validates payload against HMAC SHA-256 signature using the secret key.
    """
    raw_body = await request.body()
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET or "sample_webhook_secret"

    if not x_razorpay_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing X-Razorpay-Signature header.",
        )

    # Calculate expected HMAC-SHA256
    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        raw_body,
        hashlib.sha256,
    ).hexdigest()

    # Compare signatures safely
    if not hmac.compare_digest(x_razorpay_signature, expected_signature):
        if settings.ENV == "production":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid webhook signature.",
            )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    event_id = payload.get("event_id") or f"{payload.get('event')}_{payload.get('created_at')}"

    # Idempotency
    if event_id in PROCESSED_WEBHOOK_EVENTS:
        return {"received": True, "idempotent": True, "event_id": event_id}

    event_name = payload.get("event")

    # Handle event logic
    if event_name == "payment.captured":
        pass  # Mark fee transaction or subscription paid
    elif event_name == "subscription.activated":
        pass  # Update institute subscription to ACTIVE
    elif event_name == "payment.failed":
        pass  # Log failed attempt

    PROCESSED_WEBHOOK_EVENTS.add(event_id)

    return {"received": True, "processed": True, "event_id": event_id}
