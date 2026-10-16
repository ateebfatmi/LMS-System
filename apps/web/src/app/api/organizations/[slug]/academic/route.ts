import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_ACADEMIC_YEAR"), payload: z.object({ name: z.string().trim().min(2).max(80), startsOn: z.iso.date(), endsOn: z.iso.date(), isActive: z.boolean().default(false) }) }),
  z.object({ action: z.literal("CREATE_CAMPUS"), payload: z.object({ name: z.string().trim().min(2).max(120), address: z.record(z.string(), z.unknown()).default({}) }) }),
  z.object({ action: z.literal("CREATE_SUBJECT"), payload: z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().max(30).nullable().default(null) }) }),
  z.object({ action: z.literal("CREATE_BATCH"), payload: z.object({ name: z.string().trim().min(2).max(120), targetExam: z.enum(["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION", "BOARDS", "OTHER"]), gradeLevel: z.string().trim().max(60).nullable(), roomNumber: z.string().trim().max(60).nullable(), campusId: uuid.nullable(), academicYearId: uuid.nullable() }) }),
  z.object({ action: z.literal("CREATE_COURSE"), payload: z.object({ title: z.string().trim().min(2).max(180), description: z.string().trim().max(2000).nullable(), subjectId: uuid.nullable() }) }),
  z.object({ action: z.literal("ENROLL_MEMBER"), payload: z.object({ batchId: uuid, memberId: uuid, rollNumber: z.string().trim().max(60).nullable() }) }),
  z.object({ action: z.literal("CREATE_ROOM"), payload: z.object({ campusId: uuid, name: z.string().trim().min(1).max(80), capacity: z.number().int().min(1).max(1000), facilities: z.array(z.enum(["SMART_BOARD", "PROJECTOR", "AC", "LAB_BENCHES", "CCTV", "AUDIO_MIC"])).max(12).default([]) }) }),
  z.object({ action: z.literal("CREATE_SCHEDULE"), payload: z.object({ roomId: uuid, batchId: uuid, facultyMemberId: uuid, subject: z.string().trim().min(2).max(120), dayOfWeek: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]), startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }) }),
]);
type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  if (!parsedSlug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "academics:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const organizationId = resolved.context.organizationId;
  const [years, campuses, batches, subjects, courses, rooms, schedules, students, faculty] = await Promise.all([
    client.from("organization_academic_years").select("*").eq("organization_id", organizationId).order("starts_on", { ascending: false }),
    client.from("organization_campuses").select("*").eq("organization_id", organizationId).order("name"),
    client.from("organization_batches").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    client.from("organization_subjects").select("*").eq("organization_id", organizationId).order("name"),
    client.from("organization_courses").select("*").eq("organization_id", organizationId).order("created_at", { ascending: false }),
    client.from("organization_campus_rooms").select("*").eq("organization_id", organizationId).order("name"),
    client.from("organization_room_schedules").select("*").eq("organization_id", organizationId).order("day_of_week"),
    client.rpc("lms_list_members", { p_organization_id: organizationId, p_role: "STUDENT", p_status: "ACTIVE", p_search: null, p_limit: 100, p_offset: 0 }),
    client.rpc("lms_list_members", { p_organization_id: organizationId, p_role: "TEACHER", p_status: "ACTIVE", p_search: null, p_limit: 100, p_offset: 0 }),
  ]);
  const failed = [years, campuses, batches, subjects, courses, rooms, schedules, students, faculty].find((result) => result.error);
  if (failed?.error) {
    console.error("Academic workspace query failed", failed.error);
    return Response.json({ error: "Unable to load academic workspace." }, { status: 503 });
  }
  return Response.json({
    academicYears: years.data ?? [], campuses: campuses.data ?? [], batches: batches.data ?? [],
    subjects: subjects.data ?? [], courses: courses.data ?? [], rooms: rooms.data ?? [], schedules: schedules.data ?? [],
    students: students.data ?? [], faculty: faculty.data ?? [],
  });
}

export async function POST(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsedSlug.success || !parsed.success) return Response.json({ error: "Invalid academic operation." }, { status: 400 });
  const permission = parsed.data.action === "CREATE_COURSE" ? "content:manage" : "academics:manage";
  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, permission);
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (parsed.data.action === "CREATE_SCHEDULE" && parsed.data.payload.endsAt <= parsed.data.payload.startsAt) {
    return Response.json({ error: "Schedule end time must be after start time." }, { status: 400 });
  }
  const { data, error } = await getPrepziiAdmin().rpc("lms_academic_mutation", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_action: parsed.data.action,
    p_payload: parsed.data.payload,
  });
  if (error) {
    if (["23503", "23505", "23P01"].includes(error.code ?? "")) return Response.json({ error: error.code === "23P01" ? "That room, batch, or faculty member already has an overlapping schedule." : "Academic record conflicts with existing data." }, { status: 409 });
    console.error("Academic mutation failed", error);
    return Response.json({ error: "Unable to save academic operation." }, { status: 503 });
  }
  return Response.json({ result: data }, { status: 201 });
}
