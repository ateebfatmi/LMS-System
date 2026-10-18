import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const createBase = z.object({
  title: z.string().trim().min(2).max(180), instructions: z.string().trim().min(1).max(10000),
  availableFrom: z.iso.datetime({ offset: true }).nullable().default(null), dueAt: z.iso.datetime({ offset: true }),
  maxMarks: z.number().positive().max(100000), rubric: z.array(z.object({ criterion: z.string().trim().min(1).max(240), marks: z.number().positive().max(100000) })).max(30).default([]),
  allowLate: z.boolean().default(false), maxAttempts: z.number().int().min(1).max(10).default(1),
});
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_ASSIGNMENT"), payload: z.discriminatedUnion("targetType", [
    createBase.extend({ targetType: z.literal("COURSE"), courseId: uuid }),
    createBase.extend({ targetType: z.literal("BATCH"), batchId: uuid }),
    createBase.extend({ targetType: z.literal("STUDENT"), studentUserId: z.string().min(1).max(200) }),
  ]) }),
  z.object({ action: z.literal("PUBLISH_ASSIGNMENT"), payload: z.object({ assignmentId: uuid, published: z.boolean() }) }),
  z.object({ action: z.literal("SUBMIT_ASSIGNMENT"), payload: z.object({ assignmentId: uuid, textResponse: z.string().trim().min(1).max(50000) }) }),
  z.object({ action: z.literal("GRADE_SUBMISSION"), payload: z.object({ submissionId: uuid, grade: z.number().min(0).max(100000), feedback: z.string().trim().max(10000).nullable().default(null) }) }),
  z.object({ action: z.literal("RETURN_SUBMISSION"), payload: z.object({ submissionId: uuid, feedback: z.string().trim().min(1).max(10000) }) }),
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

