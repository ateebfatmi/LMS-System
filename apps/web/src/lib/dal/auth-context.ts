import "server-only";

import { auth } from "@clerk/nextjs/server";
import type { OrganizationRole, TenantContext } from "@prepzii/contracts";
import { normalizeOrganizationRole } from "@prepzii/assessment-core";
import { getPrepziiAdmin, getOrganizationContext } from "@/lib/prepzii-backend";

export class AuthorizationError extends Error {
  constructor(message: string, public statusCode: number = 403) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Validates authenticated identity and organization membership server-side.
 * The client-side role switcher or user-supplied organization ID is NEVER trusted
 * without explicit server-side validation against canonical Supabase records.
 */
export async function requireAuthContext(
  requiredRoles?: readonly OrganizationRole[],
  requestedOrgId?: string
): Promise<TenantContext> {
  const isProduction = process.env.NODE_ENV === "production";
  const hasClerk = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

  // In production, authentication and database must be real; fail immediately if missing
  if (isProduction && (!hasClerk || !hasSupabase)) {
    throw new AuthorizationError(
      "Production deployment requires configured Clerk and Supabase credentials.",
      500
    );
  }

  // Production / Live Authenticated Flow
  if (hasClerk) {
    let userId: string | null = null;
    try {
      const clerkAuth = await auth();
      userId = clerkAuth.userId;
    } catch {}

    if (!userId && process.env.NODE_ENV !== "production") {
      try {
        const { headers } = await import("next/headers");
        const headerList = await headers();
        const devHeaderUser = headerList.get("x-authenticated-user");
        if (devHeaderUser) {
          userId = devHeaderUser;
        }
      } catch {}
    }

    if (!userId) {
      throw new AuthorizationError("Unauthenticated: Please log in.", 401);
    }

    if (!hasSupabase) {
      throw new AuthorizationError("Shared database is not configured.", 503);
    }

    const supabase = getPrepziiAdmin();

    // Determine requested organization from argument, headers, or cookies
    let targetOrgId = requestedOrgId;
    if (!targetOrgId) {
      try {
        const { headers, cookies } = await import("next/headers");
        const headerList = await headers();
        targetOrgId = headerList.get("x-organization-id") || headerList.get("x-institute-id") || undefined;
        if (!targetOrgId) {
          const cookieStore = await cookies();
          const activeSlug = cookieStore.get("prepzii_active_organization")?.value;
          if (activeSlug) {
            const selected = await getOrganizationContext(activeSlug, ["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER", "STUDENT", "PARENT", "ACCOUNTANT"]);
            if (!selected) throw new AuthorizationError("Forbidden: Institute membership is no longer active.", 403);
            targetOrgId = selected.institute.id;
          } else {
            targetOrgId = cookieStore.get("prepzii_org_id")?.value || cookieStore.get("organization_id")?.value || undefined;
          }
        }
      } catch (error) {
        if (error instanceof AuthorizationError) throw error;
      }
    }

    // Case 1: An explicit organization was requested (via argument, header, or cookie)
    if (targetOrgId) {
      // 1a. Check if the user is the owner of this organization
      const { data: ownedInst, error: ownedErr } = await supabase
        .from("institutes")
        .select("id, name, slug, owner_user_id, status")
        .eq("id", targetOrgId)
        .eq("status", "ACTIVE")
        .maybeSingle();

      if (ownedErr) {
        throw new AuthorizationError(`Failed to verify organization ownership: ${ownedErr.message}`, 500);
      }

      if (ownedInst && ownedInst.owner_user_id === userId) {
        const { data: ownerMember } = await supabase
          .from("institute_members")
          .select("id")
          .eq("institute_id", ownedInst.id)
          .eq("user_id", userId)
          .maybeSingle();

        if (requiredRoles && !requiredRoles.includes("OWNER")) {
          throw new AuthorizationError("Forbidden: Insufficient role permissions.", 403);
        }

        return {
          organizationId: ownedInst.id,
          organizationName: ownedInst.name,
          userId,
          role: "OWNER",
          memberId: ownerMember?.id,
        };
      }

      // 1b. Check if user is an active member of this organization
      const { data: member, error: memberErr } = await supabase
        .from("institute_members")
        .select("id, institute_id, user_id, role, status, institutes!inner(id, name, status)")
        .eq("institute_id", targetOrgId)
        .eq("user_id", userId)
        .eq("status", "ACTIVE")
        .eq("institutes.status", "ACTIVE")
        .maybeSingle();

      if (memberErr) {
        throw new AuthorizationError(`Failed to verify membership: ${memberErr.message}`, 500);
      }

      if (!member) {
        // Enforce strict cross-tenant isolation: User is neither owner nor member of requested organization
        throw new AuthorizationError("Forbidden: You are not an active member of this organization.", 403);
      }

      const role = normalizeOrganizationRole(member.role);
      if (requiredRoles && !requiredRoles.includes(role)) {
        throw new AuthorizationError(
          `Forbidden: Role '${role}' does not have permission. Required: [${requiredRoles.join(", ")}]`,
          403
        );
      }

      return {
        organizationId: member.institute_id,
        organizationName: (member.institutes as any)?.name || "Institute",
        userId,
        role,
        memberId: member.id,
      };
    }

    // Case 2: No specific organization was requested - discover user's authorized affiliations
    const [{ data: ownedInsts, error: ownedErr }, { data: memberships, error: memberErr }] =
      await Promise.all([
        supabase
          .from("institutes")
          .select("id, name, slug, owner_user_id, status")
          .eq("owner_user_id", userId)
          .eq("status", "ACTIVE"),
        supabase
          .from("institute_members")
          .select("id, institute_id, user_id, role, status, institutes!inner(id, name, status)")
          .eq("user_id", userId)
          .eq("status", "ACTIVE")
          .eq("institutes.status", "ACTIVE"),
      ]);

    if (ownedErr) {
      throw new AuthorizationError(`Failed to verify organization ownership: ${ownedErr.message}`, 500);
    }
    if (memberErr) {
      throw new AuthorizationError(`Failed to verify membership: ${memberErr.message}`, 500);
    }

    type Affiliation = {
      organizationId: string;
      organizationName: string;
      role: OrganizationRole;
      memberId?: string;
    };

    const candidateAffiliations: Affiliation[] = [];

    for (const inst of (ownedInsts || [])) {
      candidateAffiliations.push({
        organizationId: inst.id,
        organizationName: inst.name,
        role: "OWNER",
      });
    }

    for (const mem of (memberships || [])) {
      const existing = candidateAffiliations.find((c) => c.organizationId === mem.institute_id);
      const role = normalizeOrganizationRole(mem.role);
      if (!existing) {
        candidateAffiliations.push({
          organizationId: mem.institute_id,
          organizationName: (mem.institutes as any)?.name || "Institute",
          role,
          memberId: mem.id,
        });
      } else if (existing.role !== "OWNER") {
        existing.role = role;
        existing.memberId = mem.id;
      }
    }

    if (candidateAffiliations.length === 0) {
      throw new AuthorizationError("Forbidden: Your account is not an active member of any coaching institute.", 403);
    }

    const roleRank: Record<OrganizationRole, number> = {
      PLATFORM_SUPER_ADMIN: 7,
      OWNER: 5,
      ACADEMIC_COORDINATOR: 3.5,
      ACCOUNTANT: 2.5,
      COACHING_ADMIN: 4,
      TEACHER: 3,
      PARENT: 2,
      STUDENT: 1,
    };

    let chosen: Affiliation | undefined;

    if (requiredRoles && requiredRoles.length > 0) {
      const matching = candidateAffiliations.filter((c) => requiredRoles.includes(c.role));
      if (matching.length > 0) {
        matching.sort((a, b) => (roleRank[b.role] || 0) - (roleRank[a.role] || 0));
        chosen = matching[0];
      } else {
        const topAffiliation = [...candidateAffiliations].sort(
          (a, b) => (roleRank[b.role] || 0) - (roleRank[a.role] || 0)
        )[0];
        throw new AuthorizationError(
          `Forbidden: Role '${topAffiliation.role}' does not have permission. Required: [${requiredRoles.join(", ")}]`,
          403
        );
      }
    } else {
      candidateAffiliations.sort((a, b) => (roleRank[b.role] || 0) - (roleRank[a.role] || 0));
      chosen = candidateAffiliations[0];
    }

    return {
      organizationId: chosen.organizationId,
      organizationName: chosen.organizationName,
      userId,
      role: chosen.role,
      memberId: chosen.memberId,
    };
  }

  // Local Development Sandbox Mode (Permitted strictly when NODE_ENV !== "production")
  // Clearly tagged demo context that never touches production tables
  const demoOrgId = requestedOrgId || "demo-institute-apex";
  const demoRole = (requiredRoles && requiredRoles.length > 0) ? requiredRoles[0] : "DIRECTOR" as any;

  return {
    organizationId: demoOrgId,
    userId: `dev_user_${String(demoRole).toLowerCase()}`,
    role: demoRole,
  };
}
