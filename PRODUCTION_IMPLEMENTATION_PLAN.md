# PRODUCTION IMPLEMENTATION PLAN: PREPZII FOR INSTITUTES

**Plan Date:** 2026-10-15  
**Target:** Controlled Production Launch Readiness

---

## Phase 1: P0 Security & Multi-Tenant Hardening (Immediate)
- [x] Create comprehensive `PRODUCTION_READINESS_AUDIT.md`.
- [ ] **Fix SEC-01:** Remove dangerous `OWNER` mock fallback in `backend/app/permissions/tenant.py`. Enforce strict DB check: if institute doesn't exist or user lacks membership, return `403 Forbidden`.
- [ ] **Fix SEC-02 & SEC-03:** Implement persistent database-backed webhook idempotency using a dedicated table `processed_webhook_events`. Enforce HMAC-SHA256 signature verification in both FastAPI and Next.js.
- [ ] **Fix FIN-01:** Implement active database ledger updates for `payment.captured`, `payment.failed`, and `subscription.activated` within database transactions.
- [ ] Write automated pytest suite in `backend/tests/test_tenant_security.py` verifying cross-tenant isolation and 403 enforcement.

---

## Phase 2: P1 Quality, Linting & CI Verification
- [ ] **Fix LINT-01:** Resolve all 25 ESLint errors in `apps/web/`:
  - Replace `any` types in `apps/web/src/proxy.ts`, `announcements/page.tsx`, `assessments/page.tsx`, `attendance/page.tsx`, `batches/page.tsx`, `fees/page.tsx`, `whatsapp-dispatcher-modal.tsx`.
  - Fix impure `Math.random()` render call in `crm/page.tsx`.
  - Fix unescaped entities (`'`, `"`) in `attendance/page.tsx`, `crm/page.tsx`, `page.tsx`, and `whatsapp-dispatcher-modal.tsx`.
  - Clean unused imports in `batches/page.tsx`, `teachers/page.tsx`, `page.tsx`, `demo-request/route.ts`, and `mock-data.ts`.
- [ ] Run and verify `npm run lint` passes with 0 errors and 0 warnings.
- [ ] Run `npm run typecheck`, `npm test`, and `npm run build` to ensure clean builds.

---

## Phase 3: Reliability, Health Checks & Operational Readiness
- [ ] **Fix OPS-01:** Enhance `backend/app/api/v1/endpoints/health.py` and `apps/web/src/app/api/health/route.ts` with real database connectivity validation (`SELECT 1`).
- [ ] Document backup, recovery, and operational procedures:
  - `DATABASE_RECOVERY.md`
  - `MONITORING.md`
  - `INCIDENT_RESPONSE.md`
  - `ENVIRONMENT_VARIABLES.md`
  - `TESTING.md`
  - `KNOWN_LIMITATIONS.md`
- [ ] Add rate-limiting middleware to FastAPI backend to guard against API flooding and brute force attacks.

---

## Phase 4: Final Production Verification
- [ ] Execute all backend tests (`python3 -m pytest backend/tests`).
- [ ] Execute all frontend package tests (`npm test`).
- [ ] Verify full production build passes cleanly (`npm run build`).
- [ ] Confirm no security regressions or unhandled vulnerabilities remain.
