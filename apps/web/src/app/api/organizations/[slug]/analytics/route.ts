import { requireDatabaseQuery } from "@/lib/database-query";
import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
type Context = { params: Promise<{ slug: string }> };
type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: { message: string } | null };

function rows(query: PromiseLike<Result>): Promise<Row[]> {
  return requireDatabaseQuery(query, [], "Load analytics");
}

const assignmentDashboardSchema = z.object({
  assignmentCount: z.number(),
  submittedCount: z.number(),
  assignmentsWithSubmissions: z.number(),
  pendingGrading: z.number().nullable(),
  pendingAssignments: z.array(z.record(z.string(), z.unknown())),
  assignments: z.array(z.record(z.string(), z.unknown())),
});
const emptyAssignmentDashboard = {
  assignmentCount: 0, submittedCount: 0, assignmentsWithSubmissions: 0,
  pendingGrading: null, pendingAssignments: [], assignments: [],
};
const attendanceDashboardSchema = z.object({
  rate: z.number().nullable(),
  trend: z.array(z.object({ date: z.iso.date(), rate: z.number() })),
});
const emptyAttendanceDashboard = { rate: null, trend: [] };

export async function GET(_request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const report = new URL(_request.url).searchParams.get("report") === "1";
  const resolved = await getAuthorizedOrganizationContext(slug.data, report ? "reports:read" : "organization:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const { organizationId, userId, role } = resolved.context;
  const leadership = ["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR"].includes(role);
  const teacher = role === "TEACHER";
  const student = role === "STUDENT";

  try {
    const assignmentDashboardPromise = requireDatabaseQuery<unknown>(
      client.rpc("lms_assignment_dashboard", {
        p_organization_id: organizationId, p_user_id: userId, p_role: role,
      }),
      emptyAssignmentDashboard,
      "Load assignment dashboard",
    ).then((data) => assignmentDashboardSchema.parse(data));

    const batchesPromise = (async () => {
      if (!(leadership || teacher || student)) return [];
      const canonical = await rows(client.from("organization_batches").select("id,name,target_exam,grade_level,is_active").eq("organization_id", organizationId).eq("is_active", true).order("name"));
      if (canonical.length) return canonical;
      const legacy = await rows(client.from("institute_batches").select("id,name,exam,target_year").eq("institute_id", organizationId));
      return legacy.map((batch) => ({
        id: batch.id,
        name: batch.name,
        target_exam: batch.exam || null,
        grade_level: batch.target_year ? `Target ${batch.target_year}` : null,
        is_active: true,
      }));
    })();

    const leadershipMembershipsPromise = leadership
      ? (async () => {
          const canonical = await rows(client.from("organization_batch_members").select("id,batch_id,user_id,role,roll_number").eq("organization_id", organizationId));
          return canonical.length
            ? canonical
            : rows(client.from("institute_batch_members").select("id,batch_id,member_id").eq("institute_id", organizationId));
        })()
      : Promise.resolve([] as Row[]);

    const [allBatches, leadershipMemberships, assignmentData] = await Promise.all([
      batchesPromise,
      leadershipMembershipsPromise,
      assignmentDashboardPromise,
    ]);

    let memberships: Row[] = [];
    let visibleBatchIds: string[] = [];
    if (leadership) {
      memberships = leadershipMemberships;
      visibleBatchIds = allBatches.map((batch) => String(batch.id));
    } else if (teacher) {
      const own = await rows(client.from("organization_batch_members").select("id,batch_id,user_id,role,roll_number").eq("organization_id", organizationId).eq("user_id", userId).eq("role", "TEACHER"));
      visibleBatchIds = own.map((item) => String(item.batch_id));
      memberships = visibleBatchIds.length ? await rows(client.from("organization_batch_members").select("id,batch_id,user_id,role,roll_number").eq("organization_id", organizationId).in("batch_id", visibleBatchIds)) : [];
    } else if (student) {
      memberships = await rows(client.from("organization_batch_members").select("id,batch_id,user_id,role,roll_number").eq("organization_id", organizationId).eq("user_id", userId).eq("role", "STUDENT"));
      visibleBatchIds = memberships.map((item) => String(item.batch_id));
    }
    const visibleBatches = new Set(visibleBatchIds);
    const studentsByBatch = new Map<unknown, number>();
    for (const member of memberships) {
      if (member.role === "STUDENT" || !member.role) {
        studentsByBatch.set(member.batch_id, (studentsByBatch.get(member.batch_id) ?? 0) + 1);
      }
    }
    const batches = allBatches.filter((batch) => visibleBatches.has(String(batch.id)))
      .map((batch) => ({ ...batch, student_count: studentsByBatch.get(batch.id) ?? 0 }));

    const attendancePromise = visibleBatchIds.length ? requireDatabaseQuery<unknown>(
      client.rpc("lms_attendance_dashboard", {
        p_organization_id: organizationId,
        p_batch_ids: visibleBatchIds,
        p_student_id: student ? userId : null,
      }),
      emptyAttendanceDashboard,
      "Load attendance dashboard",
    ).then((data) => attendanceDashboardSchema.parse(data)) : Promise.resolve(emptyAttendanceDashboard);

    const attemptsPromise = (async () => {
      let attempts: Row[] = [];
      if (leadership) {
        attempts = await rows(client.from("organization_assessment_attempts").select("id,test_id,user_id,status,score,max_score,percentage,submitted_at").eq("organization_id", organizationId).order("started_at", { ascending: false }).limit(100));
        if (!attempts.length) {
          const tests = await rows(client.from("institute_tests").select("id").eq("institute_id", organizationId));
          const testIds = tests.map(({ id }) => String(id));
          const legacy = testIds.length ? await rows(client.from("test_attempts").select("id,user_id,status,score,total_marks,submitted_at").in("test_id", testIds).order("started_at", { ascending: false }).limit(20)) : [];
          attempts = legacy.map((a) => ({
            id: a.id,
            user_id: a.user_id,
            status: a.status === "completed" || a.submitted_at ? "SUBMITTED" : "IN_PROGRESS",
            score: a.score,
            max_score: a.total_marks,
            percentage: Number(a.total_marks) > 0 && a.score != null ? Math.round(Number(a.score) / Number(a.total_marks) * 100) : null,
            submitted_at: a.submitted_at,
          }));
        }
      } else if (teacher) {
        const tests = await rows(client.from("institute_tests").select("id,title").eq("institute_id", organizationId).eq("created_by", userId));
        const testIds = tests.map((test) => String(test.id));
        const schedules = visibleBatchIds.length ? await rows(client.from("organization_test_schedules").select("id")
          .eq("organization_id", organizationId).in("batch_id", visibleBatchIds)) : [];
        const scheduleIds = schedules.map(({ id }) => String(id));
        attempts = testIds.length && scheduleIds.length ? await rows(client.from("organization_assessment_attempts").select("id,test_id,user_id,status,score,max_score,percentage,submitted_at").eq("organization_id", organizationId).in("test_id", testIds).in("schedule_id", scheduleIds).order("started_at", { ascending: false }).limit(100)) : [];
      } else if (student) {
        attempts = await rows(client.from("organization_assessment_attempts").select("id,test_id,user_id,status,score,max_score,percentage,submitted_at").eq("organization_id", organizationId).eq("user_id", userId).eq("status", "SUBMITTED").eq("results_released", true).order("started_at", { ascending: false }).limit(50));
      }
      return attempts;
    })();

    const upcomingPromise = (async () => {
      if ((!teacher && !student) || !visibleBatchIds.length) return [];
      const schedules = await rows(client.from("organization_test_schedules").select("id,test_id,starts_at,ends_at")
        .eq("organization_id", organizationId).in("batch_id", visibleBatchIds).gte("ends_at", new Date().toISOString())
        .order("starts_at").limit(50));
      if (!schedules.length) return [];
      const tests = await rows(client.from("institute_tests").select("id,title").eq("institute_id", organizationId)
        .eq("status", "PUBLISHED").in("id", schedules.map(({ test_id }) => String(test_id))));
      const titles = new Map(tests.map(({ id, title }) => [id, title]));
      return schedules.filter(({ test_id }) => titles.has(test_id)).slice(0, 8)
        .map(({ id, starts_at, ends_at, test_id }) => ({ id, title: titles.get(test_id), starts_at, ends_at }));
    })();
    const classesPromise = teacher && visibleBatchIds.length ? rows(client.from("organization_room_schedules")
      .select("id,subject,day_of_week,starts_at,ends_at").eq("organization_id", organizationId)
      .eq("faculty_id", userId).in("batch_id", visibleBatchIds).order("day_of_week").order("starts_at").limit(12)) : Promise.resolve([]);

    const noticesPromise = (student || role === "PARENT") ? (async () => {
      const audiences = role === "PARENT" ? ["ALL", "PARENTS"] : ["ALL", "STUDENTS"];
      const base = () => client.from("organization_announcements").select("id,title,published_at")
        .eq("organization_id", organizationId).eq("status", "PUBLISHED").order("published_at", { ascending: false });
      const [general, targeted] = await Promise.all([
        rows(base().in("target_audience", audiences).limit(5)),
        student && visibleBatchIds.length ? rows(base().eq("target_audience", "BATCH").in("batch_id", visibleBatchIds).limit(5)) : [],
      ]);
      return [...general, ...targeted].sort((a, b) => String(b.published_at).localeCompare(String(a.published_at))).slice(0, 5);
    })() : Promise.resolve([]);
    const [attendance, attempts, upcoming, classes, notices] = await Promise.all([
      attendancePromise, attemptsPromise, upcomingPromise, classesPromise, noticesPromise,
    ]);

    const submittedAttempts = attempts.filter((attempt) => attempt.status === "SUBMITTED");
    const scores = submittedAttempts.flatMap(({ percentage }) => percentage === null || percentage === undefined ? [] : [Number(percentage)]).filter(Number.isFinite);

    return Response.json({
      role, upcoming, classes, notices,
      pendingAssignments: assignmentData.pendingAssignments,
      pendingGrading: assignmentData.pendingGrading,
      summary: {
        students: leadership || teacher ? new Set(memberships.filter((item) => item.role === "STUDENT" && item.user_id).map((item) => item.user_id)).size : student ? 1 : null,
        activeBatches: batches.length,
        attendanceRate: attendance.rate,
        assessmentAverage: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 10) / 10 : null,
        assignments: assignmentData.assignmentCount,
        submittedAssignments: assignmentData.submittedCount,
        assignmentsWithSubmissions: assignmentData.assignmentsWithSubmissions,
      },
      batches, attendanceTrend: attendance.trend, attempts: submittedAttempts.slice(0, 20), assignments: assignmentData.assignments,
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Analytics query failed", error);
    return Response.json({ error: "Unable to load analytics." }, { status: 503 });
  }
}
