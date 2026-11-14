import { canGrantRole } from "@prepzii/authorization";
import { invitationRoles, normalizeInvitationEmail } from "@prepzii/membership";
import { z } from "zod";
import { deriveInvitationToken, hashInvitationToken } from "@/lib/invitation-token";
import { getAuthorizedOrganizationContext, getOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";
import { deliverInvitation } from "@/lib/invitation-delivery";
import { guardRateLimit } from "@/lib/rate-limit";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const invitationSchema = z.object({
  email: z.email().max(320),
  role: z.enum([...invitationRoles, "PARENT"]),
  studentId: z.uuid().optional(),
  batchId: z.uuid().optional(),
  relationship: z.enum(["FATHER", "MOTHER", "LEGAL_GUARDIAN", "OTHER"]).optional(),
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
    .neq("role", "OWNER")
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

  const resolved = await getOrganizationContext(parsedSlug.data, ["OWNER", "COACHING_ADMIN", "TEACHER"]);
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const limited = await guardRateLimit({
    request,
    scope: "organization-invitations",
    subject: `${resolved.context.organizationId}:${resolved.context.userId}`,
    limit: 30,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  const parsed = invitationSchema.safeParse(await request.json().catch(() => null));
  const idempotency = idempotencySchema.safeParse(request.headers.get("idempotency-key"));
  if (!parsed.success || !idempotency.success) {
    return Response.json({ error: "Invalid invitation request." }, { status: 400 });
  }
  const { role, studentId, batchId, relationship } = parsed.data;
  const scoped = role === "STUDENT" || role === "PARENT";
  if (resolved.context.role === "TEACHER" ? !scoped : !canGrantRole(resolved.context.role, role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (scoped && (!studentId || (role === "PARENT" && !relationship))) {
    return Response.json({ error: "Select an enrolled student and, for guardian access, a relationship." }, { status: 400 });
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
  const client = getPrepziiAdmin();
  const { organizationId, userId, role: actorRole } = resolved.context;
  const tokenHash = hashInvitationToken(token);
  const { data, error } = scoped
    ? await client.rpc("lms_create_student_or_guardian_invitation", {
        p_org: organizationId, p_actor: userId, p_actor_role: actorRole,
        p_email: email, p_role: role, p_student: studentId,
        p_batch: batchId ?? null, p_relationship: role === "PARENT" ? relationship : null,
        p_hash: tokenHash, p_key: idempotency.data, p_expires: expiresAt,
      })
    : await client.rpc("lms_create_invitation", {
        p_organization_id: organizationId, p_actor_user_id: userId, p_actor_role: actorRole,
        p_email: email, p_role: role, p_token_hash: tokenHash, p_idempotency_key: idempotency.data,
        p_expires_at: expiresAt,
      });
  const row = scoped ? data : data?.[0];
  const invitation = row && {
    id: scoped ? row.id : row.invitation_id,
    status: scoped ? row.status : row.invitation_status,
    expiresAt: scoped ? row.expires_at : row.invitation_expires_at,
  };
  if (error || invitation?.status !== "PENDING" || Date.parse(invitation.expiresAt) <= Date.now()) {
    const status = error?.code === "42501" ? 403 : error?.code === "23505" || !error ? 409 : 503;
    return Response.json({ error: "Unable to issue this invitation." }, { status });
  }

  const emailSent = await deliverInvitation({ id: invitation.id, email, expiresAt: invitation.expiresAt });
  return Response.json(
    { invitation, emailSent, acceptPath: `/invite/${token}` },
    { status: 201, headers: { "cache-control": "private, no-store" } },
  );
}
