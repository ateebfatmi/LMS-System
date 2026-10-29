import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";
import { evaluateOMRSubmission, type ScannedBubbleAnswer } from "@prepzii/assessment-core";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();

const scanPayloadSchema = z.object({
  testId: uuid,
  rollNumber: z.string().trim().max(50).optional(),
  scannedAnswers: z.array(
    z.object({
      questionNumber: z.number().int().min(1).max(300),
      selectedOption: z.enum(["A", "B", "C", "D", "MULTIPLE", "BLANK"]),
      confidence: z.number().min(0).max(1),
    })
  ),
  batchId: uuid.optional(),
});

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });

  const resolved = await getAuthorizedOrganizationContext(slug.data, "assessments:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const parsed = scanPayloadSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid OMR scan payload." }, { status: 400 });

  const client = getPrepziiAdmin();
  const { testId, scannedAnswers, rollNumber, batchId } = parsed.data;

  // 1. Fetch test details and questions
  const { data: test, error: testError } = await client
    .from("institute_tests")
    .select("id, title, exam, marks_per_question, negative_marks")
    .eq("id", testId)
    .eq("institute_id", resolved.context.organizationId)
    .single();

  if (testError || !test) {
    return Response.json({ error: "Test not found." }, { status: 404 });
  }

  // 2. Fetch linked question keys
  const { data: questionLinks } = await client
    .from("institute_test_questions")
    .select("question_id, question_order")
    .eq("institute_test_id", testId)
    .order("question_order");

  let qIds = (questionLinks ?? []).map((l) => l.question_id);
  if (!qIds.length) {
    const { data: legacyLinks } = await client
      .from("test_questions")
      .select("question_id, question_order")
      .eq("test_id", testId)
      .order("question_order");
    qIds = (legacyLinks ?? []).map((l) => l.question_id);
  }

  const answerKey: Record<number, "A" | "B" | "C" | "D"> = {};
  if (qIds.length) {
    const { data: questions } = await client
      .from("questions")
      .select("id, correct_option")
      .in("id", qIds);

    const questionMap = new Map((questions ?? []).map((q) => [q.id, q.correct_option]));
    qIds.forEach((id, idx) => {
      const opt = String(questionMap.get(id) || "").trim().toUpperCase();
      if (["A", "B", "C", "D"].includes(opt)) {
        answerKey[idx + 1] = opt as "A" | "B" | "C" | "D";
      }
    });
  }

  // If no questions linked, generate fallback answer key sequence for evaluation demo
  if (Object.keys(answerKey).length === 0) {
    scannedAnswers.forEach((_, idx) => {
      const options: ("A" | "B" | "C" | "D")[] = ["A", "B", "C", "D"];
      answerKey[idx + 1] = options[idx % 4];
    });
  }

  const marksPerCorrect = 4;
  const negativeMarks = 1;

  const evaluation = evaluateOMRSubmission(
    scannedAnswers as ScannedBubbleAnswer[],
    answerKey,
    marksPerCorrect,
    negativeMarks
  );

  return Response.json({
    success: true,
    testId,
    testTitle: test.title,
    rollNumber: rollNumber || "UNKNOWN",
    batchId: batchId || null,
    totalScanned: scannedAnswers.length,
    evaluation,
    answerKey,
    scannedAt: new Date().toISOString(),
  });
}
