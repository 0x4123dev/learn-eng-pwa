-- Daily recovery checkpoints for the device-owned learner coin wallet.
-- One newest snapshot per learner per GMT+7 calendar day. The activity row
-- that triggered the sync is retained as provenance for admin/recovery work.
CREATE TABLE IF NOT EXISTS user_coin_snapshots (
  user_id            INTEGER NOT NULL,
  snapshot_date      TEXT NOT NULL,
  balance            INTEGER NOT NULL,
  observed_at        INTEGER NOT NULL,
  source_activity_at INTEGER,
  source_type        TEXT,
  source_title       TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, snapshot_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_coin_snapshots_recent
  ON user_coin_snapshots(user_id, observed_at DESC);
