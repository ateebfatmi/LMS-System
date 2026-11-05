-- Replace existing RPCs in place. No rows or tables are recreated.
begin;

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
  existing_member public.institute_members%rowtype;
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

  if found and organization.owner_user_id is distinct from owner_user_id then
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

  if organization.status <> 'ACTIVE' then
    raise exception 'Institute is unavailable' using errcode = '42501';
  end if;
  select * into existing_member from public.institute_members membership
  where membership.institute_id = organization.id
    and membership.user_id = lms_create_institute.owner_user_id
  order by (membership.role = 'OWNER') desc, membership.id
  limit 1 for update;

  if not found then
    insert into public.institute_members (institute_id, user_id, email, role, status)
    values (organization.id, owner_user_id, lower(owner_email), 'OWNER', 'ACTIVE');
  elsif existing_member.status <> 'ACTIVE'
    or (existing_member.role = 'OWNER' and 1 <> (
      select count(*) from public.institute_members membership
      where membership.institute_id = organization.id
        and membership.user_id = lms_create_institute.owner_user_id and membership.role = 'OWNER'
    ))
    or (existing_member.role <> 'OWNER' and (
      existing_member.role <> 'COACHING_ADMIN' or 1 <> (
        select count(*) from public.institute_members membership
        where membership.institute_id = organization.id
          and membership.user_id = lms_create_institute.owner_user_id
      )
    )) then
    raise exception 'Owner membership is unavailable' using errcode = '42501';
  end if;

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

  if invitation.status = 'ACCEPTED' and invitation.accepted_by is distinct from p_user_id then
    raise exception 'Invitation is invalid' using errcode = 'P0002';
  end if;
  if invitation.status in ('REVOKED', 'EXPIRED') then
    return query select invitation.status, invitation.organization_id, institute_slug, invitation.role;
    return;
  end if;
  if invitation.status = 'ACCEPTED' then
    if not exists (
      select 1 from public.institute_members active_member
      where active_member.institute_id = invitation.organization_id
        and active_member.user_id = p_user_id and active_member.role = invitation.role
        and active_member.status = 'ACTIVE'
    ) then
      raise exception 'Membership no longer matches the invitation' using errcode = '42501';
    end if;
    return query select invitation.status, invitation.organization_id, institute_slug, invitation.role;
    return;
  end if;
  if invitation.expires_at <= now() then
    update public.organization_invitations set status = 'EXPIRED', updated_at = now() where id = invitation.id;
    return query select 'EXPIRED'::text, invitation.organization_id, institute_slug, invitation.role;
    return;
  end if;

  -- Serialize activation across invitations to different addresses of the same account.
  perform pg_advisory_xact_lock(hashtextextended(invitation.organization_id::text || ':' || p_user_id, 1));

  if exists (
    select 1 from public.institutes owner_institute
    where owner_institute.id = invitation.organization_id and owner_institute.owner_user_id = p_user_id
  ) then
    raise exception 'An owner cannot accept a different role' using errcode = '42501';
  end if;

  select * into member
  from public.institute_members existing
  where existing.institute_id = invitation.organization_id
    and lower(existing.email) = normalized_email
  for update;

  if member.id is not null and member.user_id is not null and member.user_id <> p_user_id then
    raise exception 'Membership belongs to another identity' using errcode = '23505';
  end if;

  if exists (
    select 1 from public.institute_members existing
    where existing.institute_id = invitation.organization_id and existing.user_id = p_user_id
      and existing.id is distinct from member.id
  ) then
    raise exception 'The account already has a membership' using errcode = '23505';
  end if;

  if member.id is not null then
    if member.role <> invitation.role or member.status not in ('PENDING', 'ACTIVE')
      or (member.status = 'ACTIVE' and member.user_id is distinct from p_user_id) then
      raise exception 'Invitation cannot change an existing membership' using errcode = '42501';
    end if;
    if member.status = 'PENDING' then
      update public.institute_members set user_id = p_user_id, status = 'ACTIVE' where id = member.id;
    end if;
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

  if member.role in ('OWNER', 'PLATFORM_SUPER_ADMIN') or exists (
    select 1 from public.institutes institute
    where institute.id = p_organization_id and institute.owner_user_id = member.user_id
  )
    or (p_actor_role <> 'OWNER' and (member.role = 'COACHING_ADMIN' or p_role = 'COACHING_ADMIN'))
    or (member.user_id is null and p_status = 'ACTIVE') then
    raise exception 'Membership transition is forbidden' using errcode = '42501';
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

revoke execute on function public.lms_create_institute(text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke execute on function public.lms_accept_invitation(text,text,text) from public, anon, authenticated;
revoke execute on function public.lms_update_member_profile(uuid,uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,date) from public, anon, authenticated;

commit;
