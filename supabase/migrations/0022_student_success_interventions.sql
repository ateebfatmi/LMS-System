-- Student-success interventions and reviewed revision plans.
-- Risk calculations are advisory and transparent; no automated punitive action
-- or enrollment decision is permitted from these records.

create table if not exists public.organization_student_interventions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_user_id text not null,
  batch_id uuid,
  risk_score integer not null check (risk_score between 0 and 100),
  risk_level text not null check (risk_level in ('LOW', 'WATCH', 'HIGH', 'CRITICAL')),
  reasons jsonb not null default '[]'::jsonb check (jsonb_typeof(reasons) = 'array'),
  recommended_actions jsonb not null default '[]'::jsonb check (jsonb_typeof(recommended_actions) = 'array'),
  action_plan text not null check (char_length(action_plan) between 3 and 5000),
  owner_user_id text,
  next_review_on date,
  status text not null default 'OPEN' check (status in ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'DISMISSED')),
  resolution_notes text,
  created_by text not null,
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, organization_id)
    references public.organization_batches(id, organization_id),
  unique (id, organization_id)
);

create index if not exists organization_student_interventions_queue_idx
  on public.organization_student_interventions(organization_id, status, risk_score desc, next_review_on);
create index if not exists organization_student_interventions_student_idx
  on public.organization_student_interventions(organization_id, student_user_id, created_at desc);
create unique index if not exists organization_student_one_active_intervention_idx
  on public.organization_student_interventions(organization_id, student_user_id)
  where status in ('OPEN', 'IN_PROGRESS');

create table if not exists public.organization_revision_plans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  student_user_id text not null,
  intervention_id uuid,
  title text not null check (char_length(title) between 2 and 180),
  goal text not null check (char_length(goal) between 3 and 2000),
  starts_on date not null,
  target_date date not null check (target_date >= starts_on),
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  status text not null default 'ACTIVE' check (status in ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
  reviewed_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (intervention_id, organization_id)
    references public.organization_student_interventions(id, organization_id),
  unique (id, organization_id)
);

create index if not exists organization_revision_plans_student_idx
  on public.organization_revision_plans(organization_id, student_user_id, status, target_date);

alter table public.organization_student_interventions enable row level security;
alter table public.organization_revision_plans enable row level security;

create policy organization_student_interventions_read
  on public.organization_student_interventions for select using (
    student_user_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_user_id)
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

create policy organization_revision_plans_read
  on public.organization_revision_plans for select using (
    student_user_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_user_id)
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

