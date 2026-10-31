-- =====================================================================
-- PREPZII B2B LMS — PRODUCTION CONSOLIDATED MIGRATIONS BUNDLE
-- Active migration chain concatenated in verified dependency order.
-- Fully idempotent: safe to execute in Supabase SQL Editor or via psql.
-- =====================================================================

BEGIN;


-- ---------------------------------------------------------------------
-- Migration: 0001_extend_prepzii_backend.sql
-- ---------------------------------------------------------------------

-- Prepzii for Institutions extends the EXISTING Prepzii Supabase project.
-- Prerequisite: db/migrations/20260812_institute_mvp.sql from consumer Prepzii.
-- `organization_id` below always references the canonical public.institutes.id.

create extension if not exists pgcrypto;

create table if not exists public.organization_campuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.organization_academic_years (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create unique index if not exists organization_one_active_year_idx
  on public.organization_academic_years(organization_id)
  where is_active;

create table if not exists public.organization_subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.organization_courses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  subject_id uuid references public.organization_subjects(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_campuses_org_idx on public.organization_campuses(organization_id);
create index if not exists organization_years_org_idx on public.organization_academic_years(organization_id);
create index if not exists organization_subjects_org_idx on public.organization_subjects(organization_id);
create index if not exists organization_courses_org_idx on public.organization_courses(organization_id);

-- Clerk's `sub` claim is the user ID used by Prepzii's existing institute tables.
create or replace function public.requesting_user_id()
returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.institutes institute
    where institute.id = target_organization_id
      and institute.status = 'ACTIVE'
      and (
        institute.owner_user_id = public.requesting_user_id()
        or exists (
          select 1
          from public.institute_members membership
          where membership.institute_id = institute.id
            and membership.user_id = public.requesting_user_id()
            and membership.status = 'ACTIVE'
        )
      )
  );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.institutes institute
    where institute.id = target_organization_id
      and institute.status = 'ACTIVE'
      and (
        ('OWNER' = any(allowed_roles) and institute.owner_user_id = public.requesting_user_id())
        or exists (
          select 1
          from public.institute_members membership
          where membership.institute_id = institute.id
            and membership.user_id = public.requesting_user_id()
            and membership.status = 'ACTIVE'
            and membership.role = any(allowed_roles)
        )
      )
  );
$$;

revoke all on function public.requesting_user_id() from public;
grant execute on function public.requesting_user_id() to authenticated;
revoke all on function public.is_organization_member(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
revoke all on function public.has_organization_role(uuid, text[]) from public;
grant execute on function public.has_organization_role(uuid, text[]) to authenticated;

alter table public.organization_campuses enable row level security;
alter table public.organization_academic_years enable row level security;
alter table public.organization_subjects enable row level security;
alter table public.organization_courses enable row level security;

drop policy if exists organization_campuses_read on public.organization_campuses;
create policy organization_campuses_read on public.organization_campuses
  for select using (public.is_organization_member(organization_id));
drop policy if exists organization_campuses_manage on public.organization_campuses;
create policy organization_campuses_manage on public.organization_campuses
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

drop policy if exists organization_years_read on public.organization_academic_years;
create policy organization_years_read on public.organization_academic_years
  for select using (public.is_organization_member(organization_id));
drop policy if exists organization_years_manage on public.organization_academic_years;
create policy organization_years_manage on public.organization_academic_years
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

drop policy if exists organization_subjects_read on public.organization_subjects;
create policy organization_subjects_read on public.organization_subjects
  for select using (public.is_organization_member(organization_id));
drop policy if exists organization_subjects_manage on public.organization_subjects;
create policy organization_subjects_manage on public.organization_subjects
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']));

drop policy if exists organization_courses_read on public.organization_courses;
create policy organization_courses_read on public.organization_courses
  for select using (public.is_organization_member(organization_id));
drop policy if exists organization_courses_insert on public.organization_courses;
create policy organization_courses_insert on public.organization_courses
  for insert
  with check (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    and created_by = public.requesting_user_id()
  );
drop policy if exists organization_courses_update on public.organization_courses;
create policy organization_courses_update on public.organization_courses
  for update
  using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
    or (
      public.has_organization_role(organization_id, array['TEACHER'])
      and created_by = public.requesting_user_id()
    )
  )
  with check (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
    or (
      public.has_organization_role(organization_id, array['TEACHER'])
      and created_by = public.requesting_user_id()
    )
  );
drop policy if exists organization_courses_delete on public.organization_courses;
create policy organization_courses_delete on public.organization_courses
  for delete
  using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
    or (
      public.has_organization_role(organization_id, array['TEACHER'])
      and created_by = public.requesting_user_id()
    )
  );

comment on table public.organization_campuses is
  'B2B campus records. organization_id is the existing Prepzii institutes.id.';
comment on table public.organization_courses is
  'B2B courses in the shared Prepzii backend, isolated by organization_id.';


-- ---------------------------------------------------------------------
-- Migration: 0002_coaching_lms_modules.sql
-- ---------------------------------------------------------------------

-- Prepzii B2B LMS Coaching Modules Migration
-- Adds batches, batch members, curriculum modules, lessons, attendance, and test schedules with strict RLS.

-- =================================================================
-- 1. BATCHES & BATCH MEMBERS
-- =================================================================

create table if not exists public.organization_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  campus_id uuid references public.organization_campuses(id) on delete set null,
  academic_year_id uuid references public.organization_academic_years(id) on delete set null,
  name text not null,
  target_exam text not null check (target_exam in ('JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'FOUNDATION', 'BOARDS', 'OTHER')),
  grade_level text,
  room_number text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.organization_batch_members (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.organization_batches(id) on delete cascade,
  user_id text not null,
  role text not null check (role in ('STUDENT', 'TEACHER')),
  roll_number text,
  enrolled_at timestamptz not null default now(),
  unique (batch_id, user_id)
);

create index if not exists org_batches_org_idx on public.organization_batches(organization_id);
create index if not exists org_batches_campus_idx on public.organization_batches(campus_id);
create index if not exists org_batch_members_batch_idx on public.organization_batch_members(batch_id);
create index if not exists org_batch_members_user_idx on public.organization_batch_members(user_id);

-- =================================================================
-- 2. COURSE MODULES & LESSONS (Curriculum, Notes, DPPs)
-- =================================================================

create table if not exists public.organization_course_modules (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.organization_courses(id) on delete cascade,
  title text not null,
  description text,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.organization_course_lessons (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references public.organization_course_modules(id) on delete cascade,
  title text not null,
  kind text not null check (kind in ('VIDEO', 'DOCUMENT', 'DPP', 'LIVE_CLASS')),
  content_url text,
  duration_minutes integer,
  order_index integer not null default 0,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists org_course_modules_course_idx on public.organization_course_modules(course_id);
create index if not exists org_course_lessons_module_idx on public.organization_course_lessons(module_id);

-- =================================================================
-- 3. BATCH ATTENDANCE
-- =================================================================

create table if not exists public.organization_attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid not null references public.organization_batches(id) on delete cascade,
  session_date date not null,
  marked_by text not null,
  created_at timestamptz not null default now(),
  unique (batch_id, session_date)
);

create table if not exists public.organization_attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.organization_attendance_sessions(id) on delete cascade,
  student_id text not null,
  status text not null check (status in ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  remarks text,
  created_at timestamptz not null default now(),
  unique (session_id, student_id)
);

create index if not exists org_attendance_sessions_org_idx on public.organization_attendance_sessions(organization_id);
create index if not exists org_attendance_sessions_batch_idx on public.organization_attendance_sessions(batch_id);
create index if not exists org_attendance_records_session_idx on public.organization_attendance_records(session_id);
create index if not exists org_attendance_records_student_idx on public.organization_attendance_records(student_id);

-- =================================================================
-- 4. TEST SCHEDULING (Assigning Tests to Batches)
-- =================================================================

create table if not exists public.organization_test_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  test_id uuid not null, -- references public.institute_tests(id) or questions test set
  batch_id uuid not null references public.organization_batches(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  is_strict_timing boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists org_test_schedules_org_idx on public.organization_test_schedules(organization_id);
create index if not exists org_test_schedules_batch_idx on public.organization_test_schedules(batch_id);

-- =================================================================
-- 5. ANNOUNCEMENTS & NOTICES
-- =================================================================

create table if not exists public.organization_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid references public.organization_batches(id) on delete cascade,
  title text not null,
  content text not null,
  target_audience text not null check (target_audience in ('ALL', 'BATCH', 'FACULTY', 'PARENTS')),
  priority text not null default 'NORMAL' check (priority in ('NORMAL', 'HIGH', 'URGENT')),
  created_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists org_announcements_org_idx on public.organization_announcements(organization_id);

-- =================================================================
-- 6. ROW LEVEL SECURITY POLICIES
-- =================================================================

alter table public.organization_batches enable row level security;
alter table public.organization_batch_members enable row level security;
alter table public.organization_course_modules enable row level security;
alter table public.organization_course_lessons enable row level security;
alter table public.organization_attendance_sessions enable row level security;
alter table public.organization_attendance_records enable row level security;
alter table public.organization_test_schedules enable row level security;
alter table public.organization_announcements enable row level security;

-- Helper to check course tenant
create or replace function public.is_course_org_member(target_course_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_courses c
    where c.id = target_course_id and public.is_organization_member(c.organization_id)
  );
$$;

-- Batches Policies
drop policy if exists org_batches_read on public.organization_batches;
create policy org_batches_read on public.organization_batches
  for select using (public.is_organization_member(organization_id));
drop policy if exists org_batches_manage on public.organization_batches;
create policy org_batches_manage on public.organization_batches
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Batch Members Policies
drop policy if exists org_batch_members_read on public.organization_batch_members;
create policy org_batch_members_read on public.organization_batch_members
  for select using (
    exists (
      select 1 from public.organization_batches b
      where b.id = batch_id and public.is_organization_member(b.organization_id)
    )
  );
drop policy if exists org_batch_members_manage on public.organization_batch_members;
create policy org_batch_members_manage on public.organization_batch_members
  for all using (
    exists (
      select 1 from public.organization_batches b
      where b.id = batch_id and public.has_organization_role(b.organization_id, array['OWNER', 'COACHING_ADMIN'])
    )
  )
  with check (
    exists (
      select 1 from public.organization_batches b
      where b.id = batch_id and public.has_organization_role(b.organization_id, array['OWNER', 'COACHING_ADMIN'])
    )
  );

-- Course Modules & Lessons Policies
drop policy if exists org_modules_read on public.organization_course_modules;
create policy org_modules_read on public.organization_course_modules
  for select using (public.is_course_org_member(course_id));
drop policy if exists org_modules_manage on public.organization_course_modules;
create policy org_modules_manage on public.organization_course_modules
  for all using (
    exists (
      select 1 from public.organization_courses c
      where c.id = course_id and public.has_organization_role(c.organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    )
  )
  with check (
    exists (
      select 1 from public.organization_courses c
      where c.id = course_id and public.has_organization_role(c.organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    )
  );

drop policy if exists org_lessons_read on public.organization_course_lessons;
create policy org_lessons_read on public.organization_course_lessons
  for select using (
    exists (
      select 1 from public.organization_course_modules m
      where m.id = module_id and public.is_course_org_member(m.course_id)
    )
  );
drop policy if exists org_lessons_manage on public.organization_course_lessons;
create policy org_lessons_manage on public.organization_course_lessons
  for all using (
    exists (
      select 1 from public.organization_course_modules m
      join public.organization_courses c on c.id = m.course_id
      where m.id = module_id and public.has_organization_role(c.organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    )
  )
  with check (
    exists (
      select 1 from public.organization_course_modules m
      join public.organization_courses c on c.id = m.course_id
      where m.id = module_id and public.has_organization_role(c.organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    )
  );

-- Attendance Policies
drop policy if exists org_attendance_sessions_read on public.organization_attendance_sessions;
create policy org_attendance_sessions_read on public.organization_attendance_sessions
  for select using (public.is_organization_member(organization_id));
drop policy if exists org_attendance_sessions_manage on public.organization_attendance_sessions;
create policy org_attendance_sessions_manage on public.organization_attendance_sessions
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']));

drop policy if exists org_attendance_records_read on public.organization_attendance_records;
create policy org_attendance_records_read on public.organization_attendance_records
  for select using (
    exists (
      select 1 from public.organization_attendance_sessions s
      where s.id = session_id and public.is_organization_member(s.organization_id)
    )
  );
drop policy if exists org_attendance_records_manage on public.organization_attendance_records;
create policy org_attendance_records_manage on public.organization_attendance_records
  for all using (
    exists (
      select 1 from public.organization_attendance_sessions s
      where s.id = session_id and public.has_organization_role(s.organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    )
  )
  with check (
    exists (
      select 1 from public.organization_attendance_sessions s
      where s.id = session_id and public.has_organization_role(s.organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    )
  );

-- Test Schedules Policies
drop policy if exists org_test_schedules_read on public.organization_test_schedules;
create policy org_test_schedules_read on public.organization_test_schedules
  for select using (public.is_organization_member(organization_id));
drop policy if exists org_test_schedules_manage on public.organization_test_schedules;
create policy org_test_schedules_manage on public.organization_test_schedules
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']));

-- Announcements Policies
drop policy if exists org_announcements_read on public.organization_announcements;
create policy org_announcements_read on public.organization_announcements
  for select using (public.is_organization_member(organization_id));
drop policy if exists org_announcements_manage on public.organization_announcements;
create policy org_announcements_manage on public.organization_announcements
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));


-- ---------------------------------------------------------------------
-- Migration: 000300_institutional_operations.sql
-- ---------------------------------------------------------------------

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
  action text not null,
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists org_audit_logs_org_idx on public.organization_audit_logs(organization_id);
create index if not exists org_audit_logs_actor_idx on public.organization_audit_logs(actor_user_id);
create index if not exists org_audit_logs_action_idx on public.organization_audit_logs(action);

-- =================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- =================================================================
alter table public.organization_parent_students enable row level security;
alter table public.organization_cbt_sessions enable row level security;
alter table public.organization_cbt_answers enable row level security;
alter table public.organization_notification_dispatches enable row level security;
alter table public.organization_audit_logs enable row level security;

-- Parent-Student RLS
drop policy if exists org_parent_students_read on public.organization_parent_students;
create policy org_parent_students_read on public.organization_parent_students
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    or parent_user_id = public.requesting_user_id()
    or student_user_id = public.requesting_user_id()
  );

drop policy if exists org_parent_students_manage on public.organization_parent_students;
create policy org_parent_students_manage on public.organization_parent_students
  for all using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  )
  with check (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  );

-- CBT Sessions RLS
drop policy if exists org_cbt_sessions_read on public.organization_cbt_sessions;
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

drop policy if exists org_cbt_sessions_insert on public.organization_cbt_sessions;
create policy org_cbt_sessions_insert on public.organization_cbt_sessions
  for insert with check (
    (student_user_id = public.requesting_user_id() and public.is_organization_member(organization_id))
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  );

drop policy if exists org_cbt_sessions_update on public.organization_cbt_sessions;
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
drop policy if exists org_cbt_answers_read on public.organization_cbt_answers;
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

drop policy if exists org_cbt_answers_save on public.organization_cbt_answers;
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
drop policy if exists org_notif_dispatches_read on public.organization_notification_dispatches;
create policy org_notif_dispatches_read on public.organization_notification_dispatches
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
  );

drop policy if exists org_notif_dispatches_manage on public.organization_notification_dispatches;
create policy org_notif_dispatches_manage on public.organization_notification_dispatches
  for all using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  )
  with check (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  );

-- Audit Logs RLS (Immutable: Select by Admin/Owner, Insert authenticated)
drop policy if exists org_audit_logs_read on public.organization_audit_logs;
create policy org_audit_logs_read on public.organization_audit_logs
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
  );

drop policy if exists org_audit_logs_insert on public.organization_audit_logs;
create policy org_audit_logs_insert on public.organization_audit_logs
  for insert with check (
    actor_user_id = public.requesting_user_id()
    and public.is_organization_member(organization_id)
  );

comment on table public.organization_cbt_sessions is 'Student CBT test sessions with authoritative timers and submission state.';
comment on table public.organization_cbt_answers is 'Per-question candidate responses with autosave and server-graded score awards.';
comment on table public.organization_notification_dispatches is 'Outbound WhatsApp and SMS delivery logs with provider delivery status.';
comment on table public.organization_audit_logs is 'Tamper-resistant audit log of sensitive coaching operations.';


-- ---------------------------------------------------------------------
-- Migration: 000301_institutional_fees_and_campuses.sql
-- ---------------------------------------------------------------------

-- Prepzii B2B LMS Migration 000301: Fee Management & Smart Campus Room Allocation
-- Tenant-owned records strictly include organization_id and row-level security.

-- =================================================================
-- 1. FEE STRUCTURES & STUDENT LEDGER
-- =================================================================

create table if not exists public.organization_fee_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  target_exam text not null check (target_exam in ('JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'FOUNDATION', 'BOARDS', 'OTHER')),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  installment_count integer not null default 3 check (installment_count between 1 and 12),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.organization_student_fees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_id text not null,
  batch_id uuid references public.organization_batches(id) on delete set null,
  total_course_fee numeric(12, 2) not null check (total_course_fee >= 0),
  concession_amount numeric(12, 2) not null default 0 check (concession_amount >= 0),
  concession_reason text,
  net_payable numeric(12, 2) not null check (net_payable >= 0),
  status text not null default 'UNPAID' check (status in ('PAID', 'PARTIAL', 'OVERDUE', 'UNPAID')),
  updated_at timestamptz not null default now(),
  unique (organization_id, student_id)
);

create table if not exists public.organization_fee_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_fee_id uuid not null references public.organization_student_fees(id) on delete cascade,
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'PENDING' check (status in ('PAID', 'PENDING', 'OVERDUE', 'PARTIAL')),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  paid_at timestamptz,
  receipt_number text
);

create table if not exists public.organization_fee_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_fee_id uuid not null references public.organization_student_fees(id) on delete cascade,
  student_id text not null,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('UPI', 'NET_BANKING', 'CARD', 'CHEQUE', 'CASH', 'DD')),
  reference_number text not null,
  receipt_number text not null,
  installment_title text not null,
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists org_fee_plans_org_idx on public.organization_fee_plans(organization_id);
create index if not exists org_student_fees_org_idx on public.organization_student_fees(organization_id);
create index if not exists org_student_fees_student_idx on public.organization_student_fees(student_id);
create index if not exists org_fee_inst_org_idx on public.organization_fee_installments(organization_id);
create index if not exists org_fee_inst_fee_idx on public.organization_fee_installments(student_fee_id);
create index if not exists org_fee_tx_org_idx on public.organization_fee_transactions(organization_id);

-- =================================================================
-- 2. CAMPUS ROOMS & SMART RESOURCE ALLOCATION
-- =================================================================

create table if not exists public.organization_campus_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  campus_id uuid not null references public.organization_campuses(id) on delete cascade,
  name text not null,
  capacity integer not null check (capacity > 0),
  facilities text[] not null default '{}',
  status text not null default 'AVAILABLE' check (status in ('IN_USE', 'AVAILABLE', 'MAINTENANCE')),
  created_at timestamptz not null default now(),
  unique (campus_id, name)
);

create table if not exists public.organization_room_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  room_id uuid not null references public.organization_campus_rooms(id) on delete cascade,
  batch_id uuid references public.organization_batches(id) on delete cascade,
  faculty_id text not null,
  time_slot text not null,
  subject text not null,
  day_of_week text not null check (day_of_week in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')),
  created_at timestamptz not null default now(),
  unique (room_id, day_of_week, time_slot)
);

create index if not exists org_campus_rooms_org_idx on public.organization_campus_rooms(organization_id);
create index if not exists org_room_schedules_org_idx on public.organization_room_schedules(organization_id);

-- =================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =================================================================

alter table public.organization_fee_plans enable row level security;
alter table public.organization_student_fees enable row level security;
alter table public.organization_fee_installments enable row level security;
alter table public.organization_fee_transactions enable row level security;
alter table public.organization_campus_rooms enable row level security;
alter table public.organization_room_schedules enable row level security;

-- Fee Plans RLS
drop policy if exists org_fee_plans_read on public.organization_fee_plans;
create policy org_fee_plans_read on public.organization_fee_plans
  for select using (public.is_organization_member(organization_id));
drop policy if exists org_fee_plans_manage on public.organization_fee_plans;
create policy org_fee_plans_manage on public.organization_fee_plans
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Student Fees RLS
drop policy if exists org_student_fees_read on public.organization_student_fees;
create policy org_student_fees_read on public.organization_student_fees
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    or student_id = public.requesting_user_id()
  );
drop policy if exists org_student_fees_manage on public.organization_student_fees;
create policy org_student_fees_manage on public.organization_student_fees
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Installments RLS
drop policy if exists org_fee_installments_read on public.organization_fee_installments;
create policy org_fee_installments_read on public.organization_fee_installments
  for select using (public.is_organization_member(organization_id));
drop policy if exists org_fee_installments_manage on public.organization_fee_installments;
create policy org_fee_installments_manage on public.organization_fee_installments
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Transactions RLS
drop policy if exists org_fee_transactions_read on public.organization_fee_transactions;
create policy org_fee_transactions_read on public.organization_fee_transactions
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
    or student_id = public.requesting_user_id()
  );
drop policy if exists org_fee_transactions_manage on public.organization_fee_transactions;
create policy org_fee_transactions_manage on public.organization_fee_transactions
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Campus Rooms & Schedules RLS
drop policy if exists org_campus_rooms_read on public.organization_campus_rooms;
create policy org_campus_rooms_read on public.organization_campus_rooms
  for select using (public.is_organization_member(organization_id));
drop policy if exists org_campus_rooms_manage on public.organization_campus_rooms;
create policy org_campus_rooms_manage on public.organization_campus_rooms
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

drop policy if exists org_room_schedules_read on public.organization_room_schedules;
create policy org_room_schedules_read on public.organization_room_schedules
  for select using (public.is_organization_member(organization_id));
drop policy if exists org_room_schedules_manage on public.organization_room_schedules;
create policy org_room_schedules_manage on public.organization_room_schedules
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));


-- ---------------------------------------------------------------------
-- Migration: 0004_crm_subscriptions_superadmin.sql
-- ---------------------------------------------------------------------

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


-- ---------------------------------------------------------------------
-- Migration: 0005_tenant_integrity_rbac_audit.sql
-- ---------------------------------------------------------------------

-- Phase 1 hardening: close cross-tenant relationship gaps, tighten sensitive
-- read policies, and add persistent audit/webhook records.
-- Review against staging before applying to the shared Prepzii database.

-- Child rows must carry the canonical tenant key, even when it is derivable.
alter table public.organization_batch_members add column if not exists organization_id uuid;
update public.organization_batch_members child
set organization_id = parent.organization_id
from public.organization_batches parent
where child.batch_id = parent.id and child.organization_id is null;
alter table public.organization_batch_members alter column organization_id set not null;

alter table public.organization_course_modules add column if not exists organization_id uuid;
update public.organization_course_modules child
set organization_id = parent.organization_id
from public.organization_courses parent
where child.course_id = parent.id and child.organization_id is null;
alter table public.organization_course_modules alter column organization_id set not null;

alter table public.organization_course_lessons add column if not exists organization_id uuid;
update public.organization_course_lessons child
set organization_id = course.organization_id
from public.organization_course_modules module
join public.organization_courses course on course.id = module.course_id
where child.module_id = module.id and child.organization_id is null;
alter table public.organization_course_lessons alter column organization_id set not null;

