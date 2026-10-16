# Phase 5 progress — attendance and institute finance

Status date: 2026-10-17

## Attendance implemented in code

- Authorized owners, admins, coordinators, and assigned teachers can submit attendance for an enrolled batch.
- Multiple labelled sessions per day are supported with optional start/end times.
- Students see only their own attendance; teachers see only assigned batches; parent access remains denied until guardian links exist.
- The first submission finalizes the session. Later changes require a reason and create an immutable correction record plus an organization audit event.
- Direct browser write policies were removed; writes use the service-only attendance RPC.

## Institute finance implemented in code

- Finance roles can create INR fee plans with validated installment totals, assign plans to enrolled students, record concessions, and issue an invoice.
- Payments are allocated to a locked installment, support partial collection, require a unique external/manual reference, and generate a receipt number.
- Refunds reference the original payment, cannot exceed its remaining refundable amount, and recalculate installment, invoice, and ledger state transactionally.
- API and RPC inputs use integer paise. Existing PostgreSQL monetary columns remain `numeric(12,2)` INR pending a staging data review.
- Students can read only their own ledger, installments, invoices, payments, and refunds. Finance mutations are service-only and audited.

## Verification completed

- Workspace type-check, scoped ESLint, 23 package tests, and the Next.js production build pass.
- Cross-tenant SQL fixtures cover attendance records/corrections and fee ledgers/invoices, but cannot run until an isolated Supabase clone is configured.

## Remaining before production

- Rehearse migrations `0014_attendance_corrections.sql` and `0015_institute_finance_ledger.sql` against a snapshot-compatible staging clone.
- Connect Razorpay fee events to the institute ledger only after signature, amount, currency, tenant, and idempotency verification.
- Add provider reconciliation, bulk ledger operations, credit adjustments, PDF generation/visual QA, and notification delivery.
- Add guardian links before exposing attendance or finance to parent accounts.
