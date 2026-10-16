-- Run against an isolated database after migrations: psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file
-- The transaction always rolls back. Never point this at production.
begin;

insert into public.institutes (id, name, slug, owner_user_id, status)
values
  ('10000000-0000-0000-0000-000000000001', 'Tenant A', 'security-test-a', 'user-owner-a', 'ACTIVE'),
  ('20000000-0000-0000-0000-000000000002', 'Tenant B', 'security-test-b', 'user-owner-b', 'ACTIVE');

insert into public.organization_subscriptions (organization_id, plan_id, status, current_period_end)
values
  ('10000000-0000-0000-0000-000000000001', 'basic', 'ACTIVE', now() + interval '30 days'),
  ('20000000-0000-0000-0000-000000000002', 'basic', 'ACTIVE', now() + interval '30 days');

insert into public.organization_subjects (id, organization_id, name)
values
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Physics A'),
  ('20000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000002', 'Physics B');

insert into public.organization_campuses (id, organization_id, name)
values
  ('10000000-0000-0000-0000-000000000041', '10000000-0000-0000-0000-000000000001', 'Campus A'),
  ('20000000-0000-0000-0000-000000000042', '20000000-0000-0000-0000-000000000002', 'Campus B');

insert into public.organization_batches (id, organization_id, campus_id, name, target_exam)
values
  ('10000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000041', 'Batch A', 'JEE_MAIN'),
  ('20000000-0000-0000-0000-000000000052', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000042', 'Batch B', 'NEET');

insert into public.organization_campus_rooms (id, organization_id, campus_id, name, capacity)
values
  ('10000000-0000-0000-0000-000000000061', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000041', 'Room A1', 40),
  ('10000000-0000-0000-0000-000000000062', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000041', 'Room A2', 40),
  ('20000000-0000-0000-0000-000000000063', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000042', 'Room B1', 40);

insert into public.organization_room_schedules (
  id, organization_id, room_id, batch_id, faculty_id, time_slot, subject, day_of_week, starts_at, ends_at
) values (
  '10000000-0000-0000-0000-000000000071',
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000061',
  '10000000-0000-0000-0000-000000000051',
  'teacher-a', '09:00–10:00', 'Physics', 'MON', '09:00', '10:00'
);

do $$
begin
  begin
    insert into public.organization_room_schedules (
      organization_id, room_id, batch_id, faculty_id, time_slot, subject, day_of_week, starts_at, ends_at
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000062',
      '10000000-0000-0000-0000-000000000051',
      'teacher-b', '09:30–10:30', 'Chemistry', 'MON', '09:30', '10:30'
    );
    raise exception 'Timetable guard failed to reject an overlapping batch slot';
  exception when exclusion_violation then
    null;
  end;

  begin
    insert into public.organization_room_schedules (
      organization_id, room_id, batch_id, faculty_id, time_slot, subject, day_of_week, starts_at, ends_at
    ) values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000063',
      '10000000-0000-0000-0000-000000000051',
      'teacher-a', '11:00–12:00', 'Physics', 'MON', '11:00', '12:00'
    );
    raise exception 'Composite tenant constraint failed to reject a cross-tenant room schedule';
  exception when foreign_key_violation then
    null;
  end;
end $$;

insert into public.organization_invitations (
  id, organization_id, email, role, token_hash, idempotency_key, invited_by, expires_at
) values (
  '10000000-0000-0000-0000-000000000099',
  '10000000-0000-0000-0000-000000000001',
  'student@example.com',
  'STUDENT',
  repeat('a', 64),
  'security-test-invitation',
  'user-owner-a',
  now() + interval '7 days'
);

insert into public.institute_members (id, institute_id, user_id, email, role, status)
values
  ('10000000-0000-0000-0000-000000000031', '10000000-0000-0000-0000-000000000001', 'student-a', 'student-a@example.com', 'STUDENT', 'ACTIVE'),
  ('20000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000002', 'student-b', 'student-b@example.com', 'STUDENT', 'ACTIVE'),
  ('20000000-0000-0000-0000-000000000033', '20000000-0000-0000-0000-000000000002', 'student-b2', 'student-b2@example.com', 'STUDENT', 'ACTIVE');

insert into public.organization_member_profiles (organization_id, membership_id, display_name, roll_number)
values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000031', 'Student A', 'A-001'),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000032', 'Student B', 'B-001');

insert into public.organization_batch_members (organization_id, batch_id, user_id, role, roll_number)
values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000051', 'student-a', 'STUDENT', 'A-001'),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000052', 'student-b', 'STUDENT', 'B-001');

insert into public.organization_leads (
  id, organization_id, name, phone, target_exam, target_batch_id, source, stage
) values
  ('10000000-0000-0000-0000-0000000000a3', '10000000-0000-0000-0000-000000000001', 'Lead A', '9000000001', 'JEE_MAIN', '10000000-0000-0000-0000-000000000051', 'WALK_IN', 'NEW'),
  ('20000000-0000-0000-0000-0000000000a4', '20000000-0000-0000-0000-000000000002', 'Lead B', '9000000002', 'NEET', '20000000-0000-0000-0000-000000000052', 'WEBSITE', 'NEW');

do $$
begin
  begin
    perform public.lms_crm_mutation(
      '10000000-0000-0000-0000-000000000001', 'student-a', 'STUDENT', 'UPDATE_STAGE',
      '{"leadId":"10000000-0000-0000-0000-0000000000a3","stage":"CONTACTED"}'::jsonb
    );
    raise exception 'CRM mutation failed to reject a student actor';
  exception when insufficient_privilege then
    null;
  end;
  begin
    perform public.lms_crm_mutation(
      '10000000-0000-0000-0000-000000000001', 'user-owner-a', 'OWNER', 'CREATE_LEAD',
      '{"name":"Cross tenant","phone":"9000000003","targetExam":"NEET","targetBatchId":"20000000-0000-0000-0000-000000000052","source":"WALK_IN","estimatedFeePaise":0}'::jsonb
    );
    raise exception 'CRM mutation failed to reject a cross-tenant batch';
  exception when foreign_key_violation then
    null;
  end;
end $$;

insert into public.organization_courses (id, organization_id, subject_id, title, status, created_by)
values
  ('10000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011', 'Course A', 'PUBLISHED', 'user-owner-a'),
  ('20000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000022', 'Course B', 'PUBLISHED', 'user-owner-b');

insert into public.organization_course_batches (organization_id, course_id, batch_id)
values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000081', '10000000-0000-0000-0000-000000000051'),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000082', '20000000-0000-0000-0000-000000000052');

