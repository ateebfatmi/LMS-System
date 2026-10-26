-- Reconcile the legacy verified parent link table with the reviewed guardian model.
-- This migration is additive and intentionally keeps the legacy rows in place.

do $$
begin
  if to_regclass('public.organization_parent_students') is not null then
    insert into public.organization_guardian_links (
      organization_id,
      guardian_user_id,
      student_user_id,
      relationship,
      status,
      reviewed_by,
      reviewed_at,
      notes,
      created_at,
      updated_at
    )
    select
      legacy.organization_id,
      legacy.parent_user_id,
      legacy.student_user_id,
      case legacy.relationship
        when 'FATHER' then 'FATHER'
        when 'MOTHER' then 'MOTHER'
        else 'LEGAL_GUARDIAN'
      end,
      case when legacy.is_verified then 'APPROVED' else 'PENDING_REVIEW' end,
      legacy.verified_by,
      case when legacy.is_verified then legacy.created_at else null end,
      'Backfilled from organization_parent_students by migration 0020',
      legacy.created_at,
      now()
    from public.organization_parent_students legacy
    on conflict (organization_id, guardian_user_id, student_user_id) do nothing;
  end if;
end
$$;

drop policy if exists org_guardian_links_manage on public.organization_guardian_links;
create policy org_guardian_links_manage on public.organization_guardian_links
  for all
  using (
    public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR']
    )
  )
  with check (
    public.has_organization_role(
      organization_id,
      array['OWNER', 'COACHING_ADMIN', 'ACADEMIC_COORDINATOR']
    )
  );
