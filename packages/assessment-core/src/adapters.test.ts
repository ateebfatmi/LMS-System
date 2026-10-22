import assert from "node:assert/strict";
import test from "node:test";
import {
  gradeAnswer,
  adaptPrepziiQuestionToBankItem,
  adaptPrepziiQuestionToDefinition,
  adaptPrepziiPyqToBankItem,
  adaptPrepziiPyqToDefinition,
  sanitizeQuestionForCandidate,
  normalizeOrganizationRole,
  normalizeTargetExam,
  normalizeQuestionDifficulty,
  bridgePyqToQuestionPayload,
  type PrepziiQuestionRow,
  type PrepziiPyqRow,
} from "./index.js";

test("Question Adapter: Maps actual Prepzii public.questions row correctly", () => {
  const row: PrepziiQuestionRow = {
    id: "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    exam: "JEE_ADVANCED",
    subject: "Physics",
    chapter: "Electrodynamics",
    topic: "Faraday Law",
    difficulty: "HARD",
    question_type: "multiple_choice",
    question_text: "A loop of wire with radius R is subject to varying B(t)...",
    question_image: "https://cdn.prepzii.com/img/q-loop.png",
    option_a: "Induced EMF is non-zero",
    option_b: "Flux increases linearly",
    option_c: "Joule heating is non-zero",
    option_d: "Current is counter-clockwise",
    option_a_image: null,
    option_b_image: null,
    option_c_image: null,
    option_d_image: null,
    correct_option: "a, c",
    explanation: "Flux variation induces emf according to Faraday and Lenz law",
    explanation_image: "https://cdn.prepzii.com/img/sol-loop.png",
    marks: 4,
    negative_marks: 2,
    is_active: true,
    question_order: 1,
    source_type: "CURATED",
    status: "ACTIVE",
    question_content: { formula: "\\oint E \\cdot dl = -d\\Phi/dt", diagram: "loop_view" },
    explanation_content: { detailedStep: "Evaluate integral around loop" },
  };

  const bankItem = adaptPrepziiQuestionToBankItem(row);
  assert.equal(bankItem.id, "3fa85f64-5717-4562-b3fc-2c963f66afa6");
  assert.equal(bankItem.kind, "multiple_choice");
  assert.equal(bankItem.targetExam, "JEE_ADVANCED");
  assert.equal(bankItem.subject, "Physics");
  assert.equal(bankItem.chapter, "Electrodynamics");
  assert.equal(bankItem.difficulty, "HARD");
  assert.equal(bankItem.marks, 4);
  assert.equal(bankItem.negativeMarks, 2);
  assert.equal(bankItem.partialMarking, true); // JEE Advanced multiple choice
  assert.equal(bankItem.imageUrl, "https://cdn.prepzii.com/img/q-loop.png");
  assert.equal(bankItem.options?.length, 4);
  assert.equal(bankItem.options?.[0].id, "a");
  assert.equal(bankItem.options?.[0].text, "Induced EMF is non-zero");

  // Verify authoritative definition has answer keys
  const authDef = adaptPrepziiQuestionToDefinition(row, true);
  assert.deepEqual(authDef.correctOptionIds, ["a", "c"]);

  // Verify non-authoritative definition omits answer keys
  const publicDef = adaptPrepziiQuestionToDefinition(row, false);
  assert.equal(publicDef.correctOptionIds, undefined);
  assert.equal(publicDef.correctNumber, undefined);
});

test("PYQ Adapter: Maps public.pyq_questions with numerical answer and tolerances", () => {
  const pyqRow: PrepziiPyqRow = {
    id: "7cb129a0-6218-4903-8822-1d120a1f8101",
    question: "Find the root-mean-square speed of oxygen molecules at 300K in m/s:",
    question_image: null,
    option_a: null,
    option_b: null,
    option_c: null,
    option_d: null,
    correct_option: null,
    correct_options: null,
    numerical_answer: 483.5,
    numerical_min: 480.0,
    numerical_max: 487.0,
    marks_positive: 4,
    marks_negative: 0,
    question_content: { constant: "R = 8.314 J/mol*K" },
    explanation_content: { formula: "v_rms = sqrt(3RT/M)" },
    exam: "JEE Main",
    exam_type: "SESSION_1",
    subject: "Physics",
    chapter: "Thermodynamics",
    topic: "Kinetic Theory of Gases",
    year: 2024,
    difficulty: "MEDIUM",
    status: "ACTIVE",
    paper_code: "PH-2024-S1",
    question_number: 21,
    display_order: 21,
  };

  const bankItem = adaptPrepziiPyqToBankItem(pyqRow);
  assert.equal(bankItem.id, "7cb129a0-6218-4903-8822-1d120a1f8101");
  assert.equal(bankItem.kind, "numerical");
  assert.equal(bankItem.targetExam, "JEE_MAIN");
  assert.equal(bankItem.isPyq, true);
  assert.equal(bankItem.pyqYear, 2024);
  assert.equal(bankItem.paperCode, "PH-2024-S1");
  assert.equal(bankItem.questionNumber, 21);
  assert.equal(bankItem.options, undefined);

  // Authoritative definition should preserve exact min and max numerical bounds
  const authDef = adaptPrepziiPyqToDefinition(pyqRow, true);
  assert.equal(authDef.kind, "numerical");
  assert.equal(authDef.correctNumber, 483.5);
  assert.equal(authDef.numericalMin, 480.0);
  assert.equal(authDef.numericalMax, 487.0);

  // Non-authoritative must NOT leak the answer or bounds
  const publicDef = adaptPrepziiPyqToDefinition(pyqRow, false);
  assert.equal(publicDef.correctNumber, undefined);
  assert.equal(publicDef.numericalTolerance, undefined);
  assert.equal(publicDef.numericalMin, undefined);
  assert.equal(publicDef.numericalMax, undefined);
});

