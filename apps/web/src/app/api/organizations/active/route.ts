import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_ORGANIZATION_COOKIE, getActiveWorkspace, setActiveWorkspace } from "@/lib/dal/auth-context";
import { findWorkspace, getActingUserId } from "@/lib/prepzii-backend";
import { brandedWorkspace, organizationSlugPattern, privateBrandingHeaders } from "@/lib/institute-branding";

const selectionSchema = z.object({
  slug: z.string().min(2).max(64).regex(organizationSlugPattern),
});

export async function GET() {
  const userId = await getActingUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getActiveWorkspace(userId);
  if (!workspace) {
    (await cookies()).delete(ACTIVE_ORGANIZATION_COOKIE);
    return Response.json({ organization: null }, { headers: privateBrandingHeaders });
  }
  return Response.json({ organization: await brandedWorkspace(workspace), role: workspace.context.role }, { headers: privateBrandingHeaders });
}

export async function POST(request: Request) {
  const userId = await getActingUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = selectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid organization selection." }, { status: 400 });

  const workspace = await findWorkspace(userId, "slug", parsed.data.slug);
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403 });

  const organization = await brandedWorkspace(workspace);
  await setActiveWorkspace(workspace.institute.slug);
  return Response.json({ organization, role: workspace.context.role }, { headers: privateBrandingHeaders });
}
