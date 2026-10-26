# Historical migrations

These files are preserved for forensic comparison with any external database ledger. They are not part of the active migration chain and must not be replayed on new environments.

- `0004_business_operations.sql` defines a second, incompatible finance schema using `student_user_id` and integer-paise columns. The active schema is evolved by `000301_institutional_fees_and_campuses.sql` and `0015_institute_finance_ledger.sql`.
- `0005_reconcile_canonical_schema.sql` replaces organization batch tables with views. That conflicts with the composite tenant constraints required by `0005_tenant_integrity_rbac_audit.sql` and later organization-scoped APIs.

If an external database already recorded either historical migration, compare its catalog and migration ledger before applying new migrations. Reconcile it with a new forward-only migration; never edit the external ledger blindly.
