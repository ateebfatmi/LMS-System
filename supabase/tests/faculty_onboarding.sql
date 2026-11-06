-- Run after migrations on a disposable PostgreSQL database.
begin;

do $$
declare
  tenant uuid;
  other_tenant uuid;
  first_batch uuid;
  second_batch uuid;
  unassigned_batch uuid;
  foreign_batch uuid;
  teacher uuid;
  legacy_teacher uuid;
  campus uuid;
  room uuid;
  profile jsonb := '{"displayName":"Faculty Test Teacher","email":"faculty-teacher@example.invalid","phone":"1234567890","subjectSpecialization":"Physics"}';
  directory jsonb;
  invite jsonb;
  retry jsonb;
  accepted record;
  import_job record;
  committed record;
  expires_at timestamptz := now() + interval '7 days';
begin
  select id into tenant from public.lms_create_institute(
    'faculty-owner', 'faculty-owner@example.invalid', 'Faculty Test Institute', 'faculty-test-one', 'COACHING', '9876543210', 'Kota', 'Rajasthan');
  select id into other_tenant from public.lms_create_institute(
    'faculty-other-owner', 'other-owner@example.invalid', 'Other Faculty Institute', 'faculty-test-two', 'COACHING', '9876543210', 'Kota', 'Rajasthan');
  insert into public.organization_batches (organization_id, name, target_exam)
    values (tenant, 'Morning Physics', 'JEE_MAIN') returning id into first_batch;
  insert into public.organization_batches (organization_id, name, target_exam)
    values (tenant, 'Evening Physics', 'JEE_MAIN') returning id into second_batch;
  insert into public.organization_batches (organization_id, name, target_exam)
    values (tenant, 'Unassigned Physics', 'JEE_MAIN') returning id into unassigned_batch;
  insert into public.organization_batches (organization_id, name, target_exam)
    values (other_tenant, 'Other institute batch', 'JEE_MAIN') returning id into foreign_batch;

  begin
    perform public.lms_save_faculty(tenant, 'faculty-coordinator', 'ACADEMIC_COORDINATOR', null, profile, array[first_batch]);
    raise exception 'A read-only faculty directory user created a teacher';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.lms_save_faculty(tenant, 'faculty-owner', 'OWNER', null, profile, array[foreign_batch]);
    raise exception 'Foreign batch was accepted';
  exception when foreign_key_violation then null;
  end;
  if exists (select 1 from public.institute_members where institute_id = tenant and email = profile ->> 'email') then
    raise exception 'The rejected create left a partial membership';
  end if;

  teacher := public.lms_save_faculty(tenant, 'faculty-owner', 'OWNER', null, profile, array[first_batch, second_batch, first_batch]);
  directory := public.lms_list_faculty(tenant, 'physics', second_batch, 25, 0, null);
  if (directory ->> 'total')::int is distinct from 1
    or directory #>> '{teachers,0,status}' is distinct from 'PENDING'
    or jsonb_array_length(directory #> '{teachers,0,batches}') is distinct from 2 then
    raise exception 'Pending teacher or multiple assignments were not recorded: %', directory;
  end if;
  if exists (select 1 from public.institute_members where id = teacher and user_id is not null)
    or exists (select 1 from public.organization_batch_members where pending_teacher_id = teacher and user_id is not null) then
    raise exception 'A pending teacher was linked to an account before verification';
  end if;
  begin
    perform public.lms_save_faculty(tenant, 'faculty-owner', 'OWNER', null, profile || '{"email":"FACULTY-TEACHER@example.invalid"}', '{}');
    raise exception 'Duplicate case-insensitive email created a new teacher';
  exception when unique_violation then null;
  end;
  begin
    perform public.lms_save_faculty(other_tenant, 'faculty-other-owner', 'OWNER', teacher, null, array[foreign_batch]);
    raise exception 'Teacher from another institute was updated';
  exception when no_data_found then null;
  end;

  invite := public.lms_invite_faculty(tenant, 'faculty-owner', 'OWNER', teacher, profile ->> 'email',
    repeat('e',64), 'faculty-first-invite', expires_at);
  retry := public.lms_invite_faculty(tenant, 'faculty-owner', 'OWNER', teacher, profile ->> 'email',
    repeat('e',64), 'faculty-first-invite', expires_at);
  if invite ->> 'invitation_id' is distinct from retry ->> 'invitation_id' then raise exception 'Invite retry was not idempotent'; end if;
  begin
    perform public.lms_invite_faculty(tenant, 'faculty-owner', 'OWNER', teacher, profile ->> 'email',
      repeat('f',64), 'faculty-duplicate-invite', expires_at);
    raise exception 'Second pending invitation was created';
  exception when unique_violation then null;
  end;
  if public.lms_list_faculty(tenant, '', null, 1, 0, teacher) #>> '{teachers,0,status}' is distinct from 'INVITED' then
    raise exception 'An open invitation did not change the directory status';
  end if;
  begin
    perform public.lms_save_faculty(tenant, 'faculty-owner', 'OWNER', teacher, profile || '{"email":"different@example.invalid"}', null);
    raise exception 'Email changed with an open invitation';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.lms_accept_invitation(repeat('e',64), 'user_faculty_wrong', 'wrong@example.invalid');
    raise exception 'The wrong email accepted the invitation';
  exception when no_data_found then null;
  end;

  select * into accepted from public.lms_accept_invitation(repeat('e',64), 'user_faculty_verified', upper(profile ->> 'email'));
  if accepted.invitation_status is distinct from 'ACCEPTED' or accepted.membership_role is distinct from 'TEACHER'
    or not exists (select 1 from public.institute_members where id = teacher and user_id = 'user_faculty_verified' and status = 'ACTIVE')
    or (select count(*) from public.organization_batch_members where organization_id = tenant and user_id = 'user_faculty_verified') <> 2
    or exists (select 1 from public.organization_batch_members where pending_teacher_id = teacher)
    or public.lms_list_faculty(tenant, '', null, 1, 0, teacher) #>> '{teachers,0,status}' is distinct from 'ACTIVE' then
    raise exception 'Acceptance did not activate the same teacher with their two batches';
  end if;
  begin
    perform public.lms_invite_faculty(tenant, 'faculty-owner', 'OWNER', teacher, profile ->> 'email',
      repeat('f',64), 'faculty-invite-active', expires_at);
    raise exception 'Active account could be invited again';
  exception when insufficient_privilege then null;
  end;

  perform set_config('request.jwt.claims', '{"sub":"user_faculty_verified","role":"authenticated"}', true);
  if not public.is_assigned_institute_teacher(tenant, first_batch)
    or not public.is_assigned_institute_teacher(tenant, second_batch)
    or public.is_assigned_institute_teacher(tenant, unassigned_batch)
    or public.is_assigned_institute_teacher(other_tenant, foreign_batch) then
    raise exception 'Verified teacher batch authorization is incorrect';
  end if;

  perform public.lms_save_faculty(tenant, 'faculty-owner', 'OWNER', teacher, null, array[second_batch]);
  if public.is_assigned_institute_teacher(tenant, first_batch) then raise exception 'Removed batch still grants access'; end if;

  insert into public.institute_members (institute_id, user_id, email, role, status)
    values (tenant, 'usr_' || repeat('0',32), 'legacy-teacher@example.invalid', 'TEACHER', 'ACTIVE') returning id into legacy_teacher;
  insert into public.organization_batch_members (organization_id, batch_id, user_id, role)
    values (tenant, first_batch, 'usr_' || repeat('0',32), 'TEACHER');
  insert into public.organization_campuses (organization_id, name) values (tenant, 'Faculty Campus') returning id into campus;
  insert into public.organization_campus_rooms (organization_id, campus_id, name, capacity)
    values (tenant, campus, 'Physics room', 20) returning id into room;
  insert into public.organization_room_schedules (organization_id, room_id, batch_id, faculty_id, subject, day_of_week, time_slot, starts_at, ends_at)
    values (tenant, room, first_batch, 'usr_' || repeat('0',32), 'Physics', 'MON', '09:00–10:00', '09:00', '10:00');
  if public.lms_list_faculty(tenant, '', null, 1, 0, legacy_teacher) #>> '{teachers,0,status}' is distinct from 'PENDING' then
    raise exception 'Legacy placeholder was shown as an active account';
  end if;
  perform public.lms_invite_faculty(tenant, 'faculty-owner', 'OWNER', legacy_teacher, 'legacy-teacher@example.invalid',
    repeat('f',64), 'faculty-legacy-invite', expires_at);
  perform public.lms_accept_invitation(repeat('f',64), 'user_faculty_legacy', 'legacy-teacher@example.invalid');
  if not exists (select 1 from public.institute_members where id = legacy_teacher and user_id = 'user_faculty_legacy')
    or not exists (select 1 from public.organization_batch_members where batch_id = first_batch and user_id = 'user_faculty_legacy')
    or exists (select 1 from public.organization_batch_members where batch_id = first_batch and user_id = 'usr_' || repeat('0',32))
    or not exists (select 1 from public.organization_room_schedules where room_id = room and faculty_id = 'user_faculty_legacy')
    or public.lms_list_faculty(tenant, '', null, 1, 0, legacy_teacher) #>> '{teachers,0,schedule,0,subject}' is distinct from 'Physics' then
    raise exception 'Legacy profile or assignment was lost on activation';
  end if;

  select * into import_job from public.lms_stage_member_import(
    tenant, 'faculty-owner', 'OWNER', 'faculty-invalid-csv', repeat('a',64), 'invalid.csv', 'TEACHER',
    '[{"rowNumber":2,"rawData":{"email":"invalid"},"normalizedData":null,"errors":["Invalid email"]}]'
  );
  if import_job.import_status is distinct from 'INVALID' then raise exception 'Invalid CSV was not flagged'; end if;
  begin
    perform public.lms_commit_member_import(tenant, import_job.import_id, 'faculty-owner', 'OWNER');
    raise exception 'Invalid CSV was committed';
  exception when invalid_parameter_value then null;
  end;
  select * into import_job from public.lms_stage_member_import(
    tenant, 'faculty-owner', 'OWNER', 'faculty-valid-csv', repeat('b',64), 'valid.csv', 'TEACHER',
    '[{"rowNumber":2,"rawData":{"email":"csv-teacher@example.invalid"},"normalizedData":{"email":"csv-teacher@example.invalid","displayName":"CSV Teacher","subjectSpecialization":"Physics"},"errors":[]}]'
  );
  select * into committed from public.lms_commit_member_import(tenant, import_job.import_id, 'faculty-owner', 'OWNER');
  perform public.lms_commit_member_import(tenant, import_job.import_id, 'faculty-owner', 'OWNER');
  if committed.committed_rows is distinct from 1 or (
    select count(*) from public.institute_members m where m.institute_id = tenant and m.email = 'csv-teacher@example.invalid'
      and m.status = 'PENDING' and m.user_id is null
  ) <> 1 then raise exception 'CSV did not create one pending profile'; end if;

  if has_function_privilege('authenticated', 'public.lms_list_faculty(uuid,text,uuid,integer,integer,uuid)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.lms_save_faculty(uuid,text,text,uuid,jsonb,uuid[])', 'EXECUTE')
    or has_function_privilege('anon', 'public.lms_invite_faculty(uuid,text,text,uuid,text,text,text,timestamptz)', 'EXECUTE') then
    raise exception 'Browser roles can bypass faculty API authorization';
  end if;
end $$;

set local role authenticated;
do $$
begin
  if (select count(*) from public.organization_batch_members where role = 'TEACHER') <> 1
    or exists (select 1 from public.organization_batch_members where role = 'TEACHER' and user_id <> 'user_faculty_verified') then
    raise exception 'The teacher could read an unassigned batch membership through RLS';
  end if;
end $$;
reset role;

rollback;
