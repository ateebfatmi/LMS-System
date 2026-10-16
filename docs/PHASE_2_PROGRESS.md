# Phase 2 progress — core institute operations

Status date: 2026-10-17

Phase 2 is implemented in application and migration code. It is not production-certified until migrations `0001`–`0010` and the SQL isolation suite pass on an isolated clone of the shared PrepZii Supabase schema.

## Delivered

- Retry-safe institute onboarding with an owner membership, trial, and audit event in one transaction.
- Hashed, expiring, verified-email invitations with revoke and idempotent acceptance.
- Membership-backed active-institute switching; the browser-selected slug is re-authorized on every request.
- Tenant-scoped student and faculty profiles, search, pagination, edits, and real directory screens.
- Staged CSV student/teacher imports with validation reports and idempotent commit.
- Academic years, campuses, subjects, courses, batches, and member enrolments through one service-only audited mutation boundary.
- Campus rooms and weekly timetable slots with database-level room, batch, and faculty overlap prevention.
- Real batches, courses, and campuses screens with loading, error, and empty states.

## Security properties

- Every new tenant-owned record carries `organization_id` and is covered by RLS.
- Parent/child tenant identity is enforced with composite foreign keys.
- Route handlers resolve Clerk identity and active membership server-side before using the service role.
- Sensitive writes and imports create persistent audit records.
- Cross-tenant profile, import, course, room, batch, and timetable relationships are represented in the SQL isolation suite.

## External gate

The shared database contains historically incompatible `institutes` migration definitions. Before deployment, inspect a scrubbed staging clone, reconcile that collision, apply all migrations in order, run `supabase/tests/tenant_isolation.sql`, and exercise onboarding/invitation/import concurrency with Clerk test identities.

The next implementation phase is learning delivery: modules, lessons, private resources, signed access, release rules, and student progress.
