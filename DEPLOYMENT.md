# PrepZii LMS deployment guide

This guide prepares an isolated staging deployment. It does not authorize a production migration.

## Prerequisites

- Node.js 22+
- A Clerk test instance or isolated test users in the shared instance
- A disposable Supabase/PostgreSQL clone of the actual PrepZii schema
- A private deployment target for the Next.js application
- Optional provider sandbox credentials for Razorpay and Gemini

The FastAPI directory is an optional prototype, not the authoritative public API. Do not deploy it unless a reviewed server-to-server use case requires it and `INTERNAL_API_KEY` is set.

## Configuration

Create environment-specific secret values from `.env.example`. Store them in the deployment platform’s secret manager, not in Git or browser-visible configuration.

Required for the core application:

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL` for controlled migration tooling only
- `INVITATION_TOKEN_SECRET`

Optional, feature-gated values:

- `PLATFORM_ADMIN_USER_IDS`
- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `GEMINI_API_KEY`, `ZI_AI_MODEL`
- `FASTAPI_INTERNAL_URL`, `INTERNAL_API_KEY`

Do not use production provider credentials during the staging rehearsal.

## Build and application checks

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

Start the built web application using the hosting provider’s standard Next.js 16 runtime. The deployment must expose `/api/health` to platform health checks while authenticated dashboard routes remain protected by Clerk.

## Database rehearsal

1. Snapshot the deployed schema and create a disposable, access-restricted clone.
2. Resolve the incompatible historical `institutes` definitions described in `docs/CODEBASE_AUDIT.md`.
3. Record a restore point and verify it can be restored.
4. Apply `supabase/migrations/0001_extend_prepzii_backend.sql` through `0018_crm_analytics_readiness.sql` in filename order.
5. Run the transactional SQL suite only on that clone:

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/tenant_isolation.sql
```

6. Run the Clerk-backed browser workflows listed in `docs/PHASE_8_READINESS.md`.
7. Review locks, query plans, RLS policies, audit rows, storage policies, and rollback duration.

Do not use `supabase db push` against the shared production project until this rehearsal is signed off. Migrations are forward-only; recovery uses the verified database backup plus a reviewed corrective migration.

## Provider verification

- Register the exact staging Razorpay webhook URL and secret. Verify HMAC failures, replay idempotency, amount/currency checks, and delayed events before enabling any ledger transition.
- Use a Gemini test key. Confirm structured-output validation, timeouts, redacted logs, quota idempotency, and the policy for failed calls.
- Leave email/SMS/WhatsApp jobs in `BLOCKED_CONFIG` until an adapter, consent model, suppression list, retries, and delivery receipts are tested.

## Promotion

Production promotion requires every item in [the operations checklist](docs/OPERATIONS.md) and [Phase 8 readiness](docs/PHASE_8_READINESS.md) to have dated evidence and an accountable reviewer. A successful build alone is insufficient.
