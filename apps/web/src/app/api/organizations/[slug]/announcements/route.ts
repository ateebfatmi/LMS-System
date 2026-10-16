import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE"), payload: z.object({ title: z.string().trim().min(3).max(180), content: z.string().trim().min(3).max(5000), category: z.enum(["ACADEMIC", "EXAM", "HOLIDAY", "FEE", "GENERAL"]), priority: z.enum(["NORMAL", "HIGH", "URGENT"]), targetAudience: z.enum(["ALL", "BATCH", "FACULTY", "PARENTS"]), batchId: uuid.nullable(), status: z.enum(["DRAFT", "PUBLISHED"]), channels: z.array(z.enum(["PORTAL", "EMAIL", "SMS", "WHATSAPP"])).min(1).max(4) }) }),
  z.object({ action: z.literal("PUBLISH"), payload: z.object({ announcementId: uuid }) }),
  z.object({ action: z.literal("MARK_READ"), payload: z.object({ notificationId: uuid }) }),
]);
type Context = { params: Promise<{ slug: string }> };
type Row = Record<string, unknown>;
async function many(query: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>) { const result = await query; if (result.error) throw new Error(result.error.message); return result.data ?? []; }

export async function GET(_request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug); if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "announcements:read"); if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin(); const { organizationId, userId, role } = resolved.context;
  try {
    let announcements = await many(client.from("organization_announcements").select("id,batch_id,title,content,target_audience,priority,category,status,channels,created_by,published_at,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(200));
    let allowedBatchIds = new Set<string>();
    if (["STUDENT", "TEACHER"].includes(role)) { const memberships = await many(client.from("organization_batch_members").select("batch_id").eq("organization_id", organizationId).eq("user_id", userId)); allowedBatchIds = new Set(memberships.map((row) => String(row.batch_id))); }
    if (role === "STUDENT") announcements = announcements.filter((item) => item.status === "PUBLISHED" && (item.target_audience === "ALL" || (item.target_audience === "BATCH" && allowedBatchIds.has(String(item.batch_id)))));
    else if (role === "PARENT") announcements = announcements.filter((item) => item.status === "PUBLISHED" && ["ALL", "PARENTS"].includes(String(item.target_audience)));
    else if (role === "TEACHER") announcements = announcements.filter((item) => item.status === "PUBLISHED" || item.created_by === userId);
    const [notifications, batches, deliveries] = await Promise.all([
      many(client.from("organization_notifications").select("id,announcement_id,kind,title,body,action_url,read_at,created_at").eq("organization_id", organizationId).eq("recipient_user_id", userId).order("created_at", { ascending: false }).limit(100)),
      role === "STUDENT" || role === "PARENT" ? Promise.resolve([]) : many(client.from("organization_batches").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("name")),
      ["OWNER", "COACHING_ADMIN"].includes(role) ? many(client.from("organization_delivery_jobs").select("id,announcement_id,channel,status,provider,recipient_count,delivered_count,failed_count,last_error,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }).limit(100)) : Promise.resolve([]),
    ]);
    return Response.json({ role, announcements, notifications, batches, deliveries }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { console.error("Announcement workspace query failed", error); return Response.json({ error: "Unable to load announcements." }, { status: 503 }); }
}

export async function POST(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug); const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!slug.success || !parsed.success) return Response.json({ error: "Invalid announcement operation." }, { status: 400 });
  const permission = parsed.data.action === "MARK_READ" ? "announcements:read" : "announcements:manage";
  const resolved = await getAuthorizedOrganizationContext(slug.data, permission); if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (parsed.data.action === "CREATE" && parsed.data.payload.targetAudience === "BATCH" && !parsed.data.payload.batchId) return Response.json({ error: "Select a target batch." }, { status: 400 });
  const { data, error } = await getPrepziiAdmin().rpc("lms_announcement_mutation", { p_organization_id: resolved.context.organizationId, p_actor_user_id: resolved.context.userId, p_actor_role: resolved.context.role, p_action: parsed.data.action, p_payload: parsed.data.payload });
  if (error) { if (error.code === "42501") return Response.json({ error: "You cannot perform that announcement action." }, { status: 403 }); if (["22023", "23503", "23505"].includes(error.code ?? "")) return Response.json({ error: error.message }, { status: 400 }); console.error("Announcement mutation failed", error); return Response.json({ error: "Unable to save announcement." }, { status: 503 }); }
  return Response.json({ result: data }, { status: 201 });
}
