#!/usr/bin/env bash
# deploy.sh — ship FlashLingo to the live site in one command.
#
# The ritual this replaces, which was easy to half-forget:
#   bump APP_VERSION + CACHE_NAME + package.json  →  run tests  →  commit
#   →  build .cf-dist  →  wrangler pages deploy  →  confirm live
#
#   scripts/deploy.sh -m "fix(friends): ..."     bump patch, commit, deploy
#   scripts/deploy.sh --version 4.3.0 -m "..."   explicit version
#   scripts/deploy.sh --no-bump                  already bumped & committed
#   scripts/deploy.sh --no-test                  skip the suite (rarely wise)
#
# NEVER pushes to GitHub. Local commits + Cloudflare Pages only.
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT="eng-pwa"
LIVE="https://eng-pwa.pages.dev"
TOKEN_FILE="$HOME/.config/eng-pwa/cloudflare.env"

BUMP=1; TEST=1; MSG=""; NEWVER=""
while [ $# -gt 0 ]; do
  case "$1" in
    --version) NEWVER="$2"; shift 2 ;;
    -m|--message) MSG="$2"; shift 2 ;;
    --no-bump) BUMP=0; shift ;;
    --no-test) TEST=0; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

# ---- credentials -----------------------------------------------------------
# Kept OUTSIDE the repo so a token can never be committed by accident.
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$TOKEN_FILE" ]; then
  set -a; . "$TOKEN_FILE"; set +a
fi
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  cat >&2 <<EOF
✗ No CLOUDFLARE_API_TOKEN.

  One-time setup (the token stays out of the repo and out of chat):
      mkdir -p ~/.config/eng-pwa
      printf 'CLOUDFLARE_API_TOKEN=%s\n' 'YOUR_TOKEN' > ~/.config/eng-pwa/cloudflare.env
      chmod 600 ~/.config/eng-pwa/cloudflare.env

  Needs Cloudflare Pages: Edit (and Workers Scripts: Edit for battle-worker).
EOF
  exit 1
fi

# ---- version ---------------------------------------------------------------
cur=$(node -p "require('./package.json').version")
if [ "$BUMP" = "1" ]; then
  if [ -z "$NEWVER" ]; then
    NEWVER=$(node -p "const [a,b,c]='$cur'.split('.').map(Number);[a,b,c+1].join('.')")
  fi
  cache=$(node -p "String(Number(require('fs').readFileSync('sw.js','utf8').match(/flashlingo-v(\d+)/)[1])+1)")
  node -e '
    const fs = require("fs");
    const [ver, cache] = process.argv.slice(1);
    const sub = (f, re, to) => fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace(re, to));
    sub("js/home.js", /const APP_VERSION = .*/, `const APP_VERSION = '"'"'v${ver}'"'"';`);
    sub("sw.js", /flashlingo-v\d+/, `flashlingo-v${cache}`);
    sub("package.json", /"version": "[^"]+"/, `"version": "${ver}"`);
  ' "$NEWVER" "$cache"
  echo "▸ version $cur → $NEWVER   (cache flashlingo-v$cache)"
else
  NEWVER="$cur"
  echo "▸ version $NEWVER (unchanged)"
fi

# ---- tests -----------------------------------------------------------------
# Before the deploy, not after. A red suite must never reach the child's phone.
if [ "$TEST" = "1" ]; then
  echo "▸ running the suite…"
  if ! out=$(node tests/run-all.js 2>&1); then
    echo "$out" | tail -30; echo "✗ tests failed — nothing deployed"; exit 1
  fi
  echo "  $(echo "$out" | grep -oE '[0-9]+ tests passed' | tail -1)"
fi

# ---- commit ----------------------------------------------------------------
# -u: tracked files only, so stray untracked dirs are never swept in.
if [ -n "$MSG" ]; then
  git add -u
  if git diff --cached --quiet; then echo "▸ nothing to commit"
  else git commit -q -m "$MSG"; echo "▸ committed $(git log --oneline -1)"; fi
fi

# ---- build + deploy --------------------------------------------------------
echo "▸ building .cf-dist…"
rm -rf .cf-dist && mkdir -p .cf-dist
cp index.html admin.html manifest.json sw.js .nojekyll .cf-dist/
cp -R css js img functions wrangler.toml .cf-dist/

echo "▸ deploying to $PROJECT…"
npx --yes wrangler@3 pages deploy .cf-dist --project-name "$PROJECT" \
  --branch main --commit-dirty=true 2>&1 | tail -4

# ---- confirm it is actually live ------------------------------------------
# Pages serves the new build within a few seconds; poll rather than assume.
echo "▸ confirming $LIVE serves v$NEWVER…"
for i in $(seq 1 20); do
  live=$(curl -s "$LIVE/js/home.js?cb=$RANDOM" | sed -n "s/.*APP_VERSION = 'v\([0-9.]*\)'.*/\1/p" | head -1)
  if [ "$live" = "$NEWVER" ]; then echo "✓ live: v$live"; exit 0; fi
  sleep 3
done
echo "⚠ live still reports v${live:-?} after 60s — check the Pages dashboard"
exit 1
