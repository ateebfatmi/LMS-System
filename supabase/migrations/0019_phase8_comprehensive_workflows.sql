-- Phase 8: Reviewed guardian linking, descriptive grading, support access, AI draft promotion, and payment reconciliation.

-- 1. Reviewed Guardian–Student Linking
create table if not exists public.organization_guardian_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  guardian_user_id text not null,
  student_user_id text not null,
  relationship text not null check (relationship in ('FATHER', 'MOTHER', 'LEGAL_GUARDIAN', 'OTHER')),
  status text not null default 'PENDING_REVIEW' check (status in ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'REVOKED')),
  reviewed_by text,
  reviewed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, guardian_user_id, student_user_id)
);

create index if not exists org_guardian_links_lookup_idx
  on public.organization_guardian_links(organization_id, guardian_user_id, status);
create index if not exists org_guardian_links_student_idx
  on public.organization_guardian_links(organization_id, student_user_id, status);

alter table public.organization_guardian_links enable row level security;

create policy org_guardian_links_read on public.organization_guardian_links
  for select using (
    guardian_user_id = public.requesting_user_id()
    or student_user_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
  );

create or replace function public.is_approved_guardian(
  target_org_id uuid,
  target_student_id text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_guardian_links
    where organization_id = target_org_id
      and student_user_id = target_student_id
      and guardian_user_id = public.requesting_user_id()
      and status = 'APPROVED'
  );
$$;

revoke all on function public.is_approved_guardian(uuid, text) from public;
grant execute on function public.is_approved_guardian(uuid, text) to authenticated;

-- Update RLS on attendance records to allow approved guardians to read only their child's attendance
drop policy if exists org_attendance_records_read on public.organization_attendance_records;
create policy org_attendance_records_read on public.organization_attendance_records
  for select using (
    student_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_id)
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER']
    )
  );

-- Update RLS on student fees to allow approved guardians to view only their linked student's fee ledgers
drop policy if exists org_student_fees_read on public.organization_student_fees;
create policy org_student_fees_read on public.organization_student_fees
  for select using (
    student_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_id)
    or public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACCOUNTANT']
    )
  );

-- 2. Descriptive / Subjective Assessment Evaluation & Moderation
create table if not exists public.organization_descriptive_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  attempt_id uuid not null,
  test_id uuid not null,
  question_id uuid not null,
  student_user_id text not null,
  answer_text text,
  file_url text,
  max_marks numeric(5,2) not null default 5.0 check (max_marks > 0),
  awarded_marks numeric(5,2) check (awarded_marks is null or (awarded_marks >= 0 and awarded_marks <= max_marks)),
  feedback text,
  evaluator_user_id text,
  status text not null default 'PENDING_EVALUATION' check (status in ('PENDING_EVALUATION', 'GRADED', 'MODERATION_REQUESTED', 'MODERATED')),
  moderator_user_id text,
  moderator_notes text,
  graded_at timestamptz,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, attempt_id, question_id)
);

create index if not exists org_descriptive_subs_eval_idx
  on public.organization_descriptive_submissions(organization_id, status, created_at asc);
create index if not exists org_descriptive_subs_student_idx
  on public.organization_descriptive_submissions(organization_id, student_user_id, attempt_id);

alter table public.organization_descriptive_submissions enable row level security;

create policy org_descriptive_subs_read on public.organization_descriptive_submissions
  for select using (
    student_user_id = public.requesting_user_id()
    or public.is_approved_guardian(organization_id, student_user_id)
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
  );

create or replace function public.lms_grade_descriptive_submission(
  p_organization_id uuid,
  p_submission_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_awarded_marks numeric,
  p_feedback text,
  p_is_moderation boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  sub public.organization_descriptive_submissions%rowtype;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Unauthorized to evaluate submissions' using errcode = '42501';
  end if;

  select * into sub
  from public.organization_descriptive_submissions
  where id = p_submission_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Descriptive submission not found' using errcode = '23503';
  end if;

  if p_awarded_marks < 0 or p_awarded_marks > sub.max_marks then
    raise exception 'Awarded marks must be between 0 and %', sub.max_marks using errcode = '22023';
  end if;

  if p_is_moderation then
    if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR') then
      raise exception 'Only administrators can moderate grades' using errcode = '42501';
    end if;
    update public.organization_descriptive_submissions set
      awarded_marks = p_awarded_marks,
      moderator_user_id = p_actor_user_id,
      moderator_notes = p_feedback,
      status = 'MODERATED',
      moderated_at = now(),
      updated_at = now()
    where id = sub.id;
  else
    update public.organization_descriptive_submissions set
      awarded_marks = p_awarded_marks,
      evaluator_user_id = p_actor_user_id,
      feedback = p_feedback,
      status = 'GRADED',
      graded_at = now(),
      updated_at = now()
    where id = sub.id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role,
    case when p_is_moderation then 'assessment.descriptive_moderated' else 'assessment.descriptive_graded' end,
    'descriptive_submission', sub.id::text,
    jsonb_build_object('awardedMarks', p_awarded_marks, 'isModeration', p_is_moderation)
  );

  return jsonb_build_object('submissionId', sub.id, 'status', case when p_is_moderation then 'MODERATED' else 'GRADED' end, 'awardedMarks', p_awarded_marks);
