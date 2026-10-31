#!/usr/bin/env bash
set -euo pipefail

# =====================================================================
# PrepZii LMS — Remote Database Migration Runner
# Applies the consolidated production migrations bundle to the remote
# PostgreSQL database specified by DATABASE_URL.
# =====================================================================

BUNDLE_FILE="supabase/production_migration_bundle.sql"

if [ ! -f "${BUNDLE_FILE}" ]; then
  echo "❌ Error: Migration bundle '${BUNDLE_FILE}' not found." >&2
  exit 1
fi

if [ -z "${DATABASE_URL:-}" ]; then
  # Check if DATABASE_URL is defined in .env.local
  if [ -f ".env.local" ]; then
    ENV_DB_URL=$(grep -E "^DATABASE_URL=" .env.local 2>/dev/null | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
    if [ -n "${ENV_DB_URL}" ]; then
      DATABASE_URL="${ENV_DB_URL}"
    fi
  fi
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "====================================================================="
  echo "⚠️  DATABASE_URL environment variable is not set."
  echo "====================================================================="
  echo "To apply migrations to your remote Supabase instance, either:"
  echo ""
  echo "1. Run with DATABASE_URL:"
  echo "   DATABASE_URL=\"postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres\" npm run db:deploy"
  echo ""
  echo "2. Or copy the contents of:"
  echo "   '${BUNDLE_FILE}'"
  echo "   and paste it directly into your Supabase Dashboard -> SQL Editor -> Run."
  echo "====================================================================="
  exit 1
fi

echo "==> Target Database: $(echo "${DATABASE_URL}" | sed -E 's/:([^@]+)@/:***@/')"
echo "==> Applying consolidated migrations from ${BUNDLE_FILE}..."

if command -v psql >/dev/null 2>&1; then
  psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 -f "${BUNDLE_FILE}"
elif command -v docker >/dev/null 2>&1 && docker ps --filter "name=prepzii-staging-test" --format '{{.Names}}' | grep -q "prepzii-staging-test"; then
  docker exec -i prepzii-staging-test psql "${DATABASE_URL}" -v ON_ERROR_STOP=1 < "${BUNDLE_FILE}"
else
  echo "❌ Error: 'psql' client is not installed on PATH and no active PostgreSQL container was found." >&2
  echo "   Please paste '${BUNDLE_FILE}' directly into your Supabase SQL Editor." >&2
  exit 1
fi

echo "==> Migrations applied successfully! Verifying schema via preflight..."
npm run preflight
