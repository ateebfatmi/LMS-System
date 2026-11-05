import "server-only";

const runtimeGlobal = globalThis as typeof globalThis & { WebSocket?: typeof WebSocket };
if (typeof runtimeGlobal.WebSocket === "undefined") {
  runtimeGlobal.WebSocket = class WebSocketStub {} as unknown as typeof WebSocket;
}

import { auth } from "@clerk/nextjs/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { hasPermission, isDevelopmentAuthOverrideEnabled, resolveInstituteMembership, type InstituteRole, type Permission } from "@prepzii/authorization";
import { type OrganizationRole, type TenantContext } from "@prepzii/contracts";


type Institute = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  owner_user_id: string | null;
  status: string;

};

export type InstituteMember = {
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

  if (isDevelopmentAuthOverrideEnabled(process.env.NODE_ENV, process.env.ALLOW_INSECURE_DEV_AUTH)) {
    try {
      const { headers } = await import("next/headers");
      const headerList = await headers();
      const devHeaderUser = headerList.get("x-authenticated-user");
      if (devHeaderUser) return devHeaderUser;
    } catch {}
  }

  return null;
}

export async function isPlatformAdmin(authenticatedUserId?: string | null): Promise<boolean> {
  const userId = authenticatedUserId ?? await getActingUserId();
  if (!userId) return false;

  const allowedUserIds = new Set(
    [process.env.PLATFORM_ADMIN_USER_IDS, process.env.PLATFORM_SUPER_ADMIN_USER_IDS]
      .filter(Boolean)
      .join(",")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  return allowedUserIds.has(userId);
}

const instituteFields = "id,name,slug,logo_url,owner_user_id,status";
const memberFields = "id,institute_id,user_id,role,status";

export type Workspace = {
  institute: Institute;
  context: TenantContext & { role: InstituteRole };
  member: InstituteMember | null;
};

export function publicWorkspace({ institute, context }: Workspace) {
  return {
    id: institute.id,
    name: institute.name,
    slug: institute.slug,
    logoUrl: institute.logo_url,
    status: institute.status,
    userRole: context.role,
  };
}

function toWorkspace(institute: Institute, userId: string, members: InstituteMember[]): Workspace | null {
  const resolved = resolveInstituteMembership(userId, institute, members);
  if (!resolved) return null;
  return {
    institute,
    context: { organizationId: institute.id, organizationName: institute.name, userId, ...resolved },
    member: members.find(({ id }) => id === resolved.memberId) ?? null,
  };
}

export async function listMyOrganizations(userId: string): Promise<Workspace[]> {
  const client = getPrepziiAdmin();
  const [{ data: owned, error: ownerError }, { data: members, error: memberError }] = await Promise.all([
    client.from("institutes").select(instituteFields).eq("owner_user_id", userId).eq("status", "ACTIVE").returns<Institute[]>(),
    client.from("institute_members").select(`${memberFields},institutes!inner(${instituteFields})`)
      .eq("user_id", userId).eq("institutes.status", "ACTIVE")
      .returns<(InstituteMember & { institutes: Institute })[]>(),
  ]);
  if (ownerError) throw ownerError;
  if (memberError) throw memberError;

  const institutes = new Map((owned ?? []).map((institute) => [institute.id, institute]));
  const memberGroups = new Map<string, InstituteMember[]>();
  for (const member of members ?? []) {
    institutes.set(member.institute_id, member.institutes);
    const group = memberGroups.get(member.institute_id) ?? [];
    group.push(member);
    memberGroups.set(member.institute_id, group);
  }

  return Array.from(institutes.values()).flatMap((institute) => {
    const workspace = toWorkspace(institute, userId, memberGroups.get(institute.id) ?? []);
    return workspace ? [workspace] : [];
  });
}

export async function findWorkspace(userId: string, field: "id" | "slug", value: string): Promise<Workspace | null> {
  const client = getPrepziiAdmin();
  const { data: institute, error } = await client.from("institutes").select(instituteFields)
    .eq(field, value).eq("status", "ACTIVE").maybeSingle<Institute>();
  if (error) throw error;
  if (!institute) return null;

  const { data: members, error: memberError } = await client.from("institute_members").select(memberFields)
    .eq("institute_id", institute.id).eq("user_id", userId).returns<InstituteMember[]>();
  if (memberError) throw memberError;
  return toWorkspace(institute, userId, members ?? []);
}

export async function getOrganizationContext(slug: string, allowedRoles: readonly OrganizationRole[]): Promise<Workspace | null> {
  const userId = await getActingUserId();
  if (!userId) return null;
  const workspace = await findWorkspace(userId, "slug", slug);
  return workspace && allowedRoles.includes(workspace.context.role) ? workspace : null;
}

export async function getAuthorizedOrganizationContext(slug: string, permission: Permission) {
  const userId = await getActingUserId();
  if (!userId) return null;
  const workspace = await findWorkspace(userId, "slug", slug);
  return workspace && hasPermission(workspace.context.role, permission) ? workspace : null;
}
