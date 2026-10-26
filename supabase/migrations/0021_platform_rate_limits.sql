-- Atomic shared rate-limit windows for server-side abuse protection.

create table if not exists public.platform_rate_limit_windows (
  scope text not null,
  subject_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count > 0),
  updated_at timestamptz not null default now(),
  primary key (scope, subject_hash, window_started_at)
);

alter table public.platform_rate_limit_windows enable row level security;

create or replace function public.lms_consume_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz;
  v_request_count integer;
begin
  if nullif(trim(p_scope), '') is null or nullif(trim(p_subject_hash), '') is null then
    raise exception 'Rate-limit scope and subject are required' using errcode = '22023';
  end if;
  if p_limit < 1 or p_limit > 10000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Invalid rate-limit bounds' using errcode = '22023';
  end if;

  v_window_started_at := to_timestamp(
    floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds
  );

  insert into public.platform_rate_limit_windows (
    scope,
    subject_hash,
    window_started_at,
    request_count,
    updated_at
  ) values (
    trim(p_scope),
    p_subject_hash,
    v_window_started_at,
    1,
    v_now
  )
  on conflict (scope, subject_hash, window_started_at)
  do update set
    request_count = public.platform_rate_limit_windows.request_count + 1,
    updated_at = excluded.updated_at
  returning request_count into v_request_count;

  delete from public.platform_rate_limit_windows
  where scope = trim(p_scope)
    and subject_hash = p_subject_hash
    and window_started_at < v_window_started_at - interval '1 day';

  return query select
    v_request_count <= p_limit,
    greatest(p_limit - v_request_count, 0),
    greatest(ceil(extract(epoch from (v_window_started_at + make_interval(secs => p_window_seconds) - v_now)))::integer, 1);
end;
$$;

revoke all on function public.lms_consume_rate_limit(text, text, integer, integer) from public;
grant execute on function public.lms_consume_rate_limit(text, text, integer, integer) to service_role;

