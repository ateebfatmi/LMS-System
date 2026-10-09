# Sharing code with consumer Prepzii

The existing consumer project is a single application, so importing its internal files would create fragile cross-repository coupling. Shared code starts behind these packages:

| Package | Allowed contents | Must not contain |
| --- | --- | --- |
| `@prepzii/contracts` | Roles, IDs, assessment/domain types | Database clients, secrets, React |
| `@prepzii/assessment-core` | Pure scoring and grading rules | Tenant queries, UI, framework code |
| `@prepzii/ui` | Brand tokens and accessible primitives | Product-specific pages or data fetching |

During local development these are npm workspaces. For real sharing, publish them to a private registry from this repository, then pin exact compatible versions in both applications. Do not use relative paths that escape either repository.

## Suggested extraction sequence

1. Compare the consumer question/test models with `@prepzii/contracts` and add compatibility adapters.
2. Move only framework-independent grading behavior into `@prepzii/assessment-core` and prove parity with fixtures.
3. Move low-level brand primitives into `@prepzii/ui`; keep dashboards and feature components product-owned.
4. Publish a prerelease, migrate consumer Prepzii, then promote a stable version.

No consumer source was copied into this repository. This avoids carrying over application-specific authentication, payment, community, or student-state assumptions.

