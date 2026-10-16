# PrepZii LMS architecture

## Decision

PrepZii LMS is an independently deployed Next.js modular monolith that shares PrepZii's Clerk tenant identity, Supabase/PostgreSQL project, question bank, assessment records, storage infrastructure, AI provider configuration, and selected versioned packages.

It does not import consumer application files by relative path and does not duplicate identity or question-bank systems.

```text
Browser
  │
  ▼
Next.js 16 LMS application
  ├── Clerk authentication and protected routes
  ├── domain route handlers / server services
  ├── @prepzii/contracts
  ├── @prepzii/authorization
  ├── @prepzii/membership
  ├── @prepzii/assessment-core
  └── @prepzii/ui
          │
          ▼
Shared PrepZii Supabase project
  ├── institutes + institute_members (canonical tenant identity)
  ├── existing questions/PYQs/tests/profiles
  ├── organization_* LMS tables
  ├── RLS + composite tenant foreign keys
  └── private learning storage with tenant-prefixed objects and signed access
```

The current FastAPI directory is an optional prototype, not a second source of truth. If retained, it is reachable only through authenticated server-to-server requests and must use the same canonical schema and migrations.

## Tenant model

- `public.institutes.id` is the canonical `organization_id`.
- An actor is authorized by `institutes.owner_user_id` or an active `institute_members` record.
- The browser may propose a slug/ID, but every server operation resolves membership again.
- Active tenant selection is stored in an HTTP-only cookie containing a slug. The cookie is context only; it is never authorization.
- Every new tenant-owned row contains `organization_id`.
- Parent-child relationships use composite foreign keys `(id, organization_id)` to prevent cross-tenant linkage.
- RLS is defence in depth; service-role server code must still scope every query.

## Authorization

Roles:

- `PLATFORM_SUPER_ADMIN` (server-controlled allowlist only)
- `OWNER`
- `COACHING_ADMIN`
- `ACADEMIC_COORDINATOR`
- `TEACHER`
- `STUDENT`
- `PARENT`
- `ACCOUNTANT`

`@prepzii/authorization` maps roles to domain permissions and rejects cross-tenant actions before checking permissions. Platform super-admin status does not implicitly grant tenant-content access. Legitimate support access requires an explicit, audited workflow that is not yet implemented.

## Domain boundaries

| Domain | Canonical implementation |
| --- | --- |
| Identity and tenant membership | Clerk + `institutes` + `institute_members` |
| Invitations | Hashed tokens + verified Clerk email + service-only transactional RPCs |
| Academic structure | Tenant-scoped audited RPCs over `organization_campuses`, academic years, subjects, courses, batches, enrolments, rooms, and conflict-safe schedules |
| Learning delivery | Organization modules/lessons, course-batch links, private resource/submission storage, release rules, completion, assignments, and grading |
| Assessment | Existing PrepZii questions/tests + schema adapter + service-only attempt RPCs + shared deterministic scoring |
| Attendance | Service-only session register, assigned-teacher scope, student reads, immutable corrections |
| Finance | Separate institute fee plans/ledgers/invoices/receipts/refunds; service-only audited mutations |
| SaaS billing | Organization subscriptions, configurable entitlements, atomic quotas, grace and cancellation controls |
| Audit | organization and platform audit logs |
| AI | Shared Gemini credentials through tenant-scoped, quota-metered, structured draft service |

## Request flow

1. Clerk authenticates the request.
2. Server derives `userId`; it never accepts an acting user ID from a browser body/header.
3. Active organization slug is read from the HTTP-only cookie or route.
4. The server resolves the institute and active membership.
5. Permission is checked for the domain action.
6. The query includes `organization_id`; the database enforces RLS/composite constraints.
7. Sensitive mutations write an audit record in the same transaction where practical.

## Storage

