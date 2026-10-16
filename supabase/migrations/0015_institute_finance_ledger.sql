-- Institute fee ledger hardening. API inputs use integer paise; persisted values remain reviewed numeric INR.

alter table public.organization_fee_plans add column if not exists currency text not null default 'INR';
alter table public.organization_fee_plans add constraint organization_fee_plans_currency_check check (currency = 'INR');
alter table public.organization_fee_plans
  add constraint organization_fee_plans_id_org_unique unique (id, organization_id);
alter table public.organization_academic_years
  add constraint organization_academic_years_id_org_unique unique (id, organization_id);
alter table public.organization_fee_installments
  add constraint organization_fee_installments_id_org_unique unique (id, organization_id);

create table if not exists public.organization_fee_plan_installments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  fee_plan_id uuid not null,
  sequence_number integer not null check (sequence_number > 0),
  title text not null,
  amount numeric(12,2) not null check (amount > 0),
  due_date date not null,
  created_at timestamptz not null default now(),
  foreign key (fee_plan_id, organization_id) references public.organization_fee_plans(id, organization_id) on delete cascade,
  unique (organization_id, fee_plan_id, sequence_number)
);

alter table public.organization_student_fees add column if not exists fee_plan_id uuid;
alter table public.organization_student_fees add column if not exists academic_year_id uuid;
alter table public.organization_student_fees add column if not exists assigned_at timestamptz not null default now();
alter table public.organization_student_fees add constraint organization_student_fee_plan_org_fk
  foreign key (fee_plan_id, organization_id) references public.organization_fee_plans(id, organization_id);
alter table public.organization_student_fees add constraint organization_student_fee_year_org_fk
  foreign key (academic_year_id, organization_id) references public.organization_academic_years(id, organization_id);

alter table public.organization_fee_transactions add column if not exists installment_id uuid;
alter table public.organization_fee_transactions add column if not exists transaction_type text not null default 'PAYMENT';
alter table public.organization_fee_transactions add column if not exists reversed_transaction_id uuid;
alter table public.organization_fee_transactions add column if not exists notes text;
alter table public.organization_fee_transactions add column if not exists provider text;
alter table public.organization_fee_transactions add column if not exists provider_event_id text;
alter table public.organization_fee_transactions add column if not exists provider_payment_id text;
alter table public.organization_fee_transactions add constraint organization_fee_transaction_type_check
  check (transaction_type in ('PAYMENT', 'REFUND', 'ADJUSTMENT'));
alter table public.organization_fee_transactions add constraint organization_fee_transaction_installment_org_fk
  foreign key (installment_id, organization_id) references public.organization_fee_installments(id, organization_id);
alter table public.organization_fee_transactions add constraint organization_fee_transaction_reversal_fk
  foreign key (reversed_transaction_id) references public.organization_fee_transactions(id);
create unique index if not exists organization_fee_transaction_reference_unique
  on public.organization_fee_transactions(organization_id, method, reference_number);
create unique index if not exists organization_fee_provider_event_unique
  on public.organization_fee_transactions(provider, provider_event_id) where provider_event_id is not null;
create unique index if not exists organization_fee_provider_payment_unique
  on public.organization_fee_transactions(provider, provider_payment_id) where provider_payment_id is not null;

create table if not exists public.organization_fee_invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_fee_id uuid not null,
  student_id text not null,
  invoice_number text not null,
  currency text not null default 'INR' check (currency = 'INR'),
  amount numeric(12,2) not null check (amount >= 0),
  due_date date not null,
  status text not null default 'ISSUED' check (status in ('ISSUED', 'PARTIAL', 'PAID', 'VOID')),
  issued_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (student_fee_id, organization_id) references public.organization_student_fees(id, organization_id) on delete cascade,
  unique (organization_id, invoice_number)
);

create index if not exists organization_fee_plan_installments_plan_idx on public.organization_fee_plan_installments(organization_id, fee_plan_id);
create index if not exists organization_fee_invoices_student_idx on public.organization_fee_invoices(organization_id, student_id, issued_at desc);

alter table public.organization_fee_plan_installments enable row level security;
alter table public.organization_fee_invoices enable row level security;
drop policy if exists org_fee_plans_read on public.organization_fee_plans;
create policy org_fee_plans_read on public.organization_fee_plans
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']));
create policy organization_fee_plan_installments_read on public.organization_fee_plan_installments
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']));
create policy organization_fee_invoices_read on public.organization_fee_invoices
  for select using (
    student_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT'])
  );

drop policy if exists org_fee_plans_manage on public.organization_fee_plans;
drop policy if exists org_student_fees_manage on public.organization_student_fees;
drop policy if exists org_fee_installments_manage on public.organization_fee_installments;
drop policy if exists org_fee_transactions_manage on public.organization_fee_transactions;

drop policy if exists org_fee_transactions_read on public.organization_fee_transactions;
create policy org_fee_transactions_read on public.organization_fee_transactions
  for select using (
    student_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT'])
  );

