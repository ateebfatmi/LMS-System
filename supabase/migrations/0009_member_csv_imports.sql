-- Two-step CSV imports: immutable validation staging followed by an atomic,
-- idempotent commit. Imported identities remain PENDING until invite acceptance.

create table public.organization_member_imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  idempotency_key text not null,
  request_hash text not null check (length(request_hash) = 64),
  file_name text not null,
  member_role text not null check (member_role in ('STUDENT', 'TEACHER')),
  status text not null check (status in ('VALIDATED', 'INVALID', 'COMMITTED')),
  total_rows integer not null check (total_rows > 0),
  valid_rows integer not null check (valid_rows >= 0),
  invalid_rows integer not null check (invalid_rows >= 0),
  created_by text not null,
  committed_by text,
  committed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, idempotency_key),
  unique (id, organization_id),
  check (valid_rows + invalid_rows = total_rows)
);

create table public.organization_member_import_rows (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  import_id uuid not null,
  row_number integer not null check (row_number >= 2),
  raw_data jsonb not null,
  normalized_data jsonb,
  errors text[] not null default '{}',
  status text not null check (status in ('VALID', 'INVALID', 'COMMITTED')),
  resulting_member_id uuid references public.institute_members(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (import_id, row_number),
  constraint organization_member_import_rows_import_org_fk
    foreign key (import_id, organization_id)
    references public.organization_member_imports(id, organization_id) on delete cascade
);

create index organization_member_imports_org_time_idx
  on public.organization_member_imports(organization_id, created_at desc);
create index organization_member_import_rows_import_idx
  on public.organization_member_import_rows(import_id, row_number);

alter table public.organization_member_imports enable row level security;
alter table public.organization_member_import_rows enable row level security;

create or replace function public.lms_stage_member_import(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_idempotency_key text,
  p_request_hash text,
  p_file_name text,
  p_member_role text,
  p_rows jsonb
)
returns table (
  import_id uuid,
  import_status text,
  total_rows integer,
  valid_rows integer,
  invalid_rows integer,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.organization_member_imports%rowtype;
  created public.organization_member_imports%rowtype;
  row_count integer;
  valid_count integer;
begin
  if p_member_role not in ('STUDENT', 'TEACHER') then
    raise exception 'Invalid import role' using errcode = '22023';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'Import rows must be an array' using errcode = '22023';
  end if;
  row_count := jsonb_array_length(p_rows);
  if row_count < 1 or row_count > 1000 then
    raise exception 'Import must contain between 1 and 1000 rows' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_idempotency_key, 0));
  select * into existing
  from public.organization_member_imports candidate
  where candidate.organization_id = p_organization_id
    and candidate.idempotency_key = p_idempotency_key;
  if found then
    if existing.request_hash <> p_request_hash then
      raise exception 'Idempotency key was used for another import' using errcode = '22023';
    end if;
    return query select existing.id, existing.status, existing.total_rows, existing.valid_rows, existing.invalid_rows, existing.created_at;
    return;
  end if;

  select count(*) into valid_count
  from jsonb_array_elements(p_rows) item
  where jsonb_array_length(item -> 'errors') = 0 and item -> 'normalizedData' <> 'null'::jsonb;

  insert into public.organization_member_imports (
    organization_id, idempotency_key, request_hash, file_name, member_role,
    status, total_rows, valid_rows, invalid_rows, created_by
  ) values (
    p_organization_id, p_idempotency_key, p_request_hash, p_file_name, p_member_role,
    case when valid_count = row_count then 'VALIDATED' else 'INVALID' end,
    row_count, valid_count, row_count - valid_count, p_actor_user_id
  ) returning * into created;

  insert into public.organization_member_import_rows (
    organization_id, import_id, row_number, raw_data, normalized_data, errors, status
  )
  select
    p_organization_id,
    created.id,
    (item ->> 'rowNumber')::integer,
    item -> 'rawData',
    item -> 'normalizedData',
    array(select jsonb_array_elements_text(item -> 'errors')),
    case when jsonb_array_length(item -> 'errors') = 0 then 'VALID' else 'INVALID' end
  from jsonb_array_elements(p_rows) item;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state, request_id
  ) values (
    p_organization_id,
    p_actor_user_id,
    p_actor_role,
    'member_import.staged',
    'organization_member_import',
    created.id::text,
    jsonb_build_object('role', p_member_role, 'total', row_count, 'valid', valid_count),
    p_idempotency_key
  );

  return query select created.id, created.status, created.total_rows, created.valid_rows, created.invalid_rows, created.created_at;
