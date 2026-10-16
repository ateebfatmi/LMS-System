-- Commercial SaaS controls: entitlements, atomic quotas, branding registry, and platform operations.

alter table public.subscription_plans add column if not exists monthly_price_paise bigint;
alter table public.subscription_plans add column if not exists annual_price_paise bigint;
alter table public.subscription_plans add column if not exists entitlements jsonb not null default '{}'::jsonb;
update public.subscription_plans set
  monthly_price_paise = coalesce(monthly_price_paise, price_inr::bigint * 100),
  annual_price_paise = coalesce(annual_price_paise, price_inr::bigint * 100 * 10),
  entitlements = case when entitlements = '{}'::jsonb then jsonb_build_object(
    'assessments', true, 'assignments', true, 'attendance', true, 'fees', true,
    'advancedAnalytics', id <> 'basic', 'ai', id = 'scale', 'whiteLabel', id = 'scale'
  ) else entitlements end;
alter table public.subscription_plans alter column monthly_price_paise set not null;
alter table public.subscription_plans alter column annual_price_paise set not null;
alter table public.subscription_plans add constraint subscription_plans_monthly_price_check check (monthly_price_paise >= 0);
alter table public.subscription_plans add constraint subscription_plans_annual_price_check check (annual_price_paise >= 0);

alter table public.organization_subscriptions add column if not exists grace_ends_at timestamptz;
alter table public.organization_subscriptions add column if not exists requested_plan_id text references public.subscription_plans(id);
alter table public.organization_subscriptions add column if not exists requested_billing_interval text check (requested_billing_interval in ('monthly', 'yearly'));
alter table public.organization_subscriptions add column if not exists provider text;
alter table public.organization_subscriptions add column if not exists provider_customer_id text;
alter table public.organization_subscriptions add column if not exists provider_subscription_id text;
create unique index if not exists organization_subscription_provider_unique
  on public.organization_subscriptions(provider, provider_subscription_id) where provider_subscription_id is not null;

create table if not exists public.organization_usage_counters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  metric text not null check (metric in ('AI_CREDITS', 'STORAGE_BYTES', 'EMAILS', 'SMS', 'WHATSAPP')),
  period_start date not null,
  period_end date not null,
  quantity bigint not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  unique (organization_id, metric, period_start)
);

create table if not exists public.organization_usage_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  metric text not null,
  quantity bigint not null check (quantity > 0),
  idempotency_key text not null,
  feature text not null,
  actor_user_id text,
  created_at timestamptz not null default now(),
  unique (organization_id, metric, idempotency_key)
);

