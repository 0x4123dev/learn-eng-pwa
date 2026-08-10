-- Friends + pet battles (spec: docs/plans/2026-08-10-friends-battle-plan.md).
-- Apply with:  npx wrangler@3 d1 execute eng_pwa_db --remote --file db/002-friends-battle.sql

-- One row per relationship; "are we friends" checks both directions.
CREATE TABLE IF NOT EXISTS friendships (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  requester_id  INTEGER NOT NULL,
  addressee_id  INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',   -- pending | accepted | declined
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  responded_at  TEXT,
  UNIQUE(requester_id, addressee_id),
  FOREIGN KEY (requester_id) REFERENCES users(id),
  FOREIGN KEY (addressee_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_friend_addr ON friendships(addressee_id, status);
CREATE INDEX IF NOT EXISTS idx_friend_req  ON friendships(requester_id, status);

-- A battle. Ammo + pet levels are snapshotted when the challenge is accepted
-- so later study (or feeding) can't change a fight already in progress.
CREATE TABLE IF NOT EXISTS battles (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  challenger_id    INTEGER NOT NULL,
  opponent_id      INTEGER NOT NULL,
  status           TEXT NOT NULL,          -- invited | active | done | declined | expired
  seed             INTEGER NOT NULL,
  challenger_ammo  INTEGER DEFAULT 0,
  opponent_ammo    INTEGER DEFAULT 0,
  challenger_level INTEGER DEFAULT 1,
  opponent_level   INTEGER DEFAULT 1,
  challenger_stage TEXT DEFAULT 'chihuahua',
  opponent_stage   TEXT DEFAULT 'chihuahua',
  challenger_name  TEXT,
  opponent_name    TEXT,
  challenger_hp    INTEGER DEFAULT 100,
  opponent_hp      INTEGER DEFAULT 100,
  turn_no          INTEGER DEFAULT 0,
  turn_user_id     INTEGER,
  turn_started_at  INTEGER,                -- ms epoch
  winner_id        INTEGER,
  created_at       INTEGER NOT NULL,       -- ms epoch
  expires_at       INTEGER,                -- ms epoch (invite window)
  finished_at      INTEGER,
  FOREIGN KEY (challenger_id) REFERENCES users(id),
  FOREIGN KEY (opponent_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_battles_challenger ON battles(challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_battles_opponent   ON battles(opponent_id, status);

-- One row per fired (or skipped) turn; the opponent polls these and replays
-- the shot locally with identical deterministic physics.
CREATE TABLE IF NOT EXISTS battle_turns (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  battle_id  INTEGER NOT NULL,
  turn_no    INTEGER NOT NULL,
  user_id    INTEGER NOT NULL,
  angle      REAL,
  power      REAL,
  shots      INTEGER DEFAULT 0,            -- 0 = skipped turn
  damage     INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  UNIQUE(battle_id, turn_no),
  FOREIGN KEY (battle_id) REFERENCES battles(id)
);
CREATE INDEX IF NOT EXISTS idx_turns_battle ON battle_turns(battle_id, turn_no);
