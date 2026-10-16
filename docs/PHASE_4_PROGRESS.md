# Phase 4 progress — assessments

Status date: 2026-10-17

## Implemented in code

- Existing PrepZii `questions`, `institute_tests`, and `institute_test_questions` remain canonical; the LMS adds an adapter, not another bank.
- Objective question parity covers single choice, multiple select with JEE Advanced partial marking, and numerical tolerance.
- Authorized staff can create a draft test, select shared questions, schedule it for an assigned batch, publish it, and release results or solutions.
- Enrolled students can start or resume within the schedule window. PostgreSQL serializes concurrent starts and enforces attempt limits.
- Answers autosave with optimistic versions. The server validates that every answer belongs to the test.
- The server computes marks from canonical questions and saved answers. Finalization is idempotent and the browser never supplies scores.
- Correct answers are stripped from test-taking responses and returned only after the solution release policy permits access.
- Attempt, schedule, and test relationships use tenant-composite foreign keys. RLS limits students to their own attempts and teachers to attempts for tests they authored.

## Verification completed

- 23 shared-package tests pass, including the consumer-question adapter fixture.
- Workspace type-check and scoped ESLint pass.
- Next.js 16 production build passes with assessment routes and dynamic attempt page.
- SQL cross-tenant fixtures now cover assessment attempts, but have not run because an isolated Supabase clone is not configured.

## Remaining before production

- Inspect the deployed PrepZii test schema and rehearse migration `0013_assessment_attempts.sql` on a scrubbed clone.
- Add short/descriptive answer contracts, manual grading, moderation, and grading audit history.
- Add authorized batch analytics, attempt event history, accessibility testing, and adverse network E2E coverage.
- Decide the ownership/review model for institute-authored questions before exposing question creation or imports.
