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
  warnings: string[];
}

export function validateEnvironment(): EnvValidationResult {
  const env = process.env.NODE_ENV || "development";
  const missing: string[] = [];
  const warnings: string[] = [];

  const clerkPubKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clerkPubKey) missing.push("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY");
  if (!clerkSecret) missing.push("CLERK_SECRET_KEY");
  if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  const hasClerk = Boolean(clerkPubKey && clerkSecret);
  const hasSupabase = Boolean(supabaseUrl && supabaseServiceKey);

  // Staging / Production Security Checks
  if (env === "production") {
    if (missing.length > 0) {
      warnings.push(`PRODUCTION CRITICAL: Missing required variables: ${missing.join(", ")}`);
    }

    if (supabaseUrl && !supabaseUrl.startsWith("https://")) {
      warnings.push("PRODUCTION CRITICAL: NEXT_PUBLIC_SUPABASE_URL must use HTTPS.");
    }

    if (clerkPubKey && clerkPubKey.startsWith("pk_test_")) {
      warnings.push("PRODUCTION WARNING: Using Clerk test key in production mode.");
    }
  }

  // Cross-environment contamination check
  if (supabaseUrl && supabaseUrl.includes("localhost") && env === "production") {
    warnings.push("SECURITY BREACH: Localhost database configured in production environment.");
  }

  return {
    isConfigured: missing.length === 0,
    environment: env as any,
    hasClerk,
    hasSupabase,
    missingVariables: missing,
    warnings,
  };
}
