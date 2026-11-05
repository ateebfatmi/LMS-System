import "server-only";

import type { TenantContext } from "@prepzii/contracts";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";

export async function getAssignedBatchIds({ organizationId, userId, role }: TenantContext): Promise<string[]> {
  if (role !== "STUDENT" && role !== "TEACHER") return [];
  const { data, error } = await getPrepziiAdmin().from("organization_batch_members")
    .select("batch_id").eq("organization_id", organizationId).eq("user_id", userId).eq("role", role);
  if (error) throw error;
  return (data ?? []).map(({ batch_id }) => String(batch_id));
}
