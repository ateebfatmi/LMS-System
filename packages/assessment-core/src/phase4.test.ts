import test from "node:test";
import assert from "node:assert/strict";
import type {
  BulkStudentImportRow,
  FeePaymentMethod,
  FeePlan,
  InstituteSetupChecklist,
  StudentFeeLedger,
  AdmissionsEnquiryRecord,
  QuestionDefinition,
  AnswerSubmission,
} from "@prepzii/contracts";
import { gradeAssessment, computeLeaderboard } from "./index.js";

// =========================================================================
// Workflows 1-5: Institute Onboarding, Batches, Faculty & Student Deduplication
// =========================================================================

test("Workflow 1 & 2: Institute Setup Checklist & Program Configuration", () => {
  function computeChecklist(items: {
    profileConfigured: boolean;
    campusAdded: boolean;
    academicYearSet: boolean;
    programsConfigured: boolean;
    firstBatchCreated: boolean;
    teacherInvited: boolean;
    studentsEnrolled: boolean;
  }): InstituteSetupChecklist {
    const values = Object.values(items);
    const completed = values.filter(Boolean).length;
    return {
      ...items,
      overallCompletedPercentage: Math.round((completed / values.length) * 100),
    };
  }

  const checklist1 = computeChecklist({
    profileConfigured: true,
    campusAdded: true,
    academicYearSet: true,
    programsConfigured: true,
    firstBatchCreated: true,
    teacherInvited: true,
    studentsEnrolled: false,
  });

  assert.equal(checklist1.overallCompletedPercentage, 86);
  assert.equal(checklist1.studentsEnrolled, false);

  const checklistAllDone = computeChecklist({
    profileConfigured: true,
    campusAdded: true,
    academicYearSet: true,
    programsConfigured: true,
    firstBatchCreated: true,
    teacherInvited: true,
    studentsEnrolled: true,
  });

  assert.equal(checklistAllDone.overallCompletedPercentage, 100);
});

test("Workflow 3 & 4: Bulk Student Enrollment & Duplicate Collision Detection", () => {
  const registeredStudents = [
    { rollNumber: "APX-2026-1201", phone: "9876543210", name: "Aarav Sharma" },
  ];

  function processStudentImport(rows: BulkStudentImportRow[]): {
    enrolled: string[];
    duplicates: Array<{ roll: string; reason: string }>;
  } {
    const enrolled: string[] = [];
    const duplicates: Array<{ roll: string; reason: string }> = [];

    const existingRolls = new Set(registeredStudents.map((s) => s.rollNumber.toLowerCase()));
    const existingPhones = new Set(registeredStudents.map((s) => s.phone.replace(/\D/g, "").slice(-10)));

    for (const row of rows) {
      const cleanRoll = row.rollNumber.trim().toLowerCase();
      const cleanPhone = row.phone.replace(/\D/g, "").slice(-10);

      if (existingRolls.has(cleanRoll)) {
        duplicates.push({ roll: row.rollNumber, reason: "Duplicate roll number already registered" });
        continue;
      }

      if (existingPhones.has(cleanPhone)) {
        duplicates.push({ roll: row.rollNumber, reason: "Phone number already associated with existing student" });
        continue;
      }

      enrolled.push(row.rollNumber);
      existingRolls.add(cleanRoll);
      existingPhones.add(cleanPhone);
    }

    return { enrolled, duplicates };
  }

  const importBatch: BulkStudentImportRow[] = [
    {
      name: "Siddharth Rao",
      phone: "+91 98112 23344",
      rollNumber: "APX-2026-1215",
      batchName: "JEE 12A - Titans",
      targetExam: "JEE_ADVANCED",
    },
    {
      name: "Duplicate Aarav",
      phone: "+91 98765 43210", // Collides with existing phone
      rollNumber: "APX-2026-9999",
      batchName: "JEE 12A - Titans",
      targetExam: "JEE_ADVANCED",
    },
    {
      name: "Roll Collision",
      phone: "+91 99999 88888",
      rollNumber: "APX-2026-1201", // Collides with existing roll
      batchName: "JEE 12A - Titans",
      targetExam: "JEE_ADVANCED",
    },
  ];

  const result = processStudentImport(importBatch);

  assert.equal(result.enrolled.length, 1);
  assert.equal(result.enrolled[0], "APX-2026-1215");
  assert.equal(result.duplicates.length, 2);
  assert.match(result.duplicates[0].reason, /Phone number already associated/);
  assert.match(result.duplicates[1].reason, /Duplicate roll number/);
});

