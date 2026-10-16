# PrepZii LMS implementation plan

Status date: 2026-10-17

Statuses mean: **verified** = exercised by automated checks; **implemented, unverified** = code exists but external infrastructure was unavailable; **prototype** = UI/local state only; **pending** = not implemented.

## Phase 1 — audit and foundation

Status: **implemented; database integration pending staging verification**

- [x] Audit consumer PrepZii and LMS repositories.
- [x] Document canonical shared-backend architecture.
- [x] Add shared permission package and privilege-escalation tests.
- [x] Add verified active-tenant selection endpoint.
- [x] Protect super-admin through a server-controlled allowlist.
- [x] Add composite tenant constraints and persistent audit/webhook schema migration.
- [x] Add SQL cross-tenant isolation test script.
- [x] Remove build-time Google font dependency.
- [x] Make demo requests persistent rather than returning fake success.
- [x] Consolidate Razorpay processing behind one internal processor.
- [ ] Inspect the live schema and run migrations against an isolated staging clone.
- [ ] Add CI-provisioned Postgres/Supabase integration environment.

Exit gate: no production application until schema collision and SQL security tests are resolved.

## Phase 2 — core institute operations

Status: **in progress; onboarding vertical slice implemented, external verification pending**

Order of implementation:

1. [x] Transactional, retry-safe institute onboarding RPC (institute, owner membership, trial, audit row) plus Clerk-protected API and real form.
2. Invitations with hashed token, expiry, accepted/revoked state, and idempotency.
3. Real organization switcher and server-rendered role navigation.
4. Student/staff profiles and membership APIs with pagination/search.
5. CSV import staging, validation report, and idempotent commit.
6. Courses, batches, enrolments, academic sessions, branches, and basic timetable.
7. Replace each corresponding `mock-data.ts` import only after its API and tests pass.

## Phase 3 — learning delivery

Status: **pending**

- Modules, lessons, resources, release rules, completion tracking.
- Private storage and signed URL service.
- Assignments, submissions, rubrics, grading, and resubmission.
- Student course and continue-learning experience backed by real data.

## Phase 4 — assessments

Status: **partial foundation**

- Reconcile shared contracts with the consumer question/test schema.
- Reuse the existing question bank through adapters.
- Add server-authoritative attempt lifecycle, deadline, autosave versioning, idempotent submit, and solution-release rules.
- Add subjective grading and authorized analytics.
- Preserve and expand scoring parity fixtures between consumer and LMS.

## Phase 5 — attendance and finance

Status: **schema/prototype only**

- Attendance corrections with immutable audit history.
- Fee plans, invoices, instalments, concessions, receipts, refunds, reconciliation.
- Integer minor-unit currency at API boundaries; reviewed decimal storage in DB.
- Razorpay sandbox integration and replay/concurrency tests.

## Phase 6 — commercial SaaS

Status: **schema/prototype only**

- Configurable plans/entitlements and atomic quota enforcement.
- Trials, renewal, downgrade, grace/read-only policy, cancellation.
- Real super-admin APIs, feature flags, support access approvals, audit views.
- Branding and verified subdomain registry.

## Phase 7 — AI and communications

Status: **pending**

- Tenant-filtered AI content service using existing Gemini integration.
- Strict structured output, source references, draft/review state, budgets, and usage records.
- In-app notifications first; provider adapters for opted-in email/SMS/WhatsApp later.

## Phase 8 — controlled pilot readiness

Status: **pending**

- Full integration/E2E suite, accessibility audit, load tests, backup restore drill.
- Staging migration rehearsal and rollback checkpoint.
- Monitoring, alerting, retention/deletion workflows, DPDP legal review.
- Pilot with explicitly limited tenants and documented support/escalation.

## Current completed versus pending

Completed and verified locally:

- Shared scoring unit tests.
- Shared RBAC/cross-tenant unit tests.
- Next.js type checking and lint baseline.
- Server-only membership resolution and active-tenant selection code.

Implemented but requiring external verification:

- Supabase migrations and SQL RLS test.
- Clerk-protected organization endpoints.
- Institute onboarding RPC/API against a Clerk-enabled staging tenant.
- Demo request persistence.
- Razorpay forwarding/internal processor.

Presentation prototypes only:

- All role dashboards and most operational pages currently backed by mock data.

Not complete:

- The definition-of-done workflows in the master brief. No production-ready claim is permitted yet.
