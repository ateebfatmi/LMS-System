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
  "crm:read",
  "crm:manage",
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
    "crm:read", "crm:manage",
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
  // Parent attendance/fee access stays denied until a reviewed guardian-child
  // relationship can scope those reads to a specific student.
  PARENT: new Set(["organization:read", "announcements:read"]),
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

export function canAccessBatch(
  context: TenantContext,
  targetBatchId: string,
  assignedBatchIds: readonly string[],
): boolean {
  if (context.role === "OWNER" || context.role === "COACHING_ADMIN" || context.role === "ACADEMIC_COORDINATOR") {
    return true;
  }
  if (context.role === "TEACHER" || context.role === "STUDENT") {
    return assignedBatchIds.includes(targetBatchId);
  }
  return false;
}

export interface AnswerKeyReleasePolicy {
  solutionReleasePolicy: "IMMEDIATE" | "AFTER_WINDOW" | "MANUAL" | "NEVER";
  windowClosesAt?: string | null;
  manuallyReleased?: boolean;
}

export function isAnswerKeyReleased(policy: AnswerKeyReleasePolicy, now: Date = new Date()): boolean {
  if (policy.solutionReleasePolicy === "IMMEDIATE") return true;
  if (policy.solutionReleasePolicy === "MANUAL") return Boolean(policy.manuallyReleased);
  if (policy.solutionReleasePolicy === "NEVER") return false;
  if (policy.solutionReleasePolicy === "AFTER_WINDOW") {
    if (!policy.windowClosesAt) return false;
    const closesAt = new Date(policy.windowClosesAt);
    if (Number.isNaN(closesAt.getTime())) return false;
    return now.getTime() >= closesAt.getTime();
  }
  return false;
}

export function canAccessAssignment(
  context: TenantContext,
  assignment: { organizationId: string; batchId: string; isPublished: boolean; dueDate?: string | null },
  userBatchIds: readonly string[],
): boolean {
  if (context.organizationId !== assignment.organizationId) {
    return false;
  }
  if (context.role === "OWNER" || context.role === "COACHING_ADMIN" || context.role === "ACADEMIC_COORDINATOR") {
    return true;
  }
  if (context.role === "TEACHER") {
    return userBatchIds.includes(assignment.batchId);
  }
  if (context.role === "STUDENT") {
    return assignment.isPublished && userBatchIds.includes(assignment.batchId);
  }
  return false;
}

export function canAccessGuardianStudent(
  context: TenantContext,
  resourceOrganizationId: string,
  studentUserId: string,
  approvedStudentUserIds: readonly string[],
): boolean {
  return context.role === "PARENT"
    && context.organizationId === resourceOrganizationId
    && approvedStudentUserIds.includes(studentUserId);
}

export function isMembershipActive(status: "PENDING" | "ACTIVE" | "INACTIVE" | "SUSPENDED"): boolean {
  return status === "ACTIVE";
}

export function isPaymentUnique(
  existingReferences: ReadonlySet<string>,
  candidateReference: string,
): boolean {
  const normalized = candidateReference.trim().toUpperCase();
  if (!normalized) return false;
  return !existingReferences.has(normalized);
}

export function evaluateQuotaAvailability(
  currentUsage: bigint | number,
  increment: bigint | number,
  limit: bigint | number,
): { allowed: boolean; remaining: bigint } {
  const current = BigInt(currentUsage);
  const inc = BigInt(increment);
  const max = BigInt(limit);
  const zero = BigInt(0);
  if (inc <= zero) return { allowed: false, remaining: max > current ? max - current : zero };
  const projected = current + inc;
  if (projected > max) {
    return { allowed: false, remaining: max > current ? max - current : zero };
  }
  return { allowed: true, remaining: max - projected };
}

export function isDevelopmentAuthOverrideEnabled(
  nodeEnv: string | undefined,
  allowInsecureDevAuth: string | undefined,
): boolean {
  return nodeEnv === "development" && allowInsecureDevAuth === "true";
}

export function canUseDevelopmentDemoTenant(input: {
  nodeEnv: string | undefined;
  hasClerk: boolean;
  hasSupabase: boolean;
}): boolean {
  return input.nodeEnv === "development" && !input.hasClerk && !input.hasSupabase;
}

export function isTrustedMutationRequest(input: {
  method: string;
  origin?: string | null;
  fetchSite?: string | null;
  allowedOrigins: readonly string[];
}): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(input.method.toUpperCase())) return true;
  if (input.fetchSite === "cross-site") return false;
  if (!input.origin) return true;

  let normalizedOrigin: string;
  try {
    normalizedOrigin = new URL(input.origin).origin;
  } catch {
    return false;
  }

  return input.allowedOrigins.some((allowedOrigin) => {
    try {
      return new URL(allowedOrigin).origin === normalizedOrigin;
    } catch {
      return false;
    }
  });
}