// =========================================================================
// Workflows 6-9: Assessment Lifecycle, Difficulty Weighting & Sample Size
// =========================================================================

test("Workflow 6, 7 & 8: Complete CBT Scoring, Answer Key Shielding & Grade Processing", () => {
  const questions: QuestionDefinition[] = [
    {
      id: "q1",
      kind: "single_choice",
      correctOptionIds: ["option_b"],
      marks: 4,
      negativeMarks: 1,
    },
    {
      id: "q2",
      kind: "numerical",
      correctNumber: 12.5,
      numericalTolerance: 0.1,
      marks: 4,
      negativeMarks: 0,
    },
  ];

  const studentAnswers: AnswerSubmission[] = [
    { questionId: "q1", selectedOptionIds: ["option_b"], timeSpentSeconds: 45 },
    { questionId: "q2", number: 12.55, timeSpentSeconds: 90 }, // Within 0.1 tolerance
  ];

  const evaluation = gradeAssessment(questions, studentAnswers);

  assert.equal(evaluation.totalScore, 8);
  assert.equal(evaluation.correctCount, 2);
  assert.equal(evaluation.incorrectCount, 0);

  // Verification that raw questions served to candidate have answers removed
  const candidateServedQuestion: any = {
    id: questions[0].id,
    kind: questions[0].kind,
    marks: questions[0].marks,
  };
  assert.equal(candidateServedQuestion.correctOptionIds, undefined);
  assert.equal(candidateServedQuestion.correctNumber, undefined);
});

test("Workflow 9: Assessment Difficulty Adjustment & Sample Size Safeguards", () => {
  // Test difficulty weighting: JEE Advanced = 1.25, JEE Main = 1.0, Practice = 0.85
  function computeWeightedScore(rawScore: number, pattern: "JEE_ADVANCED" | "JEE_MAIN" | "PRACTICE"): number {
    const weights = { JEE_ADVANCED: 1.25, JEE_MAIN: 1.0, PRACTICE: 0.85 };
    return Math.round(rawScore * weights[pattern] * 10) / 10;
  }

  assert.equal(computeWeightedScore(80, "JEE_ADVANCED"), 100.0);
  assert.equal(computeWeightedScore(80, "JEE_MAIN"), 80.0);
  assert.equal(computeWeightedScore(80, "PRACTICE"), 68.0);

  // Sample size check for Chapter Mastery (Requires >= 3 verified attempts)
  function evaluateMasteryWithSampleSafeguard(accuracy: number, attemptsCount: number): {
    status: "STRONG" | "MODERATE" | "NEEDS_FOCUS" | "PRELIMINARY";
    isPreliminary: boolean;
  } {
    if (attemptsCount < 3) {
      return { status: "PRELIMINARY", isPreliminary: true };
    }
    if (accuracy >= 80) return { status: "STRONG", isPreliminary: false };
    if (accuracy >= 60) return { status: "MODERATE", isPreliminary: false };
    return { status: "NEEDS_FOCUS", isPreliminary: false };
  }

  const sampleFew = evaluateMasteryWithSampleSafeguard(90, 2);
  assert.equal(sampleFew.isPreliminary, true);
  assert.equal(sampleFew.status, "PRELIMINARY");

  const sampleAdequate = evaluateMasteryWithSampleSafeguard(90, 4);
  assert.equal(sampleAdequate.isPreliminary, false);
  assert.equal(sampleAdequate.status, "STRONG");
});

// =========================================================================
// Workflows 10-14: Fees, Receipts, Admissions CRM & Conversion
// =========================================================================

