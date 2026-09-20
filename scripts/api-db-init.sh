#!/usr/bin/env bash
# api-db-init.sh — build the API's own D1 database from scratch.
#
#   scripts/api-db-init.sh                 # learn_eng_pwa_db (the GitHub Pages app's API)
#   scripts/api-db-init.sh --db other_db   # any other EMPTY database
#
# Applies db/schema.sql and the migrations in the exact order
# tests/pages-harness.js replays them (SQL_FILES) — the order every API test
# in the suite runs against — then seeds config.auth_secret with 32 random
# bytes, which is the one row the schema does not create and without which
# /api/login cannot sign a token. Idempotent where the SQL is (CREATE IF NOT
# EXISTS); the secret is only written if absent, so re-running never
# invalidates every child's token.
#
# NEVER pointed at eng_pwa_db: that is the Cloudflare app's live database
# (see the guard below).
set -euo pipefail
cd "$(dirname "$0")/.."
DB="learn_eng_pwa_db"
while [ $# -gt 0 ]; do
  case "$1" in
    --db) DB="$2"; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done
if [ "$DB" = "eng_pwa_db" ]; then
  echo "✗ refusing to touch eng_pwa_db — that is the Cloudflare app's database" >&2
  exit 1
fi
TOKEN_FILE="$HOME/.config/eng-pwa/cloudflare.env"
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$TOKEN_FILE" ]; then set -a; . "$TOKEN_FILE"; set +a; fi
: "${CLOUDFLARE_ACCOUNT_ID:=f8b5c3e4cb22d163733b7ce29ecab97c}"
export CLOUDFLARE_ACCOUNT_ID

FILES=$(node -e "console.log(require('./tests/pages-harness.js').SQL_FILES.join('\n'))")
for f in $FILES; do
  echo "▸ $f"
  npx --yes wrangler@3 d1 execute "$DB" --remote --file "$f" 2>&1 | grep -E "executed|✅|error|Error" | tail -1
done

have=$(npx --yes wrangler@3 d1 execute "$DB" --remote --json --command "SELECT COUNT(*) AS n FROM config WHERE key='auth_secret'" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const j=JSON.parse(s);console.log(j[0].results[0].n)})")
if [ "$have" = "0" ]; then
  secret=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  npx --yes wrangler@3 d1 execute "$DB" --remote --command "INSERT INTO config (key, value) VALUES ('auth_secret', '$secret')" >/dev/null
  echo "▸ config.auth_secret seeded"
else
  echo "▸ config.auth_secret already present — kept"
fi
echo "✓ $DB ready"
