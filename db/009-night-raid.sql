-- Castle Night Raid: player homes, idempotent raids and daily server caps.
CREATE TABLE IF NOT EXISTS night_raid_homes (
  user_id        INTEGER PRIMARY KEY,
  layout_json    TEXT NOT NULL DEFAULT '{"cells":[],"dogLane":2}',
  teammates_json TEXT NOT NULL DEFAULT '[]',
  dog_level      INTEGER NOT NULL DEFAULT 1,
  castle_skin    TEXT NOT NULL DEFAULT 'stone-keep',
  home_level     INTEGER NOT NULL DEFAULT 1,
  lootable_coins INTEGER NOT NULL DEFAULT 0,
  vault_coins    INTEGER NOT NULL DEFAULT 0,
  ruined_until  INTEGER,
  shield_until  INTEGER,
  updated_at     INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_night_raid_homes_pool
  ON night_raid_homes(home_level, updated_at, ruined_until);

CREATE TABLE IF NOT EXISTS night_raids (
  id              TEXT PRIMARY KEY,
  attacker_id     INTEGER NOT NULL,
  defender_id     INTEGER NOT NULL,
  seed            INTEGER NOT NULL,
  rules_version   INTEGER NOT NULL,
  snapshot_json   TEXT NOT NULL,
  deploy_log_json TEXT,
  result_json     TEXT,
  status          TEXT NOT NULL DEFAULT 'active',
  created_date    TEXT NOT NULL,
  created_at      INTEGER NOT NULL,
  expires_at      INTEGER NOT NULL,
  finished_at     INTEGER,
  seen_by_defender INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (attacker_id) REFERENCES users(id),
  FOREIGN KEY (defender_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_night_raids_attacker_date
  ON night_raids(attacker_id, created_date, status);
CREATE INDEX IF NOT EXISTS idx_night_raids_defender_seen
  ON night_raids(defender_id, seen_by_defender, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_night_raids_pair_date
  ON night_raids(attacker_id, defender_id, created_date);

CREATE TABLE IF NOT EXISTS night_raid_daily (
  user_id       INTEGER NOT NULL,
  raid_date     TEXT NOT NULL,
  tickets_used  INTEGER NOT NULL DEFAULT 0,
  reward_earned INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, raid_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
