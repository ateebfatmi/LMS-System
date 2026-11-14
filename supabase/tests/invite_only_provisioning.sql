-- Run in a disposable database with the full numbered migration chain applied.
begin;
do $$
declare
  org uuid;
  other_org uuid;
  assigned uuid;
  unassigned uuid;
  enrolled uuid;
  guardian uuid;
  test_id uuid;
  question_id uuid;
  attempt_id uuid;
  scheduled_id uuid;
  other_attempt uuid;
  fee_plan uuid;
  ledger uuid;
  installment uuid;
  dashboard jsonb;
  first_invite uuid;
  accepted record;
  invitation jsonb;
  expiry timestamptz := now() + interval '2 days';
  institute jsonb := '{"name":"Invite Institute","slug":"invite-institute","instituteType":"COACHING","planId":"basic","subscriptionStatus":"TRIAL"}';
begin
  org := public.lms_create_invited_institute('user_founder', institute);
  other_org := public.lms_create_invited_institute('user_founder', institute || '{"slug":"invite-other"}');
  if exists (select 1 from public.institute_members where institute_id = org) then
    raise exception 'Provisioning granted membership before acceptance';
  end if;

  invitation := public.lms_manage_initial_owner_invitation(org,'user_founder','owner@example.invalid',repeat('a',64),'owner-first');
  first_invite := (invitation->>'id')::uuid;
  perform public.lms_manage_initial_owner_invitation(org,'user_founder','owner@example.invalid',repeat('b',64),'owner-resend',first_invite);
  select * into accepted from public.lms_accept_invitation(repeat('a',64),'user_owner','owner@example.invalid');
  if accepted.invitation_status is distinct from 'REVOKED' then raise exception 'Resend left old token active'; end if;
  begin
    perform public.lms_accept_invitation(repeat('b',64),'user_other','other@example.invalid');
    raise exception 'Wrong recipient activated owner';
  exception when no_data_found then null;
  end;
  select * into accepted from public.lms_accept_invitation(repeat('b',64),'user_owner','OWNER@example.invalid');
  if accepted.membership_role is distinct from 'OWNER'
    or not exists (select 1 from public.institutes where id = org and owner_user_id = 'user_owner') then
    raise exception 'Owner activation failed';
  end if;
  begin
    perform public.lms_accept_invitation(repeat('b',64),'user_owner','owner@example.invalid');
    raise exception 'Consumed owner token was reusable';
  exception when no_data_found then null;
  end;

  perform public.lms_create_invitation(org,'user_owner','OWNER','manager@example.invalid','COACHING_ADMIN',repeat('c',64),'manager',expiry);
  perform public.lms_accept_invitation(repeat('c',64),'user_manager','manager@example.invalid');
  perform public.lms_create_invitation(org,'user_manager','COACHING_ADMIN','teacher@example.invalid','TEACHER',repeat('d',64),'teacher',expiry);
  perform public.lms_accept_invitation(repeat('d',64),'user_teacher','teacher@example.invalid');

  assigned := (public.lms_academic_mutation(org,'user_owner','OWNER','CREATE_BATCH',
    '{"name":"JEE Batch A","targetExam":"JEE_MAIN"}')->>'id')::uuid;
  insert into public.organization_batches (organization_id,name,target_exam)
  values (other_org,'Outside institute','JEE_MAIN') returning id into unassigned;
  perform public.lms_academic_mutation(org,'user_owner','OWNER','ENROLL_MEMBER',
    jsonb_build_object('batchId',assigned,'memberId',(select id from public.institute_members
      where institute_id = org and user_id = 'user_teacher')));
  begin
    perform public.lms_enroll_student_for_invitation(org,'user_teacher','TEACHER','outside@example.invalid','{"displayName":"Outside"}',unassigned);
    raise exception 'Teacher enrolled a student in another institute';
  exception when insufficient_privilege then null;
  end;
  enrolled := public.lms_enroll_student_for_invitation(org,'user_teacher','TEACHER','student@example.invalid','{"displayName":"Learner"}',assigned);
  if not exists (select 1 from public.lms_list_assigned_students(org,'user_teacher') where member_id = enrolled)
    or not exists (select 1 from public.institute_members where id = enrolled and status = 'PENDING' and user_id is null) then
    raise exception 'Teacher did not receive pending student in assigned scope';
  end if;

  perform public.lms_create_student_or_guardian_invitation(org,'user_teacher','TEACHER',enrolled,'student@example.invalid',
    'STUDENT',null,repeat('e',64),'student',expiry,assigned);
  perform public.lms_platform_mutation('user_founder','SET_ORGANIZATION_STATUS',jsonb_build_object('organizationId',org,'status','SUSPENDED'));
  begin
    perform public.lms_accept_invitation(repeat('e',64),'user_student','student@example.invalid');
    raise exception 'A suspended institute allowed activation';
  exception when no_data_found then null;
  end;
  perform public.lms_platform_mutation('user_founder','SET_ORGANIZATION_STATUS',jsonb_build_object('organizationId',org,'status','ACTIVE'));
  perform public.lms_accept_invitation(repeat('e',64),'user_student','student@example.invalid');
  if not exists (select 1 from public.organization_batch_members where batch_id = assigned and user_id = 'user_student' and pending_student_id is null) then
    raise exception 'Student activation lost assigned batch';
  end if;

  perform public.lms_create_student_or_guardian_invitation(org,'user_teacher','TEACHER',enrolled,'guardian@example.invalid',
    'PARENT','LEGAL_GUARDIAN',repeat('f',64),'guardian',expiry,assigned);
  perform public.lms_accept_invitation(repeat('f',64),'user_guardian','guardian@example.invalid');
  select id into guardian from public.institute_members where institute_id = org and user_id = 'user_guardian';
  perform set_config('request.jwt.claims','{"sub":"user_guardian","role":"authenticated"}',true);
  if public.is_approved_guardian(org,'user_student') then raise exception 'Guardian saw child before review'; end if;
  begin
    perform public.lms_review_invited_guardian(org,'user_manager',guardian,enrolled,'LEGAL_GUARDIAN',true);
    raise exception 'Institute manager approved an owner-only guardian review';
  exception when insufficient_privilege then null;
  end;
  perform public.lms_review_invited_guardian(org,'user_owner',guardian,enrolled,'LEGAL_GUARDIAN',true);
  if not public.is_approved_guardian(org,'user_student') or public.is_approved_guardian(other_org,'user_student') then
    raise exception 'Guardian review had incorrect tenant scope';
  end if;
  -- Continue through the original academic, assessment, attendance and finance RPCs.
  perform public.lms_crm_mutation(org,'user_manager','COACHING_ADMIN','CREATE_LEAD',
    '{"name":"New inquiry","phone":"5551234567","targetExam":"JEE_MAIN","source":"REFERRAL"}');
  if not exists (select 1 from public.organization_leads where organization_id = org and name = 'New inquiry') then
    raise exception 'Admission did not persist';
  end if;
  insert into public.questions(exam,subject,question_text,option_a,option_b,correct_option,marks)
  values ('JEE_MAIN','Physics','Which option is correct?','First','Second','A',4) returning id into question_id;
  test_id := (public.lms_assessment_mutation(org,'user_teacher','TEACHER','CREATE_TEST',
    '{"title":"Physics","exam":"JEE_MAIN","subject":"Physics","difficulty":"medium","durationMinutes":30,"maxAttempts":1,"resultReleasePolicy":"MANUAL","solutionReleasePolicy":"MANUAL"}')->>'id')::uuid;
  perform public.lms_assessment_mutation(org,'user_teacher','TEACHER','ADD_QUESTION',
    jsonb_build_object('testId',test_id,'questionId',question_id));
  perform public.lms_assessment_mutation(org,'user_teacher','TEACHER','SCHEDULE_TEST',
    jsonb_build_object('testId',test_id,'batchId',assigned,'startsAt',now()-interval '5 min','endsAt',now()+interval '30 min'));
  perform public.lms_assessment_mutation(org,'user_teacher','TEACHER','PUBLISH_TEST',
    jsonb_build_object('testId',test_id,'published',true));
  attempt_id := (public.lms_start_assessment(org,'user_student','STUDENT',test_id)->>'attemptId')::uuid;
  perform public.lms_save_assessment_answers(org,'user_student',attempt_id,0,
    jsonb_build_object(question_id::text,'{"selectedOptionIds":["A"]}'::jsonb));
  perform public.lms_finalize_assessment(org,'user_student',attempt_id,1,
    '{"totalScore":4,"maxScore":4,"percentage":100,"correctCount":1,"incorrectCount":0,"unansweredCount":0}', '[]');
  begin
    perform public.lms_start_assessment(org,'user_student','STUDENT',test_id);
    raise exception 'Student received a second attempt';
  exception when invalid_parameter_value then null;
  end;

  insert into public.organization_batches (organization_id,name,target_exam)
  values (org,'Other batch in same institute','JEE_MAIN') returning id into unassigned;
  scheduled_id := (public.lms_assessment_mutation(org,'user_owner','OWNER','SCHEDULE_TEST',
    jsonb_build_object('testId',test_id,'batchId',unassigned,'startsAt',now()-interval '5 min','endsAt',now()+interval '30 min'))->>'id')::uuid;
  insert into public.organization_assessment_attempts(organization_id,test_id,schedule_id,user_id,attempt_number,status,expires_at)
  values (org,test_id,scheduled_id,'user_unrelated',1,'SUBMITTED',now()+interval '30 min') returning id into other_attempt;
  insert into public.organization_descriptive_submissions(organization_id,attempt_id,test_id,question_id,student_user_id,max_marks)
    values (org,other_attempt,test_id,question_id,'user_unrelated',4);
  begin
    perform public.lms_grade_descriptive_submission(org,
      (select id from public.organization_descriptive_submissions where organization_id = org and organization_descriptive_submissions.attempt_id = other_attempt),
      'user_teacher','TEACHER',4,'Reviewed',false);
    raise exception 'Teacher graded outside their batch';
  exception when insufficient_privilege then null;
  end;
  dashboard := public.lms_guardian_dashboard(org,'user_guardian');
  if jsonb_array_length(dashboard->0->'results') <> 0 then raise exception 'Guardian received unpublished marks'; end if;
  perform public.lms_assessment_mutation(org,'user_teacher','TEACHER','RELEASE_RESULTS',jsonb_build_object('testId',test_id));
  dashboard := public.lms_guardian_dashboard(org,'user_guardian');
  if (dashboard->0->'results'->0->>'percentage')::numeric is distinct from 100
    or exists (select 1 from public.organization_assessment_attempts where id = other_attempt and results_released)
    or exists (select 1 from public.organization_assessment_attempts where id = attempt_id and solutions_released) then
    raise exception 'Marks release changed the wrong visibility';
  end if;
  perform public.lms_assessment_mutation(org,'user_teacher','TEACHER','RELEASE_SOLUTIONS',jsonb_build_object('testId',test_id));
  if not exists (select 1 from public.organization_assessment_attempts where id = attempt_id and solutions_released)
    or exists (select 1 from public.organization_assessment_attempts where id = other_attempt and solutions_released) then
    raise exception 'Solutions release changed the wrong visibility';
  end if;

  perform public.lms_save_attendance(org,'user_teacher','TEACHER',assigned,current_date,'Physics',null,null,
    '[{"studentId":"user_student","status":"PRESENT"}]',null);
  fee_plan := (public.lms_finance_mutation(org,'user_manager','COACHING_ADMIN','CREATE_PLAN',
    jsonb_build_object('name','Physics tuition','targetExam','JEE_MAIN','totalAmountPaise',100000,
      'installments',jsonb_build_array(jsonb_build_object('sequenceNumber',1,'title','Term one','amountPaise',100000,'dueDate',current_date+10))))->>'id')::uuid;
  ledger := (public.lms_finance_mutation(org,'user_manager','COACHING_ADMIN','ASSIGN_PLAN',
    jsonb_build_object('studentId','user_student','batchId',assigned,'planId',fee_plan,'concessionAmountPaise',0))->>'id')::uuid;
  select id into installment from public.organization_fee_installments where organization_id = org and student_fee_id = ledger;
  perform public.lms_finance_mutation(org,'user_owner','OWNER','RECORD_PAYMENT',
    jsonb_build_object('studentFeeId',ledger,'installmentId',installment,'amountPaise',25000,'method','CASH','referenceNumber','receipt-1'));
  begin
    perform public.lms_finance_mutation(org,'user_teacher','TEACHER','RECORD_PAYMENT','{}');
    raise exception 'Teacher modified financial data';
  exception when insufficient_privilege then null;
  end;
  dashboard := public.lms_guardian_dashboard(org,'user_guardian');
  if (dashboard->0->'attendance'->>'present')::integer is distinct from 1
    or (dashboard->0->'installments'->0->>'paid')::numeric is distinct from 250
    or public.lms_guardian_dashboard(other_org,'user_guardian') <> '[]'::jsonb
    or public.lms_guardian_dashboard(org,'user_unrelated') <> '[]'::jsonb then
    raise exception 'Attendance or fee visibility crossed the guardian boundary';
  end if;

  perform public.lms_review_invited_guardian(org,'user_owner',guardian,enrolled,'LEGAL_GUARDIAN',false);
  if public.is_approved_guardian(org,'user_student') or public.lms_guardian_dashboard(org,'user_guardian') <> '[]'::jsonb then raise exception 'Guardian revocation did not take effect'; end if;

  if has_function_privilege('authenticated','public.lms_create_invited_institute(text,jsonb)','execute')
    or has_function_privilege('anon','public.lms_manage_initial_owner_invitation(uuid,text,text,text,text,uuid)','execute')
    or has_function_privilege('authenticated','public.lms_guardian_dashboard(uuid,text)','execute')
    or has_function_privilege('authenticated','public.lms_enroll_student_for_invitation(uuid,text,text,text,jsonb,uuid)','execute') then
    raise exception 'A browser role can call a provisioning RPC';
  end if;
end;
$$;
rollback;
