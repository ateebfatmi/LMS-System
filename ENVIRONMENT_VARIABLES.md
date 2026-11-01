# Environment variables reference

All variables required to configure and run PrepZii for Institutes across development, staging, and production environments.

> [!CAUTION]
> Never commit real secrets or production keys to version control. Set these variables via your cloud orchestration platform (e.g., Vercel, Supabase Vault, AWS Secrets Manager, or Railway).

---

## 1. Web Application (`apps/web/.env.local`)

| Variable Name | Required | Default / Example | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Yes | `https://institutes.prepzii.com` | Root public URL of the web application. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | `pk_live_...` | Clerk client-side authentication key. |
| `CLERK_SECRET_KEY` | Yes | `sk_live_...` | Clerk backend verification secret. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://xyz.supabase.co` | Supabase project endpoint. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | `eyJ...` | Supabase anonymous public key (protected by RLS). |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | `eyJ...` | Supabase administrative backend access key. |
| `DATABASE_URL` | Migration only | `postgresql://...` | Direct PostgreSQL connection for controlled migration tooling. |
| `INVITATION_TOKEN_SECRET` | Yes | 32+ random characters | Signs institute invitation tokens. |
| `PLATFORM_ADMIN_USER_IDS` | Optional | `user_...` | Comma-separated Clerk IDs allowed to use platform administration. |
| `ALLOW_INSECURE_DEV_AUTH` | Local only | `false` | Enables the isolated demo identity only in local development. Must be false in deployed environments. |

---

## 2. Optional backend prototype (`backend/.env`)

The focused LMS uses the Next.js server and shared PrepZii Supabase project as its authoritative runtime. The Python directory is retained as a non-public prototype and is not required for the V1 deployment.

| Variable Name | Required | Default / Example | Purpose |
|---|---|---|---|
| `ENV` | Yes | `production` | Environment mode (`development`, `staging`, `production`). |
| `SECRET_KEY` | Yes | Random 64-char hex string | Internal JWT/encryption key. |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db` | Database connection string. |
| `CORS_ORIGINS` | Yes | `["https://institutes.prepzii.com"]` | Allowed origins for cross-origin requests. |
