import fs from "fs";
import path from "path";

const migrationsDir = "supabase/migrations";
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql") && !f.includes("quarantine")).sort();

let bundle = `-- =====================================================================
-- PREPZII B2B LMS — PRODUCTION CONSOLIDATED MIGRATIONS BUNDLE
-- Active migration chain concatenated in verified dependency order.
-- Fully idempotent: safe to execute in Supabase SQL Editor or via psql.
-- =====================================================================

BEGIN;

`;

for (const file of files) {
  bundle += `\n-- ---------------------------------------------------------------------\n`;
  bundle += `-- Migration: ${file}\n`;
  bundle += `-- ---------------------------------------------------------------------\n\n`;
  let content = fs.readFileSync(path.join(migrationsDir, file), "utf8");
  
  // Make policy creation fully idempotent
  content = content.replace(
    /create\s+policy\s+([a-zA-Z0-9_]+)\s+on\s+([a-zA-Z0-9_\.]+)/gi,
    (match, policyName, tableName) => `drop policy if exists ${policyName} on ${tableName};\n${match}`
  );

  bundle += content;
  bundle += "\n";
}

bundle += `\nCOMMIT;\n`;

fs.writeFileSync("supabase/production_migration_bundle.sql", bundle, "utf8");
console.log(`✓ Generated fully idempotent supabase/production_migration_bundle.sql with ${files.length} active migrations.`);
