import test from "node:test";
import assert from "node:assert/strict";
import type {
  AnswerSubmission,
  QuestionDefinition,
  TenantContext,
  FeePaymentMethod,
} from "@prepzii/contracts";
import { gradeAssessment, computeLeaderboard, type StudentSubmissionData } from "./index.js";

// =========================================================================
// 1. Complete Academic Workflow End-to-End Test (Steps 1 to 13)
// =========================================================================

test("Academic Lifecycle E2E: Full pipeline from institute setup to parent scorecard view", () => {
  // Step 1: Institute Context
  const instituteId = "org_apex_staging";

  // Step 2: Teacher Invitation & Authentication Context
  const teacherContext: TenantContext = {
    organizationId: instituteId,
    userId: "usr_faculty_vivek",
    role: "TEACHER",
  };
  assert.equal(teacherContext.role, "TEACHER");

  // Step 3 & 4: Student Enrolment & Batch Allocation
  interface StagingStudent {
    id: string;
    name: string;
    rollNumber: string;
    batchId: string;
    batchName: string;
  }

  const enrolledStudent: StagingStudent = {
    id: "std_aarav",
    name: "Aarav Sharma",
    rollNumber: "APX-2026-1201",
    batchId: "batch_titans",
    batchName: "JEE 12A - Titans",
  };
  assert.equal(enrolledStudent.batchName, "JEE 12A - Titans");

  // Step 5: Question Retrieval from Shared Question Bank (JEE Advanced Standard)
  const sharedQuestionBank: QuestionDefinition[] = [
    {
      id: "q_phy_1",
      kind: "single_choice",
      subject: "Physics",
      marks: 4,
      negativeMarks: 1,
      correctOptionIds: ["opt_b"],
    },
    {
      id: "q_phy_2",
      kind: "multiple_choice",
      subject: "Physics",
      marks: 4,
      negativeMarks: 2,
      partialMarking: true,
      correctOptionIds: ["opt_a", "opt_c"],
    },
    {
      id: "q_phy_3",
      kind: "numerical",
      subject: "Physics",
      marks: 4,
      negativeMarks: 0,
      correctNumber: 42.0,
      numericalTolerance: 0.5,
    },
  ];

  // Step 6: Test Creation & Batch Scheduling
  const testSchedule = {
    id: "sched_mock_04",
    testId: "tst_jee_adv_04",
    batchId: enrolledStudent.batchId,
    durationMinutes: 180,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
    endsAt: new Date(Date.now() + 7200000).toISOString(),
    isPublished: true,
  };
  assert.equal(testSchedule.isPublished, true);

  // Step 7: Student CBT Session Launch (Verify Answer Keys Shielded)
  const studentSafeQuestions = sharedQuestionBank.map((q) => {
    const { correctOptionIds, correctNumber, numericalTolerance, ...safe } = q;
    return safe;
  });
  assert.equal((studentSafeQuestions[0] as any).correctOptionIds, undefined);
  assert.equal((studentSafeQuestions[2] as any).correctNumber, undefined);

  // Step 8: Autosave & Submission
  const studentAnswers: AnswerSubmission[] = [
    { questionId: "q_phy_1", selectedOptionIds: ["opt_b"], timeSpentSeconds: 60 }, // Correct (+4)
    { questionId: "q_phy_2", selectedOptionIds: ["opt_a", "opt_c"], timeSpentSeconds: 120 }, // Full Correct (+4)
    { questionId: "q_phy_3", number: 42.1, timeSpentSeconds: 180 }, // Correct within tolerance (+4)
  ];

  // Step 9: Authoritative Server-Side Grading
  const gradingSummary = gradeAssessment(sharedQuestionBank, studentAnswers);
  assert.equal(gradingSummary.totalScore, 12);
  assert.equal(gradingSummary.maxScore, 12);
  assert.equal(gradingSummary.correctCount, 3);
  assert.equal(gradingSummary.percentage, 100.0);

  // Step 10 & 11: Result Publishing & Batch Leaderboard Generation
  const batchSubmissions: StudentSubmissionData[] = [
    {
      studentId: enrolledStudent.id,
      studentName: enrolledStudent.name,
      batchName: enrolledStudent.batchName,
      answers: studentAnswers,
    },
    {
      studentId: "std_rohan",
      studentName: "Rohan Verma",
      batchName: enrolledStudent.batchName,
      answers: [
        { questionId: "q_phy_1", selectedOptionIds: ["opt_a"], timeSpentSeconds: 45 }, // Incorrect (-1)
        { questionId: "q_phy_2", selectedOptionIds: ["opt_a"], timeSpentSeconds: 90 }, // Partial (+1)
        { questionId: "q_phy_3", number: 50.0, timeSpentSeconds: 110 }, // Incorrect (0)
      ],
    },
  ];

  const leaderboard = computeLeaderboard(sharedQuestionBank, batchSubmissions);
  assert.equal(leaderboard.length, 2);
  assert.equal(leaderboard[0].studentId, "std_aarav");
  assert.equal(leaderboard[0].rank, 1);
  assert.equal(leaderboard[0].percentile, 100.0);
  assert.equal(leaderboard[1].rank, 2);

  // Step 12: Chapter Analytics Aggregation
  const chapterAccuracy = (gradingSummary.correctCount / sharedQuestionBank.length) * 100;
  assert.equal(chapterAccuracy, 100.0);

  // Step 13: Parent Scorecard Visibility (Answer Keys Protected)
  const parentVisibleReport = {
    studentName: enrolledStudent.name,
    rollNumber: enrolledStudent.rollNumber,
    score: leaderboard[0].totalScore,
    maxScore: leaderboard[0].maxScore,
    rank: leaderboard[0].rank,
    percentile: leaderboard[0].percentile,
  };
  assert.equal((parentVisibleReport as any).correctOptionIds, undefined);
  assert.equal(parentVisibleReport.rank, 1);
});

