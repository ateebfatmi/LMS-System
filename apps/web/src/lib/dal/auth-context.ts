import "server-only";

import { cookies } from "next/headers";
import { selectWorkspace } from "@prepzii/authorization";
import { findWorkspace, listMyOrganizations, type Workspace } from "@/lib/prepzii-backend";

export const ACTIVE_ORGANIZATION_COOKIE = "prepzii_active_organization";

export async function getActiveWorkspace(userId: string): Promise<Workspace | null> {
  const slug = (await cookies()).get(ACTIVE_ORGANIZATION_COOKIE)?.value;
  if (slug) return findWorkspace(userId, "slug", slug);
  const workspaces = await listMyOrganizations(userId);
  return selectWorkspace(workspaces.map((workspace) => ({ ...workspace, slug: workspace.institute.slug })));
}

export async function setActiveWorkspace(slug: string) {
  (await cookies()).set(ACTIVE_ORGANIZATION_COOKIE, slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}
