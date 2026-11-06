import {
  instituteBrandingBucket, instituteLogoVersion, privateBrandingHeaders, readInstituteBranding,
} from "@/lib/institute-branding";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const workspace = await getAuthorizedOrganizationContext(slug, "organization:read");
  if (!workspace) return new Response(null, { status: 403, headers: privateBrandingHeaders });

  const { organizationId } = workspace.context;
  const branding = await readInstituteBranding(organizationId);
  const path = branding?.logo_storage_path;
  const version = new URL(request.url).searchParams.get("v");
  if (!path || !version || version !== instituteLogoVersion(organizationId, path)) {
    return new Response(null, { status: 404, headers: privateBrandingHeaders });
  }

  const { data, error } = await getPrepziiAdmin().storage.from(instituteBrandingBucket).download(path);
  if (error) {
    console.error("Institute logo download failed", error);
    return new Response(null, { status: 503, headers: privateBrandingHeaders });
  }
  return new Response(data, {
    headers: { ...privateBrandingHeaders, "content-type": "image/webp", "x-content-type-options": "nosniff" },
  });
}
