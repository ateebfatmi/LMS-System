# Architecture

## Product boundary

Prepzii for Institutions has its own repository and deployment, but deliberately uses the same Clerk instance, Supabase project, users, content, and assessment records as consumer Prepzii. It does not import files from the consumer application's `src/` tree.

```text
Consumer Prepzii ─────┬── shared Clerk instance
                     ├── shared Supabase project and question bank
Prepzii B2B ─────────┴── versioned @prepzii packages
                               │
                               └── B2B tables with organization-scoped RLS
```

The package registry is the integration boundary. Packages are versioned and released; applications upgrade intentionally. This prevents a consumer deployment from silently changing the institutional product.

## Tenant resolution

1. Authentication establishes the user through Prepzii's existing Clerk instance.
2. Server code resolves the requested `institutes.slug` and verifies `owner_user_id` or an active `institute_members` row.
3. The B2B `organization_id` is the existing `institutes.id`; no duplicate organization registry is introduced.
4. User-scoped queries run with the Clerk/Supabase JWT and Postgres RLS verifies membership.
5. Service-role access is restricted to server routes and background jobs that verify membership before querying an organization.

Subdomains such as `acme.prepzii.com` can later select the organization, but a hostname is context—not authorization.

## Initial bounded contexts

- Identity: organizations, campuses, memberships, roles
- Academics: academic years, batches, subjects, enrollments
- Learning: courses, lessons, assignments
- Assessment: question references, tests, attempts, grading
- Communication: announcements and notifications
- Reporting: derived aggregates; never the system of record

## Deployment

The web app can deploy independently to Vercel. Its environment must reference the same Clerk and Supabase projects as consumer Prepzii. Migrations are additive and run against the shared Prepzii database; destructive ownership changes require coordinated releases across both applications.

## Existing Prepzii tables reused directly

- `institutes` — canonical organization/tenant registry
- `institute_members` — membership and role lookup
- `institute_batches` and `institute_batch_members` — current batch model
- `institute_tests`, assignments, questions, and attempts — assessment workflow
- `questions`, `pyq_questions`, and related exam content — shared content library
- `user_profiles`, `test_sessions`, and `test_attempts` — shared learner identity and history

New LMS capabilities such as campuses, academic years, subjects, and courses extend this backend rather than duplicating it.
