import { adaptPrepziiQuestionToBankItem, type PrepziiQuestionRow } from "@prepzii/assessment-core";
import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const filters = z.object({
  view: z.enum(["full", "subjects", "picker"]).default("full"),
  q: z.string().trim().max(100).default(""),
  subject: z.string().max(120).default(""),
  difficulty: z.string().trim().max(30).default("ALL"),
  kind: z.string().trim().max(40).default("ALL"),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export async function GET(request: Request, context: RouteContext<"/api/organizations/[slug]/question-bank">) {
  const workspace = await getAuthorizedOrganizationContext((await context.params).slug, "assessments:manage");
  if (!workspace) return Response.json({ error: "Forbidden" }, { status: 403 });
  const search = filters.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!search.success) return Response.json({ error: "Invalid question filters." }, { status: 400 });
  const { view, q, subject, difficulty, kind, limit, page } = search.data;
  const client = getPrepziiAdmin();
  const headers = { "cache-control": "private, no-store" };
  if (view === "subjects") {
    const { data, error } = await client.rpc("lms_question_bank_subjects");
    if (error) return Response.json({ error: "Unable to load question bank subjects." }, { status: 503 });
    return Response.json({ subjects: data.map(({ subject }: { subject: string }) => subject) }, { headers });
  }
  const columns = view === "picker" ? "id,question_text,exam,chapter,difficulty,marks" : "*";
  let query = client.from("questions").select(columns, { count: "exact" })
    .order("created_at", { ascending: false }).order("id");
  if (subject && (view === "picker" || subject !== "ALL")) query = query.eq("subject", subject);
  if (difficulty !== "ALL") query = query.ilike("difficulty", difficulty.replace(/[%_]/g, ""));
  if (kind !== "ALL") query = query.eq("question_type", kind);
  if (q) query = query.ilike("question_text", `%${q.replace(/[%_]/g, "")}%`);
  const from = (page - 1) * limit;
  const { data, count, error } = await query.range(from, from + limit - 1).returns<PrepziiQuestionRow[]>();
  if (error) return Response.json({ error: "Unable to load the question bank." }, { status: 503 });
  const questions = view === "picker" ? data : data.map(adaptPrepziiQuestionToBankItem);
  return Response.json({ questions, total: count }, { headers });
}
