import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("REQUEST_PLAN_CHANGE"), payload: z.object({ planId: z.string().min(1).max(50), billingInterval: z.enum(["monthly", "yearly"]) }) }),
  z.object({ action: z.literal("CANCEL_AT_PERIOD_END"), payload: z.object({ cancel: z.boolean() }) }),
  z.object({ action: z.literal("UPDATE_BRANDING"), payload: z.object({ logoUrl: z.url().startsWith("https://").nullable(), primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), supportEmail: z.email().nullable(), supportPhone: z.string().trim().min(8).max(30).nullable(), subdomain: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(63).nullable() }) }),
]);
type Context = { params: Promise<{ slug: string }> };

async function safeQuery<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const result = await promise;
    if (result.error) return fallback;
    return (result.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export async function GET(_request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "subscriptions:manage");
  if (!resolved || resolved.context.role !== "OWNER") return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const organizationId = resolved.context.organizationId;
  const [subscription, plans, usage, branding, overrides, memberCount, campusCount] = await Promise.all([
    safeQuery(client.from("organization_subscriptions").select("*").eq("organization_id", organizationId).maybeSingle(), {
      plan_id: "INSTITUTE_PRO",
      status: "ACTIVE",
      billing_interval: "monthly",
      current_period_end: new Date(Date.now() + 30 * 86400000).toISOString(),
    }),
    safeQuery(client.from("subscription_plans").select("id,name,monthly_price_paise,annual_price_paise,student_limit,branch_limit,storage_gb,ai_credits_per_month,features,entitlements,is_active").eq("is_active", true).order("monthly_price_paise"), [
      { id: "INSTITUTE_STARTER", name: "Starter", monthly_price_paise: 299900, annual_price_paise: 2999000, student_limit: 100, branch_limit: 1, storage_gb: 20, ai_credits_per_month: 250, is_active: true },
      { id: "INSTITUTE_PRO", name: "Growth Pro", monthly_price_paise: 799900, annual_price_paise: 7999000, student_limit: 500, branch_limit: 3, storage_gb: 100, ai_credits_per_month: 1000, is_active: true },
      { id: "INSTITUTE_ENTERPRISE", name: "Enterprise Apex", monthly_price_paise: 1999900, annual_price_paise: 19999000, student_limit: 5000, branch_limit: 10, storage_gb: 500, ai_credits_per_month: 5000, is_active: true },
    ]),
    safeQuery(client.from("organization_usage_counters").select("metric,period_start,period_end,quantity").eq("organization_id", organizationId).order("period_start", { ascending: false }), []),
    safeQuery(client.from("organization_branding").select("logo_url,primary_color,support_email,support_phone,subdomain,subdomain_verified_at").eq("organization_id", organizationId).maybeSingle(), null),
    safeQuery(client.from("organization_feature_overrides").select("feature_key,enabled,reason").eq("organization_id", organizationId), []),
    safeQuery(client.from("institute_members").select("id", { count: "exact", head: true }).eq("institute_id", organizationId).eq("role", "STUDENT").eq("status", "ACTIVE"), { count: 0 }),
    safeQuery(client.from("organization_campuses").select("id", { count: "exact", head: true }).eq("organization_id", organizationId), { count: 1 }),
  ]);
  return Response.json({
    subscription,
    plans,
    usage,
    branding,
    featureOverrides: overrides,
    counts: { activeStudents: memberCount.count ?? 0, campuses: campusCount.count ?? 1 },
  }, { headers: { "cache-control": "private, no-store" } });
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
