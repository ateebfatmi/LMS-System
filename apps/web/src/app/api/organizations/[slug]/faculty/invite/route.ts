import { randomUUID } from "node:crypto";
import { normalizeInvitationEmail } from "@prepzii/membership";
import { z } from "zod";
import { organizationSlugPattern } from "@/lib/institute-branding";
import { deriveInvitationToken, hashInvitationToken } from "@/lib/invitation-token";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";
import { guardRateLimit } from "@/lib/rate-limit";

const slugSchema = z.string().min(2).max(64).regex(organizationSlugPattern);
const headers = { "cache-control": "private, no-store" };
const requestSchema = z.object({ memberId: z.uuid(), sendEmail: z.boolean().default(false) });

function reject(error: string, status: number) {
  return Response.json({ error }, { status, headers });
}

async function sendInvitationEmail(input: { invitationId: string; email: string; institute: string; acceptPath: string; expiresAt: string }) {
  const key = process.env.RESEND_API_KEY?.trim();
  const sender = process.env.FACULTY_INVITATION_FROM_EMAIL?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!key || !sender || !appUrl) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `faculty-invitation/${input.invitationId}`,
      },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        from: sender,
        to: [input.email],
        subject: "Activate your Prepzii faculty account",
        text: [
          `You have been invited to join ${input.institute} as a teacher.`,
          "Sign in with this verified email address and accept the invitation:",
          new URL(input.acceptPath, appUrl).href,
          `This invitation expires on ${new Date(input.expiresAt).toISOString().slice(0, 10)} (UTC).`,
        ].join("\n\n"),
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const slug = slugSchema.safeParse((await params).slug);
  if (!slug.success) return reject("Invalid institute.", 400);
  const workspace = await getAuthorizedOrganizationContext(slug.data, "members:manage");
  if (!workspace) return reject("You do not have permission to invite teachers.", 403);
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return reject("Choose a valid teacher.", 400);

  const { organizationId, userId, role } = workspace.context;
  const limited = await guardRateLimit({ request, scope: "organization-invitations",
    subject: `${organizationId}:${userId}`, limit: 30, windowSeconds: 3600 });
  if (limited) return limited;
  const secret = process.env.INVITATION_TOKEN_SECRET;
  if (!secret || secret.length < 32) return reject("Invitations are temporarily unavailable.", 503);

  const client = getPrepziiAdmin();
  const { memberId, sendEmail } = parsed.data;
  const { data: teacher, error: lookupError } = await client.from("institute_members")
    .select("email").eq("institute_id", organizationId).eq("id", memberId).eq("role", "TEACHER").maybeSingle();
  if (lookupError) return reject("Unable to find the teacher.", 503);
  if (!teacher) return reject("Teacher not found.", 404);
  const email = normalizeInvitationEmail(teacher.email ?? "");
  if (!z.email().safeParse(email).success) return reject("Update the teacher with a valid email before inviting.", 400);

  const { data: current, error: invitationError } = await client.from("organization_invitations")
    .select("idempotency_key,token_hash").eq("organization_id", organizationId).eq("email", email)
    .eq("role", "TEACHER").eq("status", "PENDING").gt("expires_at", new Date().toISOString()).maybeSingle();
  if (invitationError) return reject("Unable to check the existing invitation.", 503);
  const idempotencyKey = current?.idempotency_key ?? randomUUID();
  const token = deriveInvitationToken({ secret, organizationId, email, role: "TEACHER", idempotencyKey });
  const tokenHash = hashInvitationToken(token);
  if (current && tokenHash !== current.token_hash) {
    return reject("This invitation can no longer be recovered. Revoke it under Settings before creating a new link.", 409);
  }

  const { data, error } = await client.rpc("lms_invite_faculty", {
    p_organization_id: organizationId, p_actor_user_id: userId, p_actor_role: role, p_member_id: memberId,
    p_email: email, p_token_hash: tokenHash, p_idempotency_key: idempotencyKey,
    p_expires_at: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  });
  if (error) {
    if (error.code === "23505") return reject("An invitation already exists for this email. Reopen the invitation to try again.", 409);
    if (error.code === "42501") return reject("This teacher’s account cannot be invited.", 403);
    if (error.code === "P0002") return reject("The teacher’s email changed. Refresh the directory and try again.", 409);
    console.error("Faculty invitation creation failed", error);
    return reject("Unable to create the invitation. Try again.", 503);
  }
  if (data?.invitation_status !== "PENDING" || Date.parse(data.invitation_expires_at) <= Date.now()) {
    return reject("This invitation is no longer open. Refresh the directory and try again.", 409);
  }

  const acceptPath = `/invite/${encodeURIComponent(token)}`;
  const emailSent = sendEmail && await sendInvitationEmail({
    invitationId: data.invitation_id, email, institute: workspace.institute.name, acceptPath, expiresAt: data.invitation_expires_at,
  });
  return Response.json({ acceptPath, emailSent, expiresAt: data.invitation_expires_at }, { status: current ? 200 : 201, headers });
}
