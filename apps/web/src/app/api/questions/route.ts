import { NextRequest, NextResponse } from "next/server";
import { requireAuthContext, AuthorizationError } from "@/lib/dal/auth-context";
import { QuestionBankRepository } from "@/lib/dal/question-bank-repository";

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    await requireAuthContext(["OWNER", "COACHING_ADMIN", "TEACHER"], orgId);

    const { searchParams } = new URL(req.url);
    const targetExam = searchParams.get("targetExam") as any || undefined;
    const subject = searchParams.get("subject") || undefined;
    const chapter = searchParams.get("chapter") || undefined;
    const difficulty = searchParams.get("difficulty") as any || undefined;
    const isPyqParam = searchParams.get("isPyq");
    const isPyq = isPyqParam !== null ? isPyqParam === "true" : undefined;
    const pyqYear = searchParams.get("pyqYear") ? Number(searchParams.get("pyqYear")) : undefined;
    const searchQuery = searchParams.get("searchQuery") || undefined;

    const result = await QuestionBankRepository.queryQuestions({
      targetExam,
      subject,
      chapter,
      difficulty,
      isPyq,
      pyqYear,
      searchQuery,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
