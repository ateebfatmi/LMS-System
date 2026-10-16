import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { safeLearningFilename, validateLearningUpload } from "@prepzii/learning";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  if (!parsedSlug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "content:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const lessonId = uuid.safeParse(form?.get("lessonId"));
  const downloadAllowed = form?.get("downloadAllowed") === "true";
  if (!(file instanceof File) || !lessonId.success) return Response.json({ error: "A valid lesson and file are required." }, { status: 400 });
  const validationErrors = validateLearningUpload(file);
  if (validationErrors.length) return Response.json({ error: validationErrors[0] }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  const bucket = "organization-learning";
  const objectPath = `organizations/${resolved.context.organizationId}/lessons/${lessonId.data}/${randomUUID()}-${safeLearningFilename(file.name)}`;
  const client = getPrepziiAdmin();
  const uploaded = await client.storage.from(bucket).upload(objectPath, bytes, { contentType: file.type, upsert: false, cacheControl: "private, max-age=0" });
  if (uploaded.error) {
    console.error("Learning resource upload failed", uploaded.error);
    return Response.json({ error: "Unable to store this resource." }, { status: 503 });
  }

  const { data, error } = await client.rpc("lms_learning_mutation", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_action: "REGISTER_FILE_RESOURCE",
    p_payload: {
      lessonId: lessonId.data, name: file.name, storageBucket: bucket, storagePath: objectPath,
      mimeType: file.type, byteSize: file.size, sha256: digest, downloadAllowed,
    },
  });
  if (error) {
    await client.storage.from(bucket).remove([objectPath]);
    console.error("Learning resource registration failed", error);
    return Response.json({ error: error.code === "23503" ? "Lesson not found." : "Unable to register this resource." }, { status: error.code === "23503" ? 409 : 503 });
  }
  return Response.json({ result: data }, { status: 201 });
}
