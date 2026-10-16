-- Server-authoritative attendance register with immutable correction history.

alter table public.organization_attendance_sessions add column if not exists session_label text not null default 'Daily attendance';
alter table public.organization_attendance_sessions add column if not exists starts_at time;
alter table public.organization_attendance_sessions add column if not exists ends_at time;
alter table public.organization_attendance_sessions add column if not exists finalized_at timestamptz;
alter table public.organization_attendance_sessions add column if not exists updated_at timestamptz not null default now();

alter table public.organization_attendance_sessions
  drop constraint if exists organization_attendance_sessions_batch_id_session_date_key;
create unique index if not exists organization_attendance_session_slot_unique
  on public.organization_attendance_sessions(organization_id, batch_id, session_date, session_label, coalesce(starts_at, '00:00'::time));
alter table public.organization_attendance_records
  add constraint organization_attendance_records_id_org_unique unique (id, organization_id);

create table if not exists public.organization_attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  session_id uuid not null,
  attendance_record_id uuid not null,
  student_id text not null,
  previous_status text not null check (previous_status in ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  corrected_status text not null check (corrected_status in ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
  reason text not null check (char_length(reason) between 3 and 500),
  corrected_by text not null,
  created_at timestamptz not null default now(),
  foreign key (session_id, organization_id) references public.organization_attendance_sessions(id, organization_id) on delete cascade,
  foreign key (attendance_record_id, organization_id) references public.organization_attendance_records(id, organization_id) on delete cascade
);

create index if not exists organization_attendance_corrections_session_idx
  on public.organization_attendance_corrections(organization_id, session_id, created_at desc);

alter table public.organization_attendance_corrections enable row level security;

drop policy if exists org_attendance_sessions_read on public.organization_attendance_sessions;
create policy org_attendance_sessions_read on public.organization_attendance_sessions
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or exists (
      select 1 from public.organization_batch_members member
      where member.organization_id = organization_attendance_sessions.organization_id
        and member.batch_id = organization_attendance_sessions.batch_id
        and member.user_id = public.requesting_user_id()
    )
  );

drop policy if exists org_attendance_records_read on public.organization_attendance_records;
create policy org_attendance_records_read on public.organization_attendance_records
  for select using (
    student_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or exists (
      select 1
      from public.organization_attendance_sessions session
      join public.organization_batch_members member
        on member.organization_id = session.organization_id and member.batch_id = session.batch_id
      where session.id = organization_attendance_records.session_id
        and session.organization_id = organization_attendance_records.organization_id
        and member.user_id = public.requesting_user_id() and member.role = 'TEACHER'
    )
  );

create policy organization_attendance_corrections_read on public.organization_attendance_corrections
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or student_id = public.requesting_user_id()
    or exists (
      select 1
      from public.organization_attendance_sessions session
      join public.organization_batch_members member
        on member.organization_id = session.organization_id and member.batch_id = session.batch_id
      where session.id = organization_attendance_corrections.session_id
        and session.organization_id = organization_attendance_corrections.organization_id
        and member.user_id = public.requesting_user_id() and member.role = 'TEACHER'
    )
  );

-- Browser roles have read-only access. All mutations pass through the audited service RPC.
drop policy if exists org_attendance_sessions_manage on public.organization_attendance_sessions;
drop policy if exists org_attendance_records_manage on public.organization_attendance_records;

