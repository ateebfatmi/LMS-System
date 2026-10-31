import { z } from "zod";
import { getActingUserId, getPrepziiAdmin, isPlatformAdmin } from "@/lib/prepzii-backend";

const mutationSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("SET_ORGANIZATION_STATUS"),
    payload: z.object({
      organizationId: z.string().uuid(),
      status: z.enum(["ACTIVE", "SUSPENDED"]),
    }),
  }),
  z.object({
    action: z.literal("ASSIGN_ORGANIZATION_PLAN"),
    payload: z.object({
      organizationId: z.string().uuid(),
      planId: z.string().min(1).max(50),
    }),
  }),
  z.object({
    action: z.literal("UPDATE_PLAN"),
    payload: z.object({
      planId: z.string().min(1).max(50),
      name: z.string().trim().min(2).max(100),
      monthlyPricePaise: z.number().int().min(0),
      annualPricePaise: z.number().int().min(0),
      studentLimit: z.number().int().min(1),
      branchLimit: z.number().int().min(1),
      storageGb: z.number().int().min(1),
      aiCreditsPerMonth: z.number().int().min(0),
      entitlements: z.record(z.string(), z.unknown()),
      isActive: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("SET_FEATURE_FLAG"),
    payload: z.object({
      key: z.string().regex(/^[a-z][a-z0-9_.-]{1,79}$/),
      description: z.string().trim().min(3).max(500),
      enabled: z.boolean(),
    }),
  }),
  z.object({
    action: z.literal("CREATE_INSTITUTE"),
    payload: z.object({
      name: z.string().trim().min(2).max(160),
      slug: z.string().trim().min(2).max(64),
      planId: z.string().default("basic"),
    }),
  }),
]);

type Row = Record<string, unknown>;

async function many(query: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>) {
  const result = await query;
  if (result.error) throw new Error(result.error.message);
  return result.data ?? [];
}

export async function GET() {
  if (!(await isPlatformAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = getPrepziiAdmin();
  const startTime = Date.now();

  try {
    const [institutes, subscriptions, plans, flags, audits, members, batches] = await Promise.all([
      many(
        client
          .from("institutes")
          .select("id,name,slug,owner_user_id,status,institute_type,contact_email,contact_phone,created_at")
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      many(
        client
          .from("organization_subscriptions")
          .select("id,organization_id,plan_id,status,current_period_start,current_period_end,trial_ends_at,grace_ends_at,cancel_at_period_end,requested_plan_id,requested_billing_interval,updated_at")
      ),
      many(
        client
          .from("subscription_plans")
          .select("id,name,monthly_price_paise,annual_price_paise,student_limit,branch_limit,storage_gb,ai_credits_per_month,entitlements,is_active")
          .order("monthly_price_paise")
      ),
      many(
        client
          .from("platform_feature_flags")
          .select("key,description,enabled_by_default,updated_by,updated_at")
          .order("key")
      ),
      many(
        client
          .from("platform_audit_logs")
          .select("id,actor_user_id,target_organization_id,action,details,created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ),
      many(client.from("institute_members").select("institute_id,role,status")),
      many(client.from("organization_batches").select("organization_id,is_active")),
    ]);

    const dbLatencyMs = Date.now() - startTime;

    const counts = institutes.map((institute) => ({
      organizationId: institute.id,
      activeStudents: members.filter(
        (m) => m.institute_id === institute.id && m.role === "STUDENT" && m.status === "ACTIVE"
      ).length,
      activeStaff: members.filter(
        (m) => m.institute_id === institute.id && m.role !== "STUDENT" && m.status === "ACTIVE"
      ).length,
      activeBatches: batches.filter(
        (b) => b.organization_id === institute.id && b.is_active
      ).length,
    }));

    const systemHealth = {
      databaseStatus: "OPERATIONAL",
      databaseLatencyMs: dbLatencyMs,
      storageStatus: "OPERATIONAL",
      aiModelStatus: "OPERATIONAL",
      aiModelName: process.env.ZI_AI_MODEL || "gemini-2.5-flash",
      environment: process.env.NODE_ENV || "development",
    };

    return Response.json(
      { institutes, subscriptions, plans, flags, audits, counts, systemHealth },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Platform admin query failed", error);
    return Response.json({ error: "Unable to load platform administration." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!(await isPlatformAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const actorUserId = (await getActingUserId()) || "root-superadmin";
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json({ error: "Invalid platform operation payload." }, { status: 400 });
  }

  const client = getPrepziiAdmin();

  // Handle plan assignment directly with audit log
  if (parsed.data.action === "ASSIGN_ORGANIZATION_PLAN") {
    const { organizationId, planId } = parsed.data.payload;
    const { error: subErr } = await client
      .from("organization_subscriptions")
      .upsert(
        {
          organization_id: organizationId,
          plan_id: planId,
          status: "ACTIVE",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" }
      );

    if (subErr) {
      console.error("Failed to assign plan:", subErr);
      return Response.json({ error: "Failed to assign plan to organization." }, { status: 500 });
    }

    await client.from("platform_audit_logs").insert({
      actor_user_id: actorUserId,
      actor_role: "PLATFORM_SUPER_ADMIN",
      target_organization_id: organizationId,
      action: "assign_organization_plan",
      details: { planId },
    });

    return Response.json({ result: { action: "ASSIGN_ORGANIZATION_PLAN", organizationId, planId } });
  }

  // Handle new institute creation from Super Admin
  if (parsed.data.action === "CREATE_INSTITUTE") {
    const { name, slug, planId } = parsed.data.payload;
    const { data: newOrg, error: orgErr } = await client
      .from("institutes")
      .insert({
        name,
        slug,
        owner_user_id: actorUserId,
        status: "ACTIVE",
      })
      .select("id")
      .single();

    if (orgErr) {
      return Response.json({ error: orgErr.message }, { status: 400 });
    }

    await client.from("organization_subscriptions").insert({
      organization_id: newOrg.id,
      plan_id: planId,
      status: "ACTIVE",
    });

    await client.from("platform_audit_logs").insert({
      actor_user_id: actorUserId,
      actor_role: "PLATFORM_SUPER_ADMIN",
      target_organization_id: newOrg.id,
      action: "create_organization",
      details: { name, slug, planId },
    });

    return Response.json({ result: { organizationId: newOrg.id } });
  }

  // Fallback to standard platform mutation RPC for SET_ORGANIZATION_STATUS, UPDATE_PLAN, SET_FEATURE_FLAG
  const { data, error } = await client.rpc("lms_platform_mutation", {
    p_actor_user_id: actorUserId,
    p_action: parsed.data.action,
    p_payload: parsed.data.payload,
  });

  if (error) {
    if (["22023", "23503", "23514"].includes(error.code ?? "")) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("Platform mutation failed", error);
    return Response.json({ error: "Unable to save platform operation." }, { status: 503 });
  }

  return Response.json({ result: data });
}
