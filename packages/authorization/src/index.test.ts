import assert from "node:assert/strict";
import test from "node:test";
import type { TenantContext } from "@prepzii/contracts";
import {
  AuthorizationError,
  authorizeTenantAction,
  canUseDevelopmentDemoTenant,
  canAccessAssignment,
  canAccessBatch,
  canAccessGuardianStudent,
  canGrantRole,
  evaluateQuotaAvailability,
  hasPermission,
  isAnswerKeyReleased,
  isMembershipActive,
  isPaymentUnique,
  isDevelopmentAuthOverrideEnabled,
  isTrustedMutationRequest,
} from "./index.ts";

const teacherA: TenantContext = {
  organizationId: "organization-a",
  userId: "teacher-a",
  role: "TEACHER",
};

test("rejects cross-tenant access before evaluating role permissions", () => {
  assert.throws(
    () => authorizeTenantAction(teacherA, "organization-b", "academics:read"),
    (error) => error instanceof AuthorizationError && error.code === "CROSS_TENANT",
  );
});
test("teachers can manage content and attendance but not institute structure, fees, or members", () => {
  assert.equal(hasPermission("TEACHER", "academics:manage"), false);
  assert.equal(hasPermission("TEACHER", "content:manage"), true);
  assert.equal(hasPermission("TEACHER", "attendance:manage"), true);
  assert.equal(hasPermission("TEACHER", "fees:manage"), false);
  assert.equal(hasPermission("TEACHER", "members:manage"), false);
  assert.equal(hasPermission("TEACHER", "crm:read"), false);
});

test("admissions CRM is restricted to owners and coaching administrators", () => {
  assert.equal(hasPermission("OWNER", "crm:manage"), true);
  assert.equal(hasPermission("COACHING_ADMIN", "crm:read"), true);
  assert.equal(hasPermission("ACADEMIC_COORDINATOR", "crm:read"), false);
});
test("users cannot promote themselves or others to privileged server-controlled roles", () => {
  assert.equal(canGrantRole("COACHING_ADMIN", "OWNER"), false);
  assert.equal(canGrantRole("OWNER", "PLATFORM_SUPER_ADMIN"), false);
  assert.equal(canGrantRole("COACHING_ADMIN", "TEACHER"), true);
});

test("platform admins do not implicitly receive tenant content permissions", () => {
  const platformAdmin: TenantContext = {
    organizationId: "platform",
    userId: "operator-1",
    role: "PLATFORM_SUPER_ADMIN",
  };
  assert.throws(
    () => authorizeTenantAction(platformAdmin, "organization-a", "fees:read"),
    (error) => error instanceof AuthorizationError && error.code === "FORBIDDEN",
  );
});

test("parents cannot read attendance or fees before guardian linking exists", () => {
  const parent = { organizationId: "organization-a", userId: "parent-1", role: "PARENT" } as const;
  assert.throws(
    () => authorizeTenantAction(parent, "organization-a", "attendance:read"),
    (error) => error instanceof AuthorizationError && error.code === "FORBIDDEN",
  );
  assert.throws(
    () => authorizeTenantAction(parent, "organization-a", "fees:read"),
    (error) => error instanceof AuthorizationError && error.code === "FORBIDDEN",
  );
});

test("reviewed guardian scope allows only explicitly linked students in the same tenant", () => {
  const parent = { organizationId: "organization-a", userId: "parent-1", role: "PARENT" } as const;
  assert.equal(canAccessGuardianStudent(parent, "organization-a", "student-1", ["student-1"]), true);
  assert.equal(canAccessGuardianStudent(parent, "organization-a", "student-2", ["student-1"]), false);
  assert.equal(canAccessGuardianStudent(parent, "organization-b", "student-1", ["student-1"]), false);
});

test("teacher batch scope restricts teachers to assigned batches only", () => {
  const teacherCtx: TenantContext = { organizationId: "org-1", userId: "teacher-1", role: "TEACHER" };
  const ownerCtx: TenantContext = { organizationId: "org-1", userId: "owner-1", role: "OWNER" };
  const studentCtx: TenantContext = { organizationId: "org-1", userId: "student-1", role: "STUDENT" };

  const assignedBatches = ["batch-jee-12a", "batch-jee-12b"];

  assert.equal(canAccessBatch(teacherCtx, "batch-jee-12a", assignedBatches), true);
  assert.equal(canAccessBatch(teacherCtx, "batch-neet-11", assignedBatches), false);
  assert.equal(canAccessBatch(ownerCtx, "batch-neet-11", []), true);
  assert.equal(canAccessBatch(studentCtx, "batch-jee-12a", assignedBatches), true);
  assert.equal(canAccessBatch(studentCtx, "batch-neet-11", assignedBatches), false);
});

test("answer key release policy blocks early solution disclosure", () => {
  const now = new Date("2026-10-17T10:00:00.000Z");

  // Immediate release policy
  assert.equal(isAnswerKeyReleased({ solutionReleasePolicy: "IMMEDIATE" }, now), true);

  // Never release policy
  assert.equal(isAnswerKeyReleased({ solutionReleasePolicy: "NEVER" }, now), false);

  // Manual release policy
  assert.equal(isAnswerKeyReleased({ solutionReleasePolicy: "MANUAL", manuallyReleased: false }, now), false);
  assert.equal(isAnswerKeyReleased({ solutionReleasePolicy: "MANUAL", manuallyReleased: true }, now), true);

  // Window closes in future -> not released
  assert.equal(
    isAnswerKeyReleased({ solutionReleasePolicy: "AFTER_WINDOW", windowClosesAt: "2026-10-17T11:00:00.000Z" }, now),
    false,
  );
  // Window closed in past -> released
  assert.equal(
    isAnswerKeyReleased({ solutionReleasePolicy: "AFTER_WINDOW", windowClosesAt: "2026-10-17T09:00:00.000Z" }, now),
    true,
  );
  // Invalid window date -> safe fallback to false
  assert.equal(
    isAnswerKeyReleased({ solutionReleasePolicy: "AFTER_WINDOW", windowClosesAt: "invalid-date" }, now),
    false,
  );
});

