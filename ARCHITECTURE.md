# Architecture Documentation — PrepZii for Institutes
## Multi-Tenant Coaching Institute Management SaaS

### 1. High-Level System Architecture

PrepZii for Institutes is a multi-tenant B2B SaaS platform specifically engineered for coaching institutes across India (JEE, NEET, UPSC, SSC, Banking, and Foundation academies). It uses a modular architecture combining a Next.js 16 App Router frontend with a high-performance Python FastAPI assessment and API service backed by PostgreSQL with strict Row-Level Security (RLS).

```
                        ┌──────────────────────────────────────────────┐
                        │              Browser Clients                 │
                        │   (Director, Faculty, Student, Parent, Ops)  │
                        └──────────────────────┬───────────────────────┘
                                               │
                                 HTTPS / REST / Server Actions
                                               │
               ┌───────────────────────────────┴──────────────────────────────┐
               │                                                              │
               ▼                                                              ▼
 ┌───────────────────────────┐                                  ┌───────────────────────────┐
 │   Next.js 16 Web App      │                                  │   Python FastAPI Service  │
 │   - Landing / Marketing   │                                  │   - Exam Grading Engine   │
 │   - Director Workspace    │                                  │   - CBT Scoring Logic     │
 │   - Admissions CRM        │                                  │   - Partial Marking Rule  │
 │   - Attendance & Fees     │                                  │   - Tenant Auth Context   │
 │   - Platform Super-Admin  │                                  │   - Admissions API        │
 └─────────────┬─────────────┘                                  └─────────────┬─────────────┘
               │                                                              │
               │                   Shared Domain Layer                        │
               ├──────────────────────────────────────────────────────────────┤
               │   @prepzii/contracts       - Domain interfaces & roles       │
               │   @prepzii/assessment-core - Pure scoring & ranking math     │
               │   @prepzii/ui              - Tokens, MetricCards, Modals     │
               └──────────────────────────────┬───────────────────────────────┘
                                              │
                                              ▼
                             ┌───────────────────────────────────┐
                             │    PostgreSQL Database (Supabase)  │
                             │    - Canonical institutes registry│
                             │    - Row-Level Security (RLS)     │
                             │    - Tenant-isolated partitions   │
                             └───────────────────────────────────┘
```

---

### 2. Multi-Tenancy & Data Isolation Model

1. **Logical Isolation with PostgreSQL RLS**:
   - Every tenant-owned entity includes an `organization_id` foreign key referencing canonical `institutes.id`.
   - Postgres Row-Level Security policies ensure that queries execute only in the context of the authenticated user's organization membership.
2. **Context Resolution**:
   - The user identity is authenticated via Clerk / Supabase Auth.
   - The server verifies `owner_user_id` on the institute or an active record in `institute_members`.
   - Never trust client-supplied `organization_id` or `user_id` without server-side verification.
3. **Cross-Tenant Prevention**:
   - Automated pytest tests (`backend/tests/test_tenant_isolation.py`) systematically verify that actors from Organization B receive HTTP 403 Forbidden when trying to access or manipulate Organization A records.

---

### 3. Role-Based Access Control (RBAC)

The system enforces strict permission boundaries across 5 key roles:

| Role | Access Scope | Limitations |
| --- | --- | --- |
| **Platform Super Admin** | Platform-wide institute registry, MRR analytics, account suspension/reactivation, subscription plan management | Internal PrepZii operators only; zero unauthorized backdoor to student personal data |
| **Institute Owner / Director** | Full institute management, admissions CRM, faculty assignments, fee schedules, GST invoices, campus allocations | Scoped strictly to the authenticated institute tenant |
| **Faculty / Teacher** | Assigned batches, lecture timetable, attendance recording, test creation, question bank, student analytics | No access to unrelated batches or financial ledgers |
| **Student** | Enrolled courses, CBT mock test simulator, active attempts, ranked leaderboards, fee installment status | Strictly read-only for other students; cannot see answers before test release |
| **Parent** | Linked child's attendance percentage, test rank cards, fee dues, receipts, official notices | Scoped strictly to linked wards |

---

### 4. Bounded Contexts & Packages

- **`@prepzii/contracts`**: Pure TypeScript domain definitions, shared request/response models, target exams (`JEE_MAIN`, `JEE_ADVANCED`, `NEET`), subscription tiers, and CRM stages.
- **`@prepzii/assessment-core`**: Pure mathematical scoring engine. Supports JEE Advanced partial marking, numerical question floating-point tolerance, and percentile leaderboard calculations.
- **`@prepzii/ui`**: Shared UI design primitives, metric cards, panels, progress bars, and PrepZii brand tokens.
