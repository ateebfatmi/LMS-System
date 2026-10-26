/**
 * Strict Environment and Staging Configuration Validator
 * Ensures that staging and production environments do not mix credentials
 * and fail loudly upon configuration errors.
 */

export interface EnvValidationResult {
  isConfigured: boolean;
  environment: "production" | "staging" | "development" | "test";
  hasClerk: boolean;
  hasSupabase: boolean;
  missingVariables: string[];
  errors: string[];
  warnings: string[];
}

export function validateEnvironment(source: NodeJS.ProcessEnv = process.env): EnvValidationResult {
  const rawEnvironment: string | undefined = source.DEPLOYMENT_ENV ?? source.NODE_ENV;
  const env: EnvValidationResult["environment"] =
    rawEnvironment === "production" || rawEnvironment === "test" || rawEnvironment === "staging"
      ? rawEnvironment
      : "development";
  const missing: string[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];

  const appUrl = source.NEXT_PUBLIC_APP_URL;
  const clerkPubKey = source.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkSecret = source.CLERK_SECRET_KEY;
  const supabaseUrl = source.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = source.SUPABASE_SERVICE_ROLE_KEY;
  const invitationSecret = source.INVITATION_TOKEN_SECRET;

  if (!appUrl) missing.push("NEXT_PUBLIC_APP_URL");
  if (!clerkPubKey) missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  if (!clerkSecret) missing.push("CLERK_SECRET_KEY");
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!invitationSecret) missing.push("INVITATION_TOKEN_SECRET");

  const hasClerk = Boolean(clerkPubKey && clerkSecret);
  const hasSupabase = Boolean(supabaseUrl && supabaseServiceKey);

  // Staging / production must fail closed. Local development may intentionally
  // omit both providers to use the isolated demo tenant.
  if (env === "production" || env === "staging") {
    if (missing.length > 0) {
      errors.push(`Missing required variables: ${missing.join(", ")}`);
    }

    if (!appUrl?.startsWith("https://")) errors.push("NEXT_PUBLIC_APP_URL must use HTTPS.");
    if (supabaseUrl && !supabaseUrl.startsWith("https://")) {
      errors.push("NEXT_PUBLIC_SUPABASE_URL must use HTTPS.");
    }
    if (source.ALLOW_INSECURE_DEV_AUTH === "true") errors.push("ALLOW_INSECURE_DEV_AUTH must be false outside local development.");
    if (invitationSecret && invitationSecret.length < 32) errors.push("INVITATION_TOKEN_SECRET must contain at least 32 characters.");
  }

  if (env === "production" && clerkPubKey?.startsWith("pk_test_")) errors.push("Production cannot use a Clerk test publishable key.");
  if (env === "staging" && clerkPubKey?.startsWith("pk_live_")) warnings.push("Staging is using a live Clerk publishable key.");

  // Cross-environment contamination check
  if (supabaseUrl && /localhost|127\.0\.0\.1/.test(supabaseUrl) && (env === "production" || env === "staging")) {
    errors.push("A local Supabase URL cannot be used outside local development.");
  }

  const paymentVariables = [source.RAZORPAY_KEY_ID, source.RAZORPAY_KEY_SECRET, source.RAZORPAY_WEBHOOK_SECRET];
  const configuredPaymentVariables = paymentVariables.filter(Boolean).length;
  if (configuredPaymentVariables > 0 && configuredPaymentVariables < paymentVariables.length) {
    errors.push("Razorpay configuration is partial; key ID, key secret, and webhook secret must be configured together.");
  }
  if (configuredPaymentVariables === paymentVariables.length) {
    if (!source.FASTAPI_INTERNAL_URL) errors.push("FASTAPI_INTERNAL_URL is required when Razorpay is enabled.");
    if (!source.INTERNAL_API_KEY || source.INTERNAL_API_KEY.length < 32) errors.push("INTERNAL_API_KEY must contain at least 32 characters when Razorpay is enabled.");
  }

  return {
    isConfigured: missing.length === 0 && errors.length === 0,
    environment: env,
    hasClerk,
    hasSupabase,
    missingVariables: missing,
    errors,
    warnings,
  };
}
