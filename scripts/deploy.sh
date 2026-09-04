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
#   scripts/deploy.sh --allow-dirty              ship uncommitted work anyway
#
# It REFUSES to run with uncommitted changes: the bundle is built from the
# working tree, so anything not committed would be live in no commit at all.
# Commit your own work first (explicit paths — another session may share this
# repo), then deploy.
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

BUMP=1; TEST=1; MSG=""; NEWVER=""; ALLOW_DIRTY=0
while [ $# -gt 0 ]; do
  case "$1" in
    --version) NEWVER="$2"; shift 2 ;;
    -m|--message) MSG="$2"; shift 2 ;;
    --no-bump) BUMP=0; shift ;;
    --no-test) TEST=0; shift ;;
    --allow-dirty) ALLOW_DIRTY=1; shift ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
done

# ---- HEAD must be what ships ----------------------------------------------
# The bundle is built from the WORKING TREE, but only the four version markers
# are committed (see the commit step below, and the reason it has to be that
# way when two sessions share this repo). Those two facts together meant a
# deploy could ship code that exists in no commit at all: checking out the
# deploy commit did not reproduce production, a rollback to it shipped a build
# the suite had never run on, and another session's half-finished edit could
# reach a child's phone under a commit that did not contain it.
#
# So: commit your own work FIRST, then deploy. That is already the documented
# workflow; this makes it true rather than merely recommended.
# Checked BEFORE the version bump, so there is no whitelist to be wrong about:
# at this point nothing has been modified and the tree must simply be clean.
#
# `git status --porcelain`, not `git diff --name-only`: the latter sees only
# UNSTAGED changes to TRACKED files. A staged file was invisible to it and then
# swallowed by the commit below; a brand-new untracked js/*.js was invisible to
# it and shipped in the bundle while existing in no commit at all. The old
# whitelist also exempted js/home.js and sw.js ENTIRELY, not just their version
# lines, so real uncommitted logic in either passed straight through.
DIRTY=$(git status --porcelain 2>/dev/null || true)
if [ -n "$DIRTY" ] && [ "$ALLOW_DIRTY" = "0" ]; then
  echo "✗ the working tree is not clean; these would ship without being committed:"
  echo "$DIRTY" | sed 's/^/    /'
  echo
  echo "  Commit them first (stage explicit paths — another session may be"
  echo "  working in this repo), then run deploy.sh again."
  echo "  To ship anyway, knowing HEAD will not match the live site:"
  echo "      scripts/deploy.sh --allow-dirty -m \"…\""
  exit 1
fi

# A bump with nothing to commit it under leaves the live site one version ahead
# of every commit, permanently and silently.
if [ "$BUMP" = "1" ] && [ -z "$MSG" ]; then
  echo "✗ -m \"message\" is required when bumping: the four version markers have"
  echo "  to land in a commit, or HEAD stops describing what is live."
  echo "  Use --no-bump to deploy an already-committed version."
  exit 1
fi

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
  # With the dirty-tree guard above, the working tree IS HEAD plus the version
  # bump, so this runs the suite against exactly what is about to ship.
  echo "▸ running the suite…"
  if ! out=$(node tests/run-all.js 2>&1); then
    echo "$out" | tail -30; echo "✗ tests failed — nothing deployed"; exit 1
  fi
  echo "  $(echo "$out" | grep -oE '[0-9]+ tests passed' | tail -1)"
fi

# ---- commit ----------------------------------------------------------------
# ONLY the four files the bump step above rewrote. This used to be `git add -u`,
# which stages every modified tracked file — and with two Claude sessions open
# on this repo that meant a deploy silently swallowed the other one's work in
# progress: a maths session's chapter files landed inside a battle-titled
# commit that way. A deploy commits its own version bump and nothing else.
#
# The list is written out literally rather than held in a variable: an
# unquoted expansion splits in bash but NOT in zsh, and a pathspec that
# silently became one long filename would stage nothing at all.
COMMITTED=0
if [ -n "$MSG" ]; then
  # Anything else modified still SHIPS — the bundle is built from the working
  # tree, as it always was — it simply is not committed under this message.
  # Say so out loud rather than letting it go out unremarked.
  # Normally empty: the dirty-tree guard at the top refuses to run with
  # anything else modified. It can still be non-empty under --allow-dirty, and
  # then it MUST be said out loud — that is the case where HEAD stops
  # describing what is live.
  # Untracked files count here too: they ship in the bundle just the same.
  others=$(git status --porcelain | awk '{print $NF}' | grep -vxF \
    -e js/home.js -e sw.js -e package.json -e functions/api/version.js || true)
  if [ -n "$others" ]; then
    echo "▸ WARNING (--allow-dirty): these ship but stay OUT of the commit,"
    echo "  so this commit does NOT describe what is live:"
    echo "$others" | sed 's/^/    /'
  fi
  git add -- js/home.js sw.js package.json functions/api/version.js
  if git diff --cached --quiet; then echo "▸ nothing to commit"
  else
    # PATHSPEC on the commit too. A bare `git commit -m` commits the whole
    # index, so anything another session had staged rode along inside a
    # "chore: vN" commit — the exact accident the explicit `git add` above was
    # written to prevent, undone one line later.
    git commit -q -m "$MSG" -- js/home.js sw.js package.json functions/api/version.js
    COMMITTED=1; echo "▸ committed $(git log --oneline -1)"
  fi
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
cp index.html admin.html manifest.json sw.js .nojekyll _redirects .cf-dist/
# audio/ is deliberately absent: the ~13,000 word MP3s deploy separately to
# the eng-pwa-audio Pages project (scripts/deploy-audio.sh) so they can never
# push this deployment over Cloudflare's 20,000-file limit.
cp -R css js img assets functions wrangler.toml .cf-dist/

# Refuse to ship a deployment that is creeping toward the Pages file cap —
# better to fail here with a name than mid-upload with an API error.
COUNT=$(find .cf-dist -type f | wc -l | tr -d ' ')
echo "▸ .cf-dist: $COUNT files (Pages limit: 20,000/deployment)"
if [ "$COUNT" -ge 18000 ]; then
  echo "✗ $COUNT files staged — nearly at Cloudflare's 20,000-file limit." >&2
  echo "  Find what grew: find .cf-dist -type f | awk -F/ '{print \$2}' | sort | uniq -c | sort -rn | head" >&2
  exit 1
fi

# Braces are load-bearing: "$PROJECT…" makes bash read the first byte of the
# multibyte "…" as part of the NAME under some locales, and `set -u` then kills
# the deploy after the build with "PROJECT\xe2: unbound variable".
echo "▸ deploying to ${PROJECT}…"
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
