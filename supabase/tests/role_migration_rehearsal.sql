-- Only for a disposable database at the 0023 baseline. Synthetic data only.
insert into auth.users (id,email)
values ('8a000000-0000-4000-8000-000000000010','synthetic-auth-user@example.invalid');

insert into public.institutes (id, name, slug, owner_user_id) values
  ('8a000000-0000-4000-8000-000000000001', 'Rehearsal A', 'rehearsal-a', 'rehearsal-owner'),
  ('8b000000-0000-4000-8000-000000000001', 'Rehearsal B', 'rehearsal-b', 'rehearsal-owner-b');

insert into public.organization_subscriptions (organization_id, plan_id, status, current_period_end) values
  ('8a000000-0000-4000-8000-000000000001', 'basic', 'ACTIVE', now() + interval '30 days'),
  ('8b000000-0000-4000-8000-000000000001', 'basic', 'ACTIVE', now() + interval '30 days');

insert into public.institute_members (institute_id, user_id, email, role, status) values
  ('8a000000-0000-4000-8000-000000000001', 'rehearsal-owner', 'owner@example.invalid', 'COACHING_ADMIN', 'ACTIVE'),
  ('8a000000-0000-4000-8000-000000000001', 'rehearsal-teacher', 'teacher@example.invalid', 'TEACHER', 'ACTIVE'),
  ('8b000000-0000-4000-8000-000000000001', 'rehearsal-teacher', 'teacher@example.invalid', 'COACHING_ADMIN', 'ACTIVE'),
  ('8a000000-0000-4000-8000-000000000001', 'rehearsal-student', 'student@example.invalid', 'STUDENT', 'ACTIVE'),
  ('8a000000-0000-4000-8000-000000000001', 'rehearsal-sibling', 'sibling@example.invalid', 'STUDENT', 'ACTIVE'),
  ('8a000000-0000-4000-8000-000000000001', 'rehearsal-parent', 'parent@example.invalid', 'PARENT', 'ACTIVE'),
  ('8a000000-0000-4000-8000-000000000001', 'rehearsal-guardian', 'guardian@example.invalid', 'PARENT', 'ACTIVE'),
  ('8a000000-0000-4000-8000-000000000001', null, 'pending@example.invalid', 'STUDENT', 'PENDING');

insert into public.organization_batches (id, organization_id, name, target_exam) values
  ('8a000000-0000-4000-8000-000000000002', '8a000000-0000-4000-8000-000000000001', 'Assigned', 'JEE_MAIN'),
  ('8a000000-0000-4000-8000-000000000003', '8a000000-0000-4000-8000-000000000001', 'Unassigned', 'JEE_MAIN');

insert into public.organization_batch_members (organization_id, batch_id, user_id, role) values
  ('8a000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000002', 'rehearsal-teacher', 'TEACHER'),
  ('8a000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000002', 'rehearsal-student', 'STUDENT'),
  ('8a000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000003', 'rehearsal-sibling', 'STUDENT');

insert into public.organization_guardian_links (organization_id, guardian_user_id, student_user_id, relationship, status) values
  ('8a000000-0000-4000-8000-000000000001', 'rehearsal-parent', 'rehearsal-student', 'MOTHER', 'APPROVED'),
  ('8a000000-0000-4000-8000-000000000001', 'rehearsal-parent', 'rehearsal-sibling', 'MOTHER', 'APPROVED'),
  ('8a000000-0000-4000-8000-000000000001', 'rehearsal-guardian', 'rehearsal-student', 'FATHER', 'APPROVED');

insert into public.organization_attendance_sessions (id, organization_id, batch_id, session_date, session_label, marked_by) values
  ('8a000000-0000-4000-8000-000000000004', '8a000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000002', current_date, 'Assigned session', 'rehearsal-teacher'),
  ('8a000000-0000-4000-8000-000000000005', '8a000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000003', current_date, 'Unassigned session', 'rehearsal-owner');

insert into public.organization_attendance_records (organization_id, session_id, student_id, status) values
  ('8a000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000004', 'rehearsal-student', 'PRESENT'),
  ('8a000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000005', 'rehearsal-sibling', 'PRESENT');

