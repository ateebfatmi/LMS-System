begin;

create or replace function public.has_organization_role(target_organization_id uuid, allowed_roles text[])
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.institutes institute
    where institute.id = target_organization_id and institute.status = 'ACTIVE'
    and case when institute.owner_user_id = public.requesting_user_id() then
      'OWNER' = any(allowed_roles) and (
        not exists (select 1 from public.institute_members member
          where member.institute_id = institute.id and member.user_id = public.requesting_user_id())
        or (
          1 = (select count(*) from public.institute_members member
            where member.institute_id = institute.id and member.user_id = public.requesting_user_id()
            and member.role = 'OWNER')
          and exists (select 1 from public.institute_members member
            where member.institute_id = institute.id and member.user_id = public.requesting_user_id()
            and member.role = 'OWNER' and member.status = 'ACTIVE')
        )
        or (
          1 = (select count(*) from public.institute_members member
            where member.institute_id = institute.id and member.user_id = public.requesting_user_id())
          and exists (select 1 from public.institute_members member
            where member.institute_id = institute.id and member.user_id = public.requesting_user_id()
            and member.role = 'COACHING_ADMIN' and member.status = 'ACTIVE')
        )
      )
    else
      exists (select 1 from public.institute_members member
        where member.institute_id = institute.id and member.user_id = public.requesting_user_id()
          and member.status = 'ACTIVE' and member.role = any(allowed_roles)
          and member.role in ('COACHING_ADMIN','ACADEMIC_COORDINATOR','TEACHER','STUDENT','PARENT','ACCOUNTANT'))
      and 1 = (select count(*) from public.institute_members member
        where member.institute_id = institute.id and member.user_id = public.requesting_user_id() and member.status = 'ACTIVE')
    end
  );
$$;

