import { cookies } from "next/headers";
import { z } from "zod";
import { organizationRoles } from "@prepzii/contracts";
import { getOrganizationContext } from "@/lib/prepzii-backend";

const ACTIVE_ORGANIZATION_COOKIE = "prepzii_active_organization";
const selectableRoles = organizationRoles.filter((role) => role !== "PLATFORM_SUPER_ADMIN");
const selectionSchema = z.object({
  slug: z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

function publicOrganization(institute: {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  status: string;
}) {
  return {
    id: institute.id,
    name: institute.name,
    slug: institute.slug,
    logoUrl: institute.logo_url,
    status: institute.status,
  };
}
export async function GET() {
  const cookieStore = await cookies();
  let slug = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value;

  if (!slug) {
    // If no active organization cookie is set yet, auto-select the user's first authorized institute
    const { getActingUserId, listMyOrganizations } = await import("@/lib/prepzii-backend");
    const userId = await getActingUserId();
    if (userId) {
      const orgs = await listMyOrganizations(userId);
      if (orgs.length > 0) {
        slug = orgs[0].slug;
        cookieStore.set(ACTIVE_ORGANIZATION_COOKIE, slug, {
          httpOnly: true,
          sameSite: "lax",
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
    }
  }

  if (!slug) return Response.json({ organization: null });

  const resolved = await getOrganizationContext(slug, selectableRoles);
  if (!resolved) {
    (await cookies()).delete(ACTIVE_ORGANIZATION_COOKIE);
    return Response.json({ organization: null }, { status: 403 });
  }

  return Response.json({
    organization: publicOrganization(resolved.institute),
    role: resolved.context.role,
  });
}
export async function POST(request: Request) {
  const parsed = selectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid organization selection." }, { status: 400 });
  }

  // The browser supplies a slug only as a candidate. Membership is always
  // resolved from Clerk identity and the canonical Prepzii membership table.
  const resolved = await getOrganizationContext(parsed.data.slug, selectableRoles);
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  (await cookies()).set(ACTIVE_ORGANIZATION_COOKIE, parsed.data.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return Response.json({
    organization: publicOrganization(resolved.institute),
    role: resolved.context.role,
  });
}
