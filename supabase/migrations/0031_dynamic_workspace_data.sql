-- Serve question-bank subjects and assignment dashboard aggregates without
-- downloading entire tables or relying on the API row limit.

create or replace function public.lms_question_bank_subjects()
returns table (subject text)
language sql
stable
set search_path = ''
as $$
  select distinct question.subject::text
  from public.questions question
  where question.subject is not null and btrim(question.subject) <> ''
  order by 1;
$$;

revoke execute on function public.lms_question_bank_subjects() from public, anon, authenticated;
grant execute on function public.lms_question_bank_subjects() to service_role;

create or replace function public.lms_assignment_dashboard(
  p_organization_id uuid,
  p_user_id text,
  p_role text
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with assignments as materialized (
    select assignment.id, assignment.title, assignment.status, assignment.due_at
    from public.organization_assignments assignment
    where assignment.organization_id = p_organization_id
      and case
        when p_role = 'STUDENT' then
          public.lms_student_can_access_assignment(p_organization_id, p_user_id, assignment.id)
        when p_role = 'TEACHER' then
          assignment.created_by = p_user_id
          and public.lms_actor_can_manage_assignment(p_organization_id, p_user_id, p_role, assignment.id)
        else p_role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR')
      end
  ),
  latest as (
    select distinct on (submission.assignment_id, submission.student_user_id)
      submission.assignment_id, submission.student_user_id, submission.status
    from public.organization_assignment_submissions submission
    join assignments on assignments.id = submission.assignment_id
    where submission.organization_id = p_organization_id
      and (p_role <> 'STUDENT' or submission.student_user_id = p_user_id)
    order by submission.assignment_id, submission.student_user_id, submission.attempt_number desc
  ),
  totals as (
    select count(*) filter (where status in ('SUBMITTED', 'LATE', 'GRADED')) as submitted,
      count(distinct assignment_id) filter (where status in ('SUBMITTED', 'LATE', 'GRADED')) as with_submissions,
      count(*) filter (where status in ('SUBMITTED', 'LATE')) as pending_grading
    from latest
  )
  select jsonb_build_object(
    'assignmentCount', (select count(*) from assignments),
    'submittedCount', totals.submitted,
    'assignmentsWithSubmissions', totals.with_submissions,
    'pendingGrading', case when p_role = 'TEACHER' then totals.pending_grading end,
    'pendingAssignments', coalesce((
      select jsonb_agg(to_jsonb(pending) order by pending.due_at, pending.id)
      from (
        select assignment.*
        from assignments assignment
        left join latest on latest.assignment_id = assignment.id
        where p_role = 'STUDENT' and (latest.status is null or latest.status = 'RETURNED')
        order by assignment.due_at, assignment.id
        limit 8
      ) pending
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(to_jsonb(recent) order by recent.due_at, recent.id)
      from (select * from assignments order by due_at, id limit 20) recent
    ), '[]'::jsonb)
  )
  from totals;
$$;

revoke execute on function public.lms_assignment_dashboard(uuid, text, text) from public, anon, authenticated;
grant execute on function public.lms_assignment_dashboard(uuid, text, text) to service_role;

alter table public.platform_demo_requests alter column interested_plan drop default;

create or replace function public.lms_attendance_dashboard(
  p_organization_id uuid,
  p_batch_ids uuid[],
  p_student_id text
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with daily as (
    select session.session_date as date,
      count(*) filter (where record.status = 'PRESENT') as present,
      count(*) as recorded
    from public.organization_attendance_sessions session
    join public.organization_attendance_records record
      on record.organization_id = session.organization_id and record.session_id = session.id
    where session.organization_id = p_organization_id
      and session.batch_id = any(p_batch_ids)
      and (p_student_id is null or record.student_id = p_student_id)
    group by session.session_date
  )
  select jsonb_build_object(
    'rate', (select round(sum(present) * 100 / nullif(sum(recorded), 0), 1) from daily),
    'trend', coalesce((
      select jsonb_agg(jsonb_build_object('date', date, 'rate', round(present::numeric * 100 / recorded, 1)) order by date)
      from (select * from daily order by date desc limit 14) recent
    ), '[]'::jsonb)
  );
$$;

revoke execute on function public.lms_attendance_dashboard(uuid, uuid[], text) from public, anon, authenticated;
grant execute on function public.lms_attendance_dashboard(uuid, uuid[], text) to service_role;
