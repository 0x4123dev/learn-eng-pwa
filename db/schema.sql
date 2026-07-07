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
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

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
