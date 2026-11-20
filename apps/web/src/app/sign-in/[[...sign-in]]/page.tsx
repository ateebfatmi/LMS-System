import { auth } from "@clerk/nextjs/server";
import { isAllowlistedPlatformAdmin } from "@prepzii/authorization";
import { redirect } from "next/navigation";
import { ClerkSignIn, SignInCard } from "@/components/sign-in-card";
import { OrganizationSwitcher } from "@/components/organization-switcher";
import { SignOutOtherAccount } from "@/components/sign-out-other-account";
import { signInReturnPath, withSignInReturn } from "@/lib/sign-in-navigation";

export default async function InstituteSignInPage({ params, searchParams }: PageProps<"/sign-in/[[...sign-in]]">) {
  const [{ "sign-in": step }, query] = await Promise.all([params, searchParams]);
  const returnTo = signInReturnPath(typeof query.return_to === "string" ? query.return_to
    : typeof query.redirect_url === "string" ? query.redirect_url : undefined);
  const resolveUrl = withSignInReturn("/auth/resolve", returnTo);
  const clerkConfigured = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY;

  // Clerk owns the nested verification and OAuth steps.
  const userId = clerkConfigured && !step ? (await auth()).userId : null;
  if (userId) {
    if (isAllowlistedPlatformAdmin(userId, process.env.PLATFORM_SUPER_ADMIN_USER_IDS)) redirect(resolveUrl);
    if (query.workspace === "choose") {
      return (
        <SignInCard title="Choose your workspace" footer={<SignOutOtherAccount />}>
          <p>Select the institute you want to open.</p>
          <OrganizationSwitcher returnTo={returnTo ?? "/dashboard/workspace"} />
        </SignInCard>
      );
    }
    if (query.workspace === "missing") {
      return (
        <SignInCard title="Institute access required" footer={<SignOutOtherAccount />}>
          <p>Open the invitation from your institute, or contact your institute administrator to request access.</p>
        </SignInCard>
      );
    }
    redirect(resolveUrl);
  }

  return (
    <SignInCard title="Your institute workspace">
      <ClerkSignIn path="/sign-in" resolveUrl={resolveUrl} />
    </SignInCard>
  );
}