create or replace function public.lms_save_attendance(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_batch_id uuid,
  p_session_date date,
  p_session_label text,
  p_starts_at time,
  p_ends_at time,
  p_records jsonb,
  p_correction_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_session public.organization_attendance_sessions%rowtype;
  item jsonb;
  existing_record public.organization_attendance_records%rowtype;
  record_count integer := 0;
  change_count integer := 0;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Role cannot manage attendance' using errcode = '42501';
  end if;
  if p_session_date > current_date + 1 then raise exception 'Future attendance is not permitted' using errcode = '22023'; end if;
  if char_length(trim(p_session_label)) not between 2 and 120 then raise exception 'Invalid session label' using errcode = '22023'; end if;
  if p_starts_at is not null and p_ends_at is not null and p_ends_at <= p_starts_at then raise exception 'Session end must follow start' using errcode = '22023'; end if;
  if jsonb_typeof(p_records) <> 'array' or jsonb_array_length(p_records) > 500 then raise exception 'Invalid attendance records' using errcode = '22023'; end if;

  if not exists (
    select 1 from public.organization_batches batch
    where batch.id = p_batch_id and batch.organization_id = p_organization_id
      and (p_actor_role <> 'TEACHER' or exists (
        select 1 from public.organization_batch_members assigned
        where assigned.organization_id = p_organization_id and assigned.batch_id = batch.id
          and assigned.user_id = p_actor_user_id and assigned.role = 'TEACHER'
      ))
  ) then raise exception 'Batch not found or not assigned' using errcode = '42501'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_batch_id::text || ':' || p_session_date::text || ':' || trim(p_session_label) || ':' || coalesce(p_starts_at::text, ''), 0));
  select * into target_session from public.organization_attendance_sessions candidate
  where candidate.organization_id = p_organization_id and candidate.batch_id = p_batch_id
    and candidate.session_date = p_session_date and candidate.session_label = trim(p_session_label)
    and coalesce(candidate.starts_at, '00:00'::time) = coalesce(p_starts_at, '00:00'::time)
  for update;

  if not found then
    insert into public.organization_attendance_sessions (
      organization_id, batch_id, session_date, session_label, starts_at, ends_at, marked_by
    ) values (
      p_organization_id, p_batch_id, p_session_date, trim(p_session_label), p_starts_at, p_ends_at, p_actor_user_id
    ) returning * into target_session;
  elsif target_session.finalized_at is not null and coalesce(char_length(trim(p_correction_reason)), 0) < 3 then
    raise exception 'A correction reason is required after first submission' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_records)
  loop
    if coalesce(item ->> 'studentId', '') = '' or coalesce(item ->> 'status', '') not in ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED') then
      raise exception 'Invalid attendance record' using errcode = '22023';
    end if;
    if not exists (
      select 1 from public.organization_batch_members enrollment
      where enrollment.organization_id = p_organization_id and enrollment.batch_id = p_batch_id
        and enrollment.user_id = item ->> 'studentId' and enrollment.role = 'STUDENT'
    ) then raise exception 'Student is not enrolled in the batch' using errcode = '23503'; end if;

    select * into existing_record from public.organization_attendance_records candidate
    where candidate.organization_id = p_organization_id and candidate.session_id = target_session.id
      and candidate.student_id = item ->> 'studentId' for update;
    if found then
      if existing_record.status <> item ->> 'status' then
        insert into public.organization_attendance_corrections (
          organization_id, session_id, attendance_record_id, student_id, previous_status,
          corrected_status, reason, corrected_by
        ) values (
          p_organization_id, target_session.id, existing_record.id, existing_record.student_id,
          existing_record.status, item ->> 'status', trim(p_correction_reason), p_actor_user_id
        );
        update public.organization_attendance_records
        set status = item ->> 'status', remarks = nullif(trim(item ->> 'remarks'), '')
        where id = existing_record.id;
        change_count := change_count + 1;
      end if;
    else
      insert into public.organization_attendance_records (
        organization_id, session_id, student_id, status, remarks
      ) values (
        p_organization_id, target_session.id, item ->> 'studentId', item ->> 'status', nullif(trim(item ->> 'remarks'), '')
      );
      change_count := change_count + 1;
    end if;
    record_count := record_count + 1;
  end loop;

  update public.organization_attendance_sessions
  set finalized_at = coalesce(finalized_at, now()), updated_at = now(), ends_at = p_ends_at
  where id = target_session.id;
  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role,
    case when target_session.finalized_at is null then 'attendance.submit' else 'attendance.correct' end,
    'attendance_session', target_session.id::text,
    jsonb_build_object('batchId', p_batch_id, 'sessionDate', p_session_date, 'recordCount', record_count, 'changeCount', change_count, 'reason', p_correction_reason)
  );
  return jsonb_build_object('sessionId', target_session.id, 'recordCount', record_count, 'changeCount', change_count);
end;
$$;

revoke all on function public.lms_save_attendance(uuid, text, text, uuid, date, text, time, time, jsonb, text) from public;
grant execute on function public.lms_save_attendance(uuid, text, text, uuid, date, text, time, time, jsonb, text) to service_role;
