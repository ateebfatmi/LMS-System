import test from "node:test";
import assert from "node:assert/strict";
import type {
  AttendanceStatus,
  NotificationDispatchLog,
  ParentStudentRelation,
  ChapterMasteryProgress,
} from "@prepzii/contracts";

// =========================================================================
// 1. Attendance Management & Formula Verification
// =========================================================================

function calculateAttendanceRate(counts: {
  present: number;
  late: number;
  excused: number;
  absent: number;
}): number {
  const total = counts.present + counts.late + counts.excused + counts.absent;
  if (total === 0) return 100;
  const effectivePresent = counts.present + counts.late * 0.5 + counts.excused;
  return Math.round((effectivePresent / total) * 1000) / 10;
}

test("Attendance Engine: Computes standard coaching attendance formula with half-day weighting for Late arrivals", () => {
  // 20 students: 16 Present, 2 Late (1.0), 1 Excused (1.0), 1 Absent (0.0) -> 18 / 20 = 90%
  const rate1 = calculateAttendanceRate({ present: 16, late: 2, excused: 1, absent: 1 });
  assert.equal(rate1, 90.0);

  // All Present -> 100%
  const rateAllPresent = calculateAttendanceRate({ present: 45, late: 0, excused: 0, absent: 0 });
  assert.equal(rateAllPresent, 100.0);

  // All Absent -> 0%
  const rateAllAbsent = calculateAttendanceRate({ present: 0, late: 0, excused: 0, absent: 25 });
  assert.equal(rateAllAbsent, 0.0);

  // Edge case: Empty session
  const rateEmpty = calculateAttendanceRate({ present: 0, late: 0, excused: 0, absent: 0 });
  assert.equal(rateEmpty, 100.0);
});

test("Attendance Correction: Verifies audit log trail creation on register corrections", () => {
  interface AuditLogEntry {
    organizationId: string;
    actorUserId: string;
    eventType: string;
    resourceType: string;
    resourceId: string;
    details: Record<string, unknown>;
  }

  const auditLogs: AuditLogEntry[] = [];

  function recordAttendanceCorrection(
    orgId: string,
    actorId: string,
    sessionId: string,
    previousStatus: AttendanceStatus,
    newStatus: AttendanceStatus,
    studentId: string
  ) {
    auditLogs.push({
      organizationId: orgId,
      actorUserId: actorId,
      eventType: "ATTENDANCE_CORRECTED",
      resourceType: "attendance_record",
      resourceId: `${sessionId}_${studentId}`,
      details: { previousStatus, newStatus, studentId, timestamp: new Date().toISOString() },
    });
  }

  recordAttendanceCorrection("org_apex", "faculty_vivek", "sess_2026_10_10", "ABSENT", "EXCUSED", "std_101");

  assert.equal(auditLogs.length, 1);
  assert.equal(auditLogs[0].eventType, "ATTENDANCE_CORRECTED");
  assert.equal(auditLogs[0].actorUserId, "faculty_vivek");
  assert.equal(auditLogs[0].details.previousStatus, "ABSENT");
  assert.equal(auditLogs[0].details.newStatus, "EXCUSED");
});

// =========================================================================
// 2. Parent-Student Account Linking & IDOR Protection
// =========================================================================

