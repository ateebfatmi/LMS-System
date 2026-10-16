# Phase 8 readiness handoff

Status date: 2026-10-17

The application implementation is ready for an isolated staging rehearsal, but it is not approved for production or a paying-customer pilot.

## Locally completed

- Role-scoped dashboard and reporting data replaced hard-coded operational metrics.
- Admissions CRM uses explicit owner/admin permissions, server-resolved tenancy, validated payloads, a service-only mutation function, and audit records.
- CRM cannot fabricate a student conversion; membership onboarding remains authoritative.
- Parent academic and financial data stays denied until a guardian–student relationship is reviewed and implemented.
- Shared unit tests, TypeScript, scoped ESLint, the Next.js production build, and backend pytest have passed locally.
- CI runs JavaScript tests, type checking, lint, build, production dependency audit, and backend tests.
- The SQL isolation suite includes CRM role and cross-tenant cases.

## Hard gates before a controlled pilot

1. Create a disposable Supabase clone from the actual deployed schema and resolve the incompatible historical `institutes` definitions.
2. Apply migrations `0001`–`0018` in order, run `supabase/tests/tenant_isolation.sql`, inspect query plans, and rehearse rollback from a verified backup.
3. Run Clerk-backed browser E2E for owner onboarding, invitations, enrolment, learning access, assessment, attendance, fees, communications, analytics, and CRM.
4. Verify Razorpay and external communication webhooks with sandbox credentials, replay tests, concurrency tests, and failure recovery.
5. Verify Gemini structured outputs with test credentials and decide whether failed provider calls consume quota.
6. Complete accessibility, responsive-device, load, observability, alerting, retention/deletion, incident-response, and DPDP legal reviews.
7. Implement and test guardian linking before exposing any child records to a parent account.

## Deliberately incomplete product workflows

- Descriptive assessment grading and moderation.
- PDF invoice/receipt generation and visual verification.
- Provider-driven institute payment reconciliation and SaaS subscription transitions.
- Approved, time-bounded support access to tenant content.
- Canonical promotion workflow for reviewed AI question and lesson-summary drafts.
- Email/SMS/WhatsApp provider delivery, preferences, suppression, receipts, and retries.

Until every hard gate is evidenced, releases must retain the label **staging only — not production ready**.
