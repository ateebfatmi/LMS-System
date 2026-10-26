-- Tenant-scoped assignments, deadline enforcement, grading, and resubmission.

create table if not exists public.organization_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  title text not null,
  instructions text not null,
  course_id uuid,
  batch_id uuid,
  student_user_id text,
  available_from timestamptz,
  due_at timestamptz not null,
  max_marks numeric(8,2) not null check (max_marks > 0),
  rubric jsonb not null default '[]'::jsonb,
  allow_late boolean not null default false,
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'CLOSED')),
  created_by text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(course_id, batch_id, student_user_id) = 1),
  check (available_from is null or due_at > available_from),
  foreign key (course_id, organization_id) references public.organization_courses(id, organization_id) on delete cascade,
  foreign key (batch_id, organization_id) references public.organization_batches(id, organization_id) on delete cascade,
  unique (id, organization_id)
);

create table if not exists public.organization_assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  assignment_id uuid not null,
  student_user_id text not null,
  attempt_number integer not null check (attempt_number > 0),
  text_response text,
  status text not null check (status in ('SUBMITTED', 'LATE', 'GRADED', 'RETURNED')),
  submitted_at timestamptz not null default now(),
  grade numeric(8,2),
  feedback text,
  graded_by text,
  graded_at timestamptz,
  check (grade is null or grade >= 0),
  foreign key (assignment_id, organization_id) references public.organization_assignments(id, organization_id) on delete cascade,
  unique (organization_id, assignment_id, student_user_id, attempt_number),
  unique (id, organization_id)
);

create table if not exists public.organization_assignment_submission_files (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  submission_id uuid not null,
  name text not null,
  storage_bucket text not null,
  storage_path text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  foreign key (submission_id, organization_id) references public.organization_assignment_submissions(id, organization_id) on delete cascade,
  unique (organization_id, storage_bucket, storage_path)
);

create index if not exists organization_assignments_due_idx on public.organization_assignments(organization_id, status, due_at);
create index if not exists organization_assignment_submissions_review_idx on public.organization_assignment_submissions(organization_id, assignment_id, status, submitted_at);
create index if not exists organization_assignment_submission_files_submission_idx on public.organization_assignment_submission_files(organization_id, submission_id);

alter table public.organization_assignments enable row level security;
alter table public.organization_assignment_submissions enable row level security;
alter table public.organization_assignment_submission_files enable row level security;

create or replace function public.lms_student_can_access_assignment(
  p_organization_id uuid,
  p_student_user_id text,
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_assignments assignment
    where assignment.id = p_assignment_id and assignment.organization_id = p_organization_id
      and assignment.status = 'PUBLISHED'
      and (assignment.available_from is null or assignment.available_from <= now())
      and (
        assignment.student_user_id = p_student_user_id
        or exists (
          select 1 from public.organization_batch_members enrollment
          where enrollment.organization_id = p_organization_id
            and enrollment.batch_id = assignment.batch_id
            and enrollment.user_id = p_student_user_id and enrollment.role = 'STUDENT'
        )
        or exists (
          select 1
          from public.organization_course_batches link
          join public.organization_batch_members enrollment
            on enrollment.organization_id = link.organization_id and enrollment.batch_id = link.batch_id
          where link.organization_id = p_organization_id and link.course_id = assignment.course_id
            and enrollment.user_id = p_student_user_id and enrollment.role = 'STUDENT'
        )
      )
  );
$$;

