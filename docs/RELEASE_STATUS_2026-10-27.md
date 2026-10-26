# Release status — 2026-10-27

## Decision

**Code release candidate is green; production approval still requires external staging evidence.** The application and a clean PostgreSQL migration chain pass locally. Do not enable real payments or onboard paying customers until the external staging gates below are closed.

## Verified locally

- 83 Node/domain tests pass.
- 7 Playwright release smoke tests pass in Chromium.
- TypeScript and ESLint pass across all workspaces.
- The Next.js 16.4.3 optimized Webpack production build succeeds from a clean, non-FileProvider build directory.
- The disposable SQL integration suite passes all 16 schema/constraint checks.
- All 22 active migrations apply cleanly to PostgreSQL 16 and the complete tenant-isolation SQL suite passes.
- The FastAPI prototype passes all 13 tests, with one upstream Starlette/httpx deprecation warning.
- `npm audit --omit=dev` reports zero production dependency vulnerabilities.
- Environment validation, liveness/readiness endpoints, strict deployed configuration behavior, same-origin mutation protection, canonical route redirects, and production retirement of unscoped legacy APIs are covered.

## Migration reconciliation completed for new environments

The active migration chain now has unique versions. Two incompatible historical branches are preserved under `supabase/legacy_migrations` for forensic comparison and are excluded from new deployments. The canonical audit schema was normalized to the columns used by every mutation RPC.

Because this workspace does not contain a production database connection or migration ledger, an existing external database must still be compared with the preserved history before applying this chain. A brand-new environment can apply the active chain directly.

## Required closure steps

1. For an existing staging/production database, export its schema catalog and `supabase_migrations.schema_migrations` ledger after taking a verified backup. Compare it with `supabase/legacy_migrations` and add a forward-only bridge if required.
2. Deploy the clean chain to isolated staging and rerun `npm run test:db` against that environment.
3. Complete authenticated cross-tenant owner/admin/teacher/student/guardian browser tests with real Clerk claims and Supabase RLS.
4. Complete backup restore, accessibility, representative load, monitoring/alert, and payment-webhook reconciliation drills described in `DEPLOYMENT_RUNBOOK.md`.

Production approval requires objective evidence for every step above.
