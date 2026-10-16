import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const paramsSchema = z.object({
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  invitationId: z.uuid(),
});
type Context = { params: Promise<{ slug: string; invitationId: string }> };

export async function DELETE(_request: Request, context: Context) {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return Response.json({ error: "Invalid invitation." }, { status: 400 });

  const resolved = await getAuthorizedOrganizationContext(parsed.data.slug, "members:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await getPrepziiAdmin().rpc("lms_revoke_invitation", {
    p_organization_id: resolved.context.organizationId,
    p_invitation_id: parsed.data.invitationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
  });

  if (error) {
    if (error.code === "P0002") return Response.json({ error: "Invitation not found." }, { status: 404 });
    if (error.code === "55000") return Response.json({ error: "Accepted invitations cannot be revoked." }, { status: 409 });
    console.error("Invitation revocation failed", error);
    return Response.json({ error: "Unable to revoke invitation." }, { status: 503 });
  }

  return Response.json({ status: data });
}
