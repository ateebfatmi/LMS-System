import { redirect, notFound } from "next/navigation";
import { isPlatformAdmin } from "@/lib/prepzii-backend";

export default async function PlatformAdminPage() {
  if (!(await isPlatformAdmin())) notFound();
  redirect("/super-admin");
}
