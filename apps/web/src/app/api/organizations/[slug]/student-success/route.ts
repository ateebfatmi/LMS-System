import { calculateStudentRisk, recommendedActions } from "@prepzii/student-success";
import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("CREATE_INTERVENTION"),
    payload: z.object({
      studentUserId: z.string().min(1).max(200),
      batchId: uuid.nullable().default(null),
      riskScore: z.number().int().min(0).max(100),
      riskLevel: z.enum(["LOW", "WATCH", "HIGH", "CRITICAL"]),
      reasons: z.array(z.object({ code: z.string().max(60), label: z.string().max(240), contribution: z.number().int().min(0).max(100) })).max(10),
      recommendedActions: z.array(z.string().min(3).max(500)).max(10),
      actionPlan: z.string().trim().min(3).max(5000),
      ownerUserId: z.string().max(200).nullable().default(null),
      nextReviewOn: z.iso.date().nullable().default(null),
    }),
  }),
  z.object({
    action: z.literal("UPDATE_INTERVENTION"),
    payload: z.object({
      interventionId: uuid,
      status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "DISMISSED"]),
      actionPlan: z.string().trim().min(3).max(5000).optional(),
      resolutionNotes: z.string().trim().max(5000).nullable().default(null),
    }),
  }),
  z.object({
    action: z.literal("CREATE_REVISION_PLAN"),
    payload: z.object({
      interventionId: uuid,
      title: z.string().trim().min(2).max(180),
      goal: z.string().trim().min(3).max(2000),
      startsOn: z.iso.date(),
      targetDate: z.iso.date(),
      items: z.array(z.object({
        title: z.string().trim().min(2).max(240),
        kind: z.enum(["TOPIC", "PRACTICE", "TEST", "CLASS", "CHECK_IN"]),
        dueOn: z.iso.date(),
      })).min(1).max(50),
    }).refine((value) => value.targetDate >= value.startsOn, { message: "Target date must be on or after the start date." }),
  }),
]);

type Context = { params: Promise<{ slug: string }> };
type Row = Record<string, unknown>;

async function rows(query: PromiseLike<{ data: Row[] | null; error: { message?: string } | null }>): Promise<Row[]> {
  const result = await query;
  if (result.error) {
    if (result.error.message?.includes("schema cache") || result.error.message?.includes("does not exist")) {
      return [];
    }
    throw new Error(result.error.message || "Student-success query failed.");
  }
  return result.data ?? [];
}

function asTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

