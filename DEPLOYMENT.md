# Deployment Guide — PrepZii for Institutes

### 1. Prerequisites

- Node.js >= 22
- Python >= 3.11
- PostgreSQL 15+ (or Supabase project)
- Clerk account for authentication
- Razorpay account (Sandbox or Production)

---

### 2. Local Development Setup

```bash
# 1. Install Node workspace dependencies
npm install

# 2. Setup environment variables
cp .env.example .env.local

# 3. Install Python backend dependencies
python3 -m pip install -r backend/requirements.txt

# 4. Run tests
npm test
python3 -m pytest backend/tests

# 5. Start Next.js development server
npm run dev

# 6. (Optional) Run FastAPI backend service
uvicorn backend.app.main:app --reload --port 8000
```

---

### 3. Production Deployment

#### Frontend Web Application (Next.js 16)
- Deployable on Vercel, AWS ECS, or Docker container.
- Build command: `npm run build`
- Output: Standalone Next.js production server.

#### Backend API Service (FastAPI)
- Deployable on AWS App Runner, Fly.io, Railway, or Google Cloud Run.
- Start command:
  ```bash
  uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --workers 4
  ```

#### Database Migrations
Run Supabase migrations in sequence:
```bash
supabase db push
# Or apply migrations directly:
# 0001_extend_prepzii_backend.sql
# 0002_coaching_lms_modules.sql
# 0003_institutional_fees_and_campuses.sql
# 0004_crm_subscriptions_superadmin.sql
```
