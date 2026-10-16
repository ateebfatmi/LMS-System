-- In-app communications and reviewed, tenant-scoped AI drafts.

alter table public.organization_announcements add column if not exists category text not null default 'GENERAL';
alter table public.organization_announcements add column if not exists status text not null default 'PUBLISHED';
alter table public.organization_announcements add column if not exists channels text[] not null default array['PORTAL']::text[];
alter table public.organization_announcements add column if not exists published_at timestamptz;
alter table public.organization_announcements add column if not exists updated_at timestamptz not null default now();
alter table public.organization_announcements add constraint organization_announcements_category_check check (category in ('ACADEMIC', 'EXAM', 'HOLIDAY', 'FEE', 'GENERAL'));
alter table public.organization_announcements add constraint organization_announcements_status_check check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
alter table public.organization_announcements add constraint organization_announcements_channels_check check (channels <@ array['PORTAL', 'EMAIL', 'SMS', 'WHATSAPP']::text[]);
alter table public.organization_announcements add constraint organization_announcements_id_org_unique unique (id, organization_id);
update public.organization_announcements set published_at = coalesce(published_at, created_at) where status = 'PUBLISHED';

create table if not exists public.organization_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  announcement_id uuid,
  recipient_user_id text not null,
  kind text not null,
  title text not null,
  body text not null,
  action_url text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (announcement_id, organization_id) references public.organization_announcements(id, organization_id) on delete cascade,
  unique (organization_id, announcement_id, recipient_user_id)
);

create table if not exists public.organization_notification_preferences (
  organization_id uuid not null references public.institutes(id) on delete cascade,
  user_id text not null,
  portal_enabled boolean not null default true,
  email_enabled boolean not null default true,
  sms_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table if not exists public.organization_delivery_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  announcement_id uuid not null,
  channel text not null check (channel in ('EMAIL', 'SMS', 'WHATSAPP')),
  status text not null default 'BLOCKED_CONFIG' check (status in ('QUEUED', 'PROCESSING', 'DELIVERED', 'PARTIAL', 'FAILED', 'BLOCKED_CONFIG')),
  provider text,
  recipient_count integer not null default 0,
  delivered_count integer not null default 0,
  failed_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (announcement_id, organization_id) references public.organization_announcements(id, organization_id) on delete cascade,
  unique (organization_id, announcement_id, channel)
);

create table if not exists public.organization_ai_drafts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  feature text not null check (feature in ('ANNOUNCEMENT_DRAFT', 'QUESTION_DRAFTS', 'LESSON_SUMMARY')),
  request_id text not null,
  status text not null default 'PROCESSING' check (status in ('PROCESSING', 'DRAFT', 'APPROVED', 'REJECTED', 'FAILED')),
  input_hash text not null check (input_hash ~ '^[0-9a-f]{64}$'),
  source_references jsonb not null default '[]'::jsonb check (jsonb_typeof(source_references) = 'array'),
  output jsonb not null default '{}'::jsonb check (jsonb_typeof(output) = 'object'),
  model text not null,
  prompt_version text not null,
  input_tokens integer,
  output_tokens integer,
  created_by text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  unique (organization_id, request_id)
);

create index if not exists organization_notifications_recipient_idx on public.organization_notifications(organization_id, recipient_user_id, read_at, created_at desc);
create index if not exists organization_delivery_jobs_status_idx on public.organization_delivery_jobs(organization_id, status, created_at desc);
create index if not exists organization_ai_drafts_idx on public.organization_ai_drafts(organization_id, feature, status, created_at desc);

alter table public.organization_notifications enable row level security;
alter table public.organization_notification_preferences enable row level security;
alter table public.organization_delivery_jobs enable row level security;
alter table public.organization_ai_drafts enable row level security;
create policy organization_notifications_read on public.organization_notifications for select using (recipient_user_id = public.requesting_user_id());
create policy organization_notification_preferences_read on public.organization_notification_preferences for select using (user_id = public.requesting_user_id());
create policy organization_delivery_jobs_read on public.organization_delivery_jobs for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
create policy organization_ai_drafts_read on public.organization_ai_drafts for select using (
  created_by = public.requesting_user_id() or public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
);

drop policy if exists org_announcements_manage on public.organization_announcements;
drop policy if exists org_announcements_read on public.organization_announcements;
create policy org_announcements_read on public.organization_announcements for select using (
  public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR'])
  or (public.has_organization_role(organization_id, array['TEACHER']) and (status = 'PUBLISHED' or created_by = public.requesting_user_id()))
  or (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT']) and status = 'PUBLISHED' and (
    target_audience = 'ALL'
    or (target_audience = 'FACULTY' and public.has_organization_role(organization_id, array['TEACHER']))
    or (target_audience = 'PARENTS' and public.has_organization_role(organization_id, array['PARENT']))
    or (target_audience = 'BATCH' and exists (
      select 1 from public.organization_batch_members member where member.organization_id = organization_announcements.organization_id
        and member.batch_id = organization_announcements.batch_id and member.user_id = public.requesting_user_id()
    ))
  ))
);

