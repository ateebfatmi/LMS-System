# KNOWN LIMITATIONS & OPERATIONAL CONSIDERATIONS

This document provides transparent disclosure of known architectural boundaries, third-party dependencies, and manual operational prerequisites for **PrepZii for Institutes**.

---

## 1. External Third-Party Dependencies

### 1.1 Payment Gateway Sandbox Mode
- **Status:** Fully functional in webhook test & simulation mode.
- **Operational Requirement:** Before processing real credit cards or UPI payments from live students or institutes, actual merchant production API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`) must be obtained from the institute's or PrepZii's Razorpay business dashboard.

### 1.2 WhatsApp Business API Gateway
- **Status:** Direct WhatsApp links (`https://wa.me/...`) are fully generated and active for faculty and counsellors.
- **Operational Requirement:** For automated high-volume bulk WhatsApp notifications (automated morning attendance absentees), an active Meta Business WhatsApp Cloud API token or DLT-registered SMS gateway provider credentials must be configured in environment variables.

---

## 2. Platform Capacity Targets

- **Initial Validated Capacity Target:** 50 concurrent institutes, 10,000 active enrolled students, up to 1,500 simultaneous CBT mock test submissions.
- **Scaling Recommendation:** When scaling past 50 institutes, enable PgBouncer transaction pooling on Supabase and provision a minimum of 2 worker replicas for the FastAPI microservice.
