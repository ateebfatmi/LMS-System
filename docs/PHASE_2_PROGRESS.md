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

## Verified locally

- 13 shared-package tests pass.
- Type checking and lint pass across all workspaces.
- Next.js 16 production build passes.

## External gate

Migrations `0007_organization_invitations.sql` and `0008_member_profiles_directory.sql` have not been applied. They must be exercised with migrations `0005` and `0006` on an isolated Supabase clone, including concurrent invitation requests, cross-tenant profile relationships, pagination, search, and duplicate roll/employee codes.

## Next slice

Build staged CSV imports with validation reports and an idempotent commit path, using the verified single-record profile schema as the destination.
