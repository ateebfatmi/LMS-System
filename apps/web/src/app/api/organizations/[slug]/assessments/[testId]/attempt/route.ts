import { adaptPrepziiQuestion, gradeAssessment, type PrepziiQuestionRow } from "@prepzii/assessment-core";
import type { AnswerSubmission, QuestionDefinition } from "@prepzii/contracts";
import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const answer = z.object({ selectedOptionIds: z.array(z.enum(["A", "B", "C", "D"])).max(4).optional(), number: z.number().finite().optional(), timeSpentSeconds: z.number().int().min(0).max(86400).optional() });
const saveSchema = z.object({ attemptId: uuid, expectedVersion: z.number().int().min(0), answers: z.record(uuid, answer).refine((value) => Object.keys(value).length <= 500) });
type Context = { params: Promise<{ slug: string; testId: string }> };
type AttemptRow = { id: string; test_id: string; schedule_id: string; user_id: string; status: string; answers: Record<string, Omit<AnswerSubmission, "questionId">>; answer_version: number; started_at: string; expires_at: string; submitted_at: string | null; score: number | null; max_score: number | null; percentage: number | null; correct_count: number | null; incorrect_count: number | null; unanswered_count: number | null; results_released: boolean; solutions_released: boolean; question_results: unknown };

async function loadQuestions(organizationId: string, testId: string): Promise<QuestionDefinition[]> {
  const client = getPrepziiAdmin();
  const { data: links, error: linkError } = await client.from("institute_test_questions").select("question_id,question_order").eq("institute_id", organizationId).eq("institute_test_id", testId).order("question_order");
  if (linkError) throw linkError;
  const ids = (links ?? []).map((link) => link.question_id);
  if (!ids.length) return [];
  const { data, error } = await client.from("questions").select("id,exam,subject,topic,question_type,question_text,option_a,option_b,option_c,option_d,correct_option,marks,negative_marks").in("id", ids);
  if (error) throw error;
  const byId = new Map(((data ?? []) as PrepziiQuestionRow[]).map((row) => [row.id, adaptPrepziiQuestion(row)]));
  return ids.map((id) => byId.get(id)).filter((item): item is QuestionDefinition => Boolean(item));
}

function publicQuestion(question: QuestionDefinition) {
  return { id: question.id, kind: question.kind, subject: question.subject, topic: question.topic, text: question.text, options: question.options, marks: question.marks, negativeMarks: question.negativeMarks };
}

async function resolve(requestContext: Context, permission: "assessments:take" | "academics:read") {
  const params = await requestContext.params;
  const slug = slugSchema.safeParse(params.slug);
  const testId = uuid.safeParse(params.testId);
  if (!slug.success || !testId.success) return null;
  const authorized = await getAuthorizedOrganizationContext(slug.data, permission);
  return authorized ? { authorized, testId: testId.data } : null;
}

export async function POST(_request: Request, context: Context) {
  const resolved = await resolve(context, "assessments:take");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { authorized, testId } = resolved;
  const client = getPrepziiAdmin();
  const { data, error } = await client.rpc("lms_start_assessment", {
    p_organization_id: authorized.context.organizationId, p_actor_user_id: authorized.context.userId,
    p_actor_role: authorized.context.role, p_test_id: testId,
  });
  if (error) {
    if (error.code === "42501") return Response.json({ error: error.message }, { status: 403 });
    if (error.code === "22023") return Response.json({ error: error.message }, { status: 400 });
    console.error("Assessment start failed", error);
    return Response.json({ error: "Unable to start assessment." }, { status: 503 });
  }
  const [questions, testResult] = await Promise.all([
    loadQuestions(authorized.context.organizationId, testId),
    client.from("institute_tests").select("title,duration_minutes").eq("id", testId).eq("institute_id", authorized.context.organizationId).single(),
  ]);
  if (testResult.error) return Response.json({ error: "Unable to load assessment." }, { status: 503 });
  return Response.json({ ...data, title: testResult.data.title, durationMinutes: testResult.data.duration_minutes, questions: questions.map(publicQuestion) }, { headers: { "cache-control": "private, no-store" } });
}

export async function PATCH(request: Request, context: Context) {
  const resolved = await resolve(context, "assessments:take");
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!resolved || !parsed.success) return Response.json({ error: "Invalid answer save." }, { status: 400 });
  const { data, error } = await getPrepziiAdmin().rpc("lms_save_assessment_answers", {
    p_organization_id: resolved.authorized.context.organizationId, p_actor_user_id: resolved.authorized.context.userId,
    p_attempt_id: parsed.data.attemptId, p_expected_version: parsed.data.expectedVersion, p_answers: parsed.data.answers,
  });
  if (error) {
    if (error.code === "40001") return Response.json({ error: "A newer answer version exists. Reload before continuing." }, { status: 409 });
    if (error.code === "42501") return Response.json({ error: "Attempt not found." }, { status: 404 });
    if (error.code === "22023") return Response.json({ error: error.message }, { status: 400 });
    console.error("Assessment autosave failed", error);
    return Response.json({ error: "Unable to save answers." }, { status: 503 });
  }
  return Response.json(data, { headers: { "cache-control": "private, no-store" } });
}

