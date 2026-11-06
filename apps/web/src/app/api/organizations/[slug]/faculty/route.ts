import { z } from "zod";
import { organizationSlugPattern } from "@/lib/institute-branding";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(organizationSlugPattern);
const batchIds = z.array(z.uuid()).max(200);
const profile = z.object({
  displayName: z.string().trim().min(2).max(160),
  email: z.string().trim().toLowerCase().pipe(z.email().max(320)),
  phone: z.string().trim().max(30).nullable(),
  subjectSpecialization: z.string().trim().max(240).nullable(),
});
const mutation = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), profile, batchIds }),
  z.object({ action: z.literal("edit"), memberId: z.uuid(), profile }),
  z.object({ action: z.literal("assign"), memberId: z.uuid(), batchIds }),
]);
const query = z.object({
  search: z.string().trim().max(120).default(""),
  batchId: z.uuid().optional(),
  memberId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).default(1),
});
type Context = { params: Promise<{ slug: string }> };
const pageSize = 25;
const headers = { "cache-control": "private, no-store" };

export async function GET(request: Request, { params }: Context) {
  const slug = slugSchema.safeParse((await params).slug);
  const parsed = query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!slug.success || !parsed.success) return Response.json({ error: "Invalid faculty directory request." }, { status: 400, headers });
  const workspace = await getAuthorizedOrganizationContext(slug.data, "members:read");
  if (!workspace) return Response.json({ error: "You do not have access to this faculty directory." }, { status: 403, headers });
  const { search, batchId, memberId, page } = parsed.data;
  const { data, error } = await getPrepziiAdmin().rpc("lms_list_faculty", {
    p_organization_id: workspace.context.organizationId,
    p_search: memberId ? "" : search,
    p_batch_id: memberId ? null : batchId ?? null,
    p_member_id: memberId ?? null,
    p_limit: memberId ? 1 : pageSize,
    p_offset: memberId ? 0 : (page - 1) * pageSize,
  });
  if (error) {
    console.error("Faculty directory query failed", error);
    return Response.json({ error: "Unable to load faculty. Try again." }, { status: 503, headers });
  }
  if (memberId && !data.teachers?.length) return Response.json({ error: "Teacher not found." }, { status: 404, headers });
  return Response.json({ ...data, page, pageSize }, { headers });
}

export async function POST(request: Request, { params }: Context) {
  const slug = slugSchema.safeParse((await params).slug);
  if (!slug.success) return Response.json({ error: "Invalid institute." }, { status: 400, headers });
  const workspace = await getAuthorizedOrganizationContext(slug.data, "members:manage");
  if (!workspace) return Response.json({ error: "You do not have permission to manage faculty." }, { status: 403, headers });

  const parsed = mutation.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the teacher details and selected batches." }, { status: 400, headers });
  const value = parsed.data;
  const { data, error } = await getPrepziiAdmin().rpc("lms_save_faculty", {
    p_organization_id: workspace.context.organizationId,
    p_actor_user_id: workspace.context.userId,
    p_actor_role: workspace.context.role,
    p_member_id: value.action === "add" ? null : value.memberId,
    p_profile: value.action === "assign" ? null : value.profile,
    p_batch_ids: value.action === "edit" ? null : value.batchIds,
  });
  if (error) {
    if (error.code === "23505") return Response.json({ error: "This email already belongs to an institute member." }, { status: 409, headers });
    if (error.code === "23503") return Response.json({ error: "A selected batch is no longer available in this institute." }, { status: 400, headers });
    if (error.code === "P0002") return Response.json({ error: "Teacher not found." }, { status: 404, headers });
    if (error.code === "42501") {
      const message = error.message === "Email is locked after invitation or activation"
        ? "The email address is locked while an invitation is open or the account is linked." : "This teacher cannot be updated.";
      return Response.json({ error: message }, { status: 403, headers });
    }
    console.error("Faculty save failed", error);
    return Response.json({ error: "Unable to save the teacher. Try again." }, { status: 503, headers });
  }
  return Response.json({ memberId: data }, { status: value.action === "add" ? 201 : 200, headers });
}
