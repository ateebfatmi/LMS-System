# Staging verification for institute roles

1. Use an isolated staging Clerk instance and Supabase database. Rehearse migrations 0024 and 0025 on a disposable copy of the shared schema and verify the consumer app’s institute and member workflows against the revised grants.
2. Provision two institutes, one owner, one coaching admin, one teacher, one student, one parent, and a separate account with a suspended membership. Give the teacher a coaching admin membership in the second institute and identify an unassigned batch in the first.
3. Capture a Playwright storage-state file for each identity. Keep these files outside the repository. Set `PREPZII_ROLE_STAGING_URL` and `PREPZII_ROLE_STAGING_FIXTURES` (absolute manifest path), then run `npx playwright test --config=playwright.role-staging.config.ts`.
4. The manifest must provide `origin`, `accounts` keyed by `OWNER`, `COACHING_ADMIN`, `TEACHER`, `STUDENT`, and `PARENT`, `suspended`, `forbiddenSlug`, and `teacherUnassignedBatchId`. Each actor has an absolute `storageState` path and a `workspace` slug. The teacher also needs a `secondaryWorkspace` object with its `slug` and `userRole`.
5. Check that onboarding and invitation acceptance still work, and confirm students cannot see unreleased assessment marks or solutions. Run `bash scripts/test-role-database.sh` for local membership transition, tenant isolation, and grant coverage.
