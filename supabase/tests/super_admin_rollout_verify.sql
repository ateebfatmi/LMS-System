-- Read-only post-migration checks. Use on the approved target after 0030.
begin read only;
set local search_path = pg_catalog, public;

with required_rpc(signature) as (
  values
    ('public.lms_create_invited_institute(text,jsonb)'),
    ('public.lms_manage_initial_owner_invitation(uuid,text,text,text,text,uuid)'),
    ('public.lms_accept_invitation(text,text,text)'),
    ('public.lms_provision_institute(text,uuid,jsonb,text,text,text)'),
    ('public.lms_platform_broadcast(text,jsonb)')
), rpc as (
  select signature, to_regprocedure(signature) as oid from required_rpc
)
select
  (select count(*) = 3 from information_schema.columns
    where table_schema='public' and table_name='organization_invitations'
      and column_name in ('clerk_invitation_id','guardian_relationship','student_member_id'))
    as invitation_columns_present,
  (select bool_and(oid is not null and has_function_privilege('service_role',oid,'EXECUTE')
    and not has_function_privilege('anon',oid,'EXECUTE')
    and not has_function_privilege('authenticated',oid,'EXECUTE')) from rpc)
    as provisioning_rpcs_service_only,
  (select count(*) = 2 and bool_and(rowsecurity) from pg_tables
    where schemaname='public' and tablename in ('institutes','institute_members'))
    as shared_identity_tables_have_rls,
  (select count(*) = 2 from pg_policies where schemaname='public' and tablename='organization_announcements'
    and (policyname,permissive) in (
      ('platform_student_broadcast_read','PERMISSIVE'),
      ('platform_student_broadcast_read_boundary','RESTRICTIVE')
    )) as student_broadcast_policies_present,
  exists (select from public.subscription_plans where id='basic' and is_active) as active_basic_plan;

rollback;
