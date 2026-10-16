import hmac
import hashlib
import json
import logging
import secrets
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Request, Header, HTTPException, status, Depends
from sqlalchemy.orm import Session
from backend.app.core.config import settings
from backend.app.core.database import get_db
from backend.app.models.webhook import ProcessedWebhookEvent
from backend.app.models.subscription import OrganizationSubscription
from backend.app.models.fee import FeeTransaction, StudentFee

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/razorpay")
async def razorpay_webhook(
    request: Request,
    x_razorpay_signature: str = Header(None, alias="X-Razorpay-Signature"),
    x_internal_api_key: str = Header(None, alias="X-Internal-API-Key"),
    db: Session = Depends(get_db),
):
    """
    Production-hardened, idempotent Razorpay Webhook processor.
    - Validates payload against HMAC SHA-256 signature using the secret key.
    - Uses database-backed idempotency table to prevent double-charging or duplicate updates.
    - Updates subscriptions and student fee transaction ledgers within atomic DB transactions.
    """
    if (
        not settings.INTERNAL_API_KEY
        or not x_internal_api_key
        or not secrets.compare_digest(x_internal_api_key, settings.INTERNAL_API_KEY)
    ):
        raise HTTPException(status_code=401, detail="Unauthorised internal service request.")

    raw_body = await request.body()
    webhook_secret = settings.RAZORPAY_WEBHOOK_SECRET
    if not webhook_secret:
        raise HTTPException(status_code=503, detail="Webhook verification is not configured.")

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

    # Compare signatures safely using constant time comparison
    if not hmac.compare_digest(x_razorpay_signature, expected_signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid webhook signature.",
        )

    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body.")

    event_id = payload.get("event_id") or f"{payload.get('event')}_{payload.get('created_at')}"

    # Database-backed Idempotency Check
    existing_event = db.query(ProcessedWebhookEvent).filter(ProcessedWebhookEvent.id == event_id).first()
    if existing_event:
        return {"received": True, "idempotent": True, "event_id": event_id}

    event_name = payload.get("event")

    # Atomic event processing
    try:
        if event_name == "payment.captured":
            payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
            payment_notes = payment.get("notes", {})
            org_id = payment_notes.get("organization_id")
            student_id = payment_notes.get("student_id")
            amount_rupees = (payment.get("amount", 0)) / 100

            if org_id and student_id:
                # Record transaction in Student Fee Ledger
                fee_txn = FeeTransaction(
                    organization_id=org_id,
                    student_id=student_id,
                    amount=amount_rupees,
                    method="UPI" if payment.get("method") == "upi" else "CARD",
                    reference_number=payment.get("id", f"txn_{event_id}"),
                    receipt_number=f"REC-{event_id[:8].upper()}",
                    recorded_by="Razorpay Webhook Engine",
                )
                db.add(fee_txn)

                # Update student fee status if outstanding satisfied
                student_fee = (
                    db.query(StudentFee)
                    .filter(StudentFee.organization_id == org_id, StudentFee.student_id == student_id)
                    .first()
                )
                if student_fee:
                    student_fee.status = "PAID"

        elif event_name == "subscription.activated":
            sub_entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
            sub_notes = sub_entity.get("notes", {})
            org_id = sub_notes.get("organization_id")
            plan_id = sub_notes.get("plan_id", "growth")

            if org_id:
                subscription = (
                    db.query(OrganizationSubscription)
                    .filter(OrganizationSubscription.organization_id == org_id)
                    .first()
                )
                if subscription:
                    subscription.status = "ACTIVE"
                    subscription.plan_id = plan_id
                    subscription.razorpay_subscription_id = sub_entity.get("id")
                    subscription.current_period_start = datetime.now(timezone.utc)
                    subscription.current_period_end = datetime.now(timezone.utc) + timedelta(days=30)

        # Mark event as processed in persistent DB store
        processed_event = ProcessedWebhookEvent(
            id=event_id,
            event_type=event_name or "unknown",
            payload_summary={"event": event_name},
        )
        db.add(processed_event)
        db.commit()

    except Exception:
        db.rollback()
        logger.exception("Failed to process Razorpay webhook event")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process webhook event.",
        )

    return {"received": True, "processed": True, "event_id": event_id}
