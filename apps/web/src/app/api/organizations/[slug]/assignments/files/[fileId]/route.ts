import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
type Context = { params: Promise<{ slug: string; fileId: string }> };
type FileAccess = { name: string; storageBucket: string; storagePath: string };

export async function GET(_request: Request, context: Context) {
  const params = await context.params;
  const slug = slugSchema.safeParse(params.slug);
  const fileId = uuid.safeParse(params.fileId);
  if (!slug.success || !fileId.success) return Response.json({ error: "Invalid file." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "content:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const { data, error } = await client.rpc("lms_get_assignment_file", {
    p_organization_id: resolved.context.organizationId, p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role, p_file_id: fileId.data,
  });
  if (error) {
    console.error("Assignment file authorization failed", error);
    return Response.json({ error: "Unable to authorize this file." }, { status: 503 });
  }
  if (!data) return Response.json({ error: "File not found." }, { status: 404 });
  const file = data as FileAccess;
  const signed = await client.storage.from(file.storageBucket).createSignedUrl(file.storagePath, 300, { download: file.name });
  if (signed.error) return Response.json({ error: "Unable to open this file." }, { status: 503 });
  return Response.json({ url: signed.data.signedUrl, expiresIn: 300 }, { headers: { "cache-control": "private, no-store" } });
}
