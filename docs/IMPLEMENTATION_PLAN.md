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
3. [x] Real organization switcher and authenticated role-shaped navigation/dashboard data are connected.
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

Status: **core attendance and institute ledger implemented in code; payment-provider and document verification pending**

- [x] Session-wise attendance entry for authorized staff and assigned teachers.
- [x] Student-scoped attendance history and immutable, reasoned correction history.
- [x] Fee plans, instalment templates, student ledgers, concessions, invoices, manual receipts, partial payments, and refunds.
- [x] Integer minor-unit currency validation at API/RPC boundaries with reviewed `numeric(12,2)` INR persistence.
- [x] Unique payment references, transactional balance updates, tenant constraints, and audit events.
- [ ] Generate and visually verify downloadable PDF invoices/receipts.
- [ ] Connect verified Razorpay institute-fee events to the ledger and add sandbox replay/concurrency tests.
- [ ] Add bulk fee assignment, reconciliation queues, credit adjustments, and overdue reminder delivery.
- [ ] Rehearse migrations `0014`–`0015` and the expanded SQL isolation suite on an isolated Supabase clone.

## Phase 6 — commercial SaaS

Status: **core entitlements and administration implemented in code; provider billing verification pending**

- [x] Configurable plans, prices, feature entitlements, student/campus limits, and monthly usage counters.
- [x] Database-atomic student/campus quota enforcement plus idempotent AI/storage/provider usage consumption.
- [x] Trial/grace write checks, plan-change requests, and cancel-at-period-end controls without client-side activation.
- [x] Server-allowlisted platform API for institute status, plan configuration, feature flags, and audit views.
- [x] Tenant branding settings and globally unique, inactive-until-verified subdomain registry.
- [x] Explicit support-access request schema with no implicit tenant-content grant.
- [ ] Process verified SaaS billing webhooks into subscription transitions, invoices, renewals, and failures.
- [ ] Build support approval/revocation UI and time-bound content-access enforcement.
- [ ] Add automated downgrade/read-only transitions and customer data export workflows.
- [ ] Rehearse migration `0016` and quota concurrency on an isolated database.

## Phase 7 — AI and communications

Status: **portal communications and reviewed AI drafting implemented in code; external delivery pending**

- [x] Tenant-scoped announcement drafts/publication with audience and assigned-batch checks.
- [x] In-app notifications with per-recipient read state and role-scoped notice-board queries.
- [x] External email/SMS/WhatsApp jobs remain explicitly blocked until a provider is configured; no fake delivery success.
- [x] Reuse the configured Gemini key/model through a server-only, timeout-bounded REST adapter.
- [x] Strict structured outputs for announcement, question, and lesson-summary drafts.
- [x] Untrusted-input instruction boundary, input hashes, source metadata, draft-only state, token metadata, and idempotent AI quota consumption.
- [ ] Add faculty approval/rejection UI for question/summary drafts and promotion into canonical content.
- [ ] Configure opt-in provider adapters, preferences, retries, delivery receipts, and suppression lists.
- [ ] Add AI output quality fixtures, abuse rate limits, and provider-failure quota policy.
- [ ] Rehearse migration `0017` and real provider calls in staging.

## Phase 8 — controlled pilot readiness

Status: **local application gates implemented; external readiness gates pending**

- [x] Replace dashboard, reports, and admissions CRM mocks with role-scoped tenant APIs and real empty states.
- [x] Restrict admissions CRM to owner/admin permissions and audited, service-only mutations.
- [x] Prevent CRM from fabricating student conversion; reviewed onboarding remains authoritative.
- [x] Add live role-shaped attendance, assessment, assignment, batch, and finance summaries.
- [x] Keep CI gates for tests, type checking, lint, production build, dependency audit, and backend tests.
- [ ] Provision a disposable Supabase test environment and run all migrations plus the SQL isolation suite.
- [ ] Full browser E2E suite, accessibility audit, load tests, backup restore drill.
- [ ] Staging migration rehearsal and rollback checkpoint.
- [ ] Monitoring, alerting, retention/deletion workflows, DPDP legal review.
- [ ] Pilot with explicitly limited tenants and documented support/escalation.

## Current completed versus pending

Completed and verified locally:

- Shared scoring unit tests.
- Shared RBAC/cross-tenant unit tests.
- Shared invitation lifecycle unit tests.
- Next.js type checking, scoped lint, and production build.
- Server-only membership resolution and active-tenant selection code.
- Academic workspace route, real batches/courses/campuses screens, and timetable conflict guards.
- Role-scoped operational dashboard and reports.
- Audited admissions CRM with server-side tenant verification.

Implemented but requiring external verification:

- Supabase migrations and SQL RLS test.
- Clerk-protected organization endpoints.
- Institute onboarding RPC/API against a Clerk-enabled staging tenant.
- Invitation create/accept/revoke RPCs and RLS-backed persistence.
- Demo request persistence.
- Razorpay forwarding/internal processor.

Not complete:

- The definition-of-done workflows in the master brief. No production-ready claim is permitted yet.