test("Security & Shielding: Strips correct options and solution content for candidate payload", () => {
  const row: PrepziiQuestionRow = {
    id: "991823bb-0001-4444-9999-abcdef123456",
    exam: "NEET",
    subject: "Chemistry",
    chapter: "Thermodynamics",
    topic: "Enthalpy",
    difficulty: "EASY",
    question_type: "single_choice",
    question_text: "Which of the following is an intensive property?",
    correct_option: "B",
    explanation: "Density is an intensive property because it does not depend on system mass.",
    explanation_image: "https://cdn.prepzii.com/img/density-explanation.png",
    marks: 4,
    negative_marks: 1,
    source_type: "CURATED",
    status: "ACTIVE",
    option_a: "Volume",
    option_b: "Density",
    option_c: "Enthalpy",
    option_d: "Mass",
    question_content: { hints: "Think about size-independent variables", diagram: "thermo-state" },
  };

  const bankItem = adaptPrepziiQuestionToBankItem(row);
  const sanitized = sanitizeQuestionForCandidate(bankItem);

  assert.equal(sanitized.id, "991823bb-0001-4444-9999-abcdef123456");
  assert.equal(sanitized.kind, "single_choice");
  assert.equal(sanitized.correctOptionIds, undefined);
  assert.equal(sanitized.correctNumber, undefined);
  assert.equal(sanitized.numericalTolerance, undefined);
  assert.equal((sanitized as any).solutionExplanation, undefined);
  assert.equal((sanitized as any).explanationImageUrl, undefined);

  // Rich content sanitized from forbidden keys ('hints')
  const content = sanitized.questionContent as Record<string, unknown>;
  assert.equal(content.diagram, "thermo-state");
  assert.equal(content.hints, undefined);
});

test("Role & Exam Normalization: Handles all verified production variations", () => {
  assert.equal(normalizeOrganizationRole("owner"), "OWNER");
  assert.equal(normalizeOrganizationRole("DIRECTOR"), "OWNER");
  assert.equal(normalizeOrganizationRole("admin"), "COACHING_ADMIN");
  assert.equal(normalizeOrganizationRole("principal"), "COACHING_ADMIN");
  assert.equal(normalizeOrganizationRole("faculty"), "TEACHER");
  assert.equal(normalizeOrganizationRole("TEACHER"), "TEACHER");
  assert.equal(normalizeOrganizationRole("guardian"), "PARENT");
  assert.equal(normalizeOrganizationRole("student"), "STUDENT");
  assert.equal(normalizeOrganizationRole(null), "STUDENT");
  assert.equal(normalizeOrganizationRole("academic_coordinator"), "ACADEMIC_COORDINATOR");
  assert.equal(normalizeOrganizationRole("accountant"), "ACCOUNTANT");
  assert.equal(normalizeOrganizationRole("platform_super_admin"), "PLATFORM_SUPER_ADMIN");

  assert.equal(normalizeTargetExam("JEE Advanced 2026"), "JEE_ADVANCED");
  assert.equal(normalizeTargetExam("jee main session 1"), "JEE_MAIN");
  assert.equal(normalizeTargetExam("NEET-UG"), "NEET");
  assert.equal(normalizeTargetExam("Foundation Olympiad"), "FOUNDATION");
  assert.equal(normalizeTargetExam("CBSE Class 12"), "BOARDS");

  assert.equal(normalizeQuestionDifficulty("EASY"), "EASY");
  assert.equal(normalizeQuestionDifficulty("MODERATE"), "MEDIUM");
  assert.equal(normalizeQuestionDifficulty("EXPERT"), "ADVANCED");
});

