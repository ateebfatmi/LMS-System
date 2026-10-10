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
create policy org_batches_read on public.organization_batches
  for select using (public.is_organization_member(organization_id));
create policy org_batches_manage on public.organization_batches
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Batch Members Policies
create policy org_batch_members_read on public.organization_batch_members
  for select using (
    exists (
      select 1 from public.organization_batches b
      where b.id = batch_id and public.is_organization_member(b.organization_id)
    )
  );
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
create policy org_modules_read on public.organization_course_modules
  for select using (public.is_course_org_member(course_id));
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

create policy org_lessons_read on public.organization_course_lessons
  for select using (
    exists (
      select 1 from public.organization_course_modules m
      where m.id = module_id and public.is_course_org_member(m.course_id)
    )
  );
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
create policy org_attendance_sessions_read on public.organization_attendance_sessions
  for select using (public.is_organization_member(organization_id));
create policy org_attendance_sessions_manage on public.organization_attendance_sessions
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']));

create policy org_attendance_records_read on public.organization_attendance_records
  for select using (
    exists (
      select 1 from public.organization_attendance_sessions s
      where s.id = session_id and public.is_organization_member(s.organization_id)
    )
  );
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
create policy org_test_schedules_read on public.organization_test_schedules
  for select using (public.is_organization_member(organization_id));
create policy org_test_schedules_manage on public.organization_test_schedules
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']));

-- Announcements Policies
create policy org_announcements_read on public.organization_announcements
  for select using (public.is_organization_member(organization_id));
create policy org_announcements_manage on public.organization_announcements
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
