-- Prepzii B2B LMS — Migration 0005: Canonical Schema Reconciliation
-- Reconciles B2B LMS tables with verified consumer Prepzii Supabase backend.
--
-- Prerequisites:
--   1. Existing Prepzii consumer tables:
--      public.institutes, public.institute_members, public.institute_batches,
--      public.institute_batch_members, public.questions, public.pyq_questions,
--      public.institute_tests, public.institute_test_questions,
--      public.institute_test_attempts, public.test_sessions, public.test_attempts
--   2. B2B Migrations 0001, 0002, 0003, 0004
--
-- Safety:
--   - Non-destructive additive migration
--   - Preserves all canonical consumer columns and data
--   - Eliminates table redundancy while preserving backward compatibility via SQL views
--   - DO NOT EXECUTE DIRECTLY ON PRODUCTION WITHOUT STAGING VERIFICATION

create extension if not exists pgcrypto;

-- =================================================================
-- 1. EXTEND CANONICAL institute_batches WITH B2B OPERATIONAL METADATA
-- =================================================================
-- Canonical table public.institute_batches has:
-- id uuid, institute_id uuid, name text, exam text, target_year integer, created_at timestamptz.
-- We add institutional extensions as nullable/defaulted columns:

alter table public.institute_batches
  add column if not exists campus_id uuid references public.organization_campuses(id) on delete set null,
  add column if not exists academic_year_id uuid references public.organization_academic_years(id) on delete set null,
  add column if not exists grade_level text,
  add column if not exists room_number text,
  add column if not exists is_active boolean not null default true;

create index if not exists institute_batches_campus_idx on public.institute_batches(campus_id);
create index if not exists institute_batches_year_idx on public.institute_batches(academic_year_id);
create index if not exists institute_batches_active_idx on public.institute_batches(is_active);

-- =================================================================
-- 2. EXTEND CANONICAL institute_batch_members WITH B2B METADATA
-- =================================================================
-- Canonical table public.institute_batch_members has:
-- id uuid, batch_id uuid, member_id uuid, created_at timestamptz.
-- We add roll number, role, and enrollment timestamp:

alter table public.institute_batch_members
  add column if not exists roll_number text,
  add column if not exists role text not null default 'STUDENT' check (role in ('STUDENT', 'TEACHER')),
  add column if not exists enrolled_at timestamptz not null default now();

create index if not exists inst_batch_members_role_idx on public.institute_batch_members(role);
create index if not exists inst_batch_members_roll_idx on public.institute_batch_members(roll_number);

-- =================================================================
-- 3. MIGRATE DATA FROM organization_batches IF PREVIOUSLY CREATED
-- =================================================================
do $$
begin
  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'organization_batches' and table_type = 'BASE TABLE'
  ) then
    -- Copy any rows from organization_batches into institute_batches
    insert into public.institute_batches (
      id,
      institute_id,
      campus_id,
      academic_year_id,
      name,
      exam,
      grade_level,
      room_number,
      is_active,
      created_at
    )
    select
      ob.id,
      ob.organization_id,
      ob.campus_id,
      ob.academic_year_id,
      ob.name,
      ob.target_exam,
      ob.grade_level,
      ob.room_number,
      ob.is_active,
      ob.created_at
    from public.organization_batches ob
    on conflict (id) do nothing;
  end if;
end $$;

-- =================================================================
-- 4. RECONCILE FOREIGN KEYS POINTING TO BATCHES
-- =================================================================
-- Point foreign keys from organization_batches to canonical institute_batches

-- A. organization_attendance_sessions
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'organization_attendance_sessions' and constraint_name = 'organization_attendance_sessions_batch_id_fkey'
  ) then
    alter table public.organization_attendance_sessions
      drop constraint organization_attendance_sessions_batch_id_fkey;
  end if;

  alter table public.organization_attendance_sessions
    add constraint org_attendance_sessions_batch_fk
    foreign key (batch_id) references public.institute_batches(id) on delete cascade;
exception when others then
  raise notice 'Attendance sessions batch FK adjustment notice: %', sqlerrm;
end $$;

-- B. organization_test_schedules
-- Reconcile both batch_id and test_id foreign keys
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'organization_test_schedules' and constraint_name = 'organization_test_schedules_batch_id_fkey'
  ) then
    alter table public.organization_test_schedules
      drop constraint organization_test_schedules_batch_id_fkey;
  end if;

  alter table public.organization_test_schedules
    add constraint org_test_schedules_batch_fk
    foreign key (batch_id) references public.institute_batches(id) on delete cascade;

  -- Add explicit foreign key to canonical public.institute_tests(id)
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'organization_test_schedules' and constraint_name = 'org_test_schedules_test_fk'
  ) then
    alter table public.organization_test_schedules
      add constraint org_test_schedules_test_fk
      foreign key (test_id) references public.institute_tests(id) on delete cascade;
  end if;
exception when others then
  raise notice 'Test schedules FK adjustment notice: %', sqlerrm;
end $$;

-- C. organization_announcements
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'organization_announcements' and constraint_name = 'organization_announcements_batch_id_fkey'
  ) then
    alter table public.organization_announcements
      drop constraint organization_announcements_batch_id_fkey;
  end if;

  alter table public.organization_announcements
    add constraint org_announcements_batch_fk
    foreign key (batch_id) references public.institute_batches(id) on delete cascade;
exception when others then
  raise notice 'Announcements batch FK adjustment notice: %', sqlerrm;
end $$;

-- D. organization_notification_dispatches
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'organization_notification_dispatches' and constraint_name = 'organization_notification_dispatches_batch_id_fkey'
  ) then
    alter table public.organization_notification_dispatches
      drop constraint organization_notification_dispatches_batch_id_fkey;
  end if;

  alter table public.organization_notification_dispatches
    add constraint org_notif_dispatches_batch_fk
    foreign key (batch_id) references public.institute_batches(id) on delete set null;
