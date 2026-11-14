begin;

create or replace function public.lms_start_assessment(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_test_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  test public.institute_tests%rowtype;
  schedule public.organization_test_schedules%rowtype;
  attempt public.organization_assessment_attempts%rowtype;
  prior_attempts integer;
begin
  if p_actor_role <> 'STUDENT' then raise exception 'Only students can start an assessment' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_test_id::text || ':' || p_actor_user_id, 0));

  select * into test from public.institute_tests candidate
  where candidate.id = p_test_id and candidate.institute_id = p_organization_id and candidate.status = 'PUBLISHED';
  if not found then raise exception 'Published assessment not found' using errcode = '42501'; end if;

  select candidate.* into schedule
  from public.organization_test_schedules candidate
  where candidate.organization_id = p_organization_id and candidate.test_id = p_test_id
    and exists (select 1 from public.organization_batches batch
      where batch.id = candidate.batch_id and batch.organization_id = p_organization_id and batch.is_active)
    and now() between candidate.starts_at and candidate.ends_at
    and exists (
      select 1 from public.organization_batch_members enrollment
      where enrollment.organization_id = p_organization_id and enrollment.batch_id = candidate.batch_id
        and enrollment.user_id = p_actor_user_id and enrollment.role = 'STUDENT'
    )
  order by candidate.starts_at desc limit 1;
  if not found then raise exception 'Assessment is not available for an enrolled batch' using errcode = '42501'; end if;

  select * into attempt from public.organization_assessment_attempts candidate
  where candidate.organization_id = p_organization_id and candidate.test_id = p_test_id
    and candidate.user_id = p_actor_user_id and candidate.status = 'IN_PROGRESS'
  for update;
  if found and attempt.expires_at > now() then
    return jsonb_build_object('attemptId', attempt.id, 'answerVersion', attempt.answer_version, 'answers', attempt.answers, 'expiresAt', attempt.expires_at, 'resumed', true);
  elsif found then
    update public.organization_assessment_attempts set status = 'EXPIRED', updated_at = now() where id = attempt.id;
  end if;

  select count(*)::integer into prior_attempts from public.organization_assessment_attempts
  where organization_id = p_organization_id and test_id = p_test_id and user_id = p_actor_user_id;
  if prior_attempts >= test.max_attempts then raise exception 'Maximum attempts reached' using errcode = '22023'; end if;

  insert into public.organization_assessment_attempts (
    organization_id, test_id, schedule_id, user_id, attempt_number, expires_at
  ) values (
    p_organization_id, p_test_id, schedule.id, p_actor_user_id, prior_attempts + 1,
    least(now() + make_interval(mins => test.duration_minutes), schedule.ends_at)
  ) returning * into attempt;
  return jsonb_build_object('attemptId', attempt.id, 'answerVersion', 0, 'answers', '{}'::jsonb, 'expiresAt', attempt.expires_at, 'resumed', false);
end;
$$;

