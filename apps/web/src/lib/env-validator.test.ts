import assert from "node:assert/strict";
import test from "node:test";
import { validateEnvironment } from "./env-validator.ts";

const production = {
  NODE_ENV: "production",
  DEPLOYMENT_ENV: "production",
  NEXT_PUBLIC_APP_URL: "https://institutes.prepzii.com",
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_live_example",
  CLERK_SECRET_KEY: "sk_live_example",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-example",
  INVITATION_TOKEN_SECRET: "a".repeat(32),
} satisfies NodeJS.ProcessEnv;

test("accepts a complete production configuration", () => {
  const result = validateEnvironment(production);
  assert.equal(result.isConfigured, true);
  assert.deepEqual(result.errors, []);
});

test("rejects development authentication and test identity keys in production", () => {
  const result = validateEnvironment({
    ...production,
    ALLOW_INSECURE_DEV_AUTH: "true",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_example",
  });
  assert.equal(result.isConfigured, false);
  assert.match(result.errors.join(" "), /ALLOW_INSECURE_DEV_AUTH/);
  assert.match(result.errors.join(" "), /Clerk test/);
});

test("rejects insecure and partial provider configuration", () => {
  const result = validateEnvironment({
    ...production,
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    INVITATION_TOKEN_SECRET: "short",
    RAZORPAY_KEY_ID: "rzp_live_example",
  });
  assert.equal(result.isConfigured, false);
  assert.match(result.errors.join(" "), /HTTPS/);
  assert.match(result.errors.join(" "), /local Supabase/);
  assert.match(result.errors.join(" "), /32 characters/);
  assert.match(result.errors.join(" "), /partial/);
});

test("allows an intentionally unconfigured local development environment", () => {
  const result = validateEnvironment({ NODE_ENV: "development" });
  assert.equal(result.environment, "development");
  assert.equal(result.errors.length, 0);
  assert.equal(result.isConfigured, false);
});
