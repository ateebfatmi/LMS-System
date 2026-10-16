import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";
import { parseApprovedExternalUrl } from "@prepzii/learning";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const optionalDateTime = z.iso.datetime({ offset: true }).nullable().default(null);
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("LINK_BATCH"), payload: z.object({ courseId: uuid, batchId: uuid }) }),
  z.object({ action: z.literal("CREATE_MODULE"), payload: z.object({ courseId: uuid, title: z.string().trim().min(2).max(180), description: z.string().trim().max(2000).nullable().default(null), orderIndex: z.number().int().min(0).max(10000).default(0), releaseAt: optionalDateTime }) }),
  z.object({ action: z.literal("CREATE_LESSON"), payload: z.object({ moduleId: uuid, title: z.string().trim().min(2).max(180), kind: z.enum(["VIDEO", "DOCUMENT", "DPP", "LIVE_CLASS"]), description: z.string().trim().max(5000).nullable().default(null), learningObjectives: z.array(z.string().trim().min(1).max(240)).max(20).default([]), durationMinutes: z.number().int().min(1).max(1440).nullable().default(null), orderIndex: z.number().int().min(0).max(10000).default(0), releaseAt: optionalDateTime }) }),
  z.object({ action: z.literal("REORDER_MODULE"), payload: z.object({ moduleId: uuid, orderIndex: z.number().int().min(0).max(10000) }) }),
  z.object({ action: z.enum(["PUBLISH_COURSE"]), payload: z.object({ courseId: uuid, published: z.boolean() }) }),
  z.object({ action: z.enum(["PUBLISH_MODULE"]), payload: z.object({ moduleId: uuid, published: z.boolean() }) }),
  z.object({ action: z.enum(["PUBLISH_LESSON"]), payload: z.object({ lessonId: uuid, published: z.boolean() }) }),
  z.object({ action: z.literal("CREATE_EXTERNAL_RESOURCE"), payload: z.object({ lessonId: uuid, name: z.string().trim().min(1).max(180), externalUrl: z.string().trim().max(2048), downloadAllowed: z.boolean().default(false) }) }),
  z.object({ action: z.literal("MARK_COMPLETE"), payload: z.object({ lessonId: uuid }) }),
]);
type Context = { params: Promise<{ slug: string }> };
type Row = Record<string, unknown>;

async function rows(query: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function GET(_request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  if (!parsedSlug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "content:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const { organizationId, userId, role } = resolved.context;
  try {
    let courseIds: string[] | null = null;
    if (role === "STUDENT" || role === "TEACHER") {
      const enrolments = await rows(client.from("organization_batch_members").select("batch_id").eq("organization_id", organizationId).eq("user_id", userId).eq("role", role));
      const batchIds = enrolments.map((row) => String(row.batch_id));
      if (!batchIds.length) courseIds = [];
      else {
        const links = await rows(client.from("organization_course_batches").select("course_id").eq("organization_id", organizationId).in("batch_id", batchIds));
        courseIds = [...new Set(links.map((row) => String(row.course_id)))];
      }
    }

    let courseQuery = client.from("organization_courses").select("id,title,description,status,subject_id,updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false });
    if (role === "STUDENT") courseQuery = courseQuery.eq("status", "PUBLISHED");
    if (courseIds) {
      if (!courseIds.length) return Response.json({ courses: [], modules: [], lessons: [], resources: [], progress: [], batches: [], role }, { headers: { "cache-control": "private, no-store" } });
      courseQuery = courseQuery.in("id", courseIds);
    }
    const courses = await rows(courseQuery);
    const visibleCourseIds = courses.map((row) => String(row.id));
    if (!visibleCourseIds.length) return Response.json({ courses: [], modules: [], lessons: [], resources: [], progress: [], batches: [], role }, { headers: { "cache-control": "private, no-store" } });

    const allModules = await rows(client.from("organization_course_modules").select("id,course_id,title,description,order_index,is_published,release_at,updated_at").eq("organization_id", organizationId).in("course_id", visibleCourseIds).order("order_index"));
    const now = Date.now();
    const modules = role === "STUDENT" ? allModules.filter((row) => row.is_published && (!row.release_at || new Date(String(row.release_at)).getTime() <= now)) : allModules;
    const moduleIds = modules.map((row) => String(row.id));
    const allLessons = moduleIds.length ? await rows(client.from("organization_course_lessons").select("id,module_id,title,kind,description,learning_objectives,duration_minutes,order_index,is_published,release_at,updated_at").eq("organization_id", organizationId).in("module_id", moduleIds).order("order_index")) : [];
    const lessons = role === "STUDENT" ? allLessons.filter((row) => row.is_published && (!row.release_at || new Date(String(row.release_at)).getTime() <= now)) : allLessons;
    const lessonIds = lessons.map((row) => String(row.id));
    const resources = lessonIds.length ? await rows(client.from("organization_lesson_resources").select("id,lesson_id,name,resource_type,mime_type,byte_size,download_allowed,processing_status,created_at").eq("organization_id", organizationId).in("lesson_id", lessonIds).eq("processing_status", "READY").order("created_at")) : [];
    const progress = lessonIds.length ? await rows(client.from("organization_lesson_progress").select("lesson_id,progress_percent,last_accessed_at,completed_at").eq("organization_id", organizationId).eq("user_id", userId).in("lesson_id", lessonIds)) : [];
    const batches = role === "STUDENT" ? [] : await rows(client.from("organization_batches").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("name"));
    return Response.json({ courses, modules, lessons, resources, progress, batches, role }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Learning workspace query failed", error);
    return Response.json({ error: "Unable to load learning content." }, { status: 503 });
  }
}

export async function POST(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!parsedSlug.success || !parsed.success) return Response.json({ error: "Invalid learning operation." }, { status: 400 });
  const permission = parsed.data.action === "MARK_COMPLETE" ? "content:read" : "content:manage";
  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, permission);
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  if (parsed.data.action === "CREATE_EXTERNAL_RESOURCE" && !parseApprovedExternalUrl(parsed.data.payload.externalUrl)) {
    return Response.json({ error: "External resources must use a credential-free HTTPS URL." }, { status: 400 });
  }
  const { data, error } = await getPrepziiAdmin().rpc("lms_learning_mutation", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_action: parsed.data.action,
    p_payload: parsed.data.payload,
  });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "This content is not available to your account." }, { status: 403 });
    if (["23503", "23505"].includes(error.code ?? "")) return Response.json({ error: "Learning record conflicts with existing data." }, { status: 409 });
    console.error("Learning mutation failed", error);
    return Response.json({ error: "Unable to save learning content." }, { status: 503 });
  }
  return Response.json({ result: data }, { status: 201 });
}
