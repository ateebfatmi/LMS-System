import { NextResponse } from "next/server";
import { z } from "zod";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";
import { guardRateLimit } from "@/lib/rate-limit";

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

async function notifyPrepzii(requestId: string, details: z.infer<typeof demoRequestSchema>) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.DEMO_REQUEST_FROM_EMAIL?.trim();
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `demo-request/${requestId}`,
      },
      signal: AbortSignal.timeout(5000),
      body: JSON.stringify({
        from,
        to: ["contact@prepzii.com"],
        reply_to: details.email,
        subject: "New Prepzii walkthrough request",
        text: [
          `Request ID: ${requestId}`,
          `Name: ${details.fullName}`,
          `Institute: ${details.instituteName}`,
          `Work email: ${details.email}`,
          `Phone: ${details.phone}`,
          `City: ${details.city}`,
          `Enrolled students: ${details.studentCount}`,
          `Interested plan: ${details.interestedPlan}`,
          "",
          "Notes:",
          details.notes || "None",
        ].join("\n"),
      }),
    });
    if (!response.ok) {
      console.warn("Demo request email rejected", { requestId, status: response.status });
    }
    return response.ok;
  } catch {
    console.warn("Demo request email could not be sent", { requestId });
    return false;
  }
}

export async function POST(request: Request) {
  const limited = await guardRateLimit({ request, scope: "demo-request", limit: 5, windowSeconds: 3600 });
  if (limited) return limited;

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
    const emailNotification = await notifyPrepzii(data.id, parsed.data);
    return NextResponse.json(
      {
        success: true,
        message: emailNotification
          ? "Your demo request has been received. The PrepZii team will contact you shortly."
          : "Your walkthrough request was saved. Email notification is currently unavailable.",
        emailNotification,
        requestId: data.id,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to persist demo request", error);
    return NextResponse.json({ error: "Unable to submit the request right now." }, { status: 503 });
  }
}
