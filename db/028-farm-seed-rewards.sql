-- 028-farm-seed-rewards.sql — one seed after each pair of consecutive
-- completed Daily Task days, plus the server-owned seed inventory.

CREATE TABLE IF NOT EXISTS farm_seed_days (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  task_date  TEXT NOT NULL,
  crop_id    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, task_date)
);
CREATE INDEX IF NOT EXISTS idx_farm_seed_days_rewards
  ON farm_seed_days(user_id, crop_id, task_date);

CREATE TABLE IF NOT EXISTS farm_seed_inventory (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  crop_id    TEXT NOT NULL,
  quantity   INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, crop_id)
);
