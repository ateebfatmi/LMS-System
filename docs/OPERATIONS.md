# Operations, backup, recovery, and release checklist

## Environment separation

Development, staging, and production must use separate deployment configuration and provider credentials. Staging must use a disposable or scrubbed database clone and test identities. Production service-role, Clerk, database, invitation, payment, and AI secrets must be stored in a managed secret store with least-privilege access and a documented rotation owner.

## Backup and recovery

Before any database release:

1. Record the database version, migration head, object-storage policy version, application commit, and provider configuration.
2. Create a Supabase/PostgreSQL backup that includes schema, data, roles/policies, and required extensions.
3. Export storage-object metadata and verify the object store’s retention/versioning configuration independently.
4. Restore the backup into an isolated project and run health checks plus a representative tenant workflow.
5. Record backup start/end time, restore duration, row-count checks, responsible operator, and evidence location.

Recovery procedure:

1. Freeze mutating traffic and provider webhooks; preserve inbound events for replay.
2. Identify the last verified restore point and affected tenant/time range.
3. Restore into an isolated target, validate tenant counts, memberships, financial totals, assessment attempts, and audit continuity.
4. Switch traffic only after two-person review. Rotate potentially exposed credentials.
5. Replay only signature-verified, idempotent provider events, then publish an incident record and corrective migration if required.

Never test restoration by overwriting the live database.

## Observability minimum

- Availability and latency for the web application, `/api/health`, database, storage, and provider adapters.
- Structured request logs with request ID, route, status, duration, and tenant-safe identifiers; never log tokens, answers, raw personal documents, service keys, or full payment payloads.
- Alerts for authentication/authorization spikes, RLS/query failures, webhook signature failures, failed background jobs, quota anomalies, database saturation, and backup failures.
- Error tracking with source maps kept private and personal data scrubbed.
- An operator runbook for institute suspension, compromised accounts, provider outage, data export/deletion, and security escalation.

## Release checklist

- [ ] Release commit is reviewed and immutable.
- [ ] `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, dependency audit, and backend tests pass in CI.
- [ ] Migrations apply cleanly to the current staging clone and SQL tenant-isolation tests pass.
- [ ] Required browser E2E and accessibility checks pass against staging.
- [ ] Backup restore drill completed within the accepted recovery objective.
- [ ] RLS, composite keys, service-only functions, storage access, and role navigation reviewed.
- [ ] Payment/communication/AI providers either pass sandbox verification or remain disabled with honest UI state.
- [ ] Rate limits, quotas, timeouts, retry/idempotency behavior, and failure recovery exercised.
- [ ] Monitoring dashboards, alerts, on-call owner, rollback criteria, and incident contacts are active.
- [ ] Data retention/deletion and DPDP/legal review are approved.
- [ ] Known limitations and support escalation are communicated to pilot tenants.
- [ ] A named approver records go/no-go and the evidence links.

## Rollback criteria

Stop or roll back a release for cross-tenant visibility, privilege escalation, incorrect assessment scoring, duplicate/incorrect financial entries, broken membership enforcement, failed migration constraints, material error-rate regression, or unavailable recovery evidence. Application rollback may use the prior immutable build only when its schema is compatible. Database changes use a reviewed forward corrective migration or restoration from the verified backup; do not run destructive ad-hoc SQL.
