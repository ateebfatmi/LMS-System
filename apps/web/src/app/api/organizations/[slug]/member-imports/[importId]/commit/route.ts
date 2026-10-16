import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const paramsSchema = z.object({
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  importId: z.uuid(),
});
type Context = { params: Promise<{ slug: string; importId: string }> };

export async function POST(_request: Request, context: Context) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return Response.json({ error: "Invalid import." }, { status: 400 });

  const resolved = await getAuthorizedOrganizationContext(parsed.data.slug, "members:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await getPrepziiAdmin().rpc("lms_commit_member_import", {
    p_organization_id: resolved.context.organizationId,
    p_import_id: parsed.data.importId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
  });
  if (error) {
    if (error.code === "P0002") return Response.json({ error: "Import not found." }, { status: 404 });
    if (error.code === "22023") return Response.json({ error: "Resolve all validation errors before committing." }, { status: 409 });
    if (error.code === "23505") return Response.json({ error: "An existing member has a conflicting role or identifier." }, { status: 409 });
    console.error("Member import commit failed", error);
    return Response.json({ error: "Unable to commit member import." }, { status: 503 });
  }
  return Response.json({ result: (data as Record<string, unknown>[] | null)?.[0] ?? null });
}
