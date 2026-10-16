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

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "That institute URL is already in use." }, { status: 409 });
    }
    console.error("Institute onboarding failed", error);
    return Response.json({ error: "Institute onboarding is temporarily unavailable." }, { status: 503 });
  }

  const organization = (data as OnboardedOrganization[] | null)?.[0];
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
