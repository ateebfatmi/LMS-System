import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
type Context = { params: Promise<{ slug: string }> };
type Row = Record<string, unknown>;
type Result = { data: Row[] | null; error: { message: string } | null };

async function rows(query: PromiseLike<Result>): Promise<Row[]> {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

function unique(source: Row[], key: string): Row[] {
  return [...new Map(source.map((item) => [String(item[key]), item])).values()];
}

export async function GET(_request: Request, context: Context) {
  const slug = slugSchema.safeParse((await context.params).slug);
  if (!slug.success) return Response.json({ error: "Invalid organization." }, { status: 400 });
  const resolved = await getAuthorizedOrganizationContext(slug.data, "organization:read");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });
  const client = getPrepziiAdmin();
  const { organizationId, userId, role } = resolved.context;
  const leadership = ["OWNER", "COACHING_ADMIN", "ACADEMIC_COORDINATOR"].includes(role);
  const teacher = role === "TEACHER";
  const student = role === "STUDENT";
  const financeViewer = ["OWNER", "COACHING_ADMIN", "ACCOUNTANT", "STUDENT"].includes(role);

  try {
    const allBatches = (leadership || teacher || student) ? await rows(client.from("organization_batches").select("id,name,target_exam,grade_level,is_active").eq("organization_id", organizationId).eq("is_active", true).order("name")) : [];
    let memberships: Row[] = [];
    let visibleBatchIds: string[] = [];
    if (leadership) {
      memberships = await rows(client.from("organization_batch_members").select("id,batch_id,user_id,role,roll_number").eq("organization_id", organizationId));
      visibleBatchIds = allBatches.map((batch) => String(batch.id));
    } else if (teacher) {
      const own = await rows(client.from("organization_batch_members").select("id,batch_id,user_id,role,roll_number").eq("organization_id", organizationId).eq("user_id", userId).eq("role", "TEACHER"));
      visibleBatchIds = own.map((item) => String(item.batch_id));
      memberships = visibleBatchIds.length ? await rows(client.from("organization_batch_members").select("id,batch_id,user_id,role,roll_number").eq("organization_id", organizationId).in("batch_id", visibleBatchIds)) : [];
    } else if (student) {
      memberships = await rows(client.from("organization_batch_members").select("id,batch_id,user_id,role,roll_number").eq("organization_id", organizationId).eq("user_id", userId).eq("role", "STUDENT"));
      visibleBatchIds = memberships.map((item) => String(item.batch_id));
    }
    const batches = allBatches.filter((batch) => visibleBatchIds.includes(String(batch.id))).map((batch) => ({ ...batch, student_count: memberships.filter((member) => member.role === "STUDENT" && member.batch_id === batch.id).length }));

    let sessions: Row[] = [];
    let attendance: Row[] = [];
    if (visibleBatchIds.length) {
      sessions = await rows(client.from("organization_attendance_sessions").select("id,batch_id,session_date,session_label").eq("organization_id", organizationId).in("batch_id", visibleBatchIds).order("session_date", { ascending: false }).limit(60));
      const sessionIds = sessions.map((session) => String(session.id));
      if (sessionIds.length) {
        let query = client.from("organization_attendance_records").select("id,session_id,student_id,status").eq("organization_id", organizationId).in("session_id", sessionIds);
        if (student) query = query.eq("student_id", userId);
        attendance = await rows(query);
      }
    }

    let attempts: Row[] = [];
    if (leadership) {
      attempts = await rows(client.from("organization_assessment_attempts").select("id,test_id,user_id,status,score,max_score,percentage,submitted_at").eq("organization_id", organizationId).order("started_at", { ascending: false }).limit(100));
    } else if (teacher) {
      const tests = await rows(client.from("institute_tests").select("id,title").eq("institute_id", organizationId).eq("created_by", userId));
      const testIds = tests.map((test) => String(test.id));
      attempts = testIds.length ? await rows(client.from("organization_assessment_attempts").select("id,test_id,user_id,status,score,max_score,percentage,submitted_at").eq("organization_id", organizationId).in("test_id", testIds).order("started_at", { ascending: false }).limit(100)) : [];
    } else if (student) {
      attempts = await rows(client.from("organization_assessment_attempts").select("id,test_id,user_id,status,score,max_score,percentage,submitted_at").eq("organization_id", organizationId).eq("user_id", userId).order("started_at", { ascending: false }).limit(50));
    }

    let assignments: Row[] = [];
    let submissions: Row[] = [];
    if (leadership) {
      assignments = await rows(client.from("organization_assignments").select("id,title,batch_id,student_user_id,status,due_at,max_marks,created_by").eq("organization_id", organizationId).order("due_at").limit(100));
    } else if (teacher) {
      assignments = await rows(client.from("organization_assignments").select("id,title,batch_id,student_user_id,status,due_at,max_marks,created_by").eq("organization_id", organizationId).eq("created_by", userId).order("due_at").limit(100));
    } else if (student) {
      const direct = await rows(client.from("organization_assignments").select("id,title,batch_id,student_user_id,status,due_at,max_marks,created_by").eq("organization_id", organizationId).eq("student_user_id", userId).eq("status", "PUBLISHED"));
      const batchAssigned = visibleBatchIds.length ? await rows(client.from("organization_assignments").select("id,title,batch_id,student_user_id,status,due_at,max_marks,created_by").eq("organization_id", organizationId).in("batch_id", visibleBatchIds).eq("status", "PUBLISHED")) : [];
      assignments = unique([...direct, ...batchAssigned], "id");
    }
    if (assignments.length) {
      let query = client.from("organization_assignment_submissions").select("id,assignment_id,student_user_id,status,grade,submitted_at").eq("organization_id", organizationId).in("assignment_id", assignments.map((item) => String(item.id)));
      if (student) query = query.eq("student_user_id", userId);
      submissions = await rows(query);
    }

    let fees: Row[] = [];
    let transactions: Row[] = [];
    if (financeViewer) {
      let feeQuery = client.from("organization_student_fees").select("id,student_id,net_payable,status").eq("organization_id", organizationId);
      if (student) feeQuery = feeQuery.eq("student_id", userId);
      fees = await rows(feeQuery);
      const feeIds = fees.map((fee) => String(fee.id));
      if (feeIds.length) transactions = await rows(client.from("organization_fee_transactions").select("id,student_fee_id,amount,transaction_type,created_at").eq("organization_id", organizationId).in("student_fee_id", feeIds));
    }

    const present = attendance.filter((record) => record.status === "PRESENT").length;
    const submittedAttempts = attempts.filter((attempt) => attempt.status === "SUBMITTED");
    const scores = submittedAttempts.map((attempt) => Number(attempt.percentage)).filter(Number.isFinite);
    const paidPaise = Math.round(transactions.reduce((total, item) => total + (item.transaction_type === "REFUND" ? -1 : 1) * Number(item.amount ?? 0), 0) * 100);
    const payablePaise = Math.round(fees.reduce((total, item) => total + Number(item.net_payable ?? 0), 0) * 100);
    const trend = sessions.slice(0, 14).reverse().map((session) => {
      const records = attendance.filter((record) => record.session_id === session.id);
      return { date: session.session_date, rate: records.length ? Math.round(records.filter((record) => record.status === "PRESENT").length / records.length * 1000) / 10 : 0 };
    });

    return Response.json({
      role,
      summary: {
        students: leadership || teacher ? new Set(memberships.filter((item) => item.role === "STUDENT").map((item) => item.user_id)).size : student ? 1 : null,
        activeBatches: batches.length,
        attendanceRate: attendance.length ? Math.round(present / attendance.length * 1000) / 10 : null,
        assessmentAverage: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length * 10) / 10 : null,
        assignments: assignments.length,
        submittedAssignments: submissions.filter((item) => ["SUBMITTED", "LATE", "GRADED"].includes(String(item.status))).length,
        feeCollectedPaise: financeViewer ? paidPaise : null,
        feeOutstandingPaise: financeViewer ? Math.max(0, payablePaise - paidPaise) : null,
      },
      batches, attendanceTrend: trend, attempts: submittedAttempts.slice(0, 20), assignments: assignments.slice(0, 20),
    }, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    console.error("Analytics query failed", error);
    return Response.json({ error: "Unable to load analytics." }, { status: 503 });
  }
}
