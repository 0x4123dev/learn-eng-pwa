#!/usr/bin/env bash
# d1-usage.sh — "are we still comfortably inside the Cloudflare free tier?"
#
#   scripts/d1-usage.sh              per-day usage, last 10 days, vs the limits
#   scripts/d1-usage.sh --days 30    a longer window
#   scripts/d1-usage.sh --queries    ALSO: which SQL statements read the rows
#
# WHY THIS EXISTS
#
# The only free-tier resource this app has ever come near is D1 **rows read**.
# Storage is ~2 MB against 5 GB and writes are ~3k/day against 100k — neither
# will matter for years. Rows read is different, because it is not driven by
# how much the children study. It is driven by POLLING INTERVALS, so one line
# of client code can quietly multiply it.
#
# That is exactly what happened. On 2026-09-09 the Đấu trường lobby was found
# to be polling GET /api/battle once a second — 9 queries and ~85 rows each —
# which was 85% of every row the database read, and had pushed one day to 63%
# of the daily limit. v4.17.72 cut that to 3 queries every 5 seconds.
#
#   Baseline BEFORE that fix:  avg 1,209,927 rows/day, peak 3,138,195 (62.8%)
#   Expected AFTER:            roughly 250k-350k/day (~6%)
#
# So: run this after any change to a polling interval, and before turning
# Dau Toan on (js/math-fight.js polls every 3s while its screen is open).
#
# NOTHING HERE CAN COST MONEY. Exceeding a free-tier limit makes D1 queries
# FAIL until the next UTC day; Cloudflare never auto-upgrades or bills you.
# Going paid is a button a human has to press.
set -euo pipefail

cd "$(dirname "$0")/.."
TOKEN_FILE="$HOME/.config/eng-pwa/cloudflare.env"
: "${CLOUDFLARE_ACCOUNT_ID:=f8b5c3e4cb22d163733b7ce29ecab97c}"  # minhdoanh@gmail.com

DAYS=10
SHOW_QUERIES=0
while [ $# -gt 0 ]; do
  case "$1" in
    --days) DAYS="$2"; shift 2 ;;
    --queries) SHOW_QUERIES=1; shift ;;
    -h|--help) sed -n '2,29p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 1 ;;
  esac
done

# ---- credentials -----------------------------------------------------------
# The same file scripts/deploy.sh reads, kept OUTSIDE the repo so a token can
# never be committed by accident. Sourcing it is NOT optional: without it the
# Cloudflare API answers 403 and every number below would be zero.
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ] && [ -f "$TOKEN_FILE" ]; then
  set -a; . "$TOKEN_FILE"; set +a
fi
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  cat >&2 <<EOF
No CLOUDFLARE_API_TOKEN.
  Expected it in $TOKEN_FILE, where scripts/deploy.sh reads it from:
      mkdir -p ~/.config/eng-pwa
      printf 'CLOUDFLARE_API_TOKEN=%s\n' 'YOUR_TOKEN' > $TOKEN_FILE
EOF
  exit 1
fi

# BSD date (macOS) and GNU date (Linux) disagree about relative dates.
SINCE=$(date -u -v-"${DAYS}"d +%Y-%m-%dT00:00:00Z 2>/dev/null \
        || date -u -d "${DAYS} days ago" +%Y-%m-%dT00:00:00Z)
UNTIL=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Scratch space for the two report scripts. They are written to FILES rather
# than fed to `python3 - <<EOF`: a heredoc IS the program on stdin, so a python
# that is both heredoc'd and piped-into finds stdin already exhausted and dies
# with "Expecting value: line 1 column 1".
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

cat > "$TMP/days.py" <<'PYDAYS'
import json, sys, datetime

LIMIT_READ, LIMIT_WRITE = 5_000_000, 100_000
BASELINE_AVG, BASELINE_PEAK = 1_209_927, 3_138_195   # measured 2026-09-09, pre-fix
FIX_DATE = "2026-09-09"                              # v4.17.72, the lobby-poll fix

d = json.load(sys.stdin)
if d.get("errors"):
    print("  API error:", json.dumps(d["errors"])[:400]); raise SystemExit(1)
rows = d["data"]["viewer"]["accounts"][0]["d1AnalyticsAdaptiveGroups"]
agg = {}
for r in rows:
    k = r["dimensions"]["date"]; s = r["sum"]
    a = agg.setdefault(k, [0, 0, 0])
    a[0] += s["rowsRead"]; a[1] += s["rowsWritten"]; a[2] += s["readQueries"]
if not agg:
    print("  no data in this window"); raise SystemExit

today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
print(f"  {'date':<12}{'rowsRead':>12}{'of 5M':>8}  {'':<22}{'queries':>9}{'written':>9}")
for k in sorted(agg, reverse=True):
    a = agg[k]
    pct = 100 * a[0] / LIMIT_READ
    bar = "#" * min(20, int(pct / 5)) or "."
    if k == today:
        note = "  <- partial"
    elif k == FIX_DATE:
        note = "  <- fix shipped"
    else:
        note = ""
    print(f"  {k:<12}{a[0]:>12,}{pct:>7.1f}%  {bar:<22}{a[2]:>9,}{a[1]:>9,}{note}")