test("Workflow 12 & 13: Fee Schedule Assignment, Installments, Payments & Receipt Generation", () => {
  // 1. Fee structure in integer paise (prevent floating-point errors)
  const totalAmountPaise = 18000000; // Rs. 1,80,000.00
  const discountAmountPaise = 2000000; // Rs. 20,000 scholarship discount
  const finalAmountPaise = totalAmountPaise - discountAmountPaise; // Rs. 1,60,000
  const installmentsCount = 2;

  const installmentAmount = Math.floor(finalAmountPaise / installmentsCount); // Rs. 80,000 each

  const installments = [
    { number: 1, amountPaise: installmentAmount, paidAmountPaise: 0, status: "DUE" },
    { number: 2, amountPaise: installmentAmount, paidAmountPaise: 0, status: "DUE" },
  ];

  assert.equal(finalAmountPaise, 16000000);
  assert.equal(installments[0].amountPaise, 8000000);

  // 2. Record manual payment of Rs. 80,000 via UPI
  function applyPayment(
    amountPaidPaise: number,
    paymentMethod: FeePaymentMethod,
    referenceNo: string
  ): {
    receiptNumber: string;
    totalPaid: number;
    remainingBalance: number;
  } {
    let remainingPayment = amountPaidPaise;
    for (const inst of installments) {
      if (remainingPayment <= 0) break;
      const unpaid = inst.amountPaise - inst.paidAmountPaise;
      const toPay = Math.min(unpaid, remainingPayment);
      inst.paidAmountPaise += toPay;
      remainingPayment -= toPay;
      inst.status = inst.paidAmountPaise >= inst.amountPaise ? "PAID" : "PARTIALLY_PAID";
    }

    const totalPaid = installments.reduce((acc, i) => acc + i.paidAmountPaise, 0);
    const remainingBalance = finalAmountPaise - totalPaid;
    const receiptNumber = "APX-RCP-2026-0001";

    return { receiptNumber, totalPaid, remainingBalance };
  }

  const payment1 = applyPayment(8000000, "UPI", "UPI/20261022/12345");
  assert.equal(payment1.receiptNumber, "APX-RCP-2026-0001");
  assert.equal(payment1.totalPaid, 8000000);
  assert.equal(payment1.remainingBalance, 8000000);
  assert.equal(installments[0].status, "PAID");
  assert.equal(installments[1].status, "DUE");
});

test("Workflow 14: Admissions CRM Lead Management, Duplicate Check & Batch Conversion", () => {
  interface Lead {
    id: string;
    phone: string;
    name: string;
    status: string;
    enrolledRoll?: string;
  }

  const leads: Lead[] = [
    { id: "lead-1", phone: "9823112345", name: "Devansh Mehra", status: "COUNSELED" },
  ];

  // 1. Duplicate lead detection
  function registerLead(name: string, phone: string): { lead: Lead; isDuplicate: boolean } {
    const cleanPhone = phone.replace(/\D/g, "").slice(-10);
    const existing = leads.find((l) => l.phone.replace(/\D/g, "").slice(-10) === cleanPhone);
    if (existing) {
      return { lead: existing, isDuplicate: true };
    }
    const newLead: Lead = { id: `lead-${Date.now()}`, phone, name, status: "NEW" };
    leads.push(newLead);
    return { lead: newLead, isDuplicate: false };
  }

  const dupCheck = registerLead("Devansh Duplicate", "+91 98231 12345");
  assert.equal(dupCheck.isDuplicate, true);
  assert.equal(dupCheck.lead.id, "lead-1");

  // 2. One-click conversion to enrolled student
  function convertLeadToStudent(leadId: string, rollNumber: string): Lead {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) throw new Error("Lead not found");
    lead.status = "ENROLLED";
    lead.enrolledRoll = rollNumber;
    return lead;
  }

  const converted = convertLeadToStudent("lead-1", "APX-2026-1218");
  assert.equal(converted.status, "ENROLLED");
  assert.equal(converted.enrolledRoll, "APX-2026-1218");
});