alter table public.organization_attendance_records add column if not exists organization_id uuid;
update public.organization_attendance_records child
set organization_id = parent.organization_id
from public.organization_attendance_sessions parent
where child.session_id = parent.id and child.organization_id is null;
alter table public.organization_attendance_records alter column organization_id set not null;

-- Composite candidate keys let PostgreSQL prove parent and child share a tenant.
alter table public.organization_batches
  add constraint organization_batches_id_org_unique unique (id, organization_id);
alter table public.organization_courses
  add constraint organization_courses_id_org_unique unique (id, organization_id);
alter table public.organization_subjects
  add constraint organization_subjects_id_org_unique unique (id, organization_id);
alter table public.organization_course_modules
  add constraint organization_modules_id_org_unique unique (id, organization_id);
alter table public.organization_attendance_sessions
  add constraint organization_attendance_sessions_id_org_unique unique (id, organization_id);
alter table public.organization_student_fees
  add constraint organization_student_fees_id_org_unique unique (id, organization_id);
alter table public.organization_campuses
  add constraint organization_campuses_id_org_unique unique (id, organization_id);
alter table public.organization_campus_rooms
  add constraint organization_rooms_id_org_unique unique (id, organization_id);

alter table public.organization_batch_members
  add constraint organization_batch_members_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id) on delete cascade;
alter table public.organization_courses
  add constraint organization_course_subject_org_fk
  foreign key (subject_id, organization_id)
  references public.organization_subjects(id, organization_id);
alter table public.organization_course_modules
  add constraint organization_modules_course_org_fk
  foreign key (course_id, organization_id)
  references public.organization_courses(id, organization_id) on delete cascade;
alter table public.organization_course_lessons
  add constraint organization_lessons_module_org_fk
  foreign key (module_id, organization_id)
  references public.organization_course_modules(id, organization_id) on delete cascade;
alter table public.organization_attendance_sessions
  add constraint organization_attendance_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id) on delete cascade;
alter table public.organization_attendance_records
  add constraint organization_attendance_record_session_org_fk
  foreign key (session_id, organization_id)
  references public.organization_attendance_sessions(id, organization_id) on delete cascade;
alter table public.organization_test_schedules
  add constraint organization_test_schedule_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id) on delete cascade;
alter table public.organization_student_fees
  add constraint organization_student_fee_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id);
alter table public.organization_fee_installments
  add constraint organization_installment_fee_org_fk
  foreign key (student_fee_id, organization_id)
  references public.organization_student_fees(id, organization_id) on delete cascade;
alter table public.organization_fee_transactions
  add constraint organization_transaction_fee_org_fk
  foreign key (student_fee_id, organization_id)
  references public.organization_student_fees(id, organization_id) on delete cascade;
alter table public.organization_campus_rooms
  add constraint organization_room_campus_org_fk
  foreign key (campus_id, organization_id)
  references public.organization_campuses(id, organization_id) on delete cascade;
alter table public.organization_room_schedules
  add constraint organization_schedule_room_org_fk
  foreign key (room_id, organization_id)
  references public.organization_campus_rooms(id, organization_id) on delete cascade;
alter table public.organization_room_schedules
  add constraint organization_schedule_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id) on delete cascade;
alter table public.organization_leads
  add constraint organization_lead_batch_org_fk
  foreign key (target_batch_id, organization_id)
  references public.organization_batches(id, organization_id);

create index if not exists org_batch_members_org_idx on public.organization_batch_members(organization_id);
create index if not exists org_modules_org_idx on public.organization_course_modules(organization_id);
create index if not exists org_lessons_org_idx on public.organization_course_lessons(organization_id);
create index if not exists org_attendance_records_org_idx on public.organization_attendance_records(organization_id);

-- Persistent administrative audit and webhook idempotency records.
create table if not exists public.organization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete restrict,
  actor_user_id text not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  ip_address inet,
  created_at timestamptz not null default now()
);

-- Phase 2 introduced this table with event/resource column names. Keep that
-- schema compatible while exposing the canonical action/entity audit shape
-- used by all later LMS mutations.
alter table public.organization_audit_logs add column if not exists event_type text;
alter table public.organization_audit_logs add column if not exists resource_type text;
alter table public.organization_audit_logs add column if not exists resource_id text;
alter table public.organization_audit_logs add column if not exists details jsonb;
alter table public.organization_audit_logs add column if not exists action text;
alter table public.organization_audit_logs add column if not exists entity_type text;
alter table public.organization_audit_logs add column if not exists entity_id text;
alter table public.organization_audit_logs add column if not exists before_state jsonb;
alter table public.organization_audit_logs add column if not exists after_state jsonb;
alter table public.organization_audit_logs add column if not exists request_id text;

create or replace function public.normalize_organization_audit_log()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.action := coalesce(new.action, new.event_type);
  new.event_type := coalesce(new.event_type, new.action);
  new.entity_type := coalesce(new.entity_type, new.resource_type);
  new.resource_type := coalesce(new.resource_type, new.entity_type);
  new.entity_id := coalesce(new.entity_id, new.resource_id);
  new.resource_id := coalesce(new.resource_id, new.entity_id, 'unknown');
  new.details := coalesce(new.details, new.after_state, new.before_state, '{}'::jsonb);
  return new;
end;
$$;

drop trigger if exists normalize_organization_audit_log on public.organization_audit_logs;
create trigger normalize_organization_audit_log
before insert or update on public.organization_audit_logs
for each row execute function public.normalize_organization_audit_log();

create index if not exists organization_audit_logs_org_time_idx
  on public.organization_audit_logs(organization_id, created_at desc);

create table if not exists public.processed_webhook_events (
  id text primary key,
  provider text not null default 'razorpay',
  event_type text not null,
  payload_summary jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

alter table public.organization_audit_logs enable row level security;
alter table public.processed_webhook_events enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.platform_audit_logs enable row level security;
alter table public.platform_demo_requests enable row level security;

-- Replace the CRM policy that used auth.uid(); Prepzii's Clerk JWT identity is `sub`.
drop policy if exists "Admins and Counsellors access leads" on public.organization_leads;
drop policy if exists organization_leads_manage on public.organization_leads;
create policy organization_leads_manage on public.organization_leads
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Sensitive tables use least-privilege reads. Parent access is deferred until
-- the reviewed guardian-link table exists; it is not inferred from membership.
drop policy if exists org_batch_members_read on public.organization_batch_members;
drop policy if exists org_batch_members_read on public.organization_batch_members;
create policy org_batch_members_read on public.organization_batch_members
  for select using (
    user_id = public.requesting_user_id()
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

drop policy if exists org_attendance_records_read on public.organization_attendance_records;
drop policy if exists org_attendance_records_read on public.organization_attendance_records;
create policy org_attendance_records_read on public.organization_attendance_records
  for select using (
    student_id = public.requesting_user_id()
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

drop policy if exists org_fee_installments_read on public.organization_fee_installments;
drop policy if exists org_fee_installments_read on public.organization_fee_installments;
create policy org_fee_installments_read on public.organization_fee_installments
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT'])
    or exists (
      select 1 from public.organization_student_fees fee
      where fee.id = student_fee_id
        and fee.organization_id = organization_fee_installments.organization_id
        and fee.student_id = public.requesting_user_id()
    )
  );

drop policy if exists org_student_fees_read on public.organization_student_fees;
drop policy if exists org_student_fees_read on public.organization_student_fees;
create policy org_student_fees_read on public.organization_student_fees
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT'])
    or student_id = public.requesting_user_id()
  );
drop policy if exists org_student_fees_manage on public.organization_student_fees;
drop policy if exists org_student_fees_manage on public.organization_student_fees;
create policy org_student_fees_manage on public.organization_student_fees
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']));

drop policy if exists organization_audit_logs_read on public.organization_audit_logs;
create policy organization_audit_logs_read on public.organization_audit_logs
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

drop policy if exists subscription_plans_read_active on public.subscription_plans;
create policy subscription_plans_read_active on public.subscription_plans
  for select using (is_active);
drop policy if exists organization_subscriptions_read on public.organization_subscriptions;
create policy organization_subscriptions_read on public.organization_subscriptions
  for select using (public.is_organization_member(organization_id));

-- No client policies are created for webhook events, platform audit logs, or
-- public demo requests. Only trusted server/service-role code may access them.


-- ---------------------------------------------------------------------
-- Migration: 0006_institute_onboarding.sql
-- ---------------------------------------------------------------------

-- Transactional and retry-safe institute onboarding.
-- This extends the canonical Prepzii public.institutes table.

alter table public.institutes add column if not exists institute_type text not null default 'COACHING';
alter table public.institutes add column if not exists contact_email text;
alter table public.institutes add column if not exists contact_phone text;
alter table public.institutes add column if not exists address jsonb not null default '{}'::jsonb;
alter table public.institutes add column if not exists primary_color text not null default '#FACC15';
alter table public.institutes add column if not exists timezone text not null default 'Asia/Kolkata';
alter table public.institutes add column if not exists updated_at timestamptz not null default now();

alter table public.institutes
  drop constraint if exists institutes_institute_type_check;
alter table public.institutes
  add constraint institutes_institute_type_check
  check (institute_type in ('COACHING', 'TUITION', 'SCHOOL', 'ONLINE_ACADEMY', 'INDIVIDUAL_TUTOR', 'OTHER'));

create or replace function public.lms_create_institute(
  owner_user_id text,
  owner_email text,
  institute_name text,
  institute_slug text,
  institute_kind text,
  institute_phone text,
  institute_city text,
  institute_state text
)
returns table (
  id uuid,
  name text,
  slug text,
  status text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  organization public.institutes%rowtype;
begin
  if owner_user_id is null or length(trim(owner_user_id)) = 0 then
    raise exception 'Owner identity is required' using errcode = '22023';
  end if;
  if owner_email is null or length(trim(owner_email)) = 0 then
    raise exception 'Verified owner email is required' using errcode = '22023';
  end if;

  -- Serialize competing requests for the same slug so retries cannot create
  -- partially duplicated workspaces or surface a false conflict to the owner.
  perform pg_advisory_xact_lock(hashtextextended(lower(institute_slug), 0));

  select * into organization
  from public.institutes existing
  where existing.slug = institute_slug
  for update;

  if found and organization.owner_user_id <> owner_user_id then
    raise exception 'Institute slug is already in use' using errcode = '23505';
  end if;

  if not found then
    insert into public.institutes (
      name,
      slug,
      owner_user_id,
      institute_type,
      contact_email,
      contact_phone,
      address,
      status
    ) values (
      institute_name,
      institute_slug,
      owner_user_id,
      institute_kind,
      lower(owner_email),
      nullif(institute_phone, ''),
      jsonb_build_object('city', institute_city, 'state', institute_state, 'country', 'IN'),
      'ACTIVE'
    ) returning * into organization;
  end if;

  insert into public.institute_members (
    institute_id,
    user_id,
    email,
    role,
    status
  ) values (
    organization.id,
    owner_user_id,
    lower(owner_email),
    'OWNER',
    'ACTIVE'
  )
  on conflict (institute_id, email) do update
    set user_id = excluded.user_id,
        role = 'OWNER',
        status = 'ACTIVE';

  insert into public.organization_subscriptions (
    organization_id,
    plan_id,
    status,
    current_period_start,
    current_period_end,
    trial_ends_at
  ) values (
    organization.id,
    'basic',
    'TRIAL',
    now(),
    now() + interval '14 days',
    now() + interval '14 days'
  ) on conflict (organization_id) do nothing;

  if not exists (
    select 1 from public.organization_audit_logs audit
    where audit.organization_id = organization.id
      and audit.actor_user_id = owner_user_id
      and audit.action = 'organization.created'
  ) then
    insert into public.organization_audit_logs (
      organization_id,
      actor_user_id,
      actor_role,
      action,
      entity_type,
      entity_id,
      after_state
    ) values (
      organization.id,
      owner_user_id,
      'OWNER',
      'organization.created',
      'institute',
      organization.id::text,
      jsonb_build_object('name', organization.name, 'slug', organization.slug)
    );
  end if;

  return query select organization.id, organization.name, organization.slug, organization.status;
end;
$$;

revoke all on function public.lms_create_institute(text, text, text, text, text, text, text, text) from public;
grant execute on function public.lms_create_institute(text, text, text, text, text, text, text, text) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0007_organization_invitations.sql
-- ---------------------------------------------------------------------

-- Secure, retry-safe organization invitations. Raw invitation tokens are never
-- persisted; only SHA-256 digests are stored. All RPCs are service-role only.

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  email text not null,
  role text not null check (role in (
    'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT'
  )),
  token_hash text not null unique check (length(token_hash) = 64),
  idempotency_key text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  invited_by text not null,
  accepted_by text,
  accepted_at timestamptz,
  revoked_by text,
  revoked_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists organization_invitations_org_time_idx
  on public.organization_invitations(organization_id, created_at desc);
create unique index if not exists organization_one_pending_invitation_per_email_idx
  on public.organization_invitations(organization_id, lower(email))
  where status = 'PENDING';

alter table public.organization_invitations enable row level security;

create or replace function public.lms_create_invitation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_email text,
  p_role text,
  p_token_hash text,
  p_idempotency_key text,
  p_expires_at timestamptz
)
returns table (
  invitation_id uuid,
  invitation_email text,
  invitation_role text,
  invitation_status text,
  invitation_expires_at timestamptz,
  invitation_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.organization_invitations%rowtype;
  created public.organization_invitations%rowtype;
  normalized_email text := lower(trim(p_email));
begin
  if p_role not in ('COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT') then
    raise exception 'Role cannot be invited' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'Invalid invitation expiry' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || normalized_email, 0));

  select * into existing
  from public.organization_invitations invitation
  where invitation.organization_id = p_organization_id
    and invitation.idempotency_key = p_idempotency_key;

  if found then
    if lower(existing.email) <> normalized_email or existing.role <> p_role then
      raise exception 'Idempotency key was used for another request' using errcode = '22023';
    end if;
    return query select existing.id, existing.email, existing.role, existing.status, existing.expires_at, existing.created_at;
    return;
  end if;

  update public.organization_invitations invitation
  set status = 'EXPIRED', updated_at = now()
  where invitation.organization_id = p_organization_id
    and lower(invitation.email) = normalized_email
    and invitation.status = 'PENDING'
    and invitation.expires_at <= now();

  if exists (
    select 1 from public.organization_invitations invitation
    where invitation.organization_id = p_organization_id
      and lower(invitation.email) = normalized_email
      and invitation.status = 'PENDING'
  ) then
    raise exception 'A pending invitation already exists for this email' using errcode = '23505';
  end if;

  insert into public.organization_invitations (
    organization_id, email, role, token_hash, idempotency_key, invited_by, expires_at
  ) values (
    p_organization_id, normalized_email, p_role, p_token_hash, p_idempotency_key, p_actor_user_id, p_expires_at
  ) returning * into created;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state, request_id
  ) values (
    p_organization_id,
    p_actor_user_id,
    p_actor_role,
    'invitation.created',
    'organization_invitation',
    created.id::text,
    jsonb_build_object('email', created.email, 'role', created.role, 'expires_at', created.expires_at),
    p_idempotency_key
  );

  return query select created.id, created.email, created.role, created.status, created.expires_at, created.created_at;
end;
$$;

create or replace function public.lms_accept_invitation(
  p_token_hash text,
  p_user_id text,
  p_verified_email text
)
returns table (
  invitation_status text,
  organization_id uuid,
  organization_slug text,
  membership_role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.organization_invitations%rowtype;
  member public.institute_members%rowtype;
  institute_slug text;
  normalized_email text := lower(trim(p_verified_email));
begin
  select * into invitation
  from public.organization_invitations candidate
  where candidate.token_hash = p_token_hash
  for update;

  if not found or lower(invitation.email) <> normalized_email then
    raise exception 'Invitation is invalid' using errcode = 'P0002';
  end if;

  select institute.slug into institute_slug
  from public.institutes institute
  where institute.id = invitation.organization_id and institute.status = 'ACTIVE';
  if institute_slug is null then
    raise exception 'Invitation is invalid' using errcode = 'P0002';
  end if;

  if invitation.status = 'ACCEPTED' and invitation.accepted_by = p_user_id then
    return query select invitation.status, invitation.organization_id, institute_slug, invitation.role;
    return;
  end if;
  if invitation.status <> 'PENDING' then
    return query select invitation.status, invitation.organization_id, institute_slug, invitation.role;
    return;
  end if;
  if invitation.expires_at <= now() then
    update public.organization_invitations set status = 'EXPIRED', updated_at = now() where id = invitation.id;
    return query select 'EXPIRED'::text, invitation.organization_id, institute_slug, invitation.role;
    return;
  end if;

  select * into member
  from public.institute_members existing
  where existing.institute_id = invitation.organization_id
    and lower(existing.email) = normalized_email
  for update;

  if found and member.user_id is not null and member.user_id <> p_user_id then
    raise exception 'Membership belongs to another identity' using errcode = '23505';
  end if;

  if found then
    update public.institute_members
    set user_id = p_user_id, role = invitation.role, status = 'ACTIVE'
    where id = member.id;
  else
    insert into public.institute_members (institute_id, user_id, email, role, status)
    values (invitation.organization_id, p_user_id, normalized_email, invitation.role, 'ACTIVE');
  end if;

  update public.organization_invitations
  set status = 'ACCEPTED', accepted_by = p_user_id, accepted_at = now(), updated_at = now()
  where id = invitation.id;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    invitation.organization_id,
    p_user_id,
    invitation.role,
    'invitation.accepted',
    'organization_invitation',
    invitation.id::text,
    jsonb_build_object('email', normalized_email, 'role', invitation.role)
  );

  return query select 'ACCEPTED'::text, invitation.organization_id, institute_slug, invitation.role;
end;
$$;

create or replace function public.lms_revoke_invitation(
  p_organization_id uuid,
  p_invitation_id uuid,
  p_actor_user_id text,
  p_actor_role text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.organization_invitations%rowtype;
begin
  select * into invitation
  from public.organization_invitations candidate
  where candidate.id = p_invitation_id and candidate.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if invitation.status = 'ACCEPTED' then
    raise exception 'Accepted invitation cannot be revoked' using errcode = '55000';
  end if;
  if invitation.status = 'PENDING' then
    update public.organization_invitations
    set status = case when expires_at <= now() then 'EXPIRED' else 'REVOKED' end,
        revoked_by = case when expires_at > now() then p_actor_user_id else revoked_by end,
        revoked_at = case when expires_at > now() then now() else revoked_at end,
        updated_at = now()
    where id = invitation.id
    returning * into invitation;

    insert into public.organization_audit_logs (
      organization_id, actor_user_id, actor_role, action, entity_type, entity_id, before_state, after_state
    ) values (
      p_organization_id,
      p_actor_user_id,
      p_actor_role,
      case when invitation.status = 'EXPIRED' then 'invitation.expired' else 'invitation.revoked' end,
      'organization_invitation',
      invitation.id::text,
      jsonb_build_object('status', 'PENDING'),
      jsonb_build_object('status', invitation.status)
    );
  end if;
  return invitation.status;
end;
$$;

revoke all on function public.lms_create_invitation(uuid, text, text, text, text, text, text, timestamptz) from public;
revoke all on function public.lms_accept_invitation(text, text, text) from public;
revoke all on function public.lms_revoke_invitation(uuid, uuid, text, text) from public;
grant execute on function public.lms_create_invitation(uuid, text, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.lms_accept_invitation(text, text, text) to service_role;
grant execute on function public.lms_revoke_invitation(uuid, uuid, text, text) to service_role;

-- No browser policy is created. Invitation metadata and token hashes are only
-- accessed through membership-verified server routes.


-- ---------------------------------------------------------------------
-- Migration: 0008_member_profiles_directory.sql
-- ---------------------------------------------------------------------

-- Tenant-bound member profiles and paginated directory functions.

alter table public.institute_members
  add constraint institute_members_id_institute_unique unique (id, institute_id);

create table public.organization_member_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  membership_id uuid not null unique,
  display_name text not null,
  phone text,
  alternate_phone text,
  roll_number text,
  employee_code text,
  guardian_name text,
  guardian_phone text,
  qualification text,
  subject_specialization text,
  joined_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_member_profiles_member_org_fk
    foreign key (membership_id, organization_id)
    references public.institute_members(id, institute_id) on delete cascade
);

create index organization_member_profiles_org_name_idx
  on public.organization_member_profiles(organization_id, lower(display_name));
create unique index organization_member_profiles_roll_unique
  on public.organization_member_profiles(organization_id, lower(roll_number))
  where roll_number is not null;
create unique index organization_member_profiles_employee_unique
  on public.organization_member_profiles(organization_id, lower(employee_code))
  where employee_code is not null;

alter table public.organization_member_profiles enable row level security;
drop policy if exists organization_member_profiles_read on public.organization_member_profiles;
create policy organization_member_profiles_read on public.organization_member_profiles
  for select using (
    public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'ACCOUNTANT']
    )
    or exists (
      select 1 from public.institute_members member
      where member.id = membership_id and member.user_id = public.requesting_user_id()
    )
  );
drop policy if exists organization_member_profiles_manage on public.organization_member_profiles;
create policy organization_member_profiles_manage on public.organization_member_profiles
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

create or replace function public.lms_list_members(
  p_organization_id uuid,
  p_role text default null,
  p_status text default null,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  member_id uuid,
  user_id text,
  email text,
  member_role text,
  member_status text,
  display_name text,
  phone text,
  alternate_phone text,
  roll_number text,
  employee_code text,
  guardian_name text,
  guardian_phone text,
  qualification text,
  subject_specialization text,
  joined_on date,
  batches jsonb,
  created_at timestamptz,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    member.id,
    member.user_id,
    member.email,
    member.role,
    member.status,
    coalesce(profile.display_name, member.email),
    profile.phone,
    profile.alternate_phone,
    profile.roll_number,
    profile.employee_code,
    profile.guardian_name,
    profile.guardian_phone,
    profile.qualification,
    profile.subject_specialization,
    profile.joined_on,
    coalesce(
      jsonb_agg(
        distinct jsonb_build_object('id', batch.id, 'name', batch.name, 'targetExam', batch.target_exam)
      ) filter (where batch.id is not null),
      '[]'::jsonb
    ),
    member.created_at,
    count(*) over()
  from public.institute_members member
  left join public.organization_member_profiles profile
    on profile.membership_id = member.id and profile.organization_id = member.institute_id
  left join public.organization_batch_members batch_member
    on batch_member.organization_id = member.institute_id
    and batch_member.user_id = member.user_id
    and batch_member.role = member.role
  left join public.organization_batches batch
    on batch.id = batch_member.batch_id and batch.organization_id = member.institute_id
  where member.institute_id = p_organization_id
    and (p_role is null or member.role = p_role)
    and (p_status is null or member.status = p_status)
    and (
      nullif(trim(p_search), '') is null
      or lower(member.email) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(profile.display_name, '')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(profile.roll_number, '')) like '%' || lower(trim(p_search)) || '%'
      or lower(coalesce(profile.employee_code, '')) like '%' || lower(trim(p_search)) || '%'
    )
  group by member.id, profile.id
  order by lower(coalesce(profile.display_name, member.email)), member.id
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.lms_update_member_profile(
  p_organization_id uuid,
  p_member_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_role text,
  p_status text,
  p_display_name text,
  p_phone text,
  p_alternate_phone text,
  p_roll_number text,
  p_employee_code text,
  p_guardian_name text,
  p_guardian_phone text,
  p_qualification text,
  p_subject_specialization text,
  p_joined_on date
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  member public.institute_members%rowtype;
  before_state jsonb;
begin
  if p_role not in ('COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT') then
    raise exception 'Invalid role' using errcode = '22023';
  end if;
  if p_status not in ('ACTIVE', 'INACTIVE', 'SUSPENDED') then
    raise exception 'Invalid status' using errcode = '22023';
  end if;
  if nullif(trim(p_display_name), '') is null then
    raise exception 'Display name is required' using errcode = '22023';
  end if;

  select * into member
  from public.institute_members candidate
  where candidate.id = p_member_id and candidate.institute_id = p_organization_id
  for update;
  if not found then
    raise exception 'Member not found' using errcode = 'P0002';
  end if;

  before_state := jsonb_build_object('role', member.role, 'status', member.status);
  update public.institute_members
  set role = p_role, status = p_status
  where id = member.id;

  insert into public.organization_member_profiles (
    organization_id, membership_id, display_name, phone, alternate_phone,
    roll_number, employee_code, guardian_name, guardian_phone, qualification,
    subject_specialization, joined_on
  ) values (
    p_organization_id, member.id, trim(p_display_name), nullif(trim(p_phone), ''),
    nullif(trim(p_alternate_phone), ''), nullif(trim(p_roll_number), ''),
    nullif(trim(p_employee_code), ''), nullif(trim(p_guardian_name), ''),
    nullif(trim(p_guardian_phone), ''), nullif(trim(p_qualification), ''),
    nullif(trim(p_subject_specialization), ''), p_joined_on
  )
  on conflict (membership_id) do update set
    display_name = excluded.display_name,
    phone = excluded.phone,
    alternate_phone = excluded.alternate_phone,
    roll_number = excluded.roll_number,
    employee_code = excluded.employee_code,
    guardian_name = excluded.guardian_name,
    guardian_phone = excluded.guardian_phone,
    qualification = excluded.qualification,
    subject_specialization = excluded.subject_specialization,
    joined_on = excluded.joined_on,
    updated_at = now();

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, before_state, after_state
  ) values (
    p_organization_id,
    p_actor_user_id,
    p_actor_role,
    'member.profile_updated',
    'institute_member',
    member.id::text,
    before_state,
    jsonb_build_object('role', p_role, 'status', p_status, 'display_name', trim(p_display_name))
  );
  return member.id;
