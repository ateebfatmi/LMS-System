import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_LEAD"),
    payload: z.object({
      name: z.string().trim().min(2).max(120),
      phone: z.string().trim().min(7).max(24),
      email: z.email().max(200).nullable(),
      guardianName: z.string().trim().max(120).nullable(),
      guardianPhone: z.string().trim().max(24).nullable(),
      targetExam: z.enum(["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION", "BOARDS", "OTHER"]),
      targetBatchId: uuid.nullable(),
      source: z.enum(["WALK_IN", "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "NEWSPAPER", "CAMPAIGN", "OTHER"]),
      assignedCounsellorName: z.string().trim().max(120).nullable(),
      followUpDate: z.iso.date().nullable(),
      estimatedFeePaise: z.number().int().min(0).max(1_000_000_000),
      notes: z.string().trim().max(2000).nullable(),
    }),
  }),
  z.object({ action: z.literal("UPDATE_STAGE"), payload: z.object({ leadId: uuid, stage: z.enum(["NEW", "CONTACTED", "COUNSELLING_SCHEDULED", "TRIAL_ATTENDED", "LOST"]) }) }),
  z.object({ action: z.literal("UPDATE_FOLLOW_UP"), payload: z.object({ leadId: uuid, followUpDate: z.iso.date().nullable(), notes: z.string().trim().max(2000).nullable() }) }),
]);

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "crm:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const organizationId = resolved.context.organizationId;
  const [leads, batches] = await Promise.all([
    client.from("organization_leads")
      .select("id,name,email,phone,guardian_name,guardian_phone,target_exam,target_batch_id,source,assigned_counsellor_name,stage,follow_up_date,estimated_fee,notes,converted_student_id,converted_at,created_at,updated_at")
      .eq("organization_id", organizationId).order("updated_at", { ascending: false }),
    client.from("organization_batches").select("id,name,target_exam").eq("organization_id", organizationId).eq("is_active", true).order("name"),
  ]);
  if (leads.error || batches.error) {
    console.error("CRM query failed", leads.error ?? batches.error);
    return Response.json({ error: "Unable to load admissions CRM." }, { status: 503 });
  }
  return Response.json({ leads: leads.data ?? [], batches: batches.data ?? [] }, { headers: { "cache-control": "private, no-store" } });
}

export async function POST(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!slug.success || !parsed.success) return Response.json({ error: "Invalid CRM operation." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "crm:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await getPrepziiAdmin().rpc("lms_crm_mutation", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_action: parsed.data.action,
    p_payload: parsed.data.payload,
  });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "You cannot manage admissions leads." }, { status: 403 });
    if (["22023", "23503", "23505"].includes(error.code ?? "")) return Response.json({ error: error.message }, { status: 409 });
    console.error("CRM mutation failed", error);
    return Response.json({ error: "Unable to save admissions lead." }, { status: 503 });
  }
  return Response.json({ result: data }, { status: 201 });
}