create table if not exists public.organization_branding (
  organization_id uuid primary key references public.institutes(id) on delete cascade,
  logo_url text,
  primary_color text not null default '#0B132B' check (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  support_email text,
  support_phone text,
  subdomain text unique check (subdomain ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  subdomain_verified_at timestamptz,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.platform_feature_flags (
  key text primary key check (key ~ '^[a-z][a-z0-9_.-]{1,79}$'),
  description text not null,
  enabled_by_default boolean not null default false,
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_feature_overrides (
  organization_id uuid not null references public.institutes(id) on delete cascade,
  feature_key text not null references public.platform_feature_flags(key) on delete cascade,
  enabled boolean not null,
  reason text not null,
  updated_by text not null,
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature_key)
);

create table if not exists public.platform_support_access_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  requested_by text not null,
  reason text not null check (char_length(reason) between 10 and 1000),
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED')),
  approved_by text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists organization_usage_counter_idx on public.organization_usage_counters(organization_id, metric, period_start desc);
create index if not exists organization_usage_event_idx on public.organization_usage_events(organization_id, metric, created_at desc);
create index if not exists support_access_org_idx on public.platform_support_access_requests(organization_id, status, created_at desc);

alter table public.organization_usage_counters enable row level security;
alter table public.organization_usage_events enable row level security;
alter table public.organization_branding enable row level security;
alter table public.platform_feature_flags enable row level security;
alter table public.organization_feature_overrides enable row level security;
alter table public.platform_support_access_requests enable row level security;

create policy organization_usage_counters_read on public.organization_usage_counters
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
create policy organization_usage_events_read on public.organization_usage_events
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));
create policy organization_branding_read on public.organization_branding
  for select using (public.is_organization_member(organization_id));
create policy organization_feature_overrides_read on public.organization_feature_overrides
  for select using (public.is_organization_member(organization_id));
create policy platform_support_access_requests_tenant_read on public.platform_support_access_requests
  for select using (public.has_organization_role(organization_id, array['OWNER']));

create or replace function public.lms_consume_quota(
  p_organization_id uuid,
  p_metric text,
  p_quantity bigint,
  p_idempotency_key text,
  p_feature text,
  p_actor_user_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  subscription public.organization_subscriptions%rowtype;
  plan public.subscription_plans%rowtype;
  counter public.organization_usage_counters%rowtype;
  metric_limit bigint;
  period_start date := date_trunc('month', current_date)::date;
  period_end date := (date_trunc('month', current_date) + interval '1 month')::date;
begin
  if p_quantity <= 0 or char_length(p_idempotency_key) not between 8 and 200 then raise exception 'Invalid quota request' using errcode = '22023'; end if;
  if exists (select 1 from public.organization_usage_events where organization_id = p_organization_id and metric = p_metric and idempotency_key = p_idempotency_key) then
    select * into counter from public.organization_usage_counters candidate where candidate.organization_id = p_organization_id and candidate.metric = p_metric and candidate.period_start = lms_consume_quota.period_start;
    return jsonb_build_object('quantity', counter.quantity, 'limit', null, 'idempotent', true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || p_metric || ':' || period_start::text, 0));
  select * into subscription from public.organization_subscriptions candidate where candidate.organization_id = p_organization_id for update;
  if not found or subscription.status not in ('TRIAL', 'ACTIVE', 'PAST_DUE') then raise exception 'Subscription is not writable' using errcode = '42501'; end if;
  if subscription.status = 'TRIAL' and coalesce(subscription.trial_ends_at, subscription.current_period_end) < now() then raise exception 'Subscription trial ended' using errcode = '42501'; end if;
  if subscription.status = 'PAST_DUE' and coalesce(subscription.grace_ends_at, subscription.current_period_end) < now() then raise exception 'Subscription grace period ended' using errcode = '42501'; end if;
  select * into plan from public.subscription_plans where id = subscription.plan_id and is_active;
  if not found then raise exception 'Subscription plan is unavailable' using errcode = '23503'; end if;
  metric_limit := case p_metric
    when 'AI_CREDITS' then plan.ai_credits_per_month
    when 'STORAGE_BYTES' then plan.storage_gb::bigint * 1024 * 1024 * 1024
    else coalesce((plan.entitlements -> 'limits' ->> lower(p_metric))::bigint, 0)
  end;
  if metric_limit <= 0 then raise exception 'Feature is not included in this plan' using errcode = '42501'; end if;
  insert into public.organization_usage_counters (organization_id, metric, period_start, period_end, quantity)
  values (p_organization_id, p_metric, period_start, period_end, 0)
  on conflict (organization_id, metric, period_start) do nothing;
  select * into counter from public.organization_usage_counters candidate
  where candidate.organization_id = p_organization_id and candidate.metric = p_metric and candidate.period_start = lms_consume_quota.period_start for update;
  if counter.quantity + p_quantity > metric_limit then raise exception 'Plan quota exceeded' using errcode = '22023'; end if;
  insert into public.organization_usage_events (organization_id, metric, quantity, idempotency_key, feature, actor_user_id)
  values (p_organization_id, p_metric, p_quantity, p_idempotency_key, p_feature, p_actor_user_id);
  update public.organization_usage_counters set quantity = quantity + p_quantity, updated_at = now() where id = counter.id returning * into counter;
  return jsonb_build_object('quantity', counter.quantity, 'limit', metric_limit, 'idempotent', false);
end;
$$;

create or replace function public.lms_enforce_student_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quota integer;
  current_count integer;
begin
  if new.role <> 'STUDENT' or new.status <> 'ACTIVE' then return new; end if;
  if tg_op = 'UPDATE' and old.role = 'STUDENT' and old.status = 'ACTIVE' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.institute_id::text || ':students', 0));
  select plan.student_limit into quota from public.organization_subscriptions subscription
  join public.subscription_plans plan on plan.id = subscription.plan_id
  where subscription.organization_id = new.institute_id
    and (subscription.status = 'ACTIVE'
      or (subscription.status = 'TRIAL' and coalesce(subscription.trial_ends_at, subscription.current_period_end) >= now())
      or (subscription.status = 'PAST_DUE' and coalesce(subscription.grace_ends_at, subscription.current_period_end) >= now()));
  if quota is null then raise exception 'Active subscription required' using errcode = '42501'; end if;
  select count(*)::integer into current_count from public.institute_members
  where institute_id = new.institute_id and role = 'STUDENT' and status = 'ACTIVE';
  if current_count >= quota then raise exception 'Active student quota exceeded' using errcode = '22023'; end if;
  return new;
