import { auth, currentUser } from "@clerk/nextjs/server";
import { setActiveWorkspace } from "@/lib/dal/auth-context";
import { z } from "zod";
import { hashInvitationToken } from "@/lib/invitation-token";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";
import { guardRateLimit } from "@/lib/rate-limit";

const acceptSchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,128}$/) });
const unavailable = { error: "This invitation is unavailable. Contact the person who invited you." };
const headers = { "cache-control": "private, no-store" };

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
    return Response.json(unavailable, { status: 404, headers });
  }

  const parsed = acceptSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json(unavailable, { status: 404, headers });

  const { data, error } = await getPrepziiAdmin().rpc("lms_accept_invitation", {
    p_token_hash: hashInvitationToken(parsed.data.token),
    p_user_id: userId,
    p_verified_email: email,
  });

  if (error) {
    if (["42501", "P0002", "23505"].includes(error.code)) return Response.json(unavailable, { status: 404, headers });
    console.error("Invitation acceptance failed", error);
    return Response.json({ error: "Unable to accept invitation." }, { status: 503 });
  }

  const acceptance = (data as Acceptance[] | null)?.[0];
  if (acceptance?.invitation_status !== "ACCEPTED") {
    return Response.json(unavailable, { status: 404, headers });
  }

  await setActiveWorkspace(acceptance.organization_slug);

  return Response.json({
    organization: { id: acceptance.organization_id, slug: acceptance.organization_slug },
    role: acceptance.membership_role,
  }, { headers });
}
