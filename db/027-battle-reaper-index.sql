-- 027-battle-reaper-index.sql — the same fix db/026 gave Đấu Toán, for the
-- pet battles. It was 60% of every row this project reads.
--
-- This project has no cron, so reapStale() in functions/api/_battle.js is the
-- only clock the arena has: it expires unanswered invites and settles battles
-- whose turn clock ran out. It therefore runs at the top of EVERY battle
-- endpoint — index, state, challenge, turn, respond — which an open arena
-- re-polls continuously.
--
-- Its two statements filter on `expires_at` and `turn_started_at`. db/002
-- indexed (challenger_id, status) and (opponent_id, status) and nothing else,
-- and finished battles are never pruned — so both statements were full scans
-- of a table that only ever grows, on every request forever.
--
-- Measured over the seven days to 2026-09-04, on 13 registered children of
-- whom 3-5 studied on any given day:
--
--   UPDATE … status='expired' … expires_at < ?     2,237,132 rows  45,322 calls
--   UPDATE … status='done'    … turn_started_at<?  2,159,863 rows  43,547 calls
--
-- 4.4 million rows read — 52% of the whole account, and 60% counting the rest
-- of the arena's queries — to scan a 60-row table and find nothing: at the
-- time of writing `battles` holds 0 invited and 0 active rows. Cloudflare
-- began ENFORCING the D1 free-tier ceiling of 5,000,000 rows read per day on
-- 2026-09-01, failing queries past it, and the peak day here was 2,567,257.
--
-- The partial indexes below cover exactly the rows the reaper can act on (the
-- handful still invited or still active), so a sweep that finds nothing —
-- almost every sweep — reads two index entries and stops. Behaviour does not
-- change: same statements, same timings, same results. Only the cost moves.
--
-- Apply with:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/027-battle-reaper-index.sql
--
-- Reversible on its own, with no code deploy:
--   DROP INDEX idx_battles_invited_expires; DROP INDEX idx_battles_active_turn;

-- Invites the reaper must expire: sent, and past their TTL.
CREATE INDEX IF NOT EXISTS idx_battles_invited_expires
  ON battles(expires_at) WHERE status = 'invited';

-- Battles the reaper must settle: under way, and past their turn clock.
CREATE INDEX IF NOT EXISTS idx_battles_active_turn
  ON battles(turn_started_at) WHERE status = 'active';
