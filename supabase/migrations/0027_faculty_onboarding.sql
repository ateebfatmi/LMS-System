begin;

-- Pending teachers have no Clerk identity. The existing batch membership row
-- can reference their tenant-scoped institute membership until activation.
alter table public.organization_batch_members
  alter column user_id drop not null,
  add column pending_teacher_id uuid,
  add constraint organization_batch_members_pending_teacher_fk
    foreign key (pending_teacher_id, organization_id)
    references public.institute_members(id, institute_id) on delete cascade,
  add constraint organization_batch_members_assignment_identity check (
    (user_id is not null and pending_teacher_id is null)
    or (user_id is null and pending_teacher_id is not null and role = 'TEACHER')
  );

create unique index organization_batch_members_pending_teacher_batch
  on public.organization_batch_members (pending_teacher_id, batch_id)
  where pending_teacher_id is not null;

-- Pending assignments are created by the membership-verified server RPC only.
create policy faculty_pending_assignment_insert_boundary on public.organization_batch_members
  as restrictive for insert to anon, authenticated with check (pending_teacher_id is null);
create policy faculty_pending_assignment_update_boundary on public.organization_batch_members
  as restrictive for update to anon, authenticated using (pending_teacher_id is null) with check (pending_teacher_id is null);
create policy faculty_pending_assignment_delete_boundary on public.organization_batch_members
  as restrictive for delete to anon, authenticated using (pending_teacher_id is null);

create function public.lms_list_faculty(
  p_organization_id uuid, p_search text, p_batch_id uuid, p_limit integer, p_offset integer, p_member_id uuid
) returns jsonb language sql stable security definer set search_path = public as $$
  with filtered as (
    select m.id, m.user_id, coalesce(m.email, '') as email, m.status,
      coalesce(p.display_name, m.email, 'Teacher') as name, p.phone, p.subject_specialization, p.qualification, p.joined_on
    from public.institute_members m
    left join public.organization_member_profiles p on p.membership_id = m.id and p.organization_id = m.institute_id
    where m.institute_id = p_organization_id and m.role = 'TEACHER'
      and (p_member_id is null or m.id = p_member_id)
      and (p_search = '' or strpos(lower(concat_ws(' ', p.display_name, m.email, p.subject_specialization)), lower(p_search)) > 0)
      and (p_batch_id is null or exists (
        select 1 from public.organization_batch_members bm
        where bm.organization_id = p_organization_id and bm.role = 'TEACHER' and bm.batch_id = p_batch_id
          and (bm.pending_teacher_id = m.id or bm.user_id = m.user_id)
      ))
  ), page as (
    select * from filtered order by lower(name), id
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtered),
    'batches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name, b.id)
      from public.organization_batches b where b.organization_id = p_organization_id and p_member_id is null), '[]'::jsonb),
    'teachers', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.id, 'displayName', m.name, 'email', m.email, 'phone', m.phone,
      'emailEditable', m.status = 'PENDING' and m.user_id is null and not exists (
        select 1 from public.organization_invitations i where i.organization_id = p_organization_id
          and lower(i.email) = lower(m.email) and i.status = 'PENDING' and i.expires_at > now()
      ),
      'subjectSpecialization', m.subject_specialization, 'qualification', m.qualification, 'joinedOn', m.joined_on,
      'status', case
        when m.status in ('INACTIVE', 'SUSPENDED') then m.status
        when m.status = 'ACTIVE' and m.user_id is not null and m.user_id !~ '^usr_[0-9a-f]{32}$' then 'ACTIVE'
        when exists (select 1 from public.organization_invitations i where i.organization_id = p_organization_id
          and lower(i.email) = lower(m.email) and i.role = 'TEACHER' and i.status = 'PENDING' and i.expires_at > now()) then 'INVITED'
        else 'PENDING' end,
      'batches', coalesce((select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name) order by b.name, b.id)
        from public.organization_batch_members bm join public.organization_batches b
          on b.id = bm.batch_id and b.organization_id = bm.organization_id
        where bm.organization_id = p_organization_id and bm.role = 'TEACHER'
          and (bm.pending_teacher_id = m.id or bm.user_id = m.user_id)), '[]'::jsonb),
      'schedule', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'subject', s.subject, 'day', s.day_of_week,
          'time', s.time_slot, 'batchName', b.name) order by s.day_of_week, s.starts_at)
        from public.organization_room_schedules s left join public.organization_batches b
          on b.id = s.batch_id and b.organization_id = s.organization_id
        where p_member_id is not null and s.organization_id = p_organization_id and s.faculty_id = m.user_id), '[]'::jsonb)
    ) order by lower(m.name), m.id) from page m), '[]'::jsonb)
  );
