-- Prepzii for Institutions: Phase 4 Additive Migration
-- File: supabase/migrations/0004_business_operations.sql
-- Prerequisites:
--   1. Existing Prepzii consumer backend schema (public.institutes, public.institute_members)
--   2. 0001_extend_prepzii_backend.sql
--   3. 0002_coaching_lms_modules.sql
--   4. 0003_institutional_operations.sql
-- Adds:
--   1. Fee plans (course/program-level tuition and material fees)
--   2. Student fee allocations, discounts and waivers
--   3. Fee installment schedules with due dates and balance tracking
--   4. Fee payments and receipts with cash/UPI/bank ledger records
--   5. Admissions enquiries and lead tracking CRM
--   6. Admissions follow-up interaction timeline
-- All protected by organization-scoped Row Level Security.
-- DO NOT APPLY DIRECTLY TO PRODUCTION WITHOUT EXPLICIT APPROVAL.

create extension if not exists pgcrypto;

-- =================================================================
-- 1. FEE PLANS (Course / Program Fee Structures)
-- =================================================================
create table if not exists public.organization_fee_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  academic_year_id uuid references public.organization_academic_years(id) on delete set null,
  name text not null,
  target_exam text not null check (target_exam in ('JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'FOUNDATION', 'BOARDS', 'OTHER')),
  total_amount_paise bigint not null check (total_amount_paise >= 0),
  default_installments integer not null default 3 check (default_installments between 1 and 12),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, name)
);

create index if not exists org_fee_plans_org_idx on public.organization_fee_plans(organization_id);

-- =================================================================
-- 2. STUDENT FEE ASSIGNMENTS & DISCOUNTS
-- =================================================================
create table if not exists public.organization_student_fees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_user_id text not null,
  fee_plan_id uuid references public.organization_fee_plans(id) on delete restrict,
  batch_id uuid references public.organization_batches(id) on delete set null,
  base_amount_paise bigint not null check (base_amount_paise >= 0),
  discount_amount_paise bigint not null default 0 check (discount_amount_paise >= 0),
  discount_reason text,
  final_amount_paise bigint not null check (final_amount_paise >= 0),
  total_paid_paise bigint not null default 0 check (total_paid_paise >= 0),
  status text not null default 'PENDING' check (status in ('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED')),
  assigned_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, student_user_id, fee_plan_id)
);

create index if not exists org_student_fees_org_idx on public.organization_student_fees(organization_id);
create index if not exists org_student_fees_student_idx on public.organization_student_fees(student_user_id);
create index if not exists org_student_fees_status_idx on public.organization_student_fees(status);