# Days BEFORE the fix and days after must never be averaged together - that is
# the whole question this script answers. (The first version of this script did
# exactly that and cheerfully reported usage was UP.) The fix day itself is
# excluded from both: it is half one regime and half the other.
before = {k: v for k, v in agg.items() if k < FIX_DATE}
after = {k: v for k, v in agg.items() if k > FIX_DATE and k != today}

print()
print(f"  pre-fix baseline (measured {FIX_DATE}): avg {BASELINE_AVG:,}/day, peak {BASELINE_PEAK:,}")
if before:
    avg_b = sum(v[0] for v in before.values()) // len(before)
    print(f"  before the fix, in this window: avg {avg_b:,}/day over {len(before)} day(s)")

if not after:
    print(f"  after the fix:  no complete day yet - it shipped on the evening of {FIX_DATE}.")
    print("                  Re-run once a normal usage day has passed;")
    print("                  the UTC day rolls at 07:00 GMT+7.")
    raise SystemExit

avg = sum(v[0] for v in after.values()) // len(after)
peak = max(v[0] for v in after.values())
print(f"  after the fix:  avg {avg:,}/day ({100*avg/LIMIT_READ:.1f}%), "
      f"peak {peak:,} ({100*peak/LIMIT_READ:.1f}%) over {len(after)} complete day(s)")
delta = 100 * (BASELINE_AVG - avg) / BASELINE_AVG
if delta > 0:
    print(f"  -> DOWN {delta:.0f}% versus the baseline average")
else:
    print(f"  -> UP {-delta:.0f}% versus the baseline. Check whether a poll interval")
    print("     changed, or Dau Toan (math_fight) was switched on. Run with --queries.")

worst_written = max(v[1] for v in after.values())
if peak > 0.8 * LIMIT_READ:
    print("  WARNING: a day exceeded 80% of the daily read limit - run with --queries")
elif peak > 0.5 * LIMIT_READ:
    print("  WARNING: a day exceeded 50% of the daily read limit")
else:
    print("  OK: comfortably inside the free tier")
if worst_written > 0.5 * LIMIT_WRITE:
    print(f"  WARNING: rows written climbing too: peak {worst_written:,} of {LIMIT_WRITE:,}/day")
PYDAYS

cat > "$TMP/queries.py" <<'PYQ'
import json, re, sys

d = json.load(sys.stdin)
if d.get("errors"):
    print("  API error:", json.dumps(d["errors"])[:400]); raise SystemExit(1)
rows = d["data"]["viewer"]["accounts"][0]["d1QueriesAdaptiveGroups"]
if not rows:
    print("  no query data in this window"); raise SystemExit
total = sum(r["sum"]["rowsRead"] for r in rows) or 1
for r in rows[:15]:
    s, c = r["sum"], r["count"]
    q = re.sub(r"\s+", " ", r["dimensions"]["query"]).strip()
    per = s["rowsRead"] / c if c else 0
    print(f"  {s['rowsRead']:>11,}r {100*s['rowsRead']/total:>5.1f}%  "
          f"{c:>7,} calls  {per:>7.1f} r/call")
    print(f"              {q[:120]}")
PYQ

gql() {  # $1 = GraphQL query string
  python3 -c 'import json,sys; print(json.dumps({"query": sys.argv[1]}))' "$1" > "$TMP/q.json"
  curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
       -H "Content-Type: application/json" \
       --data @"$TMP/q.json" \
       https://api.cloudflare.com/client/v4/graphql
}

echo "Cloudflare D1 usage - last ${DAYS} days (UTC days; the day rolls at 07:00 GMT+7)"
echo

gql "query { viewer { accounts(filter: {accountTag: \"$CLOUDFLARE_ACCOUNT_ID\"}) {
  d1AnalyticsAdaptiveGroups(limit: 500,
    filter: {datetime_geq: \"$SINCE\", datetime_leq: \"$UNTIL\"},
    orderBy: [date_DESC]) {
      dimensions { date } sum { rowsRead rowsWritten readQueries writeQueries } } } } }" \
| python3 "$TMP/days.py"

if [ "$SHOW_QUERIES" = "1" ]; then
  echo
  echo "Top statements by rows read (same window)"
  echo "  High rows/call  = an aggregate or a scan."
  echo "  Huge call count = something on a polling path."
  echo
  # NOTE: in this dataset the call count is `count`, NOT `queryCount`, and the
  # sum fields are rowsRead/rowsReturned/rowsWritten. Getting a name wrong
  # returns "unknown field" rather than a wrong number, which is a mercy.
  gql "query { viewer { accounts(filter: {accountTag: \"$CLOUDFLARE_ACCOUNT_ID\"}) {
    d1QueriesAdaptiveGroups(limit: 20,
      filter: {datetime_geq: \"$SINCE\", datetime_leq: \"$UNTIL\"},
      orderBy: [sum_rowsRead_DESC]) {
        count dimensions { query } sum { rowsRead rowsWritten } } } } }" \
  | python3 "$TMP/queries.py"
fi
