# ENVIRONMENT VARIABLES REFERENCE

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
| `BACKEND_API_URL` | Yes | `https://api.prepzii.com` | URL of the Python FastAPI microservice. |
| `RAZORPAY_KEY_ID` | Optional | `rzp_live_...` | Razorpay checkout public key. |
| `RAZORPAY_KEY_SECRET` | Optional | `live_secret_...` | Razorpay backend API secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | `whsec_...` | Secret key for verifying webhook HMAC signatures. |

---

## 2. Python FastAPI Backend (`backend/.env`)

| Variable Name | Required | Default / Example | Purpose |
|---|---|---|---|
| `ENV` | Yes | `production` | Environment mode (`development`, `staging`, `production`). |
| `SECRET_KEY` | Yes | Random 64-char hex string | Internal JWT/encryption key. |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/db` | Database connection string. |
| `CORS_ORIGINS` | Yes | `["https://institutes.prepzii.com"]` | Allowed origins for cross-origin requests. |
| `RAZORPAY_KEY_ID` | Optional | `rzp_live_...` | Razorpay public key. |
| `RAZORPAY_KEY_SECRET` | Optional | `live_secret_...` | Razorpay API key. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | `whsec_...` | Webhook verification secret. |
