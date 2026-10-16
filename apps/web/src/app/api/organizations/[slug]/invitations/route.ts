import { canGrantRole } from "@prepzii/authorization";
import { invitationRoles, normalizeInvitationEmail } from "@prepzii/membership";
import { z } from "zod";
import { deriveInvitationToken, hashInvitationToken } from "@/lib/invitation-token";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const invitationSchema = z.object({
  email: z.email().max(320),
  role: z.enum(invitationRoles),
  expiresInDays: z.number().int().min(1).max(30).default(7),
});
const idempotencySchema = z.uuid();

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  if (!parsedSlug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });

  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "members:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await getPrepziiAdmin()
    .from("organization_invitations")
    .select("id,email,role,status,expires_at,created_at,accepted_at,revoked_at")
    .eq("organization_id", resolved.context.organizationId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("Invitation list failed", error);
    return Response.json({ error: "Unable to load invitations." }, { status: 503 });
  }

  const now = Date.now();
  return Response.json({
    invitations: (data ?? []).map((invitation) => ({
      ...invitation,
      status:
        invitation.status === "PENDING" && new Date(invitation.expires_at).getTime() <= now
          ? "EXPIRED"
          : invitation.status,
    })),
  });
}

export async function POST(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  if (!parsedSlug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });

  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "members:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const parsed = invitationSchema.safeParse(await request.json().catch(() => null));
  const idempotency = idempotencySchema.safeParse(request.headers.get("idempotency-key"));
  if (!parsed.success || !idempotency.success) {
    return Response.json({ error: "Invalid invitation request." }, { status: 400 });
  }
  if (!canGrantRole(resolved.context.role, parsed.data.role)) {
    return Response.json({ error: "You cannot grant that role." }, { status: 403 });
  }

  const secret = process.env.INVITATION_TOKEN_SECRET;
  if (!secret || secret.length < 32) {
    console.error("INVITATION_TOKEN_SECRET must contain at least 32 characters");
    return Response.json({ error: "Invitations are temporarily unavailable." }, { status: 503 });
  }

  const email = normalizeInvitationEmail(parsed.data.email);
  const token = deriveInvitationToken({
    secret,
    organizationId: resolved.context.organizationId,
    email,
    role: parsed.data.role,
    idempotencyKey: idempotency.data,
  });
  const expiresAt = new Date(Date.now() + parsed.data.expiresInDays * 86_400_000).toISOString();
  const { data, error } = await getPrepziiAdmin().rpc("lms_create_invitation", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_email: email,
    p_role: parsed.data.role,
    p_token_hash: hashInvitationToken(token),
    p_idempotency_key: idempotency.data,
    p_expires_at: expiresAt,
  });

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "A pending invitation already exists for that email." }, { status: 409 });
    }
    console.error("Invitation creation failed", error);
    return Response.json({ error: "Unable to create invitation." }, { status: 503 });
  }

  const invitation = (data as Record<string, unknown>[] | null)?.[0];
  if (!invitation) return Response.json({ error: "Invitation was not created." }, { status: 500 });

  return Response.json(
    { invitation, acceptPath: `/invite/${encodeURIComponent(token)}` },
    { status: 201 },
  );
}