create or replace function public.lms_student_success_mutation(
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
  intervention public.organization_student_interventions%rowtype;
  created_id uuid;
  target_student text;
  target_batch uuid;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Role cannot manage student-success interventions' using errcode = '42501';
  end if;

  if p_action = 'CREATE_INTERVENTION' then
    target_student := p_payload ->> 'studentUserId';
    target_batch := nullif(p_payload ->> 'batchId', '')::uuid;

    if not exists (
      select 1 from public.institute_members member
      where member.institute_id = p_organization_id
        and member.user_id = target_student
        and member.role = 'STUDENT'
        and member.status = 'ACTIVE'
    ) then
      raise exception 'Active student not found' using errcode = '23503';
    end if;

    if p_actor_role = 'TEACHER' and not exists (
      select 1
      from public.organization_batch_members teacher_batch
      join public.organization_batch_members student_batch
        on student_batch.organization_id = teacher_batch.organization_id
       and student_batch.batch_id = teacher_batch.batch_id
      where teacher_batch.organization_id = p_organization_id
        and teacher_batch.user_id = p_actor_user_id
        and teacher_batch.role = 'TEACHER'
        and student_batch.user_id = target_student
        and student_batch.role = 'STUDENT'
        and (target_batch is null or teacher_batch.batch_id = target_batch)
    ) then
      raise exception 'Teacher is not assigned to this student' using errcode = '42501';
    end if;

    insert into public.organization_student_interventions (
      organization_id, student_user_id, batch_id, risk_score, risk_level,
      reasons, recommended_actions, action_plan, owner_user_id, next_review_on, created_by
    ) values (
      p_organization_id, target_student, target_batch,
      (p_payload ->> 'riskScore')::integer, p_payload ->> 'riskLevel',
      coalesce(p_payload -> 'reasons', '[]'::jsonb),
      coalesce(p_payload -> 'recommendedActions', '[]'::jsonb),
      p_payload ->> 'actionPlan', coalesce(nullif(p_payload ->> 'ownerUserId', ''), p_actor_user_id),
      nullif(p_payload ->> 'nextReviewOn', '')::date, p_actor_user_id
    ) returning id into created_id;

    insert into public.organization_audit_logs (
      organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
    ) values (
      p_organization_id, p_actor_user_id, p_actor_role, 'student_success.intervention_created',
      'student_intervention', created_id::text,
      jsonb_build_object('studentUserId', target_student, 'riskLevel', p_payload ->> 'riskLevel')
    );

  elsif p_action = 'UPDATE_INTERVENTION' then
    select * into intervention
    from public.organization_student_interventions candidate
    where candidate.id = (p_payload ->> 'interventionId')::uuid
      and candidate.organization_id = p_organization_id
    for update;
    if not found then raise exception 'Intervention not found' using errcode = '23503'; end if;

    if p_actor_role = 'TEACHER' and intervention.owner_user_id <> p_actor_user_id then
      raise exception 'Teacher can update only assigned interventions' using errcode = '42501';
    end if;

    update public.organization_student_interventions set
      status = p_payload ->> 'status',
      action_plan = coalesce(nullif(p_payload ->> 'actionPlan', ''), action_plan),
      resolution_notes = nullif(p_payload ->> 'resolutionNotes', ''),
      resolved_by = case when p_payload ->> 'status' in ('RESOLVED', 'DISMISSED') then p_actor_user_id else null end,
      resolved_at = case when p_payload ->> 'status' in ('RESOLVED', 'DISMISSED') then now() else null end,
      updated_at = now()
    where id = intervention.id;
    created_id := intervention.id;

  elsif p_action = 'CREATE_REVISION_PLAN' then
    select * into intervention
    from public.organization_student_interventions candidate
    where candidate.id = (p_payload ->> 'interventionId')::uuid
      and candidate.organization_id = p_organization_id;
    if not found then raise exception 'Intervention not found' using errcode = '23503'; end if;
    if p_actor_role = 'TEACHER' and intervention.owner_user_id <> p_actor_user_id then
      raise exception 'Teacher can plan only assigned interventions' using errcode = '42501';
    end if;

    insert into public.organization_revision_plans (
      organization_id, student_user_id, intervention_id, title, goal,
      starts_on, target_date, items, status, reviewed_by
    ) values (
      p_organization_id, intervention.student_user_id, intervention.id,
      p_payload ->> 'title', p_payload ->> 'goal',
      (p_payload ->> 'startsOn')::date, (p_payload ->> 'targetDate')::date,
      coalesce(p_payload -> 'items', '[]'::jsonb), 'ACTIVE', p_actor_user_id
    ) returning id into created_id;

  else
    raise exception 'Unsupported student-success action' using errcode = '22023';
  end if;

  if p_action <> 'CREATE_INTERVENTION' then
    insert into public.organization_audit_logs (
      organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
    ) values (
      p_organization_id, p_actor_user_id, p_actor_role,
      'student_success.' || lower(p_action),
      case when p_action = 'CREATE_REVISION_PLAN' then 'revision_plan' else 'student_intervention' end,
      created_id::text, p_payload
    );
  end if;

  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

revoke all on function public.lms_student_success_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_student_success_mutation(uuid, text, text, text, jsonb) to service_role;
