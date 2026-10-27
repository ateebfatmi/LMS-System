import { cookies } from "next/headers";

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("prepzii_active_organization");
  cookieStore.delete("prepzii_org_id");
  cookieStore.delete("organization_id");
  return new Response(null, { status: 204 });
}
