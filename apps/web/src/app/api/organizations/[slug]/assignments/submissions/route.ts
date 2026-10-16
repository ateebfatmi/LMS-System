import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { safeLearningFilename, validateSubmissionUpload } from "@prepzii/learning";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "content:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const assignmentId = uuid.safeParse(form?.get("assignmentId"));
  const textResponse = String(form?.get("textResponse") ?? "").trim();
  const candidate = form?.get("file");
  const file = candidate instanceof File && candidate.size > 0 ? candidate : null;
  if (!assignmentId.success || (!textResponse && !file)) return Response.json({ error: "A text response or file is required." }, { status: 400 });
  if (textResponse.length > 50000) return Response.json({ error: "Text response is too long." }, { status: 400 });
  if (file) {
    const errors = validateSubmissionUpload(file);
    if (errors.length) return Response.json({ error: errors[0] }, { status: 400 });
  }

  const client = getPrepziiAdmin();
  const bucket = "organization-submissions";
  let objectPath: string | null = null;
  let filePayload: Record<string, unknown> = {};
  if (file) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const actorKey = createHash("sha256").update(resolved.context.userId).digest("hex").slice(0, 24);
    objectPath = `organizations/${resolved.context.organizationId}/assignments/${assignmentId.data}/${actorKey}/${randomUUID()}-${safeLearningFilename(file.name)}`;
    const uploaded = await client.storage.from(bucket).upload(objectPath, bytes, { contentType: file.type, upsert: false, cacheControl: "private, max-age=0" });
    if (uploaded.error) {
      console.error("Assignment file upload failed", uploaded.error);
      return Response.json({ error: "Unable to store submission file." }, { status: 503 });
    }
    filePayload = {
      fileName: file.name, storageBucket: bucket, storagePath: objectPath, mimeType: file.type,
      byteSize: file.size, sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  }

  const { data, error } = await client.rpc("lms_assignment_mutation", {
    p_organization_id: resolved.context.organizationId, p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role, p_action: "SUBMIT_ASSIGNMENT",
    p_payload: { assignmentId: assignmentId.data, textResponse: textResponse || null, ...filePayload },
  });
  if (error) {
    if (objectPath) await client.storage.from(bucket).remove([objectPath]);
    if (error.code === "42501") return Response.json({ error: "This assignment is not available." }, { status: 403 });
    if (error.code === "22023") return Response.json({ error: error.message }, { status: 400 });
    console.error("Assignment submission failed", error);
    return Response.json({ error: "Unable to submit assignment." }, { status: 503 });
  }
  return Response.json({ result: data }, { status: 201 });
}