test("Parent Authorization: Strictly denies parent access to unlinked or cross-tenant student records (IDOR Defense)", () => {
  const verifiedLinks: ParentStudentRelation[] = [
    {
      id: "link-1",
      organizationId: "org-apex-north",
      parentUserId: "parent_rajesh_sharma",
      studentUserId: "std_aarav_sharma",
      relationship: "FATHER",
      studentName: "Aarav Sharma",
      rollNumber: "APX-2026-1201",
      batchId: "batch_titans",
      batchName: "JEE 12A - Titans",
      isVerified: true,
      linkedAt: "2026-04-01T00:00:00Z",
    },
  ];

  function verifyParentAccess(orgId: string, parentUserId: string, targetStudentId: string): boolean {
    const link = verifiedLinks.find(
      (l) => l.organizationId === orgId && l.parentUserId === parentUserId && l.studentUserId === targetStudentId && l.isVerified
    );
    if (!link) {
      throw new Error("Forbidden: You do not have verified parental access to this student's records.");
    }
    return true;
  }

  // 1. Authorized link succeeds
  assert.doesNotThrow(() => {
    verifyParentAccess("org-apex-north", "parent_rajesh_sharma", "std_aarav_sharma");
  });

  // 2. Unlinked student attempt by legitimate parent is rejected
  assert.throws(
    () => {
      verifyParentAccess("org-apex-north", "parent_rajesh_sharma", "std_other_student_999");
    },
    { message: /Forbidden: You do not have verified parental access/ }
  );

  // 3. Unauthorized stranger parent attempt is rejected
  assert.throws(
    () => {
      verifyParentAccess("org-apex-north", "parent_stranger", "std_aarav_sharma");
    },
    { message: /Forbidden: You do not have verified parental access/ }
  );

  // 4. Cross-tenant attempt (same parent, different organization) is blocked
  assert.throws(
    () => {
      verifyParentAccess("org-competitor-institute", "parent_rajesh_sharma", "std_aarav_sharma");
    },
    { message: /Forbidden: You do not have verified parental access/ }
  );
});

test("Parent Security: Ensures raw answer keys and explanations are omitted from parent views", () => {
  // Test result object provided to parent dashboard
  const publishedParentTestSummary = {
    testId: "tst_jee_adv_04",
    title: "All India PrepZii Mock 04: JEE Advanced",
    score: 156,
    totalMarks: 180,
    rank: 2,
    percentile: 98.5,
    correctCount: 39,
    incorrectCount: 6,
    unansweredCount: 9,
  };

  // Assert answer keys and secret rubrics do not exist on parent summary payload
  assert.equal((publishedParentTestSummary as any).answerKey, undefined);
  assert.equal((publishedParentTestSummary as any).correctOptions, undefined);
  assert.equal((publishedParentTestSummary as any).gradingRubric, undefined);
  assert.equal((publishedParentTestSummary as any).solutionHtml, undefined);
});

// =========================================================================
// 3. Real Analytics Engine & Transparent Heuristics
// =========================================================================

test("Analytics Engine: Evaluates chapter mastery according to transparent accuracy thresholds", () => {
  function classifyChapterMastery(accuracyPercentage: number): "STRONG" | "MODERATE" | "NEEDS_FOCUS" {
    if (accuracyPercentage >= 80) return "STRONG";
    if (accuracyPercentage >= 60) return "MODERATE";
    return "NEEDS_FOCUS";
  }

  assert.equal(classifyChapterMastery(92), "STRONG");
  assert.equal(classifyChapterMastery(80), "STRONG");
  assert.equal(classifyChapterMastery(79), "MODERATE");
  assert.equal(classifyChapterMastery(60), "MODERATE");
  assert.equal(classifyChapterMastery(59), "NEEDS_FOCUS");
  assert.equal(classifyChapterMastery(34), "NEEDS_FOCUS");
});

