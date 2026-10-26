import "server-only";

import { createHash } from "node:crypto";
import { getPrepziiAdmin } from "@/lib/prepzii-backend";

type RateLimitRow = {
  allowed: boolean;
  remaining: number;
  retry_after_seconds: number;
};

export class RateLimitExceededError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    super("Too many requests.");
    this.name = "RateLimitExceededError";
  }
}

function requestAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "address-unavailable";
}

export async function enforceRateLimit(input: {
  request: Request;
  scope: string;
  subject?: string;
  limit: number;
  windowSeconds: number;
}): Promise<void> {
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!hasSupabase) {
    if (process.env.NODE_ENV === "production") throw new Error("Rate-limit store is unavailable.");
    return;
  }

  const subjectHash = createHash("sha256")
    .update(`${input.scope}:${input.subject || requestAddress(input.request)}`)
    .digest("hex");
  const { data, error } = await getPrepziiAdmin().rpc("lms_consume_rate_limit", {
    p_scope: input.scope,
    p_subject_hash: subjectHash,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });

  if (error) throw new Error(`Rate-limit check failed: ${error.message}`);
  const result = (data as RateLimitRow[] | null)?.[0];
  if (!result) throw new Error("Rate-limit check returned no result.");
  if (!result.allowed) throw new RateLimitExceededError(result.retry_after_seconds);
}

export function rateLimitResponse(error: RateLimitExceededError): Response {
  return Response.json(
    { error: "Too many requests. Please try again later." },
    { status: 429, headers: { "retry-after": String(error.retryAfterSeconds) } },
  );
}

export async function guardRateLimit(
  input: Parameters<typeof enforceRateLimit>[0],
): Promise<Response | null> {
  try {
    await enforceRateLimit(input);
    return null;
  } catch (error) {
    if (error instanceof RateLimitExceededError) return rateLimitResponse(error);
    console.error("Rate-limit enforcement failed", error);
    return Response.json({ error: "Request protection is temporarily unavailable." }, { status: 503 });
  }
}
