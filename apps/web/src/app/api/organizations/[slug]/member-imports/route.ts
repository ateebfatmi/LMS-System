import { createHash } from "node:crypto";
import { validateMemberCsv } from "@prepzii/membership";
import { z } from "zod";
import { getAuthorizedOrganizationContext, getPrepziiAdmin } from "@/lib/prepzii-backend";

const slugSchema = z.string().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const idempotencySchema = z.uuid();
const uploadSchema = z.object({
  fileName: z.string().trim().min(1).max(180).regex(/\.csv$/i),
  csvText: z.string().min(1).max(2_000_000),
  role: z.enum(["STUDENT", "TEACHER"]),
});
type Context = { params: Promise<{ slug: string }> };
type ImportSummary = {
  import_id: string;
  import_status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  created_at: string;
};

export async function POST(request: Request, context: Context) {
  const parsedSlug = slugSchema.safeParse((await context.params).slug);
  const idempotency = idempotencySchema.safeParse(request.headers.get("idempotency-key"));
  const parsed = uploadSchema.safeParse(await request.json().catch(() => null));
  if (!parsedSlug.success || !idempotency.success || !parsed.success) {
    return Response.json({ error: "Invalid CSV import request." }, { status: 400 });
  }

  const resolved = await getAuthorizedOrganizationContext(parsedSlug.data, "members:manage");
  if (!resolved) return Response.json({ error: "Forbidden" }, { status: 403 });

  const validation = validateMemberCsv(parsed.data.csvText, parsed.data.role);
  if (validation.fileErrors.length) {
    return Response.json({ error: "CSV structure is invalid.", fileErrors: validation.fileErrors }, { status: 400 });
  }

  const requestHash = createHash("sha256")
    .update(`${parsed.data.role}\n${parsed.data.csvText}`, "utf8")
    .digest("hex");
  const { data, error } = await getPrepziiAdmin().rpc("lms_stage_member_import", {
    p_organization_id: resolved.context.organizationId,
    p_actor_user_id: resolved.context.userId,
    p_actor_role: resolved.context.role,
    p_idempotency_key: idempotency.data,
    p_request_hash: requestHash,
    p_file_name: parsed.data.fileName,
    p_member_role: parsed.data.role,
    p_rows: validation.rows,
  });
  if (error) {
    console.error("Member import staging failed", error);
    return Response.json({ error: "Unable to stage member import." }, { status: 503 });
  }
  const summary = (data as ImportSummary[] | null)?.[0];
  if (!summary) return Response.json({ error: "Import was not staged." }, { status: 500 });

  const { data: rows, error: rowsError } = await getPrepziiAdmin()
    .from("organization_member_import_rows")
    .select("row_number,normalized_data,errors,status")
    .eq("organization_id", resolved.context.organizationId)
    .eq("import_id", summary.import_id)
    .order("row_number")
    .limit(100);
  if (rowsError) {
    console.error("Member import preview failed", rowsError);
    return Response.json({ error: "Import staged but preview is unavailable." }, { status: 503 });
  }

  return Response.json({ import: summary, rows: rows ?? [] }, { status: 201 });
}
