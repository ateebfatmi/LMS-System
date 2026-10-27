import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_THREAD"), payload: z.object({
    batchId: uuid,
    subject: z.string().trim().min(2).max(120),
    title: z.string().trim().min(3).max(180),
    description: z.string().trim().min(3).max(10000),
    priority: z.enum(["NORMAL", "HIGH"]).default("NORMAL"),
  }) }),
  z.object({ action: z.literal("ADD_MESSAGE"), payload: z.object({
    threadId: uuid,
    body: z.string().trim().min(1).max(10000),
    isInternal: z.boolean().default(false),
  }) }),
  z.object({ action: z.literal("SET_STATUS"), payload: z.object({
    threadId: uuid,
    status: z.enum(["OPEN", "ANSWERED", "RESOLVED", "CLOSED"]),
  }) }),
]);
type Context = { params: Promise<{ slug: string }> };
type Row = Record<string, unknown>;

async function rows(query: PromiseLike<{ data: Row[] | null; error: { message?: string } | null }>): Promise<Row[]> {
  const result = await query;
  if (result.error) throw new Error(result.error.message || "Doubt query failed.");
  return result.data ?? [];
}

export async function GET(_request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  if (!parsedSlug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "organization:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { organizationId, userId, role } = resolved.context;
  if (!["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER", "STUDENT"].includes(role)) {
    return Response.json({ role, threads: [], messages: [], batches: [] });
  }

  try {
    const client = getPrepziiAdmin();
    const [allThreads, memberships, allBatches] = await Promise.all([
      rows(client.from("organization_doubt_threads").select("*").eq("organization_id", organizationId).order("updated_at", { ascending: false })),
      rows(client.from("organization_batch_members").select("batch_id,user_id,role").eq("organization_id", organizationId)),
      rows(client.from("organization_batches").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("name")),
    ]);
    const assignedBatchIds = new Set(memberships.filter((item) => item.user_id === userId && item.role === role).map((item) => String(item.batch_id)));
    const threads = role === "STUDENT"
      ? allThreads.filter((thread) => thread.student_user_id === userId)
      : role === "TEACHER"
        ? allThreads.filter((thread) => assignedBatchIds.has(String(thread.batch_id)))
        : allThreads;
    const threadIds = threads.map((thread) => String(thread.id));
    const rawMessages = threadIds.length
      ? await rows(client.from("organization_doubt_messages").select("*").eq("organization_id", organizationId).in("thread_id", threadIds).order("created_at"))
      : [];
    const messages = role === "STUDENT" ? rawMessages.filter((message) => !message.is_internal) : rawMessages;
    const batches = ["STUDENT", "TEACHER"].includes(role) ? allBatches.filter((batch) => assignedBatchIds.has(String(batch.id))) : allBatches;
    return Response.json({ role, threads, messages, batches }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Doubt workspace query failed", error);
    return Response.json({ error: "Unable to load doubt discussions." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsedSlug.success || !parsed.success) return Response.json({ error: "Invalid doubt operation." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "content:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await getPrepziiAdmin().rpc("lms_doubt_mutation", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_action: parsed.data.action,
    p_payload: parsed.data.payload,
  });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "You cannot access this doubt thread." }, { status: 403 });
    if (["22023", "23514"].includes(error.code ?? "")) return Response.json({ error: error.message }, { status: 400 });
    if (error.code === "23503") return Response.json({ error: "The doubt thread no longer exists." }, { status: 404 });
    console.error("Doubt mutation failed", error);
    return Response.json({ error: "Unable to save the discussion." }, { status: 500 });
  }
  return Response.json({ result: data }, { status: 201 });
}
