-- Run only after migrations in a disposable PostgreSQL database.
begin;
do $$
declare
  tenant_id uuid;
  other_id uuid;
  guardian_id uuid;
  student_id uuid;
  owner_id uuid;
  activation record;
  assigned_batch uuid;
  unassigned_batch uuid;
  test_id uuid;
  attempt_id uuid;
  outcome jsonb;
begin
  select id into tenant_id from public.lms_create_institute(
    'role-test-owner', 'owner@example.invalid', 'Role Test Institute', 'role-test-one', 'COACHING', '9876543210', 'Kota', 'Rajasthan');
  select id into other_id from public.lms_create_institute(
    'role-test-owner-b', 'owner-b@example.invalid', 'Role Test Institute B', 'role-test-two', 'COACHING', '9876543210', 'Kota', 'Rajasthan');
  if tenant_id is distinct from (select id from public.lms_create_institute(
    'role-test-owner', 'changed@example.invalid', 'Role Test Institute', 'role-test-one', 'COACHING', '9876543210', 'Kota', 'Rajasthan')) then
    raise exception 'Onboarding retry created a second institute';
  end if;
  begin
    perform public.lms_create_institute('intruder', 'other@example.invalid', 'Imposter', 'role-test-one', 'COACHING', '9876543210', 'Kota', 'Rajasthan');
    raise exception 'An unrelated identity claimed the existing institute';
  exception when unique_violation then null;
  end;

  select id into owner_id from public.institute_members where institute_members.institute_id = tenant_id and user_id = 'role-test-owner';
  insert into public.institute_members(institute_id,email,role,status)
  values (tenant_id,'student@example.invalid','STUDENT','PENDING') returning id into student_id;

  perform public.lms_create_invitation(tenant_id,'role-test-owner','OWNER','student@example.invalid','STUDENT',repeat('a',64),'student-invitation',now()+interval '1 day');
  perform public.lms_create_invitation(tenant_id,'role-test-owner','OWNER','teacher@example.invalid','TEACHER',repeat('b',64),'teacher-invitation',now()+interval '1 day');
  select * into activation from public.lms_accept_invitation(repeat('a',64),'role-test-student','student@example.invalid');
  if activation.membership_role <> 'STUDENT' or not exists (
    select 1 from public.institute_members where id = student_id and user_id = 'role-test-student' and status = 'ACTIVE'
  ) then raise exception 'Student activation did not preserve the imported record'; end if;
  select * into activation from public.lms_accept_invitation(repeat('b',64),'role-test-teacher','teacher@example.invalid');
  if activation.invitation_status <> 'ACCEPTED' then raise exception 'Teacher invitation was not accepted'; end if;
  begin
    perform public.lms_accept_invitation(repeat('b',64),'other-account','teacher@example.invalid');
    raise exception 'Another account replayed an accepted invitation';
  exception when no_data_found then null;
  end;

  -- Distinct recipients can have simultaneous pending invitations. Neither
  -- an expired token nor a revoked token may activate its recipient.
  perform public.lms_create_invitation(tenant_id,'role-test-owner','OWNER','expired@example.invalid','TEACHER',repeat('c',64),'expired-invitation',now()+interval '1 day');
  perform public.lms_create_invitation(tenant_id,'role-test-owner','OWNER','revoked@example.invalid','PARENT',repeat('d',64),'revoked-invitation',now()+interval '1 day');
  update public.organization_invitations set expires_at = now() - interval '1 second' where token_hash = repeat('c',64);
  perform public.lms_revoke_invitation(tenant_id,
    (select id from public.organization_invitations where token_hash = repeat('d',64)), 'role-test-owner', 'OWNER');
  select * into activation from public.lms_accept_invitation(repeat('c',64),'expired-user','expired@example.invalid');
  if activation.invitation_status is distinct from 'EXPIRED' then raise exception 'Expired invitation was accepted'; end if;
  select * into activation from public.lms_accept_invitation(repeat('d',64),'revoked-user','revoked@example.invalid');
  if activation.invitation_status is distinct from 'REVOKED' then raise exception 'Revoked invitation was accepted'; end if;
  if exists (select 1 from public.institute_members where user_id in ('expired-user','revoked-user')) then
    raise exception 'A terminal invitation created an active membership';
  end if;

  insert into public.organization_batches (organization_id, name, target_exam)
  values (tenant_id, 'Assigned batch', 'JEE_MAIN') returning id into assigned_batch;
  insert into public.organization_batches (organization_id, name, target_exam)
  values (tenant_id, 'Unassigned batch', 'JEE_MAIN') returning id into unassigned_batch;
  insert into public.organization_batch_members (organization_id, batch_id, user_id, role)
  values (tenant_id, assigned_batch, 'role-test-teacher', 'TEACHER'),
    (tenant_id, assigned_batch, 'role-test-student', 'STUDENT');
  perform set_config('request.jwt.claims','{"sub":"role-test-teacher","role":"authenticated"}',true);
  if not public.is_assigned_institute_teacher(tenant_id, assigned_batch)
    or public.is_assigned_institute_teacher(tenant_id, unassigned_batch) then
    raise exception 'Teacher scope did not match assignments';
  end if;

  outcome := public.lms_assessment_mutation(tenant_id, 'role-test-teacher', 'TEACHER', 'CREATE_TEST',
    '{"title":"Scheduled test","exam":"JEE_MAIN","subject":"Physics","difficulty":"medium","durationMinutes":30,"maxAttempts":1,"resultReleasePolicy":"MANUAL","solutionReleasePolicy":"MANUAL"}');
  test_id := (outcome->>'id')::uuid;
  begin
    perform public.lms_assessment_mutation(tenant_id, 'role-test-teacher', 'TEACHER', 'SCHEDULE_TEST',
      jsonb_build_object('testId',test_id,'batchId',unassigned_batch,'startsAt',now()-interval '5 min','endsAt',now()+interval '30 min'));
    raise exception 'Teacher scheduled an unassigned batch';
  exception when foreign_key_violation then null;
  end;
  perform public.lms_assessment_mutation(tenant_id, 'role-test-teacher', 'TEACHER', 'SCHEDULE_TEST',
    jsonb_build_object('testId',test_id,'batchId',assigned_batch,'startsAt',now()-interval '5 min','endsAt',now()+interval '30 min'));
  -- Publication is covered by assessment unit tests. Seed the published state
  -- here to exercise start, finalization and release independently of bank data.
  update public.institute_tests set status = 'PUBLISHED' where id = test_id;
  begin
    perform public.lms_start_assessment(tenant_id, 'unassigned-student', 'STUDENT', test_id);
    raise exception 'An unenrolled student started the assessment';
  exception when insufficient_privilege then null;
  end;
  outcome := public.lms_start_assessment(tenant_id, 'role-test-student', 'STUDENT', test_id);
  attempt_id := (outcome->>'attemptId')::uuid;
  outcome := public.lms_finalize_assessment(tenant_id, 'role-test-student', attempt_id, 0,
    '{"totalScore":4,"maxScore":4,"percentage":100,"correctCount":1,"incorrectCount":0,"unansweredCount":0}', '[]');
  if (outcome->>'resultsReleased')::boolean or (outcome->>'solutionsReleased')::boolean then
    raise exception 'Manual results or solutions released at submission';
  end if;
  perform public.lms_assessment_mutation(tenant_id, 'role-test-teacher', 'TEACHER', 'RELEASE_RESULTS', jsonb_build_object('testId',test_id));
  if not exists (select 1 from public.organization_assessment_attempts
    where id = attempt_id and results_released and not solutions_released) then
    raise exception 'Marks release did not respect the separate solution policy';
  end if;

  update public.institute_members set status = 'SUSPENDED' where user_id = 'role-test-teacher';
  begin
    perform public.lms_accept_invitation(repeat('b',64),'role-test-teacher','teacher@example.invalid');
    raise exception 'Suspended teacher replayed an invitation';
  exception when insufficient_privilege then null;
  end;

  insert into public.institute_members(institute_id,user_id,email,role,status)
  values (tenant_id,'role-test-parent','parent@example.invalid','PARENT','ACTIVE') returning id into guardian_id;
  begin
    perform public.lms_review_guardian_link(other_id,'role-test-owner-b',guardian_id,student_id,'MOTHER',true);
    raise exception 'Guardian review crossed tenant boundaries';
  exception when insufficient_privilege then null;
  end;
  perform public.lms_review_guardian_link(tenant_id,'role-test-owner',guardian_id,student_id,'MOTHER',true);
  perform set_config('request.jwt.claims','{"sub":"role-test-parent","role":"authenticated"}',true);
  if not public.is_approved_guardian(tenant_id, 'role-test-student') or public.is_approved_guardian(other_id, 'role-test-student') then
    raise exception 'Guardian did not receive only the reviewed relationship';
  end if;
  update public.institute_members set status = 'SUSPENDED' where id = guardian_id;
  if public.is_approved_guardian(tenant_id, 'role-test-student') then raise exception 'Suspended guardian retained access'; end if;
  update public.institute_members set status = 'SUSPENDED' where id = owner_id;
  perform set_config('request.jwt.claims','{"sub":"role-test-owner","role":"authenticated"}',true);
  if public.is_organization_member(tenant_id) then raise exception 'Suspended owner retained access'; end if;
end
$$;

do $$
begin
  if has_function_privilege('authenticated', 'public.lms_platform_mutation(text,text,jsonb)', 'execute')
    or has_function_privilege('authenticated', 'public.lms_start_assessment(uuid,text,text,uuid)', 'execute')
    or has_function_privilege('anon', 'public.lms_accept_invitation(text,text,text)', 'execute')
    or has_column_privilege('authenticated','public.organization_assessment_attempts','question_results','select')
    or has_column_privilege('authenticated','public.organization_assessment_attempts','score','select')
    or has_column_privilege('authenticated','public.institute_members','role','update')
    or has_column_privilege('authenticated','public.institutes','owner_user_id','insert') then
    raise exception 'Browser roles can bypass server authorization';
  end if;
end
$$;

rollback;
