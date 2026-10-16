import { NextResponse } from "next/server";

/**
 * The FastAPI webhook endpoint is the single payment-event processor. This
 * route preserves the public Next.js callback URL while forwarding the exact
 * signed bytes. It never interprets or acknowledges a payment independently.
 */
export async function POST(request: Request) {
  const backendUrl = process.env.FASTAPI_INTERNAL_URL;
  const internalApiKey = process.env.INTERNAL_API_KEY;
  const signature = request.headers.get("x-razorpay-signature");

  if (!backendUrl || !internalApiKey) {
    console.error("Razorpay webhook forwarding is not configured.");
    return NextResponse.json({ error: "Webhook processor unavailable." }, { status: 503 });
  }
  if (!signature) {
    return NextResponse.json({ error: "Missing webhook signature." }, { status: 400 });
  }

  const rawBody = await request.arrayBuffer();
  try {
    const response = await fetch(`${backendUrl.replace(/\/$/, "")}/api/v1/webhooks/razorpay`, {
      method: "POST",
      headers: {
        "content-type": request.headers.get("content-type") ?? "application/json",
        "x-razorpay-signature": signature,
        "x-internal-api-key": internalApiKey,
      },
      body: rawBody,
      cache: "no-store",
    });
    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    console.error("Razorpay webhook processor could not be reached.", error);
    return NextResponse.json({ error: "Webhook processor unavailable." }, { status: 503 });
  }
}
