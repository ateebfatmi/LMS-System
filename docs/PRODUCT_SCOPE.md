# PrepZii LMS product scope

## Production V1

The customer-facing product contains only the daily learning-management workflow:

- institute onboarding and secure authentication;
- institute administrators, faculty, and students;
- student/faculty directories, invitations, and CSV imports;
- batches, subjects, courses, enrolment, and learning materials;
- assignments, submissions, grading, and feedback;
- question bank, CBT assessments, server-authoritative attempts, and results;
- attendance with correction history;
- announcements and in-app notifications;
- role-scoped dashboards, reports, subscription settings, and platform operations.

## Deliberately outside V1

- admissions CRM and lead pipelines;
- institute fee ledgers, invoicing, and payment collection;
- OMR generation or scanning;
- parent/guardian portal workflows;
- doubt-desk workflows;
- AI-generated content or intervention predictions;
- advanced campus, room, and timetable automation;
- WhatsApp/SMS automation, custom domains, and deep white-labelling.

Old URLs redirect to the nearest supported workspace. Retired unscoped APIs return `410 Gone` in strict deployments. Database migration history is never rewritten merely to remove a feature from the product surface.

## Production rules

- No production request may fall back to mock or in-memory data.
- Every tenant record must include `organization_id` and be protected by row-level security.
- Organization access is always resolved from the authenticated server-side membership.
- Platform administration remains hidden from tenant navigation and allowlisted server-side.
- New modules require a documented product decision, tenant-isolation tests, and release-gate coverage before they appear in navigation.
