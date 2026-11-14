import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getActiveWorkspace } from "@/lib/dal/auth-context";
import { getActingUserId } from "@/lib/prepzii-backend";

export default async function InstituteDashboardLayout({ children }: { children: ReactNode }) {
  // Keep the isolated local UI preview available with no identity or data provider.
  const preview = !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !process.env.CLERK_SECRET_KEY
    && !process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY
    && (process.env.DEPLOYMENT_ENV ?? process.env.NODE_ENV) === "development";
  if (preview) return children;

  const userId = await getActingUserId();
  if (!userId) redirect("/sign-in");
  if (!await getActiveWorkspace(userId)) redirect("/auth/resolve?return_to=%2Fdashboard%2Fworkspace");
  return children;
}
