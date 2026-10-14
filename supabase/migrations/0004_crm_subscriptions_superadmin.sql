-- Prepzii B2B LMS Migration 0004: Admissions CRM, Subscriptions & Platform Super-Admin
-- Tenant-owned records strictly include organization_id and row-level security.

-- =================================================================
-- 1. ADMISSIONS CRM (LEADS & CONVERSIONS)
-- =================================================================

create table if not exists public.organization_leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  email text,
  phone text not null,
  guardian_name text,
  guardian_phone text,
  target_exam text not null check (target_exam in ('JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'FOUNDATION', 'BOARDS', 'OTHER')),
  target_batch_id uuid references public.organization_batches(id) on delete set null,
  source text not null default 'WALK_IN' check (source in ('WALK_IN', 'WEBSITE', 'REFERRAL', 'SOCIAL_MEDIA', 'NEWSPAPER', 'CAMPAIGN', 'OTHER')),
  assigned_counsellor_id text,
  assigned_counsellor_name text,
  stage text not null default 'NEW' check (stage in ('NEW', 'CONTACTED', 'COUNSELLING_SCHEDULED', 'TRIAL_ATTENDED', 'CONVERTED', 'LOST')),
  follow_up_date date,
  estimated_fee numeric(12, 2) default 0,
  notes text,
  converted_student_id text,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists org_leads_org_idx on public.organization_leads(organization_id);
create index if not exists org_leads_stage_idx on public.organization_leads(stage);
create index if not exists org_leads_followup_idx on public.organization_leads(follow_up_date);

alter table public.organization_leads enable row level security;

create policy "Admins and Counsellors access leads"
  on public.organization_leads
  for all
  using (
    exists (
      select 1 from public.institutes i
      where i.id = organization_leads.organization_id
        and (i.owner_user_id = auth.uid()::text or exists (
          select 1 from public.institute_members m
          where m.institute_id = i.id
            and m.user_id = auth.uid()::text
            and m.role in ('OWNER', 'COACHING_ADMIN')
            and m.status = 'ACTIVE'
        ))
    )
  );

-- =================================================================
-- 2. SUBSCRIPTIONS & PLATFORM BILLING
-- =================================================================

create table if not exists public.subscription_plans (
  id text primary key, -- 'basic', 'growth', 'scale'
  name text not null,
  price_inr integer not null, -- stored in integer rupees (or paise)
  billing_interval text not null default 'monthly' check (billing_interval in ('monthly', 'yearly')),
  student_limit integer not null,
  branch_limit integer not null default 1,
  storage_gb integer not null default 10,
  ai_credits_per_month integer not null default 100,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Seed default commercial plans
insert into public.subscription_plans (id, name, price_inr, billing_interval, student_limit, branch_limit, storage_gb, ai_credits_per_month, features)
values 
  ('basic', 'Basic Plan', 1499, 'monthly', 100, 1, 10, 50, '["Core LMS", "CBT Mocks", "Attendance", "Fee Ledger", "Basic Reports"]'::jsonb),
  ('growth', 'Growth Plan', 3499, 'monthly', 500, 3, 50, 250, '["All Basic Features", "Multi-Campus", "Advanced Chapter Analytics", "WhatsApp Dispatcher", "Automated SMS/Email"]'::jsonb),
  ('scale', 'Scale Plan', 7999, 'monthly', 1500, 10, 200, 1000, '["All Growth Features", "Priority Server", "Custom White-Label Branding", "Dedicated Account Manager", "AI Test Generator"]'::jsonb)
on conflict (id) do nothing;

create table if not exists public.organization_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.institutes(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status text not null default 'TRIAL' check (status in ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED', 'SUSPENDED')),
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '14 days'),
  trial_ends_at timestamptz default (now() + interval '14 days'),
  razorpay_customer_id text,
  razorpay_subscription_id text,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id text not null,
  actor_role text not null,
  target_organization_id uuid references public.institutes(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists platform_audit_logs_org_idx on public.platform_audit_logs(target_organization_id);
create index if not exists platform_audit_logs_actor_idx on public.platform_audit_logs(actor_user_id);

-- =================================================================
-- 3. DEMO REQUESTS (MARKETING WEBSITE LEADS)
-- =================================================================

create table if not exists public.platform_demo_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  institute_name text not null,
  email text not null,
  phone text not null,
  city text not null,
  student_count text not null,
  interested_plan text default 'growth',
  notes text,
  status text not null default 'PENDING' check (status in ('PENDING', 'CONTACTED', 'DEMO_GIVEN', 'ONBOARDED', 'REJECTED')),
  created_at timestamptz not null default now()
);
