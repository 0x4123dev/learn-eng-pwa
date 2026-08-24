-- Skill-level analytics for the admin dashboard.
-- Deliberately stores one summary per completed session × skill instead of a
-- row for every answer. The unique key makes offline re-sync idempotent.
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
