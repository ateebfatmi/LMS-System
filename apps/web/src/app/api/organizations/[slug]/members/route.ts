import { canGrantRole } from "@prepzii/authorization";
import type { OrganizationMemberDirectoryRecord } from "@prepzii/contracts";
import { invitationRoles } from "@prepzii/membership";
import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(120).default(""),
  role: z.enum(invitationRoles).optional(),
  status: z.enum(["PENDING", "ACTIVE", "INACTIVE", "SUSPENDED"]).optional(),
});
const profileSchema = z.object({
  memberId: z.uuid(),
  role: z.enum(invitationRoles),
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
  displayName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(30).nullable().default(null),
  alternatePhone: z.string().trim().max(30).nullable().default(null),
  rollNumber: z.string().trim().max(60).nullable().default(null),
  employeeCode: z.string().trim().max(60).nullable().default(null),
  batchId: z.uuid().nullable().optional(),
  guardianName: z.string().trim().max(160).nullable().default(null),
  guardianPhone: z.string().trim().max(30).nullable().default(null),
  qualification: z.string().trim().max(240).nullable().default(null),
  subjectSpecialization: z.string().trim().max(240).nullable().default(null),
  joinedOn: z.iso.date().nullable().default(null),
});

const createMemberSchema = z.object({
  role: z.enum(invitationRoles),
  displayName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().toLowerCase(),
  phone: z.string().trim().max(30).nullable().default(null),
  alternatePhone: z.string().trim().max(30).nullable().default(null),
  rollNumber: z.string().trim().max(60).nullable().default(null),
  employeeCode: z.string().trim().max(60).nullable().default(null),
  batchId: z.uuid().nullable().optional(),
  guardianName: z.string().trim().max(160).nullable().default(null),
  guardianPhone: z.string().trim().max(30).nullable().default(null),
  qualification: z.string().trim().max(240).nullable().default(null),
  subjectSpecialization: z.string().trim().max(240).nullable().default(null),
  joinedOn: z.iso.date().nullable().default(null),
  leadId: z.uuid().nullable().optional(),
});
type Context = { params: Promise<{ slug: string }> };
type MemberRow = {
  member_id: string;
  user_id: string | null;
  email: string;
  member_role: OrganizationMemberDirectoryRecord["role"];
  member_status: OrganizationMemberDirectoryRecord["status"];
  display_name: string;
  phone: string | null;
  alternate_phone: string | null;
  roll_number: string | null;
  employee_code: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  qualification: string | null;
  subject_specialization: string | null;
  joined_on: string | null;
  batches: OrganizationMemberDirectoryRecord["batches"];
  created_at: string;
  total_count: number;
};

function toMember(row: MemberRow): OrganizationMemberDirectoryRecord {
  return {
    id: row.member_id,
    userId: row.user_id,
    email: row.email,
    role: row.member_role,
    status: row.member_status,
    displayName: row.display_name,
    phone: row.phone,
    alternatePhone: row.alternate_phone,
    rollNumber: row.roll_number,
    employeeCode: row.employee_code,
    guardianName: row.guardian_name,
    guardianPhone: row.guardian_phone,
    qualification: row.qualification,
    subjectSpecialization: row.subject_specialization,
    joinedOn: row.joined_on,
    batches: row.batches ?? [],
    createdAt: row.created_at,
  };
}

