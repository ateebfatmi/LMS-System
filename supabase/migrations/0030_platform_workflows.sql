begin;

-- Replace the implementation with the same signature. A caller that supplies
-- the optional ID can derive the owner invitation hash before this transaction.
create or replace function public.lms_create_invited_institute(p_actor text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  org_id uuid := coalesce((p_payload ->> 'organizationId')::uuid, gen_random_uuid());
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

create function public.lms_provision_institute(
  p_actor text, p_organization_id uuid, p_payload jsonb, p_email text, p_hash text, p_key text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  org_id uuid;
begin
  if p_organization_id is null or nullif(trim(p_email), '') is null or nullif(trim(p_hash), '') is null
    or nullif(trim(p_key), '') is null then
    raise exception 'An owner invitation is required' using errcode = '22023';
  end if;
  org_id := public.lms_create_invited_institute(p_actor,
    p_payload || jsonb_build_object('organizationId', p_organization_id));
  return public.lms_manage_initial_owner_invitation(org_id,p_actor,p_email,p_hash,p_key)
    || jsonb_build_object('organizationId', org_id);
end;
$$;

revoke all on function public.lms_provision_institute(text,uuid,jsonb,text,text,text) from public, anon, authenticated;
grant execute on function public.lms_provision_institute(text,uuid,jsonb,text,text,text) to service_role;

alter table public.organization_announcements
  drop constraint organization_announcements_target_audience_check,
  add constraint organization_announcements_target_audience_check
    check (target_audience in ('ALL', 'BATCH', 'FACULTY', 'PARENTS', 'STUDENTS'));

-- Existing announcement audiences keep their current policies. Student-only
-- broadcasts can be read by the target audience and institute leadership.
create policy platform_student_broadcast_read on public.organization_announcements
  for select to authenticated using (
    target_audience = 'STUDENTS' and status = 'PUBLISHED'
    and public.has_organization_role(organization_id, array['STUDENT'])
  );

create policy platform_student_broadcast_read_boundary on public.organization_announcements
  as restrictive for select to anon, authenticated using (
    target_audience <> 'STUDENTS'
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or (status = 'PUBLISHED' and public.has_organization_role(organization_id, array['STUDENT']))
  );

create function public.lms_platform_broadcast(p_actor text, p_payload jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare
  target_id uuid := (p_payload ->> 'targetOrganizationId')::uuid;
  audience text := p_payload ->> 'targetAudience';
  recipient_count integer;
begin
  if audience is null or audience not in ('ALL', 'STUDENTS', 'FACULTY') then
    raise exception 'Invalid broadcast audience' using errcode = '22023';
  end if;

  insert into public.organization_announcements (
    organization_id, title, content, priority, target_audience, category, status, channels, created_by, published_at
  )
  select institute.id, '[Platform Broadcast] ' || (p_payload ->> 'title'),
    p_payload ->> 'content', p_payload ->> 'priority', audience, 'GENERAL', 'PUBLISHED',
    array['PORTAL'], p_actor, now()
  from public.institutes institute
  where institute.status = 'ACTIVE' and (target_id is null or institute.id = target_id);

  get diagnostics recipient_count = row_count;
  if recipient_count = 0 then
    raise exception 'No active institutes match the broadcast target' using errcode = '22023';
  end if;

  insert into public.platform_audit_logs (actor_user_id, actor_role, target_organization_id, action, details)
  values (p_actor, 'PLATFORM_SUPER_ADMIN', target_id, 'platform_broadcast_announcement',
    jsonb_build_object('title', p_payload ->> 'title', 'priority', p_payload ->> 'priority',
      'targetAudience', audience, 'recipientInstituteCount', recipient_count));
  return recipient_count;
end;
$$;

revoke all on function public.lms_platform_broadcast(text,jsonb) from public, anon, authenticated;
grant execute on function public.lms_platform_broadcast(text,jsonb) to service_role;

commit;
