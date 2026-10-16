#!/usr/bin/env bash
set -euo pipefail

# PrepZii LMS: Automated Database Migration & Tenant Isolation Test Runner
# Connects to PostgreSQL via DATABASE_URL or defaults to test container.

export PATH="/Users/ateebfatmi/.docker/bin:/usr/local/bin:/usr/bin:/bin:${PATH:-}"
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5439/postgres}"

echo "==> Running database migration & tenant isolation tests..."
echo "==> Target Database URL: ${DB_URL}"

run_psql_file() {
  local sql_file="$1"
  if command -v psql >/dev/null 2>&1; then
    psql "${DB_URL}" -v ON_ERROR_STOP=1 -f "${sql_file}"
  elif command -v docker >/dev/null 2>&1; then
    docker exec -i prepzii-staging-test psql -U postgres -v ON_ERROR_STOP=1 < "${sql_file}"
  else
    echo "Error: neither 'psql' nor 'docker' found." >&2
    exit 1
  fi
}

run_psql_cmd() {
  local sql_cmd="$1"
  if command -v psql >/dev/null 2>&1; then
    psql "${DB_URL}" -v ON_ERROR_STOP=1 -c "${sql_cmd}"
  elif command -v docker >/dev/null 2>&1; then
    docker exec -i prepzii-staging-test psql -U postgres -v ON_ERROR_STOP=1 -c "${sql_cmd}"
  else
    echo "Error: neither 'psql' nor 'docker' found." >&2
    exit 1
  fi
}

echo "==> 0. Resetting public schema to ensure clean test environment..."
run_psql_cmd "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"

echo "==> 1. Setting up base PrepZii schema and prerequisites..."
run_psql_file scripts/test_db_setup.sql

echo "==> 2. Applying migrations in order..."
for f in $(ls supabase/migrations/*.sql | sort); do
  echo "    Applying $f..."
  run_psql_file "$f"
done

echo "==> 3. Ensuring schema privileges for authenticated, anon, and service_role..."
run_psql_cmd "GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role; GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;"

echo "==> 4. Executing tenant isolation test suite (supabase/tests/tenant_isolation.sql)..."
run_psql_file supabase/tests/tenant_isolation.sql

echo "==> ALL DATABASE MIGRATIONS AND TENANT ISOLATION TESTS PASSED CLEANLY!"