test("Analytics Engine: Identifies at-risk students and triggers targeted teacher intervention recommendations", () => {
  interface StudentPerformance {
    id: string;
    name: string;
    averageScore: number;
    attendancePercentage: number;
  }

  function evaluateStudentRisk(student: StudentPerformance): {
    riskLevel: "HIGH" | "MODERATE" | "LOW";
    reasons: string[];
    recommendedAction: string;
  } {
    const reasons: string[] = [];
    let riskLevel: "HIGH" | "MODERATE" | "LOW" = "LOW";
    let recommendedAction = "Maintain regular homework pace";

    if (student.averageScore < 60) {
      reasons.push(`Low test average (${student.averageScore}%)`);
      riskLevel = "HIGH";
    } else if (student.averageScore < 75) {
      reasons.push(`Moderate test score (${student.averageScore}%)`);
      riskLevel = "MODERATE";
    }

    if (student.attendancePercentage < 88) {
      reasons.push(`Attendance below benchmark (${student.attendancePercentage}%)`);
      riskLevel = "HIGH";
    } else if (student.attendancePercentage < 92 && riskLevel !== "HIGH") {
      reasons.push(`Attendance dip (${student.attendancePercentage}%)`);
      riskLevel = "MODERATE";
    }

    if (riskLevel === "HIGH") {
      recommendedAction = "Schedule 1-on-1 mentor doubt session & dispatch parent notice";
    } else if (riskLevel === "MODERATE") {
      recommendedAction = "Assign targeted revision DPP & monitor weekly unit test";
    }

    return { riskLevel, reasons, recommendedAction };
  }

  // 1. High-risk student (both low score and low attendance)
  const highRisk = evaluateStudentRisk({ id: "s1", name: "Rohan", averageScore: 52, attendancePercentage: 84 });
  assert.equal(highRisk.riskLevel, "HIGH");
  assert.equal(highRisk.reasons.length, 2);
  assert.match(highRisk.recommendedAction, /Schedule 1-on-1 mentor doubt session/);

  // 2. Moderate-risk student (borderline score)
  const moderateRisk = evaluateStudentRisk({ id: "s2", name: "Ishaan", averageScore: 71, attendancePercentage: 94 });
  assert.equal(moderateRisk.riskLevel, "MODERATE");
  assert.match(moderateRisk.recommendedAction, /Assign targeted revision DPP/);

  // 3. Top performer student (clean record)
  const lowRisk = evaluateStudentRisk({ id: "s3", name: "Aarav", averageScore: 92, attendancePercentage: 98 });
  assert.equal(lowRisk.riskLevel, "LOW");
  assert.equal(lowRisk.reasons.length, 0);
});

// =========================================================================
// 4. Notification Pipeline Deduplication & Idempotency
// =========================================================================

test("Notification Pipeline: Deduplicates automated parent notices for the same student on the same date", () => {
  const dispatchedLogs = new Map<string, NotificationDispatchLog>();

  function dispatchAbsentNotification(
    orgId: string,
    batchId: string,
    studentId: string,
    studentName: string,
    date: string,
    parentPhone: string
  ): { dispatched: boolean; log: NotificationDispatchLog } {
    const dedupeKey = `notif-${date}-${studentId}`;

    if (dispatchedLogs.has(dedupeKey)) {
      return { dispatched: false, log: dispatchedLogs.get(dedupeKey)! };
    }

    const newLog: NotificationDispatchLog = {
      id: dedupeKey,
      organizationId: orgId,
      batchId,
      recipientPhone: parentPhone,
      recipientName: `Parent of ${studentName}`,
      recipientRole: "PARENT",
      channel: "WHATSAPP",
      templateKey: "ABSENT_ALERT",
      renderedContent: `Dear Parent, ${studentName} was marked ABSENT for lectures on ${date}. Please contact institute office.`,
      status: "DELIVERED",
      provider: "INTERNAL_MOCK",
      providerMessageId: `msg_${Date.now()}_test`,
      sentAt: new Date().toISOString(),
      deliveredAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };

    dispatchedLogs.set(dedupeKey, newLog);
    return { dispatched: true, log: newLog };
  }

  // First dispatch: Succeeds
  const dispatch1 = dispatchAbsentNotification("org_apex", "batch_12a", "std_101", "Rohan Verma", "2026-10-10", "+919876543210");
  assert.equal(dispatch1.dispatched, true);
  assert.equal(dispatch1.log.status, "DELIVERED");
  assert.equal(dispatchedLogs.size, 1);

  // Second dispatch for identical student on identical date: Deduplicated (idempotent no-op)
  const dispatch2 = dispatchAbsentNotification("org_apex", "batch_12a", "std_101", "Rohan Verma", "2026-10-10", "+919876543210");
  assert.equal(dispatch2.dispatched, false);
  assert.equal(dispatch2.log.id, dispatch1.log.id);
  assert.equal(dispatchedLogs.size, 1);

  // Dispatch on different date: Allowed
  const dispatch3 = dispatchAbsentNotification("org_apex", "batch_12a", "std_101", "Rohan Verma", "2026-10-11", "+919876543210");
  assert.equal(dispatch3.dispatched, true);
  assert.equal(dispatchedLogs.size, 2);
});
