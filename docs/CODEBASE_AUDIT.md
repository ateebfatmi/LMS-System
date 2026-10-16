# PrepZii LMS codebase audit

Audit date: 2026-10-17
Repositories inspected:

- Consumer PrepZii: `/Users/ateebfatmi/Desktop/prepzii`
- PrepZii LMS: `/Users/ateebfatmi/Desktop/LMS System`

This document records verified code, not intended features. It must be updated when a pending module becomes connected to production data.

## Executive finding

Consumer PrepZii is a working Next.js application with substantial assessment, PYQ, analytics, community, institute, payment, storage, and AI code. PrepZii LMS is currently a strong visual prototype plus an early database/API foundation. It is **not production-ready**: most LMS operational modules still import local mock data, only institute creation and invitations are connected, the new migrations have not been verified against a staging clone, and the optional FastAPI prototype has model/schema drift from Supabase.

The safe direction is a modular Next.js application using the existing Clerk and Supabase projects. The separate FastAPI service is not yet justified and must not become an authoritative second data model until its need and schema ownership are resolved.

## Consumer PrepZii: verified implementation

### Framework and structure

- Next.js `^16.3.0`, React `19.2.4`, Node `>=22`.
- App Router under `src/app`; 71 page files and 94 API route handlers were found.
- Application code is primarily JavaScript/JSX with `@/*` path aliases.
- Tailwind 4 and a large custom component/CSS layer are present.
- There are two migration directories: `db/migrations` and `supabase/migrations`.
- No consumer unit/integration test files were found outside dependencies.

### Backend and APIs

- Backend-for-frontend routes are implemented as Next.js route handlers.
- `supabaseAdmin` is used for privileged server-side operations.
- Institute routes exist for workspaces, students, batches, tests, question import, results, and storage upload.
- The assessment flow reuses `questions`, `test_sessions`, `test_attempts`, institute tests, assignments, and attempts.
- Access/entitlement logic lives mainly in `src/lib/accessControl.js` and `src/lib/instituteAuth.js`.

### Authentication and roles

- Clerk is the identity provider; Clerk user IDs are stored in Supabase records.
- `src/proxy.js` protects consumer dashboard/institute routes.
- Institute ownership is stored in `institutes.owner_user_id`; membership is stored in `institute_members`.
- Consumer roles currently centre on `COACHING_ADMIN` and `STUDENT`; the LMS needs a reviewed expansion.
- Consumer platform-admin access reads Clerk `publicMetadata.role`. The LMS must not copy this pattern because public/user-editable metadata is not an acceptable server-controlled super-admin grant.
- Consumer pending email invitations are opportunistically bound to a Clerk user ID when membership is loaded. The LMS does not reuse that path; it now has a separate hashed-token, expiry, revocation, verified-email, and idempotency lifecycle.

### Database and migration risk

- `db/migrations/20260812_institute_mvp.sql` defines the tenant `institutes` table (`name`, `slug`, `owner_user_id`).
- `supabase/migrations/20260923000001_create_institutes.sql` also creates an `institutes` table for JoSAA reference data (`institute_name`, `institute_state`, `institute_type`). These definitions are incompatible under one schema. The deployed production shape must be inspected before any LMS migration is applied.
- Existing institute tables include members, batches, batch members, tests, test questions, assignments, and attempts.
- Consumer migrations enable RLS on institute tables but state that access is enforced through service-role server routes; policy coverage must be verified in the actual database.

### Questions and assessments

- Consumer PrepZii already has central `questions`, `pyq_questions`, `pyq_exams`, test-session, attempt, review, and analytics workflows.
- It supports structured question/explanation content, question images, PYQ metadata, institute-authored questions, and objective scoring.
- The LMS must adapt to these tables; it must not create a second question bank.
- Shared `@prepzii/assessment-core` now has executable tests for single choice, multiple choice partial scoring, numerical tolerance, summaries, and leaderboards. Server-authoritative attempt timing/submission is still pending in the LMS.

### AI

