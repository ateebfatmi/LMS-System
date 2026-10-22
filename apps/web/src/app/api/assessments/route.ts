import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError } from "@/lib/dal/auth-context";
import { AssessmentRepository } from "@/lib/dal/assessment-repository";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(undefined, orgId);
    const { searchParams } = new URL(req.url);
    const testId = searchParams.get("testId");

    if (testId) {
      const leaderboard = await AssessmentRepository.getLeaderboard(auth.organizationId, testId);
      return NextResponse.json({ leaderboard });
    }

    const tests = await AssessmentRepository.listTests(auth.organizationId);
    return NextResponse.json({ tests });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    const auth = await requireAuthContext(["OWNER", "COACHING_ADMIN", "TEACHER"], orgId);
    const body = await req.json();

    if (!body.title || !body.pattern || !body.targetBatchName) {
      return NextResponse.json({ error: "Test title, pattern, and target batch are required." }, { status: 400 });
    }

    const created = await AssessmentRepository.createAndScheduleAssessment({
      organizationId: auth.organizationId,
      title: body.title,
      pattern: body.pattern,
      subject: body.subject || "Full Syllabus (PCM)",
      totalMarks: Number(body.totalMarks) || 180,
      durationMinutes: Number(body.durationMinutes) || 180,
      targetBatchName: body.targetBatchName,
      questionIds: Array.isArray(body.questionIds) ? body.questionIds : [],
    });

    return NextResponse.json({ test: created }, { status: 201 });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "Failed to create assessment" }, { status: 500 });
  }
}
