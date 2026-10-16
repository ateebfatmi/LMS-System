-- Tenant-scoped learning delivery, private resources, release rules, and progress.

alter table public.organization_course_modules add column if not exists is_published boolean not null default false;
alter table public.organization_course_modules add column if not exists release_at timestamptz;
alter table public.organization_course_modules add column if not exists updated_at timestamptz not null default now();

alter table public.organization_course_lessons add column if not exists description text;
alter table public.organization_course_lessons add column if not exists learning_objectives text[] not null default '{}';
alter table public.organization_course_lessons add column if not exists release_at timestamptz;
alter table public.organization_course_lessons add column if not exists updated_at timestamptz not null default now();
alter table public.organization_course_lessons alter column is_published set default false;

create table if not exists public.organization_course_batches (
  organization_id uuid not null references public.institutes(id) on delete cascade,
  course_id uuid not null,
  batch_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (organization_id, course_id, batch_id),
  foreign key (course_id, organization_id) references public.organization_courses(id, organization_id) on delete cascade,
  foreign key (batch_id, organization_id) references public.organization_batches(id, organization_id) on delete cascade
);

create table if not exists public.organization_lesson_resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  lesson_id uuid not null,
  name text not null,
  resource_type text not null check (resource_type in ('FILE', 'EXTERNAL_LINK')),
  storage_bucket text,
  storage_path text,
  external_url text,
  mime_type text,
  byte_size bigint check (byte_size is null or byte_size > 0),
  sha256 text check (sha256 is null or sha256 ~ '^[a-f0-9]{64}$'),
  download_allowed boolean not null default true,
  processing_status text not null default 'READY' check (processing_status in ('PENDING', 'READY', 'REJECTED')),
  created_by text not null,
  created_at timestamptz not null default now(),
  check (
    (resource_type = 'FILE' and storage_bucket is not null and storage_path is not null and external_url is null)
    or (resource_type = 'EXTERNAL_LINK' and external_url is not null and storage_bucket is null and storage_path is null)
  ),
  foreign key (lesson_id, organization_id) references public.organization_course_lessons(id, organization_id) on delete cascade,
  unique (organization_id, storage_bucket, storage_path)
);

create table if not exists public.organization_lesson_progress (
  organization_id uuid not null references public.institutes(id) on delete cascade,
  lesson_id uuid not null,
  user_id text not null,
  progress_percent integer not null default 0 check (progress_percent between 0 and 100),
  last_accessed_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (organization_id, lesson_id, user_id),
  foreign key (lesson_id, organization_id) references public.organization_course_lessons(id, organization_id) on delete cascade
);

create index if not exists organization_course_batches_batch_idx on public.organization_course_batches(organization_id, batch_id);
create index if not exists organization_lesson_resources_lesson_idx on public.organization_lesson_resources(organization_id, lesson_id);
create index if not exists organization_lesson_progress_user_idx on public.organization_lesson_progress(organization_id, user_id, last_accessed_at desc);

alter table public.organization_course_batches enable row level security;
alter table public.organization_lesson_resources enable row level security;
alter table public.organization_lesson_progress enable row level security;

create or replace function public.can_access_organization_course(target_course_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_courses course
    where course.id = target_course_id
      and (
        public.has_organization_role(course.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
        or (
          exists (
            select 1
            from public.organization_course_batches link
            join public.organization_batch_members enrollment
              on enrollment.organization_id = link.organization_id and enrollment.batch_id = link.batch_id
            where link.organization_id = course.organization_id
              and link.course_id = course.id
              and enrollment.user_id = public.requesting_user_id()
              and (
                (enrollment.role = 'TEACHER' and public.has_organization_role(course.organization_id, array['TEACHER']))
                or (
                  enrollment.role = 'STUDENT'
                  and course.status = 'PUBLISHED'
                  and public.has_organization_role(course.organization_id, array['STUDENT'])
                )
              )
          )
        )
      )
  );
$$;

drop policy if exists org_modules_read on public.organization_course_modules;
create policy org_modules_read on public.organization_course_modules
  for select using (
    public.can_access_organization_course(course_id)
    and (
      public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
      or (is_published and (release_at is null or release_at <= now()))
    )
  );

drop policy if exists org_modules_manage on public.organization_course_modules;
create policy org_modules_manage on public.organization_course_modules
  for all using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
    and public.can_access_organization_course(course_id)
  )
  with check (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
    and public.can_access_organization_course(course_id)
  );

