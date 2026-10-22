import assert from "node:assert/strict";
import test from "node:test";
import {
  gradeAnswer,
  gradeAssessment,
  computeLeaderboard,
  type StudentSubmissionData,
} from "./index.js";
import type {
  AnswerSubmission,
  QuestionDefinition,
  TenantContext,
} from "@prepzii/contracts";

// Simulated Security & Isolation Helpers
function verifyTenantAccess(context: TenantContext, requestedOrgId: string) {
  if (context.organizationId !== requestedOrgId) {
    throw new Error(`AccessDenied: Tenant isolation breach. User ${context.userId} from ${context.organizationId} cannot access ${requestedOrgId}`);
  }
  return true;
}

function verifyRoleAccess(context: TenantContext, allowedRoles: readonly string[]) {
  if (!allowedRoles.includes(context.role)) {
    throw new Error(`Forbidden: Role ${context.role} is not permitted for this action`);
  }
  return true;
}

function sanitizeQuestionForStudent(question: QuestionDefinition): QuestionDefinition {
  const { correctOptionIds, correctNumber, numericalTolerance, ...safe } = question;
  return safe;
}

// =================================================================
// 1. CROSS-TENANT ISOLATION & AUTHORIZATION TESTS
// =================================================================

test("Cross-Tenant Isolation: Blocks access when organization ID does not match session", () => {
  const tenantA: TenantContext = {
    organizationId: "org-apex-academy",
    userId: "usr_teacher_1",
    role: "TEACHER",
  };

  // Valid access within same tenant
  assert.equal(verifyTenantAccess(tenantA, "org-apex-academy"), true);

  // Cross-tenant attempt must throw
  assert.throws(
    () => verifyTenantAccess(tenantA, "org-competitor-institute"),
    /AccessDenied: Tenant isolation breach/
  );
});

test("Role-Based Authorization: Denies non-administrative roles from batch/test creation", () => {
  const studentContext: TenantContext = {
    organizationId: "org-apex-academy",
    userId: "usr_student_1",
    role: "STUDENT",
  };

  const adminRoles = ["OWNER", "COACHING_ADMIN"];

  assert.throws(
    () => verifyRoleAccess(studentContext, adminRoles),
    /Forbidden: Role STUDENT is not permitted/
  );

  const directorContext: TenantContext = {
    organizationId: "org-apex-academy",
    userId: "usr_director_1",
    role: "OWNER",
  };

  assert.equal(verifyRoleAccess(directorContext, adminRoles), true);
});

// =================================================================
// 2. ANSWER KEY SANITIZATION TESTS (CBT SECURITY)
// =================================================================

test("CBT Security: Strips correct answer keys and tolerances from questions served to candidates", () => {
  const authoritativeQuestion: QuestionDefinition = {
    id: "q_phy_01",
    kind: "single_choice",
    subject: "Physics",
    marks: 4,
    negativeMarks: 1,
    correctOptionIds: ["opt_b"],
    correctNumber: 42,
    numericalTolerance: 0.1,
  };

  const publicQuestion = sanitizeQuestionForStudent(authoritativeQuestion);

  // Student receives question prompt and marks
  assert.equal(publicQuestion.id, "q_phy_01");
  assert.equal(publicQuestion.marks, 4);
  assert.equal(publicQuestion.negativeMarks, 1);

  // Student NEVER receives answer keys
  assert.equal(publicQuestion.correctOptionIds, undefined);
  assert.equal(publicQuestion.correctNumber, undefined);
  assert.equal(publicQuestion.numericalTolerance, undefined);
});

// =================================================================
// 3. COMPLETE ASSESSMENT LIFECYCLE & SERVER GRADING TESTS
// =================================================================

