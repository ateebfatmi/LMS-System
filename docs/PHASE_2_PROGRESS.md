# Phase 2 progress report

Date: 2026-10-17

## Implemented in code

- Transactional institute creation with owner membership, trial subscription, audit record, and retry serialization.
- Real organization selection backed by server-verified Clerk membership and an HTTP-only context cookie.
- Secure organization invitations with service-only database RPCs.
- Deterministic HMAC invitation tokens for safe idempotent retries; only SHA-256 token digests are persisted.
- Role grant checks that prevent owner or platform-admin escalation.
- Expiry, revocation, accepted state, verified-email acceptance, replay handling, membership activation, and audit records.
- A real members/invitations screen and invitation acceptance screen.
- Tenant-bound student/faculty profiles with composite membership foreign keys.
- Paginated and searchable directory APIs with audited profile/status edits.
- Student and faculty screens backed by authoritative data instead of mock arrays.
- RFC-style quoted CSV parsing with schema and row-level validation.
- Tenant-owned, service-only import staging with atomic and idempotent commit.
- Imported identities remain pending until verified-email invitation acceptance.

## Verified locally

- 13 shared-package tests pass.
- Type checking and lint pass across all workspaces.
- Next.js 16 production build passes.

## External gate

Migrations `0007`–`0009` have not been applied. They must be exercised with migrations `0005` and `0006` on an isolated Supabase clone, including concurrent invitation/import requests, cross-tenant profile/import relationships, pagination, search, duplicate identifiers, invalid CSV rows, and repeated commits.

## Next slice

Build real courses, batches, enrolments, academic sessions, branches, and the basic timetable, replacing mock pages one bounded workflow at a time.
