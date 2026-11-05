import { getActingUserId, isPlatformAdmin, listMyOrganizations, publicWorkspace } from "@/lib/prepzii-backend";

export async function GET() {
  const userId = await getActingUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const [organizations, platformAdmin] = await Promise.all([
      listMyOrganizations(userId),
      isPlatformAdmin(userId),
    ]);
    return Response.json({
      isPlatformAdmin: platformAdmin,
      organizations: organizations.map(publicWorkspace),
    });
  } catch (error) {
    console.error("Failed to load Prepzii organizations", error);
    return Response.json({ error: "Failed to load organizations" }, { status: 503 });
  }
}
