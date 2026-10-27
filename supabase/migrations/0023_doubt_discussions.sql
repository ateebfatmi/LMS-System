-- Moderated student doubt threads with batch-scoped faculty access.

create table if not exists public.organization_doubt_threads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_user_id text not null,
  batch_id uuid not null,
  subject text not null check (char_length(subject) between 2 and 120),
  title text not null check (char_length(title) between 3 and 180),
  description text not null check (char_length(description) between 3 and 10000),
  priority text not null default 'NORMAL' check (priority in ('NORMAL', 'HIGH')),
  status text not null default 'OPEN' check (status in ('OPEN', 'ANSWERED', 'RESOLVED', 'CLOSED')),
  assigned_to text,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, organization_id)
    references public.organization_batches(id, organization_id),
  unique (id, organization_id)
);

create table if not exists public.organization_doubt_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  thread_id uuid not null,
  author_user_id text not null,
  author_role text not null check (author_role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT')),
  body text not null check (char_length(body) between 1 and 10000),
  is_internal boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (thread_id, organization_id)
    references public.organization_doubt_threads(id, organization_id) on delete cascade
);

create index if not exists organization_doubt_threads_queue_idx
  on public.organization_doubt_threads(organization_id, status, priority, updated_at desc);
create index if not exists organization_doubt_threads_student_idx
  on public.organization_doubt_threads(organization_id, student_user_id, created_at desc);
create index if not exists organization_doubt_messages_thread_idx
  on public.organization_doubt_messages(organization_id, thread_id, created_at);

alter table public.organization_doubt_threads enable row level security;
alter table public.organization_doubt_messages enable row level security;

create or replace function public.lms_can_access_doubt_thread(target_thread_id uuid, target_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_doubt_threads thread
    where thread.id = target_thread_id
      and thread.organization_id = target_organization_id
      and (
        thread.student_user_id = public.requesting_user_id()
        or public.has_organization_role(
          thread.organization_id,
          array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR']
        )
        or exists (
          select 1 from public.organization_batch_members member
          where member.organization_id = thread.organization_id
            and member.batch_id = thread.batch_id
            and member.user_id = public.requesting_user_id()
            and member.role = 'TEACHER'
        )
      )
  );
$$;

revoke all on function public.lms_can_access_doubt_thread(uuid, uuid) from public;
grant execute on function public.lms_can_access_doubt_thread(uuid, uuid) to authenticated;

create policy organization_doubt_threads_read on public.organization_doubt_threads
  for select using (public.lms_can_access_doubt_thread(id, organization_id));

create policy organization_doubt_messages_read on public.organization_doubt_messages
  for select using (
    public.lms_can_access_doubt_thread(thread_id, organization_id)
    and (
      not is_internal
      or public.has_organization_role(
        organization_id,
        array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
      )
    )
  );

create or replace function public.lms_doubt_mutation(
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
  thread public.organization_doubt_threads%rowtype;
  created_id uuid;
begin
  if p_action = 'CREATE_THREAD' then
    if p_actor_role <> 'STUDENT' then
      raise exception 'Only students can create doubt threads' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.organization_batch_members member
      where member.organization_id = p_organization_id
        and member.batch_id = (p_payload ->> 'batchId')::uuid
        and member.user_id = p_actor_user_id
        and member.role = 'STUDENT'
    ) then
      raise exception 'Student is not enrolled in this batch' using errcode = '42501';
    end if;
    insert into public.organization_doubt_threads (
      organization_id, student_user_id, batch_id, subject, title, description, priority
    ) values (
      p_organization_id, p_actor_user_id, (p_payload ->> 'batchId')::uuid,
      p_payload ->> 'subject', p_payload ->> 'title', p_payload ->> 'description',
      coalesce(p_payload ->> 'priority', 'NORMAL')
    ) returning id into created_id;
    insert into public.organization_doubt_messages (
      organization_id, thread_id, author_user_id, author_role, body
    ) values (
      p_organization_id, created_id, p_actor_user_id, p_actor_role, p_payload ->> 'description'
    );

  else
    select * into thread from public.organization_doubt_threads candidate
    where candidate.id = (p_payload ->> 'threadId')::uuid
      and candidate.organization_id = p_organization_id
    for update;
    if not found then raise exception 'Doubt thread not found' using errcode = '23503'; end if;

    if p_actor_role = 'STUDENT' and thread.student_user_id <> p_actor_user_id then
      raise exception 'Student cannot access this doubt thread' using errcode = '42501';
    end if;
    if p_actor_role = 'TEACHER' and not exists (
      select 1 from public.organization_batch_members member
      where member.organization_id = p_organization_id
        and member.batch_id = thread.batch_id
        and member.user_id = p_actor_user_id
        and member.role = 'TEACHER'
    ) then
      raise exception 'Teacher is not assigned to this batch' using errcode = '42501';
    end if;
    if p_actor_role not in ('STUDENT', 'TEACHER', 'OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR') then
      raise exception 'Role cannot access doubt threads' using errcode = '42501';
    end if;

    if p_action = 'ADD_MESSAGE' then
      if thread.status = 'CLOSED' then raise exception 'Doubt thread is closed' using errcode = '22023'; end if;
      if coalesce((p_payload ->> 'isInternal')::boolean, false) and p_actor_role = 'STUDENT' then
        raise exception 'Students cannot create internal notes' using errcode = '42501';
      end if;
      insert into public.organization_doubt_messages (
        organization_id, thread_id, author_user_id, author_role, body, is_internal
      ) values (
        p_organization_id, thread.id, p_actor_user_id, p_actor_role,
        p_payload ->> 'body', coalesce((p_payload ->> 'isInternal')::boolean, false)
      ) returning id into created_id;
      update public.organization_doubt_threads set
        status = case when p_actor_role = 'STUDENT' then 'OPEN' else 'ANSWERED' end,
        assigned_to = case when p_actor_role = 'TEACHER' then p_actor_user_id else assigned_to end,
        updated_at = now()
      where id = thread.id;

    elsif p_action = 'SET_STATUS' then
      if p_actor_role = 'STUDENT' and p_payload ->> 'status' not in ('OPEN', 'RESOLVED') then
        raise exception 'Student cannot set that status' using errcode = '42501';
      end if;
      update public.organization_doubt_threads set
        status = p_payload ->> 'status',
        resolved_by = case when p_payload ->> 'status' in ('RESOLVED', 'CLOSED') then p_actor_user_id else null end,
        resolved_at = case when p_payload ->> 'status' in ('RESOLVED', 'CLOSED') then now() else null end,
        updated_at = now()
      where id = thread.id;
      created_id := thread.id;
    else
      raise exception 'Unsupported doubt action' using errcode = '22023';
    end if;
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role,
    'doubt.' || lower(p_action),
    case when p_action = 'ADD_MESSAGE' then 'doubt_message' else 'doubt_thread' end,
    created_id::text,
    case
      when p_action = 'ADD_MESSAGE' then jsonb_build_object('threadId', p_payload ->> 'threadId', 'isInternal', coalesce((p_payload ->> 'isInternal')::boolean, false))
      else p_payload - 'description'
    end
  );

  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

revoke all on function public.lms_doubt_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_doubt_mutation(uuid, text, text, text, jsonb) to service_role;
