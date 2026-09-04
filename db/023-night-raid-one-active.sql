-- 023-night-raid-one-active.sql — a child fights ONE raid at a time.
--
-- The daily ticket allowance was checked in night-raid/start.js against
-- night_raid_daily.tickets_used, but that counter is only incremented in
-- night-raid/finish.js. So a child with 3 tickets could POST /start against
-- eight different friends inside the same minute — every call read used=0 —
-- and then finish all eight: eight payouts, eight debited victims, one
-- allowance. No race was needed; it was deterministic.
--
-- start.js now counts in-flight raids toward the allowance, and this partial
-- unique index is the half that a race cannot get past.
--
-- Apply with:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/023-night-raid-one-active.sql

-- Raids that ran out of time and were never scored. They spent no ticket, paid
-- no xu and appear in no report, but they held the pair's 12 h retry clock shut
-- and would now collide with the index below. Delete-and-forget is what
-- start.js and finish.js do with them from here on.
DELETE FROM night_raids WHERE status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_night_raids_one_active
  ON night_raids(attacker_id) WHERE status = 'active';
