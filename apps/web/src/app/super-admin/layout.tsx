import { notFound } from "next/navigation";
import { isPlatformSuperAdmin } from "@/lib/prepzii-backend";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isPlatformSuperAdmin())) notFound();
  return children;
}
