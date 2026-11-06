# Faculty onboarding rollout

Apply [migration 0027](../supabase/migrations/0027_faculty_onboarding.sql) through the numbered migration chain after 0026. Rehearse on a disposable database before deploying the application to staging. The consolidated production bundle in this checkout ends at 0023.

- The migration extends `organization_batch_members` to support a tenant-scoped pending teacher assignment. It adds no teacher or membership table. Successful acceptance moves the pending rows to the verified Clerk ID in the same transaction. Existing batch access checks continue to use that Clerk ID.
- The directory uses the LMS `organization_batches` catalogue. Before rollout, check institutes still using only the shared consumer `institute_batches` catalogue and reconcile their batches into the LMS through the existing academic workflow. The migration does not copy legacy batches or duplicate academic data.
- Rehearse with the hosted schema’s member status, email uniqueness, and batch constraints. Older faculty records whose IDs match the LMS-generated `usr_` plus 32 hexadecimal digits appear as Pending. A verified invitation for the same email links the original record and carries over its LMS batch assignments and timetable slots. Verify this with representative staging records.
- The existing `INVITATION_TOKEN_SECRET` signs invitations. Secure links can be copied from Faculty even when email delivery is unavailable. To enable email, configure `RESEND_API_KEY`, a verified `FACULTY_INVITATION_FROM_EMAIL` sender, and the staging or production `NEXT_PUBLIC_APP_URL`. Never copy production credentials into the staging fixture.
- Deploy the new app after the migration. For an app rollback, retain the schema and activation function so previously created pending assignments can still be activated. Do not remove the added column or tighten its null constraint while pending assignments exist.

## Verification

Run `bash scripts/test-role-database.sh` for the disposable PostgreSQL migration rehearsal, including duplicate email and invitation prevention, same-record activation, pending assignment transfer, legacy placeholder repair, and assigned-batch authorization.

For the real application flow, use the isolated Clerk and Supabase setup in [the role staging runbook](ROLE_STAGING_VERIFICATION.md). Add a `facultyOnboarding` object to the external fixture manifest.

| Field | Staging fixture |
| --- | --- |
| `email` | A verified Clerk primary email with no existing membership at the owner’s institute |
| `storageState` | Absolute path to this teacher’s signed-in Playwright state |
| `batchName` | Exact name of an assignable LMS batch in the owner’s institute |
| `unassignedBatchId` | ID of a different LMS batch at the same institute |
| `unassignedBatchName` | Exact name of that unassigned batch |

The test creates and activates a real staging teacher. Use a fresh disposable teacher identity for each run. It verifies acceptance with the matching Clerk account, rejects the wrong email, and checks My Batches and direct access to an unassigned batch. To verify email delivery separately, use a test inbox you control, select **Email invitation**, and verify that the received link opens the intended staging institute. The automated test uses **Get secure link**.
