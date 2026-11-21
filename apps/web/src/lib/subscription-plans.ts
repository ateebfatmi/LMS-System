import "server-only";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";

export async function isActiveSubscriptionPlan(planId: string): Promise<boolean> {
  const { data, error } = await getPrepziiAdmin().from("subscription_plans")
    .select("id").eq("id", planId).eq("is_active", true).maybeSingle();
  if (error) throw error;
  return Boolean(data);
}
