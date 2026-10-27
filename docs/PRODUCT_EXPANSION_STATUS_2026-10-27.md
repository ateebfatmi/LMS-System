# Product expansion status — 2026-10-27

This file tracks the implementation request that followed the product-roadmap review. A checked item means working code exists in this repository; it does not replace the external production-readiness gates in `RELEASE_STATUS_2026-10-27.md`.

## Completed in the current expansion

- [x] Transparent student-risk scoring in shared `@prepzii/student-success` domain code.
- [x] Human-reviewed student intervention queue with ownership, next-review date, resolution state, and audit records.
- [x] Reviewed revision plans visible to the student and approved guardian.
- [x] Batch-scoped student Doubt Desk with faculty replies, internal notes, and resolution lifecycle.
- [x] Descriptive-answer grading queue connected to the existing evaluation and moderation RPC.
- [x] RLS and composite tenant constraints for the new student-success and doubt records.
- [x] PostgreSQL 16 clean-chain and cross-tenant tests covering owner, student, approved guardian, and unapproved guardian visibility.

## Already present before this expansion

- [x] Tenant onboarding, institute selection, invitations, CSV member imports, RBAC, RLS, and audit logs.
- [x] Courses, modules, lessons, resources, assignment submission/grading, attendance, objective assessments, and question bank.
- [x] Academic sessions, batches, campuses, rooms, and conflict-protected timetable entries.
- [x] Guardian-link review schema and scoped attendance/fee visibility.
- [x] Fee plans, installments, invoices, manual receipts, partial payments, and refunds.
- [x] Admissions CRM, announcements, in-app notifications, AI draft storage/review RPC, subscriptions, quotas, branding, and platform administration.
- [x] JEE-style negative marking, objective scoring, attempt timing, autosave, release policy, rank, and percentile domain behavior.

## Remaining code deliverables

These should be delivered as separate reviewed slices because they touch money, identity, private files, or external providers.

- [ ] Student creation of descriptive responses in the live test player, including private file upload and mixed objective/subjective finalization.
- [ ] Lesson-plan calendar, daily teaching log, substitution workflow, and syllabus-completion reporting.
- [ ] Topic-level mastery persistence, adaptive-practice scheduling, spaced revision, and PYQ curriculum mapping.
- [ ] Bulk fee assignment, credit notes, reconciliation work queue, downloadable PDF invoices/receipts, and automated overdue policy.
- [ ] Provider adapters for opted-in email, SMS, and WhatsApp with encrypted credentials, retry policy, receipts, and suppression lists.
- [ ] Razorpay institute-fee reconciliation and SaaS subscription webhook state transitions with sandbox replay/concurrency evidence.
- [ ] Support-access approval UI, customer export, retention/deletion workflow, downgrade/read-only transition, and verified subdomain workflow.
- [ ] Low-bandwidth PWA/offline content, localization infrastructure, notification digests, learner calendar, and recorded-class bookmarks.
- [ ] OneRoster/LTI connectors, public API/webhooks, accounting exports, custom domains, and mobile application contracts.
- [ ] Teacher-reviewed AI promotion for questions and lesson summaries, grading assistance, quality fixtures, and abuse controls.

## External gates that cannot be completed from repository code alone

- [ ] Reconcile the real staging/production migration ledger after a verified backup.
- [ ] Run Clerk owner/admin/teacher/student/guardian cross-tenant browser tests using real accounts.
- [ ] Configure sandbox and then production credentials for Razorpay, email, SMS, WhatsApp, storage scanning, and monitoring providers.
- [ ] Complete accessibility review with assistive technology, representative load tests, backup restore, alert drills, and payment-webhook drills.
- [ ] Complete DPDP/child-data legal review, consent copy, retention policy approval, and a limited-institute operational pilot.

No unchecked external gate should be described as production-complete without recorded evidence.