insert into public.organization_fee_plans (id, organization_id, name, target_exam, total_amount, installment_count)
values ('8a000000-0000-4000-8000-000000000006', '8a000000-0000-4000-8000-000000000001', 'Synthetic fees', 'JEE_MAIN', 1000, 1);
insert into public.organization_student_fees
  (id, organization_id, student_id, batch_id, fee_plan_id, total_course_fee, concession_amount, net_payable, status)
values ('8a000000-0000-4000-8000-000000000007', '8a000000-0000-4000-8000-000000000001', 'rehearsal-student',
  '8a000000-0000-4000-8000-000000000002', '8a000000-0000-4000-8000-000000000006', 1000, 0, 1000, 'PARTIAL');
insert into public.organization_fee_installments (organization_id, student_fee_id, title, amount, due_date, status, paid_amount)
values ('8a000000-0000-4000-8000-000000000001', '8a000000-0000-4000-8000-000000000007', 'Term 1', 1000, current_date, 'PARTIAL', 500);

insert into public.institute_batches (id,institute_id,name,exam)
values ('8a000000-0000-4000-8000-000000000008','8a000000-0000-4000-8000-000000000001','Consumer batch','JEE_MAIN');
insert into public.institute_batch_members (institute_id,batch_id,member_id)
select institute_id,'8a000000-0000-4000-8000-000000000008',id from public.institute_members
where institute_id='8a000000-0000-4000-8000-000000000001' and user_id='rehearsal-student';
insert into public.institute_tests (id,institute_id,title,exam,subject,created_by,status)
values ('8a000000-0000-4000-8000-000000000009','8a000000-0000-4000-8000-000000000001','Consumer test','JEE_MAIN','Physics','rehearsal-owner','PUBLISHED');
insert into public.institute_test_assignments (institute_id,institute_test_id,batch_id)
values ('8a000000-0000-4000-8000-000000000001','8a000000-0000-4000-8000-000000000009','8a000000-0000-4000-8000-000000000008');
insert into public.institute_test_attempts (institute_id,institute_test_id,user_id)
values ('8a000000-0000-4000-8000-000000000001','8a000000-0000-4000-8000-000000000009','rehearsal-student');

-- Test a grant the table-level revoke alone would leave intact.
grant select (score, question_results) on public.organization_assessment_attempts to authenticated;

create temp view rehearsal_rows as
  select 'institutes' as source, to_jsonb(row) as value from public.institutes row
  union all select 'auth users', to_jsonb(row) from auth.users row
  union all select 'memberships', to_jsonb(row) from public.institute_members row
  union all select 'subscriptions', to_jsonb(row) from public.organization_subscriptions row
  union all select 'batches', to_jsonb(row) from public.organization_batches row
  union all select 'enrollments', to_jsonb(row) - 'pending_teacher_id' - 'pending_student_id' from public.organization_batch_members row
  union all select 'consumer batches', to_jsonb(row) from public.institute_batches row
  union all select 'consumer enrollments', to_jsonb(row) from public.institute_batch_members row
  union all select 'consumer tests', to_jsonb(row) from public.institute_tests row
  union all select 'consumer test assignments', to_jsonb(row) from public.institute_test_assignments row
  union all select 'consumer test attempts', to_jsonb(row) from public.institute_test_attempts row
  union all select 'guardians', to_jsonb(row) from public.organization_guardian_links row
  union all select 'attendance', to_jsonb(row) from public.organization_attendance_records row
  union all select 'fees', to_jsonb(row) from public.organization_student_fees row
  union all select 'installments', to_jsonb(row) from public.organization_fee_installments row;
create temp table rehearsal_before as select * from rehearsal_rows;

\ir ../migrations/0024_membership_transition_guards.sql
\ir ../migrations/0025_workspace_resource_policies.sql
\ir ../migrations/0026_institute_dashboard_branding.sql
\ir ../migrations/0027_faculty_onboarding.sql
\ir ../migrations/0028_invite_only_provisioning.sql
\ir ../migrations/0029_dashboard_workflow_guards.sql
\ir ../migrations/0030_platform_workflows.sql

do $$
begin
  if exists (select * from rehearsal_before except all select * from rehearsal_rows)
     or exists (select * from rehearsal_rows except all select * from rehearsal_before) then
    raise exception 'Migration changed existing records';
  end if;
  if has_column_privilege('authenticated','public.organization_assessment_attempts','score','select')
     or has_column_privilege('authenticated','public.organization_assessment_attempts','question_results','select') then
    raise exception 'Explicit grading column grant survived the migration';
  end if;
  if not has_function_privilege('service_role','public.lms_review_guardian_link(uuid,text,uuid,uuid,text,boolean)','execute') then
    raise exception 'The application role lost guardian review access';
  end if;