create or replace function public.lms_actor_can_manage_assignment(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_assignment_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_assignments assignment
    where assignment.id = p_assignment_id and assignment.organization_id = p_organization_id
      and (
        p_actor_role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR')
        or (
          p_actor_role = 'TEACHER'
          and (
            (assignment.course_id is not null and public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, assignment.course_id))
            or exists (
              select 1 from public.organization_batch_members teacher_enrollment
              where teacher_enrollment.organization_id = p_organization_id
                and teacher_enrollment.batch_id = assignment.batch_id
                and teacher_enrollment.user_id = p_actor_user_id and teacher_enrollment.role = 'TEACHER'
            )
            or exists (
              select 1
              from public.organization_batch_members teacher_enrollment
              join public.organization_batch_members student_enrollment
                on student_enrollment.organization_id = teacher_enrollment.organization_id
                and student_enrollment.batch_id = teacher_enrollment.batch_id
              where teacher_enrollment.organization_id = p_organization_id
                and teacher_enrollment.user_id = p_actor_user_id and teacher_enrollment.role = 'TEACHER'
                and student_enrollment.user_id = assignment.student_user_id and student_enrollment.role = 'STUDENT'
            )
          )
        )
      )
  );
$$;

create or replace function public.can_access_organization_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_assignments assignment
    where assignment.id = target_assignment_id
      and public.has_organization_role(assignment.organization_id, array['STUDENT'])
      and public.lms_student_can_access_assignment(assignment.organization_id, public.requesting_user_id(), assignment.id)
  );
$$;

