-- Prepzii B2B tenant foundation. Apply to a dedicated Supabase project.
create extension if not exists pgcrypto;

create type public.organization_role as enum ('owner', 'admin', 'teacher', 'student', 'parent');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  external_auth_id text unique,
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended')),
  created_at timestamptz not null default now()
);

create table public.organization_memberships (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id text not null,
  role public.organization_role not null,
  display_name text not null,
  email text,
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.campuses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  is_active boolean not null default false,
  unique (organization_id, name)
);

create table public.batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campus_id uuid references public.campuses(id) on delete set null,
  academic_year_id uuid not null references public.academic_years(id) on delete restrict,
  name text not null,
  created_at timestamptz not null default now(),
  unique (organization_id, academic_year_id, name)
);

create table public.subjects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  code text,
  unique (organization_id, name)
);

create table public.batch_enrollments (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  batch_id uuid not null references public.batches(id) on delete cascade,
  student_user_id text not null,
  enrolled_at timestamptz not null default now(),
  primary key (batch_id, student_user_id)
);

create index memberships_user_org_idx on public.organization_memberships(user_id, organization_id);
create index campuses_org_idx on public.campuses(organization_id);
create index years_org_idx on public.academic_years(organization_id);
create index batches_org_idx on public.batches(organization_id);
create index subjects_org_idx on public.subjects(organization_id);
create index enrollments_org_idx on public.batch_enrollments(organization_id);

-- Clerk's `sub` claim is the external user ID. Configure the Supabase JWT integration
-- before relying on these policies in production.
create or replace function public.requesting_user_id()
returns text language sql stable as $$
  select nullif(auth.jwt() ->> 'sub', '');
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = public.requesting_user_id()
  );
$$;

create or replace function public.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.organization_memberships membership
    where membership.organization_id = target_organization_id
      and membership.user_id = public.requesting_user_id()
      and membership.role = any(allowed_roles)
  );
$$;

revoke all on function public.requesting_user_id() from public;
grant execute on function public.requesting_user_id() to authenticated;
revoke all on function public.is_organization_member(uuid) from public;
grant execute on function public.is_organization_member(uuid) to authenticated;
revoke all on function public.has_organization_role(uuid, public.organization_role[]) from public;
grant execute on function public.has_organization_role(uuid, public.organization_role[]) to authenticated;

alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.campuses enable row level security;
alter table public.academic_years enable row level security;
alter table public.batches enable row level security;
alter table public.subjects enable row level security;
alter table public.batch_enrollments enable row level security;

create policy organizations_read_member on public.organizations for select
  using (public.is_organization_member(id));
create policy memberships_read_member on public.organization_memberships for select
  using (public.is_organization_member(organization_id));
create policy memberships_manage_admin on public.organization_memberships for all
  using (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]));

create policy campuses_read_member on public.campuses for select using (public.is_organization_member(organization_id));
create policy campuses_manage_admin on public.campuses for all
  using (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy years_read_member on public.academic_years for select using (public.is_organization_member(organization_id));
create policy years_manage_admin on public.academic_years for all
  using (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]));
create policy batches_read_member on public.batches for select using (public.is_organization_member(organization_id));
create policy batches_manage_staff on public.batches for all
  using (public.has_organization_role(organization_id, array['owner','admin','teacher']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin','teacher']::public.organization_role[]));
create policy subjects_read_member on public.subjects for select using (public.is_organization_member(organization_id));
create policy subjects_manage_staff on public.subjects for all
  using (public.has_organization_role(organization_id, array['owner','admin','teacher']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin','teacher']::public.organization_role[]));
create policy enrollments_read_member on public.batch_enrollments for select using (public.is_organization_member(organization_id));
create policy enrollments_manage_admin on public.batch_enrollments for all
  using (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]))
  with check (public.has_organization_role(organization_id, array['owner','admin']::public.organization_role[]));