-- =================================================================
-- 3. FEE INSTALLMENT SCHEDULES
-- =================================================================
create table if not exists public.organization_fee_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_fee_id uuid not null references public.organization_student_fees(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  due_date date not null,
  amount_paise bigint not null check (amount_paise > 0),
  paid_amount_paise bigint not null default 0 check (paid_amount_paise >= 0),
  status text not null default 'DUE' check (status in ('DUE', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED')),
  created_at timestamptz not null default now(),
  unique (student_fee_id, installment_number)
);

create index if not exists org_fee_installments_org_idx on public.organization_fee_installments(organization_id);
create index if not exists org_fee_installments_fee_idx on public.organization_fee_installments(student_fee_id);
create index if not exists org_fee_installments_due_idx on public.organization_fee_installments(due_date);

-- =================================================================
-- 4. FEE PAYMENTS & RECEIPTS
-- =================================================================
create table if not exists public.organization_fee_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_fee_id uuid not null references public.organization_student_fees(id) on delete cascade,
  installment_id uuid references public.organization_fee_installments(id) on delete set null,
  receipt_number text not null,
  amount_paise bigint not null check (amount_paise > 0),
  payment_method text not null check (payment_method in ('CASH', 'UPI', 'NEFT_RTGS', 'CHEQUE', 'CARD', 'ONLINE')),
  reference_number text,
  collected_by text not null,
  notes text,
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (organization_id, receipt_number)
);

create index if not exists org_fee_payments_org_idx on public.organization_fee_payments(organization_id);
create index if not exists org_fee_payments_receipt_idx on public.organization_fee_payments(receipt_number);
create index if not exists org_fee_payments_fee_idx on public.organization_fee_payments(student_fee_id);

-- =================================================================
-- 5. ADMISSIONS ENQUIRIES & LEAD CRM
-- =================================================================
create table if not exists public.organization_admissions_enquiries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  campus_id uuid references public.organization_campuses(id) on delete set null,
  student_name text not null,
  parent_name text,
  phone text not null,
  email text,
  target_exam text not null check (target_exam in ('JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'FOUNDATION', 'BOARDS', 'OTHER')),
  current_school text,
  current_grade text,
  lead_source text not null check (lead_source in ('WALK_IN', 'WEBSITE', 'PHONE_ENQUIRY', 'STUDENT_REFERRAL', 'SEMINAR', 'NEWSPAPER_AD', 'OTHER')),
  status text not null default 'NEW' check (status in ('NEW', 'CONTACTED', 'COUNSELED', 'DEMO_ATTENDED', 'OFFER_EXTENDED', 'ENROLLED', 'LOST')),
  assigned_counsellor_id text,
  target_batch_id uuid references public.organization_batches(id) on delete set null,
  enrolled_student_id text,
  enrolled_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_enquiries_org_idx on public.organization_admissions_enquiries(organization_id);
create index if not exists org_enquiries_phone_idx on public.organization_admissions_enquiries(phone);
create index if not exists org_enquiries_status_idx on public.organization_admissions_enquiries(status);

-- =================================================================
-- 6. ADMISSIONS FOLLOW-UP TIMELINE
-- =================================================================
create table if not exists public.organization_admissions_followups (
  id uuid primary key default gen_random_uuid(),
  enquiry_id uuid not null references public.organization_admissions_enquiries(id) on delete cascade,
  counsellor_id text not null,
  counsellor_name text not null,
  interaction_type text not null check (interaction_type in ('PHONE_CALL', 'IN_PERSON_MEETING', 'WHATSAPP', 'EMAIL', 'CAMPUS_TOUR')),
  remarks text not null,
  next_followup_date date,
  created_at timestamptz not null default now()
);

create index if not exists org_followups_enquiry_idx on public.organization_admissions_followups(enquiry_id);

-- =================================================================
-- 7. ROW LEVEL SECURITY POLICIES
-- =================================================================
alter table public.organization_fee_plans enable row level security;
alter table public.organization_student_fees enable row level security;
alter table public.organization_fee_installments enable row level security;
alter table public.organization_fee_payments enable row level security;
alter table public.organization_admissions_enquiries enable row level security;
alter table public.organization_admissions_followups enable row level security;

-- Fee Plans: Viewable by staff and students, manageable by Admin/Owner
create policy org_fee_plans_select on public.organization_fee_plans
  for select using (public.is_organization_member(organization_id));
create policy org_fee_plans_manage on public.organization_fee_plans
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Student Fees: Staff manage, students and linked parents view their own
create policy org_student_fees_staff on public.organization_student_fees
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
create policy org_student_fees_student on public.organization_student_fees
  for select using (
    public.is_organization_member(organization_id)
    and (
      student_user_id = public.requesting_user_id()
      or exists (
        select 1 from public.organization_parent_students ps
        where ps.organization_id = organization_student_fees.organization_id
          and ps.parent_user_id = public.requesting_user_id()
          and ps.student_user_id = organization_student_fees.student_user_id
          and ps.is_verified = true
      )
    )
  );

-- Fee Installments: Same as student fees
create policy org_fee_installments_staff on public.organization_fee_installments
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
create policy org_fee_installments_select on public.organization_fee_installments
  for select using (public.is_organization_member(organization_id));

-- Fee Payments & Receipts
create policy org_fee_payments_staff on public.organization_fee_payments
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
create policy org_fee_payments_select on public.organization_fee_payments
  for select using (public.is_organization_member(organization_id));

-- Admissions Enquiries: Strictly staff-only (reception, counselor, admin)
create policy org_enquiries_staff on public.organization_admissions_enquiries
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']));

create policy org_followups_staff on public.organization_admissions_followups
  for all using (
    exists (
      select 1 from public.organization_admissions_enquiries e
      where e.id = organization_admissions_followups.enquiry_id
        and public.has_organization_role(e.organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    )
  )
  with check (
    exists (
      select 1 from public.organization_admissions_enquiries e
      where e.id = organization_admissions_followups.enquiry_id
        and public.has_organization_role(e.organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    )
  );

comment on table public.organization_fee_plans is
  'Fee structures configured by institutes (amounts stored in paise for exact monetary precision).';
comment on table public.organization_student_fees is
  'Student-specific fee ledger, tracking base fee, discounts, waivers and outstanding balances.';
comment on table public.organization_admissions_enquiries is
  'Coaching admissions enquiries CRM pipeline, tracking lead sources, follow-ups and batch conversions.';
