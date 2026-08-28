-- D1 schema for eng_pwa_db (accounts + exam-attempt history).
CREATE TABLE IF NOT EXISTS config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT NOT NULL UNIQUE,
  passcode_hash TEXT NOT NULL,
  salt          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user',
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  -- Opaque random id the client keeps in localStorage; caps how many accounts
  -- one device may create. See db/004-device-limit.sql for the reasoning.
  device_id     TEXT,
  -- Admin switch. Disabling keeps the row and all history; see 005.
  disabled      INTEGER NOT NULL DEFAULT 0,
  -- Per-user QA/feature gate (Night Raid, bot opponents, event previews).
  -- Read by POST /api/coins on EVERY sync — without this column a rebuilt
  -- database breaks the whole coin-claim path. See db/014.
  allow_bot     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);

CREATE TABLE IF NOT EXISTS exam_attempts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL,
  exam_id        TEXT NOT NULL,
  exam_title     TEXT,
  score          INTEGER NOT NULL,
  total          INTEGER NOT NULL,
  time_spent_sec INTEGER,
  auto_submitted INTEGER DEFAULT 0,
  answers_json   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_user   ON exam_attempts(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_created ON exam_attempts(created_at);

-- Non-exam learning activity (lessons, grammar/phrases/verbs practice, SRS review).
CREATE TABLE IF NOT EXISTS activities (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  type        TEXT NOT NULL,            -- lesson | review | grammar | phrases | collocation
                                        -- | wordform | rewrite | verbs | math | battle
                                        -- (the accepted list lives in functions/api/activity.js)
  title       TEXT,
  score       INTEGER,
  total       INTEGER,
  detail_json TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_activities_user    ON activities(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activities_created ON activities(created_at);
-- Idempotency: one activity per (user, type, second) so re-syncs never duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_activities_dedup ON activities(user_id, type, created_at);

-- Daily wallet recovery checkpoint recorded by the activity-sync request.
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

-- Skill-level learning analytics. One row is one completed session × skill,
-- not one row per click/question. This keeps D1 writes small while preserving
-- enough detail for the admin to identify what a learner is strong or weak at.
CREATE TABLE IF NOT EXISTS learning_skill_results (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL,
  client_session_id TEXT NOT NULL,
  menu              TEXT NOT NULL,
  skill_key         TEXT NOT NULL,
  skill_label       TEXT NOT NULL,
  attempts          INTEGER NOT NULL DEFAULT 0,
  correct           INTEGER NOT NULL DEFAULT 0,
  wrong             INTEGER NOT NULL DEFAULT 0,
  skipped           INTEGER NOT NULL DEFAULT 0,
  duration_ms       INTEGER NOT NULL DEFAULT 0,
  wrong_refs_json   TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, client_session_id, skill_key)
);
CREATE INDEX IF NOT EXISTS idx_skill_results_user_date
  ON learning_skill_results(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_skill_results_user_menu_date
  ON learning_skill_results(user_id, menu, created_at);
CREATE INDEX IF NOT EXISTS idx_skill_results_skill_date
  ON learning_skill_results(skill_key, created_at);

-- Castle Night Raid (see db/009-night-raid.sql).
CREATE TABLE IF NOT EXISTS night_raid_homes (
  user_id INTEGER PRIMARY KEY, layout_json TEXT NOT NULL DEFAULT '{"cells":[],"dogLane":2}',
  teammates_json TEXT NOT NULL DEFAULT '[]', dog_level INTEGER NOT NULL DEFAULT 1,
  castle_skin TEXT NOT NULL DEFAULT 'stone-keep', home_level INTEGER NOT NULL DEFAULT 1,
  lootable_coins INTEGER NOT NULL DEFAULT 0, vault_coins INTEGER NOT NULL DEFAULT 0,
  ruined_until INTEGER, shield_until INTEGER, updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_night_raid_homes_pool ON night_raid_homes(home_level, updated_at, ruined_until);
CREATE TABLE IF NOT EXISTS night_raids (
  id TEXT PRIMARY KEY, attacker_id INTEGER NOT NULL, defender_id INTEGER NOT NULL,
  seed INTEGER NOT NULL, rules_version INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
  deploy_log_json TEXT, result_json TEXT, status TEXT NOT NULL DEFAULT 'active',
  created_date TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
  finished_at INTEGER, seen_by_defender INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (attacker_id) REFERENCES users(id), FOREIGN KEY (defender_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_night_raids_attacker_date ON night_raids(attacker_id, created_date, status);
CREATE INDEX IF NOT EXISTS idx_night_raids_defender_seen ON night_raids(defender_id, seen_by_defender, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_night_raids_pair_date ON night_raids(attacker_id, defender_id, created_date);
CREATE TABLE IF NOT EXISTS night_raid_daily (
  user_id INTEGER NOT NULL, raid_date TEXT NOT NULL, tickets_used INTEGER NOT NULL DEFAULT 0,
  reward_earned INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, raid_date),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Admin coin gifts (db/010). An IOU the child's device claims exactly once:
-- claimed_at IS NULL rows are paid out by POST /api/coins, then stamped.
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

-- Daily 22:00–24:00 GMT+7 ghost-offering event (db/012).
CREATE TABLE IF NOT EXISTS ghost_offering_claims (
  user_id INTEGER NOT NULL, event_date TEXT NOT NULL, item_id TEXT NOT NULL,
  reward INTEGER NOT NULL, claimed_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, event_date, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_ghost_offering_user_date
  ON ghost_offering_claims(user_id, event_date);
CREATE TABLE IF NOT EXISTS ghost_offering_world_claims (
  event_date TEXT NOT NULL, item_id TEXT NOT NULL, user_id INTEGER NOT NULL,
  reward INTEGER NOT NULL, claimed_at INTEGER NOT NULL,
  PRIMARY KEY (event_date, item_id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
