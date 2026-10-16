-- Secure, retry-safe organization invitations. Raw invitation tokens are never
-- persisted; only SHA-256 digests are stored. All RPCs are service-role only.

create table if not exists public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.institutes(id) on delete cascade,
  email text not null,
  role text not null check (role in (
    'COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT'
  )),
  token_hash text not null unique check (length(token_hash) = 64),
  idempotency_key text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED')),
  invited_by text not null,
  accepted_by text,
  accepted_at timestamptz,
  revoked_by text,
  revoked_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, idempotency_key)
);

create index if not exists organization_invitations_org_time_idx
  on public.organization_invitations(organization_id, created_at desc);
create unique index if not exists organization_one_pending_invitation_per_email_idx
  on public.organization_invitations(organization_id, lower(email))
  where status = 'PENDING';

alter table public.organization_invitations enable row level security;

create or replace function public.lms_create_invitation(
  p_organization_id uuid,
  p_actor_user_id text,
  p_actor_role text,
  p_email text,
  p_role text,
  p_token_hash text,
  p_idempotency_key text,
  p_expires_at timestamptz
)
returns table (
  invitation_id uuid,
  invitation_email text,
  invitation_role text,
  invitation_status text,
  invitation_expires_at timestamptz,
  invitation_created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  existing public.organization_invitations%rowtype;
  created public.organization_invitations%rowtype;
  normalized_email text := lower(trim(p_email));
begin
  if p_role not in ('COACHING_ADMIN', 'ACADEMIC_COORDINATOR', 'TEACHER', 'STUDENT', 'PARENT', 'ACCOUNTANT') then
    raise exception 'Role cannot be invited' using errcode = '22023';
  end if;
  if p_expires_at <= now() or p_expires_at > now() + interval '30 days' then
    raise exception 'Invalid invitation expiry' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_organization_id::text || ':' || normalized_email, 0));

  select * into existing
  from public.organization_invitations invitation
  where invitation.organization_id = p_organization_id
    and invitation.idempotency_key = p_idempotency_key;

  if found then
    if lower(existing.email) <> normalized_email or existing.role <> p_role then
      raise exception 'Idempotency key was used for another request' using errcode = '22023';
    end if;
    return query select existing.id, existing.email, existing.role, existing.status, existing.expires_at, existing.created_at;
    return;
  end if;

  update public.organization_invitations invitation
  set status = 'EXPIRED', updated_at = now()
  where invitation.organization_id = p_organization_id
    and lower(invitation.email) = normalized_email
    and invitation.status = 'PENDING'
    and invitation.expires_at <= now();

  if exists (
    select 1 from public.organization_invitations invitation
    where invitation.organization_id = p_organization_id
      and lower(invitation.email) = normalized_email
      and invitation.status = 'PENDING'
  ) then
    raise exception 'A pending invitation already exists for this email' using errcode = '23505';
  end if;

  insert into public.organization_invitations (
    organization_id, email, role, token_hash, idempotency_key, invited_by, expires_at
  ) values (
    p_organization_id, normalized_email, p_role, p_token_hash, p_idempotency_key, p_actor_user_id, p_expires_at
  ) returning * into created;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state, request_id
  ) values (
    p_organization_id,
    p_actor_user_id,
    p_actor_role,
    'invitation.created',
    'organization_invitation',
    created.id::text,
    jsonb_build_object('email', created.email, 'role', created.role, 'expires_at', created.expires_at),
    p_idempotency_key
  );

  return query select created.id, created.email, created.role, created.status, created.expires_at, created.created_at;
end;
$$;

