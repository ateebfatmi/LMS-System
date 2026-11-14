import { auth, currentUser } from "@clerk/nextjs/server";
import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { normalizeInvitationEmail } from "@prepzii/membership";
import { z } from "zod";
import { SignInCard } from "@/components/sign-in-card";
import { deriveInvitationToken, hashInvitationToken } from "@/lib/invitation-token";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";
import { withSignInReturn } from "@/lib/sign-in-navigation";

export default async function InvitationRegistration({ searchParams }: PageProps<"/sign-up/[[...sign-up]]">) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) redirect("/sign-in");
  const query = await searchParams;
  const invitationId = z.uuid().safeParse(query.invite);
  const secret = process.env.INVITATION_TOKEN_SECRET;
  if (!invitationId.success || !secret || secret.length < 32) redirect("/sign-in");

  const continuation = `/sign-up?invite=${invitationId.data}`;
  const signInUrl = withSignInReturn("/sign-in", continuation);
  const ticket = query.__clerk_ticket;
  const hasTicket = typeof ticket === "string" && ticket.length > 0 && ticket.length <= 8192;
  const { userId } = await auth();
  if (!userId && !hasTicket) redirect(signInUrl);

  const { data, error } = await getPrepziiAdmin().from("organization_invitations")
    .select("organization_id,email,role,idempotency_key,token_hash,institutes!inner(status)").eq("id", invitationId.data)
    .eq("status", "PENDING").eq("institutes.status", "ACTIVE").gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error || !data) redirect("/sign-in");

  if (userId) {
    const primaryEmail = (await currentUser())?.primaryEmailAddress;
    if (primaryEmail?.verification?.status !== "verified" ||
      normalizeInvitationEmail(primaryEmail.emailAddress) !== normalizeInvitationEmail(data.email)) {
      redirect("/sign-in?workspace=missing");
    }
    const token = deriveInvitationToken({
      secret, organizationId: data.organization_id, email: data.email, role: data.role,
      idempotencyKey: data.idempotency_key,
    });
    if (hashInvitationToken(token) !== data.token_hash) redirect("/sign-in");
    redirect(`/invite/${token}`);
  }

  // Normalize the return URL server-side. The Clerk ticket authenticates the
  // recipient, and only the matching verified session receives the LMS token.
  if (query.__clerk_status === "sign_in") redirect(signInUrl);
  return (
    <SignInCard title="Activate your invited account" footer={<Link href={signInUrl}>Already have an account? Sign in</Link>}>
      <SignUp routing="hash" signInUrl={signInUrl} forceRedirectUrl={continuation} fallbackRedirectUrl={continuation} />
    </SignInCard>
  );
}