export async function GET(_request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "content:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const { organizationId, userId, role } = resolved.context;
  try {
    const staff = ["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR", "TEACHER"].includes(role);
    let assignments = await safeRows(client.from("organization_assignments").select("*").eq("organization_id", organizationId).order("due_at"));
    let assignedBatchIds: string[] = [];
    let assignedCourseIds: string[] = [];
    let assignedStudentIds: string[] = [];
    if (role === "STUDENT" || role === "TEACHER") {
      const enrolments = await safeRows(client.from("organization_batch_members").select("batch_id").eq("organization_id", organizationId).eq("user_id", userId).eq("role", role));
      assignedBatchIds = enrolments.map((row) => String(row.batch_id));
      if (assignedBatchIds.length) {
        const links = await safeRows(client.from("organization_course_batches").select("course_id").eq("organization_id", organizationId).in("batch_id", assignedBatchIds));
        assignedCourseIds = [...new Set(links.map((row) => String(row.course_id)))];
      }
      if (role === "TEACHER" && assignedBatchIds.length) {
        const students = await safeRows(client.from("organization_batch_members").select("user_id").eq("organization_id", organizationId).eq("role", "STUDENT").in("batch_id", assignedBatchIds));
        assignedStudentIds = [...new Set(students.map((row) => String(row.user_id)))];
      }
      if (assignments.length) {
        assignments = assignments.filter((assignment) =>
          (assignment.batch_id && assignedBatchIds.includes(String(assignment.batch_id)))
          || (assignment.course_id && assignedCourseIds.includes(String(assignment.course_id)))
          || (role === "STUDENT" ? assignment.student_user_id === userId : assignedStudentIds.includes(String(assignment.student_user_id))),
        );
      }
    }
    if (role === "STUDENT") {
      const now = Date.now();
      assignments = assignments.filter((assignment) => assignment.status === "PUBLISHED" && (!assignment.available_from || new Date(String(assignment.available_from)).getTime() <= now));
    }
    const assignmentIds = assignments.map((assignment) => String(assignment.id));
    let submissions: Row[] = [];
    let files: Row[] = [];
    if (assignmentIds.length) {
      let query = client.from("organization_assignment_submissions").select("*").eq("organization_id", organizationId).in("assignment_id", assignmentIds).order("submitted_at", { ascending: false });
      if (role === "STUDENT") query = query.eq("student_user_id", userId);
      submissions = await safeRows(query);
      const submissionIds = submissions.map((submission) => String(submission.id));
      if (submissionIds.length) files = await safeRows(client.from("organization_assignment_submission_files").select("id,submission_id,name,mime_type,byte_size,created_at").eq("organization_id", organizationId).in("submission_id", submissionIds));
    }
    let courses: Row[] = [];
    let batches: Row[] = [];
    let studentList: Row[] = [];
    if (staff) {
      courses = await safeRows(client.from("organization_courses").select("id,title").eq("organization_id", organizationId).order("title"));
      batches = await safeRows(client.from("organization_batches").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("name"));
      if (!batches.length) {
        batches = await safeRows(client.from("institute_batches").select("id,name").eq("institute_id", organizationId).order("name"));
      }
      const dirRpc = await safeRows(client.rpc("lms_list_members", { p_organization_id: organizationId, p_role: "STUDENT", p_status: "ACTIVE", p_search: null, p_limit: 200, p_offset: 0 }));
      if (dirRpc.length) {
        studentList = dirRpc;
      } else {
        const raw = await safeRows(client.from("institute_members").select("id,user_id,email,role,status").eq("institute_id", organizationId).eq("role", "STUDENT"));
        studentList = raw.map((m) => ({
          user_id: m.user_id,
          email: m.email,
          display_name: typeof m.email === "string" ? m.email.split("@")[0] : "Student",
        }));
      }
    }
    const scopedCourses = role === "TEACHER" ? courses.filter((course) => assignedCourseIds.includes(String(course.id))) : courses;
    const scopedBatches = role === "TEACHER" ? batches.filter((batch) => assignedBatchIds.includes(String(batch.id))) : batches;
    const scopedStudents = role === "TEACHER" ? studentList.filter((student: Row) => assignedStudentIds.includes(String(student.user_id))) : studentList;
    return Response.json({ assignments, submissions, files, courses: scopedCourses, batches: scopedBatches, students: scopedStudents, role }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Assignment workspace query failed", error);
    return Response.json({ assignments: [], submissions: [], files: [], courses: [], batches: [], students: [], role });
  }
}

export async function POST(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!slug.success || !parsed.success) return Response.json({ error: "Invalid assignment operation." }, { status: 400 });
  const permission = parsed.data.action === "SUBMIT_ASSIGNMENT" ? "content:read" : "content:manage";
  const resolved = await getAuthorizedOrganizationContext(slug.data, permission);
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  let payload: Record<string, unknown> = parsed.data.payload;
  if (parsed.data.action === "CREATE_ASSIGNMENT") {
    if (new Date(parsed.data.payload.dueAt).getTime() <= Date.now()) return Response.json({ error: "Due date must be in the future." }, { status: 400 });
    const rubricTotal = parsed.data.payload.rubric.reduce((total, item) => total + item.marks, 0);
    if (rubricTotal > parsed.data.payload.maxMarks) return Response.json({ error: "Rubric marks cannot exceed maximum marks." }, { status: 400 });
    payload = {
      ...parsed.data.payload,
      courseId: parsed.data.payload.targetType === "COURSE" ? parsed.data.payload.courseId : null,
      batchId: parsed.data.payload.targetType === "BATCH" ? parsed.data.payload.batchId : null,
      studentUserId: parsed.data.payload.targetType === "STUDENT" ? parsed.data.payload.studentUserId : null,
    };
  }
  const { data, error } = await getPrepziiAdmin().rpc("lms_assignment_mutation", {
    p_organization_id: resolved.context.organizationId, p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role, p_action: parsed.data.action, p_payload: payload,
  });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "You cannot access this assignment." }, { status: 403 });
    if (error.code === "22023" || error.code === "23514") return Response.json({ error: error.message }, { status: 400 });
    if (["23503", "23505"].includes(error.code ?? "")) return Response.json({ error: "Assignment conflicts with existing data." }, { status: 409 });
    console.error("Assignment mutation failed", error);
    return Response.json({ error: "Unable to save assignment." }, { status: 503 });
  }
  return Response.json({ result: data }, { status: 201 });
}