$$;

create function public.lms_save_faculty(
  p_organization_id uuid, p_actor_user_id text, p_actor_role text, p_member_id uuid,
  p_profile jsonb, p_batch_ids uuid[]
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  teacher public.institute_members%rowtype;
  normalized_email text := lower(trim(p_profile ->> 'email'));
  display_name text := trim(p_profile ->> 'displayName');
begin
  if p_actor_role is null or p_actor_role not in ('OWNER', 'COACHING_ADMIN') then
    raise exception 'Faculty management requires member management access' using errcode = '42501';
  end if;
  if normalized_email is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || normalized_email, 0));
  end if;

  if p_member_id is not null then
    select * into teacher from public.institute_members
      where id = p_member_id and institute_id = p_organization_id and role = 'TEACHER' for update;
    if not found then raise exception 'Teacher not found' using errcode = 'P0002'; end if;
    if p_batch_ids is not null and teacher.status not in ('PENDING', 'ACTIVE') then
      raise exception 'This teacher cannot be assigned to batches' using errcode = '42501';
    end if;
  end if;

  if p_profile is not null then
    if display_name is null or char_length(display_name) not between 2 and 160 or nullif(normalized_email, '') is null then
      raise exception 'Invalid teacher profile' using errcode = '22023';
    end if;
    if exists (select 1 from public.institute_members m where m.institute_id = p_organization_id
      and lower(m.email) = normalized_email and m.id is distinct from p_member_id) then
      raise exception 'This email already belongs to an institute member' using errcode = '23505';
    end if;
    if p_member_id is null then
      insert into public.institute_members (institute_id, email, role, status)
        values (p_organization_id, normalized_email, 'TEACHER', 'PENDING') returning * into teacher;
    elsif lower(teacher.email) <> normalized_email then
      if teacher.status <> 'PENDING' or teacher.user_id is not null or exists (
        select 1 from public.organization_invitations i where i.organization_id = p_organization_id
          and lower(i.email) = lower(teacher.email) and i.status = 'PENDING' and i.expires_at > now()
      ) then raise exception 'Email is locked after invitation or activation' using errcode = '42501'; end if;
      update public.institute_members set email = normalized_email where id = teacher.id;
    end if;

    insert into public.organization_member_profiles (organization_id, membership_id, display_name, phone, subject_specialization, joined_on)
      values (p_organization_id, teacher.id, display_name, p_profile ->> 'phone', p_profile ->> 'subjectSpecialization', current_date)
      on conflict (membership_id) do update set display_name = excluded.display_name, phone = excluded.phone,
        subject_specialization = excluded.subject_specialization, updated_at = now();
  end if;

  if p_batch_ids is not null then
    if exists (select 1 from unnest(p_batch_ids) as requested(batch_id) where not exists (
      select 1 from public.organization_batches b where b.id = requested.batch_id and b.organization_id = p_organization_id
    )) then raise exception 'A selected batch does not belong to this institute' using errcode = '23503'; end if;

    delete from public.organization_batch_members bm
      where bm.organization_id = p_organization_id and bm.role = 'TEACHER'
        and (bm.pending_teacher_id = teacher.id or bm.user_id = teacher.user_id)
        and not (bm.batch_id = any(p_batch_ids));

    if teacher.user_id is null then
      insert into public.organization_batch_members (organization_id, batch_id, pending_teacher_id, role)
        select p_organization_id, batch_id, teacher.id, 'TEACHER'
        from (select distinct unnest(p_batch_ids) as batch_id) requested
        on conflict do nothing;
    else
      insert into public.organization_batch_members (organization_id, batch_id, user_id, role)
        select p_organization_id, batch_id, teacher.user_id, 'TEACHER'
        from (select distinct unnest(p_batch_ids) as batch_id) requested
        on conflict (batch_id, user_id) do update set role = excluded.role;
    end if;
  end if;

  insert into public.organization_audit_logs
    (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role,
    case when p_member_id is null then 'faculty.added' when p_profile is null then 'faculty.batches_updated' else 'faculty.profile_updated' end,
    'institute_member', teacher.id::text, jsonb_build_object('batchIds', p_batch_ids));

  return teacher.id;
