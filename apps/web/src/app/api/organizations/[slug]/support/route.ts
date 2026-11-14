import { z } from "zod";
import { getOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const decision = z.object({ requestId: z.uuid(), decision: z.enum(["APPROVE", "REJECT", "REVOKE"]) });
const headers = { "cache-control": "private, no-store" };
type Context = RouteContext<"/api/organizations/[slug]/support">;

export async function GET(_request: Request, context: Context) {
  const workspace = await getOrganizationContext((await context.params).slug, ["OWNER"]);
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403, headers });
  const { data, error } = await getPrepziiAdmin().from("platform_support_access_requests")
    .select("id,reason,status,expires_at,created_at").eq("organization_id", workspace.context.organizationId)
    .order("created_at", { ascending: false }).limit(50);
  if (error) return Response.json({ error: "Unable to load support requests." }, { status: 503, headers });
  return Response.json({ requests: data }, { headers });
}

export async function POST(request: Request, context: Context) {
  const workspace = await getOrganizationContext((await context.params).slug, ["OWNER"]);
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403, headers });
  const parsed = decision.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid support request decision." }, { status: 400, headers });
  const { organizationId, userId } = workspace.context;
  const { data, error } = await getPrepziiAdmin().rpc("lms_review_support_access", {
    p_organization_id: organizationId, p_request_id: parsed.data.requestId, p_actor_user_id: userId,
    p_actor_role: "OWNER", p_decision: parsed.data.decision,
  });
  if (error) return Response.json({ error: "Unable to review support request." }, { status: error.code === "23503" ? 404 : 409, headers });
  return Response.json({ result: data }, { headers });
}
