# Phase 3 progress — learning delivery

Status date: 2026-10-17

The course-delivery and assignment cores are implemented in code. Staging verification and file-inspection operations are still required before Phase 3 is production-certified.

## Delivered

- Course-to-batch assignment with students and teachers restricted to their enrolled batches.
- Draft/published courses, ordered modules, lessons, scheduled releases, and lesson learning objectives.
- Staff authoring screens and an enrolled-student course experience using real tenant data.
- Private file resources with a constrained MIME allowlist, 25 MB limit, normalized names, hashes, and tenant-prefixed random object paths.
- External resources restricted to credential-free HTTPS URLs.
- Five-minute signed resource URLs issued only after fresh organization, enrolment, publication, and release checks.
- Lesson completion state and continue-learning metadata scoped to the authenticated user.
- Database RLS and composite tenant constraints for course-batch links, resources, and progress.
- Course, batch, or individual assignments with rubrics, availability windows, deadlines, late policy, and bounded attempts.
- Server-authoritative text/file submission, grading, feedback, and teacher-controlled resubmission.
- Private 10 MB submission attachments with hashes and five-minute signed reviewer/student access.

## Verified locally

- Shared learning-domain tests cover uploads, safe object names, HTTPS links, release dates, assignment windows, and submission file limits.
- Type checking and scoped lint pass.
- The SQL isolation suite now includes cross-tenant learning-resource relationships and enrolled-student visibility assertions, but cannot run until an isolated Supabase database is available.

## Remaining production gates

- Content inspection/malware workflow and automated retention for uploaded files.
- Live staging exercise of storage bucket configuration, RLS, signed access expiry, concurrent completion writes, submission retries, and deadline races.
