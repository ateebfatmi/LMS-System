import { auth } from "@clerk/nextjs/server";
import { isAllowlistedPlatformAdmin, permissionsForRole } from "@prepzii/authorization";
import { cookies } from "next/headers";
import { z } from "zod";
import { ACTIVE_ORGANIZATION_COOKIE, getActiveWorkspace, setActiveWorkspace } from "@/lib/dal/auth-context";
import { findWorkspace, getActingUserId } from "@/lib/prepzii-backend";
import { brandedWorkspace, organizationSlugPattern, privateBrandingHeaders } from "@/lib/institute-branding";
import { PLATFORM_INSTITUTE_SESSION_COOKIE } from "@/lib/sign-in-navigation";

const selectionSchema = z.object({
  slug: z.string().min(2).max(64).regex(organizationSlugPattern),
  fromPlatform: z.boolean().optional(),
});

export async function GET() {
  const userId = await getActingUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const workspace = await getActiveWorkspace(userId);
  if (!workspace) {
    (await cookies()).delete(ACTIVE_ORGANIZATION_COOKIE);
    return Response.json({ organization: null }, { headers: privateBrandingHeaders });
  }
  return Response.json({ organization: await brandedWorkspace(workspace), role: workspace.context.role, permissions: permissionsForRole(workspace.context.role) }, { headers: privateBrandingHeaders });
}

export async function POST(request: Request) {
  const userId = await getActingUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = selectionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid organization selection." }, { status: 400 });
  const session = parsed.data.fromPlatform ? await auth() : null;
  if (parsed.data.fromPlatform && (!session?.sessionId || session.userId !== userId
    || !isAllowlistedPlatformAdmin(session.userId, process.env.PLATFORM_SUPER_ADMIN_USER_IDS))) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const workspace = await findWorkspace(userId, "slug", parsed.data.slug);
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403 });

  const organization = await brandedWorkspace(workspace);
  await setActiveWorkspace(workspace.institute.slug);
  if (session?.sessionId) {
    (await cookies()).set(PLATFORM_INSTITUTE_SESSION_COOKIE, session.sessionId, {
      httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/",
    });
  }
  return Response.json({ organization, role: workspace.context.role, permissions: permissionsForRole(workspace.context.role) }, { headers: privateBrandingHeaders });
}
