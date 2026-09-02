-- 018-daily-tasks.sql — admin-assigned daily tasks, the once-a-day reward
-- that completing them earns, and the child's Night Raid shield inventory.
--
-- Progress is never stored: it is counted from `activities` on read, so a
-- task's definition (kind + match rule) is all a row needs. A task repeats
-- every GMT+7 day until an admin switches it off (active = 0).
--
-- Apply BEFORE deploying the code that reads it:
--   npx wrangler@3 d1 execute eng_pwa_db --remote --file db/018-daily-tasks.sql

CREATE TABLE IF NOT EXISTS daily_tasks (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id),
  kind          TEXT NOT NULL,          -- catalog key, e.g. 'units:hk1-mix'
  label         TEXT NOT NULL,          -- display label, copied from the catalog at creation
  target        INTEGER NOT NULL,       -- sessions at 100% required per day (1..50)
  activity_type TEXT NOT NULL,          -- activities.type the session must have
  match_json    TEXT NOT NULL,          -- catalog match rule (see functions/api/_daily-task.js)
  created_by    INTEGER NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  active        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user ON daily_tasks(user_id, active);

-- One row = the reward for one GMT+7 day, already granted. The primary key is
-- the lock that makes "200 xu + 1 shield, once a day" true under concurrent
-- requests: only the request whose INSERT lands pays out.
CREATE TABLE IF NOT EXISTS daily_task_rewards (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  task_date  TEXT NOT NULL,             -- 'YYYY-MM-DD' in GMT+7 (nightDate())
  coins      INTEGER NOT NULL,
  shields    INTEGER NOT NULL,
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, task_date)
);

-- Night Raid shield inventory. On users, not night_raid_homes: a child can
-- earn a shield before they have ever opened Cướp Đêm (no home row yet).
ALTER TABLE users ADD COLUMN night_shields INTEGER NOT NULL DEFAULT 0;
