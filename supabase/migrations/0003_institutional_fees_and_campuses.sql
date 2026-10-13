-- Prepzii B2B LMS Migration 0003: Fee Management & Smart Campus Room Allocation
-- Tenant-owned records strictly include organization_id and row-level security.

-- =================================================================
-- 1. FEE STRUCTURES & STUDENT LEDGER
-- =================================================================

create table if not exists public.organization_fee_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  name text not null,
  target_exam text not null check (target_exam in ('JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'FOUNDATION', 'BOARDS', 'OTHER')),
  total_amount numeric(12, 2) not null check (total_amount >= 0),
  installment_count integer not null default 3 check (installment_count between 1 and 12),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, name)
);

create table if not exists public.organization_student_fees (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_id text not null,
  batch_id uuid references public.organization_batches(id) on delete set null,
  total_course_fee numeric(12, 2) not null check (total_course_fee >= 0),
  concession_amount numeric(12, 2) not null default 0 check (concession_amount >= 0),
  concession_reason text,
  net_payable numeric(12, 2) not null check (net_payable >= 0),
  status text not null default 'UNPAID' check (status in ('PAID', 'PARTIAL', 'OVERDUE', 'UNPAID')),
  updated_at timestamptz not null default now(),
  unique (organization_id, student_id)
);

create table if not exists public.organization_fee_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_fee_id uuid not null references public.organization_student_fees(id) on delete cascade,
  title text not null,
  amount numeric(12, 2) not null check (amount > 0),
  due_date date not null,
  status text not null default 'PENDING' check (status in ('PAID', 'PENDING', 'OVERDUE', 'PARTIAL')),
  paid_amount numeric(12, 2) not null default 0 check (paid_amount >= 0),
  paid_at timestamptz,
  receipt_number text
);

create table if not exists public.organization_fee_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_fee_id uuid not null references public.organization_student_fees(id) on delete cascade,
  student_id text not null,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null check (method in ('UPI', 'NET_BANKING', 'CARD', 'CHEQUE', 'CASH', 'DD')),
  reference_number text not null,
  receipt_number text not null,
  installment_title text not null,
  recorded_by text not null,
  created_at timestamptz not null default now()
);

create index if not exists org_fee_plans_org_idx on public.organization_fee_plans(organization_id);
create index if not exists org_student_fees_org_idx on public.organization_student_fees(organization_id);
create index if not exists org_student_fees_student_idx on public.organization_student_fees(student_id);
create index if not exists org_fee_inst_org_idx on public.organization_fee_installments(organization_id);
create index if not exists org_fee_inst_fee_idx on public.organization_fee_installments(student_fee_id);
create index if not exists org_fee_tx_org_idx on public.organization_fee_transactions(organization_id);

-- =================================================================
-- 2. CAMPUS ROOMS & SMART RESOURCE ALLOCATION
-- =================================================================

create table if not exists public.organization_campus_rooms (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  campus_id uuid not null references public.organization_campuses(id) on delete cascade,
  name text not null,
  capacity integer not null check (capacity > 0),
  facilities text[] not null default '{}',
  status text not null default 'AVAILABLE' check (status in ('IN_USE', 'AVAILABLE', 'MAINTENANCE')),
  created_at timestamptz not null default now(),
  unique (campus_id, name)
);

create table if not exists public.organization_room_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  room_id uuid not null references public.organization_campus_rooms(id) on delete cascade,
  batch_id uuid references public.organization_batches(id) on delete cascade,
  faculty_id text not null,
  time_slot text not null,
  subject text not null,
  day_of_week text not null check (day_of_week in ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN')),
  created_at timestamptz not null default now(),
  unique (room_id, day_of_week, time_slot)
);

create index if not exists org_campus_rooms_org_idx on public.organization_campus_rooms(organization_id);
create index if not exists org_room_schedules_org_idx on public.organization_room_schedules(organization_id);

-- =================================================================
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- =================================================================

alter table public.organization_fee_plans enable row level security;
alter table public.organization_student_fees enable row level security;
alter table public.organization_fee_installments enable row level security;
alter table public.organization_fee_transactions enable row level security;
alter table public.organization_campus_rooms enable row level security;
alter table public.organization_room_schedules enable row level security;

-- Fee Plans RLS
create policy org_fee_plans_read on public.organization_fee_plans
  for select using (public.is_organization_member(organization_id));
create policy org_fee_plans_manage on public.organization_fee_plans
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Student Fees RLS
create policy org_student_fees_read on public.organization_student_fees
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'TEACHER'])
    or student_id = public.requesting_user_id()
  );
create policy org_student_fees_manage on public.organization_student_fees
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Installments RLS
create policy org_fee_installments_read on public.organization_fee_installments
  for select using (public.is_organization_member(organization_id));
create policy org_fee_installments_manage on public.organization_fee_installments
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Transactions RLS
create policy org_fee_transactions_read on public.organization_fee_transactions
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN'])
    or student_id = public.requesting_user_id()
  );
create policy org_fee_transactions_manage on public.organization_fee_transactions
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

-- Campus Rooms & Schedules RLS
create policy org_campus_rooms_read on public.organization_campus_rooms
  for select using (public.is_organization_member(organization_id));
create policy org_campus_rooms_manage on public.organization_campus_rooms
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

create policy org_room_schedules_read on public.organization_room_schedules
  for select using (public.is_organization_member(organization_id));
create policy org_room_schedules_manage on public.organization_room_schedules
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
