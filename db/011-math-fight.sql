-- 011-math-fight.sql — Đấu Toán: friend-vs-friend arithmetic duels.
--
-- Two children race through 20 sums in 5 minutes for a flat 200-coin prize.
-- The server owns every decision: it issues the seed, decides each side's
-- difficulty rung, marks the answers and names the winner.
--
-- Apply BEFORE deploying the code that reads it:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/011-math-fight.sql

-- One duel. The snapshot is immutable: seed + both rungs are fixed when the
-- challenge is sent, so any result can be rebuilt from the row alone.
CREATE TABLE IF NOT EXISTS math_fights (
  id               TEXT PRIMARY KEY,
  challenger_id    INTEGER NOT NULL REFERENCES users(id),
  opponent_id      INTEGER NOT NULL REFERENCES users(id),
  prize            INTEGER NOT NULL,          -- flat, from MF.PRIZE
  seed             INTEGER NOT NULL,
  challenger_level INTEGER NOT NULL,          -- fight rung, handicap included
  opponent_level   INTEGER NOT NULL,
  status           TEXT NOT NULL,             -- invited | active | done | declined | expired
  created_at       INTEGER NOT NULL,
  expires_at       INTEGER NOT NULL,          -- invite window (60s)
  started_at       INTEGER,                   -- both sides in
  deadline_at      INTEGER,                   -- started_at + 300s
  finished_at      INTEGER,
  -- Scores are ALWAYS computed by the server from the latest answers array a
  -- side sent (heartbeat or submit). A client never reports a count.
  c_answers_json   TEXT, c_correct INTEGER, c_answered INTEGER NOT NULL DEFAULT 0,
  o_answers_json   TEXT, o_correct INTEGER, o_answered INTEGER NOT NULL DEFAULT 0,
  -- submitted_at means "done"; beat_at is the 5-second pulse that tells a
  -- walked-away player from one who is still thinking.
  c_submitted_at   INTEGER, c_beat_at INTEGER,
  o_submitted_at   INTEGER, o_beat_at INTEGER,
  winner_id        INTEGER,                   -- NULL on a draw
  outcome          TEXT                       -- win | draw | forfeit
);
CREATE INDEX IF NOT EXISTS idx_math_fights_challenger ON math_fights(challenger_id, status);
CREATE INDEX IF NOT EXISTS idx_math_fights_opponent   ON math_fights(opponent_id, status);

-- The silent handicap and the 3-day cooldown for ONE pair of children. The
-- key is the sorted id pair, so a fight started from either side reads and
-- writes the same row.
CREATE TABLE IF NOT EXISTS math_fight_pairs (
  lo_id         INTEGER NOT NULL REFERENCES users(id),
  hi_id         INTEGER NOT NULL REFERENCES users(id),
  leader_id     INTEGER,                     -- who is on a winning streak; NULL = level ground
  streak        INTEGER NOT NULL DEFAULT 0,  -- 0..4, two rungs of handicap each
  next_ready_at INTEGER,                     -- ms epoch; this pair may fight again after it
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (lo_id, hi_id)
);

-- Đấu Toán ships hidden behind ONE switch for the whole app: off means nobody
-- sees it, on means everybody does. Deliberately not a per-child column —
-- a duel needs two children, so a per-child switch would mostly produce
-- friend lists where nobody can be challenged.
CREATE TABLE IF NOT EXISTS app_flags (
  key        TEXT PRIMARY KEY,
  value      INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT 0,
  updated_by INTEGER
);
INSERT OR IGNORE INTO app_flags(key, value, updated_at) VALUES ('math_fight', 0, 0);