insert into public.organization_course_modules (id, organization_id, course_id, title, is_published)
values
  ('10000000-0000-0000-0000-000000000091', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000081', 'Module A', true),
  ('20000000-0000-0000-0000-000000000092', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000082', 'Module B', true);

insert into public.organization_course_lessons (id, organization_id, module_id, title, kind, is_published)
values
  ('10000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000091', 'Lesson A', 'DOCUMENT', true),
  ('20000000-0000-0000-0000-0000000000a2', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000092', 'Lesson B', 'DOCUMENT', true);

insert into public.organization_lesson_resources (
  id, organization_id, lesson_id, name, resource_type, storage_bucket, storage_path, mime_type, byte_size, sha256, created_by
) values (
  '10000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000a1',
  'Notes A', 'FILE', 'organization-learning', 'organizations/10000000-0000-0000-0000-000000000001/notes-a.pdf', 'application/pdf', 10, repeat('c', 64), 'user-owner-a'
);

insert into public.organization_assignments (
  id, organization_id, title, instructions, course_id, due_at, max_marks, status, created_by
) values
  ('10000000-0000-0000-0000-0000000000c1', '10000000-0000-0000-0000-000000000001', 'Assignment A', 'Solve A', '10000000-0000-0000-0000-000000000081', now() + interval '1 day', 10, 'PUBLISHED', 'user-owner-a'),
  ('20000000-0000-0000-0000-0000000000c2', '20000000-0000-0000-0000-000000000002', 'Assignment B', 'Solve B', '20000000-0000-0000-0000-000000000082', now() + interval '1 day', 10, 'PUBLISHED', 'user-owner-b');

insert into public.organization_assignment_submissions (
  id, organization_id, assignment_id, student_user_id, attempt_number, text_response, status
) values (
  '10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-0000000000c1', 'student-a', 1, 'Answer A', 'SUBMITTED'
);

insert into public.organization_assignment_submission_files (
  id, organization_id, submission_id, name, storage_bucket, storage_path, mime_type, byte_size, sha256
) values (
  '10000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-0000000000d1', 'Answer A.pdf', 'organization-submissions',
  'organizations/10000000-0000-0000-0000-000000000001/answer-a.pdf', 'application/pdf', 10, repeat('e', 64)
);

insert into public.institute_tests (
  id, institute_id, title, exam, subject, chapters, difficulty, duration_minutes,
  total_questions, status, created_by, max_attempts, result_release_policy, solution_release_policy
) values
  ('10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-000000000001', 'Assessment A', 'JEE_MAIN', 'Physics', '{}', 'medium', 60, 1, 'PUBLISHED', 'teacher-a', 1, 'IMMEDIATE', 'AFTER_WINDOW'),
  ('20000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-000000000002', 'Assessment B', 'NEET', 'Physics', '{}', 'medium', 60, 1, 'PUBLISHED', 'teacher-b', 1, 'IMMEDIATE', 'AFTER_WINDOW');

insert into public.organization_test_schedules (
  id, organization_id, test_id, batch_id, starts_at, ends_at
) values
  ('10000000-0000-0000-0000-0000000000f3', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-000000000051', now() - interval '1 hour', now() + interval '1 hour'),
  ('20000000-0000-0000-0000-0000000000f4', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-000000000052', now() - interval '1 hour', now() + interval '1 hour');

insert into public.organization_assessment_attempts (
  id, organization_id, test_id, schedule_id, user_id, attempt_number, expires_at
) values
  ('10000000-0000-0000-0000-0000000000f5', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000f1', '10000000-0000-0000-0000-0000000000f3', 'student-a', 1, now() + interval '30 minutes'),
  ('20000000-0000-0000-0000-0000000000f6', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000f2', '20000000-0000-0000-0000-0000000000f4', 'student-b', 1, now() + interval '30 minutes');

insert into public.organization_attendance_sessions (
  id, organization_id, batch_id, session_date, session_label, starts_at, ends_at, marked_by, finalized_at
) values
  ('10000000-0000-0000-0000-0000000000f7', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000051', current_date, 'Physics', '09:00', '10:00', 'teacher-a', now()),
  ('20000000-0000-0000-0000-0000000000f8', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000052', current_date, 'Physics', '09:00', '10:00', 'teacher-b', now());

insert into public.organization_attendance_records (
  id, organization_id, session_id, student_id, status
) values
  ('10000000-0000-0000-0000-0000000000f9', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000f7', 'student-a', 'PRESENT'),
  ('20000000-0000-0000-0000-0000000000fa', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000f8', 'student-b', 'ABSENT');

insert into public.organization_attendance_corrections (
  id, organization_id, session_id, attendance_record_id, student_id, previous_status, corrected_status, reason, corrected_by
) values
  ('10000000-0000-0000-0000-0000000000fb', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-0000000000f7', '10000000-0000-0000-0000-0000000000f9', 'student-a', 'ABSENT', 'PRESENT', 'Entry corrected', 'teacher-a'),
  ('20000000-0000-0000-0000-0000000000fc', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-0000000000f8', '20000000-0000-0000-0000-0000000000fa', 'student-b', 'PRESENT', 'ABSENT', 'Entry corrected', 'teacher-b');

insert into public.organization_fee_plans (
  id, organization_id, name, target_exam, total_amount, installment_count
) values
  ('10000000-0000-0000-0000-000000001101', '10000000-0000-0000-0000-000000000001', 'Fee Plan A', 'JEE_MAIN', 1000, 1),
  ('20000000-0000-0000-0000-000000002201', '20000000-0000-0000-0000-000000000002', 'Fee Plan B', 'NEET', 1000, 1);

insert into public.organization_fee_plan_installments (
  organization_id, fee_plan_id, sequence_number, title, amount, due_date
) values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000001101', 1, 'Term 1', 1000, current_date),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000002201', 1, 'Term 1', 1000, current_date);

insert into public.organization_student_fees (
  id, organization_id, student_id, batch_id, fee_plan_id, total_course_fee, concession_amount, net_payable, status
) values
  ('10000000-0000-0000-0000-000000001102', '10000000-0000-0000-0000-000000000001', 'student-a', '10000000-0000-0000-0000-000000000051', '10000000-0000-0000-0000-000000001101', 1000, 0, 1000, 'PARTIAL'),
  ('20000000-0000-0000-0000-000000002202', '20000000-0000-0000-0000-000000000002', 'student-b', '20000000-0000-0000-0000-000000000052', '20000000-0000-0000-0000-000000002201', 1000, 0, 1000, 'UNPAID');

insert into public.organization_fee_installments (
  id, organization_id, student_fee_id, title, amount, due_date, status, paid_amount
) values
  ('10000000-0000-0000-0000-000000001103', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000001102', 'Term 1', 1000, current_date, 'PARTIAL', 500),
  ('20000000-0000-0000-0000-000000002203', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000002202', 'Term 1', 1000, current_date, 'PENDING', 0);

insert into public.organization_fee_transactions (
  id, organization_id, student_fee_id, installment_id, student_id, amount, method, reference_number,
  receipt_number, installment_title, recorded_by, transaction_type
) values (
  '10000000-0000-0000-0000-000000001104', '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000001102', '10000000-0000-0000-0000-000000001103',
  'student-a', 500, 'UPI', 'security-payment-a', 'REC-SECURITY-A', 'Term 1', 'user-owner-a', 'PAYMENT'
);

insert into public.organization_fee_invoices (
  id, organization_id, student_fee_id, student_id, invoice_number, amount, due_date, status
) values
  ('10000000-0000-0000-0000-000000001105', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000001102', 'student-a', 'INV-SECURITY-A', 1000, current_date, 'PARTIAL'),
  ('20000000-0000-0000-0000-000000002205', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000002202', 'student-b', 'INV-SECURITY-B', 1000, current_date, 'ISSUED');

insert into public.organization_branding (organization_id, primary_color, subdomain, updated_by)
values
  ('10000000-0000-0000-0000-000000000001', '#0B132B', 'security-test-a', 'user-owner-a'),
  ('20000000-0000-0000-0000-000000000002', '#112233', 'security-test-b', 'user-owner-b');

insert into public.organization_announcements (
  id, organization_id, title, content, target_audience, priority, category, status, channels, created_by, published_at
) values
  ('10000000-0000-0000-0000-000000001201', '10000000-0000-0000-0000-000000000001', 'Notice A', 'Tenant A notice', 'ALL', 'NORMAL', 'GENERAL', 'PUBLISHED', array['PORTAL'], 'user-owner-a', now()),
  ('20000000-0000-0000-0000-000000002201', '20000000-0000-0000-0000-000000000002', 'Notice B', 'Tenant B notice', 'ALL', 'NORMAL', 'GENERAL', 'PUBLISHED', array['PORTAL'], 'user-owner-b', now());

insert into public.organization_notifications (
  id, organization_id, announcement_id, recipient_user_id, kind, title, body
) values
  ('10000000-0000-0000-0000-000000001202', '10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000001201', 'student-a', 'ANNOUNCEMENT', 'Notice A', 'Tenant A notice'),
  ('20000000-0000-0000-0000-000000002202', '20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000002201', 'student-b', 'ANNOUNCEMENT', 'Notice B', 'Tenant B notice');

insert into public.organization_ai_drafts (
  organization_id, request_id, feature, status, input_hash, source_references, output, model, prompt_version, created_by
) values
  ('10000000-0000-0000-0000-000000000001', 'security-ai-a', 'ANNOUNCEMENT_DRAFT', 'DRAFT', repeat('a', 64), '[]', '{"title":"Draft A","content":"Draft"}', 'test-model', 'test-v1', 'teacher-a'),
  ('20000000-0000-0000-0000-000000000002', 'security-ai-b', 'ANNOUNCEMENT_DRAFT', 'DRAFT', repeat('b', 64), '[]', '{"title":"Draft B","content":"Draft"}', 'test-model', 'test-v1', 'teacher-b');

do $$
declare
  first_result jsonb;
  replay_result jsonb;
begin
  select public.lms_consume_quota(
    '10000000-0000-0000-0000-000000000001', 'AI_CREDITS', 1,
    'security-test-ai-credit-0001', 'assessment-generator', 'user-owner-a'
  ) into first_result;
  select public.lms_consume_quota(
    '10000000-0000-0000-0000-000000000001', 'AI_CREDITS', 1,
    'security-test-ai-credit-0001', 'assessment-generator', 'user-owner-a'
  ) into replay_result;
  if (select quantity from public.organization_usage_counters
      where organization_id = '10000000-0000-0000-0000-000000000001' and metric = 'AI_CREDITS') <> 1 then
    raise exception 'Quota idempotency failure: replay consumed usage twice';
  end if;
  if coalesce((replay_result ->> 'idempotent')::boolean, false) is not true then
    raise exception 'Quota idempotency failure: replay was not reported';
  end if;
end $$;

do $$
begin
  begin
    insert into public.organization_lesson_resources (
      organization_id, lesson_id, name, resource_type, storage_bucket, storage_path, mime_type, byte_size, sha256, created_by
    ) values (
      '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000a1',
      'Cross-tenant notes', 'FILE', 'organization-learning', 'cross-tenant.pdf', 'application/pdf', 10, repeat('d', 64), 'user-owner-b'
    );
    raise exception 'Composite tenant constraint failed to reject a cross-tenant lesson resource';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into public.organization_assignment_submissions (
      organization_id, assignment_id, student_user_id, attempt_number, text_response, status
    ) values (
      '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-0000000000c1',
      'student-b', 1, 'Cross-tenant answer', 'SUBMITTED'
    );
    raise exception 'Composite tenant constraint failed to reject a cross-tenant assignment submission';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into public.organization_assessment_attempts (
      organization_id, test_id, schedule_id, user_id, attempt_number, expires_at
    ) values (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-0000000000f1',
      '20000000-0000-0000-0000-0000000000f4',
      'student-b', 2, now() + interval '30 minutes'
    );
    raise exception 'Composite tenant constraint failed to reject a cross-tenant assessment attempt';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into public.organization_attendance_records (
      organization_id, session_id, student_id, status
    ) values (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-0000000000f7',
      'student-b', 'PRESENT'
    );
    raise exception 'Composite tenant constraint failed to reject a cross-tenant attendance record';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into public.organization_fee_invoices (
      organization_id, student_fee_id, student_id, invoice_number, amount, due_date
    ) values (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000001102',
      'student-b', 'INV-CROSS-TENANT', 1000, current_date
    );
    raise exception 'Composite tenant constraint failed to reject a cross-tenant fee invoice';
  exception when foreign_key_violation then
    null;
  end;

  begin
    insert into public.organization_notifications (
      organization_id, announcement_id, recipient_user_id, kind, title, body
    ) values (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000001201',
      'student-b', 'ANNOUNCEMENT', 'Cross tenant', 'Cross tenant'
    );
    raise exception 'Composite tenant constraint failed to reject a cross-tenant notification';
  exception when foreign_key_violation then
    null;
  end;
end $$;

insert into public.organization_member_imports (
  id, organization_id, idempotency_key, request_hash, file_name, member_role,
  status, total_rows, valid_rows, invalid_rows, created_by
) values (
  '10000000-0000-0000-0000-000000000098',
  '10000000-0000-0000-0000-000000000001',
  'security-test-import',
  repeat('b', 64),
  'students.csv',
  'STUDENT',
  'VALIDATED',
  1,
  1,
  0,
  'user-owner-a'
);

insert into public.organization_member_import_rows (
  organization_id, import_id, row_number, raw_data, normalized_data, status
) values (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000098',
  2,
  '{"name":"Imported Student"}'::jsonb,
  '{"displayName":"Imported Student","email":"import@example.com"}'::jsonb,
  'VALID'
);

do $$
begin
  begin
    insert into public.organization_member_import_rows (
      organization_id, import_id, row_number, raw_data, normalized_data, status
    ) values (
      '20000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000098',
      3,
      '{}'::jsonb,
      '{}'::jsonb,
      'VALID'
    );
    raise exception 'Composite tenant constraint failed to reject cross-tenant import row';
  exception when foreign_key_violation then
    null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user-owner-a","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.organization_subjects) <> 1 then
    raise exception 'RLS failure: tenant A can see rows outside its organization';
  end if;
  if exists (
    select 1 from public.organization_subjects
    where organization_id = '20000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'RLS failure: tenant B subject leaked to tenant A';
  end if;
  if (select count(*) from public.organization_invitations) <> 0 then
    raise exception 'RLS failure: browser role can read service-only invitation records';
  end if;
  if (select count(*) from public.organization_member_profiles) <> 1 then
    raise exception 'RLS failure: tenant A can see member profiles outside its organization';
  end if;
  if (select count(*) from public.organization_member_imports) <> 0
    or (select count(*) from public.organization_member_import_rows) <> 0 then
    raise exception 'RLS failure: browser role can read service-only member import PII';
  end if;
  if (select count(*) from public.organization_usage_counters) <> 1
    or (select count(*) from public.organization_branding) <> 1 then
    raise exception 'SaaS RLS failure: owner can see another tenant usage or branding';
  end if;
  if (select count(*) from public.platform_feature_flags) <> 0 then
    raise exception 'Platform RLS failure: tenant browser role can read internal feature flags';
  end if;
  if (select count(*) from public.organization_announcements) <> 1
    or (select count(*) from public.organization_ai_drafts) <> 1 then
    raise exception 'Communications RLS failure: owner can see another tenant announcement or AI draft';
  end if;
  if (select count(*) from public.organization_leads) <> 1 then
    raise exception 'CRM RLS failure: owner can see another tenant lead';
  end if;
end $$;

do $$
begin
  begin
    insert into public.organization_courses (organization_id, subject_id, title, created_by)
    values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000022',
      'Cross-tenant course',
      'user-owner-a'
    );
    raise exception 'Composite tenant constraint failed to reject cross-tenant subject';
  exception when foreign_key_violation then
    null;
  end;
end $$;

do $$
begin
  begin
    insert into public.organization_member_profiles (organization_id, membership_id, display_name)
    values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000033',
      'Cross-tenant profile'
    );
    raise exception 'Composite tenant constraint failed to reject cross-tenant profile';
  exception when foreign_key_violation then
    null;
  end;
end $$;

select set_config('request.jwt.claims', '{"sub":"student-a","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.organization_course_modules) <> 1 then
    raise exception 'Learning RLS failure: student can see unassigned or cross-tenant modules';
  end if;
  if (select count(*) from public.organization_course_lessons) <> 1 then
    raise exception 'Learning RLS failure: student can see unassigned or cross-tenant lessons';
  end if;
  if (select count(*) from public.organization_lesson_resources) <> 1 then
    raise exception 'Learning RLS failure: student can see cross-tenant resources';
  end if;
  if (select count(*) from public.organization_assignments) <> 1 then
    raise exception 'Assignment RLS failure: student can see unassigned or cross-tenant assignments';
  end if;
  if (select count(*) from public.organization_assignment_submissions) <> 1 then
    raise exception 'Assignment RLS failure: student can see another student submission';
  end if;
  if (select count(*) from public.organization_assignment_submission_files) <> 1 then
    raise exception 'Assignment RLS failure: student cannot see only their own submission files';
  end if;
  if (select count(*) from public.organization_assessment_attempts) <> 1 then
    raise exception 'Assessment RLS failure: student can see another student attempt';
  end if;
  if (select count(*) from public.organization_attendance_sessions) <> 1
    or (select count(*) from public.organization_attendance_records) <> 1
    or (select count(*) from public.organization_attendance_corrections) <> 1 then
    raise exception 'Attendance RLS failure: student can see another tenant or student history';
  end if;
  if (select count(*) from public.organization_student_fees) <> 1
    or (select count(*) from public.organization_fee_installments) <> 1
    or (select count(*) from public.organization_fee_transactions) <> 1
    or (select count(*) from public.organization_fee_invoices) <> 1 then
    raise exception 'Finance RLS failure: student can see another tenant or student ledger';
  end if;
  if (select count(*) from public.organization_usage_counters) <> 0
    or (select count(*) from public.organization_usage_events) <> 0
    or (select count(*) from public.organization_branding) <> 1 then
    raise exception 'SaaS RLS failure: student usage or branding visibility is incorrect';
  end if;
  if (select count(*) from public.organization_announcements) <> 1
    or (select count(*) from public.organization_notifications) <> 1
    or (select count(*) from public.organization_ai_drafts) <> 0 then
    raise exception 'Communications RLS failure: student visibility is incorrect';
  end if;
  if (select count(*) from public.organization_leads) <> 0 then
    raise exception 'CRM RLS failure: student can read admissions leads';
  end if;
end $$;

reset role;
select set_config('request.jwt.claims', '', true);

-- Phase 8 tests: Guardian linking & parent scope
insert into public.organization_guardian_links (
  organization_id, guardian_user_id, student_user_id, relationship, status
) values
  ('10000000-0000-0000-0000-000000000001', 'parent-a', 'student-a', 'MOTHER', 'APPROVED'),
  ('20000000-0000-0000-0000-000000000002', 'parent-b', 'student-b', 'FATHER', 'PENDING_REVIEW');

-- Descriptive assessment submission
insert into public.organization_descriptive_submissions (
  id, organization_id, attempt_id, test_id, question_id, student_user_id, answer_text, max_marks
) values (
  '10000000-0000-0000-0000-0000000000d1', '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-0000000000f5', '10000000-0000-0000-0000-0000000000f1',
  '10000000-0000-0000-0000-0000000000b1', 'student-a', 'Detailed derivation of rotational dynamics', 10.0
);

-- Evaluate descriptive submission
select public.lms_grade_descriptive_submission(
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-0000000000d1',
  'teacher-a', 'TEACHER', 8.5, 'Good physical reasoning; minor algebraic flaw'
);

-- AI draft promotion
select public.lms_promote_ai_draft(
  '10000000-0000-0000-0000-000000000001',
  (select id from public.organization_ai_drafts where organization_id = '10000000-0000-0000-0000-000000000001' limit 1),
  'user-owner-a', 'OWNER', 'APPROVE_AND_PUBLISH'
);

-- Test parent-a access (approved guardian of student-a)
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"parent-a","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.organization_attendance_records) <> 1 then
    raise exception 'Guardian RLS failure: approved guardian should see exactly their child attendance record';
  end if;
  if exists (select 1 from public.organization_attendance_records where student_id <> 'student-a') then
    raise exception 'Guardian RLS failure: parent saw another student attendance';
  end if;
  if (select count(*) from public.organization_student_fees) <> 1 then
    raise exception 'Guardian RLS failure: approved guardian should see exactly their child fee record';
  end if;
  if exists (select 1 from public.organization_student_fees where student_id <> 'student-a') then
    raise exception 'Guardian RLS failure: parent saw another student fee ledger';
  end if;
end $$;

-- Test parent-b access (pending review guardian)
select set_config('request.jwt.claims', '{"sub":"parent-b","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.organization_attendance_records) <> 0 then
    raise exception 'Guardian RLS failure: unapproved guardian cannot view attendance';
  end if;
  if (select count(*) from public.organization_student_fees) <> 0 then
    raise exception 'Guardian RLS failure: unapproved guardian cannot view fee ledger';
  end if;
end $$;

rollback;

