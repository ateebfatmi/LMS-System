-- Phase 1 hardening: close cross-tenant relationship gaps, tighten sensitive
-- read policies, and add persistent audit/webhook records.
-- Review against staging before applying to the shared Prepzii database.

-- Child rows must carry the canonical tenant key, even when it is derivable.
alter table public.organization_batch_members add column if not exists organization_id uuid;
update public.organization_batch_members child
set organization_id = parent.organization_id
from public.organization_batches parent
where child.batch_id = parent.id and child.organization_id is null;
alter table public.organization_batch_members alter column organization_id set not null;

alter table public.organization_course_modules add column if not exists organization_id uuid;
update public.organization_course_modules child
set organization_id = parent.organization_id
from public.organization_courses parent
where child.course_id = parent.id and child.organization_id is null;
alter table public.organization_course_modules alter column organization_id set not null;

alter table public.organization_course_lessons add column if not exists organization_id uuid;
update public.organization_course_lessons child
set organization_id = course.organization_id
from public.organization_course_modules module
join public.organization_courses course on course.id = module.course_id
where child.module_id = module.id and child.organization_id is null;
alter table public.organization_course_lessons alter column organization_id set not null;

alter table public.organization_attendance_records add column if not exists organization_id uuid;
update public.organization_attendance_records child
set organization_id = parent.organization_id
from public.organization_attendance_sessions parent
where child.session_id = parent.id and child.organization_id is null;
alter table public.organization_attendance_records alter column organization_id set not null;

-- Composite candidate keys let PostgreSQL prove parent and child share a tenant.
alter table public.organization_batches
  add constraint organization_batches_id_org_unique unique (id, organization_id);
alter table public.organization_courses
  add constraint organization_courses_id_org_unique unique (id, organization_id);
alter table public.organization_subjects
  add constraint organization_subjects_id_org_unique unique (id, organization_id);
alter table public.organization_course_modules
  add constraint organization_modules_id_org_unique unique (id, organization_id);
alter table public.organization_attendance_sessions
  add constraint organization_attendance_sessions_id_org_unique unique (id, organization_id);
alter table public.organization_student_fees
  add constraint organization_student_fees_id_org_unique unique (id, organization_id);
alter table public.organization_campuses
  add constraint organization_campuses_id_org_unique unique (id, organization_id);
alter table public.organization_campus_rooms
  add constraint organization_rooms_id_org_unique unique (id, organization_id);

alter table public.organization_batch_members
  add constraint organization_batch_members_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id) on delete cascade;
alter table public.organization_courses
  add constraint organization_course_subject_org_fk
  foreign key (subject_id, organization_id)
  references public.organization_subjects(id, organization_id);
alter table public.organization_course_modules
  add constraint organization_modules_course_org_fk
  foreign key (course_id, organization_id)
  references public.organization_courses(id, organization_id) on delete cascade;
alter table public.organization_course_lessons
  add constraint organization_lessons_module_org_fk
  foreign key (module_id, organization_id)
  references public.organization_course_modules(id, organization_id) on delete cascade;
alter table public.organization_attendance_sessions
  add constraint organization_attendance_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id) on delete cascade;
alter table public.organization_attendance_records
  add constraint organization_attendance_record_session_org_fk
  foreign key (session_id, organization_id)
  references public.organization_attendance_sessions(id, organization_id) on delete cascade;
alter table public.organization_test_schedules
  add constraint organization_test_schedule_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id) on delete cascade;
alter table public.organization_student_fees
  add constraint organization_student_fee_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id);
alter table public.organization_fee_installments
  add constraint organization_installment_fee_org_fk
  foreign key (student_fee_id, organization_id)
  references public.organization_student_fees(id, organization_id) on delete cascade;
alter table public.organization_fee_transactions
  add constraint organization_transaction_fee_org_fk
  foreign key (student_fee_id, organization_id)
  references public.organization_student_fees(id, organization_id) on delete cascade;
alter table public.organization_campus_rooms
  add constraint organization_room_campus_org_fk
  foreign key (campus_id, organization_id)
  references public.organization_campuses(id, organization_id) on delete cascade;
alter table public.organization_room_schedules
  add constraint organization_schedule_room_org_fk
  foreign key (room_id, organization_id)
  references public.organization_campus_rooms(id, organization_id) on delete cascade;
alter table public.organization_room_schedules
  add constraint organization_schedule_batch_org_fk
  foreign key (batch_id, organization_id)
  references public.organization_batches(id, organization_id) on delete cascade;
alter table public.organization_leads
  add constraint organization_lead_batch_org_fk
  foreign key (target_batch_id, organization_id)
  references public.organization_batches(id, organization_id);

create index if not exists org_batch_members_org_idx on public.organization_batch_members(organization_id);
create index if not exists org_modules_org_idx on public.organization_course_modules(organization_id);
create index if not exists org_lessons_org_idx on public.organization_course_lessons(organization_id);
create index if not exists org_attendance_records_org_idx on public.organization_attendance_records(organization_id);

-- Persistent administrative audit and webhook idempotency records.
create table if not exists public.organization_audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete restrict,
  actor_user_id text not null,
  actor_role text not null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_state jsonb,
  after_state jsonb,
  request_id text,
  ip_address inet,
  created_at timestamptz not null default now()
);
create index if not exists organization_audit_logs_org_time_idx
  on public.organization_audit_logs(organization_id, created_at desc);

create table if not exists public.processed_webhook_events (
  id text primary key,
  provider text not null default 'razorpay',
  event_type text not null,
  payload_summary jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now()
);

alter table public.organization_audit_logs enable row level security;
alter table public.processed_webhook_events enable row level security;
alter table public.organization_subscriptions enable row level security;
alter table public.subscription_plans enable row level security;
alter table public.platform_audit_logs enable row level security;
alter table public.platform_demo_requests enable row level security;

-- Replace the CRM policy that used auth.uid(); Prepzii's Clerk JWT identity is `sub`.
drop policy if exists "Admins and Counsellors access leads" on public.organization_leads;
create policy organization_leads_manage on public.organization_leads
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Sensitive tables use least-privilege reads. Parent access is deferred until
-- the reviewed guardian-link table exists; it is not inferred from membership.
drop policy if exists org_batch_members_read on public.organization_batch_members;
create policy org_batch_members_read on public.organization_batch_members
  for select using (
    user_id = public.requesting_user_id()
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

drop policy if exists org_attendance_records_read on public.organization_attendance_records;
create policy org_attendance_records_read on public.organization_attendance_records
  for select using (
    student_id = public.requesting_user_id()
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

drop policy if exists org_fee_installments_read on public.organization_fee_installments;
create policy org_fee_installments_read on public.organization_fee_installments
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT'])
    or exists (
      select 1 from public.organization_student_fees fee
      where fee.id = student_fee_id
        and fee.organization_id = organization_fee_installments.organization_id
        and fee.student_id = public.requesting_user_id()
    )
  );

drop policy if exists org_student_fees_read on public.organization_student_fees;
create policy org_student_fees_read on public.organization_student_fees
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT'])
    or student_id = public.requesting_user_id()
  );
drop policy if exists org_student_fees_manage on public.organization_student_fees;
create policy org_student_fees_manage on public.organization_student_fees
  for all
  using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']));

create policy organization_audit_logs_read on public.organization_audit_logs
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

create policy subscription_plans_read_active on public.subscription_plans
  for select using (is_active);
create policy organization_subscriptions_read on public.organization_subscriptions
  for select using (public.is_organization_member(organization_id));

-- No client policies are created for webhook events, platform audit logs, or
-- public demo requests. Only trusted server/service-role code may access them.
