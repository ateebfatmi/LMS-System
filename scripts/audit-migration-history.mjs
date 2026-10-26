import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

const migrationDirectory = resolve("supabase/migrations");
const legacyDirectory = resolve("supabase/legacy_migrations");
const expectedLegacyFiles = new Map([
  ["0004_business_operations.sql", "7750250105f33d0e6a8b772fecb9c3ca015166aacb83e15631817919cb8d27c6"],
  ["0005_reconcile_canonical_schema.sql", "35380df679370837eea9493260ab7af9f4f41675b7436bcd85e79f8038ce155d"],
]);

const files = (await readdir(migrationDirectory)).filter((file) => /^\d+_.+\.sql$/.test(file)).sort();
const filesByVersion = new Map();

for (const file of files) {
  const version = file.slice(0, file.indexOf("_"));
  const versionFiles = filesByVersion.get(version) ?? [];
  versionFiles.push(file);
  filesByVersion.set(version, versionFiles);
}

const duplicateGroups = [...filesByVersion.entries()].filter(([, versionFiles]) => versionFiles.length > 1);
if (duplicateGroups.length > 0) {
  throw new Error(
    `Duplicate active migration versions: ${duplicateGroups
      .map(([version, versionFiles]) => `${version} (${versionFiles.join(", ")})`)
      .join("; ")}`,
  );
}

const legacyFiles = await readdir(legacyDirectory);
for (const [file, expectedHash] of expectedLegacyFiles) {
  if (!legacyFiles.includes(file)) {
    throw new Error(`Preserved historical migration is missing: ${file}.`);
  }
  const contents = await readFile(resolve(legacyDirectory, file));
  const actualHash = createHash("sha256").update(contents).digest("hex");
  if (actualHash !== expectedHash) {
    throw new Error(`Historical migration ${file} changed. Expected ${expectedHash}, received ${actualHash}.`);
  }
}

console.log(`Migration history audited: ${files.length} active files with unique versions.`);
console.log(`${expectedLegacyFiles.size} incompatible historical migrations are preserved outside the active chain.`);