create or replace function public.lms_finalize_assessment(
  p_organization_id uuid,
  p_actor_user_id text,
  p_attempt_id uuid,
  p_expected_version integer,
  p_summary jsonb,
  p_question_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.organization_assessment_attempts%rowtype;
  test public.institute_tests%rowtype;
  schedule public.organization_test_schedules%rowtype;
begin
  if jsonb_typeof(p_summary) <> 'object' or jsonb_typeof(p_question_results) <> 'array' then
    raise exception 'Invalid assessment result payload' using errcode = '22023';
  end if;
  select * into attempt from public.organization_assessment_attempts candidate
  where candidate.id = p_attempt_id and candidate.organization_id = p_organization_id and candidate.user_id = p_actor_user_id
  for update;
  if not found then raise exception 'Attempt not found' using errcode = '42501'; end if;
  if attempt.status = 'SUBMITTED' then
    return jsonb_build_object('attemptId', attempt.id, 'submitted', true, 'idempotent', true, 'resultsReleased', attempt.results_released, 'solutionsReleased', attempt.solutions_released);
  end if;
  if attempt.status <> 'IN_PROGRESS' then
    raise exception 'Attempt is already final' using errcode = '22023';
  end if;
  if attempt.answer_version <> p_expected_version then raise exception 'Answer version conflict' using errcode = '40001'; end if;
  select * into test from public.institute_tests where id = attempt.test_id and institute_id = p_organization_id;
  if not found then raise exception 'Assessment not found' using errcode = '23503'; end if;
  select * into schedule from public.organization_test_schedules where id = attempt.schedule_id and organization_id = p_organization_id;
  if not found then raise exception 'Assessment schedule not found' using errcode = '23503'; end if;
  if (p_summary ->> 'totalScore') is null or (p_summary ->> 'maxScore') is null
    or (p_summary ->> 'percentage') is null or (p_summary ->> 'correctCount') is null
    or (p_summary ->> 'incorrectCount') is null or (p_summary ->> 'unansweredCount') is null then
    raise exception 'Assessment summary is incomplete' using errcode = '22023';
  end if;
  update public.organization_assessment_attempts set
    status = 'SUBMITTED', submitted_at = now(), question_results = p_question_results,
    score = (p_summary ->> 'totalScore')::numeric, max_score = (p_summary ->> 'maxScore')::numeric,
    percentage = (p_summary ->> 'percentage')::numeric, correct_count = (p_summary ->> 'correctCount')::integer,
    incorrect_count = (p_summary ->> 'incorrectCount')::integer, unanswered_count = (p_summary ->> 'unansweredCount')::integer,
    time_taken_seconds = least(greatest(extract(epoch from (now() - attempt.started_at))::integer, 0), test.duration_minutes * 60),
    results_released = test.result_release_policy = 'IMMEDIATE' or (test.result_release_policy = 'AFTER_WINDOW' and now() >= schedule.ends_at),
    solutions_released = test.solution_release_policy = 'IMMEDIATE' or (test.solution_release_policy = 'AFTER_WINDOW' and now() >= schedule.ends_at),
    updated_at = now()
  where id = attempt.id returning * into attempt;
  return jsonb_build_object('attemptId', attempt.id, 'submitted', true, 'idempotent', false, 'resultsReleased', attempt.results_released, 'solutionsReleased', attempt.solutions_released);
end;
$$;

create or replace function public.lms_assessment_mutation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_action text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_id uuid;
  test public.institute_tests%rowtype;
  target_batch_id uuid;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Role cannot manage assessments' using errcode = '42501';
  end if;

  if p_action = 'CREATE_TEST' then
    insert into public.institute_tests (
      institute_id, title, exam, subject, chapters, difficulty, duration_minutes, total_questions,
      status, created_by, max_attempts, result_release_policy, solution_release_policy
    ) values (
      p_organization_id, p_payload ->> 'title', p_payload ->> 'exam', p_payload ->> 'subject',
      array(select jsonb_array_elements_text(coalesce(p_payload -> 'chapters', '[]'::jsonb))),
      p_payload ->> 'difficulty', (p_payload ->> 'durationMinutes')::integer, 0, 'DRAFT', p_actor_user_id,
      (p_payload ->> 'maxAttempts')::integer, p_payload ->> 'resultReleasePolicy', p_payload ->> 'solutionReleasePolicy'
    ) returning id into created_id;
  else
    select * into test from public.institute_tests candidate
    where candidate.id = (p_payload ->> 'testId')::uuid and candidate.institute_id = p_organization_id for update;
    if not found then raise exception 'Assessment not found' using errcode = '23503'; end if;
    if p_actor_role = 'TEACHER' and test.created_by <> p_actor_user_id then
      raise exception 'Teacher can manage only assessments they created' using errcode = '42501';
    end if;

    if p_action = 'ADD_QUESTION' then
      if test.status <> 'DRAFT' then raise exception 'Published assessment cannot be edited' using errcode = '22023'; end if;
      if not exists (select 1 from public.questions where id = (p_payload ->> 'questionId')::uuid)
      then raise exception 'Question not found' using errcode = '23503'; end if;
      insert into public.institute_test_questions (institute_id, institute_test_id, question_id, question_order)
      values (
        p_organization_id, test.id, (p_payload ->> 'questionId')::uuid,
        coalesce((p_payload ->> 'questionOrder')::integer, test.total_questions + 1)
      ) on conflict (institute_test_id, question_id) do nothing
      returning id into created_id;
      update public.institute_tests set total_questions = (
        select count(*) from public.institute_test_questions where institute_id = p_organization_id and institute_test_id = test.id
      ), updated_at = now() where id = test.id;
      created_id := coalesce(created_id, test.id);
    elsif p_action = 'SCHEDULE_TEST' then
      target_batch_id := (p_payload ->> 'batchId')::uuid;
      if not exists (
        select 1 from public.organization_batches batch
        where batch.id = target_batch_id and batch.organization_id = p_organization_id and batch.is_active
          and (p_actor_role <> 'TEACHER' or exists (
            select 1 from public.organization_batch_members enrollment
            where enrollment.organization_id = p_organization_id and enrollment.batch_id = batch.id
              and enrollment.user_id = p_actor_user_id and enrollment.role = 'TEACHER'
          ))
      ) then raise exception 'Batch not found or not assigned' using errcode = '23503'; end if;
      insert into public.organization_test_schedules (organization_id, test_id, batch_id, starts_at, ends_at, is_strict_timing)
      values (p_organization_id, test.id, target_batch_id, (p_payload ->> 'startsAt')::timestamptz, (p_payload ->> 'endsAt')::timestamptz, true)
      returning id into created_id;
    elsif p_action = 'PUBLISH_TEST' then
      if (p_payload ->> 'published')::boolean and (
        test.total_questions < 1
        or not exists (select 1 from public.organization_test_schedules where organization_id = p_organization_id and test_id = test.id)
      ) then raise exception 'Assessment requires questions and a schedule before publication' using errcode = '22023'; end if;
      update public.institute_tests
      set status = case when (p_payload ->> 'published')::boolean then 'PUBLISHED' else 'DRAFT' end,
          published_at = case when (p_payload ->> 'published')::boolean then coalesce(published_at, now()) else null end,
          updated_at = now()
      where id = test.id returning id into created_id;
    elsif p_action = 'RELEASE_RESULTS' then
      update public.organization_assessment_attempts set results_released = true, updated_at = now()
      where organization_id = p_organization_id and test_id = test.id and status = 'SUBMITTED'
        and exists (
          select 1 from public.organization_test_schedules schedule
          where schedule.id = organization_assessment_attempts.schedule_id and schedule.organization_id = p_organization_id
            and (p_actor_role <> 'TEACHER' or exists (
              select 1 from public.organization_batch_members assigned
              where assigned.organization_id = p_organization_id and assigned.batch_id = schedule.batch_id
                and assigned.user_id = p_actor_user_id and assigned.role = 'TEACHER'
            ))
        );
      created_id := test.id;
    elsif p_action = 'RELEASE_SOLUTIONS' then
      update public.organization_assessment_attempts set solutions_released = true, updated_at = now()
      where organization_id = p_organization_id and test_id = test.id and status = 'SUBMITTED'
        and exists (
          select 1 from public.organization_test_schedules schedule
          where schedule.id = organization_assessment_attempts.schedule_id and schedule.organization_id = p_organization_id
            and (p_actor_role <> 'TEACHER' or exists (
              select 1 from public.organization_batch_members assigned
              where assigned.organization_id = p_organization_id and assigned.batch_id = schedule.batch_id
                and assigned.user_id = p_actor_user_id and assigned.role = 'TEACHER'
            ))
        );
      created_id := test.id;
    else raise exception 'Unsupported assessment action' using errcode = '22023';
    end if;
  end if;

  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'assessment', created_id::text, p_payload);
  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

