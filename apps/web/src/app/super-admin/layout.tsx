import { notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/prepzii-backend";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isPlatformAdmin())) notFound();
  return children;
}
