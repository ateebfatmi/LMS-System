import { NextRequest, NextResponse } from "next/server";
import type { QuestionDifficulty, TargetExam } from "@prepzii/contracts";
import { requireAuthContext, AuthorizationError } from "@/lib/dal/auth-context";
import { QuestionBankRepository } from "@/lib/dal/question-bank-repository";

const TARGET_EXAMS = new Set<TargetExam>(["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION", "BOARDS"]);
const DIFFICULTIES = new Set<QuestionDifficulty>(["EASY", "MEDIUM", "HARD", "ADVANCED"]);

function parseFilter<T extends string>(value: string | null, allowed: ReadonlySet<T>): T | undefined {
  return value && allowed.has(value as T) ? (value as T) : undefined;
}

export async function GET(req: NextRequest) {
  try {
    const orgId = req.nextUrl.searchParams.get("organizationId") || undefined;
    await requireAuthContext(["OWNER", "COACHING_ADMIN", "TEACHER"], orgId);

    const { searchParams } = new URL(req.url);
    const targetExam = parseFilter(searchParams.get("targetExam"), TARGET_EXAMS);
    const subject = searchParams.get("subject") || undefined;
    const chapter = searchParams.get("chapter") || undefined;
    const difficulty = parseFilter(searchParams.get("difficulty"), DIFFICULTIES);
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
  } catch (error: unknown) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
