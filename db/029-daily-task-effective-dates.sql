-- Keep the end of an assignment so delayed activity sync can be judged by
-- the tasks that were actually in force on that ICT calendar day.
ALTER TABLE daily_tasks ADD COLUMN ended_at TEXT;

-- Rows already inactive when this migration lands cannot reveal their exact
-- historical end. Recording migration time is conservative and keeps their
-- earlier effective days recoverable.
UPDATE daily_tasks SET ended_at = datetime('now') WHERE active = 0 AND ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_tasks_effective
  ON daily_tasks(user_id, created_at, ended_at);
