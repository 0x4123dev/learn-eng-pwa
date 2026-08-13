-- 005-disable-account.sql — let an admin switch an account off.
--
-- Disabling is NOT deleting. The row, the history, the cups and the battle
-- record all stay: an account switched off by mistake is switched back on with
-- one click, and a child's progress is never destroyed by a moderation action.
--
-- Enforcement lives in requireAuth(), not only in login. Tokens are valid for
-- 90 days, so a login-only check would leave a disabled child fully working
-- until their token happened to expire — up to three months of "disabled"
-- doing nothing at all.
--
-- Apply BEFORE deploying the code that reads it:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/005-disable-account.sql

ALTER TABLE users ADD COLUMN disabled INTEGER NOT NULL DEFAULT 0;
