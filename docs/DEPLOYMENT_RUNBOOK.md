# PrepZii LMS deployment runbook

This runbook is the release contract for staging and production. A release is not production-ready until every required gate has objective evidence attached to the release record.

## 1. Required configuration

Set `DEPLOYMENT_ENV` to `staging` or `production` and configure every required value in `.env.example`. Staging and production fail closed when identity, database, application URL, or invitation signing configuration is missing or unsafe. Razorpay must be either fully configured with the internal backend credentials or completely disabled.

Never enable `ALLOW_INSECURE_DEV_AUTH` outside local development. Production must use an HTTPS application URL, an HTTPS Supabase URL, a live Clerk key, and secrets generated with at least 256 bits of entropy.

## 2. Pre-deployment gates

Run from the repository root against the exact commit to deploy:

```bash
npm ci
npm test
npm run typecheck
npm run lint
npm run audit:migrations
npm run test:sql
npm run test:db
npm run test:e2e
npm audit --omit=dev
python -m pip install -r backend/requirements.txt
python -m pytest backend/tests -q
```

All commands must pass. Do not waive tenant-isolation, migration, browser, or dependency-audit failures.

## 3. Database rollout

1. Create an encrypted database backup and record its identifier.
2. Restore the backup into an isolated environment and verify it can be queried.
   For the automated disposable drill, set `DATABASE_URL`, `RECOVERY_DATABASE_URL`, and a deliberately named `RECOVERY_DATABASE_NAME` containing `recovery`, `restore`, or `test`, then run `npm run test:restore`.
3. Compare the staging migration ledger with `supabase/migrations` and the preserved incompatible branches in `supabase/legacy_migrations`; stop if an applied historical migration does not match the expected catalog.
4. Apply migrations to staging, then run `./scripts/run_database_tests.sh` against staging.
5. Exercise two real organizations and prove that users from organization A cannot read or mutate organization B data.
6. Apply the same immutable migration set to production during the approved window.

Every tenant-owned table must contain `organization_id` (or the explicitly retained legacy `institute_id`) and enforce row-level security. Browser-supplied organization identifiers must never be trusted without authenticated membership verification.

## 4. Staging acceptance

Complete the full role-based path with production-like identity and database providers:

- Owner creates an institute and invites an administrator, teacher, student, and guardian.
- Administrator creates campus, batch, course, schedule, lead, fee plan, and attendance session.
- Teacher publishes course material, creates an assignment and assessment, and grades a submission.
- Student can access only assigned content and submit only their own work.
- Guardian can access only linked students.
- A second organization cannot access any first-organization route or API response.
- `/api/health` returns `200`; `/api/ready` returns `200` only while configuration and database access are healthy.
- Legacy unscoped tenant API paths return `410` in staging/production.

Verify keyboard navigation, visible focus, mobile navigation, screen-reader labels, and acceptable response times on the slowest supported device/network profile.

## 5. Payments and subscriptions

Keep Razorpay disabled until webhook signature verification, idempotency, duplicate delivery, delayed delivery, refund, chargeback, and ledger reconciliation tests all pass in the provider's staging environment. A successful checkout UI alone is not payment readiness.

## 6. Monitoring and operations

Configure the platform to poll `/api/health` for liveness and `/api/ready` for readiness. Alert on sustained 5xx responses, readiness failures, authentication anomalies, invitation abuse, webhook failures, and elevated database latency. Centralize server logs without recording tokens, credentials, payment details, or student private data.

Define owners and response targets for security, identity, database, payment, and availability incidents. Test alert delivery before launch.

## 7. Rollback

For an application regression, route traffic to the last verified immutable build. For a data regression, stop writes, preserve logs, and follow the tested restore procedure; never reverse a destructive schema change without a reviewed recovery plan. After rollback, verify `/api/ready`, authentication, tenant isolation, and one read/write workflow before reopening traffic.

## 8. Release evidence

The release record must include the Git commit, CI run, staging acceptance results, migration ledger comparison, backup and restore-drill identifiers, security/a11y/load-test results, monitoring screenshots, and named release approver. Missing evidence means the release remains blocked.
