import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";

const onboardingSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().min(2).max(64).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  instituteType: z.enum(["COACHING", "TUITION", "SCHOOL", "ONLINE_ACADEMY", "INDIVIDUAL_TUTOR", "OTHER"]),
  phone: z.string().trim().regex(/^(?:\+?91[\s-]?)?[6-9]\d{9}$/),
  city: z.string().trim().min(2).max(120),
  state: z.string().trim().min(2).max(120),
});

type OnboardedOrganization = { id: string; name: string; slug: string; status: string };

type LegacyOrganization = OnboardedOrganization & { owner_user_id: string };

type DatabaseError = {
  code?: string;
  message?: string;
};

function isMissingOnboardingRpc(error: DatabaseError | null) {
  return error?.code === "PGRST202" && error.message?.includes("lms_create_institute");
}

async function createInstituteAgainstCanonicalSchema({
  ownerUserId,
  ownerEmail,
  name,
  slug,
}: {
  ownerUserId: string;
  ownerEmail: string;
  name: string;
  slug: string;
}): Promise<{ organization?: OnboardedOrganization; conflict?: boolean; error?: DatabaseError }> {
  const admin = getPrepziiAdmin();
  const selectOrganization = () =>
    admin
      .from("institutes")
      .select("id,name,slug,status,owner_user_id")
      .eq("slug", slug)
      .maybeSingle<LegacyOrganization>();

  const { data: initialOrganization, error: lookupError } = await selectOrganization();
  let organization = initialOrganization;
  if (lookupError) return { error: lookupError };
  if (organization && organization.owner_user_id !== ownerUserId) return { conflict: true };

  let createdOrganization = false;
  if (!organization) {
    const inserted = await admin
      .from("institutes")
      .insert({ name, slug, owner_user_id: ownerUserId, status: "ACTIVE" })
      .select("id,name,slug,status,owner_user_id")
      .single<LegacyOrganization>();

    organization = inserted.data;
    if (inserted.error?.code === "23505") {
      const raced = await selectOrganization();
      if (raced.error) return { error: raced.error };
      if (!raced.data || raced.data.owner_user_id !== ownerUserId) return { conflict: true };
      organization = raced.data;
    } else if (inserted.error) {
      return { error: inserted.error };
    } else {
      createdOrganization = true;
    }
  }

  if (!organization) return { error: { message: "Institute creation returned no record." } };

  const normalizedEmail = ownerEmail.toLowerCase();
  const [byUser, byEmail] = await Promise.all([
    admin
      .from("institute_members")
      .select("id")
      .eq("institute_id", organization.id)
      .eq("user_id", ownerUserId)
      .maybeSingle<{ id: string }>(),
    admin
        .from("institute_members")
        .select("id")
        .eq("institute_id", organization.id)
        .eq("email", normalizedEmail)
        .maybeSingle<{ id: string }>(),
  ]);

  const existingMembership = byUser.data ?? byEmail.data;
  const membershipLookupError = byUser.error ?? byEmail.error;

  if (membershipLookupError) {
    if (createdOrganization) await admin.from("institutes").delete().eq("id", organization.id);
    return { error: membershipLookupError };
  }

  const membershipResult = existingMembership
    ? await admin
        .from("institute_members")
        .update({ user_id: ownerUserId, email: normalizedEmail, role: "OWNER", status: "ACTIVE" })
        .eq("id", existingMembership.id)
    : await admin.from("institute_members").insert({
        institute_id: organization.id,
        user_id: ownerUserId,
        email: normalizedEmail,
        role: "OWNER",
        status: "ACTIVE",
      });

  if (membershipResult.error) {
    if (createdOrganization) await admin.from("institutes").delete().eq("id", organization.id);
    return { error: membershipResult.error };
  }

  return {
    organization: {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
    },
  };
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const user = await currentUser();
  const ownerEmail = user?.primaryEmailAddress?.emailAddress;
  if (!ownerEmail || user?.primaryEmailAddress?.verification?.status !== "verified") {
    return Response.json({ error: "A verified primary email is required." }, { status: 409 });
  }

  const parsed = onboardingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Please check the institute details.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { data, error } = await getPrepziiAdmin().rpc("lms_create_institute", {
    owner_user_id: userId,
    owner_email: ownerEmail,
    institute_name: parsed.data.name,
    institute_slug: parsed.data.slug,
    institute_kind: parsed.data.instituteType,
    institute_phone: parsed.data.phone,
    institute_city: parsed.data.city,
    institute_state: parsed.data.state,
  });

  let organization = (data as OnboardedOrganization[] | null)?.[0];

  if (isMissingOnboardingRpc(error)) {
    console.warn("lms_create_institute is unavailable; using the canonical schema compatibility path.");
    const fallback = await createInstituteAgainstCanonicalSchema({
      ownerUserId: userId,
      ownerEmail,
      name: parsed.data.name,
      slug: parsed.data.slug,
    });
    if (fallback.conflict) {
      return Response.json({ error: "That institute URL is already in use." }, { status: 409 });
    }
    if (fallback.error) {
      console.error("Canonical institute onboarding failed", fallback.error);
      return Response.json({ error: "Institute onboarding is temporarily unavailable." }, { status: 503 });
    }
    organization = fallback.organization;
  } else if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That institute URL is already in use." }, { status: 409 });
    }
    console.error("Institute onboarding failed", error);
    return Response.json({ error: "Institute onboarding is temporarily unavailable." }, { status: 503 });
  }

  if (!organization) {
    return Response.json({ error: "Institute onboarding did not complete." }, { status: 500 });
  }

  (await cookies()).set("prepzii_active_organization", organization.slug, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return Response.json({ organization }, { status: 201 });
}
