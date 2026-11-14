import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SignInCard } from "@/components/sign-in-card";
import { SignOutOtherAccount } from "@/components/sign-out-other-account";
import { withSignInReturn } from "@/lib/sign-in-navigation";
import { AcceptInvitationButton } from "./accept-invitation-button";

export default async function AcceptInvitationPage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{40,128}$/.test(token)) notFound();
  const path = `/invite/${token}`;
  const configured = process.env.CLERK_SECRET_KEY && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const signedIn = configured && (await auth()).userId;
  return (
    <SignInCard title="Institute invitation" footer={signedIn && <SignOutOtherAccount redirectUrl={path} />}>
      <p>Use the verified email address that received the invitation.</p>
      {signedIn ? <AcceptInvitationButton token={token} /> : (
        <>
          <Link href={withSignInReturn("/sign-in", path)}>Sign in to accept</Link>
          <p>New to Prepzii? Open the account activation link in your invitation email.</p>
        </>
      )}
    </SignInCard>
  );
}
