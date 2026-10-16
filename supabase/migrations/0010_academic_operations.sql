-- Transactional academic operations and conflict-safe timetable slots.

alter table public.organization_room_schedules add column if not exists starts_at time;
alter table public.organization_room_schedules add column if not exists ends_at time;
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'organization_room_schedule_time_check'
  ) then
    alter table public.organization_room_schedules
      add constraint organization_room_schedule_time_check
      check (starts_at is null or (ends_at is not null and ends_at > starts_at));
  end if;
end;
$$;

create or replace function public.prevent_room_schedule_overlap()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.starts_at is null or new.ends_at is null then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.room_id::text || ':' || new.day_of_week, 0));
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.batch_id::text, '') || ':' || new.day_of_week, 1));
  perform pg_advisory_xact_lock(hashtextextended(new.faculty_id || ':' || new.day_of_week, 2));
  if exists (
    select 1 from public.organization_room_schedules existing
    where existing.organization_id = new.organization_id
      and existing.day_of_week = new.day_of_week
      and existing.id <> new.id
      and existing.starts_at is not null
      and existing.starts_at < new.ends_at
      and existing.ends_at > new.starts_at
      and (
        existing.room_id = new.room_id
        or (new.batch_id is not null and existing.batch_id = new.batch_id)
        or existing.faculty_id = new.faculty_id
      )
  ) then
    raise exception 'Room, batch, or faculty schedule overlaps an existing slot' using errcode = '23P01';
  end if;
  return new;
end;
$$;

drop trigger if exists organization_room_schedule_overlap_guard on public.organization_room_schedules;
create trigger organization_room_schedule_overlap_guard
before insert or update on public.organization_room_schedules
for each row execute function public.prevent_room_schedule_overlap();

