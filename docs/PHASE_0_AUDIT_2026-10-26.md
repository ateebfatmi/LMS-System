# PrepZii B2B LMS — Phase 0 Architecture Audit

**Audit date:** 2026-10-26  
**Scope:** repository inspection and local validation only  
**Decision:** continue the existing modular monolith; do not rewrite the application or start every roadmap phase in parallel.

## Executive assessment

This repository is not a blank Phase 0 project. It already contains a substantial multi-tenant LMS: a Next.js 16 web application, Clerk authentication, a shared Supabase/PostgreSQL schema, 44 API route handlers, 27 dashboard pages, six shared packages, 24 migration files, SQL isolation tests, and an optional FastAPI prototype/internal payment processor.

The right path is to harden and reconcile the current system. The UI breadth is ahead of the release evidence. Production deployment remains blocked until the live/staging database catalog and migration ledger are inspected, the historical `public.institutes` schema collision is resolved, duplicate migration versions are reconciled, and tenant isolation is exercised against a realistic staging clone with real authentication claims.

## Current architecture

| Layer | Current implementation | Assessment |
| --- | --- | --- |
| Web and API | Next.js 16 App Router; route handlers in `apps/web/src/app/api` | Keep as the canonical application boundary. |
| Identity | Clerk user identity plus `institutes` and `institute_members` | Keep, but validate with real Clerk test identities in staging. |
| Data | Shared Supabase/PostgreSQL project | Keep. `institutes.id` is the canonical organization identifier. |
| Authorization | Server-resolved tenant context, shared permission package, scoped queries, RLS/composite constraints | Good foundation; service-role queries make application scoping mandatory. |
| Shared domain logic | `packages/assessment-core`, `authorization`, `contracts`, `learning`, `membership`, and `ui` | Reuse and expand here instead of duplicating behavior in the web app. |
| Python backend | FastAPI prototype/internal processor | Do not treat as a second source of truth. Retain only behind authenticated server-to-server calls after schema and money-model reconciliation. |
| Delivery | GitHub Actions for Node, Python, and PostgreSQL isolation jobs | Good structure; local lint, test, build, migration-history, and dependency-audit gates pass, while external staging checks are not yet evidenced. |

The intended trust path is:

1. Clerk establishes the user identity.
2. Server code resolves an active owner or membership record.
3. The server derives the organization and role; it never trusts a browser-supplied organization ID by itself.
4. The shared authorization package checks the action.
5. Every service-role query includes the resolved organization scope.
6. Database RLS and tenant-aware constraints provide defense in depth for non-service-role access.
7. Sensitive mutations append audit records and enforce idempotency where required.

## Reuse assessment

### Reuse as primary foundations

- `packages/authorization`: centralized permissions, tenant checks, role-grant rules, quotas, and the new fail-closed development-auth policy.
- `packages/contracts`: common organization, membership, academic, assessment, finance, and communications types.
- `packages/assessment-core`: the strongest tested domain module, including grading, release rules, and workflow invariants.
- `packages/learning` and `packages/membership`: shared lifecycle and import validation behavior.
- Supabase migrations and RPCs: the canonical database evolution path, after ledger reconciliation.
- `supabase/tests/tenant_isolation.sql`: useful local regression coverage; extend it rather than replacing it.
- Existing onboarding, invitation, directory, course, batch, content, assignment, assessment, attendance, finance, notification, CRM, analytics, and platform-admin routes and screens.

### Reuse with hardening

- DAL/repository modules that contain in-memory or mock fallbacks must be explicitly limited to a local sandbox. Deployed code must fail closed rather than silently substituting demo data.
- Parent/guardian behavior is split between older application permission rules and migration `0019`'s reviewed guardian links. Reconcile the permission contract and table naming before enabling parent attendance or fee views.
- Upload handling already uses private buckets, allowlists, size limits, hashes, signed URLs, and tenant paths. Add content inspection/malware scanning, retention enforcement, and storage-policy integration tests.
- Platform administration has a server-controlled allowlist and audit-oriented RPCs. Add stronger operational access controls and staging tests before use.
- FastAPI payment processing has webhook verification and persistence concepts worth retaining, but its SQLAlchemy schema and numeric assumptions must match the canonical Supabase model. Store money as integer paise and never use floating point for ledger values.

### Do not reuse as production evidence

