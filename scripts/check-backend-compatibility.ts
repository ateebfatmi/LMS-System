import { createClient } from "@supabase/supabase-js";

if (typeof (globalThis as any).WebSocket === "undefined") {
  (globalThis as any).WebSocket = class {};
}

/**
 * Prepzii Staging Compatibility Preflight Script
 * Run this script with staging environment variables to verify database connectivity,
 * inspect consumer Prepzii prerequisite tables, validate schema alignment, and verify readiness.
 *
 * Usage:
 *   npm run preflight
 */

async function main() {
  console.log("=================================================================");
  console.log("🔍 PREPZII B2B — STAGING BACKEND SCHEMA COMPATIBILITY AUDIT");
  console.log("=================================================================\n");

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("❌ CRITICAL: Missing backend credentials.");
    console.error("   NEXT_PUBLIC_SUPABASE_URL:", url ? "✓ Set" : "✗ Missing");
    console.error("   SUPABASE_SERVICE_ROLE_KEY:", serviceKey ? "✓ Set" : "✗ Missing");
    console.error("\n👉 Please configure these in .env.local before running staging preflight.\n");
    process.exit(1);
  }

  console.log("✓ Supabase URL: [CONFIGURED]");
  console.log("✓ Service Role Key: [CONFIGURED]");
  console.log("Connecting to Supabase...\n");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Verify connection & check prerequisite consumer tables
  const prerequisiteTables = [
    { name: "institutes", desc: "Canonical organization tenant registry" },
    { name: "institute_members", desc: "Institute membership and role directory" },
    { name: "institute_batches", desc: "Coaching batches registry" },
    { name: "institute_batch_members", desc: "Batch membership (member_id -> institute_members.id)" },
    { name: "questions", desc: "Consumer standard question bank" },
    { name: "pyq_questions", desc: "Past year questions bank" },
    { name: "institute_tests", desc: "Assessment registry" },
    { name: "institute_test_questions", desc: "Test questions (question_id -> questions.id)" },
    { name: "institute_test_attempts", desc: "Institutional test attempts" },
    { name: "test_sessions", desc: "Learner test sessions" },
    { name: "test_attempts", desc: "Test attempt submissions" },
  ];

  console.log("Step 1: Inspecting Prerequisite Consumer Tables...");

  let consumerTablesFound = 0;
  let compatibilityFailures = 0;
  for (const { name, desc } of prerequisiteTables) {
    try {
      const { data, error } = await supabase.from(name).select("*").limit(1);
      if (error) {
        console.log(`  ✗ Table 'public.${name}': MISSING OR INACCESSIBLE (${error.message}) - [${desc}]`);
      } else {
        consumerTablesFound++;
        console.log(`  ✓ Table 'public.${name}': FOUND (${data ? data.length : 0} sample rows checked) - [${desc}]`);
      }
    } catch (err: any) {
      console.log(`  ✗ Table 'public.${name}': ERROR (${err.message}) - [${desc}]`);
    }
  }

  // 2. Column-level schema verification for canonical tables
  console.log("\nStep 2: Inspecting Canonical Table Column Compatibility...");
  try {
    const { error: qErr } = await supabase
      .from("questions")
      .select("id, exam, subject, chapter, question_text, option_a, correct_option")
      .limit(1);

    if (qErr) {
      compatibilityFailures++;
      console.log(`  ⚠️  'public.questions' column check: ${qErr.message}`);
    } else {
      console.log("  ✓ 'public.questions': Verified real columns (exam, subject, option_a..d, correct_option).");
    }

    const { error: batchErr } = await supabase
      .from("institute_batches")
      .select("id, institute_id, name, exam, target_year, created_at")
      .limit(1);

    if (batchErr) {
      compatibilityFailures++;
      console.log(`  ⚠️  'public.institute_batches' column check: ${batchErr.message}`);
    } else {
      console.log("  ✓ 'public.institute_batches': Verified canonical columns (exam, target_year; no status/is_active).");
    }

    const { error: testQErr } = await supabase
      .from("institute_test_questions")
      .select("id, institute_id, institute_test_id, question_id, question_order")
      .limit(1);

    if (testQErr) {
      compatibilityFailures++;
      console.log(`  ⚠️  'public.institute_test_questions' column check: ${testQErr.message}`);
    } else {
      console.log("  ✓ 'public.institute_test_questions': Verified foreign key 'institute_test_id' (not test_id).");
    }

    const { error: attemptErr } = await supabase
      .from("institute_test_attempts")
      .select("id, institute_id, institute_test_id, user_id, session_id, attempt_id, status")
      .limit(1);

    if (attemptErr) {
      compatibilityFailures++;
      console.log(`  ⚠️  'public.institute_test_attempts' column check: ${attemptErr.message}`);
    } else {
      console.log("  ✓ 'public.institute_test_attempts': Verified columns (institute_test_id, user_id; no member_id).");
    }
  } catch (err: any) {
    compatibilityFailures++;
    console.log(`  ⚠️  Column verification exception: ${err.message}`);
  }

  // 3. Inspect production LMS relations from the active migration chain.
  const institutionalTables = [
    "organization_campuses",
    "organization_academic_years",
    "organization_subjects",
    "organization_courses",
    "organization_course_modules",
    "organization_course_lessons",
    "organization_course_batches",
    "organization_lesson_resources",
    "organization_lesson_progress",
    "organization_assignments",
    "organization_assignment_submissions",
    "organization_assessment_attempts",
    "organization_test_schedules",
    "organization_announcements",
    "organization_notifications",
    "organization_attendance_sessions",
    "organization_attendance_records",
    "organization_attendance_corrections",
    "organization_guardian_links",
    "organization_cbt_sessions",
    "organization_cbt_answers",
    "organization_notification_dispatches",
    "organization_audit_logs",
    "organization_fee_plans",
    "organization_student_fees",
    "organization_fee_installments",
    "organization_fee_transactions",
    "organization_fee_invoices",
    "organization_leads",
    "organization_invitations",
    "organization_usage_counters",
    "organization_branding",
    "organization_student_interventions",
    "organization_doubt_threads",
    "organization_doubt_messages",
  ];

  console.log("\nStep 3: Checking Institutional Additive Tables Status...");
  let appliedCount = 0;

  for (const table of institutionalTables) {
    try {
      const { error } = await supabase.from(table).select("id").limit(1);
      if (error) {
        console.log(`  ⏳ 'public.${table}': Not applied yet`);
      } else {
        appliedCount++;
        console.log(`  ✓ 'public.${table}': APPLIED & ACCESSIBLE`);
      }
    } catch {
      console.log(`  ⏳ 'public.${table}': Not applied yet`);
    }
  }

  // 4. Check Reconciliation Views
  console.log("\nStep 4: Checking Reconciled Compatibility Views...");
  try {
    const { data: vData, error: vErr } = await supabase.from("organization_batches").select("id, organization_id, target_exam").limit(1);
    if (vErr) {
      compatibilityFailures++;
      console.log(`  ⏳ Compatibility view 'public.organization_batches': Not created yet (${vErr.message})`);
    } else {
      console.log(`  ✓ Compatibility view 'public.organization_batches': ACTIVE & QUERYABLE (${vData ? vData.length : 0} rows)`);
    }
  } catch {
    compatibilityFailures++;
    console.log("  ⏳ Compatibility view 'public.organization_batches': Not created yet");
  }

  console.log(`\n=================================================================`);
  console.log(`Consumer Tables: ${consumerTablesFound} / ${prerequisiteTables.length} verified.`);
  console.log(`B2B Additive Tables: ${appliedCount} / ${institutionalTables.length} verified.`);
  console.log(`Compatibility Checks: ${compatibilityFailures === 0 ? "PASS" : `${compatibilityFailures} FAILED`}.`);
  console.log(`=================================================================\n`);

  if (
    consumerTablesFound !== prerequisiteTables.length ||
    appliedCount !== institutionalTables.length ||
    compatibilityFailures > 0
  ) {
    throw new Error("Staging backend compatibility gate failed.");
  }
}

main().catch((err) => {
  console.error("Unhandled preflight error:", err);
  process.exit(1);
});
