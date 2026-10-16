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

## Verified locally

- 13 shared-package tests pass.
- Type checking and lint pass across all workspaces.
- Next.js 16 production build passes.

## External gate

Migration `0007_organization_invitations.sql` has not been applied. It must be exercised with migrations `0005` and `0006` on an isolated Supabase clone, including concurrent create/accept/revoke requests and Clerk identities with matching and non-matching verified emails.

## Next slice

Build tenant-scoped member/profile APIs with pagination and search, then replace the mock student and staff directories. CSV imports follow after the single-record persistence path is verified.