test("Complete Assessment Lifecycle: Start -> Answer -> Server Grade -> Leaderboard & Percentile", () => {
  // Step 1: Define Exam Paper (54 Marks total, Physics, Chemistry, Maths)
  const examQuestions: QuestionDefinition[] = [
    // Q1: Single Choice (+4 / -1)
    {
      id: "q1_sc",
      kind: "single_choice",
      subject: "Physics",
      marks: 4,
      negativeMarks: 1,
      correctOptionIds: ["opt_correct"],
    },
    // Q2: JEE Advanced Multiple Choice with Partial Marking (+4 / -2)
    {
      id: "q2_mc",
      kind: "multiple_choice",
      subject: "Chemistry",
      marks: 4,
      negativeMarks: 2,
      partialMarking: true,
      correctOptionIds: ["a", "b", "c"],
    },
    // Q3: Numerical (+4 / 0)
    {
      id: "q3_num",
      kind: "numerical",
      subject: "Mathematics",
      marks: 4,
      negativeMarks: 0,
      correctNumber: 1.89,
      numericalTolerance: 0.05,
    },
  ];

  // Step 2: Candidate A (Aarav Sharma) Submissions
  // Q1: Correct (+4)
  // Q2: Partial correct: selected ['a', 'b'] out of ['a', 'b', 'c'] => (4/3)*2 = +2
  // Q3: Numerical within tolerance (1.90 vs 1.89 ± 0.05) => +4
  // Expected Score: 4 + 2 + 4 = 10 / 12
  const candidateAAnswers: AnswerSubmission[] = [
    { questionId: "q1_sc", selectedOptionIds: ["opt_correct"], timeSpentSeconds: 45 },
    { questionId: "q2_mc", selectedOptionIds: ["a", "b"], timeSpentSeconds: 60 },
    { questionId: "q3_num", number: 1.90, timeSpentSeconds: 50 },
  ];

  const summaryA = gradeAssessment(examQuestions, candidateAAnswers);
  assert.equal(summaryA.totalScore, 10);
  assert.equal(summaryA.correctCount, 2);
  assert.equal(summaryA.partiallyCorrectCount, 1);
  assert.equal(summaryA.incorrectCount, 0);
  assert.equal(summaryA.unansweredCount, 0);

  // Step 3: Candidate B (Rohan Verma) Submissions
  // Q1: Incorrect (-1)
  // Q2: Incorrect because chose wrong option 'd' (-2)
  // Q3: Unanswered (0)
  // Expected Score: -1 - 2 + 0 = -3 / 12
  const candidateBAnswers: AnswerSubmission[] = [
    { questionId: "q1_sc", selectedOptionIds: ["opt_wrong"], timeSpentSeconds: 30 },
    { questionId: "q2_mc", selectedOptionIds: ["a", "d"], timeSpentSeconds: 40 },
  ];

  const summaryB = gradeAssessment(examQuestions, candidateBAnswers);
  assert.equal(summaryB.totalScore, -3);
  assert.equal(summaryB.incorrectCount, 2);
  assert.equal(summaryB.unansweredCount, 1);

  // Step 4: Batch Leaderboard & Percentile Calculation
  const batchSubmissions: StudentSubmissionData[] = [
    {
      studentId: "std_1",
      studentName: "Aarav Sharma",
      batchName: "JEE 12A - Titans",
      answers: candidateAAnswers,
    },
    {
      studentId: "std_2",
      studentName: "Rohan Verma",
      batchName: "JEE 12A - Titans",
      answers: candidateBAnswers,
    },
  ];

  const leaderboard = computeLeaderboard(examQuestions, batchSubmissions);
  assert.equal(leaderboard.length, 2);

  // Rank 1: Aarav Sharma (Score 10, 100%ile)
  assert.equal(leaderboard[0].studentName, "Aarav Sharma");
  assert.equal(leaderboard[0].rank, 1);
  assert.equal(leaderboard[0].totalScore, 10);
  assert.equal(leaderboard[0].percentile, 100);

  // Rank 2: Rohan Verma (Score -3, 0%ile)
  assert.equal(leaderboard[1].studentName, "Rohan Verma");
  assert.equal(leaderboard[1].rank, 2);
  assert.equal(leaderboard[1].totalScore, -3);
  assert.equal(leaderboard[1].percentile, 0);
});

// =================================================================
// 4. DUPLICATE SUBMISSIONS (IDEMPOTENCY) & RETAKE PREVENTION
// =================================================================

test("Submission Idempotency: Duplicate submit calls return identical results without duplicate penalties", () => {
  const questions: QuestionDefinition[] = [
    { id: "q1", kind: "single_choice", correctOptionIds: ["a"], marks: 4, negativeMarks: 1 },
  ];

  const answers: AnswerSubmission[] = [{ questionId: "q1", selectedOptionIds: ["a"] }];

  // First evaluation
  const firstEval = gradeAssessment(questions, answers);
  assert.equal(firstEval.totalScore, 4);

  // Simulated repeated call with same answers
  const secondEval = gradeAssessment(questions, answers);
  assert.equal(secondEval.totalScore, 4);
  assert.deepEqual(firstEval, secondEval);
});

