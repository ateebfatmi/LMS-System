import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ClerkSignIn, SignInCard } from "@/components/sign-in-card";
import { SignOutOtherAccount } from "@/components/sign-out-other-account";
import { isPlatformAdmin } from "@/lib/prepzii-backend";

export default async function PlatformAdminLoginPage({ params }: PageProps<"/admin/login/[[...admin-login]]">) {
  const { "admin-login": step } = await params;
  if (!step && process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY) {
    const { userId } = await auth();
    if (userId) {
      if (await isPlatformAdmin(userId)) redirect("/super-admin");
      return (
        <SignInCard title="Platform access denied" footer={<SignOutOtherAccount redirectUrl="/admin/login" />}>
          <p>This account is not authorized for platform administration.</p>
        </SignInCard>
      );
    }
  }

  return (
    <SignInCard title="Platform super admin">
      <ClerkSignIn path="/admin/login" resolveUrl="/auth/resolve?portal=platform" />
    </SignInCard>
  );
}
