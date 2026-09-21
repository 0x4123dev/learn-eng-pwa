#!/usr/bin/env bash
# deploy-api.sh — ship the API for the GitHub Pages app to ITS OWN Cloudflare
# Pages project, `learn-eng-pwa-api` (functions/, on the learn_eng_pwa_db
# database).
#
#   scripts/deploy-api.sh
#
# NEVER the `eng-pwa` app or eng_pwa_db (those belong to the eng-math-app
# repo): the project name is fixed below and guarded, and nothing here reads
# the repo-root wrangler.toml. Run after any change to functions/ that the
# GitHub Pages app should see; the static app itself ships with
# scripts/deploy-pages.sh.
#
# (The learn-eng-pwa-battle Worker used to deploy from here too. It went with
# the 2026-09 cut — battle-worker/ is gone and api-project/wrangler.toml no
# longer binds it.)
#
# First-time database: scripts/api-db-init.sh (schema + migrations + auth
# secret). New migrations: apply them to learn_eng_pwa_db by hand, the way
# db/*.sql headers say, BEFORE running this — with --db learn_eng_pwa_db.
set -euo pipefail
cd "$(dirname "$0")/.."
PROJECT="learn-eng-pwa-api"
LIVE="https://learn-eng-pwa-api.pages.dev"
STAGE=".api-dist"
[ $# -eq 0 ] || { echo "unknown option: $1" >&2; exit 2; }
case "$PROJECT" in eng-pwa|eng-pwa-audio) echo "✗ refusing: $PROJECT is the Cloudflare app" >&2; exit 1 ;; esac
grep -q 'name = "learn-eng-pwa-api"' api-project/wrangler.toml || { echo "✗ api-project/wrangler.toml does not name learn-eng-pwa-api" >&2; exit 1; }
grep -q 'database_name = "learn_eng_pwa_db"' api-project/wrangler.toml || { echo "✗ api-project/wrangler.toml must bind learn_eng_pwa_db" >&2; exit 1; }
! grep -q '^\[\[services\]\]' api-project/wrangler.toml || { echo "✗ api-project/wrangler.toml still binds a Worker service — the battle Worker is gone" >&2; exit 1; }

TOKEN_FILE="$HOME/.config/eng-pwa/cloudflare.env"
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$TOKEN_FILE" ]; then set -a; . "$TOKEN_FILE"; set +a; fi
[ -n "${CLOUDFLARE_API_TOKEN:-}" ] || { echo "✗ No CLOUDFLARE_API_TOKEN — see scripts/deploy.sh" >&2; exit 1; }
: "${CLOUDFLARE_ACCOUNT_ID:=f8b5c3e4cb22d163733b7ce29ecab97c}"
export CLOUDFLARE_ACCOUNT_ID

VER=$(node -p "require('./package.json').version")

# ---- stage: config + functions + a one-page site --------------------------
# wrangler reads wrangler.toml and ./functions from the directory it runs in,
# so the project is assembled in a scratch dir the repo-root config never
# reaches.
rm -rf "$STAGE"; mkdir -p "$STAGE/dist"
cp api-project/wrangler.toml "$STAGE/wrangler.toml"
cp api-project/dist-index.html "$STAGE/dist/index.html"
cp -R functions "$STAGE/functions"
# The Functions import the shared rule modules (../../js/night-raid-rules.js,
# daily-task-catalog.js, …) and wrangler bundles them from disk, so js/ is
# staged beside functions/ — beside, not under dist/, so none of it is
# served as a static file by the API project.
cp -R js "$STAGE/js"
echo "▸ staged $(find "$STAGE/functions" -name '*.js' | wc -l | tr -d ' ') function files for ${PROJECT}"

# ---- deploy the Pages Functions --------------------------------------------
echo "▸ deploying ${PROJECT}…"
(cd "$STAGE" && npx --yes wrangler@3 pages deploy dist --project-name "$PROJECT" \
  --branch main --commit-dirty=true 2>&1 | tail -3)

# ---- confirm ---------------------------------------------------------------
echo "▸ confirming ${LIVE}/api/version says ${VER}…"
for i in $(seq 1 30); do
  got=$(curl -fsS -H 'Cache-Control: no-cache' "$LIVE/api/version" 2>/dev/null | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{try{console.log(JSON.parse(s).version||'')}catch(e){console.log('')}})" || true)
  if [ "$got" = "$VER" ]; then
    echo "✓ live: ${LIVE}/api/version → ${got}"
    # And the browser on GitHub Pages is let in.
    grant=$(curl -fsS -o /dev/null -w '%{http_code} %header{access-control-allow-origin}' -X OPTIONS \
      -H 'Origin: https://0x4123dev.github.io' -H 'Access-Control-Request-Method: POST' \
      -H 'Access-Control-Request-Headers: authorization, content-type' "$LIVE/api/login" 2>/dev/null || true)
    echo "  preflight from https://0x4123dev.github.io → ${grant}"
    case "$grant" in "204 https://0x4123dev.github.io") exit 0 ;; *) echo "✗ CORS grant missing" >&2; exit 1 ;; esac
  fi
  sleep 5
done
echo "✗ $LIVE/api/version did not report $VER (got '$got')" >&2
exit 1
