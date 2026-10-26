import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError, getErrorMessage } from "@/lib/dal/auth-context";
import { FeeRepository } from "@/lib/dal/fee-repository";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN", "ACCOUNTANT"], orgId);
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const studentId = searchParams.get("studentId");

    if (studentId) {
      const fee = await FeeRepository.getStudentFeeByStudentId(auth.organizationId, studentId);
      return NextResponse.json({ fee });
    }

    if (type === "PLANS") {
      const plans = await FeeRepository.listFeePlans(auth.organizationId);
      return NextResponse.json({ plans });
    }

    const [plans, studentFees] = await Promise.all([
      FeeRepository.listFeePlans(auth.organizationId),
      FeeRepository.listStudentFees(auth.organizationId),
    ]);

    const totalCollectedPaise = studentFees.reduce((acc, f) => acc + f.totalPaidPaise, 0);
    const totalOutstandingPaise = studentFees.reduce((acc, f) => acc + f.outstandingBalancePaise, 0);

    return NextResponse.json({
      plans,
      studentFees,
      summary: {
        totalCollectedPaise,
        totalOutstandingPaise,
        totalEnrolled: studentFees.length,
      },
    });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load fee information") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN"], orgId);
    const body = await req.json();

    if (body.action === "RECORD_PAYMENT") {
      const result = await FeeRepository.recordPayment({
        organizationId: auth.organizationId,
        studentFeeId: body.studentFeeId,
        amountPaise: Number(body.amountPaise),
        paymentMethod: body.paymentMethod,
        referenceNumber: body.referenceNumber,
        collectedBy: auth.userId,
        notes: body.notes,
      });
      return NextResponse.json(result);
    }

    if (body.action === "ASSIGN_PLAN") {
      const ledger = await FeeRepository.assignFeePlan({
        organizationId: auth.organizationId,
        studentId: body.studentId,
        feePlanId: body.feePlanId,
        discountAmountPaise: body.discountAmountPaise ? Number(body.discountAmountPaise) : 0,
        discountReason: body.discountReason,
        installmentsCount: body.installmentsCount ? Number(body.installmentsCount) : undefined,
        assignedBy: auth.userId,
      });
      return NextResponse.json({ ledger });
    }

    if (body.action === "CREATE_PLAN") {
      const newPlan = await FeeRepository.createFeePlan(auth.organizationId, {
        name: body.name,
        targetExam: body.targetExam,
        totalAmountPaise: Number(body.totalAmountPaise),
        defaultInstallments: Number(body.defaultInstallments || 3),
        description: body.description,
        isActive: true,
      });
      return NextResponse.json({ plan: newPlan });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Fee mutation failed") }, { status: 500 });
  }
}
