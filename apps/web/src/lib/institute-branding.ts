import "server-only";

import { INSTITUTE_ACCENT_PATTERN } from "@prepzii/contracts";
import { getPrepziiAdmin, publicWorkspace, type Workspace } from "@/lib/prepzii-backend";

export const instituteBrandingBucket = "organization-branding";
export const privateBrandingHeaders = { "cache-control": "private, no-store" };
export const organizationSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const versionPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function instituteLogoPath(organizationId: string, version: string): string {
  return `organizations/${organizationId}/branding/${version}.webp`;
}

export function instituteLogoVersion(organizationId: string, path: string | null): string | null {
  const version = path?.split("/").at(-1)?.slice(0, -5);
  return version && versionPattern.test(version) && path === instituteLogoPath(organizationId, version) ? version : null;
}

type InstituteBranding = { logo_url: string | null; logo_storage_path: string | null; primary_color: string | null };

export async function readInstituteBranding(organizationId: string) {
  const { data, error } = await getPrepziiAdmin().from("organization_branding")
    .select("logo_url, logo_storage_path, primary_color")
    .eq("organization_id", organizationId)
    .maybeSingle<InstituteBranding>();
  if (error) throw error;
  return data;
}

async function readWorkspaceBranding(organizationId: string): Promise<InstituteBranding | null> {
  try {
    return await readInstituteBranding(organizationId);
  } catch (error) {
    // Workspace selection can run before the uploaded-logo migration reaches this database.
    if (error && typeof error === "object" && "code" in error && error.code === "42703") {
      try {
        const { data, error: legacyError } = await getPrepziiAdmin().from("organization_branding")
          .select("logo_url, primary_color")
          .eq("organization_id", organizationId)
          .maybeSingle<Omit<InstituteBranding, "logo_storage_path">>();
        if (legacyError) throw legacyError;
        return data ? { ...data, logo_storage_path: null } : null;
      } catch (legacyError) {
        console.warn("Workspace branding lookup failed", legacyError);
        return null;
      }
    }
    console.warn("Workspace branding lookup failed", error);
    return null;
  }
}

export async function brandedWorkspace(workspace: Workspace) {
  const organization = publicWorkspace(workspace);
  const branding = await readWorkspaceBranding(organization.id);
  const version = instituteLogoVersion(organization.id, branding?.logo_storage_path ?? null);
  const legacyAccent = workspace.institute.primary_color;
  const accentColor = branding ? branding.primary_color : legacyAccent?.toUpperCase() === "#FACC15" ? null : legacyAccent;
  const legacyLogo = [branding?.logo_url, organization.logoUrl].find((url) => url?.startsWith("https://"));

  return {
    ...organization,
    logoUrl: version ? `/api/organizations/${encodeURIComponent(organization.slug)}/branding/logo?v=${version}` : legacyLogo ?? null,
    accentColor: accentColor && INSTITUTE_ACCENT_PATTERN.test(accentColor) ? accentColor : null,
  };
}
