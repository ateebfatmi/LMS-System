#!/usr/bin/env bash
# Rehearse the current schema in a fresh, socket-only local cluster.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
qa_dir=$(mktemp -d /tmp/prepzii-role-db.XXXXXX)
pg_port=55476
# Ignore libpq service and host-address settings. Every connection is through
# the Unix socket of the cluster created below.
unset PGHOSTADDR PGSERVICE PGSERVICEFILE PGUSER PGOPTIONS
initdb -A trust -D "$qa_dir/data" > "$qa_dir/init.log"
pg_ctl -D "$qa_dir/data" -l "$qa_dir/server.log" -o "-k $qa_dir -p $pg_port -c listen_addresses=''" -w start
trap 'pg_ctl -D "$qa_dir/data" -m fast -w stop >/dev/null' EXIT
pg() { psql -X -h "$qa_dir" -p "$pg_port" -d postgres -v ON_ERROR_STOP=1 "$@"; }
pg -f scripts/test_db_setup.sql > "$qa_dir/migrations.log" 2>&1
for migration in supabase/migrations/*.sql; do
  case "$migration" in *0024_membership_transition_guards.sql|*0025_workspace_resource_policies.sql|*0026_institute_dashboard_branding.sql|*0027_faculty_onboarding.sql) continue ;; esac
  echo "Applying $migration"
  if ! pg -f "$migration" >> "$qa_dir/migrations.log" 2>&1; then tail -30 "$qa_dir/migrations.log"; exit 1; fi
done
pg -c 'CREATE DATABASE role_rehearsal TEMPLATE postgres' >> "$qa_dir/migrations.log" 2>&1
pg -d role_rehearsal -f supabase/tests/role_migration_rehearsal.sql > "$qa_dir/rehearsal.log" 2>&1 || { tail -30 "$qa_dir/rehearsal.log"; exit 1; }
pg -f supabase/migrations/0024_membership_transition_guards.sql   -f supabase/migrations/0025_workspace_resource_policies.sql \
   -f supabase/migrations/0026_institute_dashboard_branding.sql -f supabase/migrations/0027_faculty_onboarding.sql >> "$qa_dir/migrations.log" 2>&1 || { tail -30 "$qa_dir/migrations.log"; exit 1; }
pg -f supabase/tests/tenant_isolation.sql > "$qa_dir/isolation.log" 2>&1 || { tail -25 "$qa_dir/isolation.log"; exit 1; }
pg -f supabase/tests/role_membership.sql > "$qa_dir/roles.log" 2>&1 || { tail -25 "$qa_dir/roles.log"; exit 1; }
pg -f supabase/tests/institute_branding.sql > "$qa_dir/branding.log" 2>&1 || { tail -25 "$qa_dir/branding.log"; exit 1; }
pg -f supabase/tests/faculty_onboarding.sql > "$qa_dir/faculty.log" 2>&1 || { tail -30 "$qa_dir/faculty.log"; exit 1; }
echo "Migration rehearsal, tenant isolation, role membership, institute branding, and faculty onboarding passed. Logs: $qa_dir"
