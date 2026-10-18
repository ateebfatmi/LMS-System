import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const uuid = z.uuid();
const paise = z.number().int().positive().max(1_000_000_000);
const mutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("CREATE_PLAN"), payload: z.object({ name: z.string().trim().min(2).max(120), targetExam: z.enum(["JEE_MAIN", "JEE_ADVANCED", "NEET", "FOUNDATION", "BOARDS", "OTHER"]), totalAmountPaise: paise, installments: z.array(z.object({ sequenceNumber: z.number().int().min(1).max(12), title: z.string().trim().min(2).max(120), amountPaise: paise, dueDate: z.iso.date() })).min(1).max(12) }) }),
  z.object({ action: z.literal("ASSIGN_PLAN"), payload: z.object({ planId: uuid, studentId: z.string().min(1).max(160), batchId: uuid, academicYearId: uuid.nullable(), concessionAmountPaise: z.number().int().min(0).max(1_000_000_000), concessionReason: z.string().trim().max(500).nullable() }) }),
  z.object({ action: z.literal("RECORD_PAYMENT"), payload: z.object({ studentFeeId: uuid, installmentId: uuid, amountPaise: paise, method: z.enum(["UPI", "NET_BANKING", "CARD", "CHEQUE", "CASH", "DD"]), referenceNumber: z.string().trim().min(3).max(120), notes: z.string().trim().max(500).nullable() }) }),
  z.object({ action: z.literal("REFUND_PAYMENT"), payload: z.object({ transactionId: uuid, amountPaise: paise, referenceNumber: z.string().trim().min(3).max(120), reason: z.string().trim().min(3).max(500) }) }),
]);
type Context = { params: Promise<{ slug: string }> };
type Row = Record<string, unknown>;

async function safeQuery<T>(promise: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const result = await promise;
    if (result.error) return fallback;
    return (result.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export async function GET(_request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "fees:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const { organizationId, userId, role } = resolved.context;
  const staff = role !== "STUDENT";
  try {
    const [plans, planInstallments, orgBatches, years] = staff ? await Promise.all([
      safeQuery(client.from("organization_fee_plans").select("id,name,target_exam,total_amount,installment_count,currency,is_active,created_at").eq("organization_id", organizationId).order("created_at", { ascending: false }), []),
      safeQuery(client.from("organization_fee_plan_installments").select("id,fee_plan_id,sequence_number,title,amount,due_date").eq("organization_id", organizationId).order("sequence_number"), []),
      safeQuery(client.from("organization_batches").select("id,name").eq("organization_id", organizationId).eq("is_active", true).order("name"), []),
      safeQuery(client.from("organization_academic_years").select("id,name,is_active").eq("organization_id", organizationId).order("starts_on", { ascending: false }), []),
    ]) : [[], [], [], []];

    let batches = orgBatches;
    if (!batches.length && staff) {
      const legacyBatches = await safeQuery(client.from("institute_batches").select("id,name").eq("institute_id", organizationId), []);
      batches = legacyBatches;
    }

    let students: Row[] = [];
    if (staff) {
      const directory = await safeQuery(client.rpc("lms_list_members", { p_organization_id: organizationId, p_role: "STUDENT", p_status: "ACTIVE", p_search: null, p_limit: 500, p_offset: 0 }), null);
      if (directory) {
        students = directory as Row[];
      } else {
        const rawMembers = await safeQuery(client.from("institute_members").select("id,user_id,email,role,status").eq("institute_id", organizationId).eq("role", "STUDENT"), []);
        students = rawMembers.map((m: Record<string, unknown>) => ({
          member_id: m.id,
          user_id: m.user_id,
          email: m.email,
          display_name: typeof m.email === "string" ? m.email.split("@")[0] : "Student",
        }));
      }
    }

    let ledgerQuery = client.from("organization_student_fees").select("id,student_id,batch_id,fee_plan_id,academic_year_id,total_course_fee,concession_amount,concession_reason,net_payable,status,assigned_at,updated_at").eq("organization_id", organizationId).order("updated_at", { ascending: false });
    if (!staff) ledgerQuery = ledgerQuery.eq("student_id", userId);
    const ledgers = await safeQuery(ledgerQuery, []);
    const ledgerIds = ledgers.map((row: Record<string, unknown>) => String(row.id));
    let installments: Row[] = [], transactions: Row[] = [], invoices: Row[] = [];
    if (ledgerIds.length) {
      [installments, transactions, invoices] = await Promise.all([
        safeQuery(client.from("organization_fee_installments").select("id,student_fee_id,title,amount,due_date,status,paid_amount,paid_at,receipt_number").eq("organization_id", organizationId).in("student_fee_id", ledgerIds).order("due_date"), []),
        safeQuery(client.from("organization_fee_transactions").select("id,student_fee_id,installment_id,student_id,amount,method,reference_number,receipt_number,installment_title,recorded_by,transaction_type,reversed_transaction_id,notes,created_at").eq("organization_id", organizationId).in("student_fee_id", ledgerIds).order("created_at", { ascending: false }), []),
        safeQuery(client.from("organization_fee_invoices").select("id,student_fee_id,student_id,invoice_number,currency,amount,due_date,status,issued_at").eq("organization_id", organizationId).in("student_fee_id", ledgerIds).order("issued_at", { ascending: false }), []),
      ]);
    }
    return Response.json({ role, plans, planInstallments, batches, academicYears: years, students, ledgers, installments, transactions, invoices }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Finance workspace query failed", error);
    return Response.json({ role, plans: [], planInstallments: [], batches: [], academicYears: [], students: [], ledgers: [], installments: [], transactions: [], invoices: [] });
  }
}

export async function POST(request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
  if (!slug.success || !parsed.success) return Response.json({ error: "Invalid finance operation." }, { status: 400 });
  if (parsed.data.action === "CREATE_PLAN") {
    const sum = parsed.data.payload.installments.reduce((total, item) => total + item.amountPaise, 0);
    const sequence = new Set(parsed.data.payload.installments.map((item) => item.sequenceNumber));
    if (sum !== parsed.data.payload.totalAmountPaise || sequence.size !== parsed.data.payload.installments.length) return Response.json({ error: "Installments must be uniquely ordered and equal the plan total." }, { status: 400 });
  }
  if (parsed.data.action === "ASSIGN_PLAN" && parsed.data.payload.concessionAmountPaise > 0 && !parsed.data.payload.concessionReason) return Response.json({ error: "A concession reason is required." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "fees:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { data, error } = await getPrepziiAdmin().rpc("lms_finance_mutation", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_action: parsed.data.action,
    p_payload: parsed.data.payload,
  });
  if (error) {
    if (error.code === "42501") return Response.json({ error: "You cannot manage institute finances." }, { status: 403 });
    if (["22023", "23514"].includes(error.code ?? "")) return Response.json({ error: error.message }, { status: 400 });
    if (["23503", "23505"].includes(error.code ?? "")) return Response.json({ error: error.code === "23505" ? "That ledger or payment reference already exists." : "The selected finance record no longer exists." }, { status: 409 });
    console.error("Finance mutation failed", error);
    return Response.json({ error: "Unable to save finance operation." }, { status: 503 });
  }
  return Response.json({ result: data }, { status: 201 });
}
