# Role API endpoints

| Route | Authorization |
| --- | --- |
| `GET /api/me` | Verified Clerk session; returns memberships, validated active workspace and its permissions |
| `GET /api/organizations` | Lists the caller’s active workspaces with their roles |
| `GET /api/organizations/active` | Checks the selection cookie; a sole valid membership is the default |
| `POST /api/organizations/active` | Validates `slug` against the caller’s memberships before setting the cookie |
| `POST /api/onboarding/institute` | Verified primary email and Clerk ID; transactional institute creation |
| `GET, POST /api/organizations/:slug/invitations` | Member administrators; POST uses `Idempotency-Key` and restricted role grants |
| `DELETE /api/organizations/:slug/invitations/:id` | Member administrators; scoped revocation |
| `POST /api/invitations/accept` | Verified primary email; single-recipient expiring token |
| `GET, PATCH /api/organizations/:slug/members` | Directory permissions; PATCH validates role and status transitions |
| `/api/organizations/:slug/{academic,attendance,assessments,assignments,learning,analytics,announcements,subscription}` | Existing institute workspaces with membership, permission, and resource checks |
| `/api/organizations/:slug/assessments/:id/attempt` | Student start and saves use assigned schedules and own attempts. Review applies separate results and solution release policies. |
| `/api/platform` | Separate platform allowlist |


Retired unscoped APIs return `410` in staging and production. The public CBT demo uses standalone sample questions and does not read institute data.
