#!/usr/bin/env bash
set -euo pipefail

SOURCE_URL="${DATABASE_URL:-}"
RECOVERY_URL="${RECOVERY_DATABASE_URL:-}"
RECOVERY_NAME="${RECOVERY_DATABASE_NAME:-}"

if [[ -z "$SOURCE_URL" || -z "$RECOVERY_URL" || -z "$RECOVERY_NAME" ]]; then
  echo "DATABASE_URL, RECOVERY_DATABASE_URL, and RECOVERY_DATABASE_NAME are required." >&2
  exit 1
fi
if [[ "$SOURCE_URL" == "$RECOVERY_URL" ]]; then
  echo "Recovery database must not be the source database." >&2
  exit 1
fi
if [[ ! "$RECOVERY_NAME" =~ ^[a-zA-Z0-9_]*(recovery|restore|test)[a-zA-Z0-9_]*$ ]]; then
  echo "RECOVERY_DATABASE_NAME must explicitly contain recovery, restore, or test." >&2
  exit 1
fi
for tool in pg_dump pg_restore psql dropdb createdb; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "PostgreSQL client tool '$tool' is required for the recovery drill." >&2
    exit 127
  fi
done

ARCHIVE="$(mktemp "${TMPDIR:-/tmp}/prepzii-backup-XXXXXX")"
cleanup() {
  rm -f "$ARCHIVE"
  dropdb --if-exists --force --maintenance-db="$SOURCE_URL" "$RECOVERY_NAME" >/dev/null 2>&1 || true
}
trap cleanup EXIT

SOURCE_TABLES="$(psql "$SOURCE_URL" -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p');")"
SOURCE_RLS_TABLES="$(psql "$SOURCE_URL" -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_class where relnamespace = 'public'::regnamespace and relrowsecurity;")"
if [[ "$SOURCE_TABLES" -lt 1 || "$SOURCE_RLS_TABLES" -lt 1 ]]; then
  echo "Source schema is missing application tables or row-level security." >&2
  exit 1
fi

echo "Creating logical backup from the isolated source..."
pg_dump --format=custom --no-owner --no-acl --dbname="$SOURCE_URL" --file="$ARCHIVE"

dropdb --if-exists --force --maintenance-db="$SOURCE_URL" "$RECOVERY_NAME"
createdb --maintenance-db="$SOURCE_URL" "$RECOVERY_NAME"

echo "Restoring backup into disposable recovery database..."
pg_restore --exit-on-error --no-owner --no-acl --dbname="$RECOVERY_URL" "$ARCHIVE"

psql "$RECOVERY_URL" -v ON_ERROR_STOP=1 -c "select count(*) as institute_count from public.institutes;" >/dev/null
RESTORED_TABLES="$(psql "$RECOVERY_URL" -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_class where relnamespace = 'public'::regnamespace and relkind in ('r','p');")"
RESTORED_RLS_TABLES="$(psql "$RECOVERY_URL" -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_class where relnamespace = 'public'::regnamespace and relrowsecurity;")"

if [[ "$RESTORED_TABLES" != "$SOURCE_TABLES" || "$RESTORED_RLS_TABLES" != "$SOURCE_RLS_TABLES" ]]; then
  echo "Restored schema verification failed: source tables/RLS=$SOURCE_TABLES/$SOURCE_RLS_TABLES, restored=$RESTORED_TABLES/$RESTORED_RLS_TABLES." >&2
  exit 1
fi

echo "Backup restore verification passed ($RESTORED_TABLES tables; $RESTORED_RLS_TABLES protected by RLS)."
