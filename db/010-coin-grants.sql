-- 010-coin-grants.sql — admin gives coins; the child's device claims them.
--
-- The wallet itself lives in the child's device profile (appState.coins in
-- localStorage), so a grant cannot write a balance directly. Instead it is a
-- server-side IOU: the admin inserts a row here, and the next time the
-- child's app syncs it claims every unclaimed row (POST /api/coins), adds the
-- total to its local wallet, and the rows are marked claimed so a re-sync can
-- never pay the same grant twice.
--
-- Apply BEFORE deploying the code that reads it:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/010-coin-grants.sql

CREATE TABLE IF NOT EXISTS coin_grants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id),
  amount      INTEGER NOT NULL,
  note        TEXT,
  granted_by  INTEGER NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  claimed_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_coin_grants_unclaimed
  ON coin_grants(user_id) WHERE claimed_at IS NULL;
