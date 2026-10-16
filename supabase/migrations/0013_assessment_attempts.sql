-- PrepZii question-bank adapter and server-authoritative LMS assessment attempts.

alter table public.institute_tests add column if not exists max_attempts integer not null default 1;
alter table public.institute_tests add column if not exists result_release_policy text not null default 'IMMEDIATE';
alter table public.institute_tests add column if not exists solution_release_policy text not null default 'AFTER_WINDOW';
alter table public.institute_tests add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'institute_tests_max_attempts_check') then
    alter table public.institute_tests add constraint institute_tests_max_attempts_check check (max_attempts between 1 and 10);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'institute_tests_result_release_check') then
    alter table public.institute_tests add constraint institute_tests_result_release_check check (result_release_policy in ('IMMEDIATE', 'AFTER_WINDOW', 'MANUAL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'institute_tests_solution_release_check') then
    alter table public.institute_tests add constraint institute_tests_solution_release_check check (solution_release_policy in ('IMMEDIATE', 'AFTER_WINDOW', 'MANUAL'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'institute_tests_id_institute_unique') then
    alter table public.institute_tests add constraint institute_tests_id_institute_unique unique (id, institute_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'institute_test_questions_test_org_fk') then
    alter table public.institute_test_questions add constraint institute_test_questions_test_org_fk
      foreign key (institute_test_id, institute_id) references public.institute_tests(id, institute_id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_test_schedules_id_org_unique') then
    alter table public.organization_test_schedules add constraint organization_test_schedules_id_org_unique unique (id, organization_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'organization_test_schedule_test_org_fk') then
    alter table public.organization_test_schedules add constraint organization_test_schedule_test_org_fk
      foreign key (test_id, organization_id) references public.institute_tests(id, institute_id) on delete cascade not valid;
  end if;
end;
$$;

create table if not exists public.organization_assessment_attempts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  test_id uuid not null,
  schedule_id uuid not null,
  user_id text not null,
  attempt_number integer not null check (attempt_number > 0),
  status text not null default 'IN_PROGRESS' check (status in ('IN_PROGRESS', 'SUBMITTED', 'EXPIRED')),
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  submitted_at timestamptz,
  answer_version integer not null default 0,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  question_results jsonb,
  score numeric(10,2),
  max_score numeric(10,2),
  percentage numeric(6,2),
  correct_count integer,
  incorrect_count integer,
  unanswered_count integer,
  time_taken_seconds integer,
  results_released boolean not null default false,
  solutions_released boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (test_id, organization_id) references public.institute_tests(id, institute_id) on delete cascade,
  foreign key (schedule_id, organization_id) references public.organization_test_schedules(id, organization_id) on delete cascade,
  unique (organization_id, test_id, user_id, attempt_number)
);

create index if not exists organization_assessment_attempts_user_idx on public.organization_assessment_attempts(organization_id, user_id, started_at desc);
create index if not exists organization_assessment_attempts_test_idx on public.organization_assessment_attempts(organization_id, test_id, status, submitted_at);
create unique index if not exists organization_one_active_test_attempt_idx
  on public.organization_assessment_attempts(organization_id, test_id, user_id)
  where status = 'IN_PROGRESS';

alter table public.organization_assessment_attempts enable row level security;
create policy organization_assessment_attempts_read on public.organization_assessment_attempts
  for select using (
    user_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or (
      public.has_organization_role(organization_id, array['TEACHER'])
      and exists (
        select 1 from public.institute_tests test
        where test.id = organization_assessment_attempts.test_id
          and test.institute_id = organization_assessment_attempts.organization_id
          and test.created_by = public.requesting_user_id()
      )
    )
  );

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

create or replace function public.lms_save_assessment_answers(
  p_organization_id uuid,
  p_actor_user_id text,
  p_attempt_id uuid,
  p_expected_version integer,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  attempt public.organization_assessment_attempts%rowtype;
begin
  if jsonb_typeof(p_answers) <> 'object' then raise exception 'Answers must be an object' using errcode = '22023'; end if;
  select * into attempt from public.organization_assessment_attempts candidate
  where candidate.id = p_attempt_id and candidate.organization_id = p_organization_id and candidate.user_id = p_actor_user_id
  for update;
  if not found then raise exception 'Attempt not found' using errcode = '42501'; end if;
  if attempt.status <> 'IN_PROGRESS' then raise exception 'Attempt is already final' using errcode = '22023'; end if;
  if now() > attempt.expires_at then
    raise exception 'Attempt has expired' using errcode = '22023';
  end if;
  if attempt.answer_version <> p_expected_version then raise exception 'Answer version conflict' using errcode = '40001'; end if;
  if exists (
    select 1 from jsonb_object_keys(p_answers) answer(question_id)
    where case
      when answer.question_id ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      then not exists (
          select 1 from public.institute_test_questions test_question
          where test_question.institute_id = p_organization_id and test_question.institute_test_id = attempt.test_id
            and test_question.question_id = answer.question_id::uuid
        )
      else true
    end
  ) then raise exception 'Answer contains a question outside the assessment' using errcode = '22023'; end if;
  update public.organization_assessment_attempts
  set answers = p_answers, answer_version = answer_version + 1, updated_at = now()
  where id = attempt.id
  returning answer_version into p_expected_version;
  return jsonb_build_object('attemptId', attempt.id, 'answerVersion', p_expected_version, 'savedAt', now());
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

revoke all on function public.lms_start_assessment(uuid, text, text, uuid) from public;
revoke all on function public.lms_save_assessment_answers(uuid, text, uuid, integer, jsonb) from public;
revoke all on function public.lms_finalize_assessment(uuid, text, uuid, integer, jsonb, jsonb) from public;
grant execute on function public.lms_start_assessment(uuid, text, text, uuid) to service_role;
grant execute on function public.lms_save_assessment_answers(uuid, text, uuid, integer, jsonb) to service_role;
grant execute on function public.lms_finalize_assessment(uuid, text, uuid, integer, jsonb, jsonb) to service_role;

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
        where batch.id = target_batch_id and batch.organization_id = p_organization_id
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
      where organization_id = p_organization_id and test_id = test.id and status = 'SUBMITTED';
      created_id := test.id;
    elsif p_action = 'RELEASE_SOLUTIONS' then
      update public.organization_assessment_attempts set solutions_released = true, updated_at = now()
      where organization_id = p_organization_id and test_id = test.id and status = 'SUBMITTED';
      created_id := test.id;
    else raise exception 'Unsupported assessment action' using errcode = '22023';
    end if;
  end if;

  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'assessment', created_id::text, p_payload);
  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

revoke all on function public.lms_assessment_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_assessment_mutation(uuid, text, text, text, jsonb) to service_role;