export async function PUT(request: Request, context: Context) {
  const resolved = await resolve(context, "assessments:take");
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!resolved || !parsed.success) return Response.json({ error: "Invalid assessment submission." }, { status: 400 });
  const { authorized, testId } = resolved;
  const client = getPrepziiAdmin();
  let version = parsed.data.expectedVersion;
  let answers = parsed.data.answers;
  const existing = await client.from("organization_assessment_attempts").select("*").eq("id", parsed.data.attemptId).eq("organization_id", authorized.context.organizationId).eq("user_id", authorized.context.userId).eq("test_id", testId).maybeSingle<AttemptRow>();
  if (existing.error || !existing.data) return Response.json({ error: "Attempt not found." }, { status: 404 });
  if (existing.data.status === "SUBMITTED") {
    return Response.json({ attemptId: existing.data.id, submitted: true, idempotent: true, resultsReleased: existing.data.results_released, solutionsReleased: existing.data.solutions_released });
  }
  const saved = await client.rpc("lms_save_assessment_answers", {
    p_organization_id: authorized.context.organizationId, p_actor_user_id: authorized.context.userId,
    p_attempt_id: parsed.data.attemptId, p_expected_version: version, p_answers: answers,
  });
  if (saved.error && saved.error.code !== "22023") {
    if (saved.error.code === "40001") return Response.json({ error: "A newer answer version exists. Reload before submitting." }, { status: 409 });
    return Response.json({ error: "Unable to save final answers." }, { status: 503 });
  }
  if (!saved.error) version = Number((saved.data as { answerVersion: number }).answerVersion);
  else {
    const current = await client.from("organization_assessment_attempts").select("answers,answer_version").eq("id", parsed.data.attemptId).eq("organization_id", authorized.context.organizationId).single();
    if (current.error) return Response.json({ error: "Unable to recover saved answers." }, { status: 503 });
    answers = current.data.answers as typeof answers;
    version = current.data.answer_version;
  }

  const questions = await loadQuestions(authorized.context.organizationId, testId);
  const answerList: AnswerSubmission[] = Object.entries(answers).map(([questionId, value]) => ({ questionId, ...value }));
  const summary = gradeAssessment(questions, answerList);
  const finalized = await client.rpc("lms_finalize_assessment", {
    p_organization_id: authorized.context.organizationId, p_actor_user_id: authorized.context.userId,
    p_attempt_id: parsed.data.attemptId, p_expected_version: version,
    p_summary: summary, p_question_results: summary.results,
  });
  if (finalized.error) {
    if (finalized.error.code === "40001") return Response.json({ error: "Answers changed during submission. Try again." }, { status: 409 });
    console.error("Assessment finalize failed", finalized.error);
    return Response.json({ error: "Unable to finalize assessment." }, { status: 503 });
  }
  return Response.json(finalized.data, { headers: { "cache-control": "private, no-store" } });
}

export async function GET(request: Request, context: Context) {
  const resolved = await resolve(context, "academics:read");
  const attemptId = uuid.safeParse(new URL(request.url).searchParams.get("attemptId"));
  if (!resolved || !attemptId.success) return Response.json({ error: "Invalid attempt." }, { status: 400 });
  const { authorized, testId } = resolved;
  const client = getPrepziiAdmin();
  let query = client.from("organization_assessment_attempts").select("*").eq("id", attemptId.data).eq("organization_id", authorized.context.organizationId).eq("test_id", testId);
  if (authorized.context.role === "STUDENT") query = query.eq("user_id", authorized.context.userId);
  const attempt = await query.maybeSingle<AttemptRow>();
  if (attempt.error || !attempt.data) return Response.json({ error: "Attempt not found." }, { status: 404 });
  const [test, schedule] = await Promise.all([
    client.from("institute_tests").select("result_release_policy,solution_release_policy,created_by").eq("id", testId).eq("institute_id", authorized.context.organizationId).single(),
    client.from("organization_test_schedules").select("ends_at").eq("id", attempt.data.schedule_id).eq("organization_id", authorized.context.organizationId).single(),
  ]);
  if (test.error || schedule.error) return Response.json({ error: "Unable to load attempt policy." }, { status: 503 });
  if (authorized.context.role === "TEACHER" && test.data.created_by !== authorized.context.userId) return Response.json({ error: "Forbidden" }, { status: 403 });
  const windowEnded = new Date(schedule.data.ends_at).getTime() <= Date.now();
  const staff = authorized.context.role !== "STUDENT";
  const resultsReleased = staff || attempt.data.results_released || test.data.result_release_policy === "IMMEDIATE" || (test.data.result_release_policy === "AFTER_WINDOW" && windowEnded);
  const solutionsReleased = staff || attempt.data.solutions_released || test.data.solution_release_policy === "IMMEDIATE" || (test.data.solution_release_policy === "AFTER_WINDOW" && windowEnded);
  const response: Record<string, unknown> = { id: attempt.data.id, status: attempt.data.status, submittedAt: attempt.data.submitted_at, resultsReleased, solutionsReleased };
  if (resultsReleased) response.result = { score: attempt.data.score, maxScore: attempt.data.max_score, percentage: attempt.data.percentage, correctCount: attempt.data.correct_count, incorrectCount: attempt.data.incorrect_count, unansweredCount: attempt.data.unanswered_count, questionResults: attempt.data.question_results };
  if (solutionsReleased) response.solutions = await loadQuestions(authorized.context.organizationId, testId);
  return Response.json(response, { headers: { "cache-control": "private, no-store" } });
}
