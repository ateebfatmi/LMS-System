import "server-only";

import type {
  FeeInstallmentItem,
  FeePaymentMethod,
  FeePlan,
  FeeReceiptSummary,
  StudentFeeLedger,
  StudentFeeStatus,
} from "@prepzii/contracts";
import { mockStudents } from "@/lib/mock-data";

// In-memory stores for Fee Management
const feePlansStore = new Map<string, FeePlan>();
const studentFeesStore = new Map<string, StudentFeeLedger>();
const feePaymentsStore = new Map<string, FeeReceiptSummary>();

// Initialize default fee plans for Indian Coaching (Apex Academy)
const defaultPlans: FeePlan[] = [
  {
    id: "plan-jee-2yr",
    organizationId: "demo-institute-apex",
    name: "JEE Advanced 2-Year Classroom Program (Class 11+12)",
    targetExam: "JEE_ADVANCED",
    totalAmountPaise: 18000000, // Rs. 1,80,000
    defaultInstallments: 3,
    description: "Includes daily lectures, study material, PrepZii CBT test series, and mentorship",
    isActive: true,
    createdAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "plan-neet-1yr",
    organizationId: "demo-institute-apex",
    name: "NEET Medico Super 50 Program (Class 12 / Repeater)",
    targetExam: "NEET",
    totalAmountPaise: 14000000, // Rs. 1,40,000
    defaultInstallments: 2,
    description: "Intensive biology, chemistry, physics drills with weekly NCERT CBT mocks",
    isActive: true,
    createdAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "plan-foundation",
    organizationId: "demo-institute-apex",
    name: "Foundation Olympiad & NTSE (Class 9–10)",
    targetExam: "FOUNDATION",
    totalAmountPaise: 7500000, // Rs. 75,000
    defaultInstallments: 2,
    description: "School syllabus plus Olympiad mental ability and science foundations",
    isActive: true,
    createdAt: "2026-04-01T00:00:00Z",
  },
];

for (const p of defaultPlans) {
  feePlansStore.set(p.id, p);
}

// Seed initial student fee record for Aarav Sharma (std-1)
const initialStudentFeeId = "fee-aarav-std-1";
const initialReceipt: FeeReceiptSummary = {
  id: "rcp-2026-0001",
  receiptNumber: "APX-RCP-2026-0001",
  studentFeeId: initialStudentFeeId,
  studentId: "std-1",
  studentName: "Aarav Sharma",
  rollNumber: "APX-2026-1201",
  amountPaise: 6000000, // Rs. 60,000 paid
  paymentMethod: "UPI",
  referenceNumber: "UPI/20261002/9823481234",
  collectedBy: "Admin Office",
  notes: "Installment 1 of 3 cleared via UPI",
  paidAt: "2026-04-10T11:30:00Z",
};
feePaymentsStore.set(initialReceipt.id, initialReceipt);

const initialInstallments: FeeInstallmentItem[] = [
  {
    id: "inst-1",
    studentFeeId: initialStudentFeeId,
    installmentNumber: 1,
    dueDate: "2026-04-10",
    amountPaise: 6000000,
    paidAmountPaise: 6000000,
    status: "PAID",
  },
  {
    id: "inst-2",
    studentFeeId: initialStudentFeeId,
    installmentNumber: 2,
    dueDate: "2026-08-10",
    amountPaise: 6000000,
    paidAmountPaise: 6000000,
    status: "PAID",
  },
  {
    id: "inst-3",
    studentFeeId: initialStudentFeeId,
    installmentNumber: 3,
    dueDate: "2026-12-10",
    amountPaise: 6000000,
    paidAmountPaise: 0,
    status: "DUE",
  },
];

