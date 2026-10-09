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

create policy organization_campuses_read on public.organization_campuses
  for select using (public.is_organization_member(organization_id));
create policy organization_campuses_manage on public.organization_campuses
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

create policy organization_years_read on public.organization_academic_years
  for select using (public.is_organization_member(organization_id));
create policy organization_years_manage on public.organization_academic_years
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

create policy organization_subjects_read on public.organization_subjects
  for select using (public.is_organization_member(organization_id));
create policy organization_subjects_manage on public.organization_subjects
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER']));

create policy organization_courses_read on public.organization_courses
  for select using (public.is_organization_member(organization_id));
create policy organization_courses_insert on public.organization_courses
  for insert
  with check (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    and created_by = public.requesting_user_id()
  );
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
