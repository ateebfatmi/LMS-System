import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError, getErrorMessage } from "@/lib/dal/auth-context";
import { AdmissionsRepository } from "@/lib/dal/admissions-repository";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN"], orgId);
    const enquiries = await AdmissionsRepository.listEnquiries(auth.organizationId);

    const stats = {
      totalLeads: enquiries.length,
      newLeads: enquiries.filter((e) => e.status === "NEW").length,
      counseled: enquiries.filter((e) => e.status === "COUNSELED" || e.status === "DEMO_ATTENDED").length,
      enrolled: enquiries.filter((e) => e.status === "ENROLLED").length,
    };

    return NextResponse.json({ enquiries, stats });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Failed to load admissions enquiries") }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN"], orgId);
    const body = await req.json();

    if (body.action === "CREATE_ENQUIRY") {
      const result = await AdmissionsRepository.createEnquiry({
        organizationId: auth.organizationId,
        studentName: body.studentName,
        parentName: body.parentName,
        phone: body.phone,
        email: body.email,
        targetExam: body.targetExam,
        currentSchool: body.currentSchool,
        currentGrade: body.currentGrade,
        leadSource: body.leadSource,
        assignedCounsellorName: body.assignedCounsellorName,
        targetBatchId: body.targetBatchId,
        notes: body.notes,
      });
      return NextResponse.json(result);
    }

    if (body.action === "ADD_FOLLOWUP") {
      const result = await AdmissionsRepository.addFollowup(body.enquiryId, {
        counsellorName: body.counsellorName || auth.userId,
        interactionType: body.interactionType,
        remarks: body.remarks,
        nextFollowupDate: body.nextFollowupDate,
        newStatus: body.newStatus,
      });
      return NextResponse.json({ enquiry: result });
    }

    if (body.action === "CONVERT_STUDENT") {
      const result = await AdmissionsRepository.convertToStudent(body.enquiryId, body.targetBatchId);
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: getErrorMessage(error, "Admissions mutation failed") }, { status: 500 });
  }
}
