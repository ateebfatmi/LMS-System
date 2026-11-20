import "server-only";

import { normalizeInvitationEmail } from "@prepzii/membership";
import { deliverInvitation, revokeClerkInvitation } from "@/lib/invitation-delivery";
import { deriveInvitationToken, hashInvitationToken } from "@/lib/invitation-token";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";

export function isOwnerInvitationConfigured(): boolean {
  const { INVITATION_TOKEN_SECRET, NEXT_PUBLIC_APP_URL } = process.env;
  if (!INVITATION_TOKEN_SECRET || INVITATION_TOKEN_SECRET.length < 32 || !NEXT_PUBLIC_APP_URL) return false;
  const url = URL.canParse(NEXT_PUBLIC_APP_URL) ? new URL(NEXT_PUBLIC_APP_URL) : null;
  if (!url || url.username || url.password) return false;
  return url.protocol === "https:" || (process.env.NODE_ENV === "development" && url.protocol === "http:"
    && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
}

export function prepareOwnerInvitation(organizationId: string, address: string) {
  const secret = process.env.INVITATION_TOKEN_SECRET;
  if (!secret || secret.length < 32) throw new Error("Missing invitation secret");
  const key = crypto.randomUUID();
  const email = normalizeInvitationEmail(address);
  const token = deriveInvitationToken({ secret, organizationId, email, role: "OWNER", idempotencyKey: key });
  return { email, key, hash: hashInvitationToken(token) };
}

export async function manageOwnerInvitation(input: {
  organizationId: string;
  actorId: string;
  email?: string;
  replaceId?: string;
}) {
  const invitation = input.email ? prepareOwnerInvitation(input.organizationId, input.email) : null;
  const { data, error } = await getPrepziiAdmin().rpc("lms_manage_initial_owner_invitation", {
    p_org: input.organizationId,
    p_actor: input.actorId,
    p_email: invitation?.email ?? null,
    p_hash: invitation?.hash ?? null,
    p_key: invitation?.key ?? null,
    p_replace: input.replaceId ?? null,
  });
  if (error) return { error };

  const previousRevoked = await revokeClerkInvitation(data.previous_clerk_invitation_id);
  const emailSent = Boolean(invitation && await deliverInvitation({
    id: data.id, email: invitation.email, expiresAt: data.expires_at,
  }));
  return { result: { invitationId: data.id, emailSent, previousRevoked } };
}
