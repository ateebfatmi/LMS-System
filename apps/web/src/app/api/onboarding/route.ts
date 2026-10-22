import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError } from "@/lib/dal/auth-context";
import { OnboardingRepository } from "@/lib/dal/onboarding-repository";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN", "TEACHER"]);
    const checklist = await OnboardingRepository.getChecklist(auth.organizationId);
    return NextResponse.json({ checklist });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "Failed to load onboarding checklist" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN"]);
    const body = await req.json();

    if (body.action === "UPDATE_PROFILE") {
      const result = await OnboardingRepository.updateProfile(auth.organizationId, {
        name: body.name,
        campusName: body.campusName,
        academicYear: body.academicYear,
        programs: body.programs,
        logoUrl: body.logoUrl,
      });
      return NextResponse.json(result);
    }

    if (body.action === "BULK_IMPORT") {
      const result = await OnboardingRepository.bulkImportStudents(auth.organizationId, body.rows || []);
      return NextResponse.json(result);
    }

    if (body.action === "INVITE_TEACHER") {
      const result = await OnboardingRepository.inviteTeacher(auth.organizationId, {
        name: body.name,
        email: body.email,
        subject: body.subject,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "Onboarding operation failed" }, { status: 500 });
  }
}
