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
