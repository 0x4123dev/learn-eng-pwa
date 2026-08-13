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
# The token can see more than one account, and wrangler will not guess in a
# non-interactive shell — it prints the menu and exits. Name the account.
: "${CLOUDFLARE_ACCOUNT_ID:=f8b5c3e4cb22d163733b7ce29ecab97c}"  # minhdoanh@gmail.com
export CLOUDFLARE_ACCOUNT_ID

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
    sub("functions/api/version.js", /const VERSION = '"'"'[^'"'"']+'"'"';/, `const VERSION = '"'"'${ver}'"'"';`);
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
COMMITTED=0
if [ -n "$MSG" ]; then
  git add -u
  if git diff --cached --quiet; then echo "▸ nothing to commit"
  else git commit -q -m "$MSG"; COMMITTED=1; echo "▸ committed $(git log --oneline -1)"; fi
fi

# ---- what this deploy changed ---------------------------------------------
# The live check below verifies these BY CONTENT. Checking only js/home.js
# proved too weak: it carries APP_VERSION, so it always looks new the moment
# the deploy lands, while the file you actually changed can still be the old
# one. The files a deploy touched are exactly the ones worth proving.
# Only meaningful when THIS run made the commit. With --no-bump the previous
# commit belongs to someone else's work, and probing it would describe the
# wrong deploy — the fixed probes below still cover the essentials.
CHANGED=""
if [ "$COMMITTED" = "1" ]; then
  CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null \
    | grep -E '^(js/|css/|img/)|^(index|admin)\.html$|^sw\.js$|^manifest\.json$' \
    | head -8 || true)
fi

# ---- build + deploy --------------------------------------------------------
echo "▸ building .cf-dist…"
rm -rf .cf-dist && mkdir -p .cf-dist
cp index.html admin.html manifest.json sw.js .nojekyll .cf-dist/
cp -R css js img audio functions wrangler.toml .cf-dist/

echo "▸ deploying to $PROJECT…"
npx --yes wrangler@3 pages deploy .cf-dist --project-name "$PROJECT" \
  --branch main --commit-dirty=true 2>&1 | tail -4

# ---- confirm it is actually live ------------------------------------------
# Assets and the Functions bundle propagate INDEPENDENTLY: a deploy once
# reported success with the new index.html live while /api/register still ran
# the previous build. Both must report the new version before we say "live".
echo "▸ confirming $LIVE serves v$NEWVER (assets + API)…"
# Cache-Control: no-cache, NOT a ?cb=… query string.
#
# A check of a freshly deployed file once read the PREVIOUS build and reported
# the change missing when the deploy had in fact worked. Two things could cause
# that — an edge cache, or the file simply not having propagated yet — and
# which it was could not be established after the fact.
#
# The header removes one of them for certain: it forces a revalidation, whereas
# a query string cannot, because Pages keys its cache on the path alone. What
# is left, propagation lag, is what the retry loop below is already for. The
# header costs nothing, so it is used even though it is not proven to have been
# the cause.
NOCACHE=(-H 'Cache-Control: no-cache' -H 'Pragma: no-cache')
# Always proven, changed or not: the shell, the service worker (a stale one
# serves the whole app from an old cache), and the largest script — the one
# most likely to still be in flight.
BIGGEST=$(cd .cf-dist && ls -S js/*.js 2>/dev/null | head -1)
EXTRA_PROBES="index.html sw.js $BIGGEST"
assets=""; apiv=""
for i in $(seq 1 30); do
  [ "$assets" = "$NEWVER" ] || assets=$(curl -sL "${NOCACHE[@]}" "$LIVE/js/home.js" \
    | sed -n "s/.*APP_VERSION = 'v\([0-9.]*\)'.*/\1/p" | head -1)
  [ "$apiv" = "$NEWVER" ] || apiv=$(curl -sL "${NOCACHE[@]}" "$LIVE/api/version" \
    | sed -n 's/.*"version":"\([0-9.]*\)".*/\1/p')
  if [ "$assets" = "$NEWVER" ] && [ "$apiv" = "$NEWVER" ]; then
    # Version markers agree. Now prove the CHANGED files are byte-identical to
    # what was built — a matching version number says the deploy landed, not
    # that every file in it did.
    stale=""
    for f in $CHANGED $EXTRA_PROBES; do
      [ -f ".cf-dist/$f" ] || continue
      want=$(md5 -q ".cf-dist/$f" 2>/dev/null || md5sum ".cf-dist/$f" | cut -d' ' -f1)
      # -L is required: Pages 308-redirects /index.html to /, and without it
      # curl returns an empty body, which hashes to something else and reports
      # a perfectly good deploy as stale.
      got=$(curl -sL "${NOCACHE[@]}" "$LIVE/$f" | (md5 -q /dev/stdin 2>/dev/null || md5sum | cut -d' ' -f1))
      [ "$want" = "$got" ] || stale="$stale $f"
    done
    if [ -z "$stale" ]; then
      n=$(printf '%s\n' $CHANGED $EXTRA_PROBES | grep -c . || true)
      echo "✓ live: v$NEWVER — assets ✓  api ✓  ${n} file(s) byte-verified ✓"; exit 0
    fi
    [ $i -lt 30 ] || { echo "⚠ still serving an older copy of:$stale"; exit 1; }
  fi
  sleep 3
done
echo "⚠ after 90s — assets v${assets:-?}, api v${apiv:-?} (wanted v$NEWVER). Check the Pages dashboard."
exit 1
