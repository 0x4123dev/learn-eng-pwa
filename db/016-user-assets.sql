-- 016-user-assets.sql — server backup for everything a child OWNS.
--
-- Coins have grants and daily snapshots; the dog has night_raid_homes. But
-- petAccessories, castle skins, stickers, streak shields and dogGrowthXP
-- lived only in the device's localStorage — a cleared iPad lost tens of
-- thousands of coins of purchases with no recovery path.
--
-- One JSON blob per learner, merged under the cups rule ("the server may
-- only add"): sets union, numbers take the max. A wiped device syncing empty
-- arrays cannot shrink it, and the PUT's reply IS the restore — a fresh
-- device gets everything back on its first sync.
--
-- Apply BEFORE deploying the code that reads it:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/016-user-assets.sql

CREATE TABLE IF NOT EXISTS user_assets (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id),
  assets_json TEXT NOT NULL DEFAULT '{}',
  updated_at  INTEGER NOT NULL
);
