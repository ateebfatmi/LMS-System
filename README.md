# Prepzii for Institutions

An independent, multi-tenant LMS for schools and coaching institutes. This repository is deliberately separate from the consumer Prepzii application while exposing narrow packages that both products can consume.

## What is included

- A Next.js 16 institutional dashboard shell
- Multi-tenant domain contracts in `@prepzii/contracts`
- Framework-independent grading in `@prepzii/assessment-core`
- Shared React primitives in `@prepzii/ui`
- An additive Supabase migration for Prepzii's existing backend with tenant-scoped RLS
- Architecture and package-sharing decisions under `docs/`

## Start locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The dashboard uses representative data until the existing Prepzii Clerk and Supabase credentials are configured. This app must point to the same backend as consumer Prepzii.

## Repository layout

```text
apps/web                     Institutional web application
packages/contracts           Shared roles and domain types
packages/assessment-core     Pure assessment and scoring logic
packages/ui                  Shared Prepzii UI primitives
supabase/migrations          Tenant-safe database schema and policies
docs                         Architecture and extraction notes
```

## Non-negotiable tenant rule

Every new institution-owned row carries an `organization_id`, which references the existing `institutes.id`. Existing Prepzii tables retain their current `institute_id` columns for compatibility. Database RLS and server-side membership checks are the final enforcement layers; UI filtering is never treated as authorization.
