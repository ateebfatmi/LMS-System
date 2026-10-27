import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { hashInvitationToken } from "@/lib/invitation-token";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";
import { guardRateLimit } from "@/lib/rate-limit";

const acceptSchema = z.object({ token: z.string().min(40).max(128) });
type Acceptance = {
  invitation_status: string;
  organization_id: string;
  organization_slug: string;
  membership_role: string;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const limited = await guardRateLimit({
    request,
    scope: "invitation-acceptance",
    subject: userId,
    limit: 20,
    windowSeconds: 3600,
  });
  if (limited) return limited;

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email || user?.primaryEmailAddress?.verification?.status !== "verified") {
    return Response.json({ error: "A verified primary email is required." }, { status: 409 });
  }

  const parsed = acceptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid invitation." }, { status: 400 });

  const { data, error } = await getPrepziiAdmin().rpc("lms_accept_invitation", {
    p_token_hash: hashInvitationToken(parsed.data.token),
    p_user_id: userId,
    p_verified_email: email,
  });

  if (error) {
    if (error.code === "P0002") return Response.json({ error: "Invitation is invalid for this account." }, { status: 404 });
    if (error.code === "23505") return Response.json({ error: "This membership belongs to another account." }, { status: 409 });
    console.error("Invitation acceptance failed", error);
    return Response.json({ error: "Unable to accept invitation." }, { status: 503 });
  }

  const acceptance = (data as Acceptance[] | null)?.[0];
  if (!acceptance) return Response.json({ error: "Invitation was not accepted." }, { status: 500 });
  if (acceptance.invitation_status === "EXPIRED" || acceptance.invitation_status === "REVOKED") {
    return Response.json({ error: `Invitation is ${acceptance.invitation_status.toLowerCase()}.` }, { status: 410 });
  }
  if (acceptance.invitation_status !== "ACCEPTED") {
    return Response.json({ error: "Invitation cannot be accepted." }, { status: 409 });
  }

  (await cookies()).set("prepzii_active_organization", acceptance.organization_slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return Response.json({
    organization: { id: acceptance.organization_id, slug: acceptance.organization_slug },
    role: acceptance.membership_role,
  });
}
