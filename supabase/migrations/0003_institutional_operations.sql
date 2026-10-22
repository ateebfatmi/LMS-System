-- Prepzii for Institutions: Phase 2 Additive Migration
-- File: supabase/migrations/0003_institutional_operations.sql
-- Prerequisites:
--   1. Existing Prepzii consumer backend schema (public.institutes, public.institute_members)
--   2. 0001_extend_prepzii_backend.sql
--   3. 0002_coaching_lms_modules.sql
-- Adds:
--   1. Parent-to-Student verified relationships
--   2. Real-time CBT session management & autosave answers
--   3. Notification dispatches with gateway delivery receipts
--   4. Immutable administrative audit logs
-- All protected by organization-scoped Row Level Security.
-- DO NOT APPLY DIRECTLY TO PRODUCTION WITHOUT APPROVAL.

create extension if not exists pgcrypto;

-- =================================================================
-- 1. PARENT-TO-STUDENT VERIFIED RELATIONSHIPS
-- =================================================================
create table if not exists public.organization_parent_students (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  parent_user_id text not null,
  student_user_id text not null,
  relationship text not null check (relationship in ('FATHER', 'MOTHER', 'GUARDIAN')),
  is_verified boolean not null default false,
  verified_by text,
  created_at timestamptz not null default now(),
  unique (organization_id, parent_user_id, student_user_id)
);

create index if not exists org_parent_students_org_idx on public.organization_parent_students(organization_id);
create index if not exists org_parent_students_parent_idx on public.organization_parent_students(parent_user_id);
create index if not exists org_parent_students_student_idx on public.organization_parent_students(student_user_id);

-- =================================================================
-- 2. CBT SESSIONS & REAL-TIME AUTOSAVE ANSWERS
-- =================================================================
create table if not exists public.organization_cbt_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  schedule_id uuid not null references public.organization_test_schedules(id) on delete cascade,
  student_user_id text not null,
  status text not null default 'IN_PROGRESS' check (status in ('NOT_STARTED', 'IN_PROGRESS', 'PAUSED', 'SUBMITTED', 'AUTO_SUBMITTED', 'EVALUATED')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  total_score numeric(8, 2),
  max_score numeric(8, 2),
  rank integer,
  percentile numeric(5, 2),
  marked_for_review jsonb not null default '[]'::jsonb,
  visited_questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (schedule_id, student_user_id)
);

create table if not exists public.organization_cbt_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.organization_cbt_sessions(id) on delete cascade,
  question_id text not null,
  selected_option_ids jsonb default '[]'::jsonb,
  numerical_value numeric(12, 4),
  time_spent_seconds integer not null default 0,
  status text default 'unanswered' check (status in ('correct', 'incorrect', 'unanswered', 'partially_correct')),
  score_awarded numeric(6, 2) default 0,
  updated_at timestamptz not null default now(),
  unique (session_id, question_id)
);

create index if not exists org_cbt_sessions_org_idx on public.organization_cbt_sessions(organization_id);
create index if not exists org_cbt_sessions_sched_idx on public.organization_cbt_sessions(schedule_id);
create index if not exists org_cbt_sessions_student_idx on public.organization_cbt_sessions(student_user_id);
create index if not exists org_cbt_answers_session_idx on public.organization_cbt_answers(session_id);
create index if not exists org_cbt_answers_q_idx on public.organization_cbt_answers(question_id);