const initialFeeLedger: StudentFeeLedger = {
  id: initialStudentFeeId,
  organizationId: "demo-institute-apex",
  studentId: "std-1",
  studentName: "Aarav Sharma",
  rollNumber: "APX-2026-1201",
  batchName: "JEE 12A - Titans",
  feePlanId: "plan-jee-2yr",
  feePlanName: "JEE Advanced 2-Year Classroom Program (Class 11+12)",
  baseAmountPaise: 18000000,
  discountAmountPaise: 0,
  finalAmountPaise: 18000000,
  totalPaidPaise: 12000000,
  outstandingBalancePaise: 6000000,
  status: "PARTIALLY_PAID",
  installments: initialInstallments,
  payments: [initialReceipt],
  assignedAt: "2026-04-01T00:00:00Z",
};
studentFeesStore.set(initialFeeLedger.id, initialFeeLedger);

export interface RecordPaymentInput {
  organizationId: string;
  studentFeeId: string;
  amountPaise: number;
  paymentMethod: FeePaymentMethod;
  referenceNumber?: string;
  collectedBy: string;
  notes?: string;
}

export interface AssignFeePlanInput {
  organizationId: string;
  studentId: string;
  feePlanId: string;
  discountAmountPaise?: number;
  discountReason?: string;
  installmentsCount?: number;
  assignedBy: string;
}

export class FeeRepository {
  /**
   * Lists active fee plans for an institute.
   */
  public static async listFeePlans(organizationId: string): Promise<FeePlan[]> {
    return [...feePlansStore.values()].filter((p) => p.organizationId === organizationId || organizationId === "demo-institute-apex");
  }

  /**
   * Creates a new fee structure.
   */
  public static async createFeePlan(
    organizationId: string,
    input: Omit<FeePlan, "id" | "organizationId" | "createdAt">
  ): Promise<FeePlan> {
    const id = `plan-${Date.now()}`;
    const newPlan: FeePlan = {
      ...input,
      id,
      organizationId,
      createdAt: new Date().toISOString(),
    };
    feePlansStore.set(id, newPlan);
    return newPlan;
  }

  /**
   * Retrieves all student fee ledgers for an institute.
   */
  public static async listStudentFees(organizationId: string): Promise<StudentFeeLedger[]> {
    return [...studentFeesStore.values()].filter(
      (f) => f.organizationId === organizationId || organizationId === "demo-institute-apex"
    );
  }

  /**
   * Retrieves fee ledger for a specific student.
   */
  public static async getStudentFeeByStudentId(
    organizationId: string,
    studentId: string
  ): Promise<StudentFeeLedger | null> {
    const ledger = [...studentFeesStore.values()].find(
      (f) => f.studentId === studentId && (f.organizationId === organizationId || organizationId === "demo-institute-apex")
    );
    return ledger || null;
  }

  /**
   * Assigns a fee plan to a student with installment schedule generation.
   */
  public static async assignFeePlan(input: AssignFeePlanInput): Promise<StudentFeeLedger> {
    const plan = feePlansStore.get(input.feePlanId);
    if (!plan) throw new Error("Fee plan not found");

    const student = mockStudents.find((s) => s.id === input.studentId);
    if (!student) throw new Error("Student not found");

    const baseAmount = plan.totalAmountPaise;
    const discount = input.discountAmountPaise || 0;
    const finalAmount = Math.max(0, baseAmount - discount);
    const installmentsCount = input.installmentsCount || plan.defaultInstallments || 3;

    const installmentAmount = Math.floor(finalAmount / installmentsCount);
    const remainder = finalAmount - installmentAmount * installmentsCount;

    const installments: FeeInstallmentItem[] = [];
    const feeId = `fee-${input.studentId}-${Date.now()}`;

    for (let i = 1; i <= installmentsCount; i++) {
      const amount = i === installmentsCount ? installmentAmount + remainder : installmentAmount;
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + (i - 1) * 3); // 3 months apart
      installments.push({
        id: `inst-${feeId}-${i}`,
        studentFeeId: feeId,
        installmentNumber: i,
        dueDate: dueDate.toISOString().split("T")[0],
        amountPaise: amount,
        paidAmountPaise: 0,
        status: "DUE",
      });
    }

