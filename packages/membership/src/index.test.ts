import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionInvitation,
  invitationRoles,
  isInvitationExpired,
  normalizeInvitationEmail,
} from "./index.ts";

test("normalizes invitation email identity", () => {
  assert.equal(normalizeInvitationEmail("  Student@Example.COM "), "student@example.com");
});

test("never permits terminal invitation states to be reused", () => {
  assert.equal(canTransitionInvitation("PENDING", "ACCEPTED"), true);
  assert.equal(canTransitionInvitation("ACCEPTED", "PENDING"), false);
  assert.equal(canTransitionInvitation("REVOKED", "ACCEPTED"), false);
  assert.equal(canTransitionInvitation("EXPIRED", "ACCEPTED"), false);
});

test("treats invalid and elapsed expiry values as expired", () => {
  const now = new Date("2026-10-17T12:00:00.000Z");
  assert.equal(isInvitationExpired("2026-10-17T11:59:59.000Z", now), true);
  assert.equal(isInvitationExpired("2026-10-17T12:00:01.000Z", now), false);
  assert.equal(isInvitationExpired("not-a-date", now), true);
});

test("excludes owner and platform roles from invitations", () => {
  assert.equal(invitationRoles.includes("STUDENT"), true);
  assert.equal((invitationRoles as readonly string[]).includes("OWNER"), false);
  assert.equal((invitationRoles as readonly string[]).includes("PLATFORM_SUPER_ADMIN"), false);
});
