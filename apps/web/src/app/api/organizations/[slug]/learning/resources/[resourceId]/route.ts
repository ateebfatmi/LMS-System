import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
type Context = { params: Promise<{ slug: string; resourceId: string }> };
type Resource = { resourceType: "FILE" | "EXTERNAL_LINK"; storageBucket?: string; storagePath?: string; externalUrl?: string; downloadAllowed: boolean; name: string };

export async function GET(_request: Request, context: Context) {
  const params = await context.params;
  const slug = slugSchema.safeParse(params.slug);
  const resourceId = uuid.safeParse(params.resourceId);
  if (!slug.success || !resourceId.success) return Response.json({ error: "Invalid resource." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "content:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const { data, error } = await client.rpc("lms_get_learning_resource", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_resource_id: resourceId.data,
  });
  if (error) {
    console.error("Learning resource access failed", error);
    return Response.json({ error: "Unable to authorize this resource." }, { status: 503 });
  }
  if (!data) return Response.json({ error: "Resource not found." }, { status: 404 });
  const resource = data as Resource;
  if (resource.resourceType === "EXTERNAL_LINK") {
    return Response.json({ url: resource.externalUrl, external: true }, { headers: { "cache-control": "private, no-store" } });
  }
  if (!resource.storageBucket || !resource.storagePath) return Response.json({ error: "Resource is unavailable." }, { status: 404 });
  const signed = await client.storage.from(resource.storageBucket).createSignedUrl(resource.storagePath, 300, { download: resource.downloadAllowed ? resource.name : false });
  if (signed.error) {
    console.error("Learning resource signing failed", signed.error);
    return Response.json({ error: "Unable to open this resource." }, { status: 503 });
  }
  return Response.json({ url: signed.data.signedUrl, expiresIn: 300, external: false }, { headers: { "cache-control": "private, no-store" } });
}
