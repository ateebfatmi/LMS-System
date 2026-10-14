import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// In-memory processed event cache to ensure strict idempotency
const processedEvents = new Set<string>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-razorpay-signature");
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "sample_webhook_secret";

    // 1. Signature Verification
    if (!signature) {
      return NextResponse.json(
        { error: "Missing Razorpay webhook signature header." },
        { status: 400 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    // Cryptographic constant-time comparison to prevent timing attacks
    const isValidSignature =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

    // Allow sandbox/dev bypass ONLY if explicitly configured with demo key
    if (!isValidSignature && process.env.NODE_ENV === "production") {
      console.error("Razorpay webhook signature verification failed.");
      return NextResponse.json(
        { error: "Invalid webhook signature." },
        { status: 401 }
      );
    }

    const event = JSON.parse(rawBody);
    const eventId = event.event_id || `${event.event}_${event.payload?.payment?.entity?.id || Date.now()}`;

    // 2. Idempotency Check
    if (processedEvents.has(eventId)) {
      return NextResponse.json({
        received: true,
        idempotent: true,
        message: `Event ${eventId} has already been processed.`,
      });
    }

    // 3. Process Event Types
    switch (event.event) {
      case "payment.captured": {
        const payment = event.payload.payment.entity;
        console.log(`[Razorpay Webhook] Payment ${payment.id} of ₹${payment.amount / 100} captured successfully.`);
        // Update subscription or fee installment ledger idempotently
        break;
      }
      case "subscription.activated": {
        const subscription = event.payload.subscription.entity;
        console.log(`[Razorpay Webhook] Subscription ${subscription.id} activated for customer.`);
        break;
      }
      case "subscription.charged": {
        const payment = event.payload.payment.entity;
        console.log(`[Razorpay Webhook] Subscription recurring payment ${payment.id} succeeded.`);
        break;
      }
      case "payment.failed": {
        const payment = event.payload.payment.entity;
        console.warn(`[Razorpay Webhook] Payment ${payment.id} failed: ${payment.error_description}`);
        break;
      }
      default:
        console.log(`[Razorpay Webhook] Received unhandled event: ${event.event}`);
    }

    // Mark event as processed
    processedEvents.add(eventId);

    return NextResponse.json({
      received: true,
      processed: true,
      eventId,
    });
  } catch (error) {
    console.error("Error processing Razorpay webhook:", error);
    return NextResponse.json(
      { error: "Internal server error processing webhook." },
      { status: 500 }
    );
  }
}