-- =================================================================
-- 3. NOTIFICATION DISPATCHES WITH GATEWAY DELIVERY RECEIPTS
-- =================================================================
create table if not exists public.organization_notification_dispatches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid references public.organization_batches(id) on delete set null,
  recipient_phone text not null,
  recipient_name text not null,
  recipient_role text not null check (recipient_role in ('PARENT', 'STUDENT', 'FACULTY')),
  channel text not null check (channel in ('WHATSAPP', 'SMS')),
  template_key text not null check (template_key in ('ABSENT_ALERT', 'LATE_WARNING', 'TEST_SCORE_CARD', 'INSTITUTE_NOTICE')),
  rendered_content text not null,
  status text not null default 'QUEUED' check (status in ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
  provider text not null default 'INTERNAL_MOCK' check (provider in ('GUPSHUP', 'FAST2SMS', 'TWILIO', 'INTERNAL_MOCK')),
  provider_message_id text,
  failure_reason text,
  sent_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists org_notif_dispatches_org_idx on public.organization_notification_dispatches(organization_id);
create index if not exists org_notif_dispatches_status_idx on public.organization_notification_dispatches(status);
create index if not exists org_notif_dispatches_recipient_idx on public.organization_notification_dispatches(recipient_phone);

-- =================================================================
-- 4. ADMINISTRATIVE AUDIT LOGS (IMMUTABLE AUDIT TRAIL)
-- =================================================================
create table if not exists public.organization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  actor_user_id text not null,
  actor_role text not null,
  event_type text not null,
  resource_type text not null,
  resource_id text not null,
  details jsonb not null default '{}'::jsonb,
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists org_audit_logs_org_idx on public.organization_audit_logs(organization_id);
create index if not exists org_audit_logs_actor_idx on public.organization_audit_logs(actor_user_id);
create index if not exists org_audit_logs_event_idx on public.organization_audit_logs(event_type);

-- =================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =================================================================
alter table public.organization_parent_students enable row level security;
alter table public.organization_cbt_sessions enable row level security;
alter table public.organization_cbt_answers enable row level security;
alter table public.organization_notification_dispatches enable row level security;
alter table public.organization_audit_logs enable row level security;

-- Parent-Student RLS
create policy org_parent_students_read on public.organization_parent_students
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    or parent_user_id = public.requesting_user_id()
    or student_user_id = public.requesting_user_id()
  );

create policy org_parent_students_manage on public.organization_parent_students
  for all using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  )
  with check (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  );

-- CBT Sessions RLS
create policy org_cbt_sessions_read on public.organization_cbt_sessions
  for select using (
    student_user_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    or exists (
      select 1 from public.organization_parent_students ps
      where ps.organization_id = organization_id
        and ps.student_user_id = student_user_id
        and ps.parent_user_id = public.requesting_user_id()
        and ps.is_verified
    )
  );

create policy org_cbt_sessions_insert on public.organization_cbt_sessions
  for insert with check (
    (student_user_id = public.requesting_user_id() and public.is_organization_member(organization_id))
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  );

create policy org_cbt_sessions_update on public.organization_cbt_sessions
  for update using (
    (student_user_id = public.requesting_user_id() and status in ('IN_PROGRESS', 'SUBMITTED', 'AUTO_SUBMITTED'))
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
  )
  with check (
    (student_user_id = public.requesting_user_id())
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
  );

-- CBT Answers RLS
create policy org_cbt_answers_read on public.organization_cbt_answers
  for select using (
    exists (
      select 1 from public.organization_cbt_sessions s
      where s.id = session_id
        and (
          s.student_user_id = public.requesting_user_id()
          or public.has_organization_role(s.organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
        )
    )
  );

create policy org_cbt_answers_save on public.organization_cbt_answers
  for all using (
    exists (
      select 1 from public.organization_cbt_sessions s
      where s.id = session_id
        and s.student_user_id = public.requesting_user_id()
        and s.status = 'IN_PROGRESS'
        and now() <= (s.expires_at + interval '2 minutes') -- graceful 2m network margin for in-flight autosave
    )
  )
  with check (
    exists (
      select 1 from public.organization_cbt_sessions s
      where s.id = session_id
        and s.student_user_id = public.requesting_user_id()
        and s.status = 'IN_PROGRESS'
        and now() <= (s.expires_at + interval '2 minutes')
    )
  );

-- Notification Dispatches RLS
create policy org_notif_dispatches_read on public.organization_notification_dispatches
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
  );

create policy org_notif_dispatches_manage on public.organization_notification_dispatches
  for all using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  )
  with check (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  );

-- Audit Logs RLS (Immutable: Select by Admin/Owner, Insert authenticated)
create policy org_audit_logs_read on public.organization_audit_logs
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  );

create policy org_audit_logs_insert on public.organization_audit_logs
  for insert with check (
    actor_user_id = public.requesting_user_id()
    and public.is_organization_member(organization_id)
  );

comment on table public.organization_cbt_sessions is 'Student CBT test sessions with authoritative timers and submission state.';
comment on table public.organization_cbt_answers is 'Per-question candidate responses with autosave and server-graded score awards.';
comment on table public.organization_notification_dispatches is 'Outbound WhatsApp and SMS delivery logs with provider delivery status.';
comment on table public.organization_audit_logs is 'Tamper-resistant audit log of sensitive coaching operations.';
