# Production-readiness report

As of 2026-10-17, PrepZii LMS is **not ready for paying customers or a controlled pilot**.

## Passing local gates

- `npm test`: 23 assessment/authorization/membership/CSV/learning-security/deadline tests passed.
- `npm run typecheck`: passed across all workspaces.
- `npm run lint`: passed with zero errors.
- `npm run build`: production Next.js build passed.
- Backend prototype: 13 pytest tests passed with one Starlette/httpx deprecation warning.
- `npm audit --omit=dev`: zero production dependency vulnerabilities.
- SQL tenant-isolation tests are authored but remain unverified until an isolated staging database is available.

## Blocking gates

- Production database shape has not been inspected or migrated in staging.
- The incompatible `institutes` migration definitions are unresolved.
- Many operational screens still use mock/local state; student/faculty directories and the core academic-structure screens now use authoritative APIs.
- Institute creation, secure invitations, member profile management, academic structure, enrolment, basic timetable, private course delivery, assignments, objective assessment attempts, attendance corrections, institute fee ledgers, atomic quotas, owner billing controls, and platform administration exist in code. Staging verification, descriptive grading, PDF receipts, payment-provider reconciliation, and automatic subscription transitions remain incomplete.
- Parent/guardian authorization model does not exist.
- Private learning and student-submission storage, upload controls, hashes, and signed access exist in code; staging policy validation, content inspection, and retention remain incomplete.
- Invitation replay protection and transaction-level invitation audit code exist but are unverified against staging; quotas and rate limiting remain incomplete.
- Python dependencies are not locked in a reproducible environment. The isolated suite passes (13 tests), with a Starlette/httpx deprecation warning that should be resolved before framework upgrades.
- No backup restore drill, staging validation, accessibility audit, or load test has been completed.

## Pilot admission criteria

All Phase 1 staging gates plus one complete vertical slice must pass: owner onboarding → staff/student invitation → real course/batch enrolment → real content access → real assessment attempt → attendance → fee record, with cross-tenant and permission tests at every boundary.