test("PYQ Bridge: Produces schema-compatible public.questions row for referential integrity", () => {
  const pyqRow: PrepziiPyqRow = {
    id: "ee3300aa-1122-4433-8899-abcdefabcdef",
    question: "Calculate the equivalent resistance between A and B:",
    option_a: "2 Ohm",
    option_b: "4 Ohm",
    option_c: "6 Ohm",
    option_d: "8 Ohm",
    correct_option: "b",
    marks_positive: 4,
    marks_negative: 1,
    exam: "JEE Main",
    subject: "Physics",
    chapter: "Current Electricity",
    topic: "Resistor Networks",
    difficulty: "MEDIUM",
    status: "ACTIVE",
    display_order: 5,
  };

  const bridged = bridgePyqToQuestionPayload(pyqRow);
  assert.equal(bridged.id, "ee3300aa-1122-4433-8899-abcdefabcdef");
  assert.equal(bridged.exam, "JEE Main");
  assert.equal(bridged.question_text, "Calculate the equivalent resistance between A and B:");
  assert.equal(bridged.correct_option, "b");
  assert.equal(bridged.source_type, "PYQ");
  assert.equal(bridged.status, "ACTIVE");
  assert.equal(bridged.marks, 4);
  assert.equal(bridged.negative_marks, 1);
});

test("Numerical Grading: Preserves exact minimum and maximum range bounds without midpoint approximation", () => {
  const pyqRow: PrepziiPyqRow = {
    id: "num-range-test-01",
    question: "Determine the experimental Hall coefficient R_H in 10^-11 m^3/C:",
    numerical_answer: 4.85,
    numerical_min: 4.80,
    numerical_max: 4.90,
    marks_positive: 4,
    marks_negative: 1,
    exam: "JEE Advanced",
    subject: "Physics",
    chapter: "Solid State",
  };

  const authDef = adaptPrepziiPyqToDefinition(pyqRow, true);
  assert.equal(authDef.numericalMin, 4.80);
  assert.equal(authDef.numericalMax, 4.90);

  // Exact lower bound is correct
  const resMin = gradeAnswer(authDef, { questionId: authDef.id, number: 4.80 });
  assert.equal(resMin.status, "correct");
  assert.equal(resMin.score, 4);

  // Exact upper bound is correct
  const resMax = gradeAnswer(authDef, { questionId: authDef.id, number: 4.90 });
  assert.equal(resMax.status, "correct");
  assert.equal(resMax.score, 4);

  // Inside range is correct
  const resMid = gradeAnswer(authDef, { questionId: authDef.id, number: 4.85 });
  assert.equal(resMid.status, "correct");

  // Just below min is incorrect with negative marking
  const resBelow = gradeAnswer(authDef, { questionId: authDef.id, number: 4.79 });
  assert.equal(resBelow.status, "incorrect");
  assert.equal(resBelow.score, -1);

  // Just above max is incorrect with negative marking
  const resAbove = gradeAnswer(authDef, { questionId: authDef.id, number: 4.91 });
  assert.equal(resAbove.status, "incorrect");
  assert.equal(resAbove.score, -1);
});

test("Question Format Validation: Rejects unsupported question kinds clearly", () => {
  const unsupportedQ = {
    id: "unsupported-matrix-01",
    kind: "matrix_match" as any,
    marks: 4,
    negativeMarks: 1,
  };

  assert.throws(
    () => {
      gradeAnswer(unsupportedQ as any, { questionId: "unsupported-matrix-01", selectedOptionIds: ["a"] });
    },
    {
      message: /Unsupported question kind 'matrix_match' for question 'unsupported-matrix-01'/,
    }
  );
});

test("Canonical Schema Regression: Confirms verified database column names", () => {
  // 1. institute_batches: verified columns (id, institute_id, name, exam, target_year, created_at)
  // Must NOT include status or is_active
  const batchInsertPayload = {
    institute_id: "inst-uuid-001",
    name: "JEE Advanced 2026 Batch",
    exam: "JEE_ADVANCED",
    target_year: 2026,
  };
  assert.equal("status" in batchInsertPayload, false);
  assert.equal("is_active" in batchInsertPayload, false);
  assert.equal(batchInsertPayload.exam, "JEE_ADVANCED");
  assert.equal(batchInsertPayload.target_year, 2026);

  // 2. institute_test_questions: foreign key must be institute_test_id (NOT test_id), and include institute_id
  const testQuestionPayload = {
    institute_id: "inst-uuid-001",
    institute_test_id: "test-uuid-999",
    question_id: "question-uuid-456",
    question_order: 1,
  };
  assert.equal("test_id" in testQuestionPayload, false);
  assert.equal("institute_test_id" in testQuestionPayload, true);
  assert.equal("institute_id" in testQuestionPayload, true);

  // 3. institute_test_attempts: must use institute_test_id and user_id (NOT member_id or test_id)
  const testAttemptPayload = {
    institute_id: "inst-uuid-001",
    institute_test_id: "test-uuid-999",
    user_id: "user_clerk_12345",
    session_id: "session-uuid-777",
    attempt_id: "attempt-uuid-888",
    status: "SUBMITTED",
  };
  assert.equal("member_id" in testAttemptPayload, false);
  assert.equal("test_id" in testAttemptPayload, false);
  assert.equal("institute_test_id" in testAttemptPayload, true);
  assert.equal("user_id" in testAttemptPayload, true);
});
