import "server-only";

import { normalizeInvitationEmail } from "@prepzii/membership";
import { deliverInvitation, revokeClerkInvitation } from "@/lib/invitation-delivery";
import { deriveInvitationToken, hashInvitationToken } from "@/lib/invitation-token";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";

export async function manageOwnerInvitation(input: {
  organizationId: string;
  actorId: string;
  email?: string;
  replaceId?: string;
}) {
  const secret = process.env.INVITATION_TOKEN_SECRET;
  const key = crypto.randomUUID();
  const email = input.email ? normalizeInvitationEmail(input.email) : null;
  if (email && (!secret || secret.length < 32)) return { error: new Error("Missing invitation secret") };
  const token = email && secret ? deriveInvitationToken({
    secret, organizationId: input.organizationId, email, role: "OWNER", idempotencyKey: key,
  }) : null;
  const { data, error } = await getPrepziiAdmin().rpc("lms_manage_initial_owner_invitation", {
    p_org: input.organizationId,
    p_actor: input.actorId,
    p_email: email,
    p_hash: token ? hashInvitationToken(token) : null,
    p_key: key,
    p_replace: input.replaceId ?? null,
  });
  if (error) return { error };

  const previousRevoked = await revokeClerkInvitation(data.previous_clerk_invitation_id);
  const emailSent = Boolean(email && await deliverInvitation({
    id: data.id, email, expiresAt: data.expires_at,
  }));
  return { result: { invitationId: data.id, emailSent, previousRevoked } };
}
