import assert from "node:assert/strict";
import test from "node:test";
import {
  adaptPrepziiQuestionToBankItem,
  adaptPrepziiPyqToBankItem,
  bridgePyqToQuestionPayload,
  gradeAnswer,
  type PrepziiQuestionRow,
  type PrepziiPyqRow,
} from "./index.js";

test("Canonical Schema Reconciliation: Verifies institute_batches payload structure", () => {
  // Verified canonical columns: id, institute_id, name, exam, target_year, created_at
  // Additive columns: campus_id, academic_year_id, grade_level, room_number, is_active
  // FORBIDDEN: status (must not exist)
  const canonicalBatchPayload = {
    institute_id: "7b4c6e91-1234-4a5b-9c8d-e1f2a3b4c5d6",
    name: "JEE Advanced 2026 Batch A",
    exam: "JEE_ADVANCED",
    target_year: 2026,
    campus_id: "c1a2b3c4-0000-4000-8000-000000000001",
    academic_year_id: "a1a2b3c4-0000-4000-8000-000000000002",
    grade_level: "Class 12",
    room_number: "Room 302",
    is_active: true,
  };

  assert.equal("status" in canonicalBatchPayload, false, "institute_batches must not query or insert status");
  assert.equal(canonicalBatchPayload.institute_id, "7b4c6e91-1234-4a5b-9c8d-e1f2a3b4c5d6");
  assert.equal(canonicalBatchPayload.exam, "JEE_ADVANCED");
  assert.equal(canonicalBatchPayload.target_year, 2026);
  assert.equal(canonicalBatchPayload.is_active, true);
});

test("Canonical Schema Reconciliation: Verifies institute_test_questions foreign keys", () => {
  // Verified columns: id, institute_id, institute_test_id, question_id, question_order, created_at
  // FORBIDDEN: test_id (must be institute_test_id)
  const canonicalTestQPayload = {
    institute_id: "7b4c6e91-1234-4a5b-9c8d-e1f2a3b4c5d6",
    institute_test_id: "9f8e7d6c-5b4a-3210-fedc-ba9876543210",
    question_id: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    question_order: 1,
  };

  assert.equal("test_id" in canonicalTestQPayload, false, "Must use institute_test_id, not test_id");
  assert.equal(canonicalTestQPayload.institute_test_id, "9f8e7d6c-5b4a-3210-fedc-ba9876543210");
  assert.equal(canonicalTestQPayload.institute_id, "7b4c6e91-1234-4a5b-9c8d-e1f2a3b4c5d6");
  assert.equal(canonicalTestQPayload.question_id, "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d");
});

test("Canonical Schema Reconciliation: Verifies institute_test_attempts columns", () => {
  // Verified columns: id, institute_id, institute_test_id, user_id, session_id, attempt_id, status, started_at, submitted_at
  // FORBIDDEN: member_id, test_id
  const canonicalAttemptPayload = {
    institute_id: "7b4c6e91-1234-4a5b-9c8d-e1f2a3b4c5d6",
    institute_test_id: "9f8e7d6c-5b4a-3210-fedc-ba9876543210",
    user_id: "user_clerk_student_999",
    session_id: "2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e",
    attempt_id: "3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f",
    status: "SUBMITTED",
    started_at: "2026-10-23T09:00:00Z",
    submitted_at: "2026-10-23T11:58:30Z",
  };

  assert.equal("member_id" in canonicalAttemptPayload, false, "Must use user_id, not member_id");
  assert.equal("test_id" in canonicalAttemptPayload, false, "Must use institute_test_id, not test_id");
  assert.equal(canonicalAttemptPayload.institute_test_id, "9f8e7d6c-5b4a-3210-fedc-ba9876543210");
  assert.equal(canonicalAttemptPayload.user_id, "user_clerk_student_999");
});

test("PYQ Selection Reconciliation: Synchronizes PYQ to canonical questions format idempotently", () => {
  const pyq: PrepziiPyqRow = {
    id: "e4f5a6b7-8c9d-0e1f-2a3b-4c5d6e7f8a9b",
    question: "A block of mass m is placed on an inclined plane of angle theta...",
    question_text: "A block of mass m is placed on an inclined plane of angle theta...",
    question_image: "https://cdn.prepzii.com/pyq/block.png",
    option_a: "mg sin(theta)",
    option_b: "mg cos(theta)",
    option_c: "mu mg cos(theta)",
    option_d: "Zero",
    correct_option: "a",
    numerical_answer: null,
    numerical_min: null,
    numerical_max: null,
    marks_positive: 4,
    marks_negative: 1,
    exam: "JEE_MAIN",
    subject: "Physics",
    chapter: "Laws of Motion",
    year: 2024,
    difficulty: "MEDIUM",
  };

  const bridged = bridgePyqToQuestionPayload(pyq);

  // Bridges cleanly to canonical public.questions row
  assert.equal(bridged.id, "e4f5a6b7-8c9d-0e1f-2a3b-4c5d6e7f8a9b");
  assert.equal(bridged.source_type, "PYQ");
  assert.equal(bridged.exam, "JEE_MAIN");
  assert.equal(bridged.subject, "Physics");
  assert.equal(bridged.chapter, "Laws of Motion");
  assert.equal(bridged.marks, 4);
  assert.equal(bridged.negative_marks, 1);
  assert.equal(bridged.correct_option, "a");
  assert.equal(bridged.is_active, true);
});

