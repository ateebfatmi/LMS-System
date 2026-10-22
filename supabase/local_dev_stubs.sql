-- ==============================================================================
-- FOR LOCAL STANDALONE TESTING ONLY.
-- DO NOT RUN IN SHARED, STAGING, OR PRODUCTION ENVIRONMENTS.
-- This file creates minimal table stubs to accurately simulate the consumer Prepzii
-- backend when testing B2B migrations in an isolated local PostgreSQL database.
-- Aligned with verified Prepzii consumer schema and foreign keys.
-- ==============================================================================

create extension if not exists pgcrypto;

-- 1. Canonical Institute & Identity Tables
create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  logo_url text,
  owner_user_id text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

create table if not exists public.institute_members (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  user_id text not null,
  email text,
  role text not null default 'STUDENT',
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  unique (institute_id, user_id)
);

-- 2. Canonical Batch Tables
create table if not exists public.institute_batches (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  exam text,
  target_year integer,
  created_at timestamptz not null default now()
);

create table if not exists public.institute_batch_members (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.institute_batches(id) on delete cascade,
  member_id uuid not null references public.institute_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (batch_id, member_id)
);

-- 3. Canonical Question Bank (public.questions)
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam text not null,
  subject text not null,
  chapter text not null,
  topic text,
  difficulty text not null,
  question_type text,
  question_text text not null,
  question_image text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  option_a_image text,
  option_b_image text,
  option_c_image text,
  option_d_image text,
  correct_option text not null,
  explanation text,
  explanation_image text,
  marks integer default 4,
  negative_marks numeric default 1,
  is_active boolean default true,
  question_order integer,
  source_type text not null default 'CURATED',
  status text not null default 'ACTIVE',
  question_content jsonb,
  explanation_content jsonb,
  created_at timestamptz not null default now()
);

-- 4. Canonical PYQ Bank (public.pyq_questions)
create table if not exists public.pyq_questions (
  id uuid primary key default gen_random_uuid(),
  question text,
  question_text text,
  question_image text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  option_a_image text,
  option_b_image text,
  option_c_image text,
  option_d_image text,
  correct_option text,
  correct_options jsonb,
  numerical_answer numeric,
  numerical_min numeric,
  numerical_max numeric,
  marks_positive numeric default 4,
  marks_negative numeric default 1,
  question_content jsonb,
  explanation_content jsonb,
  exam text not null,
  exam_type text,
  subject text not null,
  chapter text not null,
  topic text,
  year integer,
  difficulty text default 'MEDIUM',
  status text default 'ACTIVE',
  exam_id uuid,
  paper_code text,
  question_number integer,
  display_order integer,
  created_at timestamptz not null default now()
);

-- 5. Canonical Assessment Tables
create table if not exists public.institute_tests (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  title text not null,
  status text not null default 'PUBLISHED',
  created_at timestamptz not null default now()
);

create table if not exists public.institute_test_questions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  institute_test_id uuid not null references public.institute_tests(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  question_order integer,
  created_at timestamptz not null default now(),
  unique (institute_test_id, question_id)
);

-- 6. Consumer Test Sessions & Attempts
create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  test_id uuid not null,
  status text not null default 'IN_PROGRESS',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  score numeric(8, 2),
  created_at timestamptz not null default now()
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  test_id uuid not null,
  session_id uuid references public.test_sessions(id) on delete cascade,
  score numeric(8, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.institute_test_attempts (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  institute_test_id uuid not null references public.institute_tests(id) on delete cascade,
  user_id text not null,
  session_id uuid references public.test_sessions(id) on delete set null,
  attempt_id uuid references public.test_attempts(id) on delete set null,
  status text not null default 'SUBMITTED',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  created_at timestamptz not null default now()
);
