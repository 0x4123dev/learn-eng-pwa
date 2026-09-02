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

function core() { return loadModule('functions/api/_daily-task.js'); }

// 17:00 UTC on 2026-09-02 = 00:00 GMT+7 on 2026-09-03. Pick 10:00 UTC on
// 2026-09-02 = 17:00 GMT+7 on 2026-09-02 as "now".
const NOW = Date.UTC(2026, 8, 2, 10, 0, 0);

function addTask(world, uid, kind, target) {
  const spec = core().taskSpec(kind);
  return Number(world.db.prepare(
    'INSERT INTO daily_tasks (user_id, kind, label, target, activity_type, match_json, created_by) VALUES (?,?,?,?,?,?,1)'
  ).run(uid, spec.kind, spec.label, target, spec.activityType, spec.matchJson).lastInsertRowid);
}
function addActivity(world, uid, o) {
  world.db.prepare(
    'INSERT INTO activities (user_id, type, title, score, total, detail_json, created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(uid, o.type, o.title || '', o.score, o.total, o.detail ? JSON.stringify(o.detail) : null,
    o.at || '2026-09-02 09:00:00');
}
function rewards(world, uid) {
  return world.db.prepare('SELECT * FROM daily_task_rewards WHERE user_id=? ORDER BY task_date').all(uid);
}
function shields(world, uid) {
  return world.db.prepare('SELECT night_shields FROM users WHERE id=?').get(uid).night_shields;
}
function grants(world, uid) {
  return world.db.prepare('SELECT amount, note, claimed_at FROM coin_grants WHERE user_id=?').all(uid);
}

suite('daily task core: day window and task spec', () => {
  test('dayWindowUtc covers one GMT+7 day', () => {
    const w = core().dayWindowUtc(NOW);
    assert.equal(w.date, '2026-09-02');
    assert.equal(w.startUtc, '2026-09-01 17:00:00');
    assert.equal(w.endUtc, '2026-09-02 17:00:00');
  });
  test('taskSpec comes from the catalog; unknown kind is null', () => {
    const s = core().taskSpec('units:hk1-mix');
    assert.equal(s.activityType, 'lesson');
    assert.equal(s.label, 'Units HK1 · 🎲 Mix');
    assert.deepEqual(JSON.parse(s.matchJson), { titleExact: 'Unit hk1-mix words practice' });
    assert.equal(core().taskSpec('bogus'), null);
  });
});

