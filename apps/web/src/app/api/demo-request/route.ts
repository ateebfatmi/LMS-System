import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";

const demoRequestSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  instituteName: z.string().trim().min(2).max(180),
  email: z.email().max(254),
  phone: z.string().trim().regex(/^(?:\+?91[\s-]?)?[6-9]\d{9}$/),
  city: z.string().trim().min(2).max(120),
  studentCount: z.string().trim().max(40).optional().default("not-specified"),
  interestedPlan: z.enum(["basic", "growth", "scale", "enterprise"]).optional().default("growth"),
  notes: z.string().trim().max(2_000).optional(),
});

export async function POST(request: Request) {
  const parsed = demoRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the submitted contact details.", fields: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    const { data, error } = await getPrepziiAdmin()
      .from("platform_demo_requests")
      .insert({
        full_name: parsed.data.fullName,
        institute_name: parsed.data.instituteName,
        email: parsed.data.email.toLowerCase(),
        phone: parsed.data.phone,
        city: parsed.data.city,
        student_count: parsed.data.studentCount,
        interested_plan: parsed.data.interestedPlan,
        notes: parsed.data.notes ?? null,
      })
      .select("id")
      .single();

    if (error) throw error;
    return NextResponse.json(
      {
        success: true,
        message: "Your demo request has been received. The PrepZii team will contact you shortly.",
        requestId: data.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to persist demo request", error);
    return NextResponse.json({ error: "Unable to submit the request right now." }, { status: 503 });
  }
}
