# PrepZii LMS

PrepZii LMS is a separate multi-tenant B2B learning and institute-management application for Indian schools, coaching institutes, and tutors. It shares selected PrepZii infrastructure—Clerk identity, the canonical Supabase tenant/question data, assessment rules, storage, and Gemini configuration—without importing the consumer web application.

The repository is an implementation candidate for isolated staging. It is **not yet approved for production or paying customers**; see [Production readiness](docs/PRODUCTION_READINESS.md).

## Implemented application slices

- Tenant onboarding, active-institute selection, memberships, hashed invitations, and CSV imports.
- Permission-based server authorization, RLS migrations, composite tenant constraints, and audit records.
- Student/faculty directories, academic years, campuses, rooms, courses, batches, enrolment, and conflict-safe timetable slots.
- Private learning resources, signed downloads, lesson progress, assignments, submissions, feedback, and grading.
- PrepZii question/test reuse, server-timed objective attempts, autosave, scoring, and result/solution release controls.
- Session attendance with assigned-teacher scope and immutable correction history.
- Institute fee plans, instalments, concessions, invoices, manual payments/refunds, and separate SaaS subscription controls.
- Portal announcements/notifications and quota-metered, review-only Gemini drafts.
- Role-scoped dashboards/reports and owner/admin-only audited admissions CRM.
- Server-allowlisted platform administration, entitlements, branding, quotas, and feature flags.

External delivery, payment reconciliation, parent data, subjective grading, PDF documents, and staging verification are explicitly gated—not simulated.

## Repository layout

```text
apps/web/                 Next.js 16 application and route handlers
packages/authorization/  Shared permission evaluation
packages/assessment-core Shared deterministic objective scoring
packages/contracts/      Shared domain contracts
packages/learning/       Learning validation and release rules
packages/membership/     Invitation and CSV rules
packages/ui/             Shared UI primitives
supabase/migrations/     Additive LMS migrations (0001–0018)
supabase/tests/          Transactional tenant-isolation test
backend/                 Optional, non-authoritative FastAPI prototype
docs/                    Architecture, audit, phases, and readiness evidence
```

## Local checks

Use Node.js 22 or newer.

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run build
```

The optional backend test environment is separate:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt
.venv/bin/python -m pytest backend/tests -q
```

Copy `.env.example` to `.env.local` for local configuration. Never commit real credentials or point SQL tests at production.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Codebase audit](docs/CODEBASE_AUDIT.md)
- [Implementation plan](docs/IMPLEMENTATION_PLAN.md)
- [Phase 8 staging handoff](docs/PHASE_8_READINESS.md)
- [Production readiness](docs/PRODUCTION_READINESS.md)
- [Deployment guide](DEPLOYMENT.md)
- [Operations, backup, recovery, and release checklist](docs/OPERATIONS.md)

## Safety boundary

The two historical PrepZii `institutes` table definitions conflict. Inspect the actual deployed schema and rehearse all migrations on a disposable clone before applying anything. `supabase/tests/tenant_isolation.sql` intentionally creates and rolls back fixtures; it must never run against production.
