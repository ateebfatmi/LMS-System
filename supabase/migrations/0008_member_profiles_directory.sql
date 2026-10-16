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
