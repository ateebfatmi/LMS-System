-- Run against a disposable database with the full migration chain.
begin;

do $$
declare
  org uuid := '82000000-0000-0000-0000-000000000001';
  invalid_org uuid := '82000000-0000-0000-0000-000000000002';
  support_id uuid;
  recipient_count integer;
  plan jsonb := '{"name":"Platform test institute","slug":"platform-test-institute","instituteType":"COACHING","planId":"basic","subscriptionStatus":"TRIAL"}';
  notice jsonb := '{"title":"Platform workflow notice","content":"A private test broadcast","priority":"HIGH","targetAudience":"STUDENTS"}';
  result jsonb;
begin
  if has_function_privilege('authenticated', 'public.lms_platform_broadcast(text,jsonb)', 'EXECUTE')
    or has_function_privilege('anon', 'public.lms_provision_institute(text,uuid,jsonb,text,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.lms_provision_institute(text,uuid,jsonb,text,text,text)', 'EXECUTE') then
    raise exception 'Platform writes are exposed to a client role';
  end if;

  result := public.lms_provision_institute('user_platform_a', org, plan, 'owner@example.invalid', repeat('a',64), 'platform-owner');
  if not exists (select 1 from public.organization_invitations where id = (result->>'id')::uuid
    and organization_id = org and status = 'PENDING' and role = 'OWNER')
    or not exists (select 1 from public.organization_subscriptions where organization_id = org and status = 'TRIAL')
    or exists (select 1 from public.institute_members where institute_id = org) then
    raise exception 'Registration must save the trial and invitation before granting owner access';
  end if;

  begin
    perform public.lms_provision_institute('user_platform_b', invalid_org, plan || '{"slug":"platform-failed-institute"}',
      'other@example.invalid', repeat('a',64), 'duplicate-token');
    raise exception 'A duplicate invitation token should abort registration';
  exception when unique_violation then
    if exists (select 1 from public.institutes where id = invalid_org) then raise exception 'Registration left a partial institute'; end if;
  end;

  perform public.lms_accept_invitation(repeat('a',64), 'user_platform_owner', 'owner@example.invalid');
  insert into public.institute_members(institute_id,user_id,email,role,status) values
    (org,'user_platform_student','student@example.invalid','STUDENT','ACTIVE'),
    (org,'user_platform_teacher','teacher@example.invalid','TEACHER','ACTIVE');

  perform public.lms_platform_mutation('user_platform_b','SET_FEATURE_FLAG',
    '{"key":"platform_test_flag","description":"Platform test flag","enabled":true}');
  if not exists (select 1 from public.platform_feature_flags where key='platform_test_flag' and enabled_by_default) then
    raise exception 'Platform feature flag did not persist';
  end if;

  insert into public.platform_support_access_requests(organization_id,requested_by,reason)
  values (org,'user_platform_b','Test pending support review') returning id into support_id;
  perform public.lms_review_support_access(org, support_id, 'user_platform_owner', 'OWNER', 'APPROVE');
  if not exists (select 1 from public.platform_support_access_requests where id=support_id
    and status='APPROVED' and expires_at > now()) then
    raise exception 'Owner support approval did not set an expiry';
  end if;
  perform public.lms_review_support_access(org, support_id, 'user_platform_owner', 'OWNER', 'REVOKE');

  recipient_count := public.lms_platform_broadcast('user_platform_b', notice || jsonb_build_object('targetOrganizationId', org));
  if recipient_count <> 1
    or not exists (select 1 from public.platform_audit_logs where action='platform_broadcast_announcement'
      and actor_user_id='user_platform_b' and target_organization_id=org) then
    raise exception 'Broadcast and platform audit were not saved together';
  end if;
end;
$$;

set local role authenticated;
do $$
begin
  perform set_config('request.jwt.claims','{"sub":"user_platform_student","role":"authenticated"}',true);
  if not exists (select 1 from public.organization_announcements where title='[Platform Broadcast] Platform workflow notice') then
    raise exception 'The student did not receive the targeted broadcast';
  end if;
  perform set_config('request.jwt.claims','{"sub":"user_platform_teacher","role":"authenticated"}',true);
  if exists (select 1 from public.organization_announcements where title='[Platform Broadcast] Platform workflow notice') then
    raise exception 'A student-only broadcast was visible to a teacher';
  end if;
end;
$$;

rollback;
