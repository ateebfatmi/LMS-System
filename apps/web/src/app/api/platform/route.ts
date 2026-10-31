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
      status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED", "SUSPENDED"]).optional(),
      extendDays: z.number().int().min(1).max(3650).optional(),
    }),
  }),
  z.object({
    action: z.literal("UPDATE_INSTITUTE_DETAILS"),
    payload: z.object({
      organizationId: z.string().uuid(),
      name: z.string().trim().min(2).max(160),
      slug: z.string().trim().min(2).max(64),
      instituteType: z
        .enum(["COACHING", "TUITION", "SCHOOL", "ONLINE_ACADEMY", "INDIVIDUAL_TUTOR", "OTHER"])
        .default("COACHING"),
      contactEmail: z.string().trim().max(160).optional().nullable(),
      contactPhone: z.string().trim().max(40).optional().nullable(),
      ownerUserId: z.string().trim().min(2).max(160),
      primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
      subdomain: z.string().trim().max(80).optional().nullable(),
      verifySubdomain: z.boolean().optional(),
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
    action: z.literal("CREATE_PLAN"),
    payload: z.object({
      planId: z.string().regex(/^[a-z0-9_-]{2,40}$/),
      name: z.string().trim().min(2).max(100),
      monthlyPricePaise: z.number().int().min(0),
      annualPricePaise: z.number().int().min(0),
      studentLimit: z.number().int().min(1),
      branchLimit: z.number().int().min(1),
      storageGb: z.number().int().min(1),
      aiCreditsPerMonth: z.number().int().min(0),
      entitlements: z.record(z.string(), z.unknown()).default({}),
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
    action: z.literal("SET_ORG_FEATURE_OVERRIDE"),
    payload: z.object({
      organizationId: z.string().uuid(),
      featureKey: z.string().min(2).max(80),
      enabled: z.boolean(),
      reason: z.string().trim().min(3).max(300).default("Super Admin override"),
    }),
  }),
  z.object({
    action: z.literal("REMOVE_ORG_FEATURE_OVERRIDE"),
    payload: z.object({
      organizationId: z.string().uuid(),
      featureKey: z.string().min(2).max(80),
    }),
  }),
  z.object({
    action: z.literal("CREATE_INSTITUTE"),
    payload: z.object({
      name: z.string().trim().min(2).max(160),
      slug: z.string().trim().min(2).max(64),
      planId: z.string().default("basic"),
      instituteType: z
        .enum(["COACHING", "TUITION", "SCHOOL", "ONLINE_ACADEMY", "INDIVIDUAL_TUTOR", "OTHER"])
        .default("COACHING"),
      contactEmail: z.string().trim().max(160).optional(),
      contactPhone: z.string().trim().max(40).optional(),
      ownerUserId: z.string().trim().max(160).optional(),
      subscriptionStatus: z.enum(["ACTIVE", "TRIAL"]).default("ACTIVE"),
    }),
  }),
  z.object({
    action: z.literal("UPSERT_INSTITUTE_MEMBER"),
    payload: z.object({
      organizationId: z.string().uuid(),
      userId: z.string().trim().min(2).max(160),
      email: z.string().trim().email(),
      displayName: z.string().trim().max(160).optional(),
      role: z.enum([
        "OWNER",
        "COACHING_ADMIN",
        "ACADEMIC_COORDINATOR",
        "TEACHER",
        "ACCOUNTANT",
        "STUDENT",
        "PARENT",
      ]),
      status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]).default("ACTIVE"),
    }),
  }),
  z.object({
    action: z.literal("UPDATE_MEMBER_ROLE_STATUS"),
    payload: z.object({
      memberId: z.string().uuid(),
      organizationId: z.string().uuid(),
      role: z.enum([
        "OWNER",
        "COACHING_ADMIN",
        "ACADEMIC_COORDINATOR",
        "TEACHER",
        "ACCOUNTANT",
        "STUDENT",
        "PARENT",
      ]),
      status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
    }),
  }),
  z.object({
    action: z.literal("REMOVE_MEMBER"),
    payload: z.object({
      memberId: z.string().uuid(),
      organizationId: z.string().uuid(),
    }),
  }),
  z.object({
    action: z.literal("RESOLVE_PLAN_UPGRADE_REQUEST"),
    payload: z.object({
      organizationId: z.string().uuid(),
      decision: z.enum(["APPROVE", "REJECT"]),
    }),
  }),
  z.object({
    action: z.literal("RESET_USAGE_COUNTER"),
    payload: z.object({
      organizationId: z.string().uuid(),
      metric: z.enum(["AI_CREDITS", "STORAGE_BYTES", "EMAILS", "SMS", "WHATSAPP"]),
      newQuantity: z.number().int().min(0).default(0),
    }),
  }),
  z.object({
    action: z.literal("UPDATE_DEMO_REQUEST"),
    payload: z.object({
      requestId: z.string().uuid(),
      status: z.enum(["PENDING", "CONTACTED", "DEMO_GIVEN", "ONBOARDED", "REJECTED"]),
      provisionInstitute: z.boolean().optional(),
    }),
  }),
  z.object({
    action: z.literal("CREATE_DEMO_REQUEST"),
    payload: z.object({
      fullName: z.string().trim().min(2).max(120),
      instituteName: z.string().trim().min(2).max(160),
      email: z.string().trim().email(),
      phone: z.string().trim().min(6).max(30),
      city: z.string().trim().min(2).max(80),
      studentCount: z.string().trim().min(1).max(60),
      interestedPlan: z.string().default("growth"),
      notes: z.string().trim().max(500).optional(),
    }),
  }),
  z.object({
    action: z.literal("BROADCAST_ANNOUNCEMENT"),
    payload: z.object({
      targetOrganizationId: z.string().uuid().optional().nullable(),
      title: z.string().trim().min(3).max(200),
      content: z.string().trim().min(5).max(4000),
      priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("HIGH"),
      targetAudience: z.enum(["ALL", "STUDENTS", "TEACHERS", "PARENTS"]).default("ALL"),
    }),
  }),
  z.object({
    action: z.literal("GRANT_SUPPORT_ACCESS"),
    payload: z.object({
      organizationId: z.string().uuid(),
      reason: z.string().trim().min(10).max(500),
      durationHours: z.number().int().min(1).max(72).default(24),
    }),
  }),
  z.object({
    action: z.literal("REVOKE_SUPPORT_ACCESS"),
    payload: z.object({
      requestId: z.string().uuid(),
    }),
  }),
]);