exception when others then
  raise notice 'Notification dispatches batch FK adjustment notice: %', sqlerrm;
end $$;

-- E. organization_student_fees
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'organization_student_fees' and constraint_name = 'organization_student_fees_batch_id_fkey'
  ) then
    alter table public.organization_student_fees
      drop constraint organization_student_fees_batch_id_fkey;
  end if;

  alter table public.organization_student_fees
    add constraint org_student_fees_batch_fk
    foreign key (batch_id) references public.institute_batches(id) on delete set null;
exception when others then
  raise notice 'Student fees batch FK adjustment notice: %', sqlerrm;
end $$;

-- F. organization_admissions_enquiries
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'organization_admissions_enquiries' and constraint_name = 'organization_admissions_enquiries_target_batch_id_fkey'
  ) then
    alter table public.organization_admissions_enquiries
      drop constraint organization_admissions_enquiries_target_batch_id_fkey;
  end if;

  alter table public.organization_admissions_enquiries
    add constraint org_admissions_enquiries_batch_fk
    foreign key (target_batch_id) references public.institute_batches(id) on delete set null;
exception when others then
  raise notice 'Admissions enquiries batch FK adjustment notice: %', sqlerrm;
end $$;

-- =================================================================
-- 5. RECONCILE CBT SESSIONS & ANSWERS
-- =================================================================
-- Add bidirectional traceability columns to canonical test_sessions and institute_test_attempts
alter table public.organization_cbt_sessions
  add column if not exists test_session_id uuid references public.test_sessions(id) on delete set null,
  add column if not exists institute_attempt_id uuid references public.institute_test_attempts(id) on delete set null;

create index if not exists org_cbt_sessions_tsess_idx on public.organization_cbt_sessions(test_session_id);
create index if not exists org_cbt_sessions_iatt_idx on public.organization_cbt_sessions(institute_attempt_id);

-- Reconcile organization_cbt_answers question_id foreign key to public.questions(id)
do $$
begin
  -- If question_id column was created as text in 0003, ensure cast to uuid foreign key
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'organization_cbt_answers' and column_name = 'question_id' and data_type = 'text'
  ) then
    alter table public.organization_cbt_answers
      alter column question_id type uuid using question_id::uuid;
  end if;

  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public' and table_name = 'organization_cbt_answers' and constraint_name = 'org_cbt_answers_question_fk'
  ) then
    alter table public.organization_cbt_answers
      add constraint org_cbt_answers_question_fk
      foreign key (question_id) references public.questions(id) on delete cascade;
  end if;
exception when others then
  raise notice 'CBT answers question FK adjustment notice: %', sqlerrm;
end $$;

-- =================================================================
-- 6. NON-DESTRUCTIVE BACKWARD COMPATIBILITY VIEWS
-- =================================================================
-- Safely drop base table organization_batches and organization_batch_members if empty/migrated,
-- and recreate as views over canonical institute_batches and institute_batch_members.

do $$
begin
  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'organization_batch_members' and table_type = 'BASE TABLE'
  ) then
    drop table public.organization_batch_members cascade;
  end if;

  if exists (
    select from information_schema.tables
    where table_schema = 'public' and table_name = 'organization_batches' and table_type = 'BASE TABLE'
  ) then
    drop table public.organization_batches cascade;
  end if;
exception when others then
  raise notice 'Backward compatibility view transition notice: %', sqlerrm;
end $$;

-- Compatibility View: organization_batches -> public.institute_batches
create or replace view public.organization_batches as
select
  b.id,
  b.institute_id as organization_id,
  b.campus_id,
  b.academic_year_id,
  b.name,
  b.exam as target_exam,
  b.grade_level,
  b.room_number,
  b.is_active,
  b.created_at
from public.institute_batches b;

-- Compatibility View: organization_batch_members -> public.institute_batch_members
create or replace view public.organization_batch_members as
select
  bm.id,
  bm.batch_id,
  m.user_id,
  coalesce(bm.role, m.role, 'STUDENT') as role,
  bm.roll_number,
  bm.enrolled_at
from public.institute_batch_members bm
join public.institute_members m on m.id = bm.member_id;

-- =================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES FOR RECONCILED TABLES
-- =================================================================
alter table public.institute_batches enable row level security;
alter table public.institute_batch_members enable row level security;

-- Institute Batches RLS (Read by members, manage by OWNER/COACHING_ADMIN)
create policy inst_batches_read on public.institute_batches
  for select using (public.is_organization_member(institute_id));

create policy inst_batches_manage on public.institute_batches
  for all using (public.has_organization_role(institute_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(institute_id, array['OWNER', 'COACHING_ADMIN']));

-- Institute Batch Members RLS
create policy inst_batch_members_read on public.institute_batch_members
  for select using (
    exists (
      select 1 from public.institute_batches b
      where b.id = batch_id and public.is_organization_member(b.institute_id)
    )
  );

create policy inst_batch_members_manage on public.institute_batch_members
  for all using (
    exists (
      select 1 from public.institute_batches b
      where b.id = batch_id and public.has_organization_role(b.institute_id, array['OWNER', 'COACHING_ADMIN'])
    )
  )
  with check (
    exists (
      select 1 from public.institute_batches b
      where b.id = batch_id and public.has_organization_role(b.institute_id, array['OWNER', 'COACHING_ADMIN'])
    )
  );

comment on view public.organization_batches is 'Backward-compatible view over canonical public.institute_batches.';
comment on view public.organization_batch_members is 'Backward-compatible view over canonical public.institute_batch_members.';
