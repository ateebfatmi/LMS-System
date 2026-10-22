import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError } from "@/lib/dal/auth-context";
import { ParentRepository } from "@/lib/dal/parent-repository";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthContext(["PARENT", "OWNER", "COACHING_ADMIN", "TEACHER"]);
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId") || "std-1";

    const profile = await ParentRepository.getChildAcademicSummary(auth.organizationId, auth.userId, studentId);

    // Return structured report card object suitable for PDF rendering or download
    return NextResponse.json({
      success: true,
      report: profile.academicProgressReport,
      student: profile.student,
      attendance: profile.attendance,
      publishedTestResults: profile.testResults,
      chapterMasteries: profile.chapterMasteries,
      downloadFilename: `Prepzii_Report_${profile.student.rollNumber}_${new Date().toISOString().split("T")[0]}.json`,
    });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "Failed to generate report" }, { status: 500 });
  }
}
