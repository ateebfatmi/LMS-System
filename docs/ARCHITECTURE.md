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
  └── private storage with tenant-prefixed objects (pending)
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
| Academic structure | `organization_campuses`, academic years, subjects, courses, batches |
| Learning delivery | organization modules/lessons/resources (resources pending) |
| Assessment | existing PrepZii question/test data + shared scoring package |
| Attendance | organization attendance sessions and records |
| Finance | separate institute fee ledger; Razorpay events are verified and idempotent |
| SaaS billing | organization subscriptions and plan entitlements |
| Audit | organization and platform audit logs |
| AI | existing Gemini provider through tenant-filtered LMS service (pending) |

## Request flow

1. Clerk authenticates the request.
2. Server derives `userId`; it never accepts an acting user ID from a browser body/header.
3. Active organization slug is read from the HTTP-only cookie or route.
4. The server resolves the institute and active membership.
5. Permission is checked for the domain action.
6. The query includes `organization_id`; the database enforces RLS/composite constraints.
7. Sensitive mutations write an audit record in the same transaction where practical.

## Storage

Private object paths will use `organizations/{organization_id}/{domain}/{object_id}/{filename}`. Authorization must be checked before issuing a short-lived signed URL. Public URLs are permitted only for intentionally public branding assets. File metadata, MIME allowlists, byte limits, hashes, ownership, retention, and malware-processing state must be recorded before enabling student documents.

## Payments

Razorpay calls the public Next.js webhook URL. Next.js forwards the exact signed body to the single internal processor. The processor requires an internal API key, verifies Razorpay HMAC, persists provider event IDs, and updates one ledger transaction atomically. No success redirect can activate a subscription or mark a fee paid.

## Migration order

1. Verify and snapshot the existing production schema.
2. Resolve the two incompatible `institutes` migration definitions.
3. Apply consumer institute prerequisites if absent.
4. Apply LMS migrations `0001`–`0004` to a staging clone.
5. Apply `0005_tenant_integrity_rbac_audit.sql`, `0006_institute_onboarding.sql`, and `0007_organization_invitations.sql`.
6. Run `supabase/tests/tenant_isolation.sql` in the isolated database.
7. Exercise onboarding and invitation concurrency/replay cases with Clerk test identities.
8. Review query plans and only then schedule a production migration with rollback/backup checkpoints.