export async function GET(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  const url = new URL(request.url);
  const parsedQuery = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsedSlug.success || !parsedQuery.success) {
    return Response.json({ error: "Invalid directory query." }, { status: 400 });
  }

  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "members:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { page, perPage, search, role, status } = parsedQuery.data;
  let rows: MemberRow[] = [];
  let total = 0;

  const rpcResult = await getPrepziiAdmin().rpc("lms_list_members", {
    p_organization_id: resolved.context.organizationId,
    p_role: role ?? null,
    p_status: status ?? null,
    p_search: search || null,
    p_limit: perPage,
    p_offset: (page - 1) * perPage,
  });

  if (rpcResult.error) {
    // Graceful fallback to direct institute_members and institute_batches query
    try {
      const client = getPrepziiAdmin();
      let query = client
        .from("institute_members")
        .select("id, user_id, email, role, status, created_at")
        .eq("institute_id", resolved.context.organizationId);

      if (role) query = query.eq("role", role);
      if (status) query = query.eq("status", status);
      if (search) query = query.ilike("email", `%${search}%`);

      const { data: members, error: queryError } = await query;
      if (queryError) throw queryError;

      const { data: batches } = await client
        .from("institute_batches")
        .select("id, name, exam")
        .eq("institute_id", resolved.context.organizationId);

      const mappedBatches = (batches ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        targetExam: b.exam,
      }));

      const allMembers = members ?? [];
      total = allMembers.length;
      const paginated = allMembers.slice((page - 1) * perPage, page * perPage);

      rows = paginated.map((m) => {
        const namePart = m.email ? m.email.split("@")[0] : "Member";
        return {
          member_id: m.id,
          user_id: m.user_id,
          email: m.email ?? "",
          member_role: m.role as OrganizationMemberDirectoryRecord["role"],
          member_status: m.status as OrganizationMemberDirectoryRecord["status"],
          display_name: namePart.charAt(0).toUpperCase() + namePart.slice(1),
          phone: null,
          alternate_phone: null,
          roll_number: null,
          employee_code: null,
          guardian_name: null,
          guardian_phone: null,
          qualification: null,
          subject_specialization: null,
          joined_on: m.created_at ? String(m.created_at).split("T")[0] : null,
          batches: mappedBatches,
          created_at: m.created_at,
          total_count: total,
        };
      });
    } catch (fallbackError) {
      console.error("Member directory fallback query failed", fallbackError);
      return Response.json({ error: "Unable to load members." }, { status: 503 });
    }
  } else {
    rows = (rpcResult.data ?? []) as MemberRow[];
    total = Number(rows[0]?.total_count ?? 0);
  }

  return Response.json({
    members: rows.map(toMember),
    pagination: { page, perPage, total, pages: Math.max(1, Math.ceil(total / perPage)) },
  });
}

export async function PATCH(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  const parsed = profileSchema.safeParse(await request.json().catch(() => null));
  if (!parsedSlug.success || !parsed.success) {
    return Response.json({ error: "Invalid member profile." }, { status: 400 });
  }

  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "members:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data: target, error: targetError } = await getPrepziiAdmin()
    .from("institute_members")
    .select("id,user_id,role,status")
    .eq("id", parsed.data.memberId)
    .eq("institute_id", resolved.context.organizationId)
    .maybeSingle<{ id: string; user_id: string | null; role: string; status: string }>();
  if (targetError) {
    console.error("Member lookup failed", targetError);
    return Response.json({ error: "Unable to update member." }, { status: 503 });
  }
  if (!target) return Response.json({ error: "Member not found." }, { status: 404 });
  if (
    (resolved.context.role !== "OWNER" && target.role === "COACHING_ADMIN")
    || (target.role !== parsed.data.role && !canGrantRole(resolved.context.role, parsed.data.role))
  ) {
    return Response.json({ error: "You cannot modify that member role." }, { status: 403 });
  }

  const value = parsed.data;
  const { error } = await getPrepziiAdmin().rpc("lms_update_member_profile", {
    p_organization_id: resolved.context.organizationId,
    p_member_id: value.memberId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_role: value.role,
    p_status: value.status,
    p_display_name: value.displayName,
    p_phone: value.phone,
    p_alternate_phone: value.alternatePhone,
    p_roll_number: value.rollNumber,
    p_employee_code: value.employeeCode,
    p_guardian_name: value.guardianName,
    p_guardian_phone: value.guardianPhone,
    p_qualification: value.qualification,
    p_subject_specialization: value.subjectSpecialization,
    p_joined_on: value.joinedOn,
  });
  if (error) {
    if (error.code === "23505") return Response.json({ error: "Roll number or employee code is already in use." }, { status: 409 });
    console.error("Member profile update failed", error);
    return Response.json({ error: "Unable to update member." }, { status: 503 });
  }

  // Handle batch assignment update if batchId is provided
  if (value.batchId !== undefined) {
    const effectiveUserId = target.user_id || `usr_${target.id.replaceAll("-", "")}`;
    if (!target.user_id) {
      await getPrepziiAdmin()
        .from("institute_members")
        .update({ user_id: effectiveUserId })
        .eq("id", target.id);
    }

    if (value.batchId) {
      await getPrepziiAdmin()
        .from("organization_batch_members")
        .upsert({
          organization_id: resolved.context.organizationId,
          batch_id: value.batchId,
          user_id: effectiveUserId,
          role: value.role,
          roll_number: value.rollNumber,
        }, { onConflict: "batch_id,user_id" });
    } else {
      await getPrepziiAdmin()
        .from("organization_batch_members")
        .delete()
        .eq("organization_id", resolved.context.organizationId)
        .eq("user_id", effectiveUserId);
    }
  }

  return Response.json({ updated: true });
}

