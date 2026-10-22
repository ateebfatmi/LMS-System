import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError } from "@/lib/dal/auth-context";
import { AssessmentRepository } from "@/lib/dal/assessment-repository";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthContext();
    const body = await req.json();
    const { action } = body;

    if (!action) {
      return NextResponse.json({ error: "Missing action specifier" }, { status: 400 });
    }

    // 1. START CBT SESSION
    if (action === "START") {
      const { testId, studentName, batchName } = body;
      if (!testId) {
        return NextResponse.json({ error: "testId is required" }, { status: 400 });
      }

      const sessionData = await AssessmentRepository.startCbtSession(
        auth.organizationId,
        testId,
        auth.userId,
        studentName || "Candidate",
        batchName || "JEE 12A - Titans"
      );

      return NextResponse.json(sessionData);
    }

    // 2. AUTOSAVE PER-QUESTION ANSWER
    if (action === "AUTOSAVE") {
      const { attemptId, questionId, answer, timeSpentSeconds, markedForReview } = body;
      if (!attemptId || !questionId) {
        return NextResponse.json({ error: "attemptId and questionId are required" }, { status: 400 });
      }

      const saveResult = await AssessmentRepository.autosaveAnswer(auth.organizationId, auth.userId, {
        attemptId,
        questionId,
        answer,
        timeSpentSeconds: timeSpentSeconds || 0,
        markedForReview,
      });

      return NextResponse.json(saveResult);
    }

    // 3. FINAL SUBMISSION & SERVER-AUTHORITATIVE GRADING
    if (action === "SUBMIT") {
      const { attemptId } = body;
      if (!attemptId) {
        return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
      }

      const submitResult = await AssessmentRepository.submitCbtSession(auth.organizationId, attemptId, auth.userId);
      return NextResponse.json(submitResult);
    }

    // 4. COMPREHENSIVE ANSWER REVIEW
    if (action === "REVIEW") {
      const { attemptId } = body;
      if (!attemptId) {
        return NextResponse.json({ error: "attemptId is required" }, { status: 400 });
      }

      const isStaff = ["OWNER", "COACHING_ADMIN", "TEACHER"].includes(auth.role);
      const review = await AssessmentRepository.getComprehensiveReview(auth.organizationId, attemptId, auth.userId, isStaff);
      return NextResponse.json(review);
    }

    return NextResponse.json({ error: `Unknown CBT action: ${action}` }, { status: 400 });
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || "CBT operation failed" }, { status: 500 });
  }
}
