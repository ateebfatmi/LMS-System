import { DashboardLayout } from "@/components/dashboard-layout";
import { getActiveWorkspace } from "@/lib/dal/auth-context";
import { getActingUserId } from "@/lib/prepzii-backend";

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  const userId = await getActingUserId();
  const workspace = userId && await getActiveWorkspace(userId);
  if (!workspace || workspace.context.role !== "OWNER") {
    return <DashboardLayout title="Access denied"><p>Only the institute owner can manage its subscription.</p></DashboardLayout>;
  }
  return children;
}
