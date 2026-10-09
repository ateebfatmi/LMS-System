import { getActingUserId, listMyOrganizations } from "@/lib/prepzii-backend";

export async function GET() {
  const userId = await getActingUserId();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const organizations = await listMyOrganizations(userId);
    return Response.json({ organizations });
  } catch (error) {
    console.error("Failed to load Prepzii organizations", error);
    return Response.json({ error: "Failed to load organizations" }, { status: 500 });
  }
}

