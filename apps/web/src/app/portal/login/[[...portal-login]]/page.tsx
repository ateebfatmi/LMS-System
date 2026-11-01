import { RoleSignIn } from "@/components/role-sign-in";

export default async function MemberLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const query = await searchParams;
  return (
    <RoleSignIn
      portal="member"
      path="/portal/login"
      eyebrow="FACULTY & STUDENT WORKSPACE"
      title="Faculty & student portal"
      description="Open the role-scoped workspace assigned to you by your institute."
      guidance="Invited faculty members and enrolled students"
      returnTo={query.return_to}
    />
  );
}