test("assignment and file access enforces batch enrollment and publication", () => {
  const studentCtx: TenantContext = { organizationId: "org-1", userId: "student-1", role: "STUDENT" };
  const teacherCtx: TenantContext = { organizationId: "org-1", userId: "teacher-1", role: "TEACHER" };
  const crossTenantCtx: TenantContext = { organizationId: "org-2", userId: "student-2", role: "STUDENT" };

  const publishedAssignment = {
    organizationId: "org-1",
    batchId: "batch-101",
    isPublished: true,
  };

  const draftAssignment = {
    organizationId: "org-1",
    batchId: "batch-101",
    isPublished: false,
  };

  // Student enrolled in batch can access published assignment
  assert.equal(canAccessAssignment(studentCtx, publishedAssignment, ["batch-101"]), true);
  // Student not enrolled cannot access
  assert.equal(canAccessAssignment(studentCtx, publishedAssignment, ["batch-999"]), false);
  // Student cannot access unpublished draft assignment even if in batch
  assert.equal(canAccessAssignment(studentCtx, draftAssignment, ["batch-101"]), false);
  // Teacher in batch can view draft assignment
  assert.equal(canAccessAssignment(teacherCtx, draftAssignment, ["batch-101"]), true);
  // Cross-tenant student is completely rejected
  assert.equal(canAccessAssignment(crossTenantCtx, publishedAssignment, ["batch-101"]), false);
});

test("membership status rejects suspended, inactive, or pending states", () => {
  assert.equal(isMembershipActive("ACTIVE"), true);
  assert.equal(isMembershipActive("PENDING"), false);
  assert.equal(isMembershipActive("INACTIVE"), false);
  assert.equal(isMembershipActive("SUSPENDED"), false);
});

test("payment idempotency prevents duplicate reference recording", () => {
  const existing = new Set(["REC-2026-001", "UPI-REF-9988"]);

  assert.equal(isPaymentUnique(existing, "REC-2026-002"), true);
  assert.equal(isPaymentUnique(existing, "REC-2026-001"), false);
  assert.equal(isPaymentUnique(existing, "  rec-2026-001  "), false); // Case & whitespace insensitive
  assert.equal(isPaymentUnique(existing, "   "), false); // Blank reference rejected
});

test("quota evaluation rejects negative increments and enforces plan limits", () => {
  // Within limit
  assert.deepEqual(evaluateQuotaAvailability(BigInt(100), BigInt(50), BigInt(200)), { allowed: true, remaining: BigInt(50) });
  // Exceeds limit
  assert.deepEqual(evaluateQuotaAvailability(BigInt(180), BigInt(30), BigInt(200)), { allowed: false, remaining: BigInt(20) });
  // Invalid zero or negative quantity
  assert.deepEqual(evaluateQuotaAvailability(BigInt(100), BigInt(0), BigInt(200)), { allowed: false, remaining: BigInt(100) });
  assert.deepEqual(evaluateQuotaAvailability(BigInt(100), BigInt(-5), BigInt(200)), { allowed: false, remaining: BigInt(100) });
  // Exact boundary match
  assert.deepEqual(evaluateQuotaAvailability(BigInt(150), BigInt(50), BigInt(200)), { allowed: true, remaining: BigInt(0) });
});

test("development identity override is explicit and never available outside development", () => {
  assert.equal(isDevelopmentAuthOverrideEnabled("development", "true"), true);
  assert.equal(isDevelopmentAuthOverrideEnabled("development", undefined), false);
  assert.equal(isDevelopmentAuthOverrideEnabled("test", "true"), false);
  assert.equal(isDevelopmentAuthOverrideEnabled("production", "true"), false);
});

test("demo tenancy fails closed for partial or deployed service configuration", () => {
  assert.equal(canUseDevelopmentDemoTenant({ nodeEnv: "development", hasClerk: false, hasSupabase: false }), true);
  assert.equal(canUseDevelopmentDemoTenant({ nodeEnv: "development", hasClerk: false, hasSupabase: true }), false);
  assert.equal(canUseDevelopmentDemoTenant({ nodeEnv: "development", hasClerk: true, hasSupabase: false }), false);
  assert.equal(canUseDevelopmentDemoTenant({ nodeEnv: "production", hasClerk: false, hasSupabase: false }), false);
});

test("mutation origin policy rejects cross-site browser requests", () => {
  const allowedOrigins = ["https://institutes.prepzii.com"];
  assert.equal(isTrustedMutationRequest({ method: "GET", origin: "https://evil.example", fetchSite: "cross-site", allowedOrigins }), true);
  assert.equal(isTrustedMutationRequest({ method: "POST", origin: "https://institutes.prepzii.com", fetchSite: "same-origin", allowedOrigins }), true);
  assert.equal(isTrustedMutationRequest({ method: "POST", origin: "https://evil.example", fetchSite: "cross-site", allowedOrigins }), false);
  assert.equal(isTrustedMutationRequest({ method: "POST", origin: "not-a-url", fetchSite: "same-site", allowedOrigins }), false);
  assert.equal(isTrustedMutationRequest({ method: "POST", origin: null, fetchSite: null, allowedOrigins }), true);
});