end;
$$;

revoke all on function public.lms_list_members(uuid, text, text, text, integer, integer) from public;
revoke all on function public.lms_update_member_profile(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, date) from public;
grant execute on function public.lms_list_members(uuid, text, text, text, integer, integer) to service_role;
grant execute on function public.lms_update_member_profile(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, date) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0009_member_csv_imports.sql
-- ---------------------------------------------------------------------

-- Two-step CSV imports: immutable validation staging followed by an atomic,
-- idempotent commit. Imported identities remain PENDING until invite acceptance.

create table public.organization_member_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null check (length(request_hash) = 64),
  file_name text not null,
  member_role text not null check (member_role in ('STUDENT', 'TEACHER')),
  status text not null check (status in ('VALIDATED', 'INVALID', 'COMMITTED')),
  total_rows integer not null check (total_rows > 0),
  valid_rows integer not null check (valid_rows >= 0),
  invalid_rows integer not null check (invalid_rows >= 0),
  created_by text not null,
  committed_by text,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique (id, organization_id),
  check (valid_rows + invalid_rows = total_rows)
);

create table public.organization_member_import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  import_id uuid not null,
  row_number integer not null check (row_number >= 2),
  raw_data jsonb not null,
  normalized_data jsonb,
  errors text[] not null default '{}',
  status text not null check (status in ('VALID', 'INVALID', 'COMMITTED')),
  resulting_member_id uuid references public.institute_members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (import_id, row_number),
  constraint organization_member_import_rows_import_org_fk
    foreign key (import_id, organization_id)
    references public.organization_member_imports(id, organization_id) on delete cascade
);

create index organization_member_imports_org_time_idx
  on public.organization_member_imports(organization_id, created_at desc);
create index organization_member_import_rows_import_idx
  on public.organization_member_import_rows(import_id, row_number);

alter table public.organization_member_imports enable row level security;
alter table public.organization_member_import_rows enable row level security;

create or replace function public.lms_stage_member_import(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_idempotency_key text,
  p_request_hash text,
  p_file_name text,
  p_member_role text,
  p_rows jsonb
)
returns table (
  import_id uuid,
  import_status text,
  total_rows integer,
  valid_rows integer,
  invalid_rows integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.organization_member_imports%rowtype;
  created public.organization_member_imports%rowtype;
  row_count integer;
  valid_count integer;
begin
  if p_member_role not in ('STUDENT', 'TEACHER') then
    raise exception 'Invalid import role' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows must be an array' using errcode = '22023';
  end if;
  row_count := jsonb_array_length(p_rows);
  if row_count < 1 or row_count > 1000 then
    raise exception 'Import must contain between 1 and 1000 rows' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_idempotency_key, 0));
  select * into existing
  from public.organization_member_imports candidate
  where candidate.organization_id = p_organization_id
    and candidate.idempotency_key = p_idempotency_key;
  if found then
    if existing.request_hash <> p_request_hash then
      raise exception 'Idempotency key was used for another import' using errcode = '22023';
    end if;
    return query select existing.id, existing.status, existing.total_rows, existing.valid_rows, existing.invalid_rows, existing.created_at;
    return;
  end if;

  select count(*) into valid_count
  from jsonb_array_elements(p_rows) item
  where jsonb_array_length(item -> 'errors') = 0 and item -> 'normalizedData' <> 'null'::jsonb;

  insert into public.organization_member_imports (
    organization_id, idempotency_key, request_hash, file_name, member_role,
    status, total_rows, valid_rows, invalid_rows, created_by
  ) values (
    p_organization_id, p_idempotency_key, p_request_hash, p_file_name, p_member_role,
    case when valid_count = row_count then 'VALIDATED' else 'INVALID' end,
    row_count, valid_count, row_count - valid_count, p_actor_user_id
  ) returning * into created;

  insert into public.organization_member_import_rows (
    organization_id, import_id, row_number, raw_data, normalized_data, errors, status
  )
  select
    p_organization_id,
    created.id,
    (item ->> 'rowNumber')::integer,
    item -> 'rawData',
    item -> 'normalizedData',
    array(select jsonb_array_elements_text(item -> 'errors')),
    case when jsonb_array_length(item -> 'errors') = 0 then 'VALID' else 'INVALID' end
  from jsonb_array_elements(p_rows) item;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state, request_id
  ) values (
    p_organization_id,
    p_actor_user_id,
    p_actor_role,
    'member_import.staged',
    'organization_member_import',
    created.id::text,
    jsonb_build_object('role', p_member_role, 'total', row_count, 'valid', valid_count),
    p_idempotency_key
  );

  return query select created.id, created.status, created.total_rows, created.valid_rows, created.invalid_rows, created.created_at;
end;
$$;

create or replace function public.lms_commit_member_import(
  p_organization_id uuid,
  p_import_id uuid,
  p_actor_user_id text,
  p_actor_role text
)
returns table (import_status text, committed_rows integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  import_job public.organization_member_imports%rowtype;
  staged_row public.organization_member_import_rows%rowtype;
  member public.institute_members%rowtype;
  data jsonb;
  affected integer := 0;
begin
  select * into import_job
  from public.organization_member_imports candidate
  where candidate.id = p_import_id and candidate.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Import not found' using errcode = 'P0002';
  end if;
  if import_job.status = 'COMMITTED' then
    return query select import_job.status, import_job.valid_rows;
    return;
  end if;
  if import_job.status <> 'VALIDATED' or import_job.invalid_rows > 0 then
    raise exception 'Import contains validation errors' using errcode = '22023';
  end if;

  for staged_row in
    select * from public.organization_member_import_rows candidate
    where candidate.import_id = import_job.id and candidate.organization_id = p_organization_id
    order by candidate.row_number
    for update
  loop
    data := staged_row.normalized_data;
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || lower(data ->> 'email'), 0));
    select * into member
    from public.institute_members candidate
    where candidate.institute_id = p_organization_id
      and lower(candidate.email) = lower(data ->> 'email')
    for update;

    if found and member.role <> import_job.member_role then
      raise exception 'Existing member has a different role: %', data ->> 'email' using errcode = '23505';
    end if;
    if not found then
      insert into public.institute_members (institute_id, email, role, status)
      values (p_organization_id, lower(data ->> 'email'), import_job.member_role, 'PENDING')
      returning * into member;
    end if;

    insert into public.organization_member_profiles (
      organization_id, membership_id, display_name, phone, alternate_phone,
      roll_number, employee_code, guardian_name, guardian_phone, qualification,
      subject_specialization, joined_on
    ) values (
      p_organization_id,
      member.id,
      data ->> 'displayName',
      data ->> 'phone',
      data ->> 'alternatePhone',
      data ->> 'rollNumber',
      data ->> 'employeeCode',
      data ->> 'guardianName',
      data ->> 'guardianPhone',
      data ->> 'qualification',
      data ->> 'subjectSpecialization',
      nullif(data ->> 'joinedOn', '')::date
    )
    on conflict (membership_id) do update set
      display_name = excluded.display_name,
      phone = excluded.phone,
      alternate_phone = excluded.alternate_phone,
      roll_number = excluded.roll_number,
      employee_code = excluded.employee_code,
      guardian_name = excluded.guardian_name,
      guardian_phone = excluded.guardian_phone,
      qualification = excluded.qualification,
      subject_specialization = excluded.subject_specialization,
      joined_on = excluded.joined_on,
      updated_at = now();

    update public.organization_member_import_rows
    set status = 'COMMITTED', resulting_member_id = member.id
    where id = staged_row.id;
    affected := affected + 1;
  end loop;

  update public.organization_member_imports
  set status = 'COMMITTED', committed_by = p_actor_user_id, committed_at = now()
  where id = import_job.id;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id,
    p_actor_user_id,
    p_actor_role,
    'member_import.committed',
    'organization_member_import',
    import_job.id::text,
    jsonb_build_object('role', import_job.member_role, 'committed_rows', affected)
  );
  return query select 'COMMITTED'::text, affected;
end;
$$;

revoke all on function public.lms_stage_member_import(uuid, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.lms_commit_member_import(uuid, uuid, text, text) from public;
grant execute on function public.lms_stage_member_import(uuid, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.lms_commit_member_import(uuid, uuid, text, text) to service_role;

-- No browser RLS policies are created. Validation payloads can contain PII and
-- are exposed only through membership-verified server routes.


-- ---------------------------------------------------------------------
-- Migration: 0010_academic_operations.sql
-- ---------------------------------------------------------------------

-- Transactional academic operations and conflict-safe timetable slots.

alter table public.organization_room_schedules add column if not exists starts_at time;
alter table public.organization_room_schedules add column if not exists ends_at time;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_room_schedule_time_check'
  ) then
    alter table public.organization_room_schedules
      add constraint organization_room_schedule_time_check
      check (starts_at is null or (ends_at is not null and ends_at > starts_at));
  end if;
end;
$$;

create or replace function public.prevent_room_schedule_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.starts_at is null or new.ends_at is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.room_id::text || ':' || new.day_of_week, 0));
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.batch_id::text, '') || ':' || new.day_of_week, 1));
  perform pg_advisory_xact_lock(hashtextextended(new.faculty_id || ':' || new.day_of_week, 2));
  if exists (
    select 1 from public.organization_room_schedules existing
    where existing.organization_id = new.organization_id
      and existing.day_of_week = new.day_of_week
      and existing.id <> new.id
      and existing.starts_at is not null
      and existing.starts_at < new.ends_at
      and existing.ends_at > new.starts_at
      and (
        existing.room_id = new.room_id
        or (new.batch_id is not null and existing.batch_id = new.batch_id)
        or existing.faculty_id = new.faculty_id
      )
  ) then
    raise exception 'Room, batch, or faculty schedule overlaps an existing slot' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_room_schedule_overlap_guard on public.organization_room_schedules;
create trigger organization_room_schedule_overlap_guard
before insert or update on public.organization_room_schedules
for each row execute function public.prevent_room_schedule_overlap();

create or replace function public.lms_academic_mutation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
  member public.institute_members%rowtype;
  batch public.organization_batches%rowtype;
  room public.organization_campus_rooms%rowtype;
  result jsonb;
begin
  case p_action
    when 'CREATE_ACADEMIC_YEAR' then
      if coalesce((p_payload ->> 'isActive')::boolean, false) then
        update public.organization_academic_years
        set is_active = false
        where organization_id = p_organization_id and is_active;
      end if;
      insert into public.organization_academic_years (organization_id, name, starts_on, ends_on, is_active)
      values (p_organization_id, p_payload ->> 'name', (p_payload ->> 'startsOn')::date, (p_payload ->> 'endsOn')::date, coalesce((p_payload ->> 'isActive')::boolean, false))
      returning id into created_id;
    when 'CREATE_CAMPUS' then
      insert into public.organization_campuses (organization_id, name, address)
      values (p_organization_id, p_payload ->> 'name', coalesce(p_payload -> 'address', '{}'::jsonb))
      returning id into created_id;
    when 'CREATE_SUBJECT' then
      insert into public.organization_subjects (organization_id, name, code)
      values (p_organization_id, p_payload ->> 'name', nullif(p_payload ->> 'code', ''))
      returning id into created_id;
    when 'CREATE_BATCH' then
      if nullif(p_payload ->> 'campusId', '') is not null and not exists (
        select 1 from public.organization_campuses where id = (p_payload ->> 'campusId')::uuid and organization_id = p_organization_id
      ) then raise exception 'Campus is outside organization' using errcode = '23503'; end if;
      if nullif(p_payload ->> 'academicYearId', '') is not null and not exists (
        select 1 from public.organization_academic_years where id = (p_payload ->> 'academicYearId')::uuid and organization_id = p_organization_id
      ) then raise exception 'Academic year is outside organization' using errcode = '23503'; end if;
      insert into public.organization_batches (organization_id, campus_id, academic_year_id, name, target_exam, grade_level, room_number)
      values (p_organization_id, nullif(p_payload ->> 'campusId', '')::uuid, nullif(p_payload ->> 'academicYearId', '')::uuid, p_payload ->> 'name', p_payload ->> 'targetExam', nullif(p_payload ->> 'gradeLevel', ''), nullif(p_payload ->> 'roomNumber', ''))
      returning id into created_id;
    when 'CREATE_COURSE' then
      if nullif(p_payload ->> 'subjectId', '') is not null and not exists (
        select 1 from public.organization_subjects where id = (p_payload ->> 'subjectId')::uuid and organization_id = p_organization_id
      ) then raise exception 'Subject is outside organization' using errcode = '23503'; end if;
      insert into public.organization_courses (organization_id, subject_id, title, description, status, created_by)
      values (p_organization_id, nullif(p_payload ->> 'subjectId', '')::uuid, p_payload ->> 'title', nullif(p_payload ->> 'description', ''), 'DRAFT', p_actor_user_id)
      returning id into created_id;
    when 'ENROLL_MEMBER' then
      select * into member from public.institute_members candidate
      where candidate.id = (p_payload ->> 'memberId')::uuid and candidate.institute_id = p_organization_id and candidate.status = 'ACTIVE';
      if not found or member.user_id is null or member.role not in ('STUDENT', 'TEACHER') then
        raise exception 'Active student or teacher membership required' using errcode = '23503';
      end if;
      select * into batch from public.organization_batches candidate
      where candidate.id = (p_payload ->> 'batchId')::uuid and candidate.organization_id = p_organization_id;
      if not found then raise exception 'Batch not found' using errcode = '23503'; end if;
      insert into public.organization_batch_members (organization_id, batch_id, user_id, role, roll_number)
      values (p_organization_id, batch.id, member.user_id, member.role, nullif(p_payload ->> 'rollNumber', ''))
      on conflict (batch_id, user_id) do update set role = excluded.role, roll_number = excluded.roll_number
      returning id into created_id;
    when 'CREATE_ROOM' then
      if not exists (select 1 from public.organization_campuses where id = (p_payload ->> 'campusId')::uuid and organization_id = p_organization_id) then
        raise exception 'Campus not found' using errcode = '23503';
      end if;
      insert into public.organization_campus_rooms (organization_id, campus_id, name, capacity, facilities)
      values (p_organization_id, (p_payload ->> 'campusId')::uuid, p_payload ->> 'name', (p_payload ->> 'capacity')::integer, array(select jsonb_array_elements_text(coalesce(p_payload -> 'facilities', '[]'::jsonb))))
      returning id into created_id;
    when 'CREATE_SCHEDULE' then
      select * into room from public.organization_campus_rooms candidate
      where candidate.id = (p_payload ->> 'roomId')::uuid and candidate.organization_id = p_organization_id;
      if not found then raise exception 'Room not found' using errcode = '23503'; end if;
      select * into batch from public.organization_batches candidate
      where candidate.id = (p_payload ->> 'batchId')::uuid and candidate.organization_id = p_organization_id;
      if not found then raise exception 'Batch not found' using errcode = '23503'; end if;
      select * into member from public.institute_members candidate
      where candidate.id = (p_payload ->> 'facultyMemberId')::uuid and candidate.institute_id = p_organization_id
        and candidate.status = 'ACTIVE' and candidate.role in ('TEACHER', 'ACADEMIC_COORDINATOR');
      if not found or member.user_id is null then raise exception 'Active faculty member required' using errcode = '23503'; end if;
      insert into public.organization_room_schedules (
        organization_id, room_id, batch_id, faculty_id, time_slot, subject, day_of_week, starts_at, ends_at
      ) values (
        p_organization_id, room.id, batch.id, member.user_id,
        (p_payload ->> 'startsAt') || '–' || (p_payload ->> 'endsAt'), p_payload ->> 'subject',
        p_payload ->> 'dayOfWeek', (p_payload ->> 'startsAt')::time, (p_payload ->> 'endsAt')::time
      ) returning id into created_id;
    else raise exception 'Unsupported academic action' using errcode = '22023';
  end case;

  result := jsonb_build_object('id', created_id, 'action', p_action);
  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'academic_operation', created_id::text, p_payload
  );
  return result;
end;
$$;

revoke all on function public.lms_academic_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_academic_mutation(uuid, text, text, text, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0011_learning_delivery.sql
-- ---------------------------------------------------------------------

-- Tenant-scoped learning delivery, private resources, release rules, and progress.

alter table public.organization_course_modules add column if not exists is_published boolean not null default false;
alter table public.organization_course_modules add column if not exists release_at timestamptz;
alter table public.organization_course_modules add column if not exists updated_at timestamptz not null default now();

alter table public.organization_course_lessons add column if not exists description text;
alter table public.organization_course_lessons add column if not exists learning_objectives text[] not null default '{}';
alter table public.organization_course_lessons add column if not exists release_at timestamptz;
alter table public.organization_course_lessons add column if not exists updated_at timestamptz not null default now();
alter table public.organization_course_lessons alter column is_published set default false;
alter table public.organization_course_lessons add constraint organization_lessons_id_org_unique unique (id, organization_id);

create table if not exists public.organization_course_batches (
  organization_id uuid not null references public.institutes(id) on delete cascade,
  course_id uuid not null,
  batch_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, course_id, batch_id),
  foreign key (course_id, organization_id) references public.organization_courses(id, organization_id) on delete cascade,
  foreign key (batch_id, organization_id) references public.organization_batches(id, organization_id) on delete cascade
);

create table if not exists public.organization_lesson_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  lesson_id uuid not null,
  name text not null,
  resource_type text not null check (resource_type in ('FILE', 'EXTERNAL_LINK')),
  storage_bucket text,
  storage_path text,
  external_url text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  download_allowed boolean not null default true,
  processing_status text not null default 'READY' check (processing_status in ('PENDING', 'READY', 'REJECTED')),
  created_by text not null,
  created_at timestamptz not null default now(),
  check (
    (resource_type = 'FILE' and storage_bucket is not null and storage_path is not null and external_url is null)
    or (resource_type = 'EXTERNAL_LINK' and external_url is not null and storage_bucket is null and storage_path is null)
  ),
  foreign key (lesson_id, organization_id) references public.organization_course_lessons(id, organization_id) on delete cascade,
  unique (organization_id, storage_bucket, storage_path)
);

create table if not exists public.organization_lesson_progress (
  organization_id uuid not null references public.institutes(id) on delete cascade,
  lesson_id uuid not null,
  user_id text not null,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  last_accessed_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (organization_id, lesson_id, user_id),
  foreign key (lesson_id, organization_id) references public.organization_course_lessons(id, organization_id) on delete cascade
);

create index if not exists organization_course_batches_batch_idx on public.organization_course_batches(organization_id, batch_id);
create index if not exists organization_lesson_resources_lesson_idx on public.organization_lesson_resources(organization_id, lesson_id);
create index if not exists organization_lesson_progress_user_idx on public.organization_lesson_progress(organization_id, user_id, last_accessed_at desc);

alter table public.organization_course_batches enable row level security;
alter table public.organization_lesson_resources enable row level security;
alter table public.organization_lesson_progress enable row level security;

create or replace function public.can_access_organization_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_courses course
    where course.id = target_course_id
      and (
        public.has_organization_role(course.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
        or (
          exists (
            select 1
            from public.organization_course_batches link
            join public.organization_batch_members enrollment
              on enrollment.organization_id = link.organization_id and enrollment.batch_id = link.batch_id
            where link.organization_id = course.organization_id
              and link.course_id = course.id
              and enrollment.user_id = public.requesting_user_id()
              and (
                (enrollment.role = 'TEACHER' and public.has_organization_role(course.organization_id, array['TEACHER']))
                or (
                  enrollment.role = 'STUDENT'
                  and course.status = 'PUBLISHED'
                  and public.has_organization_role(course.organization_id, array['STUDENT'])
                )
              )
          )
        )
      )
  );
$$;

drop policy if exists org_modules_read on public.organization_course_modules;
drop policy if exists org_modules_read on public.organization_course_modules;
create policy org_modules_read on public.organization_course_modules
  for select using (
    public.can_access_organization_course(course_id)
    and (
      public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
      or (is_published and (release_at is null or release_at <= now()))
    )
  );

drop policy if exists org_modules_manage on public.organization_course_modules;

drop policy if exists org_lessons_read on public.organization_course_lessons;
drop policy if exists org_lessons_read on public.organization_course_lessons;
create policy org_lessons_read on public.organization_course_lessons
  for select using (
    exists (
      select 1 from public.organization_course_modules module
      where module.id = module_id
        and module.organization_id = organization_course_lessons.organization_id
        and public.can_access_organization_course(module.course_id)
        and (
          public.has_organization_role(module.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
          or (
            module.is_published and (module.release_at is null or module.release_at <= now())
            and organization_course_lessons.is_published
            and (organization_course_lessons.release_at is null or organization_course_lessons.release_at <= now())
          )
        )
    )
  );

drop policy if exists org_lessons_manage on public.organization_course_lessons;

drop policy if exists organization_course_batches_read on public.organization_course_batches;
create policy organization_course_batches_read on public.organization_course_batches
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or exists (
      select 1 from public.organization_batch_members enrollment
      where enrollment.organization_id = organization_course_batches.organization_id
        and enrollment.batch_id = organization_course_batches.batch_id
        and enrollment.user_id = public.requesting_user_id()
    )
  );

