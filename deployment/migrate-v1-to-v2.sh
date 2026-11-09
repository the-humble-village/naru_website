#!/usr/bin/env bash
set -euo pipefail

OLD_URL="${1:?usage: migrate-v1-to-v2.sh <v1-database-url> <v2-database-url>}"
NEW_URL="${2:?usage: migrate-v1-to-v2.sh <v1-database-url> <v2-database-url>}"
OLD_URL="${OLD_URL%%\?*}"
NEW_URL="${NEW_URL%%\?*}"

TABLES=(
  users
  sites
  communities
  resources
  training
  files
  birthing_assistants
  birthing_assistant_communities
  birthing_assistant_trainings
)
SERIAL_TABLES=(users sites communities resources training files birthing_assistants)

if [ "$OLD_URL" = "$NEW_URL" ]; then
  echo "❌ Source and target are the same database." >&2
  exit 1
fi

if ! psql "$NEW_URL" -tAc "SELECT 1 FROM _prisma_migrations WHERE migration_name = '20260920222141_init_v2' AND finished_at IS NOT NULL" | grep -q 1; then
  echo "❌ Target has no V2 schema. Run 'npx prisma migrate deploy' against it first." >&2
  exit 1
fi

for t in "${TABLES[@]}"; do
  n=$(psql "$NEW_URL" -tAc "SELECT count(*) FROM public.$t")
  if [ "$n" != "0" ]; then
    echo "❌ Target table $t already has $n rows. Refusing to copy." >&2
    exit 1
  fi
done

DUMP=$(mktemp)
trap 'rm -f "$DUMP"' EXIT

echo "📤 Dumping ${#TABLES[@]} tables from V1..."
pg_dump "$OLD_URL" --data-only --column-inserts --no-owner --no-privileges \
  $(printf -- '--table=public.%s ' "${TABLES[@]}") > "$DUMP"

{
  for t in "${SERIAL_TABLES[@]}"; do
    echo "SELECT setval(pg_get_serial_sequence('public.$t', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.$t;"
  done
} >> "$DUMP"

echo "📥 Loading into V2 in a single transaction..."
psql "$NEW_URL" -v ON_ERROR_STOP=1 --single-transaction -q -f "$DUMP" > /dev/null

echo "🔍 Row counts (V1 → V2):"
for t in "${TABLES[@]}"; do
  a=$(psql "$OLD_URL" -tAc "SELECT count(*) FROM public.$t")
  b=$(psql "$NEW_URL" -tAc "SELECT count(*) FROM public.$t")
  flag="✅"
  [ "$a" = "$b" ] || flag="❌"
  printf '  %s %-32s %6s → %s\n' "$flag" "$t" "$a" "$b"
done