end;
$$;
drop trigger if exists institute_members_student_quota on public.institute_members;
create trigger institute_members_student_quota before insert or update of role, status on public.institute_members
  for each row execute function public.lms_enforce_student_quota();

create or replace function public.lms_enforce_branch_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  quota integer;
  current_count integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.organization_id::text || ':branches', 0));
  select plan.branch_limit into quota from public.organization_subscriptions subscription
  join public.subscription_plans plan on plan.id = subscription.plan_id
  where subscription.organization_id = new.organization_id
    and (subscription.status = 'ACTIVE'
      or (subscription.status = 'TRIAL' and coalesce(subscription.trial_ends_at, subscription.current_period_end) >= now())
      or (subscription.status = 'PAST_DUE' and coalesce(subscription.grace_ends_at, subscription.current_period_end) >= now()));
  if quota is null then raise exception 'Active subscription required' using errcode = '42501'; end if;
  select count(*)::integer into current_count from public.organization_campuses where organization_id = new.organization_id;
  if current_count >= quota then raise exception 'Campus quota exceeded' using errcode = '22023'; end if;
  return new;
end;
$$;
drop trigger if exists organization_campuses_branch_quota on public.organization_campuses;
create trigger organization_campuses_branch_quota before insert on public.organization_campuses
  for each row execute function public.lms_enforce_branch_quota();

revoke all on function public.lms_consume_quota(uuid, text, bigint, text, text, text) from public;
grant execute on function public.lms_consume_quota(uuid, text, bigint, text, text, text) to service_role;