drop policy if exists organization_lesson_resources_read on public.organization_lesson_resources;
create policy organization_lesson_resources_read on public.organization_lesson_resources
  for select using (
    exists (
      select 1
      from public.organization_course_lessons lesson
      join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
      where lesson.id = lesson_id
        and lesson.organization_id = organization_lesson_resources.organization_id
        and public.can_access_organization_course(module.course_id)
        and (
          public.has_organization_role(lesson.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
          or (
            module.is_published and (module.release_at is null or module.release_at <= now())
            and lesson.is_published and (lesson.release_at is null or lesson.release_at <= now())
          )
        )
    )
  );

drop policy if exists organization_lesson_progress_read on public.organization_lesson_progress;
create policy organization_lesson_progress_read on public.organization_lesson_progress
  for select using (
    user_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or (
      public.has_organization_role(organization_id, array['TEACHER'])
      and exists (
        select 1
        from public.organization_course_lessons lesson
        join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
        where lesson.id = lesson_id
          and lesson.organization_id = organization_lesson_progress.organization_id
          and public.can_access_organization_course(module.course_id)
      )
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-learning',
  'organization-learning',
  false,
  26214400,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.lms_actor_can_access_course(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_courses course
    where course.id = p_course_id and course.organization_id = p_organization_id
      and (
        p_actor_role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR')
        or (
          p_actor_role in ('STUDENT', 'TEACHER')
          and (p_actor_role = 'TEACHER' or course.status = 'PUBLISHED')
          and exists (
            select 1
            from public.organization_course_batches link
            join public.organization_batch_members enrollment
              on enrollment.organization_id = link.organization_id and enrollment.batch_id = link.batch_id
            where link.organization_id = p_organization_id and link.course_id = course.id
              and enrollment.user_id = p_actor_user_id and enrollment.role = p_actor_role
          )
        )
      )
  );
$$;

create or replace function public.lms_learning_mutation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
  target_course_id uuid;
  target_module_id uuid;
  target_lesson_id uuid;
  result jsonb;
begin
  if p_action <> 'MARK_COMPLETE' and p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Role cannot manage learning content' using errcode = '42501';
  end if;
  if p_actor_role = 'TEACHER' and p_action in ('LINK_BATCH', 'PUBLISH_COURSE') then
    raise exception 'Teachers cannot assign batches or publish courses' using errcode = '42501';
  end if;

  if p_action = 'LINK_BATCH' then
    target_course_id := (p_payload ->> 'courseId')::uuid;
    if not exists (select 1 from public.organization_courses where id = target_course_id and organization_id = p_organization_id)
      or not exists (select 1 from public.organization_batches where id = (p_payload ->> 'batchId')::uuid and organization_id = p_organization_id)
    then raise exception 'Course or batch not found' using errcode = '23503'; end if;
    insert into public.organization_course_batches (organization_id, course_id, batch_id)
    values (p_organization_id, target_course_id, (p_payload ->> 'batchId')::uuid)
    on conflict do nothing;
    created_id := target_course_id;
  elsif p_action = 'CREATE_MODULE' then
    target_course_id := (p_payload ->> 'courseId')::uuid;
    if not exists (select 1 from public.organization_courses where id = target_course_id and organization_id = p_organization_id)
    then raise exception 'Course not found' using errcode = '23503'; end if;
    insert into public.organization_course_modules (organization_id, course_id, title, description, order_index, is_published, release_at)
    values (p_organization_id, target_course_id, p_payload ->> 'title', nullif(p_payload ->> 'description', ''), coalesce((p_payload ->> 'orderIndex')::integer, 0), false, nullif(p_payload ->> 'releaseAt', '')::timestamptz)
    returning id into created_id;
  elsif p_action = 'CREATE_LESSON' then
    target_module_id := (p_payload ->> 'moduleId')::uuid;
    select course_id into target_course_id from public.organization_course_modules
    where id = target_module_id and organization_id = p_organization_id;
    if not found then raise exception 'Module not found' using errcode = '23503'; end if;
    insert into public.organization_course_lessons (
      organization_id, module_id, title, kind, description, learning_objectives, duration_minutes, order_index, is_published, release_at
    ) values (
      p_organization_id, target_module_id, p_payload ->> 'title', p_payload ->> 'kind', nullif(p_payload ->> 'description', ''),
      array(select jsonb_array_elements_text(coalesce(p_payload -> 'learningObjectives', '[]'::jsonb))),
      nullif(p_payload ->> 'durationMinutes', '')::integer, coalesce((p_payload ->> 'orderIndex')::integer, 0), false,
      nullif(p_payload ->> 'releaseAt', '')::timestamptz
    ) returning id into created_id;
  elsif p_action = 'REORDER_MODULE' then
    update public.organization_course_modules set order_index = (p_payload ->> 'orderIndex')::integer, updated_at = now()
    where id = (p_payload ->> 'moduleId')::uuid and organization_id = p_organization_id
    returning id, course_id into created_id, target_course_id;
    if not found then raise exception 'Module not found' using errcode = '23503'; end if;
  elsif p_action in ('PUBLISH_COURSE', 'PUBLISH_MODULE', 'PUBLISH_LESSON') then
    if p_action = 'PUBLISH_COURSE' then
      target_course_id := (p_payload ->> 'courseId')::uuid;
      update public.organization_courses set status = case when (p_payload ->> 'published')::boolean then 'PUBLISHED' else 'DRAFT' end, updated_at = now()
      where id = target_course_id and organization_id = p_organization_id returning id into created_id;
    elsif p_action = 'PUBLISH_MODULE' then
      update public.organization_course_modules set is_published = (p_payload ->> 'published')::boolean, updated_at = now()
      where id = (p_payload ->> 'moduleId')::uuid and organization_id = p_organization_id returning id, course_id into created_id, target_course_id;
    else
      update public.organization_course_lessons set is_published = (p_payload ->> 'published')::boolean, updated_at = now()
      where id = (p_payload ->> 'lessonId')::uuid and organization_id = p_organization_id returning id, module_id into created_id, target_module_id;
      select course_id into target_course_id from public.organization_course_modules
      where id = target_module_id and organization_id = p_organization_id;
    end if;
    if not found then raise exception 'Learning record not found' using errcode = '23503'; end if;
  elsif p_action in ('CREATE_EXTERNAL_RESOURCE', 'REGISTER_FILE_RESOURCE') then
    target_lesson_id := (p_payload ->> 'lessonId')::uuid;
    select module.course_id into target_course_id
    from public.organization_course_lessons lesson
    join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
    where lesson.id = target_lesson_id and lesson.organization_id = p_organization_id;
    if not found then raise exception 'Lesson not found' using errcode = '23503'; end if;
    insert into public.organization_lesson_resources (
      organization_id, lesson_id, name, resource_type, storage_bucket, storage_path, external_url,
      mime_type, byte_size, sha256, download_allowed, processing_status, created_by
    ) values (
      p_organization_id, target_lesson_id, p_payload ->> 'name',
      case when p_action = 'REGISTER_FILE_RESOURCE' then 'FILE' else 'EXTERNAL_LINK' end,
      case when p_action = 'REGISTER_FILE_RESOURCE' then p_payload ->> 'storageBucket' end,
      case when p_action = 'REGISTER_FILE_RESOURCE' then p_payload ->> 'storagePath' end,
      case when p_action = 'CREATE_EXTERNAL_RESOURCE' then p_payload ->> 'externalUrl' end,
      nullif(p_payload ->> 'mimeType', ''), nullif(p_payload ->> 'byteSize', '')::bigint,
      nullif(p_payload ->> 'sha256', ''), coalesce((p_payload ->> 'downloadAllowed')::boolean, true),
      'READY', p_actor_user_id
    ) returning id into created_id;
  elsif p_action = 'MARK_COMPLETE' then
    target_lesson_id := (p_payload ->> 'lessonId')::uuid;
    select module.course_id into target_course_id
    from public.organization_course_lessons lesson
    join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
    where lesson.id = target_lesson_id and lesson.organization_id = p_organization_id
      and lesson.is_published and (lesson.release_at is null or lesson.release_at <= now())
      and module.is_published and (module.release_at is null or module.release_at <= now());
    if not found or not public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, target_course_id)
    then raise exception 'Lesson is not available' using errcode = '42501'; end if;
    insert into public.organization_lesson_progress (organization_id, lesson_id, user_id, progress_percent, completed_at)
    values (p_organization_id, target_lesson_id, p_actor_user_id, 100, now())
    on conflict (organization_id, lesson_id, user_id) do update
      set progress_percent = 100, completed_at = coalesce(organization_lesson_progress.completed_at, now()), last_accessed_at = now();
    created_id := target_lesson_id;
  else
    raise exception 'Unsupported learning action' using errcode = '22023';
  end if;

  if p_actor_role = 'TEACHER' and target_course_id is not null
    and not public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, target_course_id)
  then raise exception 'Teacher is not assigned to this course' using errcode = '42501'; end if;

  result := jsonb_build_object('id', created_id, 'action', p_action);
  if p_action <> 'MARK_COMPLETE' then
    insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
    values (p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'learning_content', created_id::text, p_payload);
  end if;
  return result;
end;
$$;

create or replace function public.lms_get_learning_resource(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_resource_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', resource.id, 'name', resource.name, 'resourceType', resource.resource_type,
    'storageBucket', resource.storage_bucket, 'storagePath', resource.storage_path,
    'externalUrl', resource.external_url, 'downloadAllowed', resource.download_allowed,
    'mimeType', resource.mime_type
  )
  from public.organization_lesson_resources resource
  join public.organization_course_lessons lesson on lesson.id = resource.lesson_id and lesson.organization_id = resource.organization_id
  join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
  where resource.id = p_resource_id and resource.organization_id = p_organization_id
    and resource.processing_status = 'READY'
    and public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, module.course_id)
    and (
      p_actor_role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER')
      or (
        module.is_published and (module.release_at is null or module.release_at <= now())
        and lesson.is_published and (lesson.release_at is null or lesson.release_at <= now())
      )
    );
$$;

revoke all on function public.lms_actor_can_access_course(uuid, text, text, uuid) from public;
revoke all on function public.lms_learning_mutation(uuid, text, text, text, jsonb) from public;
revoke all on function public.lms_get_learning_resource(uuid, text, text, uuid) from public;
grant execute on function public.lms_actor_can_access_course(uuid, text, text, uuid) to service_role;
grant execute on function public.lms_learning_mutation(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.lms_get_learning_resource(uuid, text, text, uuid) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0012_assignments.sql
-- ---------------------------------------------------------------------

-- Tenant-scoped assignments, deadline enforcement, grading, and resubmission.

create table if not exists public.organization_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  title text not null,
  instructions text not null,
  course_id uuid,
  batch_id uuid,
  student_user_id text,
  available_from timestamptz,
  due_at timestamptz not null,
  max_marks numeric(8,2) not null check (max_marks > 0),
  rubric jsonb not null default '[]'::jsonb,
  allow_late boolean not null default false,
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'CLOSED')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(course_id, batch_id, student_user_id) = 1),
  check (available_from is null or due_at > available_from),
  foreign key (course_id, organization_id) references public.organization_courses(id, organization_id) on delete cascade,
  foreign key (batch_id, organization_id) references public.organization_batches(id, organization_id) on delete cascade,
  unique (id, organization_id)
);

create table if not exists public.organization_assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  assignment_id uuid not null,
  student_user_id text not null,
  attempt_number integer not null check (attempt_number > 0),
  text_response text,
  status text not null check (status in ('SUBMITTED', 'LATE', 'GRADED', 'RETURNED')),
  submitted_at timestamptz not null default now(),
  grade numeric(8,2),
  feedback text,
  graded_by text,
  graded_at timestamptz,
  check (grade is null or grade >= 0),
  foreign key (assignment_id, organization_id) references public.organization_assignments(id, organization_id) on delete cascade,
  unique (organization_id, assignment_id, student_user_id, attempt_number),
  unique (id, organization_id)
);

create table if not exists public.organization_assignment_submission_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  submission_id uuid not null,
  name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (submission_id, organization_id) references public.organization_assignment_submissions(id, organization_id) on delete cascade,
  unique (organization_id, storage_bucket, storage_path)
);

create index if not exists organization_assignments_due_idx on public.organization_assignments(organization_id, status, due_at);
create index if not exists organization_assignment_submissions_review_idx on public.organization_assignment_submissions(organization_id, assignment_id, status, submitted_at);
create index if not exists organization_assignment_submission_files_submission_idx on public.organization_assignment_submission_files(organization_id, submission_id);

alter table public.organization_assignments enable row level security;
alter table public.organization_assignment_submissions enable row level security;
alter table public.organization_assignment_submission_files enable row level security;

create or replace function public.lms_student_can_access_assignment(
  p_organization_id uuid,
  p_student_user_id text,
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_assignments assignment
    where assignment.id = p_assignment_id and assignment.organization_id = p_organization_id
      and assignment.status = 'PUBLISHED'
      and (assignment.available_from is null or assignment.available_from <= now())
      and (
        assignment.student_user_id = p_student_user_id
        or exists (
          select 1 from public.organization_batch_members enrollment
          where enrollment.organization_id = p_organization_id
            and enrollment.batch_id = assignment.batch_id
            and enrollment.user_id = p_student_user_id and enrollment.role = 'STUDENT'
        )
        or exists (
          select 1
          from public.organization_course_batches link
          join public.organization_batch_members enrollment
            on enrollment.organization_id = link.organization_id and enrollment.batch_id = link.batch_id
          where link.organization_id = p_organization_id and link.course_id = assignment.course_id
            and enrollment.user_id = p_student_user_id and enrollment.role = 'STUDENT'
        )
      )
  );
$$;

create or replace function public.lms_actor_can_manage_assignment(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_assignments assignment
    where assignment.id = p_assignment_id and assignment.organization_id = p_organization_id
      and (
        p_actor_role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR')
        or (
          p_actor_role = 'TEACHER'
          and (
            (assignment.course_id is not null and public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, assignment.course_id))
            or exists (
              select 1 from public.organization_batch_members teacher_enrollment
              where teacher_enrollment.organization_id = p_organization_id
                and teacher_enrollment.batch_id = assignment.batch_id
                and teacher_enrollment.user_id = p_actor_user_id and teacher_enrollment.role = 'TEACHER'
            )
            or exists (
              select 1
              from public.organization_batch_members teacher_enrollment
              join public.organization_batch_members student_enrollment
                on student_enrollment.organization_id = teacher_enrollment.organization_id
                and student_enrollment.batch_id = teacher_enrollment.batch_id
              where teacher_enrollment.organization_id = p_organization_id
                and teacher_enrollment.user_id = p_actor_user_id and teacher_enrollment.role = 'TEACHER'
                and student_enrollment.user_id = assignment.student_user_id and student_enrollment.role = 'STUDENT'
            )
          )
        )
      )
  );
$$;

create or replace function public.can_access_organization_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_assignments assignment
    where assignment.id = target_assignment_id
      and public.has_organization_role(assignment.organization_id, array['STUDENT'])
      and public.lms_student_can_access_assignment(assignment.organization_id, public.requesting_user_id(), assignment.id)
  );
$$;

create or replace function public.can_manage_organization_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_assignments assignment
    where assignment.id = target_assignment_id
      and (
        public.has_organization_role(assignment.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
        or (
          public.has_organization_role(assignment.organization_id, array['TEACHER'])
          and public.lms_actor_can_manage_assignment(
            assignment.organization_id, public.requesting_user_id(), 'TEACHER', assignment.id
          )
        )
      )
  );
$$;

drop policy if exists organization_assignments_read on public.organization_assignments;
create policy organization_assignments_read on public.organization_assignments
  for select using (
    public.can_manage_organization_assignment(id)
    or public.can_access_organization_assignment(id)
  );
drop policy if exists organization_assignment_submissions_read on public.organization_assignment_submissions;
create policy organization_assignment_submissions_read on public.organization_assignment_submissions
  for select using (
    student_user_id = public.requesting_user_id()
    or public.can_manage_organization_assignment(assignment_id)
  );