    const ledger: StudentFeeLedger = {
      id: feeId,
      organizationId: input.organizationId,
      studentId: student.id,
      studentName: student.name,
      rollNumber: student.rollNumber,
      batchName: student.batchName,
      feePlanId: plan.id,
      feePlanName: plan.name,
      baseAmountPaise: baseAmount,
      discountAmountPaise: discount,
      discountReason: input.discountReason,
      finalAmountPaise: finalAmount,
      totalPaidPaise: 0,
      outstandingBalancePaise: finalAmount,
      status: finalAmount === 0 ? "PAID" : "PENDING",
      installments,
      payments: [],
      assignedAt: new Date().toISOString(),
    };

    studentFeesStore.set(feeId, ledger);
    return ledger;
  }

  /**
   * Records a manual fee collection (Cash, UPI, Cheque, Bank Transfer).
   * Generates a sequential receipt and updates installment statuses.
   */
  public static async recordPayment(input: RecordPaymentInput): Promise<{
    receipt: FeeReceiptSummary;
    updatedLedger: StudentFeeLedger;
  }> {
    if (input.amountPaise <= 0) {
      throw new Error("Payment amount must be greater than zero");
    }

    const ledger = studentFeesStore.get(input.studentFeeId);
    if (!ledger) {
      throw new Error("Student fee record not found");
    }

    if (input.amountPaise > ledger.outstandingBalancePaise) {
      throw new Error(
        `Payment amount (Rs. ${(input.amountPaise / 100).toFixed(2)}) exceeds outstanding balance (Rs. ${(
          ledger.outstandingBalancePaise / 100
        ).toFixed(2)})`
      );
    }

    // Generate sequential receipt number
    const count = feePaymentsStore.size + 1;
    const receiptNumStr = String(count).padStart(4, "0");
    const receiptNumber = `APX-RCP-2026-${receiptNumStr}`;
    const receiptId = `rcp-${Date.now()}`;

    const receipt: FeeReceiptSummary = {
      id: receiptId,
      receiptNumber,
      studentFeeId: ledger.id,
      studentId: ledger.studentId,
      studentName: ledger.studentName,
      rollNumber: ledger.rollNumber,
      amountPaise: input.amountPaise,
      paymentMethod: input.paymentMethod,
      referenceNumber: input.referenceNumber,
      collectedBy: input.collectedBy,
      notes: input.notes,
      paidAt: new Date().toISOString(),
    };

    feePaymentsStore.set(receiptId, receipt);

    // Apply payment towards installments chronologically
    let remainingPayment = input.amountPaise;
    for (const inst of ledger.installments) {
      if (remainingPayment <= 0) break;
      const unpaidOnInst = inst.amountPaise - inst.paidAmountPaise;
      if (unpaidOnInst > 0) {
        const toApply = Math.min(unpaidOnInst, remainingPayment);
        inst.paidAmountPaise += toApply;
        remainingPayment -= toApply;
        inst.status = inst.paidAmountPaise >= inst.amountPaise ? "PAID" : "PARTIALLY_PAID";
      }
    }

    ledger.totalPaidPaise += input.amountPaise;
    ledger.outstandingBalancePaise -= input.amountPaise;
    ledger.status =
      ledger.outstandingBalancePaise === 0
        ? "PAID"
        : ledger.totalPaidPaise > 0
        ? "PARTIALLY_PAID"
        : "PENDING";
    ledger.payments.push(receipt);

    studentFeesStore.set(ledger.id, ledger);

    return { receipt, updatedLedger: ledger };
  }

  /**
   * Formats paise to standard Indian Rupee notation (e.g. Rs. 1,80,000.00).
   */
  public static formatINR(paise: number): string {
    const rupees = paise / 100;
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(rupees);
  }
}
