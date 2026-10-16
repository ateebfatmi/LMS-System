-- Base PrepZii prerequisites and schema resolution for isolated database testing

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

-- 0. Standard Supabase roles
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_admin') then
    create role supabase_admin nologin;
  end if;
end
$$;

-- Grant standard Supabase schema privileges
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on routines to anon, authenticated, service_role;

-- 1. Supabase auth schema simulation
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create or replace function auth.jwt()
returns jsonb
language sql
stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb,
    '{}'::jsonb
  );
$$;

create or replace function auth.uid()
returns uuid
language sql
stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role()
returns text
language sql
stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
alter default privileges in schema auth grant execute on routines to anon, authenticated, service_role;

-- 2. Supabase storage schema simulation
create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  public boolean default false,
  avif_autodetection boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text not null,
  owner uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz default now(),
  metadata jsonb default '{}'::jsonb,
  path_tokens text[] generated always as (string_to_array(name, '/')) stored
);

-- 3. Canonical public.institutes (Coaching Institute Tenants)
create table if not exists public.institutes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  institute_type text default 'COACHING',
  logo_url text,
  primary_color text default '#FACC15',
  contact_email text,
  contact_phone text,
  owner_user_id text not null,
  status text not null default 'ACTIVE',
  created_at timestamptz not null default now()
);

-- Incompatible historical resolution: JoSAA Engineering Colleges table
create table if not exists public.josaa_institutes (
  id uuid primary key default gen_random_uuid(),
  institute_name text unique not null,
  institute_state text not null,
  institute_type text not null,
  created_at timestamptz default now() not null
);

-- 4. Consumer PrepZii tables from 20260812_institute_mvp.sql
create table if not exists public.institute_members (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  user_id text,
  email text not null,
  role text not null default 'STUDENT',
  status text not null default 'PENDING',
  created_at timestamptz not null default now(),
  unique (institute_id, email)
);

create table if not exists public.institute_batches (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  exam text not null,
  target_year integer,
  created_at timestamptz not null default now()
);

create table if not exists public.institute_batch_members (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  batch_id uuid not null references public.institute_batches(id) on delete cascade,
  member_id uuid not null references public.institute_members(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (batch_id, member_id)
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam text not null,
  subject text not null,
  chapter text,
  difficulty text default 'medium',
  question_text text not null,
  question_image text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_option text,
  explanation text,
  marks numeric default 4,
  negative_marks numeric default -1,
  created_at timestamptz default now()
);

create table if not exists public.test_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  exam text not null,
  subjects text[] default '{}',
  chapters text[] default '{}',
  difficulty text default 'medium',
  total_questions integer default 0,
  duration_minutes integer default 30,
  status text not null default 'in_progress',
  created_at timestamptz not null default now()
);

create table if not exists public.test_attempts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.test_sessions(id) on delete set null,
  user_id text not null,
  score numeric default 0,
  total_marks numeric default 0,
  correct_answers integer default 0,
  wrong_answers integer default 0,
  attempted integer default 0,
  total_questions integer default 0,
  duration_minutes integer default 0,
  time_taken_seconds integer default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.institute_tests (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  title text not null,
  exam text not null,
  subject text not null,
  chapters text[] not null default '{}',
  difficulty text not null default 'mixed',
  duration_minutes integer not null default 30,
  total_questions integer not null default 0,
  status text not null default 'DRAFT',
  created_by text not null,
  created_at timestamptz not null default now(),
  published_at timestamptz
);

create table if not exists public.institute_test_questions (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  institute_test_id uuid not null references public.institute_tests(id) on delete cascade,
  question_id uuid not null references public.questions(id),
  question_order integer not null,
  created_at timestamptz not null default now(),
  unique (institute_test_id, question_id)
);

create table if not exists public.institute_test_assignments (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  institute_test_id uuid not null references public.institute_tests(id) on delete cascade,
  batch_id uuid not null references public.institute_batches(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (institute_test_id, batch_id)
);

create table if not exists public.institute_test_attempts (
  id uuid primary key default gen_random_uuid(),
  institute_id uuid not null references public.institutes(id) on delete cascade,
  institute_test_id uuid not null references public.institute_tests(id) on delete cascade,
  user_id text not null,
  session_id uuid references public.test_sessions(id) on delete set null,
  attempt_id uuid references public.test_attempts(id) on delete set null,
  status text not null default 'IN_PROGRESS',
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (institute_test_id, session_id)
);
