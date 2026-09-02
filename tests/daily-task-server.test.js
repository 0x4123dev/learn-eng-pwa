// Daily task server paths — handlers are EXECUTED against a real SQLite DB
// (tests/pages-harness.js), never substring-checked.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');
const fs = require('fs');
const path = require('path');
const { createD1 } = require('./d1-mock');

const ROOT = path.join(__dirname, '..');

suite('daily task: schema', () => {
  test('a DB built from schema.sql has the daily task tables and users.night_shields', async () => {
    const world = createWorld();
    const cols = world.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    assert.contains(cols, 'night_shields');
    const tables = world.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert.contains(tables, 'daily_tasks');
    assert.contains(tables, 'daily_task_rewards');
    const u = await world.createUser();
    assert.equal(
      world.db.prepare('SELECT night_shields FROM users WHERE id=?').get(u.uid).night_shields,
      0, 'a freshly created user starts with zero shields');
  });

  test('db/018 applies cleanly to a pre-018 database', () => {
    const { db } = createD1();
    db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE);");
    db.prepare("INSERT INTO users (username) VALUES ('kid1')").run(); // id=1, satisfies the FK below
    db.exec(fs.readFileSync(path.join(ROOT, 'db/018-daily-tasks.sql'), 'utf8'));
    const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    assert.contains(cols, 'night_shields');
    assert.equal(db.prepare('SELECT night_shields FROM users WHERE id=1').get().night_shields, 0,
      'an account that existed before 018 starts with zero shields');
    const objects = db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'daily_task%' OR name LIKE 'idx_daily%'")
      .all().map(r => r.name);
    assert.contains(objects, 'daily_tasks');
    assert.contains(objects, 'idx_daily_tasks_user');
    db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (1, '2026-09-02', 200, 1)").run();
    assert.throws(() => db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (1, '2026-09-02', 200, 1)").run(),
      'one reward row per (user, day)');
  });

  test('db/018 and db/schema.sql describe the same tables', () => {
    const ddl = (files, setup) => {
      const { db } = createD1();
      if (setup) db.exec(setup);
      for (const f of files) db.exec(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      return db.prepare("SELECT name, sql FROM sqlite_master WHERE name LIKE 'daily_task%' OR name LIKE 'idx_daily%' ORDER BY name")
        .all().map(r => r.name + '::' + String(r.sql).replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim()).join('\n');
    };
    assert.equal(
      ddl(['db/018-daily-tasks.sql'], 'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT);'),
      ddl(['db/schema.sql']),
      'the migration and the canonical schema must not drift');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
