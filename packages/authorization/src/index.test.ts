import assert from "node:assert/strict";
import test from "node:test";
import type { TenantContext } from "@prepzii/contracts";
import {
  AuthorizationError,
  authorizeTenantAction,
  canGrantRole,
  hasPermission,
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
test("teachers can manage academics but cannot manage fees or members", () => {
  assert.equal(hasPermission("TEACHER", "attendance:manage"), true);
  assert.equal(hasPermission("TEACHER", "fees:manage"), false);
  assert.equal(hasPermission("TEACHER", "members:manage"), false);
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
