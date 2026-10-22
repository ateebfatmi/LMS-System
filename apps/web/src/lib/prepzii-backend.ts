import "server-only";

if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = class {};
}

import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AuthorizationError, authorizeTenantAction, type Permission } from "@prepzii/authorization";
import { type OrganizationRole, type TenantContext } from "@prepzii/contracts";
import { normalizeOrganizationRole } from "@prepzii/assessment-core";

type Institute = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  owner_user_id: string;
  status: string;
  userRole?: OrganizationRole;
};

type InstituteMember = {
  id: string;
  institute_id: string;
  user_id: string | null;
  role: string;
  status: string;
};

let adminClient: SupabaseClient | undefined;

export function getPrepziiAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("The shared Prepzii Supabase environment is not configured.");
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return adminClient;
}

export async function getActingUserId(): Promise<string | null> {
  try {
    const { userId } = await auth();
    if (userId) return userId;
  } catch {}

  if (process.env.NODE_ENV !== "production") {
    try {
      const { headers } = await import("next/headers");
      const headerList = await headers();
      const devHeaderUser = headerList.get("x-authenticated-user");
      if (devHeaderUser) return devHeaderUser;
    } catch {}
  }

  return null;
}

export async function isPlatformSuperAdmin(): Promise<boolean> {
  const userId = await getActingUserId();
  if (!userId) return false;

  const allowedUserIds = new Set(
    (process.env.PLATFORM_SUPER_ADMIN_USER_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return allowedUserIds.has(userId);
}

export async function listMyOrganizations(userId: string): Promise<Institute[]> {
  const supabase = getPrepziiAdmin();
  const [{ data: owned, error: ownedError }, { data: memberships, error: membershipsError }] =
    await Promise.all([
      supabase
        .from("institutes")
        .select("id,name,slug,logo_url,owner_user_id,status")
        .eq("owner_user_id", userId)
        .eq("status", "ACTIVE"),
      supabase
        .from("institute_members")
        .select("role, institutes!inner(id,name,slug,logo_url,owner_user_id,status)")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .eq("institutes.status", "ACTIVE"),
    ]);

  if (ownedError) throw ownedError;
  if (membershipsError) throw membershipsError;

  const organizations = new Map<string, Institute>();
  for (const institute of (owned ?? []) as Institute[]) {
    organizations.set(institute.id, { ...institute, userRole: "OWNER" });
  }
  for (const row of (memberships ?? []) as any[]) {
    const institute = row.institutes as Institute;
    const memberRole = normalizeOrganizationRole(row.role);
    if (institute) {
      const existing = organizations.get(institute.id);
      if (!existing) {
        organizations.set(institute.id, { ...institute, userRole: memberRole });
      } else if (existing.userRole !== "OWNER" && memberRole === "COACHING_ADMIN") {
        organizations.set(institute.id, { ...institute, userRole: "COACHING_ADMIN" });
      }
    }
  }
  return [...organizations.values()];
}

export async function getOrganizationContext(
  slug: string,
  allowedRoles: readonly OrganizationRole[],
): Promise<{ context: TenantContext; institute: Institute; member: InstituteMember | null } | null> {
  const userId = await getActingUserId();
  if (!userId) return null;

  const supabase = getPrepziiAdmin();
  const { data: institute, error: instituteError } = await supabase
    .from("institutes")
    .select("id,name,slug,logo_url,owner_user_id,status")
    .eq("slug", slug)
    .eq("status", "ACTIVE")
    .maybeSingle<Institute>();

  if (instituteError) throw instituteError;
  if (!institute) return null;

  const isOwner = institute.owner_user_id === userId;
  const { data: member, error: memberError } = isOwner
    ? { data: null, error: null }
    : await supabase
        .from("institute_members")
        .select("id,institute_id,user_id,role,status")
        .eq("institute_id", institute.id)
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .maybeSingle<InstituteMember>();

  if (memberError) throw memberError;
  const rawRole = isOwner ? "OWNER" : member?.role ?? null;
  if (!rawRole) return null;
  const role = normalizeOrganizationRole(rawRole);
  if (!allowedRoles.includes(role)) return null;

  return {
    context: { organizationId: institute.id, userId, role },
    institute,
    member,
  };
}

export async function getAuthorizedOrganizationContext(slug: string, permission: Permission) {
  const resolved = await getOrganizationContext(slug, [
    "OWNER",
    "COACHING_ADMIN",
    "ACADEMIC_COORDINATOR",
    "TEACHER",
    "STUDENT",
    "PARENT",
    "ACCOUNTANT",
  ]);
  if (!resolved) return null;
  try {
    authorizeTenantAction(resolved.context, resolved.institute.id, permission);
  } catch (error) {
    if (error instanceof AuthorizationError) return null;
    throw error;
  }
  return resolved;
}

