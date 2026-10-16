# Phase 3 progress — learning delivery

Status date: 2026-10-17

The course-delivery core is implemented in code. Assignment/submission workflows and staging verification are still required before Phase 3 is complete.

## Delivered

- Course-to-batch assignment with students and teachers restricted to their enrolled batches.
- Draft/published courses, ordered modules, lessons, scheduled releases, and lesson learning objectives.
- Staff authoring screens and an enrolled-student course experience using real tenant data.
- Private file resources with a constrained MIME allowlist, 25 MB limit, normalized names, hashes, and tenant-prefixed random object paths.
- External resources restricted to credential-free HTTPS URLs.
- Five-minute signed resource URLs issued only after fresh organization, enrolment, publication, and release checks.
- Lesson completion state and continue-learning metadata scoped to the authenticated user.
- Database RLS and composite tenant constraints for course-batch links, resources, and progress.

## Verified locally

- Shared learning-domain tests cover uploads, safe object names, HTTPS links, and release dates.
- Type checking and scoped lint pass.
- The SQL isolation suite now includes cross-tenant learning-resource relationships and enrolled-student visibility assertions, but cannot run until an isolated Supabase database is available.

## Remaining in Phase 3

- Assignments, scoped recipients, text/file submissions, deadlines, rubrics, grading, feedback, and controlled resubmission.
- Content inspection/malware workflow and automated retention for uploaded files.
- Live staging exercise of storage bucket configuration, RLS, signed access expiry, and concurrent completion writes.
