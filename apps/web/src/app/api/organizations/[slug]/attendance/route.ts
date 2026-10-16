import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const attendanceStatus = z.enum(["PRESENT", "ABSENT", "LATE", "EXCUSED"]);
const saveSchema = z.object({
  batchId: uuid,
  sessionDate: z.iso.date(),
  sessionLabel: z.string().trim().min(2).max(120),
  startsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  endsAt: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
  correctionReason: z.string().trim().max(500).nullable().default(null),
  records: z.array(z.object({ studentId: z.string().min(1).max(160), status: attendanceStatus, remarks: z.string().trim().max(500).nullable().default(null) })).min(1).max(500),
});
type Context = { params: Promise<{ slug: string }> };
type Row = Record<string, unknown>;

async function many(query: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function GET(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "attendance:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const { organizationId, userId, role } = resolved.context;
  const params = new URL(request.url).searchParams;
  const batchId = uuid.safeParse(params.get("batchId"));
  const sessionDate = z.iso.date().safeParse(params.get("date"));
  try {
    let batches = await many(client.from("organization_batches").select("id,name,target_exam,is_active").eq("organization_id", organizationId).eq("is_active", true).order("name"));
    if (["TEACHER", "STUDENT"].includes(role)) {
      const assigned = await many(client.from("organization_batch_members").select("batch_id").eq("organization_id", organizationId).eq("user_id", userId).eq("role", role));
      const ids = new Set(assigned.map((row) => String(row.batch_id)));
      batches = batches.filter((batch) => ids.has(String(batch.id)));
    }
    const allowedIds = new Set(batches.map((batch) => String(batch.id)));
    const selectedBatchId = batchId.success && allowedIds.has(batchId.data) ? batchId.data : String(batches[0]?.id ?? "");
    let students: Row[] = [];
    if (selectedBatchId && role !== "STUDENT") {
      const [enrolments, directory] = await Promise.all([
        many(client.from("organization_batch_members").select("user_id,roll_number").eq("organization_id", organizationId).eq("batch_id", selectedBatchId).eq("role", "STUDENT").order("roll_number")),
        client.rpc("lms_list_members", { p_organization_id: organizationId, p_role: "STUDENT", p_status: "ACTIVE", p_search: null, p_limit: 500, p_offset: 0 }),
      ]);
      if (directory.error) throw new Error(directory.error.message);
      const byUser = new Map(((directory.data ?? []) as Row[]).map((member) => [String(member.user_id), member]));
      students = enrolments.map((enrolment) => ({ ...enrolment, ...(byUser.get(String(enrolment.user_id)) ?? {}), user_id: enrolment.user_id, roll_number: enrolment.roll_number }));
    }
    let sessions: Row[] = [];
    if (selectedBatchId) {
      let query = client.from("organization_attendance_sessions").select("id,batch_id,session_date,session_label,starts_at,ends_at,marked_by,finalized_at,updated_at").eq("organization_id", organizationId).eq("batch_id", selectedBatchId).order("session_date", { ascending: false }).limit(90);
      if (sessionDate.success) query = query.eq("session_date", sessionDate.data);
      sessions = await many(query);
    }
    const sessionIds = sessions.map((session) => String(session.id));
    let records: Row[] = [];
    let corrections: Row[] = [];
    if (sessionIds.length) {
      let recordQuery = client.from("organization_attendance_records").select("id,session_id,student_id,status,remarks,created_at").eq("organization_id", organizationId).in("session_id", sessionIds);
      if (role === "STUDENT") recordQuery = recordQuery.eq("student_id", userId);
      records = await many(recordQuery);
      corrections = await many(client.from("organization_attendance_corrections").select("id,session_id,attendance_record_id,student_id,previous_status,corrected_status,reason,corrected_by,created_at").eq("organization_id", organizationId).in("session_id", sessionIds).order("created_at", { ascending: false }));
      if (role === "STUDENT") corrections = corrections.filter((row) => row.student_id === userId);
    }
    return Response.json({ role, batches, selectedBatchId, students, sessions, records, corrections }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Attendance workspace query failed", error);
    return Response.json({ error: "Unable to load attendance." }, { status: 503 });
  }
}

export async function POST(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!slug.success || !parsed.success) return Response.json({ error: "Invalid attendance register." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "attendance:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (parsed.data.startsAt && parsed.data.endsAt && parsed.data.endsAt <= parsed.data.startsAt) return Response.json({ error: "Session end must follow start." }, { status: 400 });
  const { data, error } = await getPrepziiAdmin().rpc("lms_save_attendance", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_batch_id: parsed.data.batchId,
    p_session_date: parsed.data.sessionDate,
    p_session_label: parsed.data.sessionLabel,
    p_starts_at: parsed.data.startsAt,
    p_ends_at: parsed.data.endsAt,
    p_records: parsed.data.records,
    p_correction_reason: parsed.data.correctionReason,
  });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "You cannot mark attendance for that batch." }, { status: 403 });
    if (["22023", "23503", "23505"].includes(error.code ?? "")) return Response.json({ error: error.message }, { status: 400 });
    console.error("Attendance save failed", error);
    return Response.json({ error: "Unable to save attendance." }, { status: 503 });
  }
  return Response.json({ result: data });
}