drop policy if exists organization_assignment_submission_files_read on public.organization_assignment_submission_files;
create policy organization_assignment_submission_files_read on public.organization_assignment_submission_files
  for select using (
    exists (
      select 1 from public.organization_assignment_submissions submission
      where submission.id = submission_id
        and submission.organization_id = organization_assignment_submission_files.organization_id
        and (
          submission.student_user_id = public.requesting_user_id()
          or public.can_manage_organization_assignment(submission.assignment_id)
        )
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-submissions', 'organization-submissions', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create or replace function public.lms_assignment_mutation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
  assignment public.organization_assignments%rowtype;
  submission public.organization_assignment_submissions%rowtype;
  attempt_count integer;
  target_course_id uuid;
begin
  if p_action = 'CREATE_ASSIGNMENT' then
    if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
      raise exception 'Role cannot create assignments' using errcode = '42501';
    end if;
    if nullif(p_payload ->> 'courseId', '') is not null then
      target_course_id := (p_payload ->> 'courseId')::uuid;
      if not exists (select 1 from public.organization_courses where id = target_course_id and organization_id = p_organization_id)
      then raise exception 'Course not found' using errcode = '23503'; end if;
      if p_actor_role = 'TEACHER' and not public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, target_course_id)
      then raise exception 'Teacher is not assigned to course' using errcode = '42501'; end if;
    elsif nullif(p_payload ->> 'batchId', '') is not null then
      if not exists (
        select 1 from public.organization_batches batch
        where batch.id = (p_payload ->> 'batchId')::uuid and batch.organization_id = p_organization_id
          and (p_actor_role <> 'TEACHER' or exists (
            select 1 from public.organization_batch_members enrollment
            where enrollment.organization_id = p_organization_id and enrollment.batch_id = batch.id
              and enrollment.user_id = p_actor_user_id and enrollment.role = 'TEACHER'
          ))
      ) then raise exception 'Batch not found or not assigned' using errcode = '23503'; end if;
    elsif nullif(p_payload ->> 'studentUserId', '') is not null then
      if not exists (
        select 1 from public.institute_members member
        where member.institute_id = p_organization_id and member.user_id = p_payload ->> 'studentUserId'
          and member.role = 'STUDENT' and member.status = 'ACTIVE'
      ) then raise exception 'Student not found' using errcode = '23503'; end if;
      if p_actor_role = 'TEACHER' and not exists (
        select 1 from public.organization_batch_members teacher_enrollment
        join public.organization_batch_members student_enrollment
          on student_enrollment.organization_id = teacher_enrollment.organization_id
          and student_enrollment.batch_id = teacher_enrollment.batch_id
        where teacher_enrollment.organization_id = p_organization_id
          and teacher_enrollment.user_id = p_actor_user_id and teacher_enrollment.role = 'TEACHER'
          and student_enrollment.user_id = p_payload ->> 'studentUserId' and student_enrollment.role = 'STUDENT'
      ) then raise exception 'Teacher is not assigned to student' using errcode = '42501'; end if;
    else raise exception 'Assignment target required' using errcode = '22023';
    end if;
    insert into public.organization_assignments (
      organization_id, title, instructions, course_id, batch_id, student_user_id, available_from, due_at,
      max_marks, rubric, allow_late, max_attempts, created_by
    ) values (
      p_organization_id, p_payload ->> 'title', p_payload ->> 'instructions', nullif(p_payload ->> 'courseId', '')::uuid,
      nullif(p_payload ->> 'batchId', '')::uuid, nullif(p_payload ->> 'studentUserId', ''),
      nullif(p_payload ->> 'availableFrom', '')::timestamptz, (p_payload ->> 'dueAt')::timestamptz,
      (p_payload ->> 'maxMarks')::numeric, coalesce(p_payload -> 'rubric', '[]'::jsonb),
      coalesce((p_payload ->> 'allowLate')::boolean, false), coalesce((p_payload ->> 'maxAttempts')::integer, 1), p_actor_user_id
    ) returning id into created_id;
  elsif p_action = 'PUBLISH_ASSIGNMENT' then
    select * into assignment from public.organization_assignments candidate
    where candidate.id = (p_payload ->> 'assignmentId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found or not public.lms_actor_can_manage_assignment(p_organization_id, p_actor_user_id, p_actor_role, assignment.id)
    then raise exception 'Assignment not found' using errcode = '42501'; end if;
    update public.organization_assignments set status = case when (p_payload ->> 'published')::boolean then 'PUBLISHED' else 'DRAFT' end, updated_at = now()
    where id = assignment.id returning id into created_id;
  elsif p_action = 'SUBMIT_ASSIGNMENT' then
    if p_actor_role <> 'STUDENT' then raise exception 'Only students submit assignments' using errcode = '42501'; end if;
    select * into assignment from public.organization_assignments candidate
    where candidate.id = (p_payload ->> 'assignmentId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found or not public.lms_student_can_access_assignment(p_organization_id, p_actor_user_id, assignment.id)
    then raise exception 'Assignment is unavailable' using errcode = '42501'; end if;
    if now() > assignment.due_at and not assignment.allow_late then raise exception 'Assignment deadline has passed' using errcode = '22023'; end if;
    select count(*)::integer into attempt_count from public.organization_assignment_submissions
    where organization_id = p_organization_id and assignment_id = assignment.id and student_user_id = p_actor_user_id;
    if attempt_count >= assignment.max_attempts then raise exception 'Maximum attempts reached' using errcode = '22023'; end if;
    if attempt_count > 0 and coalesce((
      select status from public.organization_assignment_submissions
      where organization_id = p_organization_id and assignment_id = assignment.id
        and student_user_id = p_actor_user_id
      order by attempt_number desc limit 1
    ), '') <> 'RETURNED' then raise exception 'Resubmission is not permitted yet' using errcode = '22023'; end if;
    insert into public.organization_assignment_submissions (
      organization_id, assignment_id, student_user_id, attempt_number, text_response, status
    ) values (
      p_organization_id, assignment.id, p_actor_user_id, attempt_count + 1, nullif(p_payload ->> 'textResponse', ''),
      case when now() > assignment.due_at then 'LATE' else 'SUBMITTED' end
    ) returning id into created_id;
    if nullif(p_payload ->> 'storagePath', '') is not null then
      insert into public.organization_assignment_submission_files (
        organization_id, submission_id, name, storage_bucket, storage_path, mime_type, byte_size, sha256
      ) values (
        p_organization_id, created_id, p_payload ->> 'fileName', p_payload ->> 'storageBucket',
        p_payload ->> 'storagePath', p_payload ->> 'mimeType', (p_payload ->> 'byteSize')::bigint, p_payload ->> 'sha256'
      );
    end if;
  elsif p_action in ('GRADE_SUBMISSION', 'RETURN_SUBMISSION') then
    select * into submission from public.organization_assignment_submissions candidate
    where candidate.id = (p_payload ->> 'submissionId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found or not public.lms_actor_can_manage_assignment(p_organization_id, p_actor_user_id, p_actor_role, submission.assignment_id)
    then raise exception 'Submission not found' using errcode = '42501'; end if;
    select * into assignment from public.organization_assignments where id = submission.assignment_id and organization_id = p_organization_id;
    if p_action = 'GRADE_SUBMISSION' then
      if (p_payload ->> 'grade')::numeric > assignment.max_marks then raise exception 'Grade exceeds maximum marks' using errcode = '22023'; end if;
      update public.organization_assignment_submissions
      set status = 'GRADED', grade = (p_payload ->> 'grade')::numeric, feedback = nullif(p_payload ->> 'feedback', ''), graded_by = p_actor_user_id, graded_at = now()
      where id = submission.id returning id into created_id;
    else
      if submission.attempt_number >= assignment.max_attempts then
        raise exception 'No resubmission attempts remain' using errcode = '22023';
      end if;
      update public.organization_assignment_submissions
      set status = 'RETURNED', feedback = nullif(p_payload ->> 'feedback', ''), graded_by = p_actor_user_id, graded_at = now()
      where id = submission.id returning id into created_id;
    end if;
  else raise exception 'Unsupported assignment action' using errcode = '22023';
  end if;

  if p_action <> 'SUBMIT_ASSIGNMENT' then
    insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
    values (p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'assignment', created_id::text, p_payload);
  end if;
  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

create or replace function public.lms_get_assignment_file(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_file_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', file.id, 'name', file.name, 'storageBucket', file.storage_bucket,
    'storagePath', file.storage_path, 'mimeType', file.mime_type
  )
  from public.organization_assignment_submission_files file
  join public.organization_assignment_submissions submission
    on submission.id = file.submission_id and submission.organization_id = file.organization_id
  where file.id = p_file_id and file.organization_id = p_organization_id
    and (
      submission.student_user_id = p_actor_user_id
      or public.lms_actor_can_manage_assignment(p_organization_id, p_actor_user_id, p_actor_role, submission.assignment_id)
    );
$$;

revoke all on function public.lms_student_can_access_assignment(uuid, text, uuid) from public;
revoke all on function public.lms_actor_can_manage_assignment(uuid, text, text, uuid) from public;
revoke all on function public.lms_assignment_mutation(uuid, text, text, text, jsonb) from public;
revoke all on function public.lms_get_assignment_file(uuid, text, text, uuid) from public;
revoke all on function public.can_access_organization_assignment(uuid) from public;
revoke all on function public.can_manage_organization_assignment(uuid) from public;
grant execute on function public.lms_student_can_access_assignment(uuid, text, uuid) to service_role;
grant execute on function public.lms_actor_can_manage_assignment(uuid, text, text, uuid) to service_role;
grant execute on function public.lms_assignment_mutation(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.lms_get_assignment_file(uuid, text, text, uuid) to service_role;
grant execute on function public.can_access_organization_assignment(uuid) to authenticated;
grant execute on function public.can_manage_organization_assignment(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- Migration: 0013_assessment_attempts.sql
-- ---------------------------------------------------------------------

-- PrepZii question-bank adapter and server-authoritative LMS assessment attempts.

alter table public.institute_tests add column if not exists max_attempts integer not null default 1;
alter table public.institute_tests add column if not exists result_release_policy text not null default 'IMMEDIATE';
alter table public.institute_tests add column if not exists solution_release_policy text not null default 'AFTER_WINDOW';
alter table public.institute_tests add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'institute_tests_max_attempts_check') then
    alter table public.institute_tests add constraint institute_tests_max_attempts_check check (max_attempts between 1 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'institute_tests_result_release_check') then
    alter table public.institute_tests add constraint institute_tests_result_release_check check (result_release_policy in ('IMMEDIATE', 'AFTER_WINDOW', 'MANUAL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'institute_tests_solution_release_check') then
    alter table public.institute_tests add constraint institute_tests_solution_release_check check (solution_release_policy in ('IMMEDIATE', 'AFTER_WINDOW', 'MANUAL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'institute_tests_id_institute_unique') then
    alter table public.institute_tests add constraint institute_tests_id_institute_unique unique (id, institute_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'institute_test_questions_test_org_fk') then
    alter table public.institute_test_questions add constraint institute_test_questions_test_org_fk
      foreign key (institute_test_id, institute_id) references public.institute_tests(id, institute_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_test_schedules_id_org_unique') then
    alter table public.organization_test_schedules add constraint organization_test_schedules_id_org_unique unique (id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_test_schedule_test_org_fk') then
    alter table public.organization_test_schedules add constraint organization_test_schedule_test_org_fk
      foreign key (test_id, organization_id) references public.institute_tests(id, institute_id) on delete cascade not valid;
  end if;
end;
$$;

create table if not exists public.organization_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  test_id uuid not null,
  schedule_id uuid not null,
  user_id text not null,
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  answer_version integer not null default 0,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  question_results jsonb,
  score numeric(10,2),
  max_score numeric(10,2),
  percentage numeric(6,2),
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  time_taken_seconds integer,
  results_released boolean not null default false,
  solutions_released boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (test_id, organization_id) references public.institute_tests(id, institute_id) on delete cascade,
  foreign key (schedule_id, organization_id) references public.organization_test_schedules(id, organization_id) on delete cascade,
  unique (organization_id, test_id, user_id, attempt_number)
);

create index if not exists organization_assessment_attempts_user_idx on public.organization_assessment_attempts(organization_id, user_id, started_at desc);
create index if not exists organization_assessment_attempts_test_idx on public.organization_assessment_attempts(organization_id, test_id, status, submitted_at);
create unique index if not exists organization_one_active_test_attempt_idx
  on public.organization_assessment_attempts(organization_id, test_id, user_id)
  where status = 'IN_PROGRESS';

alter table public.organization_assessment_attempts enable row level security;
drop policy if exists organization_assessment_attempts_read on public.organization_assessment_attempts;
create policy organization_assessment_attempts_read on public.organization_assessment_attempts
  for select using (
    user_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or (
      public.has_organization_role(organization_id, array['TEACHER'])
      and exists (
        select 1 from public.institute_tests test
        where test.id = organization_assessment_attempts.test_id
          and test.institute_id = organization_assessment_attempts.organization_id
          and test.created_by = public.requesting_user_id()
      )
    )
  );

create or replace function public.lms_start_assessment(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_test_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  test public.institute_tests%rowtype;
  schedule public.organization_test_schedules%rowtype;
  attempt public.organization_assessment_attempts%rowtype;
  prior_attempts integer;
begin
  if p_actor_role <> 'STUDENT' then raise exception 'Only students can start an assessment' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_test_id::text || ':' || p_actor_user_id, 0));

  select * into test from public.institute_tests candidate
  where candidate.id = p_test_id and candidate.institute_id = p_organization_id and candidate.status = 'PUBLISHED';
  if not found then raise exception 'Published assessment not found' using errcode = '42501'; end if;

  select candidate.* into schedule
  from public.organization_test_schedules candidate
  where candidate.organization_id = p_organization_id and candidate.test_id = p_test_id
    and now() between candidate.starts_at and candidate.ends_at
    and exists (
      select 1 from public.organization_batch_members enrollment
      where enrollment.organization_id = p_organization_id and enrollment.batch_id = candidate.batch_id
        and enrollment.user_id = p_actor_user_id and enrollment.role = 'STUDENT'
    )
  order by candidate.starts_at desc limit 1;
  if not found then raise exception 'Assessment is not available for an enrolled batch' using errcode = '42501'; end if;

  select * into attempt from public.organization_assessment_attempts candidate
  where candidate.organization_id = p_organization_id and candidate.test_id = p_test_id
    and candidate.user_id = p_actor_user_id and candidate.status = 'IN_PROGRESS'
  for update;
  if found and attempt.expires_at > now() then
    return jsonb_build_object('attemptId', attempt.id, 'answerVersion', attempt.answer_version, 'answers', attempt.answers, 'expiresAt', attempt.expires_at, 'resumed', true);
  elsif found then
    update public.organization_assessment_attempts set status = 'EXPIRED', updated_at = now() where id = attempt.id;
  end if;

  select count(*)::integer into prior_attempts from public.organization_assessment_attempts
  where organization_id = p_organization_id and test_id = p_test_id and user_id = p_actor_user_id;
  if prior_attempts >= test.max_attempts then raise exception 'Maximum attempts reached' using errcode = '22023'; end if;

  insert into public.organization_assessment_attempts (
    organization_id, test_id, schedule_id, user_id, attempt_number, expires_at
  ) values (
    p_organization_id, p_test_id, schedule.id, p_actor_user_id, prior_attempts + 1,
    least(now() + make_interval(mins => test.duration_minutes), schedule.ends_at)
  ) returning * into attempt;
  return jsonb_build_object('attemptId', attempt.id, 'answerVersion', 0, 'answers', '{}'::jsonb, 'expiresAt', attempt.expires_at, 'resumed', false);
end;
$$;

create or replace function public.lms_save_assessment_answers(
  p_organization_id uuid,
  p_actor_user_id text,
  p_attempt_id uuid,
  p_expected_version integer,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.organization_assessment_attempts%rowtype;
begin
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be an object' using errcode = '22023'; end if;
  select * into attempt from public.organization_assessment_attempts candidate
  where candidate.id = p_attempt_id and candidate.organization_id = p_organization_id and candidate.user_id = p_actor_user_id
  for update;
  if not found then raise exception 'Attempt not found' using errcode = '42501'; end if;
  if attempt.status <> 'IN_PROGRESS' then raise exception 'Attempt is already final' using errcode = '22023'; end if;
  if now() > attempt.expires_at then
    raise exception 'Attempt has expired' using errcode = '22023';
  end if;
  if attempt.answer_version <> p_expected_version then raise exception 'Answer version conflict' using errcode = '40001'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_answers) answer(question_id)
    where case
      when answer.question_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then not exists (
          select 1 from public.institute_test_questions test_question
          where test_question.institute_id = p_organization_id and test_question.institute_test_id = attempt.test_id
            and test_question.question_id = answer.question_id::uuid
        )
      else true
    end
  ) then raise exception 'Answer contains a question outside the assessment' using errcode = '22023'; end if;
  update public.organization_assessment_attempts
  set answers = p_answers, answer_version = answer_version + 1, updated_at = now()
  where id = attempt.id
  returning answer_version into p_expected_version;
  return jsonb_build_object('attemptId', attempt.id, 'answerVersion', p_expected_version, 'savedAt', now());
end;
$$;

create or replace function public.lms_finalize_assessment(
  p_organization_id uuid,
  p_actor_user_id text,
  p_attempt_id uuid,
  p_expected_version integer,
  p_summary jsonb,
  p_question_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.organization_assessment_attempts%rowtype;
  test public.institute_tests%rowtype;
  schedule public.organization_test_schedules%rowtype;
begin
  if jsonb_typeof(p_summary) <> 'object' or jsonb_typeof(p_question_results) <> 'array' then
    raise exception 'Invalid assessment result payload' using errcode = '22023';
  end if;
  select * into attempt from public.organization_assessment_attempts candidate
  where candidate.id = p_attempt_id and candidate.organization_id = p_organization_id and candidate.user_id = p_actor_user_id
  for update;
  if not found then raise exception 'Attempt not found' using errcode = '42501'; end if;
  if attempt.status = 'SUBMITTED' then
    return jsonb_build_object('attemptId', attempt.id, 'submitted', true, 'idempotent', true, 'resultsReleased', attempt.results_released, 'solutionsReleased', attempt.solutions_released);
  end if;
  if attempt.answer_version <> p_expected_version then raise exception 'Answer version conflict' using errcode = '40001'; end if;
  select * into test from public.institute_tests where id = attempt.test_id and institute_id = p_organization_id;
  if not found then raise exception 'Assessment not found' using errcode = '23503'; end if;
  select * into schedule from public.organization_test_schedules where id = attempt.schedule_id and organization_id = p_organization_id;
  if not found then raise exception 'Assessment schedule not found' using errcode = '23503'; end if;
  if (p_summary ->> 'totalScore') is null or (p_summary ->> 'maxScore') is null
    or (p_summary ->> 'percentage') is null or (p_summary ->> 'correctCount') is null
    or (p_summary ->> 'incorrectCount') is null or (p_summary ->> 'unansweredCount') is null then
    raise exception 'Assessment summary is incomplete' using errcode = '22023';
  end if;
  update public.organization_assessment_attempts set
    status = 'SUBMITTED', submitted_at = now(), question_results = p_question_results,
    score = (p_summary ->> 'totalScore')::numeric, max_score = (p_summary ->> 'maxScore')::numeric,
    percentage = (p_summary ->> 'percentage')::numeric, correct_count = (p_summary ->> 'correctCount')::integer,
    incorrect_count = (p_summary ->> 'incorrectCount')::integer, unanswered_count = (p_summary ->> 'unansweredCount')::integer,
    time_taken_seconds = least(greatest(extract(epoch from (now() - attempt.started_at))::integer, 0), test.duration_minutes * 60),
    results_released = test.result_release_policy = 'IMMEDIATE' or (test.result_release_policy = 'AFTER_WINDOW' and now() >= schedule.ends_at),
    solutions_released = test.solution_release_policy = 'IMMEDIATE' or (test.solution_release_policy = 'AFTER_WINDOW' and now() >= schedule.ends_at),
    updated_at = now()
  where id = attempt.id returning * into attempt;
  return jsonb_build_object('attemptId', attempt.id, 'submitted', true, 'idempotent', false, 'resultsReleased', attempt.results_released, 'solutionsReleased', attempt.solutions_released);
end;
$$;

revoke all on function public.lms_start_assessment(uuid, text, text, uuid) from public;
revoke all on function public.lms_save_assessment_answers(uuid, text, uuid, integer, jsonb) from public;
revoke all on function public.lms_finalize_assessment(uuid, text, uuid, integer, jsonb, jsonb) from public;
grant execute on function public.lms_start_assessment(uuid, text, text, uuid) to service_role;
grant execute on function public.lms_save_assessment_answers(uuid, text, uuid, integer, jsonb) to service_role;
grant execute on function public.lms_finalize_assessment(uuid, text, uuid, integer, jsonb, jsonb) to service_role;

create or replace function public.lms_assessment_mutation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
  test public.institute_tests%rowtype;
  target_batch_id uuid;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Role cannot manage assessments' using errcode = '42501';
  end if;

  if p_action = 'CREATE_TEST' then
    insert into public.institute_tests (
      institute_id, title, exam, subject, chapters, difficulty, duration_minutes, total_questions,
      status, created_by, max_attempts, result_release_policy, solution_release_policy
    ) values (
      p_organization_id, p_payload ->> 'title', p_payload ->> 'exam', p_payload ->> 'subject',
      array(select jsonb_array_elements_text(coalesce(p_payload -> 'chapters', '[]'::jsonb))),
      p_payload ->> 'difficulty', (p_payload ->> 'durationMinutes')::integer, 0, 'DRAFT', p_actor_user_id,
      (p_payload ->> 'maxAttempts')::integer, p_payload ->> 'resultReleasePolicy', p_payload ->> 'solutionReleasePolicy'
    ) returning id into created_id;
  else
    select * into test from public.institute_tests candidate
    where candidate.id = (p_payload ->> 'testId')::uuid and candidate.institute_id = p_organization_id for update;
    if not found then raise exception 'Assessment not found' using errcode = '23503'; end if;
    if p_actor_role = 'TEACHER' and test.created_by <> p_actor_user_id then
      raise exception 'Teacher can manage only assessments they created' using errcode = '42501';
    end if;

    if p_action = 'ADD_QUESTION' then
      if test.status <> 'DRAFT' then raise exception 'Published assessment cannot be edited' using errcode = '22023'; end if;
      if not exists (select 1 from public.questions where id = (p_payload ->> 'questionId')::uuid)
      then raise exception 'Question not found' using errcode = '23503'; end if;
      insert into public.institute_test_questions (institute_id, institute_test_id, question_id, question_order)
      values (
        p_organization_id, test.id, (p_payload ->> 'questionId')::uuid,
        coalesce((p_payload ->> 'questionOrder')::integer, test.total_questions + 1)
      ) on conflict (institute_test_id, question_id) do nothing
      returning id into created_id;
      update public.institute_tests set total_questions = (
        select count(*) from public.institute_test_questions where institute_id = p_organization_id and institute_test_id = test.id
      ), updated_at = now() where id = test.id;
      created_id := coalesce(created_id, test.id);
    elsif p_action = 'SCHEDULE_TEST' then
      target_batch_id := (p_payload ->> 'batchId')::uuid;
      if not exists (
        select 1 from public.organization_batches batch
        where batch.id = target_batch_id and batch.organization_id = p_organization_id
          and (p_actor_role <> 'TEACHER' or exists (
            select 1 from public.organization_batch_members enrollment
            where enrollment.organization_id = p_organization_id and enrollment.batch_id = batch.id
              and enrollment.user_id = p_actor_user_id and enrollment.role = 'TEACHER'
          ))
      ) then raise exception 'Batch not found or not assigned' using errcode = '23503'; end if;
      insert into public.organization_test_schedules (organization_id, test_id, batch_id, starts_at, ends_at, is_strict_timing)
      values (p_organization_id, test.id, target_batch_id, (p_payload ->> 'startsAt')::timestamptz, (p_payload ->> 'endsAt')::timestamptz, true)
      returning id into created_id;
    elsif p_action = 'PUBLISH_TEST' then
      if (p_payload ->> 'published')::boolean and (
        test.total_questions < 1
        or not exists (select 1 from public.organization_test_schedules where organization_id = p_organization_id and test_id = test.id)
      ) then raise exception 'Assessment requires questions and a schedule before publication' using errcode = '22023'; end if;
      update public.institute_tests
      set status = case when (p_payload ->> 'published')::boolean then 'PUBLISHED' else 'DRAFT' end,
          published_at = case when (p_payload ->> 'published')::boolean then coalesce(published_at, now()) else null end,
          updated_at = now()
      where id = test.id returning id into created_id;
    elsif p_action = 'RELEASE_RESULTS' then
      update public.organization_assessment_attempts set results_released = true, updated_at = now()
      where organization_id = p_organization_id and test_id = test.id and status = 'SUBMITTED';
      created_id := test.id;
    elsif p_action = 'RELEASE_SOLUTIONS' then
      update public.organization_assessment_attempts set solutions_released = true, updated_at = now()
      where organization_id = p_organization_id and test_id = test.id and status = 'SUBMITTED';
      created_id := test.id;
    else raise exception 'Unsupported assessment action' using errcode = '22023';
    end if;
  end if;

  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'assessment', created_id::text, p_payload);
  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

revoke all on function public.lms_assessment_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_assessment_mutation(uuid, text, text, text, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0014_attendance_corrections.sql
-- ---------------------------------------------------------------------

-- Server-authoritative attendance register with immutable correction history.

alter table public.organization_attendance_sessions add column if not exists session_label text not null default 'Daily attendance';
alter table public.organization_attendance_sessions add column if not exists starts_at time;
alter table public.organization_attendance_sessions add column if not exists ends_at time;
alter table public.organization_attendance_sessions add column if not exists finalized_at timestamptz;
alter table public.organization_attendance_sessions add column if not exists updated_at timestamptz not null default now();

alter table public.organization_attendance_sessions
  drop constraint if exists organization_attendance_sessions_batch_id_session_date_key;
create unique index if not exists organization_attendance_session_slot_unique
  on public.organization_attendance_sessions(organization_id, batch_id, session_date, session_label, coalesce(starts_at, '00:00'::time));
alter table public.organization_attendance_records
  add constraint organization_attendance_records_id_org_unique unique (id, organization_id);

create table if not exists public.organization_attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  session_id uuid not null,
  attendance_record_id uuid not null,
  student_id text not null,
  previous_status text not null check (previous_status in ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  corrected_status text not null check (corrected_status in ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  reason text not null check (char_length(reason) between 3 and 500),
  corrected_by text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, organization_id) references public.organization_attendance_sessions(id, organization_id) on delete cascade,
  foreign key (attendance_record_id, organization_id) references public.organization_attendance_records(id, organization_id) on delete cascade
);

create index if not exists organization_attendance_corrections_session_idx
  on public.organization_attendance_corrections(organization_id, session_id, created_at desc);

alter table public.organization_attendance_corrections enable row level security;

drop policy if exists org_attendance_sessions_read on public.organization_attendance_sessions;
drop policy if exists org_attendance_sessions_read on public.organization_attendance_sessions;
create policy org_attendance_sessions_read on public.organization_attendance_sessions
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or exists (
      select 1 from public.organization_batch_members member
      where member.organization_id = organization_attendance_sessions.organization_id
        and member.batch_id = organization_attendance_sessions.batch_id
        and member.user_id = public.requesting_user_id()
    )
  );

drop policy if exists org_attendance_records_read on public.organization_attendance_records;
drop policy if exists org_attendance_records_read on public.organization_attendance_records;
create policy org_attendance_records_read on public.organization_attendance_records
  for select using (
    student_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or exists (
      select 1
      from public.organization_attendance_sessions session
      join public.organization_batch_members member
        on member.organization_id = session.organization_id and member.batch_id = session.batch_id
      where session.id = organization_attendance_records.session_id
        and session.organization_id = organization_attendance_records.organization_id
        and member.user_id = public.requesting_user_id() and member.role = 'TEACHER'
    )
  );

drop policy if exists organization_attendance_corrections_read on public.organization_attendance_corrections;
create policy organization_attendance_corrections_read on public.organization_attendance_corrections
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or student_id = public.requesting_user_id()
    or exists (
      select 1
      from public.organization_attendance_sessions session
      join public.organization_batch_members member
        on member.organization_id = session.organization_id and member.batch_id = session.batch_id
      where session.id = organization_attendance_corrections.session_id
        and session.organization_id = organization_attendance_corrections.organization_id
        and member.user_id = public.requesting_user_id() and member.role = 'TEACHER'
    )
  );

-- Browser roles have read-only access. All mutations pass through the audited service RPC.
drop policy if exists org_attendance_sessions_manage on public.organization_attendance_sessions;
drop policy if exists org_attendance_records_manage on public.organization_attendance_records;

create or replace function public.lms_save_attendance(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_batch_id uuid,
  p_session_date date,
  p_session_label text,
  p_starts_at time,
  p_ends_at time,
  p_records jsonb,
  p_correction_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.organization_attendance_sessions%rowtype;
  item jsonb;
  existing_record public.organization_attendance_records%rowtype;
  record_count integer := 0;
  change_count integer := 0;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Role cannot manage attendance' using errcode = '42501';
  end if;
  if p_session_date > current_date + 1 then raise exception 'Future attendance is not permitted' using errcode = '22023'; end if;
  if char_length(trim(p_session_label)) not between 2 and 120 then raise exception 'Invalid session label' using errcode = '22023'; end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'Session end must follow start' using errcode = '22023'; end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 500 then raise exception 'Invalid attendance records' using errcode = '22023'; end if;

  if not exists (
    select 1 from public.organization_batches batch
    where batch.id = p_batch_id and batch.organization_id = p_organization_id
      and (p_actor_role <> 'TEACHER' or exists (
        select 1 from public.organization_batch_members assigned
        where assigned.organization_id = p_organization_id and assigned.batch_id = batch.id
          and assigned.user_id = p_actor_user_id and assigned.role = 'TEACHER'
      ))
  ) then raise exception 'Batch not found or not assigned' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_batch_id::text || ':' || p_session_date::text || ':' || trim(p_session_label) || ':' || coalesce(p_starts_at::text, ''), 0));
  select * into target_session from public.organization_attendance_sessions candidate
  where candidate.organization_id = p_organization_id and candidate.batch_id = p_batch_id
    and candidate.session_date = p_session_date and candidate.session_label = trim(p_session_label)
    and coalesce(candidate.starts_at, '00:00'::time) = coalesce(p_starts_at, '00:00'::time)
  for update;

  if not found then
    insert into public.organization_attendance_sessions (
      organization_id, batch_id, session_date, session_label, starts_at, ends_at, marked_by
    ) values (
      p_organization_id, p_batch_id, p_session_date, trim(p_session_label), p_starts_at, p_ends_at, p_actor_user_id
    ) returning * into target_session;
  elsif target_session.finalized_at is not null and coalesce(char_length(trim(p_correction_reason)), 0) < 3 then
    raise exception 'A correction reason is required after first submission' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_records)
  loop
    if coalesce(item ->> 'studentId', '') = '' or coalesce(item ->> 'status', '') not in ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED') then
      raise exception 'Invalid attendance record' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.organization_batch_members enrollment
      where enrollment.organization_id = p_organization_id and enrollment.batch_id = p_batch_id
        and enrollment.user_id = item ->> 'studentId' and enrollment.role = 'STUDENT'
    ) then raise exception 'Student is not enrolled in the batch' using errcode = '23503'; end if;

    select * into existing_record from public.organization_attendance_records candidate
    where candidate.organization_id = p_organization_id and candidate.session_id = target_session.id
      and candidate.student_id = item ->> 'studentId' for update;
    if found then
      if existing_record.status <> item ->> 'status' then
        insert into public.organization_attendance_corrections (
          organization_id, session_id, attendance_record_id, student_id, previous_status,
          corrected_status, reason, corrected_by
        ) values (
          p_organization_id, target_session.id, existing_record.id, existing_record.student_id,
          existing_record.status, item ->> 'status', trim(p_correction_reason), p_actor_user_id
        );
        update public.organization_attendance_records
        set status = item ->> 'status', remarks = nullif(trim(item ->> 'remarks'), '')
        where id = existing_record.id;
        change_count := change_count + 1;
      end if;
    else
      insert into public.organization_attendance_records (
        organization_id, session_id, student_id, status, remarks
      ) values (
        p_organization_id, target_session.id, item ->> 'studentId', item ->> 'status', nullif(trim(item ->> 'remarks'), '')
      );
      change_count := change_count + 1;
    end if;
    record_count := record_count + 1;
  end loop;

  update public.organization_attendance_sessions
  set finalized_at = coalesce(finalized_at, now()), updated_at = now(), ends_at = p_ends_at
  where id = target_session.id;
  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role,
    case when target_session.finalized_at is null then 'attendance.submit' else 'attendance.correct' end,
    'attendance_session', target_session.id::text,
    jsonb_build_object('batchId', p_batch_id, 'sessionDate', p_session_date, 'recordCount', record_count, 'changeCount', change_count, 'reason', p_correction_reason)
  );
  return jsonb_build_object('sessionId', target_session.id, 'recordCount', record_count, 'changeCount', change_count);
end;
$$;

revoke all on function public.lms_save_attendance(uuid, text, text, uuid, date, text, time, time, jsonb, text) from public;
grant execute on function public.lms_save_attendance(uuid, text, text, uuid, date, text, time, time, jsonb, text) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0015_institute_finance_ledger.sql
-- ---------------------------------------------------------------------

-- Institute fee ledger hardening. API inputs use integer paise; persisted values remain reviewed numeric INR.

alter table public.organization_fee_plans add column if not exists currency text not null default 'INR';
alter table public.organization_fee_plans add constraint organization_fee_plans_currency_check check (currency = 'INR');
alter table public.organization_fee_plans
  add constraint organization_fee_plans_id_org_unique unique (id, organization_id);
alter table public.organization_academic_years
  add constraint organization_academic_years_id_org_unique unique (id, organization_id);
alter table public.organization_fee_installments
  add constraint organization_fee_installments_id_org_unique unique (id, organization_id);

create table if not exists public.organization_fee_plan_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  fee_plan_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  created_at timestamptz not null default now(),
  foreign key (fee_plan_id, organization_id) references public.organization_fee_plans(id, organization_id) on delete cascade,
  unique (organization_id, fee_plan_id, sequence_number)
);

alter table public.organization_student_fees add column if not exists fee_plan_id uuid;
alter table public.organization_student_fees add column if not exists academic_year_id uuid;
alter table public.organization_student_fees add column if not exists assigned_at timestamptz not null default now();
alter table public.organization_student_fees add constraint organization_student_fee_plan_org_fk
  foreign key (fee_plan_id, organization_id) references public.organization_fee_plans(id, organization_id);
alter table public.organization_student_fees add constraint organization_student_fee_year_org_fk
  foreign key (academic_year_id, organization_id) references public.organization_academic_years(id, organization_id);

alter table public.organization_fee_transactions add column if not exists installment_id uuid;
alter table public.organization_fee_transactions add column if not exists transaction_type text not null default 'PAYMENT';
alter table public.organization_fee_transactions add column if not exists reversed_transaction_id uuid;
alter table public.organization_fee_transactions add column if not exists notes text;
alter table public.organization_fee_transactions add column if not exists provider text;
alter table public.organization_fee_transactions add column if not exists provider_event_id text;
alter table public.organization_fee_transactions add column if not exists provider_payment_id text;
alter table public.organization_fee_transactions add constraint organization_fee_transaction_type_check
  check (transaction_type in ('PAYMENT', 'REFUND', 'ADJUSTMENT'));
alter table public.organization_fee_transactions add constraint organization_fee_transaction_installment_org_fk
  foreign key (installment_id, organization_id) references public.organization_fee_installments(id, organization_id);
alter table public.organization_fee_transactions add constraint organization_fee_transaction_reversal_fk
  foreign key (reversed_transaction_id) references public.organization_fee_transactions(id);
create unique index if not exists organization_fee_transaction_reference_unique
  on public.organization_fee_transactions(organization_id, method, reference_number);
create unique index if not exists organization_fee_provider_event_unique
  on public.organization_fee_transactions(provider, provider_event_id) where provider_event_id is not null;
create unique index if not exists organization_fee_provider_payment_unique
  on public.organization_fee_transactions(provider, provider_payment_id) where provider_payment_id is not null;

create table if not exists public.organization_fee_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_fee_id uuid not null,
  student_id text not null,
  invoice_number text not null,
  currency text not null default 'INR' check (currency = 'INR'),
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'ISSUED' check (status in ('ISSUED', 'PARTIAL', 'PAID', 'VOID')),
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_fee_id, organization_id) references public.organization_student_fees(id, organization_id) on delete cascade,
  unique (organization_id, invoice_number)
);

