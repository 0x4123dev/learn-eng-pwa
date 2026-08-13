#!/usr/bin/env bash
# deploy-audio.sh — ship the word recordings to their own Pages project.
#
# The app lives in the `eng-pwa` Pages project; the ~13,000 immutable word
# MP3s live in `eng-pwa-audio`. Cloudflare Pages allows at most 20,000 files
# per deployment, and the recordings alone were 13,084 of them — one growing
# dictionary away from bricking every app deploy. Split out, both projects sit
# far below the limit, and the CDN, the per-file URLs and the service-worker
# cache behave exactly as before (js/app.js WORD_AUDIO_PATH points here).
#
# Run whenever scripts/generate-word-audio.js has added recordings:
#   scripts/deploy-audio.sh
#
# NEVER pushes to GitHub. Cloudflare Pages only.
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT="eng-pwa-audio"
LIVE="https://eng-pwa-audio.pages.dev"
TOKEN_FILE="$HOME/.config/eng-pwa/cloudflare.env"
: "${CLOUDFLARE_ACCOUNT_ID:=f8b5c3e4cb22d163733b7ce29ecab97c}"  # minhdoanh@gmail.com
export CLOUDFLARE_ACCOUNT_ID

# ---- credentials (same file scripts/deploy.sh uses) -------------------------
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$TOKEN_FILE" ]; then
  set -a; . "$TOKEN_FILE"; set +a
fi
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "✗ No CLOUDFLARE_API_TOKEN — see the setup note in scripts/deploy.sh" >&2
  exit 1
fi

# ---- stage ------------------------------------------------------------------
echo "▸ staging .cf-audio-dist…"
mkdir -p .cf-audio-dist
rsync -a --delete --exclude '.DS_Store' audio/words/ .cf-audio-dist/audio/words/

# Immutable recordings: cache forever. ACAO lets the app origin read the
# bytes — the service worker slices Range responses out of full cached bodies.
cat > .cf-audio-dist/_headers <<'EOF'
/audio/words/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *
EOF

cat > .cf-audio-dist/index.html <<'EOF'
<!doctype html><title>eng-pwa audio</title>
<p>Static word recordings for <a href="https://eng-pwa.pages.dev">eng-pwa</a>.</p>
EOF

# Wrangler walks up the directory tree and would otherwise find the repo's
# wrangler.toml (name = eng-pwa) — this local one pins the audio project.
cat > .cf-audio-dist/wrangler.toml <<'EOF'
name = "eng-pwa-audio"
compatibility_date = "2024-09-23"
pages_build_output_dir = "."
EOF

COUNT=$(find .cf-audio-dist -type f | wc -l | tr -d ' ')
echo "▸ $COUNT files staged (Pages limit: 20,000/deployment)"
if [ "$COUNT" -ge 18000 ]; then
  echo "✗ $COUNT files — nearly at Cloudflare's 20,000-file limit." >&2
  echo "  Split the recordings across two audio projects (e.g. a–m / n–z)" >&2
  echo "  or move them to R2 (needs R2 permissions on the API token)." >&2
  exit 1
fi

# ---- deploy -----------------------------------------------------------------
# Create-if-missing; an "already exists" error is the normal case.
npx --yes wrangler@3 pages project create "$PROJECT" --production-branch master 2>/dev/null || true

echo "▸ deploying $COUNT files to $PROJECT…"
(cd .cf-audio-dist && npx --yes wrangler@3 pages deploy . \
  --project-name "$PROJECT" --branch master --commit-dirty=true)

# ---- verify -----------------------------------------------------------------
sleep 5
code=$(curl -s -o /dev/null -w '%{http_code}' "$LIVE/audio/words/a.mp3")
if [ "$code" = "200" ]; then
  echo "✓ live: $LIVE/audio/words/a.mp3"
else
  echo "⚠ $LIVE/audio/words/a.mp3 returned $code (first deploy? DNS can take a minute)"
fi