type Row = Record<string, unknown>;

async function safeMany(
  query: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
): Promise<Row[]> {
  try {
    const result = await query;
    if (result.error) {
      console.warn("Platform partial query warning:", result.error.message);
      return [];
    }
    return result.data ?? [];
  } catch (err) {
    console.warn("Platform query fallback:", err);
    return [];
  }
}

export async function GET() {
  if (!(await isPlatformAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = getPrepziiAdmin();
  const startTime = Date.now();

  try {
    const [
      institutes,
      subscriptions,
      plans,
      flags,
      overrides,
      audits,
      members,
      profiles,
      batches,
      usageCounters,
      brandings,
      demoRequests,
      supportRequests,
      aiDrafts,
    ] = await Promise.all([
      safeMany(
        client
          .from("institutes")
          .select(
            "id,name,slug,owner_user_id,status,institute_type,contact_email,contact_phone,primary_color,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(500)
      ),
      safeMany(
        client
          .from("organization_subscriptions")
          .select(
            "id,organization_id,plan_id,status,current_period_start,current_period_end,trial_ends_at,grace_ends_at,cancel_at_period_end,requested_plan_id,requested_billing_interval,updated_at"
          )
      ),
      safeMany(
        client
          .from("subscription_plans")
          .select(
            "id,name,monthly_price_paise,annual_price_paise,student_limit,branch_limit,storage_gb,ai_credits_per_month,entitlements,is_active"
          )
          .order("monthly_price_paise")
      ),
      safeMany(
        client
          .from("platform_feature_flags")
          .select("key,description,enabled_by_default,updated_by,updated_at")
          .order("key")
      ),
      safeMany(
        client
          .from("organization_feature_overrides")
          .select("organization_id,feature_key,enabled,reason,updated_by,updated_at")
      ),
      safeMany(
        client
          .from("platform_audit_logs")
          .select("id,actor_user_id,actor_role,target_organization_id,action,details,created_at")
          .order("created_at", { ascending: false })
          .limit(200)
      ),
      safeMany(
        client
          .from("institute_members")
          .select("id,institute_id,user_id,email,role,status,created_at")
          .order("created_at", { ascending: false })
          .limit(1000)
      ),
      safeMany(
        client
          .from("organization_member_profiles")
          .select("membership_id,organization_id,display_name,phone,roll_number,employee_code")
          .limit(1000)
      ),
      safeMany(client.from("organization_batches").select("organization_id,is_active")),
      safeMany(
        client
          .from("organization_usage_counters")
          .select("organization_id,metric,period_start,period_end,quantity,updated_at")
      ),
      safeMany(
        client
          .from("organization_branding")
          .select(
            "organization_id,logo_url,primary_color,support_email,support_phone,subdomain,subdomain_verified_at"
          )
      ),
      safeMany(
        client
          .from("platform_demo_requests")
          .select(
            "id,full_name,institute_name,email,phone,city,student_count,interested_plan,notes,status,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(200)
      ),
      safeMany(
        client
          .from("platform_support_access_requests")
          .select("id,organization_id,requested_by,reason,status,approved_by,expires_at,created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ),
      safeMany(
        client
          .from("organization_ai_drafts")
          .select("id,organization_id,feature,status,model,created_by,created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ),
    ]);

    // Count canonical questions safely
    let questionBankCount = 0;
    try {
      const qRes = await client.from("questions").select("id", { count: "exact", head: true });
      questionBankCount = qRes.count ?? 0;
    } catch {}

    const dbLatencyMs = Date.now() - startTime;

    const counts = institutes.map((institute) => {
      const orgUsage = usageCounters.filter((u) => u.organization_id === institute.id);
      const aiUsed = orgUsage
        .filter((u) => u.metric === "AI_CREDITS")
        .reduce((acc, u) => acc + Number(u.quantity ?? 0), 0);
      const storageBytes = orgUsage
        .filter((u) => u.metric === "STORAGE_BYTES")
        .reduce((acc, u) => acc + Number(u.quantity ?? 0), 0);

      return {
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
        aiCreditsUsed: aiUsed,
        storageBytesUsed: storageBytes,
      };
    });

    // Enrich members with profile display name and institute name
    const enrichedMembers = members.map((m) => {
      const prof = profiles.find((p) => p.membership_id === m.id);
      const inst = institutes.find((i) => i.id === m.institute_id);
      return {
        ...m,
        display_name: prof?.display_name ?? m.email ?? m.user_id,
        phone: prof?.phone ?? null,
        roll_number: prof?.roll_number ?? null,
        employee_code: prof?.employee_code ?? null,
        institute_name: inst?.name ?? "Unknown Institute",
        institute_slug: inst?.slug ?? "",
      };
    });

    const systemHealth = {
      databaseStatus: "OPERATIONAL",
      databaseLatencyMs: dbLatencyMs,
      storageStatus: "OPERATIONAL",
      aiModelStatus: "OPERATIONAL",
      aiModelName: process.env.ZI_AI_MODEL || "gemini-2.5-flash",
      environment: process.env.NODE_ENV || "development",
      questionBankCount,
    };

    return Response.json(
      {
        institutes,
        subscriptions,
        plans,
        flags,
        overrides,
        audits,
        counts,
        members: enrichedMembers,
        usageCounters,
        brandings,
        demoRequests,
        supportRequests,
        aiDrafts,
        systemHealth,
      },
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
    return Response.json(
      { error: "Invalid platform operation payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const client = getPrepziiAdmin();

  try {
    // 1. ASSIGN_ORGANIZATION_PLAN
    if (parsed.data.action === "ASSIGN_ORGANIZATION_PLAN") {
      const { organizationId, planId, status, extendDays } = parsed.data.payload;
      const now = new Date();
      const periodEnd = extendDays
        ? new Date(now.getTime() + extendDays * 86400 * 1000).toISOString()
        : new Date(now.getTime() + 30 * 86400 * 1000).toISOString();

      const updatePayload: Record<string, unknown> = {
        organization_id: organizationId,
        plan_id: planId,
        status: status ?? "ACTIVE",
        current_period_end: periodEnd,
        requested_plan_id: null,
        updated_at: now.toISOString(),
      };
      if (status === "TRIAL") {
        updatePayload.trial_ends_at = periodEnd;
      }

      const { error: subErr } = await client
        .from("organization_subscriptions")
        .upsert(updatePayload, { onConflict: "organization_id" });

      if (subErr) {
        return Response.json({ error: subErr.message }, { status: 500 });
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "assign_organization_plan",
        details: { planId, status: status ?? "ACTIVE", extendDays },
      });

      return Response.json({ result: { action: "ASSIGN_ORGANIZATION_PLAN", organizationId, planId } });
    }

    // 2. UPDATE_INSTITUTE_DETAILS
    if (parsed.data.action === "UPDATE_INSTITUTE_DETAILS") {
      const {
        organizationId,
        name,
        slug,
        instituteType,
        contactEmail,
        contactPhone,
        ownerUserId,
        primaryColor,
        subdomain,
        verifySubdomain,
      } = parsed.data.payload;

      const { error: instErr } = await client
        .from("institutes")
        .update({
          name,
          slug: slug.toLowerCase(),
          institute_type: instituteType,
          contact_email: contactEmail || null,
          contact_phone: contactPhone || null,
          owner_user_id: ownerUserId,
          ...(primaryColor ? { primary_color: primaryColor } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId);

      if (instErr) {
        return Response.json({ error: instErr.message }, { status: 400 });
      }

      if (subdomain !== undefined || primaryColor) {
        await client.from("organization_branding").upsert(
          {
            organization_id: organizationId,
            primary_color: primaryColor || "#0B132B",
            subdomain: subdomain ? subdomain.toLowerCase() : null,
            subdomain_verified_at: verifySubdomain ? new Date().toISOString() : null,
            support_email: contactEmail || null,
            support_phone: contactPhone || null,
            updated_by: actorUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id" }
        );
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "update_institute_details",
        details: { name, slug, instituteType, ownerUserId, subdomain, verifySubdomain },
      });

      return Response.json({ result: { organizationId } });
    }

    // 3. CREATE_INSTITUTE
    if (parsed.data.action === "CREATE_INSTITUTE") {
      const {
        name,
        slug,
        planId,
        instituteType,
        contactEmail,
        contactPhone,
        ownerUserId,
        subscriptionStatus,
      } = parsed.data.payload;

      const resolvedOwner = ownerUserId?.trim() || actorUserId;
      const resolvedEmail = (contactEmail?.trim() || "owner@prepzii.com").toLowerCase();

      const { data: newOrg, error: orgErr } = await client
        .from("institutes")
        .insert({
          name,
          slug: slug.toLowerCase(),
          owner_user_id: resolvedOwner,
          institute_type: instituteType,
          contact_email: resolvedEmail,
          contact_phone: contactPhone?.trim() || null,
          status: "ACTIVE",
        })
        .select("id")
        .single();

      if (orgErr) {
        return Response.json({ error: orgErr.message }, { status: 400 });
      }

      await client.from("institute_members").upsert(
        {
          institute_id: newOrg.id,
          user_id: resolvedOwner,
          email: resolvedEmail,
          role: "OWNER",
          status: "ACTIVE",
        },
        { onConflict: "institute_id,email" }
      );

      await client.from("organization_subscriptions").upsert(
        {
          organization_id: newOrg.id,
          plan_id: planId,
          status: subscriptionStatus,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
        },
        { onConflict: "organization_id" }
      );

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: newOrg.id,
        action: "create_organization",
        details: { name, slug, planId, instituteType, ownerUserId: resolvedOwner },
      });

      return Response.json({ result: { organizationId: newOrg.id } });
    }

    // 4. CREATE_PLAN
    if (parsed.data.action === "CREATE_PLAN") {
      const p = parsed.data.payload;
      const { error: planErr } = await client.from("subscription_plans").insert({
        id: p.planId.toLowerCase(),
        name: p.name,
        price_inr: Math.round(p.monthlyPricePaise / 100),
        monthly_price_paise: p.monthlyPricePaise,
        annual_price_paise: p.annualPricePaise,
        student_limit: p.studentLimit,
        branch_limit: p.branchLimit,
        storage_gb: p.storageGb,
        ai_credits_per_month: p.aiCreditsPerMonth,
        entitlements: p.entitlements,
        is_active: true,
      });

      if (planErr) {
        return Response.json({ error: planErr.message }, { status: 400 });
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        action: "create_subscription_plan",
        details: p,
      });

      return Response.json({ result: { planId: p.planId } });
    }

    // 5. SET_ORG_FEATURE_OVERRIDE & REMOVE_ORG_FEATURE_OVERRIDE
    if (parsed.data.action === "SET_ORG_FEATURE_OVERRIDE") {
      const { organizationId, featureKey, enabled, reason } = parsed.data.payload;
      const { error: ovrErr } = await client.from("organization_feature_overrides").upsert(
        {
          organization_id: organizationId,
          feature_key: featureKey,
          enabled,
          reason,
          updated_by: actorUserId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id,feature_key" }
      );

      if (ovrErr) {
        return Response.json({ error: ovrErr.message }, { status: 400 });
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "set_org_feature_override",
        details: { featureKey, enabled, reason },
      });

      return Response.json({ result: { organizationId, featureKey, enabled } });
    }

    if (parsed.data.action === "REMOVE_ORG_FEATURE_OVERRIDE") {
      const { organizationId, featureKey } = parsed.data.payload;
      await client
        .from("organization_feature_overrides")
        .delete()
        .eq("organization_id", organizationId)
        .eq("feature_key", featureKey);

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "remove_org_feature_override",
        details: { featureKey },
      });

      return Response.json({ result: { organizationId, featureKey } });
    }

    // 6. UPSERT_INSTITUTE_MEMBER
    if (parsed.data.action === "UPSERT_INSTITUTE_MEMBER") {
      const { organizationId, userId, email, displayName, role, status } = parsed.data.payload;
      const { data: memberRow, error: memErr } = await client
        .from("institute_members")
        .upsert(
          {
            institute_id: organizationId,
            user_id: userId,
            email: email.toLowerCase(),
            role,
            status,
          },
          { onConflict: "institute_id,email" }
        )
        .select("id")
        .single();

      if (memErr) {
        return Response.json({ error: memErr.message }, { status: 400 });
      }

      if (displayName && memberRow?.id) {
        await client.from("organization_member_profiles").upsert(
          {
            organization_id: organizationId,
            membership_id: memberRow.id,
            display_name: displayName,
          },
          { onConflict: "membership_id" }
        );
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "upsert_institute_member",
        details: { userId, email, role, status },
      });

      return Response.json({ result: { memberId: memberRow?.id } });
    }

    // 7. UPDATE_MEMBER_ROLE_STATUS & REMOVE_MEMBER
    if (parsed.data.action === "UPDATE_MEMBER_ROLE_STATUS") {
      const { memberId, organizationId, role, status } = parsed.data.payload;
      const { error: updErr } = await client
        .from("institute_members")
        .update({ role, status })
        .eq("id", memberId)
        .eq("institute_id", organizationId);

      if (updErr) {
        return Response.json({ error: updErr.message }, { status: 400 });
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "update_member_role_status",
        details: { memberId, role, status },
      });

      return Response.json({ result: { memberId, role, status } });
    }

    if (parsed.data.action === "REMOVE_MEMBER") {
      const { memberId, organizationId } = parsed.data.payload;
      const { error: delErr } = await client
        .from("institute_members")
        .delete()
        .eq("id", memberId)
        .eq("institute_id", organizationId);

      if (delErr) {
        return Response.json({ error: delErr.message }, { status: 400 });
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "remove_institute_member",
        details: { memberId },
      });

      return Response.json({ result: { memberId } });
    }

    // 8. RESOLVE_PLAN_UPGRADE_REQUEST
    if (parsed.data.action === "RESOLVE_PLAN_UPGRADE_REQUEST") {
      const { organizationId, decision } = parsed.data.payload;
      const { data: sub } = await client
        .from("organization_subscriptions")
        .select("requested_plan_id")
        .eq("organization_id", organizationId)
        .single();

      if (decision === "APPROVE" && sub?.requested_plan_id) {
        await client
          .from("organization_subscriptions")
          .update({
            plan_id: sub.requested_plan_id,
            status: "ACTIVE",
            requested_plan_id: null,
            requested_billing_interval: null,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);
      } else {
        await client
          .from("organization_subscriptions")
          .update({
            requested_plan_id: null,
            requested_billing_interval: null,
            updated_at: new Date().toISOString(),
          })
          .eq("organization_id", organizationId);
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "resolve_plan_upgrade_request",
        details: { decision, approvedPlanId: sub?.requested_plan_id },
      });

      return Response.json({ result: { organizationId, decision } });
    }

    // 9. RESET_USAGE_COUNTER
    if (parsed.data.action === "RESET_USAGE_COUNTER") {
      const { organizationId, metric, newQuantity } = parsed.data.payload;
      const now = new Date();
      const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString().slice(0, 10);

      await client.from("organization_usage_counters").upsert(
        {
          organization_id: organizationId,
          metric,
          period_start: periodStart,
          period_end: periodEnd,
          quantity: newQuantity,
          updated_at: now.toISOString(),
        },
        { onConflict: "organization_id,metric,period_start" }
      );

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "reset_usage_counter",
        details: { metric, newQuantity },
      });

      return Response.json({ result: { organizationId, metric, newQuantity } });
    }

    // 10. DEMO REQUESTS MANAGEMENT & 1-CLICK PROVISIONING
    if (parsed.data.action === "CREATE_DEMO_REQUEST") {
      const d = parsed.data.payload;
      const { error: demoErr } = await client.from("platform_demo_requests").insert({
        full_name: d.fullName,
        institute_name: d.instituteName,
        email: d.email.toLowerCase(),
        phone: d.phone,
        city: d.city,
        student_count: d.studentCount,
        interested_plan: d.interestedPlan,
        notes: d.notes || null,
        status: "PENDING",
      });

      if (demoErr) {
        return Response.json({ error: demoErr.message }, { status: 400 });
      }
      return Response.json({ result: { ok: true } });
    }

    if (parsed.data.action === "UPDATE_DEMO_REQUEST") {
      const { requestId, status, provisionInstitute } = parsed.data.payload;
      const { data: demoReq } = await client
        .from("platform_demo_requests")
        .select("*")
        .eq("id", requestId)
        .single();

      await client.from("platform_demo_requests").update({ status }).eq("id", requestId);

      let provisionedOrgId: string | null = null;
      if (provisionInstitute && demoReq) {
        const baseSlug = String(demoReq.institute_name || "academy")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "")
          .slice(0, 48);
        const uniqueSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
        const planId = String(demoReq.interested_plan || "growth").toLowerCase();

        const { data: newOrg } = await client
          .from("institutes")
          .insert({
            name: String(demoReq.institute_name),
            slug: uniqueSlug,
            owner_user_id: actorUserId,
            contact_email: String(demoReq.email).toLowerCase(),
            contact_phone: String(demoReq.phone),
            status: "ACTIVE",
          })
          .select("id")
          .single();

        if (newOrg?.id) {
          provisionedOrgId = newOrg.id;
          await client.from("institute_members").upsert(
            {
              institute_id: newOrg.id,
              user_id: actorUserId,
              email: String(demoReq.email).toLowerCase(),
              role: "OWNER",
              status: "ACTIVE",
            },
            { onConflict: "institute_id,email" }
          );

          await client.from("organization_subscriptions").upsert(
            {
              organization_id: newOrg.id,
              plan_id: ["basic", "growth", "scale"].includes(planId) ? planId : "growth",
              status: "TRIAL",
              trial_ends_at: new Date(Date.now() + 14 * 86400 * 1000).toISOString(),
            },
            { onConflict: "organization_id" }
          );
        }
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: provisionedOrgId,
        action: "update_demo_request",
        details: { requestId, status, provisionInstitute, provisionedOrgId },
      });

      return Response.json({ result: { requestId, status, provisionedOrgId } });
    }

    // 11. BROADCAST_ANNOUNCEMENT
    if (parsed.data.action === "BROADCAST_ANNOUNCEMENT") {
      const { targetOrganizationId, title, content, priority, targetAudience } = parsed.data.payload;
      let orgIds: string[] = [];

      if (targetOrganizationId) {
        orgIds = [targetOrganizationId];
      } else {
        const { data: activeOrgs } = await client
          .from("institutes")
          .select("id")
          .eq("status", "ACTIVE");
        orgIds = (activeOrgs ?? []).map((o) => String(o.id));
      }

      if (orgIds.length > 0) {
        const rows = orgIds.map((orgId) => ({
          organization_id: orgId,
          title: `[Platform Broadcast] ${title}`,
          content,
          priority,
          target_audience: targetAudience,
          category: "GENERAL",
          status: "PUBLISHED",
          channels: ["PORTAL"],
          created_by: actorUserId,
          published_at: new Date().toISOString(),
        }));
        await client.from("organization_announcements").insert(rows);
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: targetOrganizationId ?? null,
        action: "platform_broadcast_announcement",
        details: { title, priority, targetAudience, recipientInstituteCount: orgIds.length },
      });

      return Response.json({ result: { recipientInstituteCount: orgIds.length } });
    }

    // 12. SUPPORT ACCESS MANAGEMENT
    if (parsed.data.action === "GRANT_SUPPORT_ACCESS") {
      const { organizationId, reason, durationHours } = parsed.data.payload;
      const expiresAt = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

      const { data: reqRow, error: supErr } = await client
        .from("platform_support_access_requests")
        .insert({
          organization_id: organizationId,
          requested_by: actorUserId,
          reason,
          status: "APPROVED",
          approved_by: actorUserId,
          expires_at: expiresAt,
        })
        .select("id")
        .single();

      if (supErr) {
        return Response.json({ error: supErr.message }, { status: 400 });
      }

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        target_organization_id: organizationId,
        action: "grant_support_access",
        details: { requestId: reqRow?.id, reason, durationHours, expiresAt },
      });

      return Response.json({ result: { requestId: reqRow?.id, expiresAt } });
    }

    if (parsed.data.action === "REVOKE_SUPPORT_ACCESS") {
      const { requestId } = parsed.data.payload;
      await client
        .from("platform_support_access_requests")
        .update({ status: "REVOKED", updated_at: new Date().toISOString() })
        .eq("id", requestId);

      await client.from("platform_audit_logs").insert({
        actor_user_id: actorUserId,
        actor_role: "PLATFORM_SUPER_ADMIN",
        action: "revoke_support_access",
        details: { requestId },
      });

      return Response.json({ result: { requestId } });
    }

    // 13. Fallback to standard platform mutation RPC for SET_ORGANIZATION_STATUS, UPDATE_PLAN, SET_FEATURE_FLAG
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
  } catch (err) {
    console.error("Platform POST error:", err);
    return Response.json({ error: "Failed to execute platform command." }, { status: 500 });
  }
}