export async function POST(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  const parsed = createMemberSchema.safeParse(await request.json().catch(() => null));
  if (!parsedSlug.success || !parsed.success) {
    return Response.json({ error: "Invalid member data." }, { status: 400 });
  }

  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "members:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  if (!canGrantRole(resolved.context.role, parsed.data.role)) {
    return Response.json({ error: "You cannot grant that member role." }, { status: 403 });
  }

  const client = getPrepziiAdmin();
  const organizationId = resolved.context.organizationId;
  const value = parsed.data;

  // Check if member already exists in this institute
  const { data: existing } = await client
    .from("institute_members")
    .select("id, user_id, role, status")
    .eq("institute_id", organizationId)
    .ilike("email", value.email)
    .maybeSingle<{ id: string; user_id: string | null; role: string; status: string }>();

  let memberId = existing?.id;
  let userId = existing?.user_id;

  if (existing) {
    if (existing.role !== value.role && (existing.role === "OWNER" || existing.role === "COACHING_ADMIN")) {
      return Response.json({ error: "Cannot modify role of existing institute administrator." }, { status: 409 });
    }
    userId = userId || `usr_${existing.id.replaceAll("-", "")}`;
    await client
      .from("institute_members")
      .update({ role: value.role, status: "ACTIVE", user_id: userId })
      .eq("id", existing.id);
  } else {
    userId = `usr_${crypto.randomUUID().replaceAll("-", "")}`;
    const { data: created, error: createError } = await client
      .from("institute_members")
      .insert({
        institute_id: organizationId,
        user_id: userId,
        email: value.email,
        role: value.role,
        status: "ACTIVE",
      })
      .select("id, user_id")
      .single<{ id: string; user_id: string }>();

    if (createError) {
      if (createError.code === "23505") return Response.json({ error: "A member with this email already exists." }, { status: 409 });
      console.error("Member creation failed", createError);
      return Response.json({ error: "Unable to create member." }, { status: 503 });
    }
    memberId = created.id;
    userId = created.user_id;
  }

  // Create or update member profile
  const { error: profileError } = await client
    .from("organization_member_profiles")
    .upsert({
      organization_id: organizationId,
      membership_id: memberId,
      display_name: value.displayName,
      phone: value.phone,
      alternate_phone: value.alternatePhone,
      roll_number: value.rollNumber,
      employee_code: value.employeeCode,
      guardian_name: value.guardianName,
      guardian_phone: value.guardianPhone,
      qualification: value.qualification,
      subject_specialization: value.subjectSpecialization,
      joined_on: value.joinedOn || new Date().toISOString().split("T")[0],
    }, { onConflict: "membership_id" });

  if (profileError) {
    if (profileError.code === "23505") return Response.json({ error: "Roll number or employee code is already in use." }, { status: 409 });
    console.error("Member profile creation failed", profileError);
    return Response.json({ error: "Unable to save member profile." }, { status: 503 });
  }

  // If batchId is provided, enroll in batch
  if (value.batchId && userId) {
    await client.from("organization_batch_members").upsert({
      organization_id: organizationId,
      batch_id: value.batchId,
      user_id: userId,
      role: value.role,
      roll_number: value.rollNumber,
    }, { onConflict: "batch_id,user_id" });
  }

  // If converting from an Admissions CRM lead, mark the lead as CONVERTED
  if (value.leadId && memberId) {
    await client.from("organization_leads").update({
      stage: "CONVERTED",
      converted_student_id: memberId,
      converted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", value.leadId).eq("organization_id", organizationId);
  }

  // Audit log
  await client.from("organization_audit_logs").insert({
    organization_id: organizationId,
    actor_user_id: resolved.context.userId,
    actor_role: resolved.context.role,
    action: value.leadId ? "lead.converted_to_student" : "member.enrolled",
    entity_type: "institute_member",
    entity_id: memberId,
    after_state: {
      role: value.role,
      displayName: value.displayName,
      email: value.email,
      batchId: value.batchId,
      rollNumber: value.rollNumber,
      leadId: value.leadId,
    },
  });

  return Response.json({
    success: true,
    member: {
      id: memberId,
      userId,
      email: value.email,
      displayName: value.displayName,
      role: value.role,
      batchId: value.batchId,
    },
  }, { status: 201 });
}
