import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const releasePolicy = z.enum(["IMMEDIATE", "AFTER_WINDOW", "MANUAL"]);
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_TEST"), payload: z.object({ title: z.string().trim().min(2).max(180), exam: z.string().trim().min(2).max(80), subject: z.string().trim().min(2).max(120), chapters: z.array(z.string().trim().min(1).max(160)).max(30).default([]), difficulty: z.enum(["easy", "medium", "hard", "mixed"]), durationMinutes: z.number().int().min(1).max(360), maxAttempts: z.number().int().min(1).max(10), resultReleasePolicy: releasePolicy, solutionReleasePolicy: releasePolicy }) }),
  z.object({ action: z.literal("ADD_QUESTION"), payload: z.object({ testId: uuid, questionId: uuid, questionOrder: z.number().int().min(1).max(1000).optional() }) }),
  z.object({ action: z.literal("SCHEDULE_TEST"), payload: z.object({ testId: uuid, batchId: uuid, startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }) }) }),
  z.object({ action: z.literal("PUBLISH_TEST"), payload: z.object({ testId: uuid, published: z.boolean() }) }),
  z.object({ action: z.enum(["RELEASE_RESULTS", "RELEASE_SOLUTIONS"]), payload: z.object({ testId: uuid }) }),
  z.object({ action: z.literal("GRADE_DESCRIPTIVE"), payload: z.object({ submissionId: uuid, awardedMarks: z.number().min(0).max(100000), feedback: z.string().trim().min(1).max(10000), isModeration: z.boolean().default(false) }) }),
]);
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
  const client = getPrepziiAdmin();
  const { organizationId, userId, role } = resolved.context;
  try {
    let tests = await safeRows(client.from("institute_tests").select("id,title,exam,subject,chapters,difficulty,duration_minutes,total_questions,status,created_by,published_at,max_attempts,result_release_policy,solution_release_policy,created_at").eq("institute_id", organizationId).order("created_at", { ascending: false }));
    const allSchedules = await safeRows(client.from("organization_test_schedules").select("id,test_id,batch_id,starts_at,ends_at,is_strict_timing").eq("organization_id", organizationId).order("starts_at"));
    let schedules = allSchedules;
    if (role === "STUDENT") {
      const enrolments = await safeRows(client.from("organization_batch_members").select("batch_id").eq("organization_id", organizationId).eq("user_id", userId).eq("role", "STUDENT"));
      const batchIds = enrolments.map((row) => String(row.batch_id));
      schedules = allSchedules.filter((schedule) => batchIds.includes(String(schedule.batch_id)));
      const testIds = new Set(schedules.map((schedule) => String(schedule.test_id)));
      if (schedules.length) {
        tests = tests.filter((test) => test.status === "PUBLISHED" && testIds.has(String(test.id)));
      }
    } else if (role === "TEACHER") {
      tests = tests.filter((test) => test.created_by === userId);
      const testIds = new Set(tests.map((test) => String(test.id)));
      schedules = allSchedules.filter((schedule) => testIds.has(String(schedule.test_id)));
    }
    const testIds = tests.map((test) => String(test.id));
    let questionLinks = testIds.length ? await safeRows(client.from("institute_test_questions").select("id,institute_test_id,question_id,question_order").eq("institute_id", organizationId).in("institute_test_id", testIds).order("question_order")) : [];
    if (!questionLinks.length && testIds.length) {
      questionLinks = await safeRows(client.from("test_questions").select("id,test_id,question_id,question_order").in("test_id", testIds).order("question_order"));
    }
    let attempts: Row[] = [];
    let descriptiveSubmissions: Row[] = [];
    if (testIds.length) {
      let query = client.from("organization_assessment_attempts").select("id,test_id,schedule_id,user_id,attempt_number,status,started_at,expires_at,submitted_at,score,max_score,percentage,correct_count,incorrect_count,unanswered_count,results_released,solutions_released").eq("organization_id", organizationId).in("test_id", testIds).order("started_at", { ascending: false });
      if (role === "STUDENT") query = query.eq("user_id", userId);
      attempts = await safeRows(query);
      if (!attempts.length) {
        let legacyQuery = client.from("test_attempts").select("id,test_id,user_id,score,total_marks,started_at,submitted_at,status,correct,wrong,skipped,accuracy").in("test_id", testIds);
        if (role === "STUDENT") legacyQuery = legacyQuery.eq("user_id", userId);
        const rawLegacy = await safeRows(legacyQuery);
        attempts = rawLegacy.map((a) => ({
          id: a.id,
          test_id: a.test_id,
          schedule_id: null,
          user_id: a.user_id,
          attempt_number: 1,
          status: a.status === "completed" ? "SUBMITTED" : "IN_PROGRESS",
          started_at: a.started_at,
          expires_at: null,
          submitted_at: a.submitted_at,
          score: a.score ?? 0,
          max_score: a.total_marks ?? 100,
          percentage: a.total_marks ? Math.round(((Number(a.score) || 0) / Number(a.total_marks)) * 100) : 0,
          correct_count: a.correct ?? 0,
          incorrect_count: a.wrong ?? 0,
          unanswered_count: a.skipped ?? 0,
          results_released: true,
          solutions_released: true,
        }));
      }
      let descriptiveQuery = client.from("organization_descriptive_submissions").select("id,attempt_id,test_id,question_id,student_user_id,answer_text,file_url,max_marks,awarded_marks,feedback,evaluator_user_id,status,moderator_user_id,moderator_notes,graded_at,moderated_at,created_at").eq("organization_id", organizationId).in("test_id", testIds).order("created_at");
      if (role === "STUDENT") descriptiveQuery = descriptiveQuery.eq("student_user_id", userId);
      descriptiveSubmissions = await safeRows(descriptiveQuery);
    }
    const staff = role !== "STUDENT";
    let batches = staff ? await safeRows(client.from("organization_batches").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("name")) : [];
    if (!batches.length && staff) {
      batches = await safeRows(client.from("institute_batches").select("id,name").eq("institute_id", organizationId).order("name"));
    }
    let bankQuestions: Row[] = [];
    if (staff) {
      const search = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
      let questionQuery = client.from("questions").select("id,exam,subject,chapter,topic,difficulty,question_type,question_text,marks,negative_marks").limit(50);
      if (search) questionQuery = questionQuery.ilike("question_text", `%${search}%`);
      bankQuestions = await safeRows(questionQuery);
    }
    return Response.json({ tests, schedules, questionLinks, attempts, descriptiveSubmissions, batches, bankQuestions, role }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Assessment workspace query failed", error);
    return Response.json({ tests: [], schedules: [], questionLinks: [], attempts: [], descriptiveSubmissions: [], batches: [], bankQuestions: [], role });
  }
}

