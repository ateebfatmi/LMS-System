# Prepzii LMS role dashboards

## Implementation and audit

| Phase | Existing functionality reused | Changes |
| --- | --- | --- |
| 1. Sign-in | Clerk session, founder allowlist, active institute resolution, workspace selector, branding and dashboard shell | Founders land in `/super-admin` even after a tenant dashboard deep link. Invitation continuations remain available. The active-workspace response includes server-resolved permissions for navigation. Owner and manager overviews have distinct headings. Logout returns to common sign-in. Multiple institutes use the existing selector. Ambiguous memberships within one institute fail closed. |
| 2. Platform | Institute directory, owner invitations, subscriptions, lifecycle mutations and audit log | Overview shows persisted counts and recent provisioning events. Removed invented telemetry and estimated revenue. The institute inspector shows role counts instead of a cross-tenant student directory. Owner invitation controls are available in the directory, inspector, and Invitations section. Platform support requests require owner review and grant no tenant-record access. |
| 3. Owner and manager | Branding, faculty, memberships, academic operations, attendance, subscription and announcement modules | Admissions and Fees now have live pages and authorized APIs using the existing transactional CRM and finance RPCs. Managers can manage enquiries and permitted student fees without owner subscription controls. Owner Settings includes guardian and platform support reviews. |
| 4. Teacher | Assigned batches, faculty scope, student enrollment/invites, assignment and assessment workspaces | Overview shows published test windows, assigned class schedule and assignment tasks. Attendance lists active students enrolled in the selected batch. Assessment grading and manual releases verify teacher ownership and assignment scope. |
| 5. Student | Assigned courses, published materials, assessment attempt runner, server grading, attendance and announcements | Overview shows upcoming tests and pending assignments. Added personal fee installments. Answer saves are serialized on the client and bound to the test URL server-side. Timed-out finalization uses saved answers. Marks and solutions follow separate policies. Students cannot call the staff question bank or see unreleased descriptive grading data. |
| 6. Parent | Reviewed guardian links and original owner approval workflow | Child selector uses only approved links. A single scoped database query supplies recent attendance, released assessment results and installment balances. No child identifier from the browser grants access. The latest published announcements appear in the dashboard and link to the existing announcements workspace. |
| 7. Connected verification | Existing SQL rehearsal, unit tests, role staging suite and local Chrome tests | The local SQL integration test starts with institute creation and verified-identity fixtures, then exercises invitations, a teacher-created assessment, saves, finalization, release, attendance, fees and guardian revocation in one disposable database. |

## Files and API boundaries

- Sign-in and navigation changes are in `apps/web/src/app/auth/resolve/route.ts`, `api/organizations/active/route.ts`, `components/dashboard-layout.tsx`, `components/ui/dashboard-sidebar.tsx`, and `lib/client-org.ts` under the web app source tree.
- Platform changes are in `api/platform/route.ts` and `components/platform-admin-workspace.tsx`. Its reads require the server-side Clerk allowlist and return aggregate access counts. Founder actions still use the existing audited invite, lifecycle and subscription operations.
- `GET/POST /api/organizations/{slug}/admissions` lists enquiries with pagination, creates enquiries, and updates stage or follow-up date. It uses `lms_crm_mutation`. Enrolment remains the existing reviewed student workflow. Lead conversion remains outside this CRM UI.
- `GET/POST /api/organizations/{slug}/fees` exposes a paginated ledger and existing `lms_finance_mutation` plan, assignment, and payment operations. Students receive only their own ledger. Offline receipts can be recorded. Provider payments are outside this dashboard.
- `GET/POST /api/organizations/{slug}/support` lets owners review platform requests. Existing approval records alone confer no access to private data.
- `assessments/route.ts`, `assessments/[testId]/attempt/route.ts`, `question-bank/route.ts`, `attendance/route.ts` and `analytics/route.ts` under the organization API use existing actor and tenant resolution. Assessment scoring still uses the shared assessment package. The database regression supplies a known grade to test persistence and release, and unit tests exercise the grading algorithm.
- `GET /api/organizations/{slug}/guardians` derives parent scope from the authenticated user and calls `lms_guardian_dashboard`. `POST` still uses the reviewed owner workflow. The dashboard renders with `components/guardian-access.tsx` and `components/analytics-workspace.tsx`.
- New page and UI files are under `dashboard/admissions`, `dashboard/fees/workspace`, and `components/{admissions-workspace,fees-workspace,support-requests}.tsx`. Legacy admissions and fees URL aliases use the dashboard routes.

## Database and production rollout

Migration `0029_dashboard_workflow_guards.sql` updates existing LMS assessment and support functions and adds a service-only scoped read function for guardians. It adds no table or broad grant. Rehearse the full numbered chain on a disposable copy of the hosted schema. Verify 0020, 0021, 0026, and 0028 independently. Check the existing shared-table and RLS prerequisites and the unresolved consumer membership-activation issue before release. This patch does not modify the consumer application.

Keep Clerk Invite-only configuration and the two verified founder IDs in the LMS environment. Supply an authorized staging URL and external role fixture manifest for `playwright.role-staging.config.ts`. Run the suite with both founders and signed-in owner, manager, teacher, student and guardian sessions. Exercise actual invitation email, Clerk activation and logout, then validate the assessment, attendance and fee journey through staging HTTP and browser UI. Hosted staging was not available in this session. No hosted migrations or deployments were performed.

## Verification results

- All 88 workspace unit tests, web type checking and lint passed locally.
- The local production-mode Next.js build passed on an isolated source copy with hosted credentials omitted.
- The disposable PostgreSQL rehearsal through 0029 passed, including existing tenant isolation, role membership, faculty onboarding and branding tests. The connected test uses seeded test identities and real database writes, including approval and revocation of guardian data, batch-scoped marks and solutions release, attendance, and fee balances.
- All 34 Chrome tests passed on the isolated local app. UI fixture tests intercept APIs and do not verify hosted data or live Clerk sessions. The first run had one stale URL smoke-test assertion for the unsigned local preview. The assertion was updated to expect the access-required state.
- Release readiness is pending hosted-schema review and real authenticated staging verification. Descriptive evaluation uses the existing grading queue. The assessment runner still supports the existing objective question formats. The fee assignment form searches active students, batches and plans, with up to 100 results per search.