create or replace function public.lms_finance_mutation(
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
  plan public.organization_fee_plans%rowtype;
  ledger public.organization_student_fees%rowtype;
  installment public.organization_fee_installments%rowtype;
  original public.organization_fee_transactions%rowtype;
  item jsonb;
  expected_total_paise bigint := 0;
  paid_total numeric(12,2) := 0;
  refunded_total numeric(12,2) := 0;
  amount_inr numeric(12,2);
  receipt text;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACCOUNTANT') then
    raise exception 'Role cannot manage institute finances' using errcode = '42501';
  end if;

  if p_action = 'CREATE_PLAN' then
    if jsonb_typeof(p_payload -> 'installments') <> 'array' or jsonb_array_length(p_payload -> 'installments') not between 1 and 12 then
      raise exception 'A fee plan requires 1 to 12 installments' using errcode = '22023';
    end if;
    for item in select value from jsonb_array_elements(p_payload -> 'installments') loop
      expected_total_paise := expected_total_paise + (item ->> 'amountPaise')::bigint;
    end loop;
    if expected_total_paise <> (p_payload ->> 'totalAmountPaise')::bigint then
      raise exception 'Installments must equal the plan total' using errcode = '22023';
    end if;
    insert into public.organization_fee_plans (organization_id, name, target_exam, total_amount, installment_count)
    values (
      p_organization_id, trim(p_payload ->> 'name'), p_payload ->> 'targetExam',
      (p_payload ->> 'totalAmountPaise')::numeric / 100, jsonb_array_length(p_payload -> 'installments')
    ) returning * into plan;
    for item in select value from jsonb_array_elements(p_payload -> 'installments') loop
      insert into public.organization_fee_plan_installments (
        organization_id, fee_plan_id, sequence_number, title, amount, due_date
      ) values (
        p_organization_id, plan.id, (item ->> 'sequenceNumber')::integer, trim(item ->> 'title'),
        (item ->> 'amountPaise')::numeric / 100, (item ->> 'dueDate')::date
      );
    end loop;
    created_id := plan.id;

  elsif p_action = 'ASSIGN_PLAN' then
    select * into plan from public.organization_fee_plans candidate
    where candidate.id = (p_payload ->> 'planId')::uuid and candidate.organization_id = p_organization_id and candidate.is_active;
    if not found then raise exception 'Fee plan not found' using errcode = '23503'; end if;
    if not exists (
      select 1 from public.organization_batch_members enrollment
      where enrollment.organization_id = p_organization_id and enrollment.batch_id = (p_payload ->> 'batchId')::uuid
        and enrollment.user_id = p_payload ->> 'studentId' and enrollment.role = 'STUDENT'
    ) then raise exception 'Student is not enrolled in the batch' using errcode = '23503'; end if;
    if (p_payload ->> 'concessionAmountPaise')::numeric / 100 > plan.total_amount then
      raise exception 'Concession exceeds plan total' using errcode = '22023';
    end if;
    insert into public.organization_student_fees (
      organization_id, student_id, batch_id, fee_plan_id, academic_year_id, total_course_fee,
      concession_amount, concession_reason, net_payable, status
    ) values (
      p_organization_id, p_payload ->> 'studentId', (p_payload ->> 'batchId')::uuid, plan.id,
      nullif(p_payload ->> 'academicYearId', '')::uuid, plan.total_amount,
      (p_payload ->> 'concessionAmountPaise')::numeric / 100, nullif(trim(p_payload ->> 'concessionReason'), ''),
      plan.total_amount - ((p_payload ->> 'concessionAmountPaise')::numeric / 100),
      case when plan.total_amount = (p_payload ->> 'concessionAmountPaise')::numeric / 100 then 'PAID' else 'UNPAID' end
    ) returning * into ledger;
    for item in select to_jsonb(template) from public.organization_fee_plan_installments template
      where template.organization_id = p_organization_id and template.fee_plan_id = plan.id order by template.sequence_number
    loop
      amount_inr := least((item ->> 'amount')::numeric, greatest(ledger.net_payable - coalesce((select sum(amount) from public.organization_fee_installments where student_fee_id = ledger.id), 0), 0));
      if amount_inr > 0 then
        insert into public.organization_fee_installments (organization_id, student_fee_id, title, amount, due_date)
        values (p_organization_id, ledger.id, item ->> 'title', amount_inr, (item ->> 'due_date')::date);
      end if;
    end loop;
    insert into public.organization_fee_invoices (
      organization_id, student_fee_id, student_id, invoice_number, amount, due_date, status
    ) values (
      p_organization_id, ledger.id, ledger.student_id, 'INV-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
      ledger.net_payable,
      (select max(due_date) from public.organization_fee_plan_installments where organization_id = p_organization_id and fee_plan_id = plan.id),
      case when ledger.net_payable = 0 then 'PAID' else 'ISSUED' end
    );
    created_id := ledger.id;

  elsif p_action = 'RECORD_PAYMENT' then
    select * into ledger from public.organization_student_fees candidate
    where candidate.id = (p_payload ->> 'studentFeeId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found then raise exception 'Student fee ledger not found' using errcode = '23503'; end if;
    select * into installment from public.organization_fee_installments candidate
    where candidate.id = (p_payload ->> 'installmentId')::uuid and candidate.organization_id = p_organization_id
      and candidate.student_fee_id = ledger.id for update;
    if not found then raise exception 'Installment not found' using errcode = '23503'; end if;
    amount_inr := (p_payload ->> 'amountPaise')::numeric / 100;
    if amount_inr <= 0 or amount_inr > installment.amount - installment.paid_amount then
      raise exception 'Payment exceeds installment balance' using errcode = '22023';
    end if;
    created_id := gen_random_uuid();
    receipt := 'REC-' || upper(substr(replace(created_id::text, '-', ''), 1, 12));
    insert into public.organization_fee_transactions (
      id, organization_id, student_fee_id, installment_id, student_id, amount, method,
      reference_number, receipt_number, installment_title, recorded_by, transaction_type, notes
    ) values (
      created_id, p_organization_id, ledger.id, installment.id, ledger.student_id, amount_inr,
      p_payload ->> 'method', trim(p_payload ->> 'referenceNumber'), receipt, installment.title,
      p_actor_user_id, 'PAYMENT', nullif(trim(p_payload ->> 'notes'), '')
    );
    update public.organization_fee_installments set
      paid_amount = paid_amount + amount_inr,
      status = case when paid_amount + amount_inr >= amount then 'PAID' else 'PARTIAL' end,
      paid_at = case when paid_amount + amount_inr >= amount then now() else paid_at end,
      receipt_number = receipt
    where id = installment.id;

  elsif p_action = 'REFUND_PAYMENT' then
    select * into original from public.organization_fee_transactions candidate
    where candidate.id = (p_payload ->> 'transactionId')::uuid and candidate.organization_id = p_organization_id
      and candidate.transaction_type = 'PAYMENT' for update;
    if not found then raise exception 'Original payment not found' using errcode = '23503'; end if;
    select coalesce(sum(amount), 0) into refunded_total from public.organization_fee_transactions
    where organization_id = p_organization_id and reversed_transaction_id = original.id and transaction_type = 'REFUND';
    amount_inr := (p_payload ->> 'amountPaise')::numeric / 100;
    if amount_inr <= 0 or amount_inr + refunded_total > original.amount then
      raise exception 'Refund exceeds remaining refundable amount' using errcode = '22023';
    end if;
    created_id := gen_random_uuid();
    receipt := 'RFN-' || upper(substr(replace(created_id::text, '-', ''), 1, 12));
    insert into public.organization_fee_transactions (
      id, organization_id, student_fee_id, installment_id, student_id, amount, method,
      reference_number, receipt_number, installment_title, recorded_by, transaction_type,
      reversed_transaction_id, notes
    ) values (
      created_id, p_organization_id, original.student_fee_id, original.installment_id, original.student_id,
      amount_inr, original.method, trim(p_payload ->> 'referenceNumber'), receipt, original.installment_title,
      p_actor_user_id, 'REFUND', original.id, trim(p_payload ->> 'reason')
    );
    update public.organization_fee_installments set
      paid_amount = greatest(paid_amount - amount_inr, 0), paid_at = null,
      status = case when greatest(paid_amount - amount_inr, 0) = 0 then 'PENDING' else 'PARTIAL' end
    where id = original.installment_id;
    ledger.id := original.student_fee_id;
  else
    raise exception 'Unsupported finance action' using errcode = '22023';
  end if;

  if p_action in ('RECORD_PAYMENT', 'REFUND_PAYMENT') then
    select * into ledger from public.organization_student_fees where id = ledger.id for update;
    select coalesce(sum(case when transaction_type = 'PAYMENT' then amount else 0 end), 0),
           coalesce(sum(case when transaction_type = 'REFUND' then amount else 0 end), 0)
      into paid_total, refunded_total
    from public.organization_fee_transactions where organization_id = p_organization_id and student_fee_id = ledger.id;
    update public.organization_student_fees set
      status = case when paid_total - refunded_total >= net_payable then 'PAID' when paid_total - refunded_total > 0 then 'PARTIAL' else 'UNPAID' end,
      updated_at = now()
    where id = ledger.id;
    update public.organization_fee_invoices set
      status = case when paid_total - refunded_total >= amount then 'PAID' when paid_total - refunded_total > 0 then 'PARTIAL' else 'ISSUED' end,
      updated_at = now()
    where organization_id = p_organization_id and student_fee_id = ledger.id and status <> 'VOID';
  end if;

  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role, 'finance.' || lower(p_action), 'student_fee', created_id::text, p_payload);
  return jsonb_build_object('id', created_id, 'receiptNumber', receipt, 'action', p_action);
end;
$$;

revoke all on function public.lms_finance_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_finance_mutation(uuid, text, text, text, jsonb) to service_role;
