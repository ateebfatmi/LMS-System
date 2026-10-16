# Production-readiness report

As of 2026-10-17, PrepZii LMS is **not ready for paying customers or a controlled pilot**.

## Passing local gates

- `npm test`: 16 assessment/authorization/membership/CSV tests passed.
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
- Institute creation, secure invitations, member profile management, academic structure, enrolment, and basic timetable operations exist in code, but staging verification, course delivery, test attempt, attendance, fee, and subscription workflows are incomplete.
- Parent/guardian authorization model does not exist.
- Private file storage and upload controls do not exist.
- Invitation replay protection and transaction-level invitation audit code exist but are unverified against staging; quotas and rate limiting remain incomplete.
- Python dependencies are not locked in a reproducible environment. The isolated suite passes (13 tests), with a Starlette/httpx deprecation warning that should be resolved before framework upgrades.
- No backup restore drill, staging validation, accessibility audit, or load test has been completed.

## Pilot admission criteria

All Phase 1 staging gates plus one complete vertical slice must pass: owner onboarding → staff/student invitation → real course/batch enrolment → real content access → real assessment attempt → attendance → fee record, with cross-tenant and permission tests at every boundary.