create or replace function public.lms_grade_descriptive_submission(
  p_organization_id uuid,
  p_submission_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_awarded_marks numeric,
  p_feedback text,
  p_is_moderation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.organization_descriptive_submissions%rowtype;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Unauthorized to evaluate submissions' using errcode = '42501';
  end if;

  select * into sub
  from public.organization_descriptive_submissions
  where id = p_submission_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Descriptive submission not found' using errcode = '23503';
  end if;

  if p_actor_role = 'TEACHER' and not exists (
    select 1 from public.organization_assessment_attempts attempt
    join public.institute_tests test on test.id = attempt.test_id and test.institute_id = attempt.organization_id
    join public.organization_test_schedules schedule on schedule.id = attempt.schedule_id
      and schedule.organization_id = attempt.organization_id and schedule.test_id = attempt.test_id
    join public.organization_batch_members assigned on assigned.batch_id = schedule.batch_id
      and assigned.organization_id = attempt.organization_id and assigned.user_id = p_actor_user_id
      and assigned.role = 'TEACHER'
    where attempt.id = sub.attempt_id and attempt.organization_id = p_organization_id
      and attempt.test_id = sub.test_id and attempt.user_id = sub.student_user_id and test.created_by = p_actor_user_id
  ) then
    raise exception 'Submission outside assigned teaching scope' using errcode = '42501';
  end if;

  if p_awarded_marks < 0 or p_awarded_marks > sub.max_marks then
    raise exception 'Awarded marks must be between 0 and %', sub.max_marks using errcode = '22023';
  end if;

  if p_is_moderation then
    if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR') then
      raise exception 'Only administrators can moderate grades' using errcode = '42501';
    end if;
    update public.organization_descriptive_submissions set
      awarded_marks = p_awarded_marks,
      moderator_user_id = p_actor_user_id,
      moderator_notes = p_feedback,
      status = 'MODERATED',
      moderated_at = now(),
      updated_at = now()
    where id = sub.id;
  else
    update public.organization_descriptive_submissions set
      awarded_marks = p_awarded_marks,
      evaluator_user_id = p_actor_user_id,
      feedback = p_feedback,
      status = 'GRADED',
      graded_at = now(),
      updated_at = now()
    where id = sub.id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role,
    case when p_is_moderation then 'assessment.descriptive_moderated' else 'assessment.descriptive_graded' end,
    'descriptive_submission', sub.id::text,
    jsonb_build_object('awardedMarks', p_awarded_marks, 'isModeration', p_is_moderation)
  );

  return jsonb_build_object('submissionId', sub.id, 'status', case when p_is_moderation then 'MODERATED' else 'GRADED' end, 'awardedMarks', p_awarded_marks);
