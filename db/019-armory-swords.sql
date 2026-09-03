-- 019-armory-swords.sql — the daily-task reward becomes a CHOICE.
--
-- db/018 paid "200 xu + 1 shield" automatically the moment the day's tasks
-- were done. Since 019 the 200 xu are still paid exactly as before, but the
-- second half of the reward is written as an UNCLAIMED row: the child opens
-- Kho Khiên & Kiếm whenever they like and turns each earned day into either
--   a shield  — spend one, the castle is unraidable for 24 h (unchanged), or
--   a sword   — never spent, +SWORD_DAMAGE attack on every raid, up to
--               SWORD_CAP swords (js/night-raid-rules.js).
-- Pending rewards accumulate and never expire.
--
--   daily_task_rewards.claimed_kind   NULL = earned, waiting for the child to
--                                     choose; 'shield' | 'sword' once chosen
--   daily_task_rewards.claimed_at     when they chose
--   users.night_swords                sword stock, beside users.night_shields
--
-- Deploy order does NOT matter. functions/api/_daily-task.js checks
-- PRAGMA table_info on every request until these columns exist and, while
-- they are absent, keeps crediting the shield directly as 018 did. The
-- backfill below therefore marks every row that exists at migration time as
-- 'shield': each of those days already had its shield put straight into
-- users.night_shields, so none of them is owed a second pick.
--
-- Apply with:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/019-armory-swords.sql
--
-- Re-running fails with "duplicate column name", which is the correct no-op
-- signal (SQLite has no ADD COLUMN IF NOT EXISTS).

ALTER TABLE daily_task_rewards ADD COLUMN claimed_kind TEXT;
ALTER TABLE daily_task_rewards ADD COLUMN claimed_at TEXT;
UPDATE daily_task_rewards SET claimed_kind = 'shield', claimed_at = granted_at WHERE claimed_kind IS NULL;
ALTER TABLE users ADD COLUMN night_swords INTEGER NOT NULL DEFAULT 0;