end;
$$;

revoke all on function public.lms_grade_descriptive_submission(uuid, uuid, text, text, numeric, text, boolean) from public;
grant execute on function public.lms_grade_descriptive_submission(uuid, uuid, text, text, numeric, text, boolean) to service_role;

-- 3. Canonical Promotion Workflow for Reviewed AI Drafts
create or replace function public.lms_promote_ai_draft(
  p_organization_id uuid,
  p_draft_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_decision text,
  p_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  draft public.organization_ai_drafts%rowtype;
  promoted_id uuid;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR') then
    raise exception 'Unauthorized to review AI drafts' using errcode = '42501';
  end if;

  if p_decision not in ('APPROVE_AND_PUBLISH', 'APPROVE_AS_DRAFT', 'REJECT') then
    raise exception 'Invalid review decision' using errcode = '22023';
  end if;

  select * into draft
  from public.organization_ai_drafts
  where id = p_draft_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'AI draft not found' using errcode = '23503';
  end if;

  if draft.status not in ('DRAFT', 'PROCESSING') then
    raise exception 'Draft is already in terminal state %', draft.status using errcode = '22023';
  end if;

  if p_decision = 'REJECT' then
    update public.organization_ai_drafts set
      status = 'REJECTED',
      reviewed_by = p_actor_user_id,
      reviewed_at = now(),
      error_message = p_notes
    where id = draft.id;
    return jsonb_build_object('draftId', draft.id, 'status', 'REJECTED');
  end if;

  -- Promotion logic according to feature
  if draft.feature = 'ANNOUNCEMENT_DRAFT' then
    insert into public.organization_announcements (
      organization_id, title, content, target_audience, priority, category,
      status, channels, created_by, published_at
    ) values (
      p_organization_id,
      draft.output ->> 'title',
      draft.output ->> 'content',
      coalesce(draft.output ->> 'targetAudience', 'ALL'),
      coalesce(draft.output ->> 'priority', 'NORMAL'),
      coalesce(draft.output ->> 'category', 'GENERAL'),
      case when p_decision = 'APPROVE_AND_PUBLISH' then 'PUBLISHED' else 'DRAFT' end,
      array['PORTAL']::text[],
      p_actor_user_id,
      case when p_decision = 'APPROVE_AND_PUBLISH' then now() else null end
    ) returning id into promoted_id;
  end if;

  update public.organization_ai_drafts set
    status = 'APPROVED',
    reviewed_by = p_actor_user_id,
    reviewed_at = now()
  where id = draft.id;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role, 'ai_draft.promoted',
    'organization_ai_draft', draft.id::text,
    jsonb_build_object('decision', p_decision, 'promotedId', promoted_id)
  );

  return jsonb_build_object('draftId', draft.id, 'status', 'APPROVED', 'promotedId', promoted_id);
end;
$$;

revoke all on function public.lms_promote_ai_draft(uuid, uuid, text, text, text, text) from public;
grant execute on function public.lms_promote_ai_draft(uuid, uuid, text, text, text, text) to service_role;

-- 4. Approved, Time-Bounded Platform Support Access
create or replace function public.lms_review_support_access(
  p_organization_id uuid,
  p_request_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_decision text,
  p_duration_hours integer default 24
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.platform_support_access_requests%rowtype;
begin
  if p_actor_role <> 'OWNER' then
    raise exception 'Only institute owners can approve support access' using errcode = '42501';
  end if;

  if p_decision not in ('APPROVE', 'REJECT', 'REVOKE') then
    raise exception 'Invalid support access decision' using errcode = '22023';
  end if;

  select * into req
  from public.platform_support_access_requests
  where id = p_request_id and organization_id = p_organization_id
  for update;

  if not found then
    raise exception 'Support access request not found' using errcode = '23503';
  end if;

  if p_decision = 'APPROVE' then
    update public.platform_support_access_requests set
      status = 'APPROVED',
      approved_by = p_actor_user_id,
      expires_at = now() + (least(greatest(p_duration_hours, 1), 72) || ' hours')::interval,
      updated_at = now()
    where id = req.id;
  elsif p_decision = 'REJECT' then
    update public.platform_support_access_requests set
      status = 'REJECTED',
      updated_at = now()
    where id = req.id;
  else
    update public.platform_support_access_requests set
      status = 'REVOKED',
      updated_at = now()
    where id = req.id;
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role, 'support_access.' || lower(p_decision),
    'platform_support_access_request', req.id::text,
    jsonb_build_object('decision', p_decision, 'durationHours', p_duration_hours)
  );

  return jsonb_build_object('requestId', req.id, 'status', p_decision);
end;
$$;

revoke all on function public.lms_review_support_access(uuid, uuid, text, text, text, integer) from public;
grant execute on function public.lms_review_support_access(uuid, uuid, text, text, text, integer) to service_role;
