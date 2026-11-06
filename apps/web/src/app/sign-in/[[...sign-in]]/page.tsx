import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ClerkSignIn, SignInCard } from "@/components/sign-in-card";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { SignOutOtherAccount } from "@/components/sign-out-other-account";
import { signInReturnPath, withSignInReturn } from "@/lib/sign-in-navigation";

export default async function InstituteSignInPage({ params, searchParams }: PageProps<"/sign-in/[[...sign-in]]">) {
  const [{ "sign-in": step }, query] = await Promise.all([params, searchParams]);
  const returnTo = typeof query.return_to === "string" ? query.return_to
    : typeof query.redirect_url === "string" ? query.redirect_url : undefined;
  const resolveUrl = withSignInReturn("/auth/resolve", returnTo);
  const clerkConfigured = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY;

  // Clerk owns the nested verification and OAuth steps.
  if (clerkConfigured && !step && (await auth()).userId) {
    if (query.workspace === "choose") {
      return (
        <SignInCard title="Choose your workspace" footer={<SignOutOtherAccount />}>
          <p>Select the institute you want to open.</p>
          <OrganizationSwitcher returnTo={signInReturnPath(returnTo) ?? "/dashboard/workspace"} />
        </SignInCard>
      );
    }
    if (query.workspace === "missing") {
      return (
        <SignInCard title="No active workspace" footer={<SignOutOtherAccount />}>
          <p>Open the invitation your institute sent you, or ask your institute to verify your access.</p>
          <Link href="/onboarding" className="sign-in-workspace-link">Own a coaching institute? Create your workspace.</Link>
        </SignInCard>
      );
    }
    redirect(resolveUrl);
  }

  return (
    <SignInCard
      title="Your institute workspace"
      footer={<Link href="/sign-up" className="sign-in-workspace-link">Own a coaching institute? Create your workspace.</Link>}
    >
      <ClerkSignIn path="/sign-in" resolveUrl={resolveUrl} />
    </SignInCard>
  );
}