create index if not exists organization_fee_plan_installments_plan_idx on public.organization_fee_plan_installments(organization_id, fee_plan_id);
create index if not exists organization_fee_invoices_student_idx on public.organization_fee_invoices(organization_id, student_id, issued_at desc);

alter table public.organization_fee_plan_installments enable row level security;
alter table public.organization_fee_invoices enable row level security;
drop policy if exists org_fee_plans_read on public.organization_fee_plans;
drop policy if exists org_fee_plans_read on public.organization_fee_plans;
create policy org_fee_plans_read on public.organization_fee_plans
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']));
drop policy if exists organization_fee_plan_installments_read on public.organization_fee_plan_installments;
create policy organization_fee_plan_installments_read on public.organization_fee_plan_installments
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']));
drop policy if exists organization_fee_invoices_read on public.organization_fee_invoices;
create policy organization_fee_invoices_read on public.organization_fee_invoices
  for select using (
    student_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT'])
  );

drop policy if exists org_fee_plans_manage on public.organization_fee_plans;
drop policy if exists org_student_fees_manage on public.organization_student_fees;
drop policy if exists org_fee_installments_manage on public.organization_fee_installments;
drop policy if exists org_fee_transactions_manage on public.organization_fee_transactions;

drop policy if exists org_fee_transactions_read on public.organization_fee_transactions;
drop policy if exists org_fee_transactions_read on public.organization_fee_transactions;
create policy org_fee_transactions_read on public.organization_fee_transactions
  for select using (
    student_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT'])
  );

create or replace function public.lms_finance_mutation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
  plan public.organization_fee_plans%rowtype;
  ledger public.organization_student_fees%rowtype;
  installment public.organization_fee_installments%rowtype;
  original public.organization_fee_transactions%rowtype;
  item jsonb;
  expected_total_paise bigint := 0;
  paid_total numeric(12,2) := 0;
  refunded_total numeric(12,2) := 0;
  amount_inr numeric(12,2);
  receipt text;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACCOUNTANT') then
    raise exception 'Role cannot manage institute finances' using errcode = '42501';
  end if;

  if p_action = 'CREATE_PLAN' then
    if jsonb_typeof(p_payload -> 'installments') <> 'array' or jsonb_array_length(p_payload -> 'installments') not between 1 and 12 then
      raise exception 'A fee plan requires 1 to 12 installments' using errcode = '22023';
    end if;
    for item in select value from jsonb_array_elements(p_payload -> 'installments') loop
      expected_total_paise := expected_total_paise + (item ->> 'amountPaise')::bigint;
    end loop;
    if expected_total_paise <> (p_payload ->> 'totalAmountPaise')::bigint then
      raise exception 'Installments must equal the plan total' using errcode = '22023';
    end if;
    insert into public.organization_fee_plans (organization_id, name, target_exam, total_amount, installment_count)
    values (
      p_organization_id, trim(p_payload ->> 'name'), p_payload ->> 'targetExam',
      (p_payload ->> 'totalAmountPaise')::numeric / 100, jsonb_array_length(p_payload -> 'installments')
    ) returning * into plan;
    for item in select value from jsonb_array_elements(p_payload -> 'installments') loop
      insert into public.organization_fee_plan_installments (
        organization_id, fee_plan_id, sequence_number, title, amount, due_date
      ) values (
        p_organization_id, plan.id, (item ->> 'sequenceNumber')::integer, trim(item ->> 'title'),
        (item ->> 'amountPaise')::numeric / 100, (item ->> 'dueDate')::date
      );
    end loop;
    created_id := plan.id;

  elsif p_action = 'ASSIGN_PLAN' then
    select * into plan from public.organization_fee_plans candidate
    where candidate.id = (p_payload ->> 'planId')::uuid and candidate.organization_id = p_organization_id and candidate.is_active;
    if not found then raise exception 'Fee plan not found' using errcode = '23503'; end if;
    if not exists (
      select 1 from public.organization_batch_members enrollment
      where enrollment.organization_id = p_organization_id and enrollment.batch_id = (p_payload ->> 'batchId')::uuid
        and enrollment.user_id = p_payload ->> 'studentId' and enrollment.role = 'STUDENT'
    ) then raise exception 'Student is not enrolled in the batch' using errcode = '23503'; end if;
    if (p_payload ->> 'concessionAmountPaise')::numeric / 100 > plan.total_amount then
      raise exception 'Concession exceeds plan total' using errcode = '22023';
    end if;
    insert into public.organization_student_fees (
      organization_id, student_id, batch_id, fee_plan_id, academic_year_id, total_course_fee,
      concession_amount, concession_reason, net_payable, status
    ) values (
      p_organization_id, p_payload ->> 'studentId', (p_payload ->> 'batchId')::uuid, plan.id,
      nullif(p_payload ->> 'academicYearId', '')::uuid, plan.total_amount,
      (p_payload ->> 'concessionAmountPaise')::numeric / 100, nullif(trim(p_payload ->> 'concessionReason'), ''),
      plan.total_amount - ((p_payload ->> 'concessionAmountPaise')::numeric / 100),
      case when plan.total_amount = (p_payload ->> 'concessionAmountPaise')::numeric / 100 then 'PAID' else 'UNPAID' end
    ) returning * into ledger;
    for item in select to_jsonb(template) from public.organization_fee_plan_installments template
      where template.organization_id = p_organization_id and template.fee_plan_id = plan.id order by template.sequence_number
    loop
      amount_inr := least((item ->> 'amount')::numeric, greatest(ledger.net_payable - coalesce((select sum(amount) from public.organization_fee_installments where student_fee_id = ledger.id), 0), 0));
      if amount_inr > 0 then
        insert into public.organization_fee_installments (organization_id, student_fee_id, title, amount, due_date)
        values (p_organization_id, ledger.id, item ->> 'title', amount_inr, (item ->> 'due_date')::date);
      end if;
    end loop;
    insert into public.organization_fee_invoices (
      organization_id, student_fee_id, student_id, invoice_number, amount, due_date, status
    ) values (
      p_organization_id, ledger.id, ledger.student_id, 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
      ledger.net_payable,
      (select max(due_date) from public.organization_fee_plan_installments where organization_id = p_organization_id and fee_plan_id = plan.id),
      case when ledger.net_payable = 0 then 'PAID' else 'ISSUED' end
    );
    created_id := ledger.id;

  elsif p_action = 'RECORD_PAYMENT' then
    select * into ledger from public.organization_student_fees candidate
    where candidate.id = (p_payload ->> 'studentFeeId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found then raise exception 'Student fee ledger not found' using errcode = '23503'; end if;
    select * into installment from public.organization_fee_installments candidate
    where candidate.id = (p_payload ->> 'installmentId')::uuid and candidate.organization_id = p_organization_id
      and candidate.student_fee_id = ledger.id for update;
    if not found then raise exception 'Installment not found' using errcode = '23503'; end if;
    amount_inr := (p_payload ->> 'amountPaise')::numeric / 100;
    if amount_inr <= 0 or amount_inr > installment.amount - installment.paid_amount then
      raise exception 'Payment exceeds installment balance' using errcode = '22023';
    end if;
    created_id := gen_random_uuid();
    receipt := 'REC-' || upper(substr(replace(created_id::text, '-', ''), 1, 12));
    insert into public.organization_fee_transactions (
      id, organization_id, student_fee_id, installment_id, student_id, amount, method,
      reference_number, receipt_number, installment_title, recorded_by, transaction_type, notes
    ) values (
      created_id, p_organization_id, ledger.id, installment.id, ledger.student_id, amount_inr,
      p_payload ->> 'method', trim(p_payload ->> 'referenceNumber'), receipt, installment.title,
      p_actor_user_id, 'PAYMENT', nullif(trim(p_payload ->> 'notes'), '')
    );
    update public.organization_fee_installments set
      paid_amount = paid_amount + amount_inr,
      status = case when paid_amount + amount_inr >= amount then 'PAID' else 'PARTIAL' end,
      paid_at = case when paid_amount + amount_inr >= amount then now() else paid_at end,
      receipt_number = receipt
    where id = installment.id;

  elsif p_action = 'REFUND_PAYMENT' then
    select * into original from public.organization_fee_transactions candidate
    where candidate.id = (p_payload ->> 'transactionId')::uuid and candidate.organization_id = p_organization_id
      and candidate.transaction_type = 'PAYMENT' for update;
    if not found then raise exception 'Original payment not found' using errcode = '23503'; end if;
    select coalesce(sum(amount), 0) into refunded_total from public.organization_fee_transactions
    where organization_id = p_organization_id and reversed_transaction_id = original.id and transaction_type = 'REFUND';
    amount_inr := (p_payload ->> 'amountPaise')::numeric / 100;
    if amount_inr <= 0 or amount_inr + refunded_total > original.amount then
      raise exception 'Refund exceeds remaining refundable amount' using errcode = '22023';
    end if;
    created_id := gen_random_uuid();
    receipt := 'RFN-' || upper(substr(replace(created_id::text, '-', ''), 1, 12));
    insert into public.organization_fee_transactions (
      id, organization_id, student_fee_id, installment_id, student_id, amount, method,
      reference_number, receipt_number, installment_title, recorded_by, transaction_type,
      reversed_transaction_id, notes
    ) values (
      created_id, p_organization_id, original.student_fee_id, original.installment_id, original.student_id,
      amount_inr, original.method, trim(p_payload ->> 'referenceNumber'), receipt, original.installment_title,
      p_actor_user_id, 'REFUND', original.id, trim(p_payload ->> 'reason')
    );
    update public.organization_fee_installments set
      paid_amount = greatest(paid_amount - amount_inr, 0), paid_at = null,
      status = case when greatest(paid_amount - amount_inr, 0) = 0 then 'PENDING' else 'PARTIAL' end
    where id = original.installment_id;
    ledger.id := original.student_fee_id;
  else
    raise exception 'Unsupported finance action' using errcode = '22023';
  end if;

  if p_action in ('RECORD_PAYMENT', 'REFUND_PAYMENT') then
    select * into ledger from public.organization_student_fees where id = ledger.id for update;
    select coalesce(sum(case when transaction_type = 'PAYMENT' then amount else 0 end), 0),
           coalesce(sum(case when transaction_type = 'REFUND' then amount else 0 end), 0)
      into paid_total, refunded_total
    from public.organization_fee_transactions where organization_id = p_organization_id and student_fee_id = ledger.id;
    update public.organization_student_fees set
      status = case when paid_total - refunded_total >= net_payable then 'PAID' when paid_total - refunded_total > 0 then 'PARTIAL' else 'UNPAID' end,
      updated_at = now()
    where id = ledger.id;
    update public.organization_fee_invoices set
      status = case when paid_total - refunded_total >= amount then 'PAID' when paid_total - refunded_total > 0 then 'PARTIAL' else 'ISSUED' end,
      updated_at = now()
    where organization_id = p_organization_id and student_fee_id = ledger.id and status <> 'VOID';
  end if;

  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role, 'finance.' || lower(p_action), 'student_fee', created_id::text, p_payload);
  return jsonb_build_object('id', created_id, 'receiptNumber', receipt, 'action', p_action);
end;
$$;

revoke all on function public.lms_finance_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_finance_mutation(uuid, text, text, text, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0016_saas_entitlements_admin.sql
-- ---------------------------------------------------------------------

-- Commercial SaaS controls: entitlements, atomic quotas, branding registry, and platform operations.

alter table public.subscription_plans add column if not exists monthly_price_paise bigint default 0;
alter table public.subscription_plans add column if not exists annual_price_paise bigint default 0;
alter table public.subscription_plans add column if not exists entitlements jsonb not null default '{}'::jsonb;
update public.subscription_plans set
  monthly_price_paise = coalesce(monthly_price_paise, price_inr::bigint * 100),
  annual_price_paise = coalesce(annual_price_paise, price_inr::bigint * 100 * 10),
  entitlements = case when entitlements = '{}'::jsonb then jsonb_build_object(
    'assessments', true, 'assignments', true, 'attendance', true, 'fees', true,
    'advancedAnalytics', id <> 'basic', 'ai', ai_credits_per_month > 0, 'whiteLabel', id = 'scale'
  ) else entitlements end;
alter table public.subscription_plans alter column monthly_price_paise set not null;
alter table public.subscription_plans alter column annual_price_paise set not null;
alter table public.subscription_plans add constraint subscription_plans_monthly_price_check check (monthly_price_paise >= 0);
alter table public.subscription_plans add constraint subscription_plans_annual_price_check check (annual_price_paise >= 0);

alter table public.organization_subscriptions add column if not exists grace_ends_at timestamptz;
alter table public.organization_subscriptions add column if not exists requested_plan_id text references public.subscription_plans(id);
alter table public.organization_subscriptions add column if not exists requested_billing_interval text check (requested_billing_interval in ('monthly', 'yearly'));
alter table public.organization_subscriptions add column if not exists provider text;
alter table public.organization_subscriptions add column if not exists provider_customer_id text;
alter table public.organization_subscriptions add column if not exists provider_subscription_id text;
create unique index if not exists organization_subscription_provider_unique
  on public.organization_subscriptions(provider, provider_subscription_id) where provider_subscription_id is not null;

create table if not exists public.organization_usage_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  metric text not null check (metric in ('AI_CREDITS', 'STORAGE_BYTES', 'EMAILS', 'SMS', 'WHATSAPP')),
  period_start date not null,
  period_end date not null,
  quantity bigint not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (organization_id, metric, period_start)
);

create table if not exists public.organization_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  metric text not null,
  quantity bigint not null check (quantity > 0),
  idempotency_key text not null,
  feature text not null,
  actor_user_id text,
  created_at timestamptz not null default now(),
  unique (organization_id, metric, idempotency_key)
);

create table if not exists public.organization_branding (
  organization_id uuid primary key references public.institutes(id) on delete cascade,
  logo_url text,
  primary_color text not null default '#0B132B' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  support_email text,
  support_phone text,
  subdomain text unique check (subdomain ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  subdomain_verified_at timestamptz,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  description text not null,
  enabled_by_default boolean not null default false,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_feature_overrides (
  organization_id uuid not null references public.institutes(id) on delete cascade,
  feature_key text not null references public.platform_feature_flags(key) on delete cascade,
  enabled boolean not null,
  reason text not null,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature_key)
);

create table if not exists public.platform_support_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  requested_by text not null,
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED')),
  approved_by text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_usage_counter_idx on public.organization_usage_counters(organization_id, metric, period_start desc);
create index if not exists organization_usage_event_idx on public.organization_usage_events(organization_id, metric, created_at desc);
create index if not exists support_access_org_idx on public.platform_support_access_requests(organization_id, status, created_at desc);

alter table public.organization_usage_counters enable row level security;
alter table public.organization_usage_events enable row level security;
alter table public.organization_branding enable row level security;
alter table public.platform_feature_flags enable row level security;
alter table public.organization_feature_overrides enable row level security;
alter table public.platform_support_access_requests enable row level security;

drop policy if exists organization_usage_counters_read on public.organization_usage_counters;
create policy organization_usage_counters_read on public.organization_usage_counters
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
drop policy if exists organization_usage_events_read on public.organization_usage_events;
create policy organization_usage_events_read on public.organization_usage_events
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
drop policy if exists organization_branding_read on public.organization_branding;
create policy organization_branding_read on public.organization_branding
  for select using (public.is_organization_member(organization_id));
drop policy if exists organization_feature_overrides_read on public.organization_feature_overrides;
create policy organization_feature_overrides_read on public.organization_feature_overrides
  for select using (public.is_organization_member(organization_id));
drop policy if exists platform_support_access_requests_tenant_read on public.platform_support_access_requests;
create policy platform_support_access_requests_tenant_read on public.platform_support_access_requests
  for select using (public.has_organization_role(organization_id, array['OWNER']));

create or replace function public.lms_consume_quota(
  p_organization_id uuid,
  p_metric text,
  p_quantity bigint,
  p_idempotency_key text,
  p_feature text,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription public.organization_subscriptions%rowtype;
  plan public.subscription_plans%rowtype;
  counter public.organization_usage_counters%rowtype;
  metric_limit bigint;
  v_period_start date := date_trunc('month', current_date)::date;
  v_period_end date := (date_trunc('month', current_date) + interval '1 month')::date;
begin
  if p_quantity <= 0 or char_length(p_idempotency_key) not between 8 and 200 then raise exception 'Invalid quota request' using errcode = '22023'; end if;
  if exists (select 1 from public.organization_usage_events where organization_id = p_organization_id and metric = p_metric and idempotency_key = p_idempotency_key) then
    select * into counter from public.organization_usage_counters candidate where candidate.organization_id = p_organization_id and candidate.metric = p_metric and candidate.period_start = v_period_start;
    return jsonb_build_object('quantity', counter.quantity, 'limit', null, 'idempotent', true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_metric || ':' || v_period_start::text, 0));
  if exists (select 1 from public.organization_usage_events where organization_id = p_organization_id and metric = p_metric and idempotency_key = p_idempotency_key) then
    select * into counter from public.organization_usage_counters candidate where candidate.organization_id = p_organization_id and candidate.metric = p_metric and candidate.period_start = v_period_start;
    return jsonb_build_object('quantity', counter.quantity, 'limit', null, 'idempotent', true);
  end if;
  select * into subscription from public.organization_subscriptions candidate where candidate.organization_id = p_organization_id for update;
  if not found or subscription.status not in ('TRIAL', 'ACTIVE', 'PAST_DUE') then raise exception 'Subscription is not writable' using errcode = '42501'; end if;
  if subscription.status = 'TRIAL' and coalesce(subscription.trial_ends_at, subscription.current_period_end) < now() then raise exception 'Subscription trial ended' using errcode = '42501'; end if;
  if subscription.status = 'PAST_DUE' and coalesce(subscription.grace_ends_at, subscription.current_period_end) < now() then raise exception 'Subscription grace period ended' using errcode = '42501'; end if;
  select * into plan from public.subscription_plans where id = subscription.plan_id and is_active;
  if not found then raise exception 'Subscription plan is unavailable' using errcode = '23503'; end if;
  metric_limit := case p_metric
    when 'AI_CREDITS' then plan.ai_credits_per_month
    when 'STORAGE_BYTES' then plan.storage_gb::bigint * 1024 * 1024 * 1024
    else coalesce((plan.entitlements -> 'limits' ->> lower(p_metric))::bigint, 0)
  end;
  if metric_limit <= 0 then raise exception 'Feature is not included in this plan' using errcode = '42501'; end if;
  insert into public.organization_usage_counters (organization_id, metric, period_start, period_end, quantity)
  values (p_organization_id, p_metric, v_period_start, v_period_end, 0)
  on conflict (organization_id, metric, period_start) do nothing;
  select * into counter from public.organization_usage_counters candidate
  where candidate.organization_id = p_organization_id and candidate.metric = p_metric and candidate.period_start = v_period_start for update;
  if counter.quantity + p_quantity > metric_limit then raise exception 'Plan quota exceeded' using errcode = '22023'; end if;
  insert into public.organization_usage_events (organization_id, metric, quantity, idempotency_key, feature, actor_user_id)
  values (p_organization_id, p_metric, p_quantity, p_idempotency_key, p_feature, p_actor_user_id);
  update public.organization_usage_counters set quantity = quantity + p_quantity, updated_at = now() where id = counter.id returning * into counter;
  return jsonb_build_object('quantity', counter.quantity, 'limit', metric_limit, 'idempotent', false);
end;
$$;

create or replace function public.lms_enforce_student_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quota integer;
  current_count integer;
begin
  if new.role <> 'STUDENT' or new.status <> 'ACTIVE' then return new; end if;
  if tg_op = 'UPDATE' and old.role = 'STUDENT' and old.status = 'ACTIVE' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.institute_id::text || ':students', 0));
  select plan.student_limit into quota from public.organization_subscriptions subscription
  join public.subscription_plans plan on plan.id = subscription.plan_id
  where subscription.organization_id = new.institute_id
    and (subscription.status = 'ACTIVE'
      or (subscription.status = 'TRIAL' and coalesce(subscription.trial_ends_at, subscription.current_period_end) >= now())
      or (subscription.status = 'PAST_DUE' and coalesce(subscription.grace_ends_at, subscription.current_period_end) >= now()));
  if quota is null then raise exception 'Active subscription required' using errcode = '42501'; end if;
  select count(*)::integer into current_count from public.institute_members
  where institute_id = new.institute_id and role = 'STUDENT' and status = 'ACTIVE';
  if current_count >= quota then raise exception 'Active student quota exceeded' using errcode = '22023'; end if;
  return new;
