-- Run against an isolated database after migrations: psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file
-- The transaction always rolls back. Never point this at production.
begin;

insert into public.institutes (id, name, slug, owner_user_id, status)
values
  ('10000000-0000-0000-0000-000000000001', 'Tenant A', 'security-test-a', 'user-owner-a', 'ACTIVE'),
  ('20000000-0000-0000-0000-000000000002', 'Tenant B', 'security-test-b', 'user-owner-b', 'ACTIVE');

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
  ('20000000-0000-0000-0000-000000000032', '20000000-0000-0000-0000-000000000002', 'student-b', 'student-b@example.com', 'STUDENT', 'ACTIVE');

insert into public.organization_member_profiles (organization_id, membership_id, display_name, roll_number)
values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000031', 'Student A', 'A-001'),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000032', 'Student B', 'B-001');

insert into public.organization_batch_members (organization_id, batch_id, user_id, role, roll_number)
values
  ('10000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000051', 'student-a', 'STUDENT', 'A-001'),
  ('20000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000052', 'student-b', 'STUDENT', 'B-001');

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
      '20000000-0000-0000-0000-000000000032',
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
end $$;

rollback;