end;
$$;

create or replace function public.lms_commit_member_import(
  p_organization_id uuid,
  p_import_id uuid,
  p_actor_user_id text,
  p_actor_role text
)
returns table (import_status text, committed_rows integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  import_job public.organization_member_imports%rowtype;
  staged_row public.organization_member_import_rows%rowtype;
  member public.institute_members%rowtype;
  data jsonb;
  affected integer := 0;
begin
  select * into import_job
  from public.organization_member_imports candidate
  where candidate.id = p_import_id and candidate.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Import not found' using errcode = 'P0002';
  end if;
  if import_job.status = 'COMMITTED' then
    return query select import_job.status, import_job.valid_rows;
    return;
  end if;
  if import_job.status <> 'VALIDATED' or import_job.invalid_rows > 0 then
    raise exception 'Import contains validation errors' using errcode = '22023';
  end if;

  for staged_row in
    select * from public.organization_member_import_rows candidate
    where candidate.import_id = import_job.id and candidate.organization_id = p_organization_id
    order by candidate.row_number
    for update
  loop
    data := staged_row.normalized_data;
    perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || lower(data ->> 'email'), 0));
    select * into member
    from public.institute_members candidate
    where candidate.institute_id = p_organization_id
      and lower(candidate.email) = lower(data ->> 'email')
    for update;

    if found and member.role <> import_job.member_role then
      raise exception 'Existing member has a different role: %', data ->> 'email' using errcode = '23505';
    end if;
    if not found then
      insert into public.institute_members (institute_id, email, role, status)
      values (p_organization_id, lower(data ->> 'email'), import_job.member_role, 'PENDING')
      returning * into member;
    end if;

    insert into public.organization_member_profiles (
      organization_id, membership_id, display_name, phone, alternate_phone,
      roll_number, employee_code, guardian_name, guardian_phone, qualification,
      subject_specialization, joined_on
    ) values (
      p_organization_id,
      member.id,
      data ->> 'displayName',
      data ->> 'phone',
      data ->> 'alternatePhone',
      data ->> 'rollNumber',
      data ->> 'employeeCode',
      data ->> 'guardianName',
      data ->> 'guardianPhone',
      data ->> 'qualification',
      data ->> 'subjectSpecialization',
      nullif(data ->> 'joinedOn', '')::date
    )
    on conflict (membership_id) do update set
      display_name = excluded.display_name,
      phone = excluded.phone,
      alternate_phone = excluded.alternate_phone,
      roll_number = excluded.roll_number,
      employee_code = excluded.employee_code,
      guardian_name = excluded.guardian_name,
      guardian_phone = excluded.guardian_phone,
      qualification = excluded.qualification,
      subject_specialization = excluded.subject_specialization,
      joined_on = excluded.joined_on,
      updated_at = now();

    update public.organization_member_import_rows
    set status = 'COMMITTED', resulting_member_id = member.id
    where id = staged_row.id;
    affected := affected + 1;
  end loop;

  update public.organization_member_imports
  set status = 'COMMITTED', committed_by = p_actor_user_id, committed_at = now()
  where id = import_job.id;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id,
    p_actor_user_id,
    p_actor_role,
    'member_import.committed',
    'organization_member_import',
    import_job.id::text,
    jsonb_build_object('role', import_job.member_role, 'committed_rows', affected)
  );
  return query select 'COMMITTED'::text, affected;
end;
$$;

revoke all on function public.lms_stage_member_import(uuid, text, text, text, text, text, text, jsonb) from public;
revoke all on function public.lms_commit_member_import(uuid, uuid, text, text) from public;
grant execute on function public.lms_stage_member_import(uuid, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.lms_commit_member_import(uuid, uuid, text, text) to service_role;

-- No browser RLS policies are created. Validation payloads can contain PII and
-- are exposed only through membership-verified server routes.
