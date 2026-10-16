-- Admissions CRM hardening. All writes are service-only, tenant-scoped and audited.

drop policy if exists organization_leads_manage on public.organization_leads;
create policy organization_leads_read on public.organization_leads
  for select using (public.has_organization_role(organization_id, array['OWNER', 'COACHING_ADMIN']));

create or replace function public.lms_crm_mutation(
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
  lead public.organization_leads%rowtype;
  created_id uuid;
  before_state jsonb;
begin
  if p_actor_role not in ('OWNER', 'COACHING_ADMIN') then
    raise exception 'CRM access denied' using errcode = '42501';
  end if;

  if p_action = 'CREATE_LEAD' then
    if nullif(p_payload ->> 'targetBatchId', '') is not null and not exists (
      select 1 from public.organization_batches
      where id = (p_payload ->> 'targetBatchId')::uuid and organization_id = p_organization_id
    ) then
      raise exception 'Target batch is outside organization' using errcode = '23503';
    end if;
    insert into public.organization_leads (
      organization_id, name, email, phone, guardian_name, guardian_phone,
      target_exam, target_batch_id, source, assigned_counsellor_id,
      assigned_counsellor_name, follow_up_date, estimated_fee, notes
    ) values (
      p_organization_id, p_payload ->> 'name', nullif(p_payload ->> 'email', ''),
      p_payload ->> 'phone', nullif(p_payload ->> 'guardianName', ''),
      nullif(p_payload ->> 'guardianPhone', ''), p_payload ->> 'targetExam',
      nullif(p_payload ->> 'targetBatchId', '')::uuid, p_payload ->> 'source',
      p_actor_user_id, nullif(p_payload ->> 'assignedCounsellorName', ''),
      nullif(p_payload ->> 'followUpDate', '')::date,
      coalesce((p_payload ->> 'estimatedFeePaise')::numeric, 0) / 100,
      nullif(p_payload ->> 'notes', '')
    ) returning id into created_id;
  elsif p_action in ('UPDATE_STAGE', 'UPDATE_FOLLOW_UP') then
    select * into lead from public.organization_leads candidate
    where candidate.id = (p_payload ->> 'leadId')::uuid
      and candidate.organization_id = p_organization_id for update;
    if not found then raise exception 'Lead not found' using errcode = '23503'; end if;
    before_state := to_jsonb(lead);
    if p_action = 'UPDATE_STAGE' then
      if p_payload ->> 'stage' = 'CONVERTED' then
        raise exception 'Complete reviewed student onboarding before conversion' using errcode = '22023';
      end if;
      update public.organization_leads set stage = p_payload ->> 'stage', updated_at = now()
      where id = lead.id and organization_id = p_organization_id;
    else
      update public.organization_leads
      set follow_up_date = nullif(p_payload ->> 'followUpDate', '')::date,
          notes = coalesce(nullif(p_payload ->> 'notes', ''), notes), updated_at = now()
      where id = lead.id and organization_id = p_organization_id;
    end if;
    created_id := lead.id;
  else
    raise exception 'Unsupported CRM action' using errcode = '22023';
  end if;

  insert into public.organization_audit_logs (
    organization_id, actor_user_id, actor_role, action, entity_type, entity_id,
    before_state, after_state
  ) values (
    p_organization_id, p_actor_user_id, p_actor_role, lower(p_action), 'admission_lead',
    created_id::text, before_state, p_payload
  );
  return jsonb_build_object('id', created_id, 'action', p_action);
end;
$$;

revoke all on function public.lms_crm_mutation(uuid, text, text, text, jsonb) from public;
grant execute on function public.lms_crm_mutation(uuid, text, text, text, jsonb) to service_role;
