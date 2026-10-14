# PRODUCTION READINESS AUDIT: PREPZII FOR INSTITUTES

**Audit Date:** 2026-10-15  
**Auditor:** Principal Software & Security Engineering Team  
**Scope:** Full-Stack Multi-Tenant B2B LMS (Next.js 16 Web Application, Python FastAPI Backend, Supabase PostgreSQL with RLS, Razorpay Webhooks, Clerk Auth).

---

## Executive Summary

PrepZii for Institutes possesses a high-quality multi-tenant architecture designed for Indian coaching institutes (JEE, NEET, Foundation, Boards). The schema uses PostgreSQL Row-Level Security (RLS) policies keyed to `organization_id` (referencing canonical `public.institutes.id`), a standalone assessment grading engine with JEE Advanced partial scoring, an admissions CRM, a multi-tier subscription engine, and Razorpay webhook handling.

However, several production gates and vulnerabilities must be resolved before real paying institutes can be safely onboarded:
1. **Critical:** In FastAPI's `get_tenant_context`, if an institute is not found in the DB, it creates/mocks an `OWNER` tenant context fallback for any arbitrary ID without validation.
2. **Critical:** In both Next.js and FastAPI Razorpay webhook handlers, webhook signatures are bypassed when running in development/sandbox mode (`process.env.NODE_ENV !== "production"`), and the idempotency store is an in-memory `Set` that gets wiped upon process restart or distributed worker scaling.
3. **High:** In Next.js `CRM` conversion, unescaped entities and impure functions during render (`Math.random()`) cause React 19 compiler lint failures.
4. **High:** In `backend/app/api/v1/endpoints/webhooks.py`, webhook handlers for `payment.captured` and `subscription.activated` contain stubbed `pass` statements rather than updating the persistent database ledger.
5. **High:** Strict lint rules in Next.js fail with 25 errors (unescaped quotes, unhandled `any` casts in event handlers, impure render functions).
6. **Medium:** Missing health check endpoints that verify underlying DB connectivity without leaking credentials.

---

## Detailed Audit Findings

| Finding ID | Module / File | Description | Severity | Impact | Remediation | Status |
|---|---|---|---|---|---|---|
| **SEC-01** | `backend/app/permissions/tenant.py` | Fallback `TenantContext(role="OWNER")` returned when institute record not found in DB. | **Critical (P0)** | Cross-tenant privilege escalation / auth bypass if non-existent org ID is supplied. | Require strict DB lookup; throw 403 Forbidden if institute does not exist or user is not verified. | Open |
| **SEC-02** | `backend/app/api/v1/endpoints/webhooks.py` | In-memory `PROCESSED_WEBHOOK_EVENTS` Set used for idempotency; bypassed signature check if not production. | **Critical (P0)** | Duplicate event processing on worker restart; replay attack vector if secret misconfigured. | Use database-backed idempotency table for webhook event IDs; enforce cryptographic verification. | Open |
| **SEC-03** | `apps/web/src/app/api/webhooks/razorpay/route.ts` | Next.js Razorpay webhook uses in-memory `Set` for event tracking; falls back to default dummy secret. | **High (P0)** | Memory loss across serverless/container restarts causing duplicate billing credits. | Persist processed event IDs in DB; require explicit secret configuration. | Open |
| **FIN-01** | `backend/app/api/v1/endpoints/webhooks.py` | `payment.captured` & `subscription.activated` are stubbed with `pass`. | **High (P0)** | Paid customer subscriptions and student fee installments are not automatically updated in the database. | Implement DB updates to `organization_subscriptions` and `organization_fee_transactions`. | Open |
| **LINT-01** | `apps/web/` (multiple files) | 25 ESLint errors preventing automated CI pipeline passing. | **High (P1)** | Deployment blockers on CI/CD pipelines enforcing `npm run lint`. | Refactor types from `any` to strict interfaces, fix impure render calls, escape HTML entities. | Open |
| **OPS-01** | `backend/app/api/v1/endpoints/health.py` | Health endpoint returns static `{status: "ok"}` without testing database connectivity. | **Medium (P1)** | Monitoring/load balancers report healthy even if database pool is dead. | Add DB query check to health endpoint (`SELECT 1`). | Open |
| **OPS-02** | Root & Backend | Missing comprehensive operational documentation for disaster recovery, incident response, and env vars. | **Medium (P1)** | Inefficient on-call handling and high recovery time objective during outages. | Author `DATABASE_RECOVERY.md`, `MONITORING.md`, `INCIDENT_RESPONSE.md`, `ENVIRONMENT_VARIABLES.md`. | Open |

---

## Verification & Test Plan

1. **Adversarial Tenant Isolation Test:** Verify that any request with non-existent or un-owned `organization_id` strictly receives `403 Forbidden` and never gets `OWNER` privileges.
2. **Webhook Idempotency & Cryptographic Test:** Test replay of duplicate Razorpay event IDs; verify rejection of invalid HMAC signatures.
3. **Database Financial Record Test:** Verify that captured payments successfully transition student fee and subscription statuses in DB.
4. **CI Pipeline Pass:** Ensure `npm run lint`, `npm run typecheck`, `npm test`, and `python3 -m pytest backend/tests` all pass with 0 errors.