end;
$$;

-- Reuse the existing invitation lock, expiry, idempotency, and token registry.
-- The teacher and expected email are checked while the membership is locked.
create function public.lms_invite_faculty(
  p_organization_id uuid, p_actor_user_id text, p_actor_role text, p_member_id uuid,
  p_email text, p_token_hash text, p_idempotency_key text, p_expires_at timestamptz
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  teacher public.institute_members%rowtype;
  invitation jsonb;
begin
  if p_actor_role is null or p_actor_role not in ('OWNER', 'COACHING_ADMIN') then
    raise exception 'Faculty invitation requires member management access' using errcode = '42501';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_email, 0));
  select * into teacher from public.institute_members where id = p_member_id
    and institute_id = p_organization_id and role = 'TEACHER' and lower(email) = p_email for update;
  if not found then raise exception 'Teacher not found or email changed' using errcode = 'P0002'; end if;
  if not ((teacher.status = 'PENDING' and teacher.user_id is null)
    or (teacher.status in ('PENDING', 'ACTIVE') and coalesce(teacher.user_id ~ '^usr_[0-9a-f]{32}$', false))) then
    raise exception 'Teacher account cannot be invited' using errcode = '42501';
  end if;

  select to_jsonb(i) into invitation from public.lms_create_invitation(
    p_organization_id, p_actor_user_id, p_actor_role, p_email, 'TEACHER', p_token_hash, p_idempotency_key, p_expires_at
  ) i;
  return invitation;
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
  legacy_teacher boolean := false;
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

  -- Older faculty forms generated usr_ plus 32 hex digits instead of a Clerk ID.
  -- Only a verified teacher invitation for that exact email can claim it.
  legacy_teacher := member.role = 'TEACHER' and invitation.role = 'TEACHER'
    and coalesce(member.user_id ~ '^usr_[0-9a-f]{32}$', false);

  if member.id is not null and member.user_id is not null and member.user_id <> p_user_id and not legacy_teacher then
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
      or (member.status = 'ACTIVE' and member.user_id is distinct from p_user_id and not legacy_teacher) then
      raise exception 'Invitation cannot change an existing membership' using errcode = '42501';
    end if;
    if member.status = 'PENDING' or legacy_teacher then
      update public.institute_members set user_id = p_user_id, status = 'ACTIVE' where id = member.id;

      insert into public.organization_batch_members (organization_id, batch_id, user_id, role, roll_number, enrolled_at)
      select bm.organization_id, bm.batch_id, p_user_id, 'TEACHER', bm.roll_number, bm.enrolled_at
      from public.organization_batch_members bm
      where invitation.role = 'TEACHER' and bm.organization_id = invitation.organization_id and bm.role = 'TEACHER'
        and (bm.pending_teacher_id = member.id or (legacy_teacher and bm.user_id = member.user_id))
      on conflict (batch_id, user_id) do update set role = excluded.role;
      delete from public.organization_batch_members bm
      where invitation.role = 'TEACHER' and bm.organization_id = invitation.organization_id and bm.role = 'TEACHER'
        and (bm.pending_teacher_id = member.id or (legacy_teacher and bm.user_id = member.user_id));

      if legacy_teacher then
        update public.organization_room_schedules schedule set faculty_id = p_user_id
        where schedule.organization_id = invitation.organization_id and schedule.faculty_id = member.user_id;
      end if;
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

revoke all on function public.lms_list_faculty(uuid,text,uuid,integer,integer,uuid) from public, anon, authenticated;
revoke all on function public.lms_save_faculty(uuid,text,text,uuid,jsonb,uuid[]) from public, anon, authenticated;
revoke all on function public.lms_invite_faculty(uuid,text,text,uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.lms_list_faculty(uuid,text,uuid,integer,integer,uuid) to service_role;
grant execute on function public.lms_save_faculty(uuid,text,text,uuid,jsonb,uuid[]) to service_role;
grant execute on function public.lms_invite_faculty(uuid,text,text,uuid,text,text,text,timestamptz) to service_role;

commit;
