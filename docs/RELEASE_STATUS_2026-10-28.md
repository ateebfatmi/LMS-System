# Release status — 2026-10-28

## Decision

**The repository is a production-grade release candidate and is approved to enter isolated staging. It is not yet approved for paying customers.** Code, schema, accessibility, dependency, load-smoke, and recovery gates pass locally. Production approval remains blocked on real-provider staging evidence, monitoring/alert delivery, payment reconciliation, legal review, and a named release approver.

## Verified release evidence

- 86 Node/domain tests pass across the web application and shared packages.
- 13 Chromium release tests pass against an optimized Next.js production build, including serious/critical WCAG scanning, keyboard focus, mobile navigation, security headers, route compatibility, and fail-closed readiness behavior.
- TypeScript and ESLint pass across every workspace.
- The disposable SQL suite passes all 16 schema and transaction checks.
- All active migrations apply cleanly to PostgreSQL 16 and the cross-tenant RLS suite passes.
- A PostgreSQL 16 logical backup restores successfully into a disposable database with all 72 tables and all 60 RLS-protected tables preserved.
- A 500-request, 25-concurrent local production-build smoke recorded 0 errors and 22 ms p95 latency. This is a smoke threshold, not a capacity forecast.
- The FastAPI boundary passes all 13 tests.
- `npm audit --omit=dev` reports zero production dependency vulnerabilities.
- Authentication setup, invitation acceptance, institute creation, and payment webhook forwarding now have fail-closed rate limits; webhook bodies are capped at 1 MiB and upstream processing is time-bounded.
- Staging and production cannot use the non-transactional institute-onboarding compatibility path.

## External production blockers

1. Configure a real staging deployment with complete Clerk, Supabase, invitation-signing, internal-service, and provider secrets. The current local configuration is not a production configuration.
   The read-only preflight against the currently configured shared Supabase project found all 11 consumer prerequisites but **0 of 35 LMS relations**; do not point this application at that project until the migration ledger is reconciled, a backup is restored successfully, and the forward-only LMS migration chain is applied in staging.
2. Reconcile the target database migration ledger against `supabase/migrations` and `supabase/legacy_migrations` after a verified external backup.
3. Run `.github/workflows/staging-acceptance.yml` with real owner, administrator, teacher, student, guardian, and second-tenant fixtures; preserve the workflow URL and artifacts.
4. Configure production monitoring for liveness, readiness, 5xx rate, authentication anomalies, webhook failures, and database latency, then prove alert delivery and on-call ownership.
5. Keep Razorpay disabled until signed webhook replay, duplicate/delayed delivery, refund, chargeback, and ledger-reconciliation drills pass in its sandbox.
6. Complete DPDP/child-data legal review, consent and retention approval, incident ownership, and a limited-institute operational pilot.
7. Assemble the release record required by `docs/DEPLOYMENT_RUNBOOK.md` and obtain a named human approval.

No one should describe this release as customer-production-ready until every blocker above has objective evidence.
