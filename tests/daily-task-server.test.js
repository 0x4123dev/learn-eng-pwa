// Daily task server paths — handlers are EXECUTED against a real SQLite DB
// (tests/pages-harness.js), never substring-checked.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');
const fs = require('fs');
const path = require('path');
const { createD1 } = require('./d1-mock');

const ROOT = path.join(__dirname, '..');

suite('daily task: schema', () => {
  test('a DB built from schema.sql has the daily task tables and users.night_shields', () => {
    const world = createWorld();
    const cols = world.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    assert.contains(cols, 'night_shields');
    const tables = world.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert.contains(tables, 'daily_tasks');
    assert.contains(tables, 'daily_task_rewards');
    assert.equal(world.db.prepare('SELECT night_shields FROM users LIMIT 1').get(), undefined, 'empty users table reads without error');
  });

  test('db/018 applies cleanly to a pre-018 database', () => {
    const { db } = createD1();
    db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE);");
    db.prepare("INSERT INTO users (username) VALUES ('kid1')").run(); // id=1, satisfies the FK below
    db.exec(fs.readFileSync(path.join(ROOT, 'db/018-daily-tasks.sql'), 'utf8'));
    const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    assert.contains(cols, 'night_shields');
    db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (1, '2026-09-02', 200, 1)").run();
    assert.throws(() => db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (1, '2026-09-02', 200, 1)").run(),
      'one reward row per (user, day)');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
