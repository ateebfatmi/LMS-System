# PRODUCTION MONITORING & ALERTING RUNBOOK

**Target:** PrepZii for Institutes  
**Classification:** Operational Guide

---

## 1. Key Production SLIs & SLOs

| Metric | Target (SLO) | Measurement Method |
|---|---|---|
| **API Availability** | 99.9% uptime | Synthetics pinging `/api/v1/health` and `/api/health` every 60s |
| **API Latency (p95)** | < 250ms | HTTP request logging via middleware |
| **Exam Evaluation Latency** | < 150ms per submission | Fast scoring microservice timer |
| **Webhook Delivery & Idempotency** | 99.99% successful processing | Razorpay webhook event delivery dashboard |
| **Tenant Isolation Breaches** | Zero (0.00%) | Immediate P0 alert on any 403 authorization breach anomalies |

---

## 2. Health Check Endpoints

### 2.1 Backend Health (`/api/v1/health`)
- Checks process liveness and tests active connection pool via `SELECT 1`.
- Returns:
  ```json
  {
    "status": "healthy",
    "service": "PrepZii for Institutes API",
    "version": "1.0.0",
    "environment": "production",
    "database": "connected"
  }
  ```
- Failure: Returns `HTTP 503 Service Unavailable` if database connection pool is exhausted or dead.

### 2.2 Frontend Next.js Health (`/api/health`)
- Verifies serverless route readiness and upstream connectivity.

---

## 3. High-Priority Alert Rules

1. **Database Disconnected (`503 Service Unavailable`):**
   - Severity: **P0 (Critical)**
   - Action: Check Supabase DB compute and connection pooler (PgBouncer/Supavisor).
2. **Webhook Verification Failures (`401 Unauthorized` spike):**
   - Severity: **P1 (High)**
   - Action: Verify `RAZORPAY_WEBHOOK_SECRET` matches the active webhook configuration in Razorpay Dashboard.
3. **High HTTP 5xx Error Rate (> 1% in 5 minutes):**
   - Severity: **P1 (High)**
   - Action: Inspect application crash traces in logging platform (Sentry / CloudWatch).
