import { permissionsForRole } from "@prepzii/authorization";
import { getActiveWorkspace } from "@/lib/dal/auth-context";
import { getActingUserId, listMyOrganizations, publicWorkspace } from "@/lib/prepzii-backend";

export async function GET() {
  const userId = await getActingUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [workspaces, active] = await Promise.all([listMyOrganizations(userId), getActiveWorkspace(userId)]);
    return Response.json({
      userId,
      workspaces: workspaces.map(publicWorkspace),
      activeWorkspace: active ? publicWorkspace(active) : null,
      permissions: active ? permissionsForRole(active.context.role) : [],
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Unable to resolve session workspace", error);
    return Response.json({ error: "Unable to verify workspace access." }, { status: 503 });
  }
}