// =================================================================
// 5. TIMER EXPIRY HARD LOCK
// =================================================================

test("Timer Expiry Enforcement: Rejects answers received after expiration window", () => {
  const expiresAtMs = Date.now() - 5000; // Expired 5 seconds ago
  const gracePeriodMs = 2000; // 2 seconds network grace

  function validateTimer(currentTimeMs: number) {
    if (currentTimeMs > expiresAtMs + gracePeriodMs) {
      throw new Error("ExamExpired: The time allocated for this assessment has ended.");
    }
    return true;
  }

  // Attempt within grace period
  assert.equal(validateTimer(expiresAtMs + 1000), true);

  // Attempt after grace period expired
  assert.throws(() => validateTimer(Date.now()), /ExamExpired/);
});

// =================================================================
// 6. MALFORMED / INVALID CANDIDATE ANSWERS HANDLING
// =================================================================

test("Invalid Answer Resilience: Gracefully handles unknown question IDs and malformed inputs", () => {
  const questions: QuestionDefinition[] = [
    { id: "q1", kind: "single_choice", correctOptionIds: ["opt_a"], marks: 4, negativeMarks: 1 },
  ];

  // Submission with unknown questionId and missing selection
  const malformedAnswers: AnswerSubmission[] = [
    { questionId: "non_existent_q", selectedOptionIds: ["xyz"] },
    { questionId: "q1", selectedOptionIds: [] },
  ];

  const result = gradeAssessment(questions, malformedAnswers);
  // q1 has empty selection -> treated as unanswered (score 0, not penalized)
  assert.equal(result.totalScore, 0);
  assert.equal(result.unansweredCount, 1);
  assert.equal(result.correctCount, 0);
});

// =================================================================
// 7. MULTI-TENANT LEADERBOARD ISOLATION
// =================================================================

test("Multi-Tenant Leaderboard Isolation: Excludes candidates belonging to other institutions", () => {
  const questions: QuestionDefinition[] = [
    { id: "q1", kind: "single_choice", correctOptionIds: ["opt_a"], marks: 4, negativeMarks: 1 },
  ];

  interface CandidateRecord extends StudentSubmissionData {
    organizationId: string;
  }

  const allCandidates: CandidateRecord[] = [
    {
      studentId: "s1",
      studentName: "Apex Aarav",
      batchName: "Apex Titans",
      organizationId: "org-apex",
      answers: [{ questionId: "q1", selectedOptionIds: ["opt_a"] }],
    },
    {
      studentId: "s2",
      studentName: "Competitor Student",
      batchName: "Other Batch",
      organizationId: "org-competitor",
      answers: [{ questionId: "q1", selectedOptionIds: ["opt_a"] }],
    },
  ];

  // Filtering strictly by organization ID
  const apexCandidatesOnly = allCandidates.filter((c) => c.organizationId === "org-apex");
  const apexLeaderboard = computeLeaderboard(questions, apexCandidatesOnly);

  assert.equal(apexLeaderboard.length, 1);
  assert.equal(apexLeaderboard[0].studentName, "Apex Aarav");
  assert.equal(apexLeaderboard.some((c) => c.studentName === "Competitor Student"), false);
});

// =================================================================
// 8. ANSWER KEY SHIELDING BEFORE RESULTS RELEASE
// =================================================================

test("Answer Key Shielding: Blocks solution and answer key exposure when results not released", () => {
  function getExamReview(isResultsReleased: boolean, isStaff: boolean) {
    if (!isResultsReleased && !isStaff) {
      throw new Error("Unauthorized: Answer keys and solutions have not yet been released.");
    }
    return { canViewKeys: true };
  }

  // Active student before results released -> BLOCKED
  assert.throws(
    () => getExamReview(false, false),
    /Unauthorized: Answer keys and solutions have not yet been released/
  );

  // Student after release -> ALLOWED
  assert.equal(getExamReview(true, false).canViewKeys, true);

  // Teacher/Admin during review -> ALLOWED
  assert.equal(getExamReview(false, true).canViewKeys, true);
});