- Gemini integration exists in `src/lib/zi/provider.js`; transcription support is separate.
- Model names and token caps are environment/config driven (`GEMINI_API_KEY`, `ZI_AI_MODEL`, `ZI_TRANSCRIPTION_MODEL`).
- Current consumer access accounting uses `zi_preferences`; increments are read-then-upsert and are not concurrency-safe quotas.
- LMS AI retrieval, tenant filters, draft/review workflow, and per-tenant usage budgets do not yet exist.

### Storage and uploads

- Supabase Storage is used, including the `pyq-images` bucket.
- Institute uploads are written under `institute-uploads/{institute_id}/...`, which is a useful prefix convention.
- The institute upload route returns a public URL and does not enforce a file-size allowlist, safe filename, content inspection, or private signed URLs. It must not be reused unchanged for student documents or paid course resources.

### Payments

- Consumer PrepZii has Razorpay order creation and server-side verification.
- Verification checks signatures, provider order/payment state, amount, currency, user, plan, and track before activating a subscription.
- The consumer flow is for individual PrepZii plans, not institute fee collection or LMS SaaS billing.
- LMS fee collection and PrepZii subscription revenue must remain separate ledgers.

## PrepZii LMS: verified state

### Working foundations

- Independent Git repository and deployable Next.js 16 workspace.
- Shared packages for contracts, scoring, UI, permission evaluation, and membership lifecycle rules.
- Clerk route protection and server-only Supabase client boundary.
- Membership-backed organization listing and active-organization selection.
- Additive tenant-aware migrations `0001`–`0008` (not applied to production).
- Persistent demo-request API, health endpoint, and Razorpay forwarding boundary.
- TypeScript, ESLint, and Node assessment/authorization/membership unit tests.

### Prototype-only or incomplete

- Dashboard, batches, courses, assessments, attendance, fees, announcements, campuses, CRM, billing, reports, and super-admin pages use `apps/web/src/lib/mock-data.ts` or hard-coded display data. Student and faculty directories have been moved to tenant-scoped member APIs.
- Many visible page actions mutate client state only; refresh discards changes.
- Transactional institute creation, invitations, paginated member/profile directories, and staged CSV member imports now exist in code. Timetable service, learning-resource storage, assignment workflow, attempt autosave, invoice/receipt generation, notification delivery, quota enforcement, and AI service do not.
- Super-admin UI data is mocked. Access is now guarded by a server-controlled user-ID allowlist, but the underlying platform APIs are not implemented.
- Parent/guardian links are absent; parent visibility must remain denied rather than inferred.

### FastAPI prototype

- The service contains CRM, assessment, webhook, and health routes plus SQLite tests.
- It creates tables at process startup and its SQLAlchemy models do not consistently match the Supabase migrations (UUID/string types and fee transaction columns differ).
- It trusts organization/user headers only behind a newly required internal API key. It is not a browser API.
- It should remain quarantined until the team proves a need that Next.js route handlers cannot meet, adopts the canonical Supabase schema, and adds Alembic migrations.

## Verification baseline

On 2026-10-17:

- `npm test`: 16 assessment, authorization, membership, and CSV validation tests passed.
- `npm run typecheck`: passed across all workspaces.
- `npm run lint`: passed with zero errors.
- `npm run build`: passed after replacing the network-dependent Google font build step with a system font stack.
- Backend tests were run in an isolated Python 3.13 environment after adding the missing `email-validator` dependency: 13 passed with one Starlette/httpx deprecation warning. A committed lockfile and CI environment are still required.
- Live Supabase integration and SQL isolation tests were not run because no isolated test database was configured. They must never be run against production.

## Highest-priority risks

1. Confirm the real production `institutes` schema and resolve the migration namespace collision.
2. Validate migrations on a scrubbed staging clone, including RLS and composite tenant foreign keys.
3. Replace mock page state with authorized server APIs one bounded context at a time.
4. Choose one authoritative backend/data model; do not operate divergent Next.js and FastAPI persistence layers.
5. Add private storage buckets, file validation, signed URLs, and retention rules.
6. Validate the new invitation/audit/idempotency workflow in staging, then add quota and financial-ledger workflows.
7. Add an isolated test database and run the SQL tenant-isolation suite in CI.
