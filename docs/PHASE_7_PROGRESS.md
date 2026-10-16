# Phase 7 progress — communications and AI

Status date: 2026-10-17

## Communications implemented in code

- Owners, admins, and coordinators can draft or publish tenant announcements. Batch targets are validated against the tenant.
- Publishing creates one portal notification per resolved active recipient; users own their read state.
- Students see all-institute and enrolled-batch notices. Parents see all-institute and parent notices only. Guardian-specific messages remain blocked until guardian links exist.
- External channel selections create visible blocked jobs. No email, SMS, or WhatsApp delivery is claimed without a configured provider.

## AI drafting implemented in code

- The server reuses `GEMINI_API_KEY` and `ZI_AI_MODEL` without exposing credentials to the browser.
- Announcement, objective-question, and lesson-summary outputs use provider response schemas plus server-side Zod validation.
- Each request has a unique processing row, SHA-256 input hash, source metadata, model/prompt version, token metadata, and a draft/failed state.
- One AI credit is consumed through the database's idempotent quota RPC before generation.
- User-supplied source text is explicitly treated as untrusted; output stays a draft and cannot change permissions or publish itself.

## Verification completed

- TypeScript, scoped ESLint, and production builds pass.
- SQL fixtures cover cross-tenant notifications, announcement visibility, AI-draft visibility, and quota replay.
- Supabase migration execution and live Gemini calls remain unverified without isolated staging credentials.

## Remaining before production

- Rehearse migration `0017_communications_ai_drafts.sql` on a staging clone.
- Add approval/rejection and canonical promotion for question and lesson drafts.
- Define whether failed provider attempts consume a credit and implement an audited release policy if not.
- Add provider adapters only after consent, template, credential, retry, suppression, and webhook requirements are reviewed.
