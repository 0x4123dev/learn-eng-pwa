-- 021-night-raid-rules.sql — Cướp Đêm becomes a gamble again, and its numbers
-- become admin-tunable.
--
-- Until now the friends list told a child, per house, exactly when it would be
-- raidable — including that it had already been robbed. That turned NHÀ THẬT
-- into a lookup: read the list, pick the one green row, win. Two things change.
--
-- 1. The 24 h seal on a robbed house (night_raid_homes.ruined_until, db/009)
--    stays exactly as it is, but nobody except the owner may see it. A child
--    who attacks a sealed house is no longer bounced for free: the attempt is
--    RECORDED (a night_raids row with status='ruined'), the troops march in,
--    find rubble and retreat. No ticket, no coins — but the attempt starts
--    that child's own retry timer on that house.
--
-- 2. "Once per pair per ICT day" becomes "once per pair per retry_hours".
--    That is why idx_night_raids_pair_date has to go: it is UNIQUE on
--    (attacker_id, defender_id, created_date), so a perfectly legal retry
--    12 h after the first attempt would still explode with a constraint
--    error whenever both attempts fall on the same ICT day — and the ruins
--    row above would make that collision the common case, not the rare one.
--    idx_night_raids_pair_recent replaces it: same two columns, ordered by
--    created_at, non-unique, so "my last attempt on this house" is one index
--    seek (friends.js, targets.js and start.js all ask exactly that).
--
-- night_raid_config holds every number the economy turns on, one integer per
-- row, so retuning the game is an admin edit instead of a deploy. The defaults
-- live in functions/api/_night-raid.js (RAID_CONFIG_DEFAULTS): an empty table
-- is the normal, fully working state, and each value is clamped to a sane
-- range on read, so a typo in the admin page cannot break the game. This
-- migration therefore seeds NOTHING.
--
-- Deploy order does NOT matter. readRaidConfig() asks PRAGMA table_info first
-- and plays the defaults while the table is absent, so the code is safe to
-- ship before this file is applied — and the moment it lands the admin page
-- starts working without a redeploy. Dropping the unique index is the one
-- half that must not lag far behind the code: while it still exists, a second
-- attempt on the same house on the same ICT day fails.
--
-- Apply with:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/021-night-raid-rules.sql
--
-- Every statement is idempotent; re-running is a no-op.

CREATE TABLE IF NOT EXISTS night_raid_config (
  key TEXT PRIMARY KEY, value INTEGER NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT 0, updated_by INTEGER
);

DROP INDEX IF EXISTS idx_night_raids_pair_date;
CREATE INDEX IF NOT EXISTS idx_night_raids_pair_recent
  ON night_raids(attacker_id, defender_id, created_at);