export async function POST(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!slug.success || !parsed.success) return Response.json({ error: "Invalid assessment operation." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "assessments:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (parsed.data.action === "SCHEDULE_TEST" && parsed.data.payload.endsAt <= parsed.data.payload.startsAt) {
    return Response.json({ error: "Assessment end must be after its start." }, { status: 400 });
  }
  const { data, error } = parsed.data.action === "GRADE_DESCRIPTIVE"
    ? await getPrepziiAdmin().rpc("lms_grade_descriptive_submission", {
        p_organization_id: resolved.context.organizationId,
        p_submission_id: parsed.data.payload.submissionId,
        p_actor_user_id: resolved.context.userId,
        p_actor_role: resolved.context.role,
        p_awarded_marks: parsed.data.payload.awardedMarks,
        p_feedback: parsed.data.payload.feedback,
        p_is_moderation: parsed.data.payload.isModeration,
      })
    : await getPrepziiAdmin().rpc("lms_assessment_mutation", {
        p_organization_id: resolved.context.organizationId, p_actor_user_id: resolved.context.userId,
        p_actor_role: resolved.context.role, p_action: parsed.data.action, p_payload: parsed.data.payload,
      });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "You cannot manage this assessment." }, { status: 403 });
    if (["22023", "23514"].includes(error.code ?? "")) return Response.json({ error: error.message }, { status: 400 });
    if (["23503", "23505"].includes(error.code ?? "")) return Response.json({ error: "Assessment conflicts with existing data." }, { status: 409 });
    console.error("Assessment mutation failed", error);
    return Response.json({ error: "Unable to save assessment." }, { status: 503 });
  }
  return Response.json({ result: data }, { status: 201 });
}
