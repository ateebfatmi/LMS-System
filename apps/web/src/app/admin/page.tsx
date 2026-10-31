import { redirect } from "next/navigation";
import { isPlatformAdmin } from "@/lib/prepzii-backend";
import { PlatformAdminWorkspace } from "@/components/platform-admin-workspace";

export default async function PlatformAdminPage() {
  const isAdmin = await isPlatformAdmin();
  if (!isAdmin) {
    redirect("/admin/login");
  }
  return <PlatformAdminWorkspace />;
}
