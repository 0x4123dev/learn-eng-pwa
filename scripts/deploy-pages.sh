#!/usr/bin/env bash
# deploy-pages.sh — release to GitHub Pages (github.com/0x4123dev/learn-eng-pwa).
#
#   bump APP_VERSION + CACHE_NAME + package.json + functions/api/version.js
#   → rewrite sw.js PRECACHE hashes for the RAW tree (Pages serves the source
#     files as they are — no esbuild bundle, unlike scripts/deploy.sh)
#   → npm test → release commit → push master to `origin` (learn-eng-pwa)
#   → wait for the Pages build and prove the live index.html is this commit.
#
#   scripts/deploy-pages.sh -m "feat(word): ..."   bump patch, commit, push
#   scripts/deploy-pages.sh --version 4.18.0 -m "…" explicit version
#   scripts/deploy-pages.sh --no-bump               already bumped & committed
#   scripts/deploy-pages.sh --no-test               skip the suite (rarely wise)
#
# Live: https://0x4123dev.github.io/learn-eng-pwa/  (branch master, path /).
# `.nojekyll` at the root is REQUIRED — without it Pages runs the tree through
# Jekyll, which chokes on {{ }} in tracked .md files and silently keeps the
# previous build live. A push is not a deploy: the build can fail, so this
# script polls the Pages API for `built` on THIS commit before it says done.
#
# Known limit of the Pages host (the same code on Cloudflare does not have it):
#   - functions/api/* (D1: login sync, daily tasks, arena, coin grants) do not
#     run on GitHub Pages — every /api/ call 404s and the app stays local.
# The service worker DOES run here since v4.17.112: it registers as 'sw.js'
# (relative) and resolves every cache key against the directory it was
# served from (sw.js BASE), so offline and the update prompt work under the
# /learn-eng-pwa/ subpath exactly as at the Cloudflare root.
# Word audio is NOT here: js/app.js WORD_AUDIO_PATH points at the
# eng-pwa-audio Pages project (scripts/deploy-audio.sh).
set -euo pipefail
cd "$(dirname "$0")/.."

REMOTE="origin"
REMOTE_URL="git@github.com:0x4123dev/learn-eng-pwa.git"
REPO="0x4123dev/learn-eng-pwa"
LIVE="https://0x4123dev.github.io/learn-eng-pwa"
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

# ---- HEAD must be what ships ----------------------------------------------
DIRTY=$(git status --porcelain)
if [ -n "$DIRTY" ]; then
  echo "✗ uncommitted changes — commit them first (explicit paths, never -A):" >&2
  echo "$DIRTY" | sed 's/^/    /' >&2
  exit 1
fi
if [ "$BUMP" = "1" ] && [ -z "$MSG" ]; then
  echo "✗ -m \"message\" is required when bumping (use --no-bump for a committed version)" >&2
  exit 1
fi
[ -f .nojekyll ] || { echo "✗ .nojekyll is missing — Pages would run Jekyll and fail the build" >&2; exit 1; }
if ! git remote get-url "$REMOTE" >/dev/null 2>&1; then
  git remote add "$REMOTE" "$REMOTE_URL"
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

# ---- precache manifest over the raw tree -----------------------------------
echo "▸ sw.js PRECACHE hashes (raw source files)…"
node scripts/build-sw-manifest.js

# ---- suite -----------------------------------------------------------------
if [ "$TEST" = "1" ]; then
  echo "▸ running the suite…"
  npm test >/tmp/deploy-pages-test.log 2>&1 || { tail -40 /tmp/deploy-pages-test.log; echo "✗ tests failed — nothing committed, nothing pushed" >&2; exit 1; }
  tail -3 /tmp/deploy-pages-test.log
fi

# ---- release commit --------------------------------------------------------
if [ "$BUMP" = "1" ]; then
  git add js/home.js sw.js package.json functions/api/version.js
  git commit -q -m "chore(release): v$NEWVER — $MSG"
  echo "▸ committed $(git rev-parse --short HEAD)"
fi
SHA=$(git rev-parse HEAD)

# ---- push + wait for the Pages build ---------------------------------------
echo "▸ pushing master → $REMOTE ($REMOTE_URL)…"
git push "$REMOTE" master:master
echo "▸ waiting for the Pages build of ${SHA:0:7}…"
for i in $(seq 1 40); do
  sleep 6
  st=$(gh api "repos/$REPO/pages/builds/latest" --jq '.status + " " + .commit' 2>/dev/null || echo "unknown ?")
  status=${st%% *}; built=${st#* }
  if [ "$built" = "$SHA" ] && [ "$status" = "built" ]; then
    echo "✓ Pages built ${SHA:0:7}"
    break
  fi
  if [ "$built" = "$SHA" ] && [ "$status" = "errored" ]; then
    echo "✗ Pages build ERRORED for ${SHA:0:7}: $(gh api "repos/$REPO/pages/builds/latest" --jq '.error.message')" >&2
    exit 1
  fi
  [ "$i" = "40" ] && { echo "✗ timed out waiting for the Pages build (last: $st)" >&2; exit 1; }
done
# The CDN in front of Pages can lag the build by a minute or two.
for i in $(seq 1 20); do
  live=$(curl -fsS "$LIVE/js/home.js?cb=$(date +%s)" 2>/dev/null | grep -o "APP_VERSION = '[^']*'" || true)
  if [ "$live" = "APP_VERSION = 'v$NEWVER'" ]; then
    echo "✓ live: $LIVE  ($live)"
    echo "  Devices pick it up through the service worker on their next open (or a hard refresh now)."
    exit 0
  fi
  sleep 6
done
echo "⚠ built, but $LIVE/js/home.js still serves the old version (CDN lag?) — check again in a minute" >&2
exit 1