suite('daily task core: counting sessions at 100%', () => {
  test('title prefix: 20/20 counts, 19/20 does not, total 0 does not, other type does not', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'collocation', 2);
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20 });
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 19, total: 20, at: '2026-09-02 09:01:00' });
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (0 Qs)', score: 0, total: 0, at: '2026-09-02 09:02:00' });
    addActivity(world, kid.uid, { type: 'phrases', title: 'Collocation practice (20 Qs)', score: 20, total: 20, at: '2026-09-02 09:03:00' });
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks.length, 1);
    assert.equal(p.tasks[0].count, 1);
    assert.equal(p.tasks[0].done, false);
    assert.equal(p.allDone, false);
  });

  test('title exact: hk1-mix does not count for hk1-3 and vice versa', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'units:hk1-mix', 1);
    addActivity(world, kid.uid, { type: 'lesson', title: 'Unit hk1-3 words practice', score: 10, total: 10 });
    let p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].count, 0);
    addActivity(world, kid.uid, { type: 'lesson', title: 'Unit hk1-mix words practice', score: 10, total: 10, at: '2026-09-02 09:05:00' });
    p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].count, 1);
    assert.equal(p.allDone, true);
  });

  test('detail equals: grammar unitId; detail prefix: any HK1 exam; chapter drill excludes exams', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'grammar:unit12', 1);
    addTask(world, kid.uid, 'math-exam:any-hk1', 1);
    addTask(world, kid.uid, 'math-chapter:2', 1);
    addActivity(world, kid.uid, { type: 'grammar', title: 'Grammar: Unit 3: Places', score: 20, total: 20, detail: { unitId: 'unit3' } });
    addActivity(world, kid.uid, { type: 'grammar', title: 'Grammar: Unit 12: Tenses', score: 20, total: 20, detail: { unitId: 'unit12' }, at: '2026-09-02 09:01:00' });
    addActivity(world, kid.uid, { type: 'math', title: 'Toán 7 · Đề thi: HK1 3', score: 17, total: 17, detail: { examId: 'hk1-source-3', chapter: 0 }, at: '2026-09-02 09:02:00' });
    addActivity(world, kid.uid, { type: 'math', title: 'Toán 7 · Chương 2 · Số thực', score: 10, total: 10, detail: { chapter: 2 }, at: '2026-09-02 09:03:00' });
    addActivity(world, kid.uid, { type: 'math', title: 'Toán 7 · Đề thi: HK1 Exam 2', score: 25, total: 25, detail: { examId: 'hk1-exam2', chapter: 2 }, at: '2026-09-02 09:04:00' });
    const p = await core().progress(world.env, kid.uid, NOW);
    const byKind = Object.fromEntries(p.tasks.map(t => [t.kind, t.count]));
    assert.equal(byKind['grammar:unit12'], 1);
    assert.equal(byKind['math-exam:any-hk1'], 2, 'both hk1-source-3 and hk1-exam2 are HK1 exams');
    assert.equal(byKind['math-chapter:2'], 1, 'the exam with chapter 2 in detail is NOT a chapter drill');
    assert.equal(p.allDone, true);
  });

  test('GMT+7 day boundary: 23:59 counts, 00:01 next day does not, yesterday does not', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 3);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: '2026-09-02 16:59:00' });
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: '2026-09-02 17:01:00' });
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: '2026-09-01 16:59:00' });
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: '2026-09-01 17:00:00' });
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].count, 2, '16:59 UTC today and 17:00 UTC yesterday are both 2026-09-02 in GMT+7');
  });

  test('a LIKE wildcard in a title prefix is escaped', async () => {
    const m = core().matchSql({ titlePrefix: 'Phrases 100% practice_' });
    assert.equal(m.binds[0], 'Phrases 100\\% practice\\_%');
  });

  test('matchSql degrades structurally odd rules to \'0\' instead of throwing or binding undefined', () => {
    assert.equal(core().matchSql({ detail: { field: 'chapter' } }).sql, '0');
    assert.equal(core().matchSql({ detail: { field: '...', value: 1 } }).sql, '0');
    assert.equal(core().matchSql({ noField: '...' }).sql, '0');
  });

  test('a structurally odd match_json never throws; progress just counts zero', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    world.db.prepare(
      'INSERT INTO daily_tasks (user_id, kind, label, target, activity_type, match_json, created_by) VALUES (?,?,?,?,?,?,1)'
    ).run(kid.uid, 'odd', 'Odd task', 1, 'math', '{"detail":{"field":"chapter"}}');
    addActivity(world, kid.uid, { type: 'math', title: 'Toán 7 · Chương 2 · Số thực', score: 10, total: 10, detail: { chapter: 2 } });
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks.length, 1);
    assert.equal(p.tasks[0].count, 0);
  });

  test('no tasks → empty list, never allDone; inactive tasks are ignored', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    let p = await core().progress(world.env, kid.uid, NOW);
    assert.deepEqual(p.tasks, []);
    assert.equal(p.allDone, false);
    const id = addTask(world, kid.uid, 'phrases', 1);
    world.db.prepare('UPDATE daily_tasks SET active=0 WHERE id=?').run(id);
    p = await core().progress(world.env, kid.uid, NOW);
    assert.deepEqual(p.tasks, []);
  });
});

