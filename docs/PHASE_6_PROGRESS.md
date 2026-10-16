# Phase 6 progress — commercial SaaS

Status date: 2026-10-17

## Implemented in code

- Plans expose configurable monthly/annual paise prices, student/campus/storage/AI limits, and feature entitlements.
- Canonical membership and campus tables enforce quotas under PostgreSQL advisory locks, closing parallel-request bypasses.
- Metered AI/storage/communication usage has an idempotent, service-only monthly counter with trial and grace checks.
- Owners can inspect real usage, request a plan change, schedule cancellation, and configure branding. Requested paid access is never activated by the browser.
- Unique subdomains are registered but remain unverified/inactive until a platform verification workflow exists.
- Super-admin data and actions use an allowlisted API. Institute suspension, plan updates, and feature flags are persisted and platform-audited.
- Support access requests have explicit status, approval, expiry, and revocation fields; the schema grants no tenant-content access by itself.

## Verification completed

- TypeScript, scoped ESLint, and the Next.js production build pass.
- The SQL isolation script now checks quota replay idempotency and tenant-scoped usage/branding visibility.
- Database execution and quota concurrency remain unverified because there is no isolated Supabase clone.

## Remaining before production

- Rehearse migration `0016_saas_entitlements_admin.sql`, including existing-tenant quota compatibility and lock contention.
- Connect verified Razorpay subscription events to activation, renewal, past-due, grace, downgrade, and cancellation transitions.
- Add SaaS invoice/tax document generation and reconciliation without mixing it with institute fee revenue.
- Implement approved, time-limited support access with prominent tenant visibility and revocation.
- Verify custom host ownership before routing any hostname to a tenant.