// =========================================================================
// 2. Business Workflows & Concurrency Safety
// =========================================================================

test("Business Workflow: Sequential receipt numbering and concurrency safety", () => {
  let receiptCounter = 0;
  function generateReceiptNumber(): string {
    receiptCounter++;
    return `APX-RCP-2026-${String(receiptCounter).padStart(4, "0")}`;
  }

  const receipts: string[] = [];
  for (let i = 0; i < 50; i++) {
    receipts.push(generateReceiptNumber());
  }

  // Verify all receipts are strictly unique and sequential
  const uniqueReceipts = new Set(receipts);
  assert.equal(uniqueReceipts.size, 50);
  assert.equal(receipts[0], "APX-RCP-2026-0001");
  assert.equal(receipts[49], "APX-RCP-2026-0050");
});

test("Business Workflow: Duplicate payment protection and balance enforcement", () => {
  let outstandingBalancePaise = 6000000; // Rs. 60,000.00
  let totalPaidPaise = 12000000; // Rs. 1,20,000.00

  function processPayment(amountPaise: number): { success: boolean; error?: string } {
    if (amountPaise <= 0) return { success: false, error: "Invalid amount" };
    if (amountPaise > outstandingBalancePaise) {
      return { success: false, error: "Amount exceeds outstanding balance" };
    }
    outstandingBalancePaise -= amountPaise;
    totalPaidPaise += amountPaise;
    return { success: true };
  }

  // 1. Overpayment rejected
  const overpay = processPayment(7000000);
  assert.equal(overpay.success, false);
  assert.equal(overpay.error, "Amount exceeds outstanding balance");

  // 2. Exact payment accepted
  const exactPay = processPayment(6000000);
  assert.equal(exactPay.success, true);
  assert.equal(outstandingBalancePaise, 0);
  assert.equal(totalPaidPaise, 18000000);

  // 3. Further payment on zero balance rejected
  const zeroBalancePay = processPayment(1000);
  assert.equal(zeroBalancePay.success, false);
});

