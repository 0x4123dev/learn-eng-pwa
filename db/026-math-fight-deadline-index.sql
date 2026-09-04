-- 026-math-fight-deadline-index.sql — stop the Đấu Toán reaper scanning every
-- duel ever fought, three times a second.
--
-- This project has no cron, so reapStale() in functions/api/_math-fight.js is
-- the only clock Đấu Toán has: it expires unanswered invites and settles bouts
-- whose five minutes ran out. It therefore runs on GET /api/math-fight, which
-- every open Đấu Toán tab re-polls every 3 seconds.
--
-- Its two statements filter on `expires_at` and `deadline_at`. db/011 indexed
-- (challenger_id, status) and (opponent_id, status) and nothing else, and
-- settled fights are never pruned — so both statements were full scans of a
-- table that only ever grows, run once per device per 3 seconds forever. The
-- partial indexes below cover exactly the rows the reaper can act on (the
-- handful still invited or still active), so a poll that finds nothing stale —
-- almost every poll — reads two index entries and stops.
--
-- The third index serves the same endpoint's friend list. It used to call
-- pairState() once per friend; it now reads one child's whole side of
-- math_fight_pairs in a single `WHERE lo_id = ? OR hi_id = ?`. The lo_id half
-- rides the primary key; the hi_id half had no index at all.
--
-- Apply with:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/026-math-fight-deadline-index.sql

-- Bouts the reaper must settle: started, and past their deadline.
CREATE INDEX IF NOT EXISTS idx_math_fights_active_deadline
  ON math_fights(deadline_at) WHERE status = 'active';

-- Invites the reaper must expire: sent, and past their 60-second window.
CREATE INDEX IF NOT EXISTS idx_math_fights_invited_expires
  ON math_fights(expires_at) WHERE status = 'invited';

-- The other half of the pair key, so the list's set-based handicap read is two
-- index lookups instead of one lookup and one scan.
CREATE INDEX IF NOT EXISTS idx_math_fight_pairs_hi
  ON math_fight_pairs(hi_id);