create or replace function public.lms_accept_invitation(
  p_token_hash text,
  p_user_id text,
  p_verified_email text
)
returns table (
  invitation_status text,
  organization_id uuid,
  organization_slug text,
  membership_role text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.organization_invitations%rowtype;
  member public.institute_members%rowtype;
  institute_slug text;
  normalized_email text := lower(trim(p_verified_email));
begin
  select * into invitation
  from public.organization_invitations candidate
  where candidate.token_hash = p_token_hash
  for update;

  if not found or lower(invitation.email) <> normalized_email then
    raise exception 'Invitation is invalid' using errcode = 'P0002';
  end if;

  select institute.slug into institute_slug
  from public.institutes institute
  where institute.id = invitation.organization_id and institute.status = 'ACTIVE';
  if institute_slug is null then
    raise exception 'Invitation is invalid' using errcode = 'P0002';
  end if;

  if invitation.status = 'ACCEPTED' and invitation.accepted_by = p_user_id then
    return query select invitation.status, invitation.organization_id, institute_slug, invitation.role;
    return;
  end if;
  if invitation.status <> 'PENDING' then
    return query select invitation.status, invitation.organization_id, institute_slug, invitation.role;
    return;
  end if;
  if invitation.expires_at <= now() then
    update public.organization_invitations set status = 'EXPIRED', updated_at = now() where id = invitation.id;
    return query select 'EXPIRED'::text, invitation.organization_id, institute_slug, invitation.role;
    return;
  end if;

  select * into member
  from public.institute_members existing
  where existing.institute_id = invitation.organization_id
    and lower(existing.email) = normalized_email
  for update;

  if found and member.user_id is not null and member.user_id <> p_user_id then
    raise exception 'Membership belongs to another identity' using errcode = '23505';
  end if;

  if found then
    update public.institute_members
    set user_id = p_user_id, role = invitation.role, status = 'ACTIVE'
    where id = member.id;
  else
    insert into public.institute_members (institute_id, user_id, email, role, status)
    values (invitation.organization_id, p_user_id, normalized_email, invitation.role, 'ACTIVE');
  end if;

  update public.organization_invitations
  set status = 'ACCEPTED', accepted_by = p_user_id, accepted_at = now(), updated_at = now()
  where id = invitation.id;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state
  ) values (
    invitation.organization_id,
    p_user_id,
    invitation.role,
    'invitation.accepted',
    'organization_invitation',
    invitation.id::text,
    jsonb_build_object('email', normalized_email, 'role', invitation.role)
  );

  return query select 'ACCEPTED'::text, invitation.organization_id, institute_slug, invitation.role;
end;
$$;

create or replace function public.lms_revoke_invitation(
  p_organization_id uuid,
  p_invitation_id uuid,
  p_actor_user_id text,
  p_actor_role text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation public.organization_invitations%rowtype;
begin
  select * into invitation
  from public.organization_invitations candidate
  where candidate.id = p_invitation_id and candidate.organization_id = p_organization_id
  for update;
  if not found then
    raise exception 'Invitation not found' using errcode = 'P0002';
  end if;
  if invitation.status = 'ACCEPTED' then
    raise exception 'Accepted invitation cannot be revoked' using errcode = '55000';
  end if;
  if invitation.status = 'PENDING' then
    update public.organization_invitations
    set status = case when expires_at <= now() then 'EXPIRED' else 'REVOKED' end,
        revoked_by = case when expires_at > now() then p_actor_user_id else revoked_by end,
        revoked_at = case when expires_at > now() then now() else revoked_at end,
        updated_at = now()
    where id = invitation.id
    returning * into invitation;

    insert into public.organization_audit_logs (
      organization_id, actor_user_id, actor_role, action, entity_type, entity_id, before_state, after_state
    ) values (
      p_organization_id,
      p_actor_user_id,
      p_actor_role,
      case when invitation.status = 'EXPIRED' then 'invitation.expired' else 'invitation.revoked' end,
      'organization_invitation',
      invitation.id::text,
      jsonb_build_object('status', 'PENDING'),
      jsonb_build_object('status', invitation.status)
    );
  end if;
  return invitation.status;
end;
$$;

revoke all on function public.lms_create_invitation(uuid, text, text, text, text, text, text, timestamptz) from public;
revoke all on function public.lms_accept_invitation(text, text, text) from public;
revoke all on function public.lms_revoke_invitation(uuid, uuid, text, text) from public;
grant execute on function public.lms_create_invitation(uuid, text, text, text, text, text, text, timestamptz) to service_role;
grant execute on function public.lms_accept_invitation(text, text, text) to service_role;
grant execute on function public.lms_revoke_invitation(uuid, uuid, text, text) to service_role;

-- No browser policy is created. Invitation metadata and token hashes are only
-- accessed through membership-verified server routes.
