import type { OrganizationRole, TenantContext } from "@prepzii/contracts";

export const permissions = [
  "platform:manage",
  "organization:read",
  "organization:manage",
  "members:read",
  "members:manage",
  "academics:read",
  "academics:manage",
  "content:read",
  "content:manage",
  "assessments:take",
  "assessments:manage",
  "attendance:read",
  "attendance:manage",
  "fees:read",
  "fees:manage",
  "reports:read",
  "subscriptions:manage",
  "announcements:read",
  "announcements:manage",
] as const;

export type Permission = (typeof permissions)[number];

const rolePermissions: Record<OrganizationRole, ReadonlySet<Permission>> = {
  PLATFORM_SUPER_ADMIN: new Set(["platform:manage"]),
  OWNER: new Set(permissions.filter((permission) => permission !== "platform:manage")),
  COACHING_ADMIN: new Set([
    "organization:read", "members:read", "members:manage", "academics:read", "academics:manage",
    "content:read", "content:manage", "assessments:manage", "attendance:read", "attendance:manage",
    "fees:read", "fees:manage", "reports:read", "announcements:read", "announcements:manage",
  ]),
  ACADEMIC_COORDINATOR: new Set([
    "organization:read", "members:read", "academics:read", "academics:manage", "content:read",
    "content:manage", "assessments:manage", "attendance:read", "attendance:manage", "reports:read",
    "announcements:read", "announcements:manage",
  ]),
  TEACHER: new Set([
    "organization:read", "academics:read", "content:read", "content:manage", "assessments:manage",
    "attendance:read", "attendance:manage", "reports:read", "announcements:read",
  ]),
  STUDENT: new Set([
    "organization:read", "academics:read", "content:read", "assessments:take", "attendance:read",
    "fees:read", "announcements:read",
  ]),
  PARENT: new Set(["organization:read", "attendance:read", "fees:read", "announcements:read"]),
  ACCOUNTANT: new Set(["organization:read", "members:read", "fees:read", "fees:manage", "reports:read"]),
};

export class AuthorizationError extends Error {
  readonly code: "CROSS_TENANT" | "FORBIDDEN";

  constructor(code: AuthorizationError["code"], message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}

export function hasPermission(role: OrganizationRole, permission: Permission): boolean {
  return rolePermissions[role].has(permission);
}

export function authorizeTenantAction(
  context: TenantContext,
  resourceOrganizationId: string,
  permission: Permission,
): void {
  if (context.role === "PLATFORM_SUPER_ADMIN") {
    if (permission !== "platform:manage") {
      throw new AuthorizationError(
        "FORBIDDEN",
        "Platform administration does not implicitly grant access to tenant content.",
      );
    }
    return;
  }

  if (context.organizationId !== resourceOrganizationId) {
    throw new AuthorizationError("CROSS_TENANT", "The resource belongs to another organization.");
  }

  if (!hasPermission(context.role, permission)) {
    throw new AuthorizationError("FORBIDDEN", `Role ${context.role} lacks ${permission}.`);
  }
}

export function canGrantRole(actorRole: OrganizationRole, targetRole: OrganizationRole): boolean {
  if (targetRole === "PLATFORM_SUPER_ADMIN" || targetRole === "OWNER") return false;
  if (actorRole === "OWNER") return true;
  if (actorRole !== "COACHING_ADMIN") return false;
  return !["COACHING_ADMIN", "PLATFORM_SUPER_ADMIN", "OWNER"].includes(targetRole);
}
