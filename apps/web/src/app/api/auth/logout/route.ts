import { cookies } from "next/headers";
import { PLATFORM_INSTITUTE_SESSION_COOKIE } from "@/lib/sign-in-navigation";

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete("prepzii_active_organization");
  cookieStore.delete("prepzii_org_id");
  cookieStore.delete("organization_id");
  cookieStore.delete(PLATFORM_INSTITUTE_SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
