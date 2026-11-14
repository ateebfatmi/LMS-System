begin;

-- Reuse the existing invitations and batch assignments. The owner placeholder
-- fits the shared NOT NULL column and cannot be a Clerk identity.
alter table public.organization_invitations
  drop constraint organization_invitations_role_check,
  add constraint organization_invitations_role_check check (role in (
    'OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT'
  )),
  add column student_member_id uuid,
  add column guardian_relationship text check (guardian_relationship in ('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'OTHER')),
  add column clerk_invitation_id text,
  add constraint organization_invitation_student_fk foreign key (student_member_id, organization_id)
    references public.institute_members(id, institute_id);

create unique index organization_one_pending_owner_invitation
  on public.organization_invitations(organization_id) where role = 'OWNER' and status = 'PENDING';

alter table public.organization_batch_members
  add column pending_student_id uuid,
  drop constraint organization_batch_members_assignment_identity,
  add constraint organization_batch_members_pending_student_fk foreign key (pending_student_id, organization_id)
    references public.institute_members(id, institute_id) on delete cascade,
  add constraint organization_batch_members_assignment_identity check (
    (user_id is not null and pending_teacher_id is null and pending_student_id is null)
    or (user_id is null and pending_student_id is null and pending_teacher_id is not null and role = 'TEACHER')
    or (user_id is null and pending_teacher_id is null and pending_student_id is not null and role = 'STUDENT')
  );

create unique index organization_batch_members_pending_student_batch
  on public.organization_batch_members(pending_student_id, batch_id) where pending_student_id is not null;

create policy pending_student_assignment_insert on public.organization_batch_members
  as restrictive for insert to anon, authenticated with check (pending_student_id is null);
create policy pending_student_assignment_update on public.organization_batch_members
  as restrictive for update to anon, authenticated using (pending_student_id is null) with check (pending_student_id is null);
create policy pending_student_assignment_delete on public.organization_batch_members
  as restrictive for delete to anon, authenticated using (pending_student_id is null);

create function public.lms_create_invited_institute(p_actor text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  org_id uuid := gen_random_uuid();
  sub_status text := p_payload ->> 'subscriptionStatus';
begin
  insert into public.institutes (id,name,slug,owner_user_id,institute_type,contact_email,contact_phone,status)
  values (org_id,p_payload->>'name',p_payload->>'slug','pending_owner:' || org_id,
    p_payload->>'instituteType',p_payload->>'contactEmail',p_payload->>'contactPhone','ACTIVE');

  insert into public.organization_subscriptions (organization_id,plan_id,status,current_period_start,current_period_end,trial_ends_at)
  values (org_id,p_payload->>'planId',sub_status,now(),now()+interval '30 days',
    case when sub_status = 'TRIAL' then now()+interval '30 days' end);

  insert into public.platform_audit_logs(actor_user_id,actor_role,target_organization_id,action,details)
  values (p_actor,'PLATFORM_SUPER_ADMIN',org_id,'create_organization',
    jsonb_build_object('name',p_payload->>'name','slug',p_payload->>'slug','planId',p_payload->>'planId'));
  return org_id;
end;
$$;

create function public.lms_manage_initial_owner_invitation(
  p_org uuid, p_actor text, p_email text, p_hash text, p_key text, p_replace uuid default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  org public.institutes%rowtype;
  previous public.organization_invitations%rowtype;
  invitation public.organization_invitations%rowtype;
begin
  select * into org from public.institutes where id = p_org for update;
  if org.id is null or org.owner_user_id is distinct from 'pending_owner:' || org.id
    or (p_hash is not null and org.status <> 'ACTIVE') then
    raise exception 'Owner invitation unavailable' using errcode = '42501';
  end if;

  if p_replace is not null then
    select * into previous from public.organization_invitations
    where id = p_replace and organization_id = p_org and role = 'OWNER' and status in ('PENDING','EXPIRED') for update;
    if previous.id is null or (p_hash is not null and lower(previous.email) <> lower(p_email)) then
      raise exception 'Owner invitation unavailable' using errcode = 'P0002';
    end if;
    perform public.lms_revoke_invitation(p_org,p_replace,p_actor,'PLATFORM_SUPER_ADMIN');
  end if;

  if p_hash is not null then
    update public.organization_invitations set status = 'EXPIRED', updated_at = now()
    where organization_id = p_org and role = 'OWNER' and status = 'PENDING' and expires_at <= now();
    insert into public.organization_invitations(organization_id,email,role,invited_by,token_hash,idempotency_key,expires_at)
    values (p_org,lower(trim(p_email)),'OWNER',p_actor,p_hash,p_key,now()+interval '7 days')
    returning * into invitation;
  end if;

  insert into public.platform_audit_logs(actor_user_id,actor_role,target_organization_id,action,details)
  values (p_actor,'PLATFORM_SUPER_ADMIN',p_org,
    case when p_hash is null then 'owner_invitation_revoked'
      when p_replace is null then 'owner_invitation_created' else 'owner_invitation_resent' end,
    jsonb_build_object('invitationId',coalesce(invitation.id,p_replace),'previousInvitationId',p_replace));

  return jsonb_build_object('id',invitation.id,'expires_at',invitation.expires_at,
    'previous_clerk_invitation_id',previous.clerk_invitation_id);
end;
$$;

create function public.lms_enroll_student_for_invitation(
  p_org uuid, p_actor text, p_role text, p_email text, p_profile jsonb, p_batch uuid
)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  student public.institute_members%rowtype;
  email_address text := lower(trim(p_email));
begin
  perform 1 from public.institutes where id = p_org and status = 'ACTIVE' for share;
  if not found or p_role not in ('OWNER','COACHING_ADMIN','TEACHER')
    or (p_role = 'OWNER' and not exists (
      select 1 from public.institutes where id = p_org and owner_user_id = p_actor
    ))
    or (p_role <> 'OWNER' and not exists (
      select 1 from public.institute_members where institute_id = p_org and user_id = p_actor
        and role = p_role and status = 'ACTIVE'
    )) then
    raise exception 'Enrollment forbidden' using errcode = '42501';
  end if;

  if p_role = 'TEACHER' and (p_batch is null or not exists (
    select 1 from public.organization_batch_members where organization_id = p_org and batch_id = p_batch
      and user_id = p_actor and role = 'TEACHER' for share
  )) then
    raise exception 'Enrollment requires an assigned batch' using errcode = '42501';
  end if;
  if p_batch is not null and not exists (select 1 from public.organization_batches
    where id = p_batch and organization_id = p_org and is_active for share) then
    raise exception 'Batch unavailable' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_org::text || ':' || email_address,0));
  select * into student from public.institute_members
  where institute_id = p_org and lower(email) = email_address for update;
  if student.id is null then
    insert into public.institute_members(institute_id,email,role,status)
    values (p_org,email_address,'STUDENT','PENDING') returning * into student;
    insert into public.organization_member_profiles (
      organization_id,membership_id,display_name,phone,alternate_phone,roll_number,guardian_name,guardian_phone,joined_on
    ) values (
      p_org,student.id,p_profile->>'displayName',p_profile->>'phone',p_profile->>'alternatePhone',
      p_profile->>'rollNumber',p_profile->>'guardianName',p_profile->>'guardianPhone',
      coalesce((p_profile->>'joinedOn')::date,current_date)
    );
  elsif student.role <> 'STUDENT' or student.status not in ('PENDING','ACTIVE')
    or (p_role = 'TEACHER' and not exists (
      select 1 from public.organization_batch_members existing
      where existing.organization_id = p_org and existing.batch_id = p_batch and existing.role = 'STUDENT'
        and (existing.pending_student_id = student.id or existing.user_id = student.user_id)
    )) then
    raise exception 'Student unavailable' using errcode = '42501';
  end if;

  if p_batch is not null then
    insert into public.organization_batch_members (organization_id,batch_id,pending_student_id,user_id,role,roll_number)
    values (p_org,p_batch,case when student.user_id is null then student.id end,student.user_id,
      'STUDENT',p_profile->>'rollNumber') on conflict do nothing;
  end if;
  insert into public.organization_audit_logs(organization_id,actor_user_id,actor_role,action,entity_type,entity_id,after_state)
  values (p_org,p_actor,p_role,'member.enrolled','institute_member',student.id,
    jsonb_build_object('role','STUDENT','status','PENDING','batchId',p_batch));
  return student.id;
end;
$$;

create function public.lms_create_student_or_guardian_invitation(
  p_org uuid, p_actor text, p_actor_role text, p_student uuid, p_email text, p_role text,
  p_relationship text, p_hash text, p_key text, p_expires timestamptz, p_batch uuid
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  student public.institute_members%rowtype;
  scoped_invitation public.organization_invitations%rowtype;
begin
  perform 1 from public.institutes where id = p_org and status = 'ACTIVE' for share;
  if not found or p_actor_role not in ('OWNER','COACHING_ADMIN','TEACHER') or p_role not in ('STUDENT','PARENT')
    or (p_actor_role = 'OWNER' and not exists (
      select 1 from public.institutes where id = p_org and owner_user_id = p_actor
    ))
    or (p_actor_role <> 'OWNER' and not exists (
      select 1 from public.institute_members where institute_id = p_org and user_id = p_actor
        and role = p_actor_role and status = 'ACTIVE'
    )) then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;

  -- Serialize email-based issuance before locking the record used for scope.
  perform pg_advisory_xact_lock(hashtextextended(p_org::text || ':' || lower(trim(p_email)),0));
  select * into student from public.institute_members where id = p_student and institute_id = p_org
    and role = 'STUDENT' and status in ('PENDING','ACTIVE') for share;
  if student.id is null
    or (p_role = 'STUDENT' and (lower(student.email) <> lower(trim(p_email))
      or not (student.user_id is null or student.user_id ~ '^usr_[0-9a-f]{32}$')))
    or (p_role = 'PARENT' and (student.status <> 'ACTIVE' or student.user_id is null
      or student.user_id !~ '^user_' or lower(student.email) = lower(trim(p_email)) or p_relationship is null))
    or (p_actor_role = 'TEACHER' and not exists (
      select 1 from public.organization_batch_members child
      join public.organization_batch_members teacher using (organization_id,batch_id)
      join public.organization_batches batch on batch.id = child.batch_id and batch.organization_id = child.organization_id
      where child.organization_id = p_org and child.batch_id = p_batch and batch.is_active and child.role = 'STUDENT'
        and (child.pending_student_id = student.id or child.user_id = student.user_id)
        and teacher.role = 'TEACHER' and teacher.user_id = p_actor for share of child, teacher, batch
    )) then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;

  select * into scoped_invitation from public.organization_invitations
    where organization_id = p_org and idempotency_key = p_key for update;
  if scoped_invitation.id is not null and (
    scoped_invitation.student_member_id is distinct from p_student
    or scoped_invitation.guardian_relationship is distinct from p_relationship
  ) then
    raise exception 'Invitation unavailable' using errcode = '23505';
  end if;

  perform public.lms_create_invitation(p_org,p_actor,p_actor_role,p_email,p_role,p_hash,p_key,p_expires);
  update public.organization_invitations
  set student_member_id = p_student, guardian_relationship = p_relationship
  where organization_id = p_org and idempotency_key = p_key
  returning * into scoped_invitation;
  return jsonb_build_object('id',scoped_invitation.id,'status',scoped_invitation.status,
    'expires_at',scoped_invitation.expires_at,'clerk_invitation_id',scoped_invitation.clerk_invitation_id);
end;
$$;

revoke all on function public.lms_create_invited_institute(text,jsonb) from public, anon, authenticated;
revoke all on function public.lms_manage_initial_owner_invitation(uuid,text,text,text,text,uuid) from public, anon, authenticated;
revoke all on function public.lms_enroll_student_for_invitation(uuid,text,text,text,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.lms_create_student_or_guardian_invitation(uuid,text,text,uuid,text,text,text,text,text,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.lms_create_invited_institute(text,jsonb) to service_role;
grant execute on function public.lms_manage_initial_owner_invitation(uuid,text,text,text,text,uuid) to service_role;
grant execute on function public.lms_enroll_student_for_invitation(uuid,text,text,text,jsonb,uuid) to service_role;
grant execute on function public.lms_create_student_or_guardian_invitation(uuid,text,text,uuid,text,text,text,text,text,timestamptz,uuid) to service_role;

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
  org public.institutes%rowtype;
  student public.institute_members%rowtype;
  legacy_teacher boolean := false;
  legacy_student boolean := false;
  normalized_email text := lower(trim(p_verified_email));
begin
  -- Organization first: serialize acceptance with suspension and owner rotation.
  select * into invitation from public.organization_invitations where token_hash = p_token_hash;
  if not found or lower(invitation.email) is distinct from normalized_email then
    raise exception 'Invitation unavailable' using errcode = 'P0002';
  end if;
  select institute.* into org from public.institutes institute
    where institute.id = invitation.organization_id and institute.status = 'ACTIVE' for update;
  if org.id is null then raise exception 'Invitation unavailable' using errcode = 'P0002'; end if;
  institute_slug := org.slug;
  select * into invitation from public.organization_invitations where token_hash = p_token_hash for update;
  if not found or invitation.status = 'ACCEPTED' then
    raise exception 'Invitation unavailable' using errcode = 'P0002';
  end if;
  if invitation.status <> 'PENDING' then
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

  if invitation.role = 'OWNER' and org.owner_user_id is distinct from 'pending_owner:' || org.id then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;

  if invitation.role = 'PARENT' and invitation.student_member_id is null then
    raise exception 'Invitation unavailable' using errcode = '42501';
  end if;

  if invitation.student_member_id is not null then
    select * into student from public.institute_members where id = invitation.student_member_id
      and institute_id = invitation.organization_id and role = 'STUDENT' and status in ('ACTIVE','PENDING') for share;
    if student.id is null or (invitation.role = 'STUDENT' and member.id is distinct from student.id)
      or (invitation.role = 'PARENT' and (student.status <> 'ACTIVE' or student.user_id is null
        or student.user_id = p_user_id or invitation.guardian_relationship is null)) then
      raise exception 'Invitation unavailable' using errcode = '42501';
    end if;
  end if;

  -- Older faculty forms generated usr_ plus 32 hex digits instead of a Clerk ID.
  -- Only a verified teacher invitation for that exact email can claim it.
  legacy_teacher := member.role = 'TEACHER' and invitation.role = 'TEACHER'
    and coalesce(member.user_id ~ '^usr_[0-9a-f]{32}$', false);

  legacy_student := member.role = 'STUDENT' and invitation.role = 'STUDENT'
    and invitation.student_member_id = member.id and coalesce(member.user_id ~ '^usr_[0-9a-f]{32}$', false);

  if member.id is not null and member.user_id is not null and member.user_id <> p_user_id and not (legacy_teacher or legacy_student) then
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
      or (member.status = 'ACTIVE' and member.user_id is distinct from p_user_id and not (legacy_teacher or legacy_student)) then
      raise exception 'Invitation cannot change an existing membership' using errcode = '42501';
    end if;
    if member.status = 'PENDING' or legacy_teacher or legacy_student then
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

      if invitation.role = 'STUDENT' then
        update public.organization_batch_members bm
        set user_id = p_user_id, pending_student_id = null
        where bm.organization_id = invitation.organization_id and bm.role = 'STUDENT'
          and (bm.pending_student_id = member.id or (legacy_student and bm.user_id = member.user_id));
      end if;

      if legacy_teacher then
        update public.organization_room_schedules schedule set faculty_id = p_user_id
        where schedule.organization_id = invitation.organization_id and schedule.faculty_id = member.user_id;
      end if;
    end if;
  else
    insert into public.institute_members (institute_id, user_id, email, role, status)
    values (invitation.organization_id, p_user_id, normalized_email, invitation.role, 'ACTIVE');
  end if;

  if invitation.role = 'OWNER' then
    update public.institutes set owner_user_id = p_user_id where id = org.id;
    insert into public.platform_audit_logs(actor_user_id,actor_role,target_organization_id,action,details)
    values (p_user_id,'OWNER',org.id,'owner_invitation_accepted',jsonb_build_object('invitationId',invitation.id));
  elsif invitation.role = 'PARENT' and student.id is not null then
    insert into public.organization_guardian_links(organization_id,guardian_user_id,student_user_id,relationship,status)
    values (org.id,p_user_id,student.user_id,invitation.guardian_relationship,'PENDING_REVIEW')
    on conflict do nothing;
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

revoke all on function public.lms_accept_invitation(text,text,text) from public, anon, authenticated;
grant execute on function public.lms_accept_invitation(text,text,text) to service_role;

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
    and (batch_member.user_id = member.user_id or batch_member.pending_student_id = member.id)
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

create function public.lms_list_assigned_students(
  p_organization_id uuid,
  p_actor text,
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
    and (batch_member.user_id = member.user_id or batch_member.pending_student_id = member.id)
    and batch_member.role = member.role
  left join public.organization_batches batch
    on batch.id = batch_member.batch_id and batch.organization_id = member.institute_id
  where member.institute_id = p_organization_id
    and member.role = 'STUDENT'
    and exists (
      select 1 from public.organization_batch_members teacher
      where teacher.organization_id = member.institute_id and teacher.batch_id = batch_member.batch_id
        and teacher.role = 'TEACHER' and teacher.user_id = p_actor
    )
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

revoke all on function public.lms_list_assigned_students(uuid,text,text,text,integer,integer) from public, anon, authenticated;
grant execute on function public.lms_list_assigned_students(uuid,text,text,text,integer,integer) to service_role;

-- Only an existing reviewed-workflow link can be approved through the LMS UI.
create function public.lms_review_invited_guardian(
  p_org uuid, p_actor text, p_guardian uuid, p_student uuid, p_relationship text, p_approved boolean
)
returns uuid language plpgsql security definer set search_path = public as $$
begin
  perform 1 from public.institutes where id = p_org and owner_user_id = p_actor and status = 'ACTIVE' for update;
  if not found or not exists (
    select 1 from public.organization_guardian_links link
    join public.institute_members guardian on guardian.institute_id = link.organization_id and guardian.user_id = link.guardian_user_id
    join public.institute_members student on student.institute_id = link.organization_id and student.user_id = link.student_user_id
    where link.organization_id = p_org and guardian.id = p_guardian and student.id = p_student
      and link.relationship = p_relationship and
      ((p_approved and link.status in ('PENDING_REVIEW','REVOKED')) or (not p_approved and link.status in ('PENDING_REVIEW','APPROVED')))
    for update of link
  ) then
    raise exception 'Guardian review unavailable' using errcode = '42501';
  end if;
  return public.lms_review_guardian_link(p_org,p_actor,p_guardian,p_student,p_relationship,p_approved);
end;
$$;

revoke all on function public.lms_review_invited_guardian(uuid,text,uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.lms_review_invited_guardian(uuid,text,uuid,uuid,text,boolean) to service_role;

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
  if p_status not in ('PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED') then
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
    or (member.status = 'PENDING' and (p_status <> 'PENDING' or p_role <> member.role))
    or (member.status <> 'PENDING' and p_status = 'PENDING')
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

commit;