end
$$;

-- The consumer application writes through the Supabase service role. Model
-- that role's BYPASSRLS attribute in this synthetic PostgreSQL instance only.
begin;
alter role service_role bypassrls;
set local role service_role;
do $$
declare
  org_id uuid;
  created_member_id uuid;
  created_batch_id uuid;
begin
  insert into public.institutes (name,slug,owner_user_id,status)
  values ('Consumer creation check','rehearsal-consumer-created','rehearsal-new-owner','ACTIVE')
  returning id into org_id;
  insert into public.institute_members (institute_id,user_id,email,role,status)
  values (org_id,'rehearsal-new-owner','new-owner@example.invalid','COACHING_ADMIN','ACTIVE');
  insert into public.institute_members (institute_id,user_id,email,role,status)
  values (org_id,null,'new-student@example.invalid','STUDENT','PENDING')
  on conflict (institute_id,email) do nothing returning id into created_member_id;
  insert into public.institute_batches (institute_id,name,exam)
  values (org_id,'Consumer batch','JEE_MAIN') returning id into created_batch_id;
  insert into public.institute_batch_members (institute_id,batch_id,member_id)
  values (org_id,created_batch_id,created_member_id) on conflict (batch_id,member_id) do nothing;
  if created_member_id is null or not exists (
    select from public.institute_test_attempts where user_id='rehearsal-student'
  ) then
    raise exception 'Consumer read or pending-student write failed under the service role';
  end if;
end
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"rehearsal-owner","role":"authenticated"}',true);
do $$
begin
  if not public.has_organization_role('8a000000-0000-4000-8000-000000000001',array['OWNER'])
     or (select count(*) from public.institutes) <> 1 then
    raise exception 'Canonical legacy owner lost access or can see another tenant';
  end if;
end
$$;
select set_config('request.jwt.claims','{"sub":"rehearsal-teacher","role":"authenticated"}',true);
do $$
begin
  if not public.has_organization_role('8a000000-0000-4000-8000-000000000001',array['TEACHER'])
     or not public.has_organization_role('8b000000-0000-4000-8000-000000000001',array['COACHING_ADMIN'])
     or public.has_organization_role('8a000000-0000-4000-8000-000000000001',array['COACHING_ADMIN'])
     or (select count(*) from public.organization_attendance_records) <> 1
     or (select count(*) from public.organization_student_fees) <> 0 then
    raise exception 'Teacher and manager privileges escaped their assigned institute or batch';
  end if;
end
$$;
select set_config('request.jwt.claims','{"sub":"rehearsal-student","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.organization_batch_members) <> 1
     or (select count(*) from public.organization_attendance_records) <> 1
     or (select count(*) from public.organization_fee_installments) <> 1 then
    raise exception 'Student lost access to own records or gained access to another student';
  end if;
end
$$;
select set_config('request.jwt.claims','{"sub":"rehearsal-parent","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.organization_attendance_records) <> 2
     or (select count(*) from public.organization_student_fees) <> 1
     or (select count(*) from public.organization_fee_installments) <> 1 then
    raise exception 'Parent lost access to approved children';
  end if;
end
$$;
select set_config('request.jwt.claims','{"sub":"rehearsal-guardian","role":"authenticated"}',true);
do $$
begin
  if (select count(*) from public.organization_attendance_records) <> 1
     or exists (select 1 from public.organization_attendance_records where student_id <> 'rehearsal-student') then
    raise exception 'Second guardian lost access or received an unapproved child';
  end if;
end
$$;
rollback;

-- An onboarding retry must reuse the consumer-created legacy owner record.
select id from public.lms_create_institute(
  'rehearsal-owner', 'owner@example.invalid', 'Rehearsal A', 'rehearsal-a', 'COACHING', '9876543210', 'Kota', 'Rajasthan');
do $$
begin
  if 1 <> (select count(*) from public.institute_members where user_id = 'rehearsal-owner')
     or not exists (select 1 from public.institute_members where user_id = 'rehearsal-owner' and role = 'COACHING_ADMIN') then
    raise exception 'Onboarding retry changed or duplicated the legacy owner membership';
  end if;
end
$$;