suite('daily task core: the once-a-day reward', () => {
  test('not all done → nothing granted', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    addTask(world, kid.uid, 'collocation', 1);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20 });
    const e = await core().evaluate(world.env, kid.uid, NOW);
    assert.equal(e.allDone, false);
    assert.equal(e.justRewarded, false);
    assert.equal(e.rewardedToday, false);
    assert.equal(rewards(world, kid.uid).length, 0);
    assert.equal(shields(world, kid.uid), 0);
  });

  test('all done → one reward row, one 200-coin grant, +1 shield; repeated calls stay at one', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    addTask(world, kid.uid, 'collocation', 1);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20 });
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, at: '2026-09-02 09:01:00' });
    const first = await core().evaluate(world.env, kid.uid, NOW);
    assert.equal(first.allDone, true);
    assert.equal(first.justRewarded, true);
    assert.equal(first.rewardedToday, true);
    const second = await core().evaluate(world.env, kid.uid, NOW + 60000);
    assert.equal(second.justRewarded, false);
    assert.equal(second.rewardedToday, true);
    assert.equal(rewards(world, kid.uid).length, 1);
    assert.deepEqual(rewards(world, kid.uid).map(r => [r.task_date, r.coins, r.shields]), [['2026-09-02', 200, 1]]);
    const g = grants(world, kid.uid);
    assert.equal(g.length, 1);
    assert.equal(g[0].amount, 200);
    assert.equal(g[0].note, 'Daily task 2026-09-02');
    assert.equal(g[0].claimed_at, null, 'paid out by the normal /api/coins claim, not here');
    assert.equal(shields(world, kid.uid), 1);
  });

  test('the next day starts from zero and can be rewarded again', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20 });
    await core().evaluate(world.env, kid.uid, NOW);
    const tomorrow = NOW + 24 * 3600000;
    let e = await core().evaluate(world.env, kid.uid, tomorrow);
    assert.equal(e.tasks[0].count, 0);
    assert.equal(e.rewardedToday, false);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: '2026-09-03 09:00:00' });
    e = await core().evaluate(world.env, kid.uid, tomorrow);
    assert.equal(e.justRewarded, true);
    assert.equal(rewards(world, kid.uid).length, 2);
    assert.equal(shields(world, kid.uid), 2);
  });

  test('the child then claims the 200 coins through POST /api/coins', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20 });
    await core().evaluate(world.env, kid.uid, NOW);
    const r = await world.call(loadModule('functions/api/coins.js').onRequestPost, { token: kid.token, body: { proto: 2 } });
    assert.equal(r.status, 200);
    assert.equal(r.data.granted, 200);
  });

  test('a replayed batch against a claimed day grants nothing', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20 });
    await core().evaluate(world.env, kid.uid, NOW);
    const real = world.env.DB.prepare.bind(world.env.DB);
    const blind = Object.create(world.env.DB);
    blind.prepare = sql => /FROM daily_task_rewards/.test(sql)
      ? { bind: () => ({ first: async () => null }) } : real(sql);
    blind.batch = world.env.DB.batch.bind(world.env.DB);
    const loser = await core().evaluate({ DB: blind }, kid.uid, NOW);
    assert.equal(loser.justRewarded, false);
    assert.equal(rewards(world, kid.uid).length, 1);
    assert.equal(grants(world, kid.uid).length, 1);
    assert.equal(shields(world, kid.uid), 1);
  });

  test('shieldStatus reports inventory and an active shield only while it is active', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    let s = await core().shieldStatus(world.env, kid.uid, NOW);
    assert.deepEqual(s, { count: 0, activeUntil: 0 });
    world.db.prepare('UPDATE users SET night_shields=2 WHERE id=?').run(kid.uid);
    world.db.prepare("INSERT INTO night_raid_homes (user_id, shield_until, updated_at) VALUES (?,?,?)").run(kid.uid, NOW + 1000, NOW);
    s = await core().shieldStatus(world.env, kid.uid, NOW);
    assert.deepEqual(s, { count: 2, activeUntil: NOW + 1000 });
    s = await core().shieldStatus(world.env, kid.uid, NOW + 2000);
    assert.deepEqual(s, { count: 2, activeUntil: 0 });
  });
});

function meHandler() { return loadModule('functions/api/me/daily-tasks.js'); }
function activityHandler() { return loadModule('functions/api/activity.js'); }

suite('daily task: GET /api/me/daily-tasks and the /api/activity hook', () => {
  test('needs a token; returns empty tasks for a child with nothing assigned', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const anon = await world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET' });
    assert.equal(anon.status, 401);
    const r = await world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET', token: kid.token });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.tasks, []);
    assert.equal(r.data.allDone, false);
    assert.deepEqual(r.data.shields, { count: 0, activeUntil: 0 });
  });

  test('a synced 100% session moves the counter and pays the reward inside the activity POST', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'collocation', 1);
    const at = Date.now();
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token,
      body: { items: [{ type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, at }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    assert.deepEqual(r.data.dailyTask, { allDone: true, justRewarded: true, rewardedToday: true });
    assert.equal(rewards(world, kid.uid).length, 1);
    assert.equal(shields(world, kid.uid), 1);
    const me = await world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET', token: kid.token });
    assert.equal(me.data.tasks[0].count, 1);
    assert.equal(me.data.tasks[0].done, true);
    assert.equal(me.data.rewardedToday, true);
    assert.equal(me.data.justRewarded, false, 'already paid by the activity POST');
    assert.equal(me.data.shields.count, 1);
  });

  test('the single-item activity POST also evaluates', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token, body: { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20 },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.dailyTask.justRewarded, true);
  });

  test('a broken daily_tasks row cannot fail the sync', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    world.db.prepare(
      "INSERT INTO daily_tasks (user_id, kind, label, target, activity_type, match_json, created_by) VALUES (?,?,?,?,?,?,1)"
    ).run(kid.uid, 'x', 'x', 1, 'phrases', '{"detail":{"field":"a\\"b'  /* not JSON */);
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token, body: { items: [{ type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: Date.now() }] },
    });
    assert.equal(r.status, 200, 'activity sync must succeed even if evaluation cannot');
    assert.equal(r.data.ok, true);
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
