import { z } from "zod";
import { getPlatformAdminUserId, getPrepziiAdmin, isPlatformAdmin } from "@/lib/prepzii-backend";
import { isOwnerInvitationConfigured, manageOwnerInvitation, prepareOwnerInvitation } from "@/lib/platform-owner-invitations";
import { deliverInvitation } from "@/lib/invitation-delivery";
import { guardRateLimit } from "@/lib/rate-limit";

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
      slug: z.string().trim().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      instituteType: z
        .enum(["COACHING", "TUITION", "SCHOOL", "ONLINE_ACADEMY", "INDIVIDUAL_TUTOR", "OTHER"])
        .default("COACHING"),
      contactEmail: z.string().trim().max(160).optional().nullable(),
      contactPhone: z.string().trim().max(40).optional().nullable(),
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
      slug: z.string().trim().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      planId: z.string().default("basic"),
      instituteType: z
        .enum(["COACHING", "TUITION", "SCHOOL", "ONLINE_ACADEMY", "INDIVIDUAL_TUTOR", "OTHER"])
        .default("COACHING"),
      contactEmail: z.string().trim().max(160).optional(),
      contactPhone: z.string().trim().max(40).optional(),
      ownerEmail: z.email().max(320),
      subscriptionStatus: z.enum(["ACTIVE", "TRIAL"]).default("ACTIVE"),
    }),
  }),
  z.object({
    action: z.literal("INVITE_INITIAL_OWNER"),
    payload: z.object({ organizationId: z.uuid(), email: z.email().max(320), replaceId: z.uuid().optional() }),
  }),
  z.object({
    action: z.literal("REVOKE_INITIAL_OWNER"),
    payload: z.object({ organizationId: z.uuid(), invitationId: z.uuid() }),
  }),
  z.object({
    action: z.literal("RESOLVE_PLAN_UPGRADE_REQUEST"),
    payload: z.object({
      organizationId: z.string().uuid(),
      decision: z.enum(["APPROVE", "REJECT"]),
    }),
  }),
  z.object({
    action: z.literal("UPDATE_DEMO_REQUEST"),
    payload: z.object({
      requestId: z.string().uuid(),
      status: z.enum(["PENDING", "CONTACTED", "DEMO_GIVEN", "ONBOARDED", "REJECTED"]),
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
      priority: z.enum(["NORMAL", "HIGH", "URGENT"]).default("HIGH"),
      targetAudience: z.enum(["ALL", "STUDENTS", "FACULTY"]).default("ALL"),
    }),
  }),
  z.object({
    action: z.literal("REQUEST_SUPPORT_ACCESS"),
    payload: z.object({
      organizationId: z.string().uuid(),
      reason: z.string().trim().min(10).max(500),
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

async function platformRows(query: PromiseLike<{ data: Row[] | null; error: { message: string; code: string } | null }>): Promise<Row[]> {
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

async function allPlatformRows(loadPage: (from: number) => Promise<Row[]>): Promise<Row[]> {
  const rows: Row[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = await loadPage(offset);
    rows.push(...page);
    if (page.length < 500) return rows;
  }
}

export async function GET() {
  if (!(await isPlatformAdmin())) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const client = getPrepziiAdmin();

  try {
    const ownerInvitationsQuery = allPlatformRows((from) => platformRows(client.from("organization_invitations")
      .select("id,organization_id,email,status,expires_at,clerk_invitation_id").eq("role", "OWNER")
      .order("created_at", { ascending: false }).order("id").range(from, from + 499)))
      .catch((error: { code?: string; message?: string }) => {
        if (error.code === "42703" && error.message?.includes("clerk_invitation_id")) return null;
        throw error;
      });
    const [
      institutes,
      subscriptions,
      plans,
      flags,
      overrides,
      audits,
      members,
      batches,
      brandings,
      demoRequests,
      supportRequests,
      ownerInvitations,
    ] = await Promise.all([
      allPlatformRows((from) => platformRows(client.from("institutes")
        .select("id,name,slug,owner_user_id,status,institute_type,contact_email,contact_phone,primary_color,created_at")
        .order("created_at", { ascending: false }).order("id").range(from, from + 499))),
      allPlatformRows((from) => platformRows(client.from("organization_subscriptions")
        .select("id,organization_id,plan_id,status,current_period_start,current_period_end,trial_ends_at,grace_ends_at,cancel_at_period_end,requested_plan_id,requested_billing_interval,updated_at")
        .order("id").range(from, from + 499))),
      platformRows(
        client
          .from("subscription_plans")
          .select(
            "id,name,monthly_price_paise,annual_price_paise,student_limit,branch_limit,storage_gb,ai_credits_per_month,entitlements,is_active"
          )
          .order("monthly_price_paise")
      ),
      platformRows(
        client
          .from("platform_feature_flags")
          .select("key,description,enabled_by_default,updated_by,updated_at")
          .order("key")
      ),
      platformRows(
        client
          .from("organization_feature_overrides")
          .select("organization_id,feature_key,enabled,reason,updated_by,updated_at")
      ),
      platformRows(
        client
          .from("platform_audit_logs")
          .select("id,actor_user_id,actor_role,target_organization_id,action,details,created_at")
          .order("created_at", { ascending: false })
          .limit(200)
      ),
      allPlatformRows((from) => platformRows(client.from("institute_members").select("institute_id,role")
        .eq("status", "ACTIVE").not("user_id", "is", null).order("id").range(from, from + 499))),
      allPlatformRows((from) => platformRows(client.from("organization_batches").select("organization_id")
        .eq("is_active", true).order("id").range(from, from + 499))),
      platformRows(
        client
          .from("organization_branding")
          .select(
            "organization_id,logo_url,primary_color,support_email,support_phone,subdomain,subdomain_verified_at"
          )
      ),
      platformRows(
        client
          .from("platform_demo_requests")
          .select(
            "id,full_name,institute_name,email,phone,city,student_count,interested_plan,notes,status,created_at"
          )
          .order("created_at", { ascending: false })
          .limit(200)
      ),
      platformRows(
        client
          .from("platform_support_access_requests")
          .select("id,organization_id,requested_by,reason,status,approved_by,expires_at,created_at")
          .order("created_at", { ascending: false })
          .limit(100)
      ),
      ownerInvitationsQuery,
    ]);

    const membershipCounts = new Map<unknown, Map<string, number>>();
    for (const member of members) {
      const roles = membershipCounts.get(member.institute_id) ?? new Map<string, number>();
      const role = String(member.role);
      roles.set(role, (roles.get(role) ?? 0) + 1);
      membershipCounts.set(member.institute_id, roles);
    }
    const batchCounts = new Map<unknown, number>();
    for (const batch of batches) batchCounts.set(batch.organization_id, (batchCounts.get(batch.organization_id) ?? 0) + 1);
    const counts = institutes.map(({ id }) => {
      const byRole = membershipCounts.get(id) ?? new Map<string, number>();
      return { organizationId: id, byRole: Object.fromEntries(byRole), activeStudents: byRole.get("STUDENT") ?? 0,
        activeStaff: [...byRole].filter(([role]) => !["STUDENT", "PARENT"].includes(role)).reduce((count, [, total]) => count + total, 0),
        activeBatches: batchCounts.get(id) ?? 0 };
    });

    return Response.json(
      {
        institutes,
        subscriptions,
        plans,
        flags,
        overrides,
        audits,
        counts,
        brandings,
        demoRequests,
        supportRequests: supportRequests.map((record) => ({
          ...record,
          status: record.status === "APPROVED" && Date.parse(String(record.expires_at)) <= Date.now() ? "EXPIRED" : record.status,
        })),
        ownerProvisioningReady: ownerInvitations !== null && isOwnerInvitationConfigured(),
        ownerInvitationHistoryAvailable: ownerInvitations !== null,
        ownerInvitations: (ownerInvitations ?? []).map(({ clerk_invitation_id, ...invite }) => ({
          ...invite, delivered: Boolean(clerk_invitation_id),
          status: invite.status === "PENDING" && Date.parse(String(invite.expires_at)) <= Date.now() ? "EXPIRED" : invite.status,
        })),
      },
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Platform admin query failed", error);
    return Response.json({ error: "Unable to load platform administration." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const actorUserId = await getPlatformAdminUserId();
  if (!actorUserId) return Response.json({ error: "Forbidden" }, { status: 403 });
  const parsed = mutationSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return Response.json(
      { error: "Invalid platform operation payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const client = getPrepziiAdmin();
  async function auditedResult(result: Row, audit: Row) {
    const { error } = await client.from("platform_audit_logs").insert({
      ...audit,
      actor_user_id: actorUserId,
      actor_role: "PLATFORM_SUPER_ADMIN",
    });
    if (error) console.error("Platform audit write failed", { action: audit.action, code: error.code });
    return Response.json({ result, auditSaved: !error });
  }

  try {
    if ((parsed.data.action === "CREATE_INSTITUTE" || parsed.data.action === "INVITE_INITIAL_OWNER")
      && !isOwnerInvitationConfigured()) {
      return Response.json({ error: "Owner invitation configuration is incomplete." }, { status: 503 });
    }
    // 1. ASSIGN_ORGANIZATION_PLAN
    if (parsed.data.action === "ASSIGN_ORGANIZATION_PLAN") {
      const { organizationId, planId, status, extendDays } = parsed.data.payload;
      const now = new Date();
      const { data: current, error: currentError } = await client.from("organization_subscriptions")
        .select("status,current_period_end,trial_ends_at,updated_at").eq("organization_id", organizationId).maybeSingle();
      if (currentError) return Response.json({ error: "Unable to load the current subscription." }, { status: 503 });
      const nextStatus = status ?? current?.status ?? "ACTIVE";
      const currentEnd = current?.current_period_end ? Date.parse(current.current_period_end) : now.getTime();
      const periodEnd = extendDays || !current
        ? new Date(Math.max(currentEnd, now.getTime()) + (extendDays ?? 30) * 86400 * 1000).toISOString()
        : current.current_period_end;
      const values = {
        plan_id: planId,
        status: nextStatus,
        current_period_end: periodEnd,
        trial_ends_at: nextStatus === "TRIAL" ? periodEnd : current?.trial_ends_at ?? null,
        updated_at: now.toISOString(),
      };
      const subscriptions = client.from("organization_subscriptions");
      const { data: saved, error: subErr } = await (current
        ? subscriptions.update(values).eq("organization_id", organizationId).eq("updated_at", current.updated_at)
        : subscriptions.insert({ organization_id: organizationId, ...values })).select("id").maybeSingle();
      if (subErr) {
        if (subErr.code === "23505") return Response.json({ error: "The subscription changed. Refresh and try again." }, { status: 409 });
        return Response.json({ error: "Unable to save the subscription." }, { status: 503 });
      }
      if (!saved) return Response.json({ error: "The subscription changed. Refresh and try again." }, { status: 409 });

      return auditedResult({ action: "ASSIGN_ORGANIZATION_PLAN", organizationId, planId }, {
        target_organization_id: organizationId,
        action: "assign_organization_plan",
        details: { planId, status: nextStatus, extendDays },
      });
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
        primaryColor,
        subdomain,
        verifySubdomain,
      } = parsed.data.payload;

      const { data: institute, error: instErr } = await client
        .from("institutes")
        .update({
          name,
          slug: slug.toLowerCase(),
          institute_type: instituteType,
          ...(contactEmail !== undefined ? { contact_email: contactEmail || null } : {}),
          ...(contactPhone !== undefined ? { contact_phone: contactPhone || null } : {}),
          ...(primaryColor ? { primary_color: primaryColor } : {}),
          updated_at: new Date().toISOString(),
        })
        .eq("id", organizationId).select("id").maybeSingle();

      if (instErr) {
        return Response.json({ error: instErr.message }, { status: 400 });
      }
      if (!institute) return Response.json({ error: "Institute not found." }, { status: 404 });

      if (subdomain !== undefined || primaryColor || contactEmail !== undefined || contactPhone !== undefined) {
        const { error: brandingError } = await client.from("organization_branding").upsert(
          {
            organization_id: organizationId,
            ...(primaryColor ? { primary_color: primaryColor } : {}),
            ...(subdomain !== undefined ? { subdomain: subdomain ? subdomain.toLowerCase() : null,
              subdomain_verified_at: subdomain && verifySubdomain ? new Date().toISOString() : null } : {}),
            ...(contactEmail !== undefined ? { support_email: contactEmail || null } : {}),
            ...(contactPhone !== undefined ? { support_phone: contactPhone || null } : {}),
            updated_by: actorUserId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "organization_id" }
        );
        if (brandingError) {
          console.error("Platform institute branding update failed", brandingError.code);
          return Response.json({ error: "Institute details were saved. Branding could not be updated." }, { status: 503 });
        }
      }

      return auditedResult({ organizationId }, {
        target_organization_id: organizationId,
        action: "update_institute_details",
        details: { name, slug, instituteType, subdomain, verifySubdomain },
      });
    }

    if (["CREATE_INSTITUTE", "INVITE_INITIAL_OWNER", "REVOKE_INITIAL_OWNER"].includes(parsed.data.action)) {
      const limited = await guardRateLimit({ request, scope: "platform-provisioning", subject: actorUserId,
        limit: 30, windowSeconds: 3600 });
      if (limited) return limited;
    }

    if (parsed.data.action === "CREATE_INSTITUTE") {
      const { ownerEmail, ...payload } = parsed.data.payload;
      const organizationId = crypto.randomUUID();
      const invitation = prepareOwnerInvitation(organizationId, ownerEmail);
      const { data, error } = await client.rpc("lms_provision_institute", {
        p_actor: actorUserId, p_organization_id: organizationId,
        p_payload: { ...payload, contactEmail: payload.contactEmail || invitation.email },
        p_email: invitation.email, p_hash: invitation.hash, p_key: invitation.key,
      });
      if (error) {
        if (error.code === "23505") return Response.json({ error: "An institute with this slug already exists." }, { status: 409 });
        if (error.code === "23503") return Response.json({ error: "The selected subscription plan is unavailable." }, { status: 400 });
        console.error("Institute provisioning failed", error.code);
        return Response.json({ error: "Unable to create institute." }, { status: 503 });
      }
      const emailSent = await deliverInvitation({ id: data.id, email: invitation.email, expiresAt: data.expires_at });
      return Response.json({ result: { organizationId, emailSent } },
        { status: 201, headers: { "cache-control": "no-store" } });
    }

    if (parsed.data.action === "INVITE_INITIAL_OWNER" || parsed.data.action === "REVOKE_INITIAL_OWNER") {
      const operation = parsed.data.action === "INVITE_INITIAL_OWNER"
        ? await manageOwnerInvitation({ ...parsed.data.payload, actorId: actorUserId })
        : await manageOwnerInvitation({ organizationId: parsed.data.payload.organizationId, actorId: actorUserId,
          replaceId: parsed.data.payload.invitationId });
      if (operation.error) return Response.json({ error: "Unable to change the owner invitation." }, { status: 409 });
      return Response.json(operation, { headers: { "cache-control": "no-store" } });
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

      return auditedResult({ planId: p.planId }, {
        action: "create_subscription_plan",
        details: p,
      });
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

      return auditedResult({ organizationId, featureKey, enabled }, {
        target_organization_id: organizationId,
        action: "set_org_feature_override",
        details: { featureKey, enabled, reason },
      });
    }

    if (parsed.data.action === "REMOVE_ORG_FEATURE_OVERRIDE") {
      const { organizationId, featureKey } = parsed.data.payload;
      const { error } = await client
        .from("organization_feature_overrides")
        .delete()
        .eq("organization_id", organizationId)
        .eq("feature_key", featureKey);
      if (error) return Response.json({ error: "Unable to remove the feature override." }, { status: 503 });

      return auditedResult({ organizationId, featureKey }, {
        target_organization_id: organizationId,
        action: "remove_org_feature_override",
        details: { featureKey },
      });
    }

    // 8. RESOLVE_PLAN_UPGRADE_REQUEST
    if (parsed.data.action === "RESOLVE_PLAN_UPGRADE_REQUEST") {
      const { organizationId, decision } = parsed.data.payload;
      const { data: sub, error: lookupError } = await client
        .from("organization_subscriptions")
        .select("requested_plan_id")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (lookupError) return Response.json({ error: "Unable to load the subscription request." }, { status: 503 });
      if (!sub?.requested_plan_id) return Response.json({ error: "This institute has no pending plan request." }, { status: 409 });
      const { data: updated, error: updateError } = await client.from("organization_subscriptions").update({
        ...(decision === "APPROVE" ? { plan_id: sub.requested_plan_id, status: "ACTIVE" } : {}),
        requested_plan_id: null,
        requested_billing_interval: null,
        updated_at: new Date().toISOString(),
      }).eq("organization_id", organizationId).eq("requested_plan_id", sub.requested_plan_id).select("id").maybeSingle();
      if (updateError) return Response.json({ error: "Unable to resolve the subscription request." }, { status: 503 });
      if (!updated) return Response.json({ error: "The pending plan request changed. Refresh and try again." }, { status: 409 });

      return auditedResult({ organizationId, decision }, {
        target_organization_id: organizationId,
        action: "resolve_plan_upgrade_request",
        details: { decision, approvedPlanId: sub?.requested_plan_id },
      });
    }

    // 10. DEMO REQUESTS MANAGEMENT & 1-CLICK PROVISIONING
    if (parsed.data.action === "CREATE_DEMO_REQUEST") {
      const d = parsed.data.payload;
      const { data: demo, error: demoErr } = await client.from("platform_demo_requests").insert({
        full_name: d.fullName,
        institute_name: d.instituteName,
        email: d.email.toLowerCase(),
        phone: d.phone,
        city: d.city,
        student_count: d.studentCount,
        interested_plan: d.interestedPlan,
        notes: d.notes || null,
        status: "PENDING",
      }).select("id").single();

      if (demoErr) {
        return Response.json({ error: demoErr.message }, { status: 400 });
      }
      return auditedResult({ requestId: demo.id }, {
        action: "create_demo_request", details: { requestId: demo.id },
      });
    }

    if (parsed.data.action === "UPDATE_DEMO_REQUEST") {
      const { requestId, status } = parsed.data.payload;
      const { data: demo, error } = await client.from("platform_demo_requests").update({ status })
        .eq("id", requestId).select("id").maybeSingle();
      if (error) return Response.json({ error: "Unable to update demo request." }, { status: 503 });
      if (!demo) return Response.json({ error: "Demo request not found." }, { status: 404 });
      return auditedResult({ requestId, status }, {
        action: "update_demo_request", details: { requestId, status },
      });
    }

    // 11. BROADCAST_ANNOUNCEMENT
    if (parsed.data.action === "BROADCAST_ANNOUNCEMENT") {
      const { data, error } = await client.rpc("lms_platform_broadcast", {
        p_actor: actorUserId,
        p_payload: parsed.data.payload,
      });
      if (error?.code === "22023") return Response.json({ error: "No active institutes match the broadcast target." }, { status: 409 });
      if (error) {
        console.error("Platform broadcast failed", error.code);
        return Response.json({ error: "Unable to publish the broadcast." }, { status: 503 });
      }
      return Response.json({ result: { recipientInstituteCount: data } });
    }

    // 12. SUPPORT ACCESS MANAGEMENT
    if (parsed.data.action === "REQUEST_SUPPORT_ACCESS") {
      const { organizationId, reason } = parsed.data.payload;

      const { data: reqRow, error: supErr } = await client
        .from("platform_support_access_requests")
        .insert({
          organization_id: organizationId,
          requested_by: actorUserId,
          reason,
          status: "PENDING",
        })
        .select("id")
        .single();

      if (supErr) {
        return Response.json({ error: supErr.message }, { status: 400 });
      }

      return auditedResult({ requestId: reqRow?.id }, {
        target_organization_id: organizationId,
        action: "request_support_access",
        details: { requestId: reqRow?.id, reason },
      });
    }

    if (parsed.data.action === "REVOKE_SUPPORT_ACCESS") {
      const { requestId } = parsed.data.payload;
      const { data: revoked, error } = await client
        .from("platform_support_access_requests")
        .update({ status: "REVOKED", updated_at: new Date().toISOString() })
        .eq("id", requestId).eq("status", "APPROVED").select("organization_id").maybeSingle();
      if (error) return Response.json({ error: "Unable to revoke support access." }, { status: 503 });
      if (!revoked) return Response.json({ error: "This support request is no longer approved." }, { status: 409 });

      return auditedResult({ requestId }, {
        target_organization_id: revoked.organization_id,
        action: "revoke_support_access",
        details: { requestId },
      });
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
