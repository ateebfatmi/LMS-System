# Prepzii role architecture

Clerk authenticates the request. Its verified session user ID is the application identity already used by `institute_members.user_id`. Email is checked during invitation acceptance. Membership and resource authorization use stable Clerk IDs and institute-scoped relations. Platform administration uses the separate server-controlled `PLATFORM_SUPER_ADMIN_USER_IDS` allowlist.

The server resolves institute status and membership from Supabase before it grants permissions. `@prepzii/authorization` owns the canonical institute roles and typed permissions. `prepzii_active_organization` is an HTTP-only preference. Every lookup revalidates the preference against current membership. A user with one valid institute can enter it directly. Users with multiple institutes choose explicitly and may hold different roles across institutes. Ambiguous simultaneous memberships in a single institute fail closed. Adding selectable roles within one institute requires a separate membership data model and migration.

Existing institutes without an owner membership retain the legacy `owner_user_id` path. An explicit inactive owner membership blocks access. A founder provisions each new institute and issues its first owner invitation from the platform workspace. The verified recipient becomes the owner on acceptance.

The LMS stores hashes of expiring invitation tokens. Clerk verifies the recipient’s primary email and the LMS activates the matching member in a database transaction. The owner approves guardian links. See [invite-only provisioning](INVITE_ONLY_PROVISIONING.md) for the workflows and migration requirements.

## Database changes and rollback

`0024_membership_transition_guards.sql` replaces the existing onboarding, invitation acceptance, and member profile functions in place. `0025_workspace_resource_policies.sql` tightens active membership and attendance policy checks, adds guardian review and fee summary RPCs, makes grading columns server-only, and revokes browser execution of service-only LMS RPCs. Neither migration deletes rows. Apply to a disposable copy of the actual shared schema first. Confirm the canonical institute and member tables, audit columns, batch relation type, and expected function grants. Direct browser writes to institute ownership and membership are restricted, so verify any consumer feature that previously wrote those tables directly. Some historical migration branches define those objects differently.

For rollback, roll back the app alongside any RPCs it requires. Restore prior function bodies and policy definitions from a pre-migration schema snapshot, in a new reviewed forward migration. Keep audit events and reviewed relationships. Retain the browser RPC and grading-column restrictions while investigating any compatibility issue. Do not restore broad grants from the test fixture to hosted Supabase.
