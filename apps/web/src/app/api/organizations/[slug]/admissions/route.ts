import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const stages = ["NEW", "CONTACTED", "COUNSELLING_SCHEDULED", "TRIAL_ATTENDED", "LOST"] as const;
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_LEAD"), payload: z.object({
    name: z.string().trim().min(2).max(160), email: z.email().max(254).optional(),
    phone: z.string().trim().regex(/^[+0-9 ()-]{6,30}$/),
    targetExam: z.enum(["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION", "BOARDS", "OTHER"]),
    source: z.enum(["WALK_IN", "WEBSITE", "REFERRAL", "SOCIAL_MEDIA", "NEWSPAPER", "CAMPAIGN", "OTHER"]),
    followUpDate: z.iso.date().optional(),
  }) }),
  z.object({ action: z.literal("UPDATE_STAGE"), payload: z.object({ leadId: z.uuid(), stage: z.enum(stages) }) }),
  z.object({ action: z.literal("UPDATE_FOLLOW_UP"), payload: z.object({ leadId: z.uuid(), followUpDate: z.iso.date().nullable() }) }),
]);
const filters = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  stage: z.enum([...stages, "CONVERTED"]).optional(),
});
const headers = { "cache-control": "private, no-store" };

export async function GET(request: Request, context: RouteContext<"/api/organizations/[slug]/admissions">) {
  const workspace = await getAuthorizedOrganizationContext((await context.params).slug, "crm:read");
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403, headers });
  const parsed = filters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Invalid admission filters." }, { status: 400, headers });
  const { page, stage } = parsed.data;
  const start = (page - 1) * 25;
  let query = getPrepziiAdmin().from("organization_leads")
    .select("id,name,email,phone,target_exam,source,stage,follow_up_date,created_at", { count: "exact" })
    .eq("organization_id", workspace.context.organizationId).order("created_at", { ascending: false }).order("id");
  if (stage) query = query.eq("stage", stage);
  const { data, error, count } = await query.range(start, start + 24);
  if (error) return Response.json({ error: "Unable to load admissions." }, { status: 503, headers });
  return Response.json({ leads: data, total: count }, { headers });
}

export async function POST(request: Request, context: RouteContext<"/api/organizations/[slug]/admissions">) {
  const workspace = await getAuthorizedOrganizationContext((await context.params).slug, "crm:manage");
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the admission details." }, { status: 400, headers });
  const { organizationId, userId, role } = workspace.context;
  const { data, error } = await getPrepziiAdmin().rpc("lms_crm_mutation", {
    p_organization_id: organizationId, p_actor_user_id: userId, p_actor_role: role,
    p_action: parsed.data.action, p_payload: parsed.data.payload,
  });
  if (error) return Response.json({ error: "Unable to save admission." }, { status: error.code === "23503" ? 404 : 503, headers });
  return Response.json({ result: data }, { headers });
}
