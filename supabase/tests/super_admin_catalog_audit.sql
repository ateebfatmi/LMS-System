-- Read-only. Run in the Supabase SQL Editor or via psql on the connected project.
-- Outputs schema metadata and aggregate compatibility counts only.
begin read only;
set local search_path = pg_catalog, public;

with inventory as (
select jsonb_build_object(
  'migration_history', case when to_regclass('supabase_migrations.schema_migrations') is not null
    then query_to_xml('select version from supabase_migrations.schema_migrations order by version', false, false, '')::text
    else null end,
  'relations', (select jsonb_agg(jsonb_build_object(
    'schema', n.nspname, 'relation', c.relname, 'kind', c.relkind, 'rls', c.relrowsecurity, 'force_rls', c.relforcerowsecurity,
    'columns', (select jsonb_agg(jsonb_build_object('name', a.attname,
      'type', format_type(a.atttypid,a.atttypmod), 'not_null', a.attnotnull, 'default', pg_get_expr(d.adbin,d.adrelid),
      'column_acl', a.attacl) order by a.attnum)
      from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
    'authenticated_write', array(select v from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) v
      where has_table_privilege('authenticated',c.oid,v)),
    'anon_write', array(select v from unnest(array['INSERT','UPDATE','DELETE','TRUNCATE']) v
      where has_table_privilege('anon',c.oid,v)),
    'service_access', array(select v from unnest(array['SELECT','INSERT','UPDATE','DELETE']) v
      where has_table_privilege('service_role',c.oid,v))) order by n.nspname,c.relname)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','storage') and c.relkind in ('r','p','v','m')),
  'functions', (select jsonb_agg(jsonb_build_object(
    'signature', p.oid::regprocedure::text, 'definition_hash', md5(pg_get_functiondef(p.oid)),
    'security_definer', p.prosecdef, 'anon_execute', has_function_privilege('anon',p.oid,'EXECUTE'),
    'authenticated_execute', has_function_privilege('authenticated',p.oid,'EXECUTE'),
    'service_execute', has_function_privilege('service_role',p.oid,'EXECUTE')) order by p.oid::regprocedure::text)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and not exists (select 1 from pg_depend d where d.classid='pg_proc'::regclass and d.objid=p.oid and d.deptype='e')),
  'policies', (select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname)
    from pg_policies p where schemaname in ('public','storage')),
  'constraints', (select jsonb_agg(jsonb_build_object('relation', c.conrelid::regclass::text, 'name',c.conname,
    'definition',pg_get_constraintdef(c.oid),'validated',c.convalidated) order by c.conrelid::regclass::text,c.conname)
    from pg_constraint c join pg_namespace n on n.oid=c.connamespace
    where n.nspname in ('public','storage') and c.conrelid<>0),
  'indexes', (select jsonb_agg(to_jsonb(i) order by schemaname,tablename,indexname)
    from pg_indexes i where schemaname in ('public','storage')),
  'triggers', (select jsonb_agg(to_jsonb(t) order by event_object_schema,event_object_table,trigger_name,event_manipulation)
    from information_schema.triggers t where event_object_schema in ('public','storage')),
  'shared_view_dependencies', (select jsonb_agg(to_jsonb(dependency) order by source, dependent) from (
    select distinct source.oid::regclass::text as source, dependent.oid::regclass::text as dependent,
      dependent.reloptions as view_options
    from pg_depend d
    join pg_rewrite rule on rule.oid=d.objid
    join pg_class source on source.oid=d.refobjid
    join pg_class dependent on dependent.oid=rule.ev_class
    where d.classid='pg_rewrite'::regclass and d.refclassid='pg_class'::regclass
      and dependent.oid<>source.oid and dependent.relkind in ('v','m')
      and source.oid in ('public.institutes'::regclass,'public.institute_members'::regclass,
        'public.organization_assessment_attempts'::regclass,'public.organization_announcements'::regclass)
  ) dependency),
  'service_role_bypasses_rls', (select rolbypassrls from pg_roles where rolname = 'service_role'),
  'branding_bucket', (select jsonb_build_object('public',b.public,'file_size_limit',b.file_size_limit,
    'allowed_mime_types',b.allowed_mime_types) from storage.buckets b where b.id = 'organization-branding')
) as schema_inventory
), compatibility as (

select
  (select count(*) from public.organization_invitations
    where role not in ('OWNER','COACHING_ADMIN','ACADEMIC_COORDINATOR','TEACHER','STUDENT','PARENT','ACCOUNTANT'))
    as incompatible_invitation_roles,
  (select count(*) from (select organization_id from public.organization_invitations
    where role='OWNER' and status='PENDING' group by organization_id having count(*) > 1) duplicates)
    as duplicate_pending_owner_groups,
  (select count(*) from public.organization_invitations where role='PARENT' and status='PENDING')
    as pending_parent_invitations,
  (select count(*) from public.organization_batch_members where user_id is null)
    as batch_assignments_without_users,
  (select count(*) from public.subscription_plans where id='basic' and is_active)
    as active_basic_plan
)
select inventory.schema_inventory, to_jsonb(compatibility) as compatibility_counts
from inventory cross join compatibility;

rollback;