create or replace function public.is_organization_member(target_organization_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_organization_role(target_organization_id,
    array['OWNER','COACHING_ADMIN','ACADEMIC_COORDINATOR','TEACHER','STUDENT','PARENT','ACCOUNTANT']);
$$;

create or replace function public.is_approved_guardian(target_org_id uuid, target_student_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_organization_role(target_org_id, array['PARENT']) and exists (
    select 1 from public.organization_guardian_links link
    join public.institute_members student on student.institute_id = link.organization_id
      and student.user_id = link.student_user_id and student.role = 'STUDENT' and student.status = 'ACTIVE'
    where link.organization_id = target_org_id and link.guardian_user_id = public.requesting_user_id()
      and link.student_user_id = target_student_id and link.status = 'APPROVED'
  );
$$;

create function public.lms_review_guardian_link(
  p_organization_id uuid, p_actor_user_id text, p_guardian_member_id uuid,
  p_student_member_id uuid, p_relationship text, p_approved boolean
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare
  guardian public.institute_members%rowtype;
  student public.institute_members%rowtype;
  link_id uuid;
  next_status text := case when p_approved then 'APPROVED' else 'REVOKED' end;
begin
  if not exists (select 1 from public.institutes institute
    where institute.id = p_organization_id and institute.status = 'ACTIVE'
      and institute.owner_user_id = p_actor_user_id) then
    raise exception 'Guardian reviews require institute ownership' using errcode = '42501';
  end if;
  select * into guardian from public.institute_members member
    where member.id = p_guardian_member_id and member.institute_id = p_organization_id
      and member.role = 'PARENT' and member.user_id is not null
      and (not p_approved or member.status = 'ACTIVE') for update;
  select * into student from public.institute_members member
    where member.id = p_student_member_id and member.institute_id = p_organization_id
      and member.role = 'STUDENT' and member.user_id is not null
      and (not p_approved or member.status = 'ACTIVE') for update;
  if guardian.id is null or student.id is null or guardian.user_id = student.user_id then
    raise exception 'Guardian and student must be distinct members of this institute' using errcode = '42501';
  end if;

  insert into public.organization_guardian_links (
    organization_id, guardian_user_id, student_user_id, relationship, status, reviewed_by, reviewed_at
  ) values (
    p_organization_id, guardian.user_id, student.user_id, p_relationship, next_status, p_actor_user_id, now()
  ) on conflict (organization_id, guardian_user_id, student_user_id) do update set
    relationship = excluded.relationship, status = excluded.status, reviewed_by = excluded.reviewed_by,
    reviewed_at = excluded.reviewed_at, updated_at = now()
  returning id into link_id;

  insert into public.organization_audit_logs (organization_id, actor_user_id, actor_role, action, entity_type, entity_id, after_state)
  values (p_organization_id, p_actor_user_id, 'OWNER', 'guardian.reviewed', 'guardian_link', link_id::text,
    jsonb_build_object('status', next_status, 'relationship', p_relationship));
  return link_id;
end;
$$;
revoke all on function public.lms_review_guardian_link(uuid,text,uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.lms_review_guardian_link(uuid,text,uuid,uuid,text,boolean) to service_role;

create function public.lms_fee_overview(p_organization_id uuid)
returns table (collected numeric, outstanding numeric)
language sql stable set search_path = public
as $$
  select
    coalesce((select sum(case txn.transaction_type when 'PAYMENT' then txn.amount when 'REFUND' then -txn.amount else 0 end)
      from public.organization_fee_transactions txn where txn.organization_id = p_organization_id), 0),
    coalesce((select sum(greatest(item.amount - item.paid_amount, 0))
      from public.organization_fee_installments item where item.organization_id = p_organization_id
      and item.status in ('PENDING', 'PARTIAL', 'OVERDUE')), 0);
$$;
revoke all on function public.lms_fee_overview(uuid) from public, anon, authenticated;
grant execute on function public.lms_fee_overview(uuid) to service_role;

-- These shared identity tables must not permit browser writes to ownership,
-- identity, role or status. Both application servers use trusted RPCs.
alter table public.institutes enable row level security;
alter table public.institute_members enable row level security;
revoke insert, update, delete, truncate on public.institutes, public.institute_members from public, anon, authenticated;

-- Explicit column grants can survive a table-level revoke. Apply the same
-- write boundary through RLS in case those grants exist on the shared schema.
do $$
declare relation text;
begin
  foreach relation in array array['institutes', 'institute_members'] loop
    execute format('create policy lms_server_insert on public.%I as restrictive for insert to anon, authenticated with check (false)', relation);
    execute format('create policy lms_server_update on public.%I as restrictive for update to anon, authenticated using (false) with check (false)', relation);
    execute format('create policy lms_server_delete on public.%I as restrictive for delete to anon, authenticated using (false)', relation);
  end loop;
end;
$$;

create policy lms_institute_membership_read on public.institutes for select to authenticated
using (public.is_organization_member(id));
create policy lms_institute_read_boundary on public.institutes as restrictive for select to anon, authenticated
using (public.is_organization_member(id));

create policy lms_member_directory_read on public.institute_members for select to authenticated using (
  public.is_organization_member(institute_id) and (
    user_id = public.requesting_user_id()
    or public.has_organization_role(institute_id, array['OWNER','COACHING_ADMIN','ACADEMIC_COORDINATOR','ACCOUNTANT'])
  )
);
create policy lms_member_directory_boundary on public.institute_members as restrictive for select to anon, authenticated using (
  public.is_organization_member(institute_id) and (
    user_id = public.requesting_user_id()
    or public.has_organization_role(institute_id, array['OWNER','COACHING_ADMIN','ACADEMIC_COORDINATOR','ACCOUNTANT'])
  )
);

-- Enforce active membership even on policies that also allow a user-id match.
do $$
declare relation text;
begin
  foreach relation in array array[
    'organization_batch_members', 'organization_guardian_links',
    'organization_attendance_sessions', 'organization_attendance_records', 'organization_attendance_corrections',
    'organization_student_fees', 'organization_fee_installments', 'organization_fee_transactions', 'organization_fee_invoices',
    'organization_assessment_attempts', 'organization_descriptive_submissions',
    'organization_assignment_submissions', 'organization_assignment_submission_files', 'organization_notifications'
  ] loop
    execute format('create policy active_workspace_required on public.%I as restrictive for all to authenticated using (public.is_organization_member(organization_id)) with check (public.is_organization_member(organization_id))', relation);
  end loop;
end;
$$;

create function public.is_assigned_institute_teacher(target_organization_id uuid, target_batch_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select public.has_organization_role(target_organization_id, array['TEACHER']) and exists (
    select 1 from public.organization_batch_members assignment
    where assignment.organization_id = target_organization_id and assignment.batch_id = target_batch_id
      and assignment.user_id = public.requesting_user_id() and assignment.role = 'TEACHER'
  );
$$;

drop policy org_batch_members_read on public.organization_batch_members;
create policy org_batch_members_read on public.organization_batch_members for select using (
  user_id = public.requesting_user_id()
  or public.has_organization_role(organization_id, array['OWNER','COACHING_ADMIN','ACADEMIC_COORDINATOR'])
  or public.is_assigned_institute_teacher(organization_id, batch_id)
);

drop policy org_attendance_records_read on public.organization_attendance_records;
create policy org_attendance_records_read on public.organization_attendance_records for select using (
  student_id = public.requesting_user_id() or public.is_approved_guardian(organization_id, student_id)
  or public.has_organization_role(organization_id, array['OWNER','COACHING_ADMIN','ACADEMIC_COORDINATOR'])
  or exists (select 1 from public.organization_attendance_sessions session
    where session.id = session_id and session.organization_id = organization_attendance_records.organization_id
      and public.is_assigned_institute_teacher(session.organization_id, session.batch_id))
);

-- Match the parent workspace's approved-child scope for installments.
create policy lms_guardian_installments_read on public.organization_fee_installments
for select to authenticated using (exists (
  select 1 from public.organization_student_fees fee
  where fee.id = student_fee_id
    and fee.organization_id = organization_fee_installments.organization_id
    and public.is_approved_guardian(fee.organization_id, fee.student_id)
));

-- Result visibility is conditional by row and column. Return grading details
-- through the attempt endpoint, which enforces both release policies.
revoke select on public.organization_assessment_attempts from public, anon, authenticated;
do $$
declare columns text;
begin
  select string_agg(quote_ident(attname), ', ') into columns
  from pg_catalog.pg_attribute
  where attrelid = 'public.organization_assessment_attempts'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke select (%s) on public.organization_assessment_attempts from public, anon, authenticated', columns);
end;
$$;
grant select (id, organization_id, test_id, schedule_id, user_id, status, attempt_number,
  started_at, expires_at, submitted_at, results_released, solutions_released)
  on public.organization_assessment_attempts to authenticated;

-- Hosted projects can grant privileges explicitly through default ACLs.
revoke execute on function public.lms_create_institute(text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.lms_create_invitation(uuid, text, text, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke execute on function public.lms_accept_invitation(text, text, text) from public, anon, authenticated;
revoke execute on function public.lms_revoke_invitation(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.lms_list_members(uuid, text, text, text, integer, integer) from public, anon, authenticated;
revoke execute on function public.lms_update_member_profile(uuid, uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, date) from public, anon, authenticated;
revoke execute on function public.lms_stage_member_import(uuid, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_commit_member_import(uuid, uuid, text, text) from public, anon, authenticated;
revoke execute on function public.lms_academic_mutation(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_actor_can_access_course(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.lms_learning_mutation(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_get_learning_resource(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.lms_student_can_access_assignment(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.lms_actor_can_manage_assignment(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.lms_assignment_mutation(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_get_assignment_file(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.lms_start_assessment(uuid, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.lms_save_assessment_answers(uuid, text, uuid, integer, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_finalize_assessment(uuid, text, uuid, integer, jsonb, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_assessment_mutation(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_save_attendance(uuid, text, text, uuid, date, text, time, time, jsonb, text) from public, anon, authenticated;
revoke execute on function public.lms_finance_mutation(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_consume_quota(uuid, text, bigint, text, text, text) from public, anon, authenticated;
revoke execute on function public.lms_subscription_mutation(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_platform_mutation(text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_announcement_mutation(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_crm_mutation(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.lms_grade_descriptive_submission(uuid, uuid, text, text, numeric, text, boolean) from public, anon, authenticated;
revoke execute on function public.lms_promote_ai_draft(uuid, uuid, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.lms_review_support_access(uuid, uuid, text, text, text, integer) from public, anon, authenticated;

commit;
