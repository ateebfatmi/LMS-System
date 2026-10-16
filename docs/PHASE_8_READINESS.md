# Phase 8 readiness handoff

Status date: 2026-10-17

The application implementation is ready for an isolated staging rehearsal, but it is not approved for production or a paying-customer pilot.

## Locally completed

- Migrations 0001–0019 applied in sequence on isolated PostgreSQL 16 container (`scripts/test_db_setup.sql`, `scripts/run_database_tests.sh`).
- Automated database integration testing with full tenant isolation assertions added to GitHub Actions CI (`.github/workflows/ci.yml`).
- Tenant isolation verified under `ON_ERROR_STOP=1` across `supabase/tests/tenant_isolation.sql` for owners, students, teachers, parents, admissions CRM, and platform administration.
- Reviewed guardian-student linking implemented (`organization_guardian_links`, `is_approved_guardian`). Unapproved parents are strictly rejected from attendance and fee ledgers.
- Descriptive/subjective assessment evaluation & moderation workflow implemented (`organization_descriptive_submissions`, `lms_grade_descriptive_submission`).
- Canonical AI draft promotion workflow implemented (`lms_promote_ai_draft`) ensuring AI generation stays draft until reviewed and published.
- Time-bounded platform support access review function implemented (`lms_review_support_access`).
- Domain authorization unit test suite extended with 12 comprehensive authorization cases (`canAccessBatch`, `isAnswerKeyReleased`, `canAccessAssignment`, `isMembershipActive`, `isPaymentUnique`, `evaluateQuotaAvailability`).
- Role-scoped dashboard and reporting data replaced hard-coded operational metrics.
- Admissions CRM uses explicit owner/admin permissions, server-resolved tenancy, validated payloads, a service-only mutation function, and audit records.
- Shared unit tests (30 passing), TypeScript (0 errors across 7 workspaces), scoped ESLint, Next.js Turbopack production build, and backend pytest pass cleanly.

## Hard gates before a controlled pilot

1. Create a disposable Supabase clone from the actual deployed schema and resolve the incompatible historical `institutes` definitions (rehearsed and verified in `scripts/test_db_setup.sql`).
2. Run Clerk-backed browser E2E for owner onboarding, invitations, enrolment, learning access, assessment, attendance, fees, communications, analytics, and CRM.
3. Verify Razorpay and external communication webhooks with sandbox credentials, replay tests, concurrency tests, and failure recovery.
4. Verify Gemini structured outputs with test credentials and decide whether failed provider calls consume quota.
5. Complete accessibility, responsive-device, load, observability, alerting, retention/deletion, incident-response, and DPDP legal reviews.

## Completed product workflows

- Descriptive assessment grading and moderation (`lms_grade_descriptive_submission`).
- Canonical promotion workflow for reviewed AI question and lesson-summary drafts (`lms_promote_ai_draft`).
- Approved, time-bounded support access review (`lms_review_support_access`).
- Reviewed guardian-student relationship verification before parent portal access (`organization_guardian_links`).

## Deliberately incomplete product workflows (Pre-pilot)

- PDF invoice/receipt generation and visual verification.
- Provider-driven institute payment reconciliation and SaaS subscription transitions.
- Email/SMS/WhatsApp provider delivery, preferences, suppression, receipts, and retries.

Until every hard gate is evidenced, releases must retain the label **staging only — not production ready**.

