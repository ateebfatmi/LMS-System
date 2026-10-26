import { z } from "zod";
import { requireDatabaseCount, requireDatabaseQuery } from "@/lib/database-query";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("REQUEST_PLAN_CHANGE"), payload: z.object({ planId: z.string().min(1).max(50), billingInterval: z.enum(["monthly", "yearly"]) }) }),
  z.object({ action: z.literal("CANCEL_AT_PERIOD_END"), payload: z.object({ cancel: z.boolean() }) }),
  z.object({ action: z.literal("UPDATE_BRANDING"), payload: z.object({ logoUrl: z.url().startsWith("https://").nullable(), primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), supportEmail: z.email().nullable(), supportPhone: z.string().trim().min(8).max(30).nullable(), subdomain: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(63).nullable() }) }),
]);
type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "subscriptions:manage");
  if (!resolved || resolved.context.role !== "OWNER") return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const organizationId = resolved.context.organizationId;
  try {
    const [subscription, plans, usage, branding, overrides, memberCount, campusCount] = await Promise.all([
      requireDatabaseQuery(client.from("organization_subscriptions").select("*").eq("organization_id", organizationId).maybeSingle(), null, "Load subscription"),
      requireDatabaseQuery(client.from("subscription_plans").select("id,name,monthly_price_paise,annual_price_paise,student_limit,branch_limit,storage_gb,ai_credits_per_month,features,entitlements,is_active").eq("is_active", true).order("monthly_price_paise"), [], "Load subscription plans"),
      requireDatabaseQuery(client.from("organization_usage_counters").select("metric,period_start,period_end,quantity").eq("organization_id", organizationId).order("period_start", { ascending: false }), [], "Load subscription usage"),
      requireDatabaseQuery(client.from("organization_branding").select("logo_url,primary_color,support_email,support_phone,subdomain,subdomain_verified_at").eq("organization_id", organizationId).maybeSingle(), null, "Load organization branding"),
      requireDatabaseQuery(client.from("organization_feature_overrides").select("feature_key,enabled,reason").eq("organization_id", organizationId), [], "Load feature overrides"),
      requireDatabaseCount(client.from("institute_members").select("id", { count: "exact", head: true }).eq("institute_id", organizationId).eq("role", "STUDENT").eq("status", "ACTIVE"), 0, "Count active students"),
      requireDatabaseCount(client.from("organization_campuses").select("id", { count: "exact", head: true }).eq("organization_id", organizationId), 0, "Count campuses"),
    ]);
    return Response.json({
      subscription,
      plans,
      usage,
      branding,
      featureOverrides: overrides,
      counts: { activeStudents: memberCount, campuses: campusCount },
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Subscription workspace query failed", error);
    return Response.json({ error: "Subscription data is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!slug.success || !parsed.success) return Response.json({ error: "Invalid subscription operation." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "subscriptions:manage");
  if (!resolved || resolved.context.role !== "OWNER") return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const { data, error } = await client.rpc("lms_subscription_mutation", {
    p_organization_id: resolved.context.organizationId, p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role, p_action: parsed.data.action, p_payload: parsed.data.payload,
  });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "Only the institute owner can manage billing." }, { status: 403 });
    if (error.code === "23505") return Response.json({ error: "That subdomain is already reserved." }, { status: 409 });
    if (["22023", "23503"].includes(error.code ?? "")) return Response.json({ error: error.message }, { status: 400 });
    console.error("Subscription mutation failed", error); return Response.json({ error: "Unable to update subscription." }, { status: 503 });
  }
  return Response.json({ result: data });
}