create or replace function public.lms_subscription_mutation(
  p_organization_id uuid, p_actor_user_id text, p_actor_role text, p_action text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare subscription public.organization_subscriptions%rowtype;
begin
  if p_actor_role <> 'OWNER' then raise exception 'Only the owner can manage subscriptions' using errcode = '42501'; end if;
  select * into subscription from public.organization_subscriptions where organization_id = p_organization_id for update;
  if not found then raise exception 'Subscription not found' using errcode = '23503'; end if;
  if p_action = 'REQUEST_PLAN_CHANGE' then
    if not exists (select 1 from public.subscription_plans where id = p_payload ->> 'planId' and is_active) then raise exception 'Plan not found' using errcode = '23503'; end if;
    update public.organization_subscriptions set requested_plan_id = p_payload ->> 'planId', requested_billing_interval = p_payload ->> 'billingInterval', updated_at = now() where id = subscription.id;
  elsif p_action = 'CANCEL_AT_PERIOD_END' then
    update public.organization_subscriptions set cancel_at_period_end = (p_payload ->> 'cancel')::boolean, updated_at = now() where id = subscription.id;
  elsif p_action = 'UPDATE_BRANDING' then
    insert into public.organization_branding (
      organization_id, logo_url, primary_color, support_email, support_phone, subdomain,
      subdomain_verified_at, updated_by, updated_at
    ) values (
      p_organization_id, nullif(p_payload ->> 'logoUrl', ''), p_payload ->> 'primaryColor',
      nullif(p_payload ->> 'supportEmail', ''), nullif(p_payload ->> 'supportPhone', ''),
      nullif(p_payload ->> 'subdomain', ''), null, p_actor_user_id, now()
    ) on conflict (organization_id) do update set
      logo_url = excluded.logo_url, primary_color = excluded.primary_color,
      support_email = excluded.support_email, support_phone = excluded.support_phone,
      subdomain = excluded.subdomain, subdomain_verified_at = null,
      updated_by = excluded.updated_by, updated_at = now();
  else raise exception 'Unsupported subscription action' using errcode = '22023';
  end if;
  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, p_actor_role, 'subscription.' || lower(p_action), 'organization_subscription', subscription.id::text, p_payload);
  return jsonb_build_object('subscriptionId', subscription.id, 'action', p_action);
end;
$$;
revoke all on function public.lms_subscription_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_subscription_mutation(uuid, text, text, text, jsonb) to service_role;

create or replace function public.lms_platform_mutation(
  p_actor_user_id text, p_action text, p_payload jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare target_id uuid;
begin
  target_id := nullif(p_payload ->> 'organizationId', '')::uuid;
  if p_action = 'SET_ORGANIZATION_STATUS' then
    if coalesce(p_payload ->> 'status', '') not in ('ACTIVE', 'SUSPENDED') then raise exception 'Invalid organization status' using errcode = '22023'; end if;
    update public.institutes set status = p_payload ->> 'status' where id = target_id;
    if not found then raise exception 'Organization not found' using errcode = '23503'; end if;
  elsif p_action = 'UPDATE_PLAN' then
    update public.subscription_plans set
      name = p_payload ->> 'name', price_inr = round((p_payload ->> 'monthlyPricePaise')::numeric / 100)::integer,
      monthly_price_paise = (p_payload ->> 'monthlyPricePaise')::bigint,
      annual_price_paise = (p_payload ->> 'annualPricePaise')::bigint,
      student_limit = (p_payload ->> 'studentLimit')::integer, branch_limit = (p_payload ->> 'branchLimit')::integer,
      storage_gb = (p_payload ->> 'storageGb')::integer, ai_credits_per_month = (p_payload ->> 'aiCreditsPerMonth')::integer,
      entitlements = p_payload -> 'entitlements', is_active = (p_payload ->> 'isActive')::boolean
    where id = p_payload ->> 'planId';
    if not found then raise exception 'Plan not found' using errcode = '23503'; end if;
  elsif p_action = 'SET_FEATURE_FLAG' then
    insert into public.platform_feature_flags (key, description, enabled_by_default, updated_by)
    values (p_payload ->> 'key', p_payload ->> 'description', (p_payload ->> 'enabled')::boolean, p_actor_user_id)
    on conflict (key) do update set description = excluded.description, enabled_by_default = excluded.enabled_by_default, updated_by = excluded.updated_by, updated_at = now();
  else raise exception 'Unsupported platform action' using errcode = '22023';
  end if;
  insert into public.platform_audit_logs (actor_user_id, actor_role, target_organization_id, action, details)
  values (p_actor_user_id, 'PLATFORM_SUPER_ADMIN', target_id, lower(p_action), p_payload);
  return jsonb_build_object('action', p_action, 'organizationId', target_id);
end;
$$;
revoke all on function public.lms_platform_mutation(text, text, jsonb) from public;
grant execute on function public.lms_platform_mutation(text, text, jsonb) to service_role;
