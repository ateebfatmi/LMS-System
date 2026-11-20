# PrepZii Super Admin production rollout for approval

The supplied production catalog matches the LMS schema through `0023` for the compared relations, routine definitions, policies, and relevant constraints and indexes. Each of `0024` through `0030` is pending. The catalog has no migration history table, so the reconciliation uses actual object definitions, function hashes, dependencies, and grants. The numbered SQL can run as written, with no separate schema-reconciliation SQL or migration-history repair in this rollout.

## Production evidence

The export shows zero incompatible invitation roles, duplicate pending owner groups, pending legacy parent invitations, or batch assignments with a null user ID. It shows one active `basic` plan. It also confirms the composite member key `(id, institute_id)`, both legacy policies that `0025` replaces, the legacy invitation-role and announcement-audience checks, and a text institute owner ID suitable for the pending-owner placeholder.

The existing `organization_test_schedule_test_org_fk` is `NOT VALID` in both the hosted catalog and the canonical baseline. This rollout leaves its validation state intact. Supabase Storage has the expected bucket foreign key under its own constraint name. No dependent views were reported for the four audited shared tables.

| Run | Evidence and effect |
| --- | --- |
| [0024 membership transition guards](../supabase/migrations/0024_membership_transition_guards.sql) | Production hashes for `lms_create_institute`, `lms_accept_invitation`, and `lms_update_member_profile` match pre-`0024` definitions. This updates identity and invitation transitions and removes browser execution grants for those three routines. |
| [0025 workspace resource policies](../supabase/migrations/0025_workspace_resource_policies.sql) | The earlier role and guardian helpers and resource policies are present. The replacement policies and the assigned-teacher, fee overview, and guardian-review helpers are absent. This also removes browser execution grants from the listed server-only LMS RPCs. |
| [0026 branding](../supabase/migrations/0026_institute_dashboard_branding.sql) | The logo path column, scoped logo constraint, branding RPC, storage policy, and `organization-branding` bucket are absent. This creates a separate private branding bucket. |
| [0027 faculty onboarding](../supabase/migrations/0027_faculty_onboarding.sql) | Pending-teacher assignment support, the three faculty RPCs, and their assignment policies, constraints and index are absent. This creates the assignment constraint that `0028` replaces. |
| [0028 invite-only provisioning](../supabase/migrations/0028_invite_only_provisioning.sql) | The three invitation columns, pending-student column, owner/provisioning and scoped guardian/student RPCs and indexes are absent. This installs the new acceptance workflow and provides the provisioning routines used by `0030`. |
| [0029 dashboard workflow guards](../supabase/migrations/0029_dashboard_workflow_guards.sql) | The guardian-dashboard RPC is absent. The five assessment and support routines have their earlier definitions. This replaces those routines after the invitation and membership changes. |
| [0030 platform workflows](../supabase/migrations/0030_platform_workflows.sql) | Atomic institute provisioning and the platform broadcast RPC are absent, along with the student announcement policies. This combines initial institute, subscription, owner invitation and audit writes, and adds scoped broadcasts. |

## Consumer compatibility and risks

- Production confirms `service_role` has `BYPASSRLS` and retains select, insert, update and delete on the reviewed shared tables. The consumer checkout at `a19792f` uses that server-side client for institute creation, membership lookup and student staging, batch assignment and institute assessments. Its existing legacy `COACHING_ADMIN` owner membership remains compatible. The disposable rehearsal covered those service-role paths after `0030`, and all 14 consumer identity tests passed.
- Production currently grants both `anon` and `authenticated` execution on privileged LMS routines including `lms_platform_mutation`, `lms_create_institute`, and `lms_accept_invitation`. `0024` and `0025` remove execution grants from the browser roles for the routines listed in those files. A direct browser caller of any of those routines would lose access. The reviewed consumer source has no such calls. Some older LMS routine grants lie outside the revocation lists, including the rate-limit, doubt, and student-success routines. They remain outside this approval scope.
- `0025` revokes browser writes to `institutes` and `institute_members` and adds restrictive RLS for identity and other tenant resources. It replaces direct authenticated grading-column access with a safe column allowlist. Production reports no explicit column ACLs on the audited shared identity and assessment tables. Run consumer and cross-tenant smoke checks before taking LMS traffic.
- `0026` creates a previously absent private bucket. The consumer image route uses a different bucket, `pyq-images`. `0027` and `0028` validate tenant-scoped pending assignments and enforce owner invitation uniqueness. `0029` replaces live assessment and support workflows. `0030` restricts student-only announcement visibility. Constraint and index operations can contend with active queries, so apply in a low-traffic window with a recovery checkpoint.
- The seven files perform no rollout-time deletes or rewrites of existing institutes, users, memberships, subscriptions or academic records. A seeded before/after comparison passed across all seven migrations. The new routines can transition real records when called later as part of their intended workflows.

## Approval and execution

The user approved the seven files above in order for the PrepZii production database, subject to the pre-execution checks. The exact [psql rollout entry point](../supabase/rollouts/super_admin_0024_to_0030.psql) includes those canonical files in that order. It checks the audited baseline and row prerequisites in a read-only transaction first, uses a five-second lock timeout for migration statements, and stops on the first SQL error. Each migration owns its transaction. If a file fails after earlier commits, capture the new catalog before choosing where to resume. The old consolidated bundle is outside the approval scope.

Before execution, confirm the recovery checkpoint, authorized production connection, and release window. Recheck the catalog against the export if the target has changed. Hosted actions so far have been read-only.

### Production execution status

- **Target confirmed.** The Supabase dashboard identifies the project as PrepZii, branch `main`, marked Production. Project reference `vyqcciooigmnfmzrwtpp` matches the LMS database configuration.
- **Data API baseline matched.** A fresh read reproduced the audited set of 118 relations and 52 RPCs, including the same exposed columns. This comparison covers the API-visible schema. Run the PostgreSQL catalog and runner baseline checks over the production connection before any writes.
- **Consumer release checked.** Vercel identifies `a19792f1de4b1985ebdcb6835cbcb6b87023dabe` as the production consumer commit serving `www.prepzii.com`. All 14 membership tests passed on that revision, including rejection of activation by matching email alone. The production homepage returned `200` and an unauthenticated institute list request returned `401`. The signed-in activation behavior was exercised in the consumer regression tests.
- **Recovery checkpoint pending.** The target is on Supabase Free. Establish an authorized PostgreSQL connection to create a logical backup, restore-test it in isolation, and verify its contents. No migration statements have run. Post-migration checks remain pending.

## Verification after rollout

1. Read the updated catalog and run the [post-migration SQL](../supabase/tests/super_admin_rollout_verify.sql). Require all five checks to pass. Verify `/api/platform` loads invitation history and that the app has the target LMS origin and stable invitation secret.
2. Smoke-test existing consumer reads for an institute, legacy membership, assigned batch, and published assessment. Compare representative existing records against the pre-rollout snapshot.
3. In isolated staging using an approved test inbox, register a disposable institute and confirm its plan, original owner invitation, Clerk email receipt, owner activation, and creation and invitation audit records. Update its test subscription and verify persisted dates and status after reload.
4. Publish a student-only broadcast to the disposable institute. Verify the announcement and audit record, and confirm that a teacher or unrelated tenant cannot read the broadcast. Use read-only production checks unless the specific test writes, recipient, and scope receive approval.