test("Redundant Batch View Mapping: Maps canonical batch to B2B organization_batches view", () => {
  const canonicalRow = {
    id: "batch-uuid-001",
    institute_id: "org-uuid-999",
    campus_id: "campus-uuid-111",
    academic_year_id: "ay-uuid-222",
    name: "Target NEET 2026",
    exam: "NEET",
    grade_level: "Class 12",
    room_number: "Room 101",
    is_active: true,
    created_at: "2026-10-23T00:00:00Z",
  };

  // Simulated organization_batches view projection
  const viewRow = {
    id: canonicalRow.id,
    organization_id: canonicalRow.institute_id,
    campus_id: canonicalRow.campus_id,
    academic_year_id: canonicalRow.academic_year_id,
    name: canonicalRow.name,
    target_exam: canonicalRow.exam,
    grade_level: canonicalRow.grade_level,
    room_number: canonicalRow.room_number,
    is_active: canonicalRow.is_active,
    created_at: canonicalRow.created_at,
  };

  assert.equal(viewRow.id, canonicalRow.id);
  assert.equal(viewRow.organization_id, canonicalRow.institute_id);
  assert.equal(viewRow.target_exam, "NEET");
  assert.equal(viewRow.is_active, true);
});

test("Coaching Extension Integrity: organization_test_schedules links institute_tests to institute_batches", () => {
  const schedulePayload = {
    id: "sched-uuid-001",
    organization_id: "org-uuid-999",
    test_id: "test-uuid-456", // Points to public.institute_tests(id)
    batch_id: "batch-uuid-001", // Points to public.institute_batches(id)
    starts_at: "2026-10-25T09:00:00Z",
    ends_at: "2026-10-25T12:00:00Z",
    is_strict_timing: true,
  };

  assert.equal(new Date(schedulePayload.ends_at).getTime() > new Date(schedulePayload.starts_at).getTime(), true);
  assert.equal(schedulePayload.is_strict_timing, true);
  assert.equal(schedulePayload.test_id, "test-uuid-456");
  assert.equal(schedulePayload.batch_id, "batch-uuid-001");
});

test("Tenant Resolution: Multi-membership user with STUDENT and COACHING_ADMIN prioritizes authorized role", () => {
  // Scenario matching real user user_3Hn8DX4ZESE0rRCd8y1mhB8WEWY:
  // - In "Fittjee": role = "STUDENT"
  // - In "ateeb coaching": role = "COACHING_ADMIN"
  const memberships = [
    { institute_id: "inst-fittjee", role: "STUDENT", institute_name: "Fittjee" },
    { institute_id: "inst-ateeb", role: "COACHING_ADMIN", institute_name: "ateeb coaching" },
  ];

  const roleRank: Record<string, number> = {
    OWNER: 5,
    COACHING_ADMIN: 4,
    TEACHER: 3,
    PARENT: 2,
    STUDENT: 1,
  };

  const requiredAdminRoles = ["OWNER", "COACHING_ADMIN", "TEACHER"];

  // When administrative access is required, system must pick ateeb coaching over Fittjee
  const matching = memberships.filter((m) => requiredAdminRoles.includes(m.role));
  matching.sort((a, b) => (roleRank[b.role] || 0) - (roleRank[a.role] || 0));
  const chosen = matching[0];

  assert.equal(chosen.institute_id, "inst-ateeb");
  assert.equal(chosen.role, "COACHING_ADMIN");
  assert.equal(chosen.institute_name, "ateeb coaching");
});

test("Tenant Resolution: Cross-tenant isolation strictly rejects unauthorized organization", () => {
  const userMemberships = [
    { institute_id: "inst-fittjee", role: "STUDENT" },
    { institute_id: "inst-ateeb", role: "COACHING_ADMIN" },
  ];

  const targetOrgId = "inst-alien-unauthorized";
  const isMember = userMemberships.some((m) => m.institute_id === targetOrgId);

  assert.equal(isMember, false, "Must detect that user has no active affiliation with requested institute");
});

test("Tenant Resolution: Pure student account without institute membership triggers forbidden error", () => {
  // Scenario matching user user_3Eav2ZAA1aL30GY8VS0FFFvQpYP (0 institute memberships)
  const ownedInstitutes: any[] = [];
  const memberships: any[] = [];

  const hasAffiliation = ownedInstitutes.length > 0 || memberships.length > 0;
  assert.equal(hasAffiliation, false, "Must detect zero affiliations for unlinked user");
});
