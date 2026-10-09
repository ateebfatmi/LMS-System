# Architecture

## Product boundary

Prepzii for Institutions has its own repository, deployment, authentication surface, and database schema. It does not import files from the consumer application's `src/` tree.

```text
Consumer Prepzii ─────┐
                     ├── versioned @prepzii packages
Prepzii B2B ─────────┘
        │
        ├── Clerk organizations and memberships
        └── Supabase Postgres with organization-scoped RLS
```

The package registry is the integration boundary. Packages are versioned and released; applications upgrade intentionally. This prevents a consumer deployment from silently changing the institutional product.

## Tenant resolution

1. Authentication establishes the user and active Clerk organization.
2. Server code maps the external organization ID to `organizations.id`.
3. Queries run with the user's JWT and Postgres RLS verifies membership.
4. Service-role access is restricted to background jobs with explicit organization scope.

Subdomains such as `acme.prepzii.com` can later select the organization, but a hostname is context—not authorization.

## Initial bounded contexts

- Identity: organizations, campuses, memberships, roles
- Academics: academic years, batches, subjects, enrollments
- Learning: courses, lessons, assignments
- Assessment: question references, tests, attempts, grading
- Communication: announcements and notifications
- Reporting: derived aggregates; never the system of record

## Deployment

The web app can deploy independently to Vercel. Supabase migrations should run in CI against a dedicated B2B project. Consumer Prepzii credentials must not be copied into this repository.

