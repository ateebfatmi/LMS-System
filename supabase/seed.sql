-- PrepZii for Institutes: Production & Staging Idempotent Seed Data
-- Demo data is clearly identified as sample demonstration records.

-- 1. Demo Institute
insert into public.institutes (
  id, name, slug, institute_type, logo_url, primary_color, contact_email, contact_phone, owner_user_id, status
) values (
  '00000000-0000-0000-0000-000000000001',
  'Apex JEE & NEET Academy',
  'apex-academy',
  'COACHING',
  '/images/branding/prepzii-official-logo.png',
  '#FACC15',
  'director@apexacademy.in',
  '+91 98765 00000',
  'usr_director_ateeb',
  'ACTIVE'
) on conflict (id) do update set status = 'ACTIVE';

-- 2. Institute Members (Director, Faculty, Student)
insert into public.institute_members (id, institute_id, user_id, role, status)
values
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'usr_director_ateeb', 'OWNER', 'ACTIVE'),
  ('00000000-0000-0000-0001-000000000002', '00000000-0000-0000-0000-000000000001', 'usr_faculty_vivek', 'TEACHER', 'ACTIVE'),
  ('00000000-0000-0000-0001-000000000003', '00000000-0000-0000-0000-000000000001', 'usr_student_aarav', 'STUDENT', 'ACTIVE')
on conflict (id) do nothing;

-- 3. Academic Year & Campuses
insert into public.organization_academic_years (id, organization_id, name, starts_on, ends_on, is_active)
values (
  '00000000-0000-0000-0002-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '2026–2027 Academic Session',
  '2026-04-01',
  '2027-03-31',
  true
) on conflict (organization_id, name) do nothing;

insert into public.organization_campuses (id, organization_id, name, address)
values (
  '00000000-0000-0000-0003-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'North Main Campus (Kota Road)',
  '{"city": "Kota", "state": "Rajasthan", "pincode": "324005"}'::jsonb
) on conflict (organization_id, name) do nothing;

-- 4. Batches
insert into public.organization_batches (id, organization_id, campus_id, name, target_exam, grade_level, room_number, is_active)
values (
  '00000000-0000-0000-0004-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0003-000000000001',
  'JEE 12A - Titans',
  'JEE_ADVANCED',
  'Class 12',
  'Room 101',
  true
) on conflict (organization_id, name) do nothing;

-- 5. Batch Members
insert into public.organization_batch_members (id, batch_id, user_id, role, roll_number)
values 
  ('00000000-0000-0000-0005-000000000001', '00000000-0000-0000-0004-000000000001', 'usr_student_aarav', 'STUDENT', 'APX-2026-1201'),
  ('00000000-0000-0000-0005-000000000002', '00000000-0000-0000-0004-000000000001', 'usr_faculty_vivek', 'TEACHER', null)
on conflict (batch_id, user_id) do nothing;

-- 6. Fee Plan & Student Ledger
insert into public.organization_fee_plans (id, organization_id, name, target_exam, total_amount, installment_count, is_active)
values (
  '00000000-0000-0000-0006-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'JEE Advanced Comprehensive 2-Year Program',
  'JEE_ADVANCED',
  145000.00,
  3,
  true
) on conflict (organization_id, name) do nothing;

insert into public.organization_student_fees (
  id, organization_id, student_id, batch_id, total_course_fee, concession_amount, net_payable, status
) values (
  '00000000-0000-0000-0007-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'usr_student_aarav',
  '00000000-0000-0000-0004-000000000001',
  145000.00,
  15000.00,
  130000.00,
  'PARTIAL'
) on conflict (organization_id, student_id) do nothing;

-- 7. Sample Admissions CRM Leads
insert into public.organization_leads (
  id, organization_id, name, email, phone, guardian_name, guardian_phone, target_exam, source, stage, follow_up_date, estimated_fee
) values (
  '00000000-0000-0000-0008-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Aditya Pratapsingh',
  'aditya.p@gmail.com',
  '+91 98234 56789',
  'Col. Rajesh Pratapsingh',
  '+91 98234 56780',
  'JEE_ADVANCED',
  'WALK_IN',
  'COUNSELLING_SCHEDULED',
  '2026-10-18',
  145000.00
) on conflict (id) do nothing;