end;
$$;
drop trigger if exists institute_members_student_quota on public.institute_members;
create trigger institute_members_student_quota before insert or update of role, status on public.institute_members
  for each row execute function public.lms_enforce_student_quota();

create or replace function public.lms_enforce_branch_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quota integer;
  current_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text || ':branches', 0));
  select plan.branch_limit into quota from public.organization_subscriptions subscription
  join public.subscription_plans plan on plan.id = subscription.plan_id
  where subscription.organization_id = new.organization_id
    and (subscription.status = 'ACTIVE'
      or (subscription.status = 'TRIAL' and coalesce(subscription.trial_ends_at, subscription.current_period_end) >= now())
      or (subscription.status = 'PAST_DUE' and coalesce(subscription.grace_ends_at, subscription.current_period_end) >= now()));
  if quota is null then raise exception 'Active subscription required' using errcode = '42501'; end if;
  select count(*)::integer into current_count from public.organization_campuses where organization_id = new.organization_id;
  if current_count >= quota then raise exception 'Campus quota exceeded' using errcode = '22023'; end if;
  return new;
end;
$$;
drop trigger if exists organization_campuses_branch_quota on public.organization_campuses;
create trigger organization_campuses_branch_quota before insert on public.organization_campuses
  for each row execute function public.lms_enforce_branch_quota();

revoke all on function public.lms_consume_quota(uuid, text, bigint, text, text, text) from public;
grant execute on function public.lms_consume_quota(uuid, text, bigint, text, text, text) to service_role;

create or replace function public.lms_subscription_mutation(
  p_organization_id uuid, p_actor_user_id text, p_actor_role text, p_action text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare subscription public.organization_subscriptions%rowtype;
begin
  if p_actor_role <> 'OWNER' then raise exception 'Only the owner can manage subscriptions' using errcode = '42501'; end if;
  select * into subscription from public.organization_subscriptions where organization_id = p_organization_id for update;
  if not found then raise exception 'Subscription not found' using errcode = '23503'; end if;
  if p_action = 'REQUEST_PLAN_CHANGE' then
    if not exists (select 1 from public.subscription_plans where id = p_payload ->> 'planId' and is_active) then raise exception 'Plan not found' using errcode = '23503'; end if;
    update public.organization_subscriptions set requested_plan_id = p_payload ->> 'planId', requested_billing_interval = p_payload ->> 'billingInterval', updated_at = now() where id = subscription.id;
  elsif p_action = 'CANCEL_AT_PERIOD_END' then
    update public.organization_subscriptions set cancel_at_period_end = (p_payload ->> 'cancel')::boolean, updated_at = now() where id = subscription.id;
  elsif p_action = 'UPDATE_BRANDING' then
    insert into public.organization_branding (
      organization_id, logo_url, primary_color, support_email, support_phone, subdomain,
      subdomain_verified_at, updated_by, updated_at
    ) values (
      p_organization_id, nullif(p_payload ->> 'logoUrl', ''), p_payload ->> 'primaryColor',
      nullif(p_payload ->> 'supportEmail', ''), nullif(p_payload ->> 'supportPhone', ''),
      nullif(p_payload ->> 'subdomain', ''), null, p_actor_user_id, now()
    ) on conflict (organization_id) do update set
      logo_url = excluded.logo_url, primary_color = excluded.primary_color,
      support_email = excluded.support_email, support_phone = excluded.support_phone,
      subdomain = excluded.subdomain, subdomain_verified_at = null,
      updated_by = excluded.updated_by, updated_at = now();
  else raise exception 'Unsupported subscription action' using errcode = '22023';
  end if;
  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role, 'subscription.' || lower(p_action), 'organization_subscription', subscription.id::text, p_payload);
  return jsonb_build_object('subscriptionId', subscription.id, 'action', p_action);
end;
$$;
revoke all on function public.lms_subscription_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_subscription_mutation(uuid, text, text, text, jsonb) to service_role;

create or replace function public.lms_platform_mutation(
  p_actor_user_id text, p_action text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
  target_id := nullif(p_payload ->> 'organizationId', '')::uuid;
  if p_action = 'SET_ORGANIZATION_STATUS' then
    if coalesce(p_payload ->> 'status', '') not in ('ACTIVE', 'SUSPENDED') then raise exception 'Invalid organization status' using errcode = '22023'; end if;
    update public.institutes set status = p_payload ->> 'status' where id = target_id;
    if not found then raise exception 'Organization not found' using errcode = '23503'; end if;
  elsif p_action = 'UPDATE_PLAN' then
    update public.subscription_plans set
      name = p_payload ->> 'name', price_inr = round((p_payload ->> 'monthlyPricePaise')::numeric / 100)::integer,
      monthly_price_paise = (p_payload ->> 'monthlyPricePaise')::bigint,
      annual_price_paise = (p_payload ->> 'annualPricePaise')::bigint,
      student_limit = (p_payload ->> 'studentLimit')::integer, branch_limit = (p_payload ->> 'branchLimit')::integer,
      storage_gb = (p_payload ->> 'storageGb')::integer, ai_credits_per_month = (p_payload ->> 'aiCreditsPerMonth')::integer,
      entitlements = p_payload -> 'entitlements', is_active = (p_payload ->> 'isActive')::boolean
    where id = p_payload ->> 'planId';
    if not found then raise exception 'Plan not found' using errcode = '23503'; end if;
  elsif p_action = 'SET_FEATURE_FLAG' then
    insert into public.platform_feature_flags (key, description, enabled_by_default, updated_by)
    values (p_payload ->> 'key', p_payload ->> 'description', (p_payload ->> 'enabled')::boolean, p_actor_user_id)
    on conflict (key) do update set description = excluded.description, enabled_by_default = excluded.enabled_by_default, updated_by = excluded.updated_by, updated_at = now();
  else raise exception 'Unsupported platform action' using errcode = '22023';
  end if;
  insert into public.platform_audit_logs (actor_user_id, actor_role, target_organization_id, action, details)
  values (p_actor_user_id, 'PLATFORM_SUPER_ADMIN', target_id, lower(p_action), p_payload);
  return jsonb_build_object('action', p_action, 'organizationId', target_id);
end;
$$;
revoke all on function public.lms_platform_mutation(text, text, jsonb) from public;
grant execute on function public.lms_platform_mutation(text, text, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0017_communications_ai_drafts.sql
-- ---------------------------------------------------------------------

-- In-app communications and reviewed, tenant-scoped AI drafts.

alter table public.organization_announcements add column if not exists category text not null default 'GENERAL';
alter table public.organization_announcements add column if not exists status text not null default 'PUBLISHED';
alter table public.organization_announcements add column if not exists channels text[] not null default array['PORTAL']::text[];
alter table public.organization_announcements add column if not exists published_at timestamptz;
alter table public.organization_announcements add column if not exists updated_at timestamptz not null default now();
alter table public.organization_announcements add constraint organization_announcements_category_check check (category in ('ACADEMIC', 'EXAM', 'HOLIDAY', 'FEE', 'GENERAL'));
alter table public.organization_announcements add constraint organization_announcements_status_check check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
alter table public.organization_announcements add constraint organization_announcements_channels_check check (channels <@ array['PORTAL', 'EMAIL', 'SMS', 'WHATSAPP']::text[]);
alter table public.organization_announcements add constraint organization_announcements_id_org_unique unique (id, organization_id);
update public.organization_announcements set published_at = coalesce(published_at, created_at) where status = 'PUBLISHED';

create table if not exists public.organization_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  announcement_id uuid,
  recipient_user_id text not null,
  kind text not null,
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (announcement_id, organization_id) references public.organization_announcements(id, organization_id) on delete cascade,
  unique (organization_id, announcement_id, recipient_user_id)
);

create table if not exists public.organization_notification_preferences (
  organization_id uuid not null references public.institutes(id) on delete cascade,
  user_id text not null,
  portal_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.organization_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  announcement_id uuid not null,
  channel text not null check (channel in ('EMAIL', 'SMS', 'WHATSAPP')),
  status text not null default 'BLOCKED_CONFIG' check (status in ('QUEUED', 'PROCESSING', 'DELIVERED', 'PARTIAL', 'FAILED', 'BLOCKED_CONFIG')),
  provider text,
  recipient_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (announcement_id, organization_id) references public.organization_announcements(id, organization_id) on delete cascade,
  unique (organization_id, announcement_id, channel)
);

create table if not exists public.organization_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  feature text not null check (feature in ('ANNOUNCEMENT_DRAFT', 'QUESTION_DRAFTS', 'LESSON_SUMMARY')),
  request_id text not null,
  status text not null default 'PROCESSING' check (status in ('PROCESSING', 'DRAFT', 'APPROVED', 'REJECTED', 'FAILED')),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  source_references jsonb not null default '[]'::jsonb check (jsonb_typeof(source_references) = 'array'),
  output jsonb not null default '{}'::jsonb check (jsonb_typeof(output) = 'object'),
  model text not null,
  prompt_version text not null,
  input_tokens integer,
  output_tokens integer,
  created_by text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (organization_id, request_id)
);

create index if not exists organization_notifications_recipient_idx on public.organization_notifications(organization_id, recipient_user_id, read_at, created_at desc);
create index if not exists organization_delivery_jobs_status_idx on public.organization_delivery_jobs(organization_id, status, created_at desc);
create index if not exists organization_ai_drafts_idx on public.organization_ai_drafts(organization_id, feature, status, created_at desc);

alter table public.organization_notifications enable row level security;
alter table public.organization_notification_preferences enable row level security;
alter table public.organization_delivery_jobs enable row level security;
alter table public.organization_ai_drafts enable row level security;
drop policy if exists organization_notifications_read on public.organization_notifications;
create policy organization_notifications_read on public.organization_notifications for select using (recipient_user_id = public.requesting_user_id());
drop policy if exists organization_notification_preferences_read on public.organization_notification_preferences;
create policy organization_notification_preferences_read on public.organization_notification_preferences for select using (user_id = public.requesting_user_id());
drop policy if exists organization_delivery_jobs_read on public.organization_delivery_jobs;
create policy organization_delivery_jobs_read on public.organization_delivery_jobs for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
drop policy if exists organization_ai_drafts_read on public.organization_ai_drafts;
create policy organization_ai_drafts_read on public.organization_ai_drafts for select using (
  created_by = public.requesting_user_id() or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
);

drop policy if exists org_announcements_manage on public.organization_announcements;
drop policy if exists org_announcements_read on public.organization_announcements;
drop policy if exists org_announcements_read on public.organization_announcements;
create policy org_announcements_read on public.organization_announcements for select using (
  public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
  or (public.has_organization_role(organization_id, array['TEACHER']) and (status = 'PUBLISHED' or created_by = public.requesting_user_id()))
  or (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT']) and status = 'PUBLISHED' and (
    target_audience = 'ALL'
    or (target_audience = 'FACULTY' and public.has_organization_role(organization_id, array['TEACHER']))
    or (target_audience = 'PARENTS' and public.has_organization_role(organization_id, array['PARENT']))
    or (target_audience = 'BATCH' and exists (
      select 1 from public.organization_batch_members member where member.organization_id = organization_announcements.organization_id
        and member.batch_id = organization_announcements.batch_id and member.user_id = public.requesting_user_id()
    ))
  ))
);

create or replace function public.lms_announcement_mutation(
  p_organization_id uuid, p_actor_user_id text, p_actor_role text, p_action text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  announcement public.organization_announcements%rowtype;
  recipient record;
  channel_name text;
begin
  if p_action = 'MARK_READ' then
    update public.organization_notifications set read_at = coalesce(read_at, now())
    where id = (p_payload ->> 'notificationId')::uuid and organization_id = p_organization_id and recipient_user_id = p_actor_user_id;
    if not found then raise exception 'Notification not found' using errcode = '23503'; end if;
    return jsonb_build_object('id', p_payload ->> 'notificationId', 'action', p_action);
  end if;
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then raise exception 'Role cannot manage announcements' using errcode = '42501'; end if;
  if p_action = 'CREATE' then
    if p_actor_role = 'TEACHER' and (p_payload ->> 'targetAudience') not in ('BATCH', 'FACULTY') then raise exception 'Teachers may publish only to assigned batches or faculty' using errcode = '42501'; end if;
    if (p_payload ->> 'targetAudience') = 'BATCH' and not exists (
      select 1 from public.organization_batches batch where batch.id = (p_payload ->> 'batchId')::uuid and batch.organization_id = p_organization_id
        and (p_actor_role <> 'TEACHER' or exists (select 1 from public.organization_batch_members member where member.organization_id = p_organization_id and member.batch_id = batch.id and member.user_id = p_actor_user_id and member.role = 'TEACHER'))
    ) then raise exception 'Batch not found or not assigned' using errcode = '42501'; end if;
    insert into public.organization_announcements (
      organization_id, batch_id, title, content, target_audience, priority, category, status, channels, created_by, published_at
    ) values (
      p_organization_id, nullif(p_payload ->> 'batchId', '')::uuid, p_payload ->> 'title', p_payload ->> 'content',
      p_payload ->> 'targetAudience', p_payload ->> 'priority', p_payload ->> 'category', p_payload ->> 'status',
      array(select jsonb_array_elements_text(p_payload -> 'channels')), p_actor_user_id,
      case when p_payload ->> 'status' = 'PUBLISHED' then now() else null end
    ) returning * into announcement;
  elsif p_action = 'PUBLISH' then
    select * into announcement from public.organization_announcements candidate where candidate.id = (p_payload ->> 'announcementId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found then raise exception 'Announcement not found' using errcode = '23503'; end if;
    if p_actor_role = 'TEACHER' and announcement.created_by <> p_actor_user_id then raise exception 'Teacher can publish only own drafts' using errcode = '42501'; end if;
    update public.organization_announcements set status = 'PUBLISHED', published_at = coalesce(published_at, now()), updated_at = now() where id = announcement.id returning * into announcement;
  else raise exception 'Unsupported announcement action' using errcode = '22023';
  end if;

  if announcement.status = 'PUBLISHED' then
    for recipient in
      select distinct member.user_id from public.institute_members member
      where member.institute_id = p_organization_id and member.status = 'ACTIVE' and member.user_id is not null
        and (announcement.target_audience = 'ALL'
          or (announcement.target_audience = 'FACULTY' and member.role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'))
          or (announcement.target_audience = 'PARENTS' and member.role = 'PARENT')
          or (announcement.target_audience = 'BATCH' and exists (select 1 from public.organization_batch_members batch_member where batch_member.organization_id = p_organization_id and batch_member.batch_id = announcement.batch_id and batch_member.user_id = member.user_id)))
    loop
      insert into public.organization_notifications (organization_id, announcement_id, recipient_user_id, kind, title, body, action_url)
      values (p_organization_id, announcement.id, recipient.user_id, 'ANNOUNCEMENT', announcement.title, announcement.content, '/dashboard/announcements')
      on conflict (organization_id, announcement_id, recipient_user_id) do nothing;
    end loop;
    foreach channel_name in array announcement.channels loop
      if channel_name <> 'PORTAL' then
        insert into public.organization_delivery_jobs (organization_id, announcement_id, channel, status)
        values (p_organization_id, announcement.id, channel_name, 'BLOCKED_CONFIG')
        on conflict (organization_id, announcement_id, channel) do nothing;
      end if;
    end loop;
  end if;
  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role, 'announcement.' || lower(p_action), 'announcement', announcement.id::text, p_payload);
  return jsonb_build_object('id', announcement.id, 'action', p_action, 'status', announcement.status);
end;
$$;
revoke all on function public.lms_announcement_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_announcement_mutation(uuid, text, text, text, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0018_crm_analytics_readiness.sql
-- ---------------------------------------------------------------------

-- Admissions CRM hardening. All writes are service-only, tenant-scoped and audited.

drop policy if exists organization_leads_manage on public.organization_leads;
drop policy if exists organization_leads_read on public.organization_leads;
create policy organization_leads_read on public.organization_leads
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

create or replace function public.lms_crm_mutation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  lead public.organization_leads%rowtype;
  created_id uuid;
  before_state jsonb;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN') then
    raise exception 'CRM access denied' using errcode = '42501';
  end if;

  if p_action = 'CREATE_LEAD' then
    if nullif(p_payload ->> 'targetBatchId', '') is not null and not exists (
      select 1 from public.organization_batches
      where id = (p_payload ->> 'targetBatchId')::uuid and organization_id = p_organization_id
    ) then
      raise exception 'Target batch is outside organization' using errcode = '23503';
    end if;
    insert into public.organization_leads (
      organization_id, name, email, phone, guardian_name, guardian_phone,
      target_exam, target_batch_id, source, assigned_counsellor_id,
      assigned_counsellor_name, follow_up_date, estimated_fee, notes
    ) values (
      p_organization_id, p_payload ->> 'name', nullif(p_payload ->> 'email', ''),
      p_payload ->> 'phone', nullif(p_payload ->> 'guardianName', ''),
      nullif(p_payload ->> 'guardianPhone', ''), p_payload ->> 'targetExam',
      nullif(p_payload ->> 'targetBatchId', '')::uuid, p_payload ->> 'source',
      p_actor_user_id, nullif(p_payload ->> 'assignedCounsellorName', ''),
      nullif(p_payload ->> 'followUpDate', '')::date,
      coalesce((p_payload ->> 'estimatedFeePaise')::numeric, 0) / 100,
      nullif(p_payload ->> 'notes', '')
    ) returning id into created_id;
  elsif p_action in ('UPDATE_STAGE', 'UPDATE_FOLLOW_UP') then
    select * into lead from public.organization_leads candidate
    where candidate.id = (p_payload ->> 'leadId')::uuid
      and candidate.organization_id = p_organization_id for update;
    if not found then raise exception 'Lead not found' using errcode = '23503'; end if;
    before_state := to_jsonb(lead);
    if p_action = 'UPDATE_STAGE' then
      if p_payload ->> 'stage' = 'CONVERTED' then
        raise exception 'Complete reviewed student onboarding before conversion' using errcode = '22023';
      end if;
      update public.organization_leads set stage = p_payload ->> 'stage', updated_at = now()
      where id = lead.id and organization_id = p_organization_id;
    else
      update public.organization_leads
      set follow_up_date = nullif(p_payload ->> 'followUpDate', '')::date,
          notes = coalesce(nullif(p_payload ->> 'notes', ''), notes), updated_at = now()
      where id = lead.id and organization_id = p_organization_id;
    end if;
    created_id := lead.id;
  else
    raise exception 'Unsupported CRM action' using errcode = '22023';
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id,
    before_state, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'admission_lead',
    created_id::text, before_state, p_payload
  );
  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

revoke all on function public.lms_crm_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_crm_mutation(uuid, text, text, text, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0019_phase8_comprehensive_workflows.sql
-- ---------------------------------------------------------------------

-- Phase 8: Reviewed guardian linking, descriptive grading, support access, AI draft promotion, and payment reconciliation.

-- 1. Reviewed Guardian–Student Linking
create table if not exists public.organization_guardian_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  guardian_user_id text not null,
  student_user_id text not null,
  relationship text not null check (relationship in ('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'OTHER')),
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVOKED')),
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, guardian_user_id, student_user_id)
);

create index if not exists org_guardian_links_lookup_idx
  on public.organization_guardian_links(organization_id, guardian_user_id, status);
create index if not exists org_guardian_links_student_idx
  on public.organization_guardian_links(organization_id, student_user_id, status);

alter table public.organization_guardian_links enable row level security;

drop policy if exists org_guardian_links_read on public.organization_guardian_links;
create policy org_guardian_links_read on public.organization_guardian_links
  for select using (
    guardian_user_id = public.requesting_user_id()
    or student_user_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
  );

create or replace function public.is_approved_guardian(
  target_org_id uuid,
  target_student_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_guardian_links
    where organization_id = target_org_id
      and student_user_id = target_student_id
      and guardian_user_id = public.requesting_user_id()
      and status = 'APPROVED'
  );
$$;

revoke all on function public.is_approved_guardian(uuid, text) from public;
grant execute on function public.is_approved_guardian(uuid, text) to authenticated;

-- Update RLS on attendance records to allow approved guardians to read only their child's attendance
drop policy if exists org_attendance_records_read on public.organization_attendance_records;
drop policy if exists org_attendance_records_read on public.organization_attendance_records;
create policy org_attendance_records_read on public.organization_attendance_records
  for select using (
    student_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_id)
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

-- Update RLS on student fees to allow approved guardians to view only their linked student's fee ledgers
drop policy if exists org_student_fees_read on public.organization_student_fees;
drop policy if exists org_student_fees_read on public.organization_student_fees;
create policy org_student_fees_read on public.organization_student_fees
  for select using (
    student_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_id)
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']
    )
  );

-- 2. Descriptive / Subjective Assessment Evaluation & Moderation
create table if not exists public.organization_descriptive_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  attempt_id uuid not null,
  test_id uuid not null,
  question_id uuid not null,
  student_user_id text not null,
  answer_text text,
  file_url text,
  max_marks numeric(5,2) not null default 5.0 check (max_marks > 0),
  awarded_marks numeric(5,2) check (awarded_marks is null or (awarded_marks >= 0 and awarded_marks <= max_marks)),
  feedback text,
  evaluator_user_id text,
  status text not null default 'PENDING_EVALUATION' check (status in ('PENDING_EVALUATION', 'GRADED', 'MODERATION_REQUESTED', 'MODERATED')),
  moderator_user_id text,
  moderator_notes text,
  graded_at timestamptz,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, attempt_id, question_id)
);

create index if not exists org_descriptive_subs_eval_idx
  on public.organization_descriptive_submissions(organization_id, status, created_at asc);
create index if not exists org_descriptive_subs_student_idx
  on public.organization_descriptive_submissions(organization_id, student_user_id, attempt_id);

alter table public.organization_descriptive_submissions enable row level security;

drop policy if exists org_descriptive_subs_read on public.organization_descriptive_submissions;
create policy org_descriptive_subs_read on public.organization_descriptive_submissions
  for select using (
    student_user_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_user_id)
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
  );

