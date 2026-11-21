-- Run in an isolated database after migrations.
begin;

insert into public.institutes (id, name, slug, owner_user_id)
values
  ('c0000001-0000-0000-0000-000000000001', 'Dynamic A', 'dynamic-a', 'owner-a'),
  ('c0000002-0000-0000-0000-000000000001', 'Dynamic B', 'dynamic-b', 'owner-b');

insert into public.organization_batches (id, organization_id, name, target_exam)
values
  ('c0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'Batch A', 'OTHER'),
  ('c0000002-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000001', 'Batch B', 'OTHER');

insert into public.organization_batch_members (organization_id, batch_id, user_id, role)
values ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', 'student-a', 'STUDENT');

insert into public.organization_courses (id, organization_id, title, created_by)
values ('c0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001', 'Course A', 'owner-a');

insert into public.organization_course_batches (organization_id, course_id, batch_id)
values ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000002');

insert into public.organization_assignments (id, organization_id, title, instructions, course_id, due_at, max_marks, status, created_by)
values ('c0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', 'Course work', 'Submit work', 'c0000001-0000-0000-0000-000000000003', now() + interval '1 day', 10, 'PUBLISHED', 'owner-a');

insert into public.organization_assignments (id, organization_id, title, instructions, student_user_id, due_at, max_marks, status, created_by)
values
  ('c0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000001', 'Returned work', 'Submit work', 'student-a', now() + interval '1 day', 10, 'PUBLISHED', 'owner-a'),
  ('c0000002-0000-0000-0000-000000000004', 'c0000002-0000-0000-0000-000000000001', 'Other workspace work', 'Submit work', 'student-a', now() + interval '1 day', 10, 'PUBLISHED', 'owner-b');

insert into public.organization_assignment_submissions (organization_id, assignment_id, student_user_id, attempt_number, status)
values
  ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000004', 'student-a', 1, 'RETURNED'),
  ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000004', 'student-a', 2, 'LATE'),
  ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000004', 'student-a', 3, 'GRADED'),
  ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000005', 'student-a', 1, 'SUBMITTED'),
  ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000005', 'student-a', 2, 'RETURNED');

insert into public.organization_attendance_sessions (id, organization_id, batch_id, session_date, marked_by, session_label)
values
  ('c0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', current_date, 'owner-a', 'First class'),
  ('c0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000002', current_date, 'owner-a', 'Second class'),
  ('c0000002-0000-0000-0000-000000000007', 'c0000002-0000-0000-0000-000000000001', 'c0000002-0000-0000-0000-000000000002', current_date, 'owner-b', 'Other workspace class');

insert into public.organization_attendance_records (organization_id, session_id, student_id, status)
values
  ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000006', 'student-a', 'PRESENT'),
  ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000006', 'student-b', 'PRESENT'),
  ('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000007', 'student-a', 'ABSENT'),
  ('c0000002-0000-0000-0000-000000000001', 'c0000002-0000-0000-0000-000000000007', 'student-a', 'PRESENT');

insert into public.questions (exam, subject, question_text)
values ('OTHER', 'Dynamic Geography', 'Question one'), ('OTHER', 'Dynamic Geography', 'Question two');

do $$
declare
  org_a constant uuid := 'c0000001-0000-0000-0000-000000000001';
  batches constant uuid[] := array['c0000001-0000-0000-0000-000000000002', 'c0000002-0000-0000-0000-000000000002']::uuid[];
  assignments jsonb;
  attendance jsonb;
begin
  assignments := public.lms_assignment_dashboard(org_a, 'student-a', 'STUDENT');
  if not (assignments @> '{"assignmentCount":2,"submittedCount":1,"assignmentsWithSubmissions":1,"pendingAssignments":[{"title":"Returned work"}]}') then
    raise exception 'Incorrect student assignment rollup: %', assignments;
  end if;
  attendance := public.lms_attendance_dashboard(org_a, batches, 'student-a');
  if not (attendance @> '{"rate":50,"trend":[{"rate":50}]}') or jsonb_array_length(attendance->'trend') <> 1 then
    raise exception 'Incorrect student daily attendance rollup: %', attendance;
  end if;
  if (select count(*) from public.lms_question_bank_subjects() where subject = 'Dynamic Geography') <> 1 then
    raise exception 'Question subject catalog omitted or duplicated a subject';
  end if;
  if has_function_privilege('authenticated', 'public.lms_assignment_dashboard(uuid,text,text)', 'execute')
    or has_function_privilege('anon', 'public.lms_attendance_dashboard(uuid,uuid[],text)', 'execute')
    or has_function_privilege('authenticated', 'public.lms_question_bank_subjects()', 'execute') then
    raise exception 'Browser role can execute service-only dashboard or catalog query';
  end if;
end
$$;

rollback;
