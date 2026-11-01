import { RoleSignIn } from "@/components/role-sign-in";

export default async function InstituteAdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ return_to?: string }>;
}) {
  const query = await searchParams;
  return (
    <RoleSignIn
      portal="institute-admin"
      path="/institute/login"
      eyebrow="INSTITUTE ADMINISTRATION"
      title="Institute administration"
      description="Manage your institute, faculty, students, batches and academic workflows."
      guidance="Institute owners and authorized administrators"
      signUpUrl="/sign-up"
      returnTo={query.return_to}
    />
  );
}