export async function GET(_request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  if (!parsedSlug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "organization:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const client = getPrepziiAdmin();
  const { organizationId, userId, role } = resolved.context;
  if (!["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER", "STUDENT", "PARENT"].includes(role)) {
    return Response.json({ error: "This role cannot access student-success records." }, { status: 403 });
  }
  try {
    const [directory, memberships, sessions, attendance, attempts, assignments, submissions, interventions, plans, guardianLinks] = await Promise.all([
      rows(client.rpc("lms_list_members", { p_organization_id: organizationId, p_role: "STUDENT", p_status: "ACTIVE", p_search: null, p_limit: 500, p_offset: 0 })),
      rows(client.from("organization_batch_members").select("batch_id,user_id,role").eq("organization_id", organizationId)),
      rows(client.from("organization_attendance_sessions").select("id,batch_id,session_date,created_at").eq("organization_id", organizationId)),
      rows(client.from("organization_attendance_records").select("session_id,student_id,status,created_at").eq("organization_id", organizationId)),
      rows(client.from("organization_assessment_attempts").select("user_id,percentage,submitted_at,status").eq("organization_id", organizationId).eq("status", "SUBMITTED")),
      rows(client.from("organization_assignments").select("id,batch_id,student_user_id,status,due_at").eq("organization_id", organizationId).eq("status", "PUBLISHED")),
      rows(client.from("organization_assignment_submissions").select("assignment_id,student_user_id,submitted_at,status").eq("organization_id", organizationId)),
      rows(client.from("organization_student_interventions").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false })),
      rows(client.from("organization_revision_plans").select("*").eq("organization_id", organizationId).order("target_date")),
      role === "PARENT"
        ? rows(client.from("organization_guardian_links").select("student_user_id").eq("organization_id", organizationId).eq("guardian_user_id", userId).eq("status", "APPROVED"))
        : Promise.resolve([]),
    ]);

    const assignedBatches = new Set(
      memberships.filter((item) => item.user_id === userId && item.role === "TEACHER").map((item) => String(item.batch_id)),
    );
    const teacherStudentIds = new Set(
      memberships.filter((item) => item.role === "STUDENT" && assignedBatches.has(String(item.batch_id))).map((item) => String(item.user_id)),
    );
    const guardianStudentIds = new Set(guardianLinks.map((item) => String(item.student_user_id)));
    const visibleStudentIds = role === "STUDENT"
      ? new Set([userId])
      : role === "PARENT"
        ? guardianStudentIds
        : role === "TEACHER"
          ? teacherStudentIds
          : null;
    const sessionById = new Map(sessions.map((item) => [String(item.id), item]));
    const batchIdsByStudent = new Map<string, string[]>();
    for (const membership of memberships.filter((item) => item.role === "STUDENT")) {
      const studentId = String(membership.user_id);
      batchIdsByStudent.set(studentId, [...(batchIdsByStudent.get(studentId) ?? []), String(membership.batch_id)]);
    }

    const students = directory
      .filter((student) => !visibleStudentIds || visibleStudentIds.has(String(student.user_id)))
      .map((student) => {
        const studentId = String(student.user_id);
        const batchIds = batchIdsByStudent.get(studentId) ?? [];
        const studentAttendance = attendance.filter((item) => item.student_id === studentId);
        const presentCount = studentAttendance.filter((item) => ["PRESENT", "LATE", "EXCUSED"].includes(String(item.status))).length;
        const attendancePercentage = studentAttendance.length ? Math.round(presentCount / studentAttendance.length * 100) : null;
        const studentAttempts = attempts.filter((item) => item.user_id === studentId && item.percentage !== null);
        const assessmentAverage = studentAttempts.length
          ? Math.round(studentAttempts.reduce((sum, item) => sum + Number(item.percentage), 0) / studentAttempts.length)
          : null;
        const visibleAssignments = assignments.filter((item) => item.student_user_id === studentId || (item.batch_id && batchIds.includes(String(item.batch_id))));
        const submittedIds = new Set(submissions.filter((item) => item.student_user_id === studentId).map((item) => String(item.assignment_id)));
        const assignmentCompletion = visibleAssignments.length ? Math.round(visibleAssignments.filter((item) => submittedIds.has(String(item.id))).length / visibleAssignments.length * 100) : null;
        const activityTimes = [
          ...studentAttendance.map((item) => asTimestamp(item.created_at) ?? asTimestamp(sessionById.get(String(item.session_id))?.session_date)),
          ...studentAttempts.map((item) => asTimestamp(item.submitted_at)),
          ...submissions.filter((item) => item.student_user_id === studentId).map((item) => asTimestamp(item.submitted_at)),
        ].filter((value): value is number => value !== null);
        const lastActivityAt = activityTimes.length ? new Date(Math.max(...activityTimes)).toISOString() : null;
        const daysSinceLastActivity = lastActivityAt ? Math.max(0, Math.floor((Date.now() - new Date(lastActivityAt).getTime()) / 86_400_000)) : null;
        const signals = { attendancePercentage, assessmentAverage, assignmentCompletion, daysSinceLastActivity };
        const risk = calculateStudentRisk(signals);
        const activeIntervention = interventions.find((item) => item.student_user_id === studentId && ["OPEN", "IN_PROGRESS"].includes(String(item.status))) ?? null;
        return {
          userId: studentId,
          displayName: String(student.display_name ?? student.email ?? "Student"),
          email: String(student.email ?? ""),
          rollNumber: student.roll_number ? String(student.roll_number) : null,
          batchIds,
          signals,
          lastActivityAt,
          risk: { ...risk, recommendedActions: recommendedActions(risk) },
          activeIntervention,
        };
      })
      .sort((left, right) => right.risk.score - left.risk.score);

    const allowedIds = new Set(students.map((student) => student.userId));
    return Response.json({
      role,
      students,
      interventions: interventions.filter((item) => allowedIds.has(String(item.student_user_id))),
      revisionPlans: plans.filter((item) => allowedIds.has(String(item.student_user_id))),
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Student-success workspace query failed", error);
    return Response.json({ error: "Unable to load student-success signals." }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsedSlug.success || !parsed.success) {
    return Response.json({ error: parsed.success ? "Invalid organization." : parsed.error.issues[0]?.message ?? "Invalid operation." }, { status: 400 });
  }
  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "reports:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await getPrepziiAdmin().rpc("lms_student_success_mutation", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_action: parsed.data.action,
    p_payload: parsed.data.payload,
  });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "You cannot manage this student." }, { status: 403 });
    if (["22023", "23514"].includes(error.code ?? "")) return Response.json({ error: error.message }, { status: 400 });
    if (error.code === "23505") return Response.json({ error: "This student already has an active intervention." }, { status: 409 });
    if (error.code === "23503") return Response.json({ error: "The student or intervention no longer exists." }, { status: 404 });
    console.error("Student-success mutation failed", error);
    return Response.json({ error: "Unable to save the intervention." }, { status: 500 });
  }
  return Response.json({ result: data });
}
