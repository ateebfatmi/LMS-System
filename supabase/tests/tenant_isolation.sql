-- Run against an isolated database after migrations: psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f this_file
-- The transaction always rolls back. Never point this at production.
begin;

insert into public.institutes (id, name, slug, owner_user_id, status)
values
  ('10000000-0000-0000-0000-000000000001', 'Tenant A', 'security-test-a', 'user-owner-a', 'ACTIVE'),
  ('20000000-0000-0000-0000-000000000002', 'Tenant B', 'security-test-b', 'user-owner-b', 'ACTIVE');

insert into public.organization_subjects (id, organization_id, name)
values
  ('10000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000001', 'Physics A'),
  ('20000000-0000-0000-0000-000000000022', '20000000-0000-0000-0000-000000000002', 'Physics B');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"user-owner-a","role":"authenticated"}', true);

do $$
begin
  if (select count(*) from public.organization_subjects) <> 1 then
    raise exception 'RLS failure: tenant A can see rows outside its organization';
  end if;
  if exists (
    select 1 from public.organization_subjects
    where organization_id = '20000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'RLS failure: tenant B subject leaked to tenant A';
  end if;
end $$;

do $$
begin
  begin
    insert into public.organization_courses (organization_id, subject_id, title, created_by)
    values (
      '10000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000022',
      'Cross-tenant course',
      'user-owner-a'
    );
    raise exception 'Composite tenant constraint failed to reject cross-tenant subject';
  exception when foreign_key_violation then
    null;
  end;
end $$;

rollback;