end;
$$;

-- Read the guardian relationship and its child data in a single database snapshot.
-- No caller-supplied child identifiers are used to establish access.
create function public.lms_guardian_dashboard(p_org uuid, p_guardian text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', link.id, 'studentId', student.id, 'studentName', coalesce(profile.display_name, student.email),
    'relationship', link.relationship, 'status', link.status,
    'results', coalesce((
      select jsonb_agg(to_jsonb(recent) order by recent.submitted_at desc)
      from (
        select attempt.id, test.title, attempt.percentage, attempt.submitted_at
        from public.organization_assessment_attempts attempt
        join public.institute_tests test on test.id = attempt.test_id and test.institute_id = p_org
        join public.organization_test_schedules schedule on schedule.id = attempt.schedule_id
          and schedule.organization_id = p_org and schedule.test_id = test.id
        where attempt.organization_id = p_org and attempt.user_id = student.user_id
          and attempt.status = 'SUBMITTED' and (attempt.results_released
            or test.result_release_policy = 'IMMEDIATE'
            or (test.result_release_policy = 'AFTER_WINDOW' and schedule.ends_at <= now()))
        order by attempt.submitted_at desc, attempt.id limit 10
      ) recent
    ), '[]'::jsonb),
    'attendance', (
      select jsonb_build_object('recorded', count(*), 'present', count(*) filter (where recent.status = 'PRESENT'),
        'late', count(*) filter (where recent.status = 'LATE'), 'absent', count(*) filter (where recent.status = 'ABSENT'),
        'excused', count(*) filter (where recent.status = 'EXCUSED'))
      from (
        select record.status from public.organization_attendance_records record
        join public.organization_attendance_sessions session on session.id = record.session_id and session.organization_id = p_org
        where record.organization_id = p_org and record.student_id = student.user_id
        order by session.session_date desc, record.id limit 30
      ) recent
    ),
    'installments', coalesce((
      select jsonb_agg(jsonb_build_object('id', item.id, 'title', item.title, 'dueDate', item.due_date,
        'amount', item.amount, 'paid', item.paid_amount, 'status', item.status) order by item.due_date, item.id)
      from public.organization_student_fees ledger
      join public.organization_fee_installments item on item.student_fee_id = ledger.id and item.organization_id = p_org
      where ledger.organization_id = p_org and ledger.student_id = student.user_id
    ), '[]'::jsonb)
  ) order by coalesce(profile.display_name, student.email), link.id), '[]'::jsonb)
  from public.organization_guardian_links link
  join public.institutes institute on institute.id = link.organization_id and institute.status = 'ACTIVE'
  join public.institute_members student on student.institute_id = p_org and student.user_id = link.student_user_id
    and student.role = 'STUDENT' and student.status = 'ACTIVE'
  left join public.organization_member_profiles profile on profile.organization_id = p_org and profile.membership_id = student.id
  where link.organization_id = p_org and link.guardian_user_id = p_guardian and link.status = 'APPROVED'
    and exists (select 1 from public.institute_members guardian where guardian.institute_id = p_org
      and guardian.user_id = p_guardian and guardian.role = 'PARENT' and guardian.status = 'ACTIVE')
    and 1 = (select count(*) from public.institute_members member where member.institute_id = p_org
      and member.user_id = p_guardian and member.status = 'ACTIVE')
    and 1 = (select count(*) from public.institute_members member where member.institute_id = p_org
      and member.user_id = student.user_id and member.status = 'ACTIVE');
