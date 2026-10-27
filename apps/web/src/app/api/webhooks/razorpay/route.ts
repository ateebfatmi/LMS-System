import { NextResponse } from "next/server";
import { guardRateLimit } from "@/lib/rate-limit";

const MAX_WEBHOOK_BYTES = 1_048_576;
const WEBHOOK_TIMEOUT_MS = 8_000;

/**
 * The FastAPI webhook endpoint is the single payment-event processor. This
 * route preserves the public Next.js callback URL while forwarding the exact
 * signed bytes. It never interprets or acknowledges a payment independently.
 */
export async function POST(request: Request) {
  const limited = await guardRateLimit({
    request,
    scope: "razorpay-webhook",
    limit: 300,
    windowSeconds: 60,
  });
  if (limited) return limited;

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

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }

  const rawBody = await request.arrayBuffer();
  if (rawBody.byteLength > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: "Webhook payload is too large." }, { status: 413 });
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
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
      signal: controller.signal,
    });
    const responseBody = await response.text();
    return new NextResponse(responseBody, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch (error) {
    console.error("Razorpay webhook processor could not be reached.", error);
    return NextResponse.json({ error: "Webhook processor unavailable." }, { status: 503 });
  } finally {
    clearTimeout(timeout);
  }
}
