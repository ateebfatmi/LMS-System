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

Status: **implemented in code through academic operations; external verification pending**

Order of implementation:

1. [x] Transactional, retry-safe institute onboarding RPC (institute, owner membership, trial, audit row) plus Clerk-protected API and real form.
2. [x] Invitations with hashed token, expiry, accepted/revoked state, verified-email binding, audit records, and idempotency.
3. [~] Real organization switcher is connected; server-rendered role navigation remains pending.
4. [x] Tenant-scoped student/staff profiles and membership APIs with pagination, search, audited edits, and real directory screens.
5. [x] CSV import staging, row-level validation report, service-only PII storage, and transactional idempotent commit to pending members.
6. [x] Tenant-scoped courses, subjects, batches, enrolments, academic sessions, campuses, rooms, and conflict-safe basic timetable through audited database mutations.
7. [x] Replace the batches, courses, and campuses mock screens with authorized academic APIs and real empty states.

## Phase 3 — learning delivery

Status: **learning content and assignments implemented in code; external verification pending**

- [x] Modules, lessons, resources, scheduled release rules, course-to-batch assignment, and completion tracking.
- [x] Private storage bucket, upload validation, tenant-prefixed object paths, and short-lived authorized signed URLs.
- [x] Course/batch/student assignments, rubrics, server-timed text/file submissions, grading, feedback, and controlled resubmission.
- [x] Staff authoring and enrolled-student course experience backed by authoritative data.

## Phase 4 — assessments

Status: **objective assessment lifecycle implemented in code; external verification and subjective grading pending**

- [x] Reconcile the shared objective-question contract with the consumer `questions` schema through an adapter.
- [x] Reuse the existing question bank and institute test tables without a duplicate LMS bank.
- [x] Add enrolled-student start/resume, server-authoritative expiry, optimistic autosave, attempt limits, and idempotent final submission.
- [x] Keep correct answers server-only until result/solution release policy permits them.
- [x] Add teacher-owned authoring, batch scheduling, publication, result release, and a responsive test-taking workspace.
- [x] Preserve and expand scoring parity fixtures for single, multiple-select/JEE partial, and numerical questions.
- [ ] Add descriptive-answer contracts, manual-grading queues, moderation, and authorized aggregate analytics.
- [ ] Rehearse migration `0013` and the expanded cross-tenant SQL suite on an isolated Supabase clone.

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
- Shared invitation lifecycle unit tests.
- Next.js type checking and lint baseline.
- Server-only membership resolution and active-tenant selection code.
- Academic workspace route, real batches/courses/campuses screens, and timetable conflict guards.

Implemented but requiring external verification:

- Supabase migrations and SQL RLS test.
- Clerk-protected organization endpoints.
- Institute onboarding RPC/API against a Clerk-enabled staging tenant.
- Invitation create/accept/revoke RPCs and RLS-backed persistence.
- Demo request persistence.
- Razorpay forwarding/internal processor.

Presentation prototypes only:

- Role dashboards and several operational pages remain backed by mock data; student/faculty directories and academic-structure screens now use authoritative APIs.

Not complete:

- The definition-of-done workflows in the master brief. No production-ready claim is permitted yet.
