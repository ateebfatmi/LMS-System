import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";
import {
  INSTITUTE_ACCENT_PATTERN, INSTITUTE_LOGO_FORMATS, INSTITUTE_LOGO_MAX_BYTES, INSTITUTE_NAME_MAX_LENGTH,
} from "@prepzii/contracts";
import {
  instituteBrandingBucket, instituteLogoPath, instituteLogoVersion, organizationSlugPattern, privateBrandingHeaders,
} from "@/lib/institute-branding";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const fields = z.object({
  name: z.string().trim().min(1).max(INSTITUTE_NAME_MAX_LENGTH),
  accentColor: z.string().regex(INSTITUTE_ACCENT_PATTERN).nullable(),
  logoAction: z.enum(["keep", "remove", "replace"]),
});
const maxBodyBytes = INSTITUTE_LOGO_MAX_BYTES + 16 * 1024;

function reject(error: string, status: number) {
  return Response.json({ error }, { status, headers: privateBrandingHeaders });
}

async function readBrandingForm(request: Request) {
  if (!request.body || Number(request.headers.get("content-length")) > maxBodyBytes) return null;
  let size = 0;
  const body = request.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > maxBodyBytes) throw new Error("Branding upload is too large");
      controller.enqueue(chunk);
    },
  }));
  return new Response(body, { headers: request.headers }).formData().catch(() => null);
}

async function normalizeLogo(file: File) {
  if (!file.size || file.size > INSTITUTE_LOGO_MAX_BYTES || !INSTITUTE_LOGO_FORMATS.some((type) => type === file.type)) {
    return null;
  }
  try {
    const image = sharp(await file.arrayBuffer(), { limitInputPixels: 4096 ** 2, failOn: "warning" });
    const metadata = await image.metadata();
    if (`image/${metadata.format}` !== file.type || (metadata.pages ?? 1) > 1) return null;
    return await image.autoOrient().resize(512, 512, { fit: "inside", withoutEnlargement: true }).webp().toBuffer();
  } catch {
    return null;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (slug.length > 64 || !organizationSlugPattern.test(slug)) return reject("Invalid institute.", 400);
  const workspace = await getAuthorizedOrganizationContext(slug, "organization:manage");
  if (workspace?.context.role !== "OWNER") return reject("Only the institute owner can update branding.", 403);

  const form = await readBrandingForm(request);
  if (!form) return reject("Use a branding form with a logo under 2 MB.", 400);
  const values = fields.safeParse({
    name: form.get("name"),
    accentColor: form.get("accentColor") || null,
    logoAction: form.get("logoAction"),
  });
  if (!values.success) return reject("Enter an institute name and a valid accent color.", 400);

  const { name, accentColor, logoAction } = values.data;
  const { organizationId, userId } = workspace.context;
  const client = getPrepziiAdmin();
  const storage = client.storage.from(instituteBrandingBucket);
  let logoPath: string | null = null;

  if (logoAction === "replace") {
    const file = form.get("logo");
    const image = file instanceof File ? await normalizeLogo(file) : null;
    if (!image) return reject("Choose a valid PNG, JPEG, or WebP image up to 2 MB and 16 megapixels.", 400);

    logoPath = instituteLogoPath(organizationId, randomUUID());
    const { error } = await storage.upload(logoPath, image, { contentType: "image/webp", upsert: false });
    if (error) {
      console.error("Institute logo upload failed", error);
      return reject("Unable to store the institute logo.", 503);
    }
  }

  const { data: previousLogo, error, status } = await client.rpc("lms_update_institute_branding", {
    p_organization_id: organizationId,
    p_actor_user_id: userId,
    p_name: name,
    p_accent_color: accentColor,
    p_change_logo: logoAction !== "keep",
    p_logo_storage_path: logoPath,
  });

  // A timeout may occur after commit. Only remove a new object on a definitive rejection.
  const cleanupPath = error ? (status >= 400 && status < 500 ? logoPath : null) : previousLogo;
  if (typeof cleanupPath === "string" && instituteLogoVersion(organizationId, cleanupPath)) {
    const removed = await storage.remove([cleanupPath]);
    if (removed.error) console.error("Institute logo cleanup failed", removed.error);
  }

  if (error) {
    if (error.code === "42501") return reject("Only the institute owner can update branding.", 403);
    console.error("Institute branding update failed", error);
    return reject("Unable to save institute branding.", 503);
  }
  return new Response(null, { status: 204, headers: privateBrandingHeaders });
}
