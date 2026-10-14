# TESTING STRATEGY & RUNBOOK

This document details the automated testing architecture, execution commands, and verification criteria for **PrepZii for Institutes**.

---

## 1. Test Architecture

The testing suite covers three primary boundaries:
1. **Assessment Core & Scoring Engine:** Unordered MCQ grading, JEE Advanced partial marking (+4/+3/+2/+1/-2), numerical tolerances, and leaderboard percentiles.
2. **Multi-Tenant Isolation & Role Authorization:** Cross-tenant boundary enforcement, preventing unauthorized direct object access, and verifying strict 403 Forbidden responses.
3. **Financial & Webhook Idempotency:** HMAC-SHA256 signature verification, duplicate event deduplication, and atomic database updates.

---

## 2. Running Automated Tests

### 2.1 Workspace Unit Tests (Node / TypeScript)
```bash
npm test
```
*Expected Output:*
```
✔ grades unordered multiple-choice selections
✔ supports JEE Advanced partial marking
✔ applies numerical tolerance and leaves missing answers unpenalized
✔ computes ranked leaderboard with percentiles
ℹ pass 4, fail 0
```

### 2.2 Backend Security & Webhook Tests (Python / Pytest)
```bash
python3 -m pytest backend/tests -v
```
*Expected Output:*
```
backend/tests/test_assessment_grading.py .... [36%]
backend/tests/test_tenant_isolation.py ...    [63%]
backend/tests/test_webhooks.py ....           [100%]
=================== 11 passed in 0.40s ===================
```

### 2.3 Strict Linting & Typecheck
```bash
npm run lint
npm run typecheck
```
*Expected Output:* Zero errors and zero warnings across all workspaces.

### 2.4 Production Build Verification
```bash
npm run build
```
*Expected Output:* Prerendering of 21/21 routes successfully with 0 errors.
