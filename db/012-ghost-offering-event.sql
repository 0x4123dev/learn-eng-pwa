-- Daily 22:00–24:00 GMT+7 ghost-offering preview, initially gated by allow_bot.
-- One row per offering makes every reward idempotent across retries/devices.
CREATE TABLE IF NOT EXISTS ghost_offering_claims (
  user_id    INTEGER NOT NULL,
  event_date TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  reward     INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, event_date, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ghost_offering_user_date
  ON ghost_offering_claims(user_id, event_date);

-- Shared public table: one physical offering can be won by only one account.
CREATE TABLE IF NOT EXISTS ghost_offering_world_claims (
  event_date TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  user_id    INTEGER NOT NULL,
  reward     INTEGER NOT NULL,
  claimed_at INTEGER NOT NULL,
  PRIMARY KEY (event_date, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
