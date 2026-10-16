import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AuthorizationError, authorizeTenantAction, type Permission } from "@prepzii/authorization";
import { organizationRoles, type OrganizationRole, type TenantContext } from "@prepzii/contracts";

type Institute = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  owner_user_id: string;
  status: string;
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
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return process.env.DEMO_USER_ID || "usr_director_ateeb";
  }
  try {
    const { userId } = await auth();
    return userId || process.env.DEMO_USER_ID || "usr_director_ateeb";
  } catch {
    return process.env.DEMO_USER_ID || "usr_director_ateeb";
  }
}

export async function isPlatformSuperAdmin(): Promise<boolean> {
  if (!process.env.PLATFORM_SUPER_ADMIN_USER_IDS && process.env.NODE_ENV !== "production") {
    return true;
  }
  const userId = await getActingUserId();
  if (!userId) return false;

  const allowedUserIds = new Set(
    (process.env.PLATFORM_SUPER_ADMIN_USER_IDS ?? "usr_director_ateeb")
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
        .select("institutes!inner(id,name,slug,logo_url,owner_user_id,status)")
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .eq("institutes.status", "ACTIVE"),
    ]);

  if (ownedError) throw ownedError;
  if (membershipsError) throw membershipsError;

  const organizations = new Map<string, Institute>();
  for (const institute of (owned ?? []) as Institute[]) organizations.set(institute.id, institute);
  for (const row of memberships ?? []) {
    const institute = row.institutes as unknown as Institute;
    if (institute) organizations.set(institute.id, institute);
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
  if (!rawRole || !organizationRoles.includes(rawRole as OrganizationRole)) return null;
  const role = rawRole as OrganizationRole;
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

