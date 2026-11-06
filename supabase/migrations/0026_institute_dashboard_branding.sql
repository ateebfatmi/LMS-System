begin;

alter table public.organization_branding
  add column logo_storage_path text,
  alter column primary_color drop not null,
  add constraint organization_branding_scoped_logo check (
    logo_storage_path ~ (
      '^organizations/' || organization_id::text ||
      '/branding/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
    )
  );

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('organization-branding', 'organization-branding', false, 2097152, array['image/webp'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Block direct browser access even if the shared project has broader Storage policies.
create policy lms_branding_storage_server_only on storage.objects
  as restrictive for all to anon, authenticated
  using (bucket_id <> 'organization-branding')
  with check (bucket_id <> 'organization-branding');

create function public.lms_update_institute_branding(
  p_organization_id uuid, p_actor_user_id text, p_name text, p_accent_color text,
  p_change_logo boolean, p_logo_storage_path text
)
returns text language plpgsql security definer set search_path = public as $$
declare
  previous_logo_path text;
begin
  -- Serialize branding edits and match the canonical owner rules used by workspace authorization.
  perform 1 from public.institutes
  where id = p_organization_id and status = 'ACTIVE' and owner_user_id = p_actor_user_id
  for update;
  if not found or not exists (
    select 1 from public.institute_members
    where institute_id = p_organization_id and user_id = p_actor_user_id
    having count(*) = 0
      or (count(*) filter (where role = 'OWNER') = 1
        and count(*) filter (where role = 'OWNER' and status = 'ACTIVE') = 1)
      or (count(*) = 1 and count(*) filter (where role = 'COACHING_ADMIN' and status = 'ACTIVE') = 1)
  ) then
    raise exception 'Only the institute owner can update branding' using errcode = '42501';
  end if;

  if p_name is null or char_length(trim(p_name)) not between 1 and 120 then
    raise exception 'Invalid institute name' using errcode = '22023';
  end if;

  select logo_storage_path into previous_logo_path
  from public.organization_branding where organization_id = p_organization_id for update;

  update public.institutes
    set name = trim(p_name), updated_at = now(),
      logo_url = case when p_change_logo and p_logo_storage_path is null then null else logo_url end
    where id = p_organization_id;

  insert into public.organization_branding as branding
    (organization_id, primary_color, logo_storage_path, updated_by)
  values (p_organization_id, p_accent_color, p_logo_storage_path, p_actor_user_id)
  on conflict (organization_id) do update set
    primary_color = excluded.primary_color,
    logo_storage_path = case when p_change_logo then excluded.logo_storage_path else branding.logo_storage_path end,
    logo_url = case when p_change_logo and p_logo_storage_path is null then null else branding.logo_url end,
    updated_by = excluded.updated_by,
    updated_at = now();

  insert into public.organization_audit_logs
    (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, 'OWNER', 'institute.branding_updated', 'institute',
    p_organization_id::text, jsonb_build_object('name', trim(p_name), 'accentColor', p_accent_color,
      'logoChanged', p_change_logo));

  return case when p_change_logo and previous_logo_path is distinct from p_logo_storage_path then previous_logo_path end;
end;
$$;

revoke all on function public.lms_update_institute_branding(uuid,text,text,text,boolean,text) from public, anon, authenticated;
grant execute on function public.lms_update_institute_branding(uuid,text,text,text,boolean,text) to service_role;

commit;