drop policy if exists org_lessons_read on public.organization_course_lessons;
create policy org_lessons_read on public.organization_course_lessons
  for select using (
    exists (
      select 1 from public.organization_course_modules module
      where module.id = module_id
        and module.organization_id = organization_course_lessons.organization_id
        and public.has_organization_role(module.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
        and public.can_access_organization_course(module.course_id)
        and (
          public.has_organization_role(module.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
          or (
            module.is_published and (module.release_at is null or module.release_at <= now())
            and organization_course_lessons.is_published
            and (organization_course_lessons.release_at is null or organization_course_lessons.release_at <= now())
          )
        )
    )
  );

drop policy if exists org_lessons_manage on public.organization_course_lessons;
create policy org_lessons_manage on public.organization_course_lessons
  for all using (
    exists (
      select 1 from public.organization_course_modules module
      where module.id = module_id
        and module.organization_id = organization_course_lessons.organization_id
        and public.has_organization_role(module.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
        and public.can_access_organization_course(module.course_id)
    )
  )
  with check (
    exists (
      select 1 from public.organization_course_modules module
      where module.id = module_id
        and module.organization_id = organization_course_lessons.organization_id
        and public.can_access_organization_course(module.course_id)
    )
  );

create policy organization_course_batches_read on public.organization_course_batches
  for select using (
    public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or exists (
      select 1 from public.organization_batch_members enrollment
      where enrollment.organization_id = organization_course_batches.organization_id
        and enrollment.batch_id = organization_course_batches.batch_id
        and enrollment.user_id = public.requesting_user_id()
    )
  );
create policy organization_course_batches_manage on public.organization_course_batches
  for all using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR']))
  with check (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR']));

create policy organization_lesson_resources_read on public.organization_lesson_resources
  for select using (
    exists (
      select 1
      from public.organization_course_lessons lesson
      join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
      where lesson.id = lesson_id
        and lesson.organization_id = organization_lesson_resources.organization_id
        and public.has_organization_role(lesson.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
        and public.can_access_organization_course(module.course_id)
        and (
          public.has_organization_role(lesson.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
          or (
            module.is_published and (module.release_at is null or module.release_at <= now())
            and lesson.is_published and (lesson.release_at is null or lesson.release_at <= now())
          )
        )
    )
  );
create policy organization_lesson_resources_manage on public.organization_lesson_resources
  for all using (
    exists (
      select 1
      from public.organization_course_lessons lesson
      join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
      where lesson.id = lesson_id
        and lesson.organization_id = organization_lesson_resources.organization_id
        and public.has_organization_role(lesson.organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'])
        and public.can_access_organization_course(module.course_id)
    )
  )
  with check (
    exists (
      select 1
      from public.organization_course_lessons lesson
      join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
      where lesson.id = lesson_id
        and lesson.organization_id = organization_lesson_resources.organization_id
        and public.can_access_organization_course(module.course_id)
    )
  );

create policy organization_lesson_progress_read on public.organization_lesson_progress
  for select using (
    user_id = public.requesting_user_id()
    or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
    or (
      public.has_organization_role(organization_id, array['TEACHER'])
      and exists (
        select 1
        from public.organization_course_lessons lesson
        join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
        where lesson.id = lesson_id
          and lesson.organization_id = organization_lesson_progress.organization_id
          and public.can_access_organization_course(module.course_id)
      )
    )
  );
create policy organization_lesson_progress_self_write on public.organization_lesson_progress
  for all using (user_id = public.requesting_user_id()) with check (user_id = public.requesting_user_id());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'organization-learning',
  'organization-learning',
  false,
  26214400,
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

create or replace function public.lms_actor_can_access_course(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_course_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_courses course
    where course.id = p_course_id and course.organization_id = p_organization_id
      and (
        p_actor_role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR')
        or (
          p_actor_role in ('STUDENT', 'TEACHER')
          and (p_actor_role = 'TEACHER' or course.status = 'PUBLISHED')
          and exists (
            select 1
            from public.organization_course_batches link
            join public.organization_batch_members enrollment
              on enrollment.organization_id = link.organization_id and enrollment.batch_id = link.batch_id
            where link.organization_id = p_organization_id and link.course_id = course.id
              and enrollment.user_id = p_actor_user_id and enrollment.role = p_actor_role
          )
        )
      )
  );
$$;

create or replace function public.lms_learning_mutation(
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
  target_course_id uuid;
  target_module_id uuid;
  target_lesson_id uuid;
  result jsonb;
begin
  if p_action <> 'MARK_COMPLETE' and p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then
    raise exception 'Role cannot manage learning content' using errcode = '42501';
  end if;
  if p_actor_role = 'TEACHER' and p_action in ('LINK_BATCH', 'PUBLISH_COURSE') then
    raise exception 'Teachers cannot assign batches or publish courses' using errcode = '42501';
  end if;

  if p_action = 'LINK_BATCH' then
    target_course_id := (p_payload ->> 'courseId')::uuid;
    if not exists (select 1 from public.organization_courses where id = target_course_id and organization_id = p_organization_id)
      or not exists (select 1 from public.organization_batches where id = (p_payload ->> 'batchId')::uuid and organization_id = p_organization_id)
    then raise exception 'Course or batch not found' using errcode = '23503'; end if;
    insert into public.organization_course_batches (organization_id, course_id, batch_id)
    values (p_organization_id, target_course_id, (p_payload ->> 'batchId')::uuid)
    on conflict do nothing;
    created_id := target_course_id;
  elsif p_action = 'CREATE_MODULE' then
    target_course_id := (p_payload ->> 'courseId')::uuid;
    if not exists (select 1 from public.organization_courses where id = target_course_id and organization_id = p_organization_id)
    then raise exception 'Course not found' using errcode = '23503'; end if;
    insert into public.organization_course_modules (organization_id, course_id, title, description, order_index, is_published, release_at)
    values (p_organization_id, target_course_id, p_payload ->> 'title', nullif(p_payload ->> 'description', ''), coalesce((p_payload ->> 'orderIndex')::integer, 0), false, nullif(p_payload ->> 'releaseAt', '')::timestamptz)
    returning id into created_id;
  elsif p_action = 'CREATE_LESSON' then
    target_module_id := (p_payload ->> 'moduleId')::uuid;
    select course_id into target_course_id from public.organization_course_modules
    where id = target_module_id and organization_id = p_organization_id;
    if not found then raise exception 'Module not found' using errcode = '23503'; end if;
    insert into public.organization_course_lessons (
      organization_id, module_id, title, kind, description, learning_objectives, duration_minutes, order_index, is_published, release_at
    ) values (
      p_organization_id, target_module_id, p_payload ->> 'title', p_payload ->> 'kind', nullif(p_payload ->> 'description', ''),
      array(select jsonb_array_elements_text(coalesce(p_payload -> 'learningObjectives', '[]'::jsonb))),
      nullif(p_payload ->> 'durationMinutes', '')::integer, coalesce((p_payload ->> 'orderIndex')::integer, 0), false,
      nullif(p_payload ->> 'releaseAt', '')::timestamptz
    ) returning id into created_id;
  elsif p_action = 'REORDER_MODULE' then
    update public.organization_course_modules set order_index = (p_payload ->> 'orderIndex')::integer, updated_at = now()
    where id = (p_payload ->> 'moduleId')::uuid and organization_id = p_organization_id
    returning id, course_id into created_id, target_course_id;
    if not found then raise exception 'Module not found' using errcode = '23503'; end if;
  elsif p_action in ('PUBLISH_COURSE', 'PUBLISH_MODULE', 'PUBLISH_LESSON') then
    if p_action = 'PUBLISH_COURSE' then
      target_course_id := (p_payload ->> 'courseId')::uuid;
      update public.organization_courses set status = case when (p_payload ->> 'published')::boolean then 'PUBLISHED' else 'DRAFT' end, updated_at = now()
      where id = target_course_id and organization_id = p_organization_id returning id into created_id;
    elsif p_action = 'PUBLISH_MODULE' then
      update public.organization_course_modules set is_published = (p_payload ->> 'published')::boolean, updated_at = now()
      where id = (p_payload ->> 'moduleId')::uuid and organization_id = p_organization_id returning id, course_id into created_id, target_course_id;
    else
      update public.organization_course_lessons set is_published = (p_payload ->> 'published')::boolean, updated_at = now()
      where id = (p_payload ->> 'lessonId')::uuid and organization_id = p_organization_id returning id, module_id into created_id, target_module_id;
      select course_id into target_course_id from public.organization_course_modules
      where id = target_module_id and organization_id = p_organization_id;
    end if;
    if not found then raise exception 'Learning record not found' using errcode = '23503'; end if;
  elsif p_action in ('CREATE_EXTERNAL_RESOURCE', 'REGISTER_FILE_RESOURCE') then
    target_lesson_id := (p_payload ->> 'lessonId')::uuid;
    select module.course_id into target_course_id
    from public.organization_course_lessons lesson
    join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
    where lesson.id = target_lesson_id and lesson.organization_id = p_organization_id;
    if not found then raise exception 'Lesson not found' using errcode = '23503'; end if;
    insert into public.organization_lesson_resources (
      organization_id, lesson_id, name, resource_type, storage_bucket, storage_path, external_url,
      mime_type, byte_size, sha256, download_allowed, processing_status, created_by
    ) values (
      p_organization_id, target_lesson_id, p_payload ->> 'name',
      case when p_action = 'REGISTER_FILE_RESOURCE' then 'FILE' else 'EXTERNAL_LINK' end,
      case when p_action = 'REGISTER_FILE_RESOURCE' then p_payload ->> 'storageBucket' end,
      case when p_action = 'REGISTER_FILE_RESOURCE' then p_payload ->> 'storagePath' end,
      case when p_action = 'CREATE_EXTERNAL_RESOURCE' then p_payload ->> 'externalUrl' end,
      nullif(p_payload ->> 'mimeType', ''), nullif(p_payload ->> 'byteSize', '')::bigint,
      nullif(p_payload ->> 'sha256', ''), coalesce((p_payload ->> 'downloadAllowed')::boolean, true),
      'READY', p_actor_user_id
    ) returning id into created_id;
  elsif p_action = 'MARK_COMPLETE' then
    target_lesson_id := (p_payload ->> 'lessonId')::uuid;
    select module.course_id into target_course_id
    from public.organization_course_lessons lesson
    join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
    where lesson.id = target_lesson_id and lesson.organization_id = p_organization_id
      and lesson.is_published and (lesson.release_at is null or lesson.release_at <= now())
      and module.is_published and (module.release_at is null or module.release_at <= now());
    if not found or not public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, target_course_id)
    then raise exception 'Lesson is not available' using errcode = '42501'; end if;
    insert into public.organization_lesson_progress (organization_id, lesson_id, user_id, progress_percent, completed_at)
    values (p_organization_id, target_lesson_id, p_actor_user_id, 100, now())
    on conflict (organization_id, lesson_id, user_id) do update
      set progress_percent = 100, completed_at = coalesce(organization_lesson_progress.completed_at, now()), last_accessed_at = now();
    created_id := target_lesson_id;
  else
    raise exception 'Unsupported learning action' using errcode = '22023';
  end if;

  if p_actor_role = 'TEACHER' and target_course_id is not null
    and not public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, target_course_id)
  then raise exception 'Teacher is not assigned to this course' using errcode = '42501'; end if;

  result := jsonb_build_object('id', created_id, 'action', p_action);
  if p_action <> 'MARK_COMPLETE' then
    insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
    values (p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'learning_content', created_id::text, p_payload);
  end if;
  return result;
end;
$$;

create or replace function public.lms_get_learning_resource(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_resource_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', resource.id, 'name', resource.name, 'resourceType', resource.resource_type,
    'storageBucket', resource.storage_bucket, 'storagePath', resource.storage_path,
    'externalUrl', resource.external_url, 'downloadAllowed', resource.download_allowed,
    'mimeType', resource.mime_type
  )
  from public.organization_lesson_resources resource
  join public.organization_course_lessons lesson on lesson.id = resource.lesson_id and lesson.organization_id = resource.organization_id
  join public.organization_course_modules module on module.id = lesson.module_id and module.organization_id = lesson.organization_id
  where resource.id = p_resource_id and resource.organization_id = p_organization_id
    and resource.processing_status = 'READY'
    and public.lms_actor_can_access_course(p_organization_id, p_actor_user_id, p_actor_role, module.course_id)
    and (
      p_actor_role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER')
      or (
        module.is_published and (module.release_at is null or module.release_at <= now())
        and lesson.is_published and (lesson.release_at is null or lesson.release_at <= now())
      )
    );
$$;

revoke all on function public.lms_actor_can_access_course(uuid, text, text, uuid) from public;
revoke all on function public.lms_learning_mutation(uuid, text, text, text, jsonb) from public;
revoke all on function public.lms_get_learning_resource(uuid, text, text, uuid) from public;
grant execute on function public.lms_actor_can_access_course(uuid, text, text, uuid) to service_role;
grant execute on function public.lms_learning_mutation(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.lms_get_learning_resource(uuid, text, text, uuid) to service_role;