- Demo data and in-memory repositories.
- Phase reports that describe implementation progress as proof that production migrations, backup restoration, monitoring, accessibility, or load behavior were verified.
- The current duplicated numeric migration prefixes as a safe deploy order.
- A service-role database client as a substitute for tenant authorization or RLS testing.

## Data and migration audit

The repository currently has 24 migration files, but versions `0003`, `0004`, and `0005` each occur twice. Renaming already-applied migrations without inspecting `supabase_migrations.schema_migrations` can corrupt migration history. In addition, the repository documents two incompatible historical definitions of `public.institutes` inherited from the consumer PrepZii system. CI now verifies hashes for the six known duplicate-version files and rejects new or modified duplicate history; this protects evidence but does not replace deployed-ledger reconciliation.

Static SQL coverage is broad: 65 RLS-enable statements, 107 policy declarations, and 42 function declarations were found. These counts indicate breadth, not proof that the deployed schema matches the repository or that every policy is correct.

### Safe reconciliation plan

1. Freeze schema changes for the reconciliation window. Export a schema-only dump, table/column/constraint/index/policy catalog, row counts, storage bucket policies, and the complete migration ledger from the deployed project. Take and verify a recoverable backup first.
2. Compare the deployed `institutes`, `institute_members`, batches, tests, sessions, attempts, profiles, and storage objects with the repository's canonical model. Decide the canonical `institutes.id` mapping without deleting consumer data.
3. Hash the SQL content associated with every applied migration record. Map both files for each duplicated prefix to actual deployed state. Do not rename or replay an applied migration blindly.
4. Create a new, uniquely versioned, forward-only reconciliation migration. It should add or backfill safely, preserve IDs, use transactions where supported, and include explicit preconditions and postcondition checks.
5. Restore a production-like backup into an isolated staging project. Apply the reconciliation and all pending migrations there first.
6. Run SQL isolation tests with realistic JWT/request claims, service-role RPC tests, storage-policy tests, duplicate-event/idempotency tests, and cross-organization negative cases.
7. Verify constraints and counts, inspect slow query plans for tenant-scoped indexes, exercise Clerk onboarding/invitations concurrently, and test rollback/restore before scheduling production deployment.
8. Deploy in a reviewed maintenance window with monitoring, a tested rollback/restore decision point, and a written post-deploy validation checklist.

No production data should be deleted or rewritten merely to make migration history look linear.

## Security and reliability findings

### Release blockers

1. **Deployed schema is unverified.** The `institutes` collision and actual migration ledger have not been reconciled against a staging clone.
2. **Migration IDs are ambiguous.** Duplicate prefixes can cause migration-tool ordering/history failures.
3. **Real cross-tenant staging E2E is missing.** Local SQL tests are valuable, but Clerk identities, JWT claims, storage policies, and service-role route behavior must be tested together.
4. **Payment architecture is not yet canonical.** The Python models and money representation must be reconciled with the Supabase ledger before real transactions are enabled.

### High-priority hardening

- Extend the new database-backed rate limiter beyond demo requests, invitations, member imports, and AI drafting to messaging, upload, and webhook surfaces after traffic-specific limits are agreed.
- Keep the new same-origin mutation checks and Content Security Policy covered by browser/staging tests as Clerk and other provider domains change.
- Keep the dependency audit at zero production advisories; Next.js is now 16.4.3 and Zod is 4.6.7.
- Eliminate deployed mock fallbacks and audit every service-role query for mandatory `organization_id` scoping.
- Reconcile guardian authorization between application permissions and migration `0019` before exposing child data.
- Add backup-restore drills, alerting, structured security events, queue failure visibility, retention jobs, accessibility checks, and representative load tests.

## Phase 1 work completed in this audit

The existing Phase 1 foundation was preserved and one concrete authentication boundary was hardened:

