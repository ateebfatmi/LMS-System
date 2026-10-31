#!/usr/bin/env node
import { validateEnvironment } from "../apps/web/src/lib/env-validator.ts";

console.log("=================================================================");
console.log("🔒 PREPZII B2B LMS — ENVIRONMENT & SECURITY AUDIT");
console.log("=================================================================\n");

const envResult = validateEnvironment(process.env);

console.log(`Environment Mode:      ${envResult.environment.toUpperCase()}`);
console.log(`Clerk Authentication:  ${envResult.hasClerk ? "✓ Configured" : "✗ Missing"}`);
console.log(`Supabase Database:     ${envResult.hasSupabase ? "✓ Configured" : "✗ Missing"}`);
console.log(`Overall Config State:  ${envResult.isConfigured ? "✓ PASSED (Ready)" : "✗ FAILED"}\n`);

if (envResult.missingVariables.length > 0) {
  console.log("Missing Variables:");
  for (const m of envResult.missingVariables) {
    console.log(`  - ✗ ${m}`);
  }
  console.log("");
}

if (envResult.errors.length > 0) {
  console.log("Configuration Errors:");
  for (const e of envResult.errors) {
    console.log(`  - ❌ ${e}`);
  }
  console.log("");
}

if (envResult.warnings.length > 0) {
  console.log("Warnings:");
  for (const w of envResult.warnings) {
    console.log(`  - ⚠️  ${w}`);
  }
  console.log("");
}

console.log("=================================================================");
if (!envResult.isConfigured) {
  console.error("❌ Environment validation failed. Resolve the errors above before launching.");
  process.exit(1);
} else {
  console.log("✅ All required environment variables and security constraints verified!");
  process.exit(0);
}
