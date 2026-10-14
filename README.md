# PrepZii for Institutes
## Multi-Tenant Coaching Institute Management SaaS

PrepZii for Institutes is an enterprise-grade, multi-tenant B2B SaaS platform specifically engineered for coaching institutes across India (JEE, NEET, UPSC, SSC, Banking, and Foundation academies). It enables institutes to run their entire academic and administrative workflow from a single unified dashboard.

---

### Features & Capabilities

- 🎯 **Authentic CBT Exam Engine**: Timed test simulator, question palette, numerical tolerance, and JEE Advanced partial marking algorithms.
- 🏢 **Multi-Tenant Architecture**: Strict logical isolation using PostgreSQL Row-Level Security (RLS) linked to authenticated organization memberships.
- 👥 **Roster & Batch OS**: Batch management, CSV bulk roster importer with duplicate detection, student directory, and faculty allocations.
- 📋 **Admissions CRM**: Inquiries pipeline (New, Contacted, Counselling Scheduled, Trial Attended, Converted, Lost), follow-up tracking, and 1-click conversion to enrolled students.
- 💳 **Fee Management & Ledger**: Course fee schedules, concession policies, offline cash/UPI receipts, and Razorpay subscription tiers.
- 📊 **Academic Analytics**: Granular weak-chapter detection, speed vs. accuracy analytics, and ranked batch leaderboards.
- ⚡ **Platform Super-Admin Portal**: Platform-level tenant provisioning, account suspension/reactivation, MRR metrics, and security audit logs.
- 📢 **Notice Board & Circulars**: Role-aware circulars with integrated WhatsApp & SMS notification broadcaster.
- 🏛️ **Campus & Smart Classrooms**: Resource manager for smart boards, lab benches, and conflict-free room scheduling.

---

### Monorepo Structure

```text
apps/
  web/                     Next.js 16 Web Application & Marketing Portal
backend/                   Python FastAPI Assessment & Tenancy Service
  app/
    api/v1/                REST endpoints (CRM, Assessments, Health)
    core/                  Config, Database engine, Security
    models/                SQLAlchemy ORM models
    schemas/               Pydantic validation schemas
    services/              Pure assessment grading & CRM logic
    permissions/           Tenant authorization & membership verification
  tests/                   Automated pytest test suite (100% pass)
packages/
  contracts/               Shared TypeScript domain contracts & types
  assessment-core/         Pure mathematical grading engine with unit tests
  ui/                      PrepZii brand design system & accessible components
supabase/
  migrations/              Additive Postgres migrations with RLS policies
```

---

### Quick Start

```bash
# 1. Install Node workspace dependencies
npm install

# 2. Setup environment variables
cp .env.example .env.local

# 3. Run all tests
npm test
python3 -m pytest backend/tests

# 4. Run typecheck across all workspaces
npm run typecheck

# 5. Start Next.js development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to view the application in your browser.

---

### Documentation Suite

- [ARCHITECTURE.md](ARCHITECTURE.md) — Comprehensive architecture, multi-tenancy model, RBAC policies.
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — PostgreSQL relational tables, indexes, and RLS policies.
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — REST API specification with request/response schemas.
- [SECURITY.md](SECURITY.md) — Data isolation guarantees, server-side scoring, and credential guidelines.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Production setup, hosting recommendations, and environment configuration.
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) — Roadmap, completed phases, and milestone status.
