import "server-only";

import { clerkClient } from "@clerk/nextjs/server";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";

export async function deliverInvitation(input: {
  id: string;
  email: string;
  expiresAt: string;
}): Promise<boolean> {
  const base = process.env.NEXT_PUBLIC_APP_URL;
  if (!base || Date.parse(input.expiresAt) <= Date.now()) return false;

  const db = getPrepziiAdmin();
  const { data, error } = await db.from("organization_invitations")
    .select("clerk_invitation_id,status").eq("id", input.id).single();
  if (error || data.status !== "PENDING") return false;
  if (data.clerk_invitation_id) return true;

  let id: string | undefined;
  try {
    const redirectUrl = new URL("/sign-up", base);
    redirectUrl.searchParams.set("invite", input.id);
    const clerk = await clerkClient();
    const delivered = await clerk.invitations.createInvitation({
      emailAddress: input.email,
      ignoreExisting: true,
      redirectUrl: redirectUrl.href,
      expiresInDays: Math.max(1, Math.ceil((Date.parse(input.expiresAt) - Date.now()) / 86_400_000)),
    });
    id = delivered.id;
    const saved = await db.from("organization_invitations").update({ clerk_invitation_id: id })
      .eq("id", input.id).eq("status", "PENDING").is("clerk_invitation_id", null).select("id").maybeSingle();
    if (saved.error || !saved.data) {
      await revokeClerkInvitation(id);
      return false;
    }
    return true;
  } catch {
    if (id) await revokeClerkInvitation(id);
    // Provider errors can contain ticket URLs and recipient addresses.
    console.error("Clerk invitation delivery failed");
    return false;
  }
}

export async function revokeClerkInvitation(id: string | null | undefined): Promise<boolean> {
  if (!id) return true;
  try {
    await (await clerkClient()).invitations.revokeInvitation(id);
    return true;
  } catch {
    console.error("Clerk invitation revocation failed");
    return false;
  }
}