create or replace function public.lms_academic_mutation(
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
  member public.institute_members%rowtype;
  batch public.organization_batches%rowtype;
  room public.organization_campus_rooms%rowtype;
  result jsonb;
begin
  case p_action
    when 'CREATE_ACADEMIC_YEAR' then
      if coalesce((p_payload ->> 'isActive')::boolean, false) then
        update public.organization_academic_years
        set is_active = false
        where organization_id = p_organization_id and is_active;
      end if;
      insert into public.organization_academic_years (organization_id, name, starts_on, ends_on, is_active)
      values (p_organization_id, p_payload ->> 'name', (p_payload ->> 'startsOn')::date, (p_payload ->> 'endsOn')::date, coalesce((p_payload ->> 'isActive')::boolean, false))
      returning id into created_id;
    when 'CREATE_CAMPUS' then
      insert into public.organization_campuses (organization_id, name, address)
      values (p_organization_id, p_payload ->> 'name', coalesce(p_payload -> 'address', '{}'::jsonb))
      returning id into created_id;
    when 'CREATE_SUBJECT' then
      insert into public.organization_subjects (organization_id, name, code)
      values (p_organization_id, p_payload ->> 'name', nullif(p_payload ->> 'code', ''))
      returning id into created_id;
    when 'CREATE_BATCH' then
      if nullif(p_payload ->> 'campusId', '') is not null and not exists (
        select 1 from public.organization_campuses where id = (p_payload ->> 'campusId')::uuid and organization_id = p_organization_id
      ) then raise exception 'Campus is outside organization' using errcode = '23503'; end if;
      if nullif(p_payload ->> 'academicYearId', '') is not null and not exists (
        select 1 from public.organization_academic_years where id = (p_payload ->> 'academicYearId')::uuid and organization_id = p_organization_id
      ) then raise exception 'Academic year is outside organization' using errcode = '23503'; end if;
      insert into public.organization_batches (organization_id, campus_id, academic_year_id, name, target_exam, grade_level, room_number)
      values (p_organization_id, nullif(p_payload ->> 'campusId', '')::uuid, nullif(p_payload ->> 'academicYearId', '')::uuid, p_payload ->> 'name', p_payload ->> 'targetExam', nullif(p_payload ->> 'gradeLevel', ''), nullif(p_payload ->> 'roomNumber', ''))
      returning id into created_id;
    when 'CREATE_COURSE' then
      if nullif(p_payload ->> 'subjectId', '') is not null and not exists (
        select 1 from public.organization_subjects where id = (p_payload ->> 'subjectId')::uuid and organization_id = p_organization_id
      ) then raise exception 'Subject is outside organization' using errcode = '23503'; end if;
      insert into public.organization_courses (organization_id, subject_id, title, description, status, created_by)
      values (p_organization_id, nullif(p_payload ->> 'subjectId', '')::uuid, p_payload ->> 'title', nullif(p_payload ->> 'description', ''), 'DRAFT', p_actor_user_id)
      returning id into created_id;
    when 'ENROLL_MEMBER' then
      select * into member from public.institute_members candidate
      where candidate.id = (p_payload ->> 'memberId')::uuid and candidate.institute_id = p_organization_id and candidate.status = 'ACTIVE';
      if not found or member.user_id is null or member.role not in ('STUDENT', 'TEACHER') then
        raise exception 'Active student or teacher membership required' using errcode = '23503';
      end if;
      select * into batch from public.organization_batches candidate
      where candidate.id = (p_payload ->> 'batchId')::uuid and candidate.organization_id = p_organization_id;
      if not found then raise exception 'Batch not found' using errcode = '23503'; end if;
      insert into public.organization_batch_members (organization_id, batch_id, user_id, role, roll_number)
      values (p_organization_id, batch.id, member.user_id, member.role, nullif(p_payload ->> 'rollNumber', ''))
      on conflict (batch_id, user_id) do update set role = excluded.role, roll_number = excluded.roll_number
      returning id into created_id;
    when 'CREATE_ROOM' then
      if not exists (select 1 from public.organization_campuses where id = (p_payload ->> 'campusId')::uuid and organization_id = p_organization_id) then
        raise exception 'Campus not found' using errcode = '23503';
      end if;
      insert into public.organization_campus_rooms (organization_id, campus_id, name, capacity, facilities)
      values (p_organization_id, (p_payload ->> 'campusId')::uuid, p_payload ->> 'name', (p_payload ->> 'capacity')::integer, array(select jsonb_array_elements_text(coalesce(p_payload -> 'facilities', '[]'::jsonb))))
      returning id into created_id;
    when 'CREATE_SCHEDULE' then
      select * into room from public.organization_campus_rooms candidate
      where candidate.id = (p_payload ->> 'roomId')::uuid and candidate.organization_id = p_organization_id;
      if not found then raise exception 'Room not found' using errcode = '23503'; end if;
      select * into batch from public.organization_batches candidate
      where candidate.id = (p_payload ->> 'batchId')::uuid and candidate.organization_id = p_organization_id;
      if not found then raise exception 'Batch not found' using errcode = '23503'; end if;
      select * into member from public.institute_members candidate
      where candidate.id = (p_payload ->> 'facultyMemberId')::uuid and candidate.institute_id = p_organization_id
        and candidate.status = 'ACTIVE' and candidate.role in ('TEACHER', 'ACADEMIC_COORDINATOR');
      if not found or member.user_id is null then raise exception 'Active faculty member required' using errcode = '23503'; end if;
      insert into public.organization_room_schedules (
        organization_id, room_id, batch_id, faculty_id, time_slot, subject, day_of_week, starts_at, ends_at
      ) values (
        p_organization_id, room.id, batch.id, member.user_id,
        (p_payload ->> 'startsAt') || '–' || (p_payload ->> 'endsAt'), p_payload ->> 'subject',
        p_payload ->> 'dayOfWeek', (p_payload ->> 'startsAt')::time, (p_payload ->> 'endsAt')::time
      ) returning id into created_id;
    else raise exception 'Unsupported academic action' using errcode = '22023';
  end case;

  result := jsonb_build_object('id', created_id, 'action', p_action);
  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'academic_operation', created_id::text, p_payload
  );
  return result;
end;
$$;

revoke all on function public.lms_academic_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_academic_mutation(uuid, text, text, text, jsonb) to service_role;
