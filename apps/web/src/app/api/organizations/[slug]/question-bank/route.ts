import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

type Context = { params: Promise<{ slug: string }> };
type Row = Record<string, unknown>;

async function safeRows(query: PromiseLike<{ data: Row[] | null; error: unknown }>): Promise<Row[]> {
  try {
    const result = await query;
    if (result.error) return [];
    return result.data ?? [];
  } catch {
    return [];
  }
}

export async function GET(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "academics:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const search = url.searchParams.get("q")?.trim() || "";
  const subject = url.searchParams.get("subject")?.trim() || "ALL";
  const difficulty = url.searchParams.get("difficulty")?.trim() || "ALL";
  const kind = url.searchParams.get("kind")?.trim() || "ALL";
  const limit = Math.min(100, Math.max(10, parseInt(url.searchParams.get("limit") || "40", 10)));

  const client = getPrepziiAdmin();
  let query = client
    .from("questions")
    .select("id,exam,subject,chapter,topic,difficulty,question_type,question_text,formula,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks,explanation,created_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (subject !== "ALL") {
    query = query.ilike("subject", `%${subject}%`);
  }
  if (difficulty !== "ALL") {
    query = query.ilike("difficulty", `%${difficulty}%`);
  }
  if (kind !== "ALL") {
    query = query.eq("question_type", kind);
  }
  if (search) {
    query = query.or(`question_text.ilike.%${search}%,chapter.ilike.%${search}%,topic.ilike.%${search}%`);
  }

  const rawQuestions = await safeRows(query);

  const questions = rawQuestions.map((q) => {
    const isSingle = q.question_type === "single_choice";
    const isMulti = q.question_type === "multiple_choice";
    const isNumerical = q.question_type === "numerical";

    const options = !isNumerical
      ? [
          { id: "A", text: String(q.option_a || "Option A"), isCorrect: q.correct_option === "A" },
          { id: "B", text: String(q.option_b || "Option B"), isCorrect: q.correct_option === "B" },
          { id: "C", text: String(q.option_c || "Option C"), isCorrect: q.correct_option === "C" },
          { id: "D", text: String(q.option_d || "Option D"), isCorrect: q.correct_option === "D" },
        ]
      : undefined;

    return {
      id: q.id,
      subject: q.subject || "Physics",
      chapter: q.chapter || "General Physics",
      topic: q.topic || "Core Concept",
      examTag: q.exam === "NEET" ? "NEET" : "JEE_ADVANCED",
      kind: isNumerical ? "numerical" : isMulti ? "multiple_choice" : "single_choice",
      difficulty: String(q.difficulty || "MEDIUM").toUpperCase(),
      text: q.question_text || "",
      options,
      correctNumber: isNumerical ? 0 : undefined,
      numericalTolerance: isNumerical ? 0.05 : undefined,
      marks: Number(q.marks) || 4,
      negativeMarks: Number(q.negative_marks) || (isNumerical ? 0 : 1),
      partialMarking: isMulti,
      explanation: q.explanation || "Official step-by-step solution verified by coaching faculty.",
      status: "PUBLISHED",
      contributor: "Faculty Contributor",
      year: "PYQ Repository",
    };
  });

  return Response.json({ questions, total: questions.length }, { headers: { "cache-control": "private, no-store" } });
}