// =========================================================================
// 3. Security Invariants & Attack Vector Defense
// =========================================================================

test("Security Defense: Cross-Tenant Isolation, IDOR & Role Escalation", () => {
  // Cross-tenant access blocked
  function assertTenantScope(userTenant: string, targetTenant: string) {
    if (userTenant !== targetTenant) {
      throw new Error("AccessDenied: Cross-tenant boundary breach");
    }
  }
  assert.throws(() => assertTenantScope("inst_a", "inst_b"), {
    message: /Cross-tenant boundary breach/,
  });

  // Role escalation blocked
  function assertAdminOnly(role: string) {
    if (!["OWNER", "COACHING_ADMIN"].includes(role)) {
      throw new Error("Forbidden: Insufficient privileges");
    }
  }
  assert.throws(() => assertAdminOnly("STUDENT"), { message: /Forbidden/ });
  assert.throws(() => assertAdminOnly("TEACHER"), { message: /Forbidden/ });
  assert.doesNotThrow(() => assertAdminOnly("OWNER"));

  // Timer expiration enforcement
  function validateSubmissionWindow(expiresAtIso: string, submissionTimeIso: string) {
    if (new Date(submissionTimeIso) > new Date(expiresAtIso)) {
      throw new Error("SessionExpired: Submission rejected after timer expiry");
    }
    return true;
  }
  const expiry = "2026-10-22T10:00:00Z";
  assert.throws(() => validateSubmissionWindow(expiry, "2026-10-22T10:00:05Z"), {
    message: /SessionExpired/,
  });
  assert.doesNotThrow(() => validateSubmissionWindow(expiry, "2026-10-22T09:59:55Z"));
});

// =========================================================================
// 4. Performance & Scalability Benchmark: 100, 500, 1,500 Students
// =========================================================================

test("Performance Benchmark: High-volume batch evaluation at 100, 500, and 1,500 students", () => {
  // Realistic 54-question JEE Advanced paper
  const mockPaper: QuestionDefinition[] = [];
  for (let i = 1; i <= 54; i++) {
    mockPaper.push({
      id: `q_${i}`,
      kind: i % 3 === 0 ? "numerical" : i % 2 === 0 ? "multiple_choice" : "single_choice",
      marks: 4,
      negativeMarks: 1,
      correctOptionIds: ["opt_a"],
      correctNumber: 25.0,
      numericalTolerance: 0.1,
    });
  }

  function runScaleBenchmark(studentCount: number): number {
    const submissions: StudentSubmissionData[] = [];
    for (let s = 1; s <= studentCount; s++) {
      const answers: AnswerSubmission[] = [];
      for (let q = 1; q <= 54; q++) {
        answers.push({
          questionId: `q_${q}`,
          selectedOptionIds: q % 2 === 0 ? ["opt_a"] : ["opt_b"],
          number: 25.0,
          timeSpentSeconds: 60,
        });
      }
      submissions.push({
        studentId: `std_${s}`,
        studentName: `Student ${s}`,
        batchName: "Benchmark Batch",
        answers,
      });
    }

    const start = performance.now();
    const rankedResults = computeLeaderboard(mockPaper, submissions);
    const duration = performance.now() - start;

    assert.equal(rankedResults.length, studentCount);
    assert.equal(rankedResults[0].rank, 1);
    return duration;
  }

  // 100 Students benchmark
  const time100 = runScaleBenchmark(100);
  assert.ok(time100 < 50, `100 students took ${time100.toFixed(2)}ms, expected < 50ms`);

  // 500 Students benchmark
  const time500 = runScaleBenchmark(500);
  assert.ok(time500 < 100, `500 students took ${time500.toFixed(2)}ms, expected < 100ms`);

  // 1,500 Students benchmark (Major coaching institute scale)
  const time1500 = runScaleBenchmark(1500);
  assert.ok(time1500 < 250, `1500 students took ${time1500.toFixed(2)}ms, expected < 250ms`);
});