create or replace function public.can_manage_organization_assignment(target_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_assignments assignment
    where assignment.id = target_assignment_id
      and (
        public.has_organization_role(assignment.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
        or (
          public.has_organization_role(assignment.organization_id, array['TEACHER'])
          and public.lms_actor_can_manage_assignment(
            assignment.organization_id, public.requesting_user_id(), 'TEACHER', assignment.id
          )
        )
      )
  );
$$;

create policy organization_assignments_read on public.organization_assignments
  for select using (
    public.can_manage_organization_assignment(id)
    or public.can_access_organization_assignment(id)
  );
create policy organization_assignment_submissions_read on public.organization_assignment_submissions
  for select using (
    student_user_id = public.requesting_user_id()
    or public.can_manage_organization_assignment(assignment_id)
  );
create policy organization_assignment_submission_files_read on public.organization_assignment_submission_files
  for select using (
    exists (
      select 1 from public.organization_assignment_submissions submission
      where submission.id = submission_id
        and submission.organization_id = organization_assignment_submission_files.organization_id
        and (
          submission.student_user_id = public.requesting_user_id()
          or public.can_manage_organization_assignment(submission.assignment_id)
        )
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-submissions', 'organization-submissions', false, 10485760,
  array[
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
create or replace function public.lms_assignment_mutation(
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
  assignment public.organization_assignments%rowtype;
  submission public.organization_assignment_submissions%rowtype;
  attempt_count integer;
  target_course_id uuid;
begin
  if p_action = 'CREATE_ASSIGNMENT' then
    if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
      raise exception 'Role cannot create assignments' using errcode = '42501';
    end if;
    if nullif(p_payload ->> 'courseId', '') is not null then
      target_course_id := (p_payload ->> 'courseId')::uuid;
      if not exists (select 1 from public.organization_courses where id = target_course_id and organization_id = p_organization_id)
      then raise exception 'Course not found' using errcode = '23503'; end if;
      if p_actor_role = 'TEACHER' and not public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, target_course_id)
      then raise exception 'Teacher is not assigned to course' using errcode = '42501'; end if;
    elsif nullif(p_payload ->> 'batchId', '') is not null then
      if not exists (
        select 1 from public.organization_batches batch
        where batch.id = (p_payload ->> 'batchId')::uuid and batch.organization_id = p_organization_id
          and (p_actor_role <> 'TEACHER' or exists (
            select 1 from public.organization_batch_members enrollment
            where enrollment.organization_id = p_organization_id and enrollment.batch_id = batch.id
              and enrollment.user_id = p_actor_user_id and enrollment.role = 'TEACHER'
          ))
      ) then raise exception 'Batch not found or not assigned' using errcode = '23503'; end if;
    elsif nullif(p_payload ->> 'studentUserId', '') is not null then
      if not exists (
        select 1 from public.institute_members member
        where member.institute_id = p_organization_id and member.user_id = p_payload ->> 'studentUserId'
          and member.role = 'STUDENT' and member.status = 'ACTIVE'
      ) then raise exception 'Student not found' using errcode = '23503'; end if;
      if p_actor_role = 'TEACHER' and not exists (
        select 1 from public.organization_batch_members teacher_enrollment
        join public.organization_batch_members student_enrollment
          on student_enrollment.organization_id = teacher_enrollment.organization_id
          and student_enrollment.batch_id = teacher_enrollment.batch_id
        where teacher_enrollment.organization_id = p_organization_id
          and teacher_enrollment.user_id = p_actor_user_id and teacher_enrollment.role = 'TEACHER'
          and student_enrollment.user_id = p_payload ->> 'studentUserId' and student_enrollment.role = 'STUDENT'
      ) then raise exception 'Teacher is not assigned to student' using errcode = '42501'; end if;
    else raise exception 'Assignment target required' using errcode = '22023';
    end if;
    insert into public.organization_assignments (
      organization_id, title, instructions, course_id, batch_id, student_user_id, available_from, due_at,
      max_marks, rubric, allow_late, max_attempts, created_by
    ) values (
      p_organization_id, p_payload ->> 'title', p_payload ->> 'instructions', nullif(p_payload ->> 'courseId', '')::uuid,
      nullif(p_payload ->> 'batchId', '')::uuid, nullif(p_payload ->> 'studentUserId', ''),
      nullif(p_payload ->> 'availableFrom', '')::timestamptz, (p_payload ->> 'dueAt')::timestamptz,
      (p_payload ->> 'maxMarks')::numeric, coalesce(p_payload -> 'rubric', '[]'::jsonb),
      coalesce((p_payload ->> 'allowLate')::boolean, false), coalesce((p_payload ->> 'maxAttempts')::integer, 1), p_actor_user_id
    ) returning id into created_id;
  elsif p_action = 'PUBLISH_ASSIGNMENT' then
    select * into assignment from public.organization_assignments candidate
    where candidate.id = (p_payload ->> 'assignmentId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found or not public.lms_actor_can_manage_assignment(p_organization_id, p_actor_user_id, p_actor_role, assignment.id)
    then raise exception 'Assignment not found' using errcode = '42501'; end if;
    update public.organization_assignments set status = case when (p_payload ->> 'published')::boolean then 'PUBLISHED' else 'DRAFT' end, updated_at = now()
    where id = assignment.id returning id into created_id;
  elsif p_action = 'SUBMIT_ASSIGNMENT' then
    if p_actor_role <> 'STUDENT' then raise exception 'Only students submit assignments' using errcode = '42501'; end if;
    select * into assignment from public.organization_assignments candidate
    where candidate.id = (p_payload ->> 'assignmentId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found or not public.lms_student_can_access_assignment(p_organization_id, p_actor_user_id, assignment.id)
    then raise exception 'Assignment is unavailable' using errcode = '42501'; end if;
    if now() > assignment.due_at and not assignment.allow_late then raise exception 'Assignment deadline has passed' using errcode = '22023'; end if;
    select count(*)::integer into attempt_count from public.organization_assignment_submissions
    where organization_id = p_organization_id and assignment_id = assignment.id and student_user_id = p_actor_user_id;
    if attempt_count >= assignment.max_attempts then raise exception 'Maximum attempts reached' using errcode = '22023'; end if;
    if attempt_count > 0 and coalesce((
      select status from public.organization_assignment_submissions
      where organization_id = p_organization_id and assignment_id = assignment.id
        and student_user_id = p_actor_user_id
      order by attempt_number desc limit 1
    ), '') <> 'RETURNED' then raise exception 'Resubmission is not permitted yet' using errcode = '22023'; end if;
    insert into public.organization_assignment_submissions (
      organization_id, assignment_id, student_user_id, attempt_number, text_response, status
    ) values (
      p_organization_id, assignment.id, p_actor_user_id, attempt_count + 1, nullif(p_payload ->> 'textResponse', ''),
      case when now() > assignment.due_at then 'LATE' else 'SUBMITTED' end
    ) returning id into created_id;
    if nullif(p_payload ->> 'storagePath', '') is not null then
      insert into public.organization_assignment_submission_files (
        organization_id, submission_id, name, storage_bucket, storage_path, mime_type, byte_size, sha256
      ) values (
        p_organization_id, created_id, p_payload ->> 'fileName', p_payload ->> 'storageBucket',
        p_payload ->> 'storagePath', p_payload ->> 'mimeType', (p_payload ->> 'byteSize')::bigint, p_payload ->> 'sha256'
      );
    end if;
  elsif p_action in ('GRADE_SUBMISSION', 'RETURN_SUBMISSION') then
    select * into submission from public.organization_assignment_submissions candidate
    where candidate.id = (p_payload ->> 'submissionId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found or not public.lms_actor_can_manage_assignment(p_organization_id, p_actor_user_id, p_actor_role, submission.assignment_id)
    then raise exception 'Submission not found' using errcode = '42501'; end if;
    select * into assignment from public.organization_assignments where id = submission.assignment_id and organization_id = p_organization_id;
    if p_action = 'GRADE_SUBMISSION' then
      if (p_payload ->> 'grade')::numeric > assignment.max_marks then raise exception 'Grade exceeds maximum marks' using errcode = '22023'; end if;
      update public.organization_assignment_submissions
      set status = 'GRADED', grade = (p_payload ->> 'grade')::numeric, feedback = nullif(p_payload ->> 'feedback', ''), graded_by = p_actor_user_id, graded_at = now()
      where id = submission.id returning id into created_id;
    else
      if submission.attempt_number >= assignment.max_attempts then
        raise exception 'No resubmission attempts remain' using errcode = '22023';
      end if;
      update public.organization_assignment_submissions
      set status = 'RETURNED', feedback = nullif(p_payload ->> 'feedback', ''), graded_by = p_actor_user_id, graded_at = now()
      where id = submission.id returning id into created_id;
    end if;
  else raise exception 'Unsupported assignment action' using errcode = '22023';
  end if;

  if p_action <> 'SUBMIT_ASSIGNMENT' then
    insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
    values (p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'assignment', created_id::text, p_payload);
  end if;
  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

create or replace function public.lms_get_assignment_file(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_file_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', file.id, 'name', file.name, 'storageBucket', file.storage_bucket,
    'storagePath', file.storage_path, 'mimeType', file.mime_type
  )
  from public.organization_assignment_submission_files file
  join public.organization_assignment_submissions submission
    on submission.id = file.submission_id and submission.organization_id = file.organization_id
  where file.id = p_file_id and file.organization_id = p_organization_id
    and (
      submission.student_user_id = p_actor_user_id
      or public.lms_actor_can_manage_assignment(p_organization_id, p_actor_user_id, p_actor_role, submission.assignment_id)
    );
$$;

revoke all on function public.lms_student_can_access_assignment(uuid, text, uuid) from public;
revoke all on function public.lms_actor_can_manage_assignment(uuid, text, text, uuid) from public;
revoke all on function public.lms_assignment_mutation(uuid, text, text, text, jsonb) from public;
revoke all on function public.lms_get_assignment_file(uuid, text, text, uuid) from public;
revoke all on function public.can_access_organization_assignment(uuid) from public;
revoke all on function public.can_manage_organization_assignment(uuid) from public;
grant execute on function public.lms_student_can_access_assignment(uuid, text, uuid) to service_role;
grant execute on function public.lms_actor_can_manage_assignment(uuid, text, text, uuid) to service_role;
grant execute on function public.lms_assignment_mutation(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.lms_get_assignment_file(uuid, text, text, uuid) to service_role;
grant execute on function public.can_access_organization_assignment(uuid) to authenticated;
grant execute on function public.can_manage_organization_assignment(uuid) to authenticated;
