import { adaptPrepziiQuestionToBankItem, type PrepziiQuestionRow } from "@prepzii/assessment-core";
import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const filters = z.object({
  q: z.string().trim().max(100).default(""),
  subject: z.string().trim().max(120).default("ALL"),
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
  const { q, subject, difficulty, kind, limit, page } = search.data;
  let query = getPrepziiAdmin().from("questions").select("*", { count: "exact" })
    .order("created_at", { ascending: false }).order("id");
  if (subject !== "ALL") query = query.eq("subject", subject);
  if (difficulty !== "ALL") query = query.ilike("difficulty", difficulty.replace(/[%_]/g, ""));
  if (kind !== "ALL") query = query.eq("question_type", kind);
  if (q) query = query.ilike("question_text", `%${q.replace(/[%_]/g, "")}%`);
  const from = (page - 1) * limit;
  const { data, count, error } = await query.range(from, from + limit - 1).returns<PrepziiQuestionRow[]>();
  if (error) return Response.json({ error: "Unable to load the question bank." }, { status: 503 });
  return Response.json({ questions: data.map(adaptPrepziiQuestionToBankItem), total: count }, { headers: { "cache-control": "private, no-store" } });
}