- Local demo tenancy is allowed only when `NODE_ENV=development` and both Clerk and Supabase are absent.
- A partial configuration can no longer combine a synthetic user with a real service-role database; it returns a service-unavailable error.
- The `x-authenticated-user` override now requires both development mode and the explicit `ALLOW_INSECURE_DEV_AUTH=true` flag.
- The demo role is always a valid `OrganizationRole`; the obsolete `DIRECTOR` escape hatch was removed.
- Shared policy functions and regression tests were added to `packages/authorization`.
- The changed auth files pass focused ESLint and the environment flag is documented in `.env.example`.
- Full repository lint was repaired without weakening the rules; it now passes with zero errors and zero warnings.
- Legacy tenant-sensitive endpoints now use explicit role allowlists instead of accepting any active member.
- Parent lookups now require `APPROVED` records in `organization_guardian_links` and load real tenant-scoped memberships, profiles, and batches instead of production mock identities.
- Migration `0020` safely backfills legacy verified parent links into the reviewed guardian model without deleting the legacy rows.
- Cross-site browser mutations are rejected at the Next.js proxy boundary, and a baseline CSP is enforced; development alone permits the `unsafe-eval` source required by Next.js Fast Refresh.
- The deprecated Clerk route-matcher helper was removed while retaining optimistic route protection and resource-level authorization in route handlers and the DAL.
- Migration `0021` adds an atomic service-role-only rate-limit store used by demo requests, invitation creation, CSV imports, and AI drafting.
- Known duplicate migration files are hash-pinned in CI so history cannot drift silently while the deployed ledger is being reconciled.
- Critical Next.js and high-severity Zod advisories were removed with patch upgrades and a clean production dependency audit.
- Role navigation now points at the canonical database-backed workspace screens; links that could expose an unsupported role to an unscoped or forbidden screen were removed until dedicated scoped views exist.

This closes a serious partial-configuration failure mode. It does not by itself certify Phase 1 for production; the external database and end-to-end gates above remain open.

## Prioritized incremental roadmap

### Gate 0 — make the existing baseline releasable

- Reconcile migration history and the deployed schema in a disposable staging clone.
- Keep the now-clean lint and dependency-audit gates mandatory in CI.
- Remove or hard-bound production mock fallbacks.
- Establish real staging secrets, monitoring, backup/restore verification, and cross-tenant E2E fixtures.

### Phase 1 — certify tenant identity and access

- Exercise owner onboarding, organization selection, invitation acceptance/revocation, suspension, role changes, and branch/campus constraints with real Clerk test users.
- Audit all API routes and RPCs for server-derived organization scope and permission checks.
- Validate the implemented guardian reconciliation, rate limits, CSP/origin protections, audit events, and idempotency behavior in staging.
- Exit only when cross-tenant reads and writes fail at the route and database layers.

### First vertical slice — prove the core learning loop

Deliver and validate one complete path before broadening features: owner creates organization → invites teacher and student → creates course and batch → publishes content/assignment → student submits → teacher grades → student sees released result → attendance and notifications are recorded. Use the existing packages and screens; replace mocks only along this slice.

### Subsequent phases

1. Complete assessment lifecycle, secure result release, analytics, and exports.
2. Complete attendance corrections and reviewed guardian views.
3. Enable finance only after the payment processor, integer-paise ledger, webhook replay, refund, and reconciliation paths share one schema.
4. Add communications, CRM, AI drafting, and platform operations behind entitlement, quota, approval, and audit controls.
5. Finish operational hardening: accessibility, performance, disaster recovery, observability, retention, and support-access reviews.

Each phase should ship as a narrow, testable vertical slice with explicit exit evidence. Starting all modules simultaneously would add surface area before the tenancy and migration foundation is proven.

## Local validation evidence

| Check | Result on 2026-10-26 |
| --- | --- |
| Workspace unit tests | Passed: 79 tests across four tested packages. |
| Workspace TypeScript | Passed. |
| Static SQL integration script | Passed: 16/16 checks. |
| Focused lint for changed auth files | Passed. |
| Full web lint | Passed: zero errors and zero warnings. |
| Python backend tests | Passed: 13 tests in an isolated environment installed from `backend/requirements.txt`; one upstream Starlette/httpx deprecation warning remains. |
| Production dependency audit | Passed: zero known production vulnerabilities after upgrading Next.js to 16.4.3 and Zod to 4.6.7. |
| Migration-history audit | Passed locally: 24 files checked; the six known duplicate-version files match their recorded hashes. Deployed-ledger reconciliation remains open. |
| Production web build | Passed on Next.js 16.4.3 with the documented Webpack build mode (`next build --webpack`), including TypeScript and generation of 53 static pages. |
| Live/staging Supabase verification | Not performed; access to the deployed catalog was not assumed. |

Local success is not evidence that external migrations, identity-provider configuration, email/SMS delivery, payment webhooks, storage rules, or backups work in production.
