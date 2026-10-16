import type { OrganizationRole } from "@prepzii/contracts";

export const invitationRoles = [
  "COACHING_ADMIN",
  "ACADEMIC_COORDINATOR",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "ACCOUNTANT",
] as const satisfies readonly OrganizationRole[];

export type InvitationRole = (typeof invitationRoles)[number];
export type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

const transitions: Record<InvitationStatus, ReadonlySet<InvitationStatus>> = {
  PENDING: new Set(["ACCEPTED", "REVOKED", "EXPIRED"]),
  ACCEPTED: new Set(),
  REVOKED: new Set(),
  EXPIRED: new Set(),
};

export function normalizeInvitationEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function canTransitionInvitation(from: InvitationStatus, to: InvitationStatus): boolean {
  return transitions[from].has(to);
}

export function isInvitationExpired(expiresAt: string | Date, now = new Date()): boolean {
  const expiry = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
  return Number.isNaN(expiry.getTime()) || expiry.getTime() <= now.getTime();
}
