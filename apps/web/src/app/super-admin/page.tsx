import { notFound } from "next/navigation";
import { PlatformAdminWorkspace } from "@/components/platform-admin-workspace";
import { isPlatformAdmin } from "@/lib/prepzii-backend";

export default async function SuperAdminPage() {
  if (!(await isPlatformAdmin())) notFound();
  return <PlatformAdminWorkspace />;
}
