import hmac
import hashlib
import json
from fastapi.testclient import TestClient
from backend.app.main import app

client = TestClient(app)
SECRET = "sample_webhook_secret"

def generate_signature(payload_bytes: bytes, secret: str = SECRET) -> str:
    return hmac.new(secret.encode("utf-8"), payload_bytes, hashlib.sha256).hexdigest()

def test_valid_razorpay_webhook():
    payload = {
        "event_id": "evt_test_12345",
        "event": "payment.captured",
        "payload": {
            "payment": {
                "entity": {
                    "id": "pay_test_001",
                    "amount": 349900,
                    "currency": "INR",
                    "status": "captured",
                }
            }
        }
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    sig = generate_signature(payload_bytes)

    response = client.post(
        "/api/v1/webhooks/razorpay",
        content=payload_bytes,
        headers={
            "X-Razorpay-Signature": sig,
            "Content-Type": "application/json",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["received"] is True
    assert data["processed"] is True
    assert data["event_id"] == "evt_test_12345"

def test_idempotent_webhook():
    payload = {
        "event_id": "evt_test_idempotent_999",
        "event": "subscription.activated",
        "payload": {},
    }
    payload_bytes = json.dumps(payload).encode("utf-8")
    sig = generate_signature(payload_bytes)

    # First delivery
    res1 = client.post(
        "/api/v1/webhooks/razorpay",
        content=payload_bytes,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"},
    )
    assert res1.status_code == 200
    assert res1.json()["processed"] is True

    # Duplicate delivery
    res2 = client.post(
        "/api/v1/webhooks/razorpay",
        content=payload_bytes,
        headers={"X-Razorpay-Signature": sig, "Content-Type": "application/json"},
    )
    assert res2.status_code == 200
    assert res2.json()["idempotent"] is True

def test_missing_signature():
    response = client.post(
        "/api/v1/webhooks/razorpay",
        json={"event": "payment.captured"},
    )
    assert response.status_code == 400
