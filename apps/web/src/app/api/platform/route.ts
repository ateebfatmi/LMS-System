import { z } from "zod";
import { getActingUserId, getPrepziiAdmin, isPlatformSuperAdmin } from "@/lib/prepzii-backend";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("SET_ORGANIZATION_STATUS"), payload: z.object({ organizationId: z.uuid(), status: z.enum(["ACTIVE", "SUSPENDED"]) }) }),
  z.object({ action: z.literal("UPDATE_PLAN"), payload: z.object({ planId: z.string().min(1).max(50), name: z.string().trim().min(2).max(100), monthlyPricePaise: z.number().int().min(0), annualPricePaise: z.number().int().min(0), studentLimit: z.number().int().min(1), branchLimit: z.number().int().min(1), storageGb: z.number().int().min(1), aiCreditsPerMonth: z.number().int().min(0), entitlements: z.record(z.string(), z.unknown()), isActive: z.boolean() }) }),
  z.object({ action: z.literal("SET_FEATURE_FLAG"), payload: z.object({ key: z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/), description: z.string().trim().min(3).max(500), enabled: z.boolean() }) }),
]);
type Row = Record<string, unknown>;

async function many(query: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function GET() {
  if (!await isPlatformSuperAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  try {
    const [institutes, subscriptions, plans, flags, audits, members, batches] = await Promise.all([
      many(client.from("institutes").select("id,name,slug,owner_user_id,status,created_at").order("created_at", { ascending: false }).limit(500)),
      many(client.from("organization_subscriptions").select("id,organization_id,plan_id,status,current_period_start,current_period_end,trial_ends_at,grace_ends_at,cancel_at_period_end,requested_plan_id,requested_billing_interval,updated_at")),
      many(client.from("subscription_plans").select("id,name,monthly_price_paise,annual_price_paise,student_limit,branch_limit,storage_gb,ai_credits_per_month,entitlements,is_active").order("monthly_price_paise")),
      many(client.from("platform_feature_flags").select("key,description,enabled_by_default,updated_by,updated_at").order("key")),
      many(client.from("platform_audit_logs").select("id,actor_user_id,target_organization_id,action,details,created_at").order("created_at", { ascending: false }).limit(100)),
      many(client.from("institute_members").select("institute_id,role,status")),
      many(client.from("organization_batches").select("organization_id,is_active")),
    ]);
    const counts = institutes.map((institute) => ({ organizationId: institute.id, activeStudents: members.filter((member) => member.institute_id === institute.id && member.role === "STUDENT" && member.status === "ACTIVE").length, activeStaff: members.filter((member) => member.institute_id === institute.id && member.role !== "STUDENT" && member.status === "ACTIVE").length, activeBatches: batches.filter((batch) => batch.organization_id === institute.id && batch.is_active).length }));
    return Response.json({ institutes, subscriptions, plans, flags, audits, counts }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Platform admin query failed", error);
    return Response.json({ error: "Unable to load platform administration." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!await isPlatformSuperAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const actorUserId = await getActingUserId();
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!actorUserId || !parsed.success) return Response.json({ error: "Invalid platform operation." }, { status: 400 });
  const { data, error } = await getPrepziiAdmin().rpc("lms_platform_mutation", { p_actor_user_id: actorUserId, p_action: parsed.data.action, p_payload: parsed.data.payload });
  if (error) {
    if (["22023", "23503", "23514"].includes(error.code ?? "")) return Response.json({ error: error.message }, { status: 400 });
    console.error("Platform mutation failed", error); return Response.json({ error: "Unable to save platform operation." }, { status: 503 });
  }
  return Response.json({ result: data });
}