$$;
revoke all on function public.lms_guardian_dashboard(uuid,text) from public, anon, authenticated;
grant execute on function public.lms_guardian_dashboard(uuid,text) to service_role;

create or replace function public.lms_review_support_access(
  p_organization_id uuid,
  p_request_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_decision text,
  p_duration_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.platform_support_access_requests%rowtype;
begin
  if p_actor_role <> 'OWNER' then
    raise exception 'Only institute owners can approve support access' using errcode = '42501';
  end if;

  if p_decision not in ('APPROVE', 'REJECT', 'REVOKE') then
    raise exception 'Invalid support access decision' using errcode = '22023';
  end if;

  select * into req
  from public.platform_support_access_requests
  where id = p_request_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Support access request not found' using errcode = '23503';
  end if;

  if (p_decision in ('APPROVE', 'REJECT') and req.status <> 'PENDING')
    or (p_decision = 'REVOKE' and req.status <> 'APPROVED') then
    raise exception 'Support request is no longer eligible for this decision' using errcode = '22023';
  end if;

  if p_decision = 'APPROVE' then
    update public.platform_support_access_requests set
      status = 'APPROVED',
      approved_by = p_actor_user_id,
      expires_at = now() + (least(greatest(p_duration_hours, 1), 72) || ' hours')::interval,
      updated_at = now()
    where id = req.id;
  elsif p_decision = 'REJECT' then
    update public.platform_support_access_requests set
      status = 'REJECTED',
      updated_at = now()
    where id = req.id;
  else
    update public.platform_support_access_requests set
      status = 'REVOKED',
      updated_at = now()
    where id = req.id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role, 'support_access.' || lower(p_decision),
    'platform_support_access_request', req.id::text,
    jsonb_build_object('decision', p_decision, 'durationHours', p_duration_hours)
  );

  return jsonb_build_object('requestId', req.id, 'status', p_decision);
end;
$$;

commit;
