-- Run against a disposable database after migrations.
begin;

insert into public.institutes (id, name, slug, owner_user_id, status, logo_url)
values ('10000000-0000-0000-0000-000000000026', 'Branding A', 'branding-a', 'branding-owner', 'ACTIVE', 'https://example.invalid/old.png'),
       ('20000000-0000-0000-0000-000000000026', 'Branding B', 'branding-b', 'branding-other', 'ACTIVE', null);

insert into public.organization_subscriptions (organization_id, plan_id, status, current_period_end)
values ('10000000-0000-0000-0000-000000000026', 'basic', 'ACTIVE', now() + interval '30 days');

insert into public.institute_members (institute_id, user_id, email, role, status)
values ('10000000-0000-0000-0000-000000000026', 'branding-manager', 'manager@example.invalid', 'COACHING_ADMIN', 'ACTIVE'),
       ('10000000-0000-0000-0000-000000000026', 'branding-teacher', 'teacher@example.invalid', 'TEACHER', 'ACTIVE'),
       ('10000000-0000-0000-0000-000000000026', 'branding-student', 'student@example.invalid', 'STUDENT', 'ACTIVE'),
       ('10000000-0000-0000-0000-000000000026', 'branding-parent', 'parent@example.invalid', 'PARENT', 'ACTIVE');

insert into public.organization_branding (organization_id, updated_by, support_email)
values ('10000000-0000-0000-0000-000000000026', 'branding-owner', 'support@example.invalid');

do $$
declare
  tenant uuid := '10000000-0000-0000-0000-000000000026';
  other uuid := '20000000-0000-0000-0000-000000000026';
  path text := 'organizations/' || tenant::text || '/branding/00000000-0000-0000-0000-000000000001.webp';
  actor text;
begin
  foreach actor in array array['branding-manager','branding-teacher','branding-student','branding-parent','branding-other'] loop
    begin
      perform public.lms_update_institute_branding(tenant, actor, 'Forbidden', null, false, null);
      raise exception 'Branding accepted a write from %', actor;
    exception when insufficient_privilege then null;
    end;
  end loop;

  begin
    perform public.lms_update_institute_branding(other, 'branding-owner', 'Forbidden', null, false, null);
    raise exception 'Branding accepted a cross-tenant write';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.lms_update_institute_branding(other, 'branding-other', 'Forbidden', null, true, path);
    raise exception 'Branding accepted a cross-tenant object path';
  exception when check_violation then null;
  end;
  if (select name from public.institutes where id = other) <> 'Branding B' then
    raise exception 'A rejected logo write changed the institute name';
  end if;

  perform public.lms_update_institute_branding(tenant, 'branding-owner', 'Updated Academy', '#2563EB', true, path);
  if not exists (
    select 1 from public.institutes i join public.organization_branding b on b.organization_id = i.id
    where i.id = tenant and i.name = 'Updated Academy' and i.slug = 'branding-a'
      and i.logo_url = 'https://example.invalid/old.png' and b.primary_color = '#2563EB' and b.logo_storage_path = path
      and b.support_email = 'support@example.invalid'
  ) then raise exception 'Owner update did not preserve institute and support settings'; end if;

  perform public.lms_update_institute_branding(tenant, 'branding-owner', 'Updated Academy', null, false, null);
  if not exists (select 1 from public.organization_branding
    where organization_id = tenant and primary_color is null and logo_storage_path = path)
  then raise exception 'Clearing the accent did not preserve the logo'; end if;

  if public.lms_update_institute_branding(tenant, 'branding-owner', 'Updated Academy', null, true, null)
    is distinct from path then raise exception 'Removal did not return the previous logo'; end if;
  if (select logo_url from public.institutes where id = tenant) is not null then
    raise exception 'Removal did not clear the legacy fallback';
  end if;

  if not exists (select 1 from public.organization_audit_logs where organization_id = tenant
    and actor_user_id = 'branding-owner' and action = 'institute.branding_updated')
  then raise exception 'Branding change was not audited'; end if;

  if has_function_privilege('authenticated', 'public.lms_update_institute_branding(uuid,text,text,text,boolean,text)', 'EXECUTE')
    or has_function_privilege('anon', 'public.lms_update_institute_branding(uuid,text,text,text,boolean,text)', 'EXECUTE')
  then raise exception 'Browser roles can execute the branding mutation'; end if;

  if not exists (select 1 from storage.buckets where id = 'organization-branding'
    and not public and file_size_limit = 2097152 and allowed_mime_types = array['image/webp'])
  then raise exception 'Branding bucket is not private and restricted'; end if;
end $$;

-- A broad policy on the shared Supabase project must not expose branding objects.
alter table storage.objects enable row level security;
grant usage on schema storage to authenticated;
grant select, insert on storage.objects to authenticated;
create policy test_broad_storage_access on storage.objects for all to authenticated using (true) with check (true);
insert into storage.objects (bucket_id, name) values ('organization-branding', 'branding-test.webp');
set local role authenticated;
do $$
begin
  if exists (select 1 from storage.objects where bucket_id = 'organization-branding') then
    raise exception 'Authenticated browser accessed a private logo directly';
  end if;
  begin
    insert into storage.objects (bucket_id, name) values ('organization-branding', 'another-test.webp');
    raise exception 'Authenticated browser uploaded a logo directly';
  exception when insufficient_privilege then null;
  end;
end $$;
reset role;

rollback;
