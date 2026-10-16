import assert from "node:assert/strict";
import test from "node:test";
import {
  canTransitionInvitation,
  invitationRoles,
  isInvitationExpired,
  normalizeInvitationEmail,
  validateMemberCsv,
} from "./index.ts";

test("normalizes invitation email identity", () => {
  assert.equal(normalizeInvitationEmail("  Student@Example.COM "), "student@example.com");
});

test("parses quoted CSV fields and normalizes member rows", () => {
  const result = validateMemberCsv(
    'name,email,guardianName,rollNumber\n"Sharma, Aarav",AARAV@example.com,"Sharma, Raj",A-01',
    "STUDENT",
  );
  assert.deepEqual(result.fileErrors, []);
  assert.equal(result.rows[0].normalizedData?.displayName, "Sharma, Aarav");
  assert.equal(result.rows[0].normalizedData?.email, "aarav@example.com");
  assert.equal(result.rows[0].normalizedData?.guardianName, "Sharma, Raj");
});

test("rejects duplicate emails and role-incompatible columns", () => {
  const result = validateMemberCsv(
    "name,email,rollNumber\nFirst,one@example.com,T-01\nSecond,ONE@example.com,T-02",
    "TEACHER",
  );
  assert.match(result.rows[0].errors.join(" "), /Teacher rows cannot include rollNumber/);
  assert.match(result.rows[1].errors.join(" "), /duplicated/);
});

test("rejects unknown or missing headers before staging rows", () => {
  const result = validateMemberCsv("fullName,custom\nAarav,x", "STUDENT");
  assert.equal(result.rows.length, 0);
  assert.match(result.fileErrors.join(" "), /Missing required "name"/);
  assert.match(result.fileErrors.join(" "), /Unknown columns/);
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
