# Role implementation status

The rebase retains the core LMS workspaces and separate institute, faculty/student, and platform sign-in portals. Admissions, fees, and parent/guardian workspaces remain outside the V1 product scope. See [product scope](PRODUCT_SCOPE.md).

The organization APIs now resolve permissions from the caller’s active institute membership. The active workspace cookie is revalidated on read and write. A sole eligible workspace is selected automatically; users with multiple eligible workspaces can select one in the workspace switcher.

The academic, attendance, assessment, analytics, and announcement handlers check assigned batches or student ownership where applicable. Student assessment responses hide results and solutions until release. Migrations 0024 and 0025 enforce membership transition rules, restrict direct database access, and preserve the data for features outside V1.

Run `npm test`, `npm run typecheck`, the Playwright suite, and `bash scripts/test-role-database.sh` before release. Authenticated Clerk flows and compatibility with the shared Supabase schema require an isolated staging environment.