create or replace function public.lms_grade_descriptive_submission(
  p_organization_id uuid,
  p_submission_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_awarded_marks numeric,
  p_feedback text,
  p_is_moderation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.organization_descriptive_submissions%rowtype;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Unauthorized to evaluate submissions' using errcode = '42501';
  end if;

  select * into sub
  from public.organization_descriptive_submissions
  where id = p_submission_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Descriptive submission not found' using errcode = '23503';
  end if;

  if p_awarded_marks < 0 or p_awarded_marks > sub.max_marks then
    raise exception 'Awarded marks must be between 0 and %', sub.max_marks using errcode = '22023';
  end if;

  if p_is_moderation then
    if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR') then
      raise exception 'Only administrators can moderate grades' using errcode = '42501';
    end if;
    update public.organization_descriptive_submissions set
      awarded_marks = p_awarded_marks,
      moderator_user_id = p_actor_user_id,
      moderator_notes = p_feedback,
      status = 'MODERATED',
      moderated_at = now(),
      updated_at = now()
    where id = sub.id;
  else
    update public.organization_descriptive_submissions set
      awarded_marks = p_awarded_marks,
      evaluator_user_id = p_actor_user_id,
      feedback = p_feedback,
      status = 'GRADED',
      graded_at = now(),
      updated_at = now()
    where id = sub.id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role,
    case when p_is_moderation then 'assessment.descriptive_moderated' else 'assessment.descriptive_graded' end,
    'descriptive_submission', sub.id::text,
    jsonb_build_object('awardedMarks', p_awarded_marks, 'isModeration', p_is_moderation)
  );

  return jsonb_build_object('submissionId', sub.id, 'status', case when p_is_moderation then 'MODERATED' else 'GRADED' end, 'awardedMarks', p_awarded_marks);
end;
$$;

revoke all on function public.lms_grade_descriptive_submission(uuid, uuid, text, text, numeric, text, boolean) from public;
grant execute on function public.lms_grade_descriptive_submission(uuid, uuid, text, text, numeric, text, boolean) to service_role;

-- 3. Canonical Promotion Workflow for Reviewed AI Drafts
create or replace function public.lms_promote_ai_draft(
  p_organization_id uuid,
  p_draft_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.organization_ai_drafts%rowtype;
  promoted_id uuid;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR') then
    raise exception 'Unauthorized to review AI drafts' using errcode = '42501';
  end if;

  if p_decision not in ('APPROVE_AND_PUBLISH', 'APPROVE_AS_DRAFT', 'REJECT') then
    raise exception 'Invalid review decision' using errcode = '22023';
  end if;

  select * into draft
  from public.organization_ai_drafts
  where id = p_draft_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'AI draft not found' using errcode = '23503';
  end if;

  if draft.status not in ('DRAFT', 'PROCESSING') then
    raise exception 'Draft is already in terminal state %', draft.status using errcode = '22023';
  end if;

  if p_decision = 'REJECT' then
    update public.organization_ai_drafts set
      status = 'REJECTED',
      reviewed_by = p_actor_user_id,
      reviewed_at = now(),
      error_message = p_notes
    where id = draft.id;
    return jsonb_build_object('draftId', draft.id, 'status', 'REJECTED');
  end if;

  -- Promotion logic according to feature
  if draft.feature = 'ANNOUNCEMENT_DRAFT' then
    insert into public.organization_announcements (
      organization_id, title, content, target_audience, priority, category,
      status, channels, created_by, published_at
    ) values (
      p_organization_id,
      draft.output ->> 'title',
      draft.output ->> 'content',
      coalesce(draft.output ->> 'targetAudience', 'ALL'),
      coalesce(draft.output ->> 'priority', 'NORMAL'),
      coalesce(draft.output ->> 'category', 'GENERAL'),
      case when p_decision = 'APPROVE_AND_PUBLISH' then 'PUBLISHED' else 'DRAFT' end,
      array['PORTAL']::text[],
      p_actor_user_id,
      case when p_decision = 'APPROVE_AND_PUBLISH' then now() else null end
    ) returning id into promoted_id;
  end if;

  update public.organization_ai_drafts set
    status = 'APPROVED',
    reviewed_by = p_actor_user_id,
    reviewed_at = now()
  where id = draft.id;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role, 'ai_draft.promoted',
    'organization_ai_draft', draft.id::text,
    jsonb_build_object('decision', p_decision, 'promotedId', promoted_id)
  );

  return jsonb_build_object('draftId', draft.id, 'status', 'APPROVED', 'promotedId', promoted_id);
end;
$$;

revoke all on function public.lms_promote_ai_draft(uuid, uuid, text, text, text, text) from public;
grant execute on function public.lms_promote_ai_draft(uuid, uuid, text, text, text, text) to service_role;

-- 4. Approved, Time-Bounded Platform Support Access
create or replace function public.lms_review_support_access(
  p_organization_id uuid,
  p_request_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_decision text,
  p_duration_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.platform_support_access_requests%rowtype;
begin
  if p_actor_role <> 'OWNER' then
    raise exception 'Only institute owners can approve support access' using errcode = '42501';
  end if;

  if p_decision not in ('APPROVE', 'REJECT', 'REVOKE') then
    raise exception 'Invalid support access decision' using errcode = '22023';
  end if;

  select * into req
  from public.platform_support_access_requests
  where id = p_request_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Support access request not found' using errcode = '23503';
  end if;

  if p_decision = 'APPROVE' then
    update public.platform_support_access_requests set
      status = 'APPROVED',
      approved_by = p_actor_user_id,
      expires_at = now() + (least(greatest(p_duration_hours, 1), 72) || ' hours')::interval,
      updated_at = now()
    where id = req.id;
  elsif p_decision = 'REJECT' then
    update public.platform_support_access_requests set
      status = 'REJECTED',
      updated_at = now()
    where id = req.id;
  else
    update public.platform_support_access_requests set
      status = 'REVOKED',
      updated_at = now()
    where id = req.id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role, 'support_access.' || lower(p_decision),
    'platform_support_access_request', req.id::text,
    jsonb_build_object('decision', p_decision, 'durationHours', p_duration_hours)
  );

  return jsonb_build_object('requestId', req.id, 'status', p_decision);
end;
$$;

revoke all on function public.lms_review_support_access(uuid, uuid, text, text, text, integer) from public;
grant execute on function public.lms_review_support_access(uuid, uuid, text, text, text, integer) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0020_guardian_link_reconciliation.sql
-- ---------------------------------------------------------------------

-- Reconcile the legacy verified parent link table with the reviewed guardian model.
-- This migration is additive and intentionally keeps the legacy rows in place.

do $$
begin
  if to_regclass('public.organization_parent_students') is not null then
    insert into public.organization_guardian_links (
      organization_id,
      guardian_user_id,
      student_user_id,
      relationship,
      status,
      reviewed_by,
      reviewed_at,
      notes,
      created_at,
      updated_at
    )
    select
      legacy.organization_id,
      legacy.parent_user_id,
      legacy.student_user_id,
      case legacy.relationship
        when 'FATHER' then 'FATHER'
        when 'MOTHER' then 'MOTHER'
        else 'LEGAL_GUARDIAN'
      end,
      case when legacy.is_verified then 'APPROVED' else 'PENDING_REVIEW' end,
      legacy.verified_by,
      case when legacy.is_verified then legacy.created_at else null end,
      'Backfilled from organization_parent_students by migration 0020',
      legacy.created_at,
      now()
    from public.organization_parent_students legacy
    on conflict (organization_id, guardian_user_id, student_user_id) do nothing;
  end if;
end
$$;

drop policy if exists org_guardian_links_manage on public.organization_guardian_links;
drop policy if exists org_guardian_links_manage on public.organization_guardian_links;
create policy org_guardian_links_manage on public.organization_guardian_links
  for all
  using (
    public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR']
    )
  )
  with check (
    public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR']
    )
  );


-- ---------------------------------------------------------------------
-- Migration: 0021_platform_rate_limits.sql
-- ---------------------------------------------------------------------

-- Atomic shared rate-limit windows for server-side abuse protection.

create table if not exists public.platform_rate_limit_windows (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash, window_started_at)
);

alter table public.platform_rate_limit_windows enable row level security;

create or replace function public.lms_consume_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  if nullif(trim(p_scope), '') is null or nullif(trim(p_subject_hash), '') is null then
    raise exception 'Rate-limit scope and subject are required' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 10000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit bounds' using errcode = '22023';
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.platform_rate_limit_windows (
    scope,
    subject_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    trim(p_scope),
    p_subject_hash,
    v_window_started_at,
    1,
    v_now
  )
  on conflict (scope, subject_hash, window_started_at)
  do update set
    request_count = public.platform_rate_limit_windows.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into v_request_count;

  delete from public.platform_rate_limit_windows
  where scope = trim(p_scope)
    and subject_hash = p_subject_hash
    and window_started_at < v_window_started_at - interval '1 day';

  return query select
    v_request_count <= p_limit,
    greatest(p_limit - v_request_count, 0),
    greatest(ceil(extract(epoch from (v_window_started_at + make_interval(secs => p_window_seconds) - v_now)))::integer, 1);
end;
$$;

revoke all on function public.lms_consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.lms_consume_rate_limit(text, text, integer, integer) to service_role;



-- ---------------------------------------------------------------------
-- Migration: 0022_student_success_interventions.sql
-- ---------------------------------------------------------------------

-- Student-success interventions and reviewed revision plans.
-- Risk calculations are advisory and transparent; no automated punitive action
-- or enrollment decision is permitted from these records.

create table if not exists public.organization_student_interventions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_user_id text not null,
  batch_id uuid,
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('LOW', 'WATCH', 'HIGH', 'CRITICAL')),
  reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  recommended_actions jsonb not null default '[]'::jsonb check (jsonb_typeof(recommended_actions) = 'array'),
  action_plan text not null check (char_length(action_plan) between 3 and 5000),
  owner_user_id text,
  next_review_on date,
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED')),
  resolution_notes text,
  created_by text not null,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, organization_id)
    references public.organization_batches(id, organization_id),
  unique (id, organization_id)
);

create index if not exists organization_student_interventions_queue_idx
  on public.organization_student_interventions(organization_id, status, risk_score desc, next_review_on);
create index if not exists organization_student_interventions_student_idx
  on public.organization_student_interventions(organization_id, student_user_id, created_at desc);
create unique index if not exists organization_student_one_active_intervention_idx
  on public.organization_student_interventions(organization_id, student_user_id)
  where status in ('OPEN', 'IN_PROGRESS');

create table if not exists public.organization_revision_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_user_id text not null,
  intervention_id uuid,
  title text not null check (char_length(title) between 2 and 180),
  goal text not null check (char_length(goal) between 3 and 2000),
  starts_on date not null,
  target_date date not null check (target_date >= starts_on),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  status text not null default 'ACTIVE' check (status in ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
  reviewed_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (intervention_id, organization_id)
    references public.organization_student_interventions(id, organization_id),
  unique (id, organization_id)
);

create index if not exists organization_revision_plans_student_idx
  on public.organization_revision_plans(organization_id, student_user_id, status, target_date);

alter table public.organization_student_interventions enable row level security;
alter table public.organization_revision_plans enable row level security;

drop policy if exists organization_student_interventions_read on public.organization_student_interventions;
create policy organization_student_interventions_read
  on public.organization_student_interventions for select using (
    student_user_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_user_id)
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

drop policy if exists organization_revision_plans_read on public.organization_revision_plans;
create policy organization_revision_plans_read
  on public.organization_revision_plans for select using (
    student_user_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_user_id)
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

create or replace function public.lms_student_success_mutation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  intervention public.organization_student_interventions%rowtype;
  created_id uuid;
  target_student text;
  target_batch uuid;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Role cannot manage student-success interventions' using errcode = '42501';
  end if;

  if p_action = 'CREATE_INTERVENTION' then
    target_student := p_payload ->> 'studentUserId';
    target_batch := nullif(p_payload ->> 'batchId', '')::uuid;

    if not exists (
      select 1 from public.institute_members member
      where member.institute_id = p_organization_id
        and member.user_id = target_student
        and member.role = 'STUDENT'
        and member.status = 'ACTIVE'
    ) then
      raise exception 'Active student not found' using errcode = '23503';
    end if;

    if p_actor_role = 'TEACHER' and not exists (
      select 1
      from public.organization_batch_members teacher_batch
      join public.organization_batch_members student_batch
        on student_batch.organization_id = teacher_batch.organization_id
       and student_batch.batch_id = teacher_batch.batch_id
      where teacher_batch.organization_id = p_organization_id
        and teacher_batch.user_id = p_actor_user_id
        and teacher_batch.role = 'TEACHER'
        and student_batch.user_id = target_student
        and student_batch.role = 'STUDENT'
        and (target_batch is null or teacher_batch.batch_id = target_batch)
    ) then
      raise exception 'Teacher is not assigned to this student' using errcode = '42501';
    end if;

    insert into public.organization_student_interventions (
      organization_id, student_user_id, batch_id, risk_score, risk_level,
      reasons, recommended_actions, action_plan, owner_user_id, next_review_on, created_by
    ) values (
      p_organization_id, target_student, target_batch,
      (p_payload ->> 'riskScore')::integer, p_payload ->> 'riskLevel',
      coalesce(p_payload -> 'reasons', '[]'::jsonb),
      coalesce(p_payload -> 'recommendedActions', '[]'::jsonb),
      p_payload ->> 'actionPlan', coalesce(nullif(p_payload ->> 'ownerUserId', ''), p_actor_user_id),
      nullif(p_payload ->> 'nextReviewOn', '')::date, p_actor_user_id
    ) returning id into created_id;

    insert into public.organization_audit_logs (
      organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
    ) values (
      p_organization_id, p_actor_user_id, p_actor_role, 'student_success.intervention_created',
      'student_intervention', created_id::text,
      jsonb_build_object('studentUserId', target_student, 'riskLevel', p_payload ->> 'riskLevel')
    );

  elsif p_action = 'UPDATE_INTERVENTION' then
    select * into intervention
    from public.organization_student_interventions candidate
    where candidate.id = (p_payload ->> 'interventionId')::uuid
      and candidate.organization_id = p_organization_id
    for update;
    if not found then raise exception 'Intervention not found' using errcode = '23503'; end if;

    if p_actor_role = 'TEACHER' and intervention.owner_user_id <> p_actor_user_id then
      raise exception 'Teacher can update only assigned interventions' using errcode = '42501';
    end if;

    update public.organization_student_interventions set
      status = p_payload ->> 'status',
      action_plan = coalesce(nullif(p_payload ->> 'actionPlan', ''), action_plan),
      resolution_notes = nullif(p_payload ->> 'resolutionNotes', ''),
      resolved_by = case when p_payload ->> 'status' in ('RESOLVED', 'DISMISSED') then p_actor_user_id else null end,
      resolved_at = case when p_payload ->> 'status' in ('RESOLVED', 'DISMISSED') then now() else null end,
      updated_at = now()
    where id = intervention.id;
    created_id := intervention.id;

  elsif p_action = 'CREATE_REVISION_PLAN' then
    select * into intervention
    from public.organization_student_interventions candidate
    where candidate.id = (p_payload ->> 'interventionId')::uuid
      and candidate.organization_id = p_organization_id;
    if not found then raise exception 'Intervention not found' using errcode = '23503'; end if;
    if p_actor_role = 'TEACHER' and intervention.owner_user_id <> p_actor_user_id then
      raise exception 'Teacher can plan only assigned interventions' using errcode = '42501';
    end if;

    insert into public.organization_revision_plans (
      organization_id, student_user_id, intervention_id, title, goal,
      starts_on, target_date, items, status, reviewed_by
    ) values (
      p_organization_id, intervention.student_user_id, intervention.id,
      p_payload ->> 'title', p_payload ->> 'goal',
      (p_payload ->> 'startsOn')::date, (p_payload ->> 'targetDate')::date,
      coalesce(p_payload -> 'items', '[]'::jsonb), 'ACTIVE', p_actor_user_id
    ) returning id into created_id;

  else
    raise exception 'Unsupported student-success action' using errcode = '22023';
  end if;

  if p_action <> 'CREATE_INTERVENTION' then
    insert into public.organization_audit_logs (
      organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
    ) values (
      p_organization_id, p_actor_user_id, p_actor_role,
      'student_success.' || lower(p_action),
      case when p_action = 'CREATE_REVISION_PLAN' then 'revision_plan' else 'student_intervention' end,
      created_id::text, p_payload
    );
  end if;

  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

revoke all on function public.lms_student_success_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_student_success_mutation(uuid, text, text, text, jsonb) to service_role;


-- ---------------------------------------------------------------------
-- Migration: 0023_doubt_discussions.sql
-- ---------------------------------------------------------------------

-- Moderated student doubt threads with batch-scoped faculty access.

create table if not exists public.organization_doubt_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_user_id text not null,
  batch_id uuid not null,
  subject text not null check (char_length(subject) between 2 and 120),
  title text not null check (char_length(title) between 3 and 180),
  description text not null check (char_length(description) between 3 and 10000),
  priority text not null default 'NORMAL' check (priority in ('NORMAL', 'HIGH')),
  status text not null default 'OPEN' check (status in ('OPEN', 'ANSWERED', 'RESOLVED', 'CLOSED')),
  assigned_to text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, organization_id)
    references public.organization_batches(id, organization_id),
  unique (id, organization_id)
);

create table if not exists public.organization_doubt_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  thread_id uuid not null,
  author_user_id text not null,
  author_role text not null check (author_role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT')),
  body text not null check (char_length(body) between 1 and 10000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (thread_id, organization_id)
    references public.organization_doubt_threads(id, organization_id) on delete cascade
);

create index if not exists organization_doubt_threads_queue_idx
  on public.organization_doubt_threads(organization_id, status, priority, updated_at desc);
create index if not exists organization_doubt_threads_student_idx
  on public.organization_doubt_threads(organization_id, student_user_id, created_at desc);
create index if not exists organization_doubt_messages_thread_idx
  on public.organization_doubt_messages(organization_id, thread_id, created_at);

alter table public.organization_doubt_threads enable row level security;
alter table public.organization_doubt_messages enable row level security;

create or replace function public.lms_can_access_doubt_thread(target_thread_id uuid, target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_doubt_threads thread
    where thread.id = target_thread_id
      and thread.organization_id = target_organization_id
      and (
        thread.student_user_id = public.requesting_user_id()
        or public.has_organization_role(
          thread.organization_id,
          array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR']
        )
        or exists (
          select 1 from public.organization_batch_members member
          where member.organization_id = thread.organization_id
            and member.batch_id = thread.batch_id
            and member.user_id = public.requesting_user_id()
            and member.role = 'TEACHER'
        )
      )
  );
$$;

revoke all on function public.lms_can_access_doubt_thread(uuid, uuid) from public;
grant execute on function public.lms_can_access_doubt_thread(uuid, uuid) to authenticated;

drop policy if exists organization_doubt_threads_read on public.organization_doubt_threads;
create policy organization_doubt_threads_read on public.organization_doubt_threads
  for select using (public.lms_can_access_doubt_thread(id, organization_id));

drop policy if exists organization_doubt_messages_read on public.organization_doubt_messages;
create policy organization_doubt_messages_read on public.organization_doubt_messages
  for select using (
    public.lms_can_access_doubt_thread(thread_id, organization_id)
    and (
      not is_internal
      or public.has_organization_role(
        organization_id,
        array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
      )
    )
  );

create or replace function public.lms_doubt_mutation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  thread public.organization_doubt_threads%rowtype;
  created_id uuid;
begin
  if p_action = 'CREATE_THREAD' then
    if p_actor_role <> 'STUDENT' then
      raise exception 'Only students can create doubt threads' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.organization_batch_members member
      where member.organization_id = p_organization_id
        and member.batch_id = (p_payload ->> 'batchId')::uuid
        and member.user_id = p_actor_user_id
        and member.role = 'STUDENT'
    ) then
      raise exception 'Student is not enrolled in this batch' using errcode = '42501';
    end if;
    insert into public.organization_doubt_threads (
      organization_id, student_user_id, batch_id, subject, title, description, priority
    ) values (
      p_organization_id, p_actor_user_id, (p_payload ->> 'batchId')::uuid,
      p_payload ->> 'subject', p_payload ->> 'title', p_payload ->> 'description',
      coalesce(p_payload ->> 'priority', 'NORMAL')
    ) returning id into created_id;
    insert into public.organization_doubt_messages (
      organization_id, thread_id, author_user_id, author_role, body
    ) values (
      p_organization_id, created_id, p_actor_user_id, p_actor_role, p_payload ->> 'description'
    );

  else
    select * into thread from public.organization_doubt_threads candidate
    where candidate.id = (p_payload ->> 'threadId')::uuid
      and candidate.organization_id = p_organization_id
    for update;
    if not found then raise exception 'Doubt thread not found' using errcode = '23503'; end if;

    if p_actor_role = 'STUDENT' and thread.student_user_id <> p_actor_user_id then
      raise exception 'Student cannot access this doubt thread' using errcode = '42501';
    end if;
    if p_actor_role = 'TEACHER' and not exists (
      select 1 from public.organization_batch_members member
      where member.organization_id = p_organization_id
        and member.batch_id = thread.batch_id
        and member.user_id = p_actor_user_id
        and member.role = 'TEACHER'
    ) then
      raise exception 'Teacher is not assigned to this batch' using errcode = '42501';
    end if;
    if p_actor_role not in ('STUDENT', 'TEACHER', 'OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR') then
      raise exception 'Role cannot access doubt threads' using errcode = '42501';
    end if;

    if p_action = 'ADD_MESSAGE' then
      if thread.status = 'CLOSED' then raise exception 'Doubt thread is closed' using errcode = '22023'; end if;
      if coalesce((p_payload ->> 'isInternal')::boolean, false) and p_actor_role = 'STUDENT' then
        raise exception 'Students cannot create internal notes' using errcode = '42501';
      end if;
      insert into public.organization_doubt_messages (
        organization_id, thread_id, author_user_id, author_role, body, is_internal
      ) values (
        p_organization_id, thread.id, p_actor_user_id, p_actor_role,
        p_payload ->> 'body', coalesce((p_payload ->> 'isInternal')::boolean, false)
      ) returning id into created_id;
      update public.organization_doubt_threads set
        status = case when p_actor_role = 'STUDENT' then 'OPEN' else 'ANSWERED' end,
        assigned_to = case when p_actor_role = 'TEACHER' then p_actor_user_id else assigned_to end,
        updated_at = now()
      where id = thread.id;

    elsif p_action = 'SET_STATUS' then
      if p_actor_role = 'STUDENT' and p_payload ->> 'status' not in ('OPEN', 'RESOLVED') then
        raise exception 'Student cannot set that status' using errcode = '42501';
      end if;
      update public.organization_doubt_threads set
        status = p_payload ->> 'status',
        resolved_by = case when p_payload ->> 'status' in ('RESOLVED', 'CLOSED') then p_actor_user_id else null end,
        resolved_at = case when p_payload ->> 'status' in ('RESOLVED', 'CLOSED') then now() else null end,
        updated_at = now()
      where id = thread.id;
      created_id := thread.id;
    else
      raise exception 'Unsupported doubt action' using errcode = '22023';
    end if;
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role,
    'doubt.' || lower(p_action),
    case when p_action = 'ADD_MESSAGE' then 'doubt_message' else 'doubt_thread' end,
    created_id::text,
    case
      when p_action = 'ADD_MESSAGE' then jsonb_build_object('threadId', p_payload ->> 'threadId', 'isInternal', coalesce((p_payload ->> 'isInternal')::boolean, false))
      else p_payload - 'description'
    end
  );

  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

revoke all on function public.lms_doubt_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_doubt_mutation(uuid, text, text, text, jsonb) to service_role;


COMMIT;
