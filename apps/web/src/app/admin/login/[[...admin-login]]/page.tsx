import { RoleSignIn } from "@/components/role-sign-in";

export default function PlatformAdminLoginPage() {
  return (
    <RoleSignIn
      portal="platform"
      path="/admin/login"
      eyebrow="PREPZII PLATFORM OPERATIONS"
      title="Platform super admin"
      description="Manage tenant lifecycle, subscriptions, platform controls and operational health."
      guidance="Allowlisted PrepZii platform operators"
    />
  );
}