Private learning objects use `organizations/{organization_id}/lessons/{lesson_id}/{uuid}-{safe_filename}` in `organization-learning`; student work uses `organizations/{organization_id}/assignments/{assignment_id}/{actor_hash}/{uuid}-{safe_filename}` in `organization-submissions`. Both buckets are non-public. The server validates a narrow MIME allowlist and respective 25 MB/10 MB limits, records byte size and SHA-256, rechecks membership, enrolment, release, and reviewer access, then returns a five-minute signed URL. Public URLs are permitted only for intentionally public branding assets. Malware/content inspection and retention automation remain pending.

## Payments

Razorpay calls the public Next.js webhook URL. Next.js forwards the exact signed body to the single internal processor. The processor requires an internal API key, verifies Razorpay HMAC, persists provider event IDs, and updates one ledger transaction atomically. No success redirect can activate a subscription or mark a fee paid.

## Migration order

1. Verify and snapshot the existing production schema.
2. Resolve the two incompatible `institutes` migration definitions.
3. Apply consumer institute prerequisites if absent.
4. Apply LMS migrations `0001`–`0004` to a staging clone.
5. Apply `0005_tenant_integrity_rbac_audit.sql` through `0017_communications_ai_drafts.sql` in order.
6. Run `supabase/tests/tenant_isolation.sql` in the isolated database.
7. Exercise onboarding and invitation concurrency/replay cases with Clerk test identities.
8. Review query plans and only then schedule a production migration with rollback/backup checkpoints.

## Assessment trust boundary

The LMS does not copy PrepZii questions. `@prepzii/assessment-core` adapts the existing row shape into a versioned domain contract and produces deterministic objective scores. Students receive only sanitized question fields. Start/resume, enrolment, attempt count, expiry, optimistic answer versions, and finalization are enforced by service-only PostgreSQL functions. The browser submits answers, never marks. Results and correct answers are returned only after the configured release policy or to an authorized staff reviewer. Teacher attempt visibility is restricted to tests they created; tenant composite keys prevent schedules and attempts from referencing another institute.

## Attendance and institute finance

Attendance is stored per batch session. Staff mutations go through one transactionally audited RPC; teachers must be assigned to the batch. The first save finalizes a session. Later status changes require a reason and append an immutable correction record before changing the current register.

Institute fee collection is deliberately separate from PrepZii SaaS subscription revenue. Browser/API money inputs are integer paise; PostgreSQL persists reviewed INR decimals. Fee-plan assignment creates a student ledger, installment schedule, and invoice in one transaction. Payments and refunds lock the ledger/installment, require tenant-unique references, update invoice and ledger status, and append audit records. Client redirects never mark an installment paid. Provider webhook-to-ledger integration remains a staging-gated follow-up.

## SaaS entitlements and platform operations

Subscription plans store paise prices, limits, and JSON feature entitlements. Database triggers serialize and enforce active-student and campus quotas at the canonical tables, so parallel API calls cannot bypass them. Metered usage uses a service-only idempotent RPC with monthly counters and subscription/grace checks. Plan changes are requests only; browser state never activates paid access.

Platform administration is separate from tenant authorization. Access requires a server-controlled user-ID allowlist, and the platform RPC is callable only by the service role behind that check. Institute suspensions, plan edits, and feature flags append platform audit records. Support access has an explicit approval schema and confers no access until a separate, time-bound authorization path is implemented.

## Communications and AI drafts

Portal notifications are canonical. Announcement publication resolves recipients from active tenant memberships and, for batch notices, tenant-scoped enrolments. Each recipient receives an independent read state. External delivery jobs are persisted as `BLOCKED_CONFIG` until an opted-in provider is actually configured; the UI never reports fabricated delivery.

The AI endpoint reuses PrepZii's Gemini environment configuration but does not import consumer application files. It authenticates a content manager, stores a request-scoped processing record, atomically consumes one tenant credit, treats supplied material as untrusted, requests schema-constrained JSON, validates it again with Zod, and stores only a reviewable draft. Inputs are hashed and source metadata avoids invented citations. AI output cannot publish itself or determine authorization.
