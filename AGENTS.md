<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This project uses Next.js 16. Read the relevant guide in `node_modules/next/dist/docs/` before changing framework code, and follow current APIs and deprecation notices.

<!-- END:nextjs-agent-rules -->

# Repository conventions

- Tenant-owned records must include `organization_id` and be protected by row-level security.
- Shared domain behavior belongs in `packages/`, not inside the web application.
- The web application may depend on shared packages; shared packages must never import from the web application.
- Never accept an organization ID from a browser request without verifying the authenticated membership server-side.

