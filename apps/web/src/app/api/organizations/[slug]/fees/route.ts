import { hasPermission } from "@prepzii/authorization";
import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const paise = z.number().int().min(1).max(10_000_000_000);
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_PLAN"), payload: z.object({
    name: z.string().trim().min(2).max(120), targetExam: z.enum(["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION", "BOARDS", "OTHER"]),
    totalAmountPaise: paise, installments: z.array(z.object({
      sequenceNumber: z.number().int().min(1).max(12), title: z.string().trim().min(1).max(120),
      amountPaise: paise, dueDate: z.iso.date(),
    })).min(1).max(12),
  }) }),
  z.object({ action: z.literal("ASSIGN_PLAN"), payload: z.object({
    studentId: z.string().min(2).max(160), batchId: z.uuid(), planId: z.uuid(),
    concessionAmountPaise: z.number().int().min(0).max(10_000_000_000).default(0),
  }) }),
  z.object({ action: z.literal("RECORD_PAYMENT"), payload: z.object({
    studentFeeId: z.uuid(), installmentId: z.uuid(), amountPaise: paise,
    method: z.enum(["UPI", "NET_BANKING", "CARD", "CHEQUE", "CASH", "DD"]),
    referenceNumber: z.string().trim().min(2).max(100),
  }) }),
]);
const headers = { "cache-control": "private, no-store" };
type FeeContext = RouteContext<"/api/organizations/[slug]/fees">;

export async function GET(request: Request, context: FeeContext) {
  const workspace = await getAuthorizedOrganizationContext((await context.params).slug, "fees:read");
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403, headers });
  const page = z.coerce.number().int().min(1).max(10000).safeParse(new URL(request.url).searchParams.get("page") ?? 1);
  if (!page.success) return Response.json({ error: "Invalid page." }, { status: 400, headers });
  const { organizationId, userId, role } = workspace.context;
  const canManage = hasPermission(role, "fees:manage");
  const db = getPrepziiAdmin();
  if (new URL(request.url).searchParams.get("options") === "1") {
    if (!canManage) return Response.json({ error: "Forbidden" }, { status: 403, headers });
    const search = z.object({
      student: z.string().trim().max(120).default(""),
      batch: z.string().trim().max(120).default(""),
      plan: z.string().trim().max(120).default(""),
    }).safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!search.success) return Response.json({ error: "Invalid assignment search." }, { status: 400, headers });
    let batchQuery = db.from("organization_batches").select("id,name").eq("organization_id", organizationId)
      .eq("is_active", true).order("name").limit(100);
    let planQuery = db.from("organization_fee_plans").select("id,name").eq("organization_id", organizationId)
      .eq("is_active", true).order("name").limit(100);
    if (search.data.batch) batchQuery = batchQuery.ilike("name", `%${search.data.batch.replace(/[%_]/g, "")}%`);
    if (search.data.plan) planQuery = planQuery.ilike("name", `%${search.data.plan.replace(/[%_]/g, "")}%`);
    const [students, batches, plans] = await Promise.all([
      db.rpc("lms_list_members", { p_organization_id: organizationId, p_role: "STUDENT", p_status: "ACTIVE",
        p_limit: 100, p_search: search.data.student.replace(/[%_]/g, "") || null }),
      batchQuery,
      planQuery,
    ]);
    if (students.error || batches.error || plans.error) return Response.json({ error: "Unable to load assignment options." }, { status: 503, headers });
    return Response.json({ batches: batches.data, plans: plans.data,
      students: (students.data as { member_id: string; user_id: string; display_name: string }[])
        .map(({ member_id, user_id, display_name }) => ({ member_id, user_id, display_name })) }, { headers });
  }
  let query = db.from("organization_student_fees")
    .select("id,student_id,net_payable,status,organization_fee_installments!organization_fee_installments_student_fee_id_fkey(id,title,due_date,amount,paid_amount,status)", { count: "exact" })
    .eq("organization_id", organizationId).order("updated_at", { ascending: false }).order("id");
  if (!canManage) query = query.eq("student_id", userId);
  const offset = (page.data - 1) * 25;
  const ledgers = await query.range(offset, offset + 24);
  if (ledgers.error) return Response.json({ error: "Unable to load fees." }, { status: 503, headers });
  const ids = [...new Set((ledgers.data ?? []).map(({ student_id }) => student_id))];
  const members = canManage && ids.length
    ? await db.from("institute_members").select("user_id,email").eq("institute_id", organizationId).eq("role", "STUDENT").in("user_id", ids)
    : { data: [], error: null };
  if (members.error) return Response.json({ error: "Unable to load fee records." }, { status: 503, headers });
  const labels = new Map(members.data.map(({ user_id, email }) => [user_id, email]));
  return Response.json({ total: ledgers.count, canManage, ledgers: ledgers.data.map((ledger) => ({
    id: ledger.id, student: canManage ? labels.get(ledger.student_id) ?? "Student record" : undefined,
    amount: ledger.net_payable, status: ledger.status, installments: ledger.organization_fee_installments,
  })) }, { headers });
}

export async function POST(request: Request, context: FeeContext) {
  const workspace = await getAuthorizedOrganizationContext((await context.params).slug, "fees:manage");
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403, headers });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Check the fee details." }, { status: 400, headers });
  const { organizationId, userId, role } = workspace.context;
  const db = getPrepziiAdmin();
  if (parsed.data.action === "ASSIGN_PLAN") {
    const { data, error } = await db.from("institute_members").select("user_id")
      .eq("institute_id", organizationId).eq("user_id", parsed.data.payload.studentId)
      .eq("role", "STUDENT").eq("status", "ACTIVE").maybeSingle();
    if (error || !data) return Response.json({ error: "Student unavailable." }, { status: error ? 503 : 404, headers });
  }
  const { data, error } = await db.rpc("lms_finance_mutation", {
    p_organization_id: organizationId, p_actor_user_id: userId, p_actor_role: role,
    p_action: parsed.data.action, p_payload: parsed.data.payload,
  });
  if (error) {
    const status = error.code === "23505" ? 409 : ["22023", "23503", "23514"].includes(error.code) ? 400 : 503;
    return Response.json({ error: status === 409 ? "This fee plan, assignment, or payment reference already exists."
      : status === 400 ? "Check the amount, installment balance, and student enrollment." : "Unable to save the fee operation." }, { status, headers });
  }
  return Response.json({ result: data }, { headers });
}