create or replace function public.lms_announcement_mutation(
  p_organization_id uuid, p_actor_user_id text, p_actor_role text, p_action text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  announcement public.organization_announcements%rowtype;
  recipient record;
  channel_name text;
begin
  if p_action = 'MARK_READ' then
    update public.organization_notifications set read_at = coalesce(read_at, now())
    where id = (p_payload ->> 'notificationId')::uuid and organization_id = p_organization_id and recipient_user_id = p_actor_user_id;
    if not found then raise exception 'Notification not found' using errcode = '23503'; end if;
    return jsonb_build_object('id', p_payload ->> 'notificationId', 'action', p_action);
  end if;
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER') then raise exception 'Role cannot manage announcements' using errcode = '42501'; end if;
  if p_action = 'CREATE' then
    if p_actor_role = 'TEACHER' and (p_payload ->> 'targetAudience') not in ('BATCH', 'FACULTY') then raise exception 'Teachers may publish only to assigned batches or faculty' using errcode = '42501'; end if;
    if (p_payload ->> 'targetAudience') = 'BATCH' and not exists (
      select 1 from public.organization_batches batch where batch.id = (p_payload ->> 'batchId')::uuid and batch.organization_id = p_organization_id
        and (p_actor_role <> 'TEACHER' or exists (select 1 from public.organization_batch_members member where member.organization_id = p_organization_id and member.batch_id = batch.id and member.user_id = p_actor_user_id and member.role = 'TEACHER'))
    ) then raise exception 'Batch not found or not assigned' using errcode = '42501'; end if;
    insert into public.organization_announcements (
      organization_id, batch_id, title, content, target_audience, priority, category, status, channels, created_by, published_at
    ) values (
      p_organization_id, nullif(p_payload ->> 'batchId', '')::uuid, p_payload ->> 'title', p_payload ->> 'content',
      p_payload ->> 'targetAudience', p_payload ->> 'priority', p_payload ->> 'category', p_payload ->> 'status',
      array(select jsonb_array_elements_text(p_payload -> 'channels')), p_actor_user_id,
      case when p_payload ->> 'status' = 'PUBLISHED' then now() else null end
    ) returning * into announcement;
  elsif p_action = 'PUBLISH' then
    select * into announcement from public.organization_announcements candidate where candidate.id = (p_payload ->> 'announcementId')::uuid and candidate.organization_id = p_organization_id for update;
    if not found then raise exception 'Announcement not found' using errcode = '23503'; end if;
    if p_actor_role = 'TEACHER' and announcement.created_by <> p_actor_user_id then raise exception 'Teacher can publish only own drafts' using errcode = '42501'; end if;
    update public.organization_announcements set status = 'PUBLISHED', published_at = coalesce(published_at, now()), updated_at = now() where id = announcement.id returning * into announcement;
  else raise exception 'Unsupported announcement action' using errcode = '22023';
  end if;

  if announcement.status = 'PUBLISHED' then
    for recipient in
      select distinct member.user_id from public.institute_members member
      where member.institute_id = p_organization_id and member.status = 'ACTIVE' and member.user_id is not null
        and (announcement.target_audience = 'ALL'
          or (announcement.target_audience = 'FACULTY' and member.role in ('OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER'))
          or (announcement.target_audience = 'PARENTS' and member.role = 'PARENT')
          or (announcement.target_audience = 'BATCH' and exists (select 1 from public.organization_batch_members batch_member where batch_member.organization_id = p_organization_id and batch_member.batch_id = announcement.batch_id and batch_member.user_id = member.user_id)))
    loop
      insert into public.organization_notifications (organization_id, announcement_id, recipient_user_id, kind, title, body, action_url)
      values (p_organization_id, announcement.id, recipient.user_id, 'ANNOUNCEMENT', announcement.title, announcement.content, '/dashboard/announcements')
      on conflict (organization_id, announcement_id, recipient_user_id) do nothing;
    end loop;
    foreach channel_name in array announcement.channels loop
      if channel_name <> 'PORTAL' then
        insert into public.organization_delivery_jobs (organization_id, announcement_id, channel, status)
        values (p_organization_id, announcement.id, channel_name, 'BLOCKED_CONFIG')
        on conflict (organization_id, announcement_id, channel) do nothing;
      end if;
    end loop;
  end if;
  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role, 'announcement.' || lower(p_action), 'announcement', announcement.id::text, p_payload);
  return jsonb_build_object('id', announcement.id, 'action', p_action, 'status', announcement.status);
end;
$$;
revoke all on function public.lms_announcement_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_announcement_mutation(uuid, text, text, text, jsonb) to service_role;
