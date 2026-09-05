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
    assert.contains(tables, 'farm_seed_days');
    assert.contains(tables, 'farm_seed_inventory');
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

  test('daily-task and farm-seed migrations match db/schema.sql', () => {
    const ddl = (files, setup) => {
      const { db } = createD1();
      if (setup) db.exec(setup);
      for (const f of files) db.exec(fs.readFileSync(path.join(ROOT, f), 'utf8'));
      return db.prepare("SELECT name, sql FROM sqlite_master WHERE name LIKE 'daily_task%' OR name LIKE 'idx_daily%' OR name LIKE 'farm_seed%' OR name LIKE 'idx_farm_seed%' ORDER BY name")
        .all().map(r => r.name + '::' + String(r.sql).replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').replace(/\s+,/g, ',').replace(/\s+\)/g, ')').trim()).join('\n');
    };
    assert.equal(
      ddl(['db/018-daily-tasks.sql', 'db/019-armory-swords.sql', 'db/028-farm-seed-rewards.sql', 'db/029-daily-task-effective-dates.sql'], 'CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT);'),
      ddl(['db/schema.sql']),
      'the migrations and the canonical schema must not drift');
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

  test('a task set on one button is not satisfied by the other button', async () => {
    // The screen count in the title cannot tell the buttons apart — a
    // 10-question Phrases practice records "(20 Qs)" and a 20-question one
    // "(40 Qs)", while Word form records 30, 31 or 32 for the SAME button. So
    // the size travels as detail.qs and the match pins it.
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases:20', 1);
    // The child did the 10-question one, perfectly. It must not count.
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)',
      score: 20, total: 20, detail: { qs: 10 } });
    let p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].count, 0, 'a 10-question session satisfied a 20-question task');
    // A session from before lengths were recorded carries no qs, so it cannot
    // be claimed for either button.
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (40 Qs)',
      score: 40, total: 40, at: '2026-09-02 09:01:00' });
    p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].count, 0, 'an untagged old session must not count for a sized task');
    // The real thing.
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (40 Qs)',
      score: 40, total: 40, detail: { qs: 20 }, at: '2026-09-02 09:02:00' });
    p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].count, 1);
    assert.equal(p.allDone, true);
  });

  test('the size-agnostic task still counts either button', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 2);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)',
      score: 20, total: 20, detail: { qs: 10 } });
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (40 Qs)',
      score: 40, total: 40, detail: { qs: 20 }, at: '2026-09-02 09:01:00' });
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].count, 2);
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

  test('Toán 4 counts for its own task and for no Toán 7 task', async () => {
    // The two môn share the 'math' activity type and the same history array.
    // What tells them apart in SQL is detail.g4set — and detail.chapter, which
    // for a Toán 4 paper is the string 'g4-pre' and can equal no chapter
    // number. Both directions are checked here: a Toán 4 paper must not pay
    // off a Toán 7 task, and a Toán 7 round must not pay off the Toán 4 one.
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'math4:pre', 1);
    addTask(world, kid.uid, 'math-chapter:2', 1);
    addTask(world, kid.uid, 'math-exam:any-hk1', 1);
    addActivity(world, kid.uid, { type: 'math', title: 'Toán 4 · Đề ôn Pre', score: 10, total: 10,
      detail: { grade: 4, g4set: 'pre', chapter: 'g4-pre' }, at: '2026-09-02 09:01:00' });
    addActivity(world, kid.uid, { type: 'math', title: 'Toán 7 · Chương 2 · Số thực', score: 10, total: 10,
      detail: { chapter: 2 }, at: '2026-09-02 09:02:00' });
    const p = await core().progress(world.env, kid.uid, NOW);
    const byKind = Object.fromEntries(p.tasks.map(t => [t.kind, t.count]));
    assert.equal(byKind['math4:pre'], 1, 'the Toán 4 paper did not count for its own task');
    assert.equal(byKind['math-chapter:2'], 1, 'only the Toán 7 round may count here');
    assert.equal(byKind['math-exam:any-hk1'], 0, 'neither run is an HK1 exam');
  });

  test('an unfinished Toán 4 paper pays nothing — the task wants a clean sheet', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'math4:pre', 1);
    addActivity(world, kid.uid, { type: 'math', title: 'Toán 4 · Đề ôn Pre', score: 9, total: 10,
      detail: { grade: 4, g4set: 'pre', chapter: 'g4-pre' } });
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].count, 0);
    assert.equal(p.allDone, false);
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

  test('all done → one reward row (unclaimed), one 200-coin grant, NO shield yet; repeated calls stay at one', async () => {
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
    assert.equal(rewards(world, kid.uid)[0].claimed_kind, null, 'the pick waits for the child (db/019)');
    const g = grants(world, kid.uid);
    assert.equal(g.length, 1);
    assert.equal(g[0].amount, 200);
    assert.equal(g[0].note, 'Daily task 2026-09-02');
    assert.equal(g[0].claimed_at, null, 'paid out by the normal /api/coins claim, not here');
    assert.equal(shields(world, kid.uid), 0, 'the shield is no longer auto-granted: it is one of two things the child may claim');
    assert.deepEqual(await core().pendingRewards(world.env, kid.uid), ['2026-09-02']);
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
    assert.equal(shields(world, kid.uid), 0);
    assert.deepEqual(await core().pendingRewards(world.env, kid.uid), ['2026-09-02', '2026-09-03'], 'unclaimed days pile up, oldest first, and never expire');
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
    assert.equal(shields(world, kid.uid), 0);
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
    assert.equal(shields(world, kid.uid), 0, 'no shield until the child claims one');
    const me = await world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET', token: kid.token });
    assert.equal(me.data.tasks[0].count, 1);
    assert.equal(me.data.tasks[0].done, true);
    assert.equal(me.data.rewardedToday, true);
    assert.equal(me.data.justRewarded, false, 'already paid by the activity POST');
    assert.equal(me.data.shields.count, 0);
    assert.deepEqual(me.data.swords, { count: 0 });
    assert.deepEqual(me.data.pending, [me.data.date], 'the day is offered to the child to claim');
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

  test('offline sync backfills each affected ICT day once, including the seed earned across two days', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const spec = core().taskSpec('phrases');
    const today = core().dayWindowUtc(Date.now()).date;
    const todayStart = Date.parse(today + 'T00:00:00Z') - 7 * 3600000;
    const firstAt = todayStart - 2 * 86400000 + 3600000;
    const secondAt = firstAt + 86400000;
    const assignedAt = new Date(firstAt - 86400000).toISOString().replace('T', ' ').slice(0, 19);
    world.db.prepare(`INSERT INTO daily_tasks
      (user_id,kind,label,target,activity_type,match_json,created_by,created_at,active)
      VALUES(?,?,?,?,?,?,1,?,1)`).run(kid.uid,spec.kind,spec.label,1,spec.activityType,spec.matchJson,assignedAt);
    const body={items:[
      {type:'phrases',title:'Phrases practice (20 Qs)',score:20,total:20,at:firstAt},
      {type:'phrases',title:'Phrases practice (20 Qs)',score:20,total:20,at:secondAt},
    ]};
    const first=await world.call(activityHandler().onRequestPost,{token:kid.token,body});
    assert.truthy(first.ok,JSON.stringify(first.data));
    assert.equal(rewards(world,kid.uid).length,2,'both historical days are rewarded');
    assert.equal(grants(world,kid.uid).length,2,'each day has one coin grant');
    assert.equal(world.db.prepare('SELECT COALESCE(SUM(quantity),0) AS n FROM farm_seed_inventory WHERE user_id=?').get(kid.uid).n,1,'two consecutive days award one seed');
    await world.call(activityHandler().onRequestPost,{token:kid.token,body});
    assert.equal(rewards(world,kid.uid).length,2,'re-sync creates no reward twice');
    assert.equal(grants(world,kid.uid).length,2,'re-sync creates no grant twice');
    assert.equal(world.db.prepare('SELECT COALESCE(SUM(quantity),0) AS n FROM farm_seed_inventory WHERE user_id=?').get(kid.uid).n,1,'re-sync creates no seed twice');
  });

  test('a broken match_json counts nothing and does not fail the sync', async () => {
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

  test('an evaluation that throws cannot fail the sync', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    const real = world.env.DB;
    world.env.DB = {
      prepare: sql => { if (/FROM daily_tasks/.test(sql)) throw new Error('D1 down'); return real.prepare(sql); },
      batch: s => real.batch(s),
    };
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token,
      body: { items: [{ type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: Date.now() }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    assert.equal(r.data.dailyTask, null, 'a failed evaluation is reported as unknown, not as "no tasks"');
    assert.equal(world.db.prepare('SELECT COUNT(*) n FROM activities WHERE user_id=?').get(kid.uid).n, 1, 'the activity itself still landed');
  });

  test('a balance-only sync (items: []) skips evaluation but still snapshots the balance', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token, body: { items: [], coinBalance: 4200 },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    assert.equal(r.data.count, 0);
    assert.equal(r.data.dailyTask, null, 'nothing new landed, so progress could not have moved');
    const snap = world.db.prepare('SELECT balance FROM user_coin_snapshots WHERE user_id=?').get(kid.uid);
    assert.equal(snap.balance, 4200);
  });
});

function shieldHandler() { return loadModule('functions/api/night-raid/shield.js'); }
function homeHandler() { return loadModule('functions/api/night-raid/home.js'); }
const NR = loadModule('js/night-raid-rules.js');

function farmLayout() {
  return NR.normalizeLayout({ cells: [{ type: 'rice-field', lane: 0, col: 1, gx: 0, gy: 0, tier: 1, uid: 'p-testfarm01', readyAt: Date.now() + 3600000 }], soldiers: 2, dogLane: 2 });
}
// `coins` is unused by the shield tests below but kept: Task 6's raid tests
// seed homes with specific coin/vault amounts (800 lootable, 50 vault) to
// assert on what a raider can steal.
async function seedHome(world, user, coins) {
  const r = await world.call(homeHandler().onRequestPut, {
    url: '/api/night-raid/home', method: 'PUT', token: user.token,
    body: { layout: farmLayout(), dogLevel: 7, castleSkin: 'royal-keep', coins: coins == null ? 800 : coins, vaultCoins: 40 },
  });
  assert.truthy(r.ok, 'seeding the home must succeed: ' + JSON.stringify(r.data));
}
function homeRow(world, uid) { return world.db.prepare('SELECT * FROM night_raid_homes WHERE user_id=?').get(uid); }

suite('daily task: POST /api/night-raid/shield', () => {
  test('no home yet → 404 no_home, inventory untouched', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    world.db.prepare('UPDATE users SET night_shields=1 WHERE id=?').run(kid.uid);
    const r = await world.call(shieldHandler().onRequestPost, { token: kid.token, body: {} });
    assert.equal(r.status, 404);
    assert.equal(r.data.code, 'no_home');
    assert.equal(shields(world, kid.uid), 1);
  });

  test('no shields → 409 empty', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await seedHome(world, kid);
    const r = await world.call(shieldHandler().onRequestPost, { token: kid.token, body: {} });
    assert.equal(r.status, 409);
    assert.equal(r.data.code, 'empty');
  });

  test('spends one shield and protects the home for 24 h; a second press is refused and costs nothing', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await seedHome(world, kid);
    world.db.prepare('UPDATE users SET night_shields=2 WHERE id=?').run(kid.uid);
    const before = Date.now();
    const r = await world.call(shieldHandler().onRequestPost, { token: kid.token, body: {} });
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    assert.equal(r.data.shields.count, 1);
    const until = homeRow(world, kid.uid).shield_until;
    assert.inRange(until - before, 24 * 3600000 - 5000, 24 * 3600000 + 5000);
    assert.equal(r.data.shields.activeUntil, until);
    const again = await world.call(shieldHandler().onRequestPost, { token: kid.token, body: {} });
    assert.equal(again.status, 409);
    assert.equal(again.data.code, 'active');
    assert.equal(again.data.activeUntil, until);
    assert.equal(shields(world, kid.uid), 1, 'a refused activation does not burn a shield');
  });

  test('an expired shield can be replaced', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await seedHome(world, kid);
    world.db.prepare('UPDATE users SET night_shields=1 WHERE id=?').run(kid.uid);
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(Date.now() - 1000, kid.uid);
    const r = await world.call(shieldHandler().onRequestPost, { token: kid.token, body: {} });
    assert.equal(r.status, 200);
    assert.truthy(homeRow(world, kid.uid).shield_until > Date.now());
  });

  test('a child without allow_bot can still spend a shield on an existing home', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await seedHome(world, kid);
    world.db.prepare('UPDATE users SET night_shields=1, allow_bot=0 WHERE id=?').run(kid.uid);
    const r = await world.call(shieldHandler().onRequestPost, { token: kid.token, body: {} });
    assert.equal(r.status, 200, 'the shield inventory is the child\'s; allow_bot only gates raiding');
  });

  test('a disabled account is refused before it can touch the inventory', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await seedHome(world, kid);
    world.db.prepare('UPDATE users SET night_shields=1 WHERE id=?').run(kid.uid);
    world.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(kid.uid);
    const r = await world.call(shieldHandler().onRequestPost, { token: kid.token, body: {} });
    assert.equal(r.status, 401);
    assert.equal(shields(world, kid.uid), 1);
  });

  test('a race that beats the friendly pre-check is still caught by the batch guard', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await seedHome(world, kid);
    world.db.prepare('UPDATE users SET night_shields=2 WHERE id=?').run(kid.uid);
    const now = Date.now();
    const realUntil = now + 10 * 3600000;
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(realUntil, kid.uid);
    // A DB proxy that lies to the friendly pre-check (says no shield is up)
    // on the FIRST "SELECT shield_until" read only; every later read — inside
    // the batch and inside the shieldStatus() call on the error path — sees
    // the real, still-active row. batch() passes straight through to the
    // real DB, since it is the batch's own EXISTS guard, not the pre-check,
    // that must be the actual authority here.
    const real = world.env.DB;
    let shieldReads = 0;
    world.env.DB = {
      prepare: sql => {
        if (/SELECT shield_until FROM night_raid_homes/.test(sql)) {
          shieldReads++;
          if (shieldReads === 1) return { bind: () => ({ first: async () => ({ shield_until: 0 }) }) };
        }
        return real.prepare(sql);
      },
      batch: s => real.batch(s),
    };
    const r = await world.call(shieldHandler().onRequestPost, { token: kid.token, body: {} });
    assert.equal(r.status, 409);
    assert.equal(r.data.code, 'active');
    assert.equal(r.data.activeUntil, realUntil, 'the error reports the real timer, not the faked one');
    assert.equal(shields(world, kid.uid), 2, 'the batch guard refused the spend; nothing was burned');
    assert.equal(homeRow(world, kid.uid).shield_until, realUntil, 'the real timer was left untouched');
  });
});


function startHandler() { return loadModule('functions/api/night-raid/start.js'); }
function finishHandler() { return loadModule('functions/api/night-raid/finish.js'); }

async function raid(world, attacker, defender) {
  const s = await world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
  assert.truthy(s.ok && s.data && s.data.raid, 'start must create a raid: ' + JSON.stringify(s.data));
  const f = await world.call(finishHandler().onRequestPost, { token: attacker.token, body: { raidId: s.data.raid.raidId } });
  assert.truthy(f.ok && f.data && f.data.result, 'finish must resolve: ' + JSON.stringify(f.data));
  return { start: s.data.raid, result: f.data.result };
}

suite('daily task: raiding a shielded castle', () => {
  test('shielded target: the raid runs, the raider loses, pays 200, and the DEFENDER pockets it', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, 800);
    await seedHome(world, defender, 800);
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(Date.now() + 3600000, defender.uid);

    const { start, result } = await raid(world, attacker, defender);
    assert.equal(start.shielded, true);
    assert.equal(start.defense, 100000);
    assert.equal(result.won, false);
    assert.equal(result.shielded, true);
    assert.equal(result.loss, 200);
    assert.equal(result.reward, 0);
    assert.equal(result.defenderGain, 200, 'holding the wall now pays — db/021');
    assert.equal(homeRow(world, attacker.uid).lootable_coins, 600);
    assert.equal(homeRow(world, defender.uid).lootable_coins, 1000, 'the 200 moved, it was not burned');
    assert.equal(homeRow(world, defender.uid).ruined_until, null);
    const daily = world.db.prepare('SELECT tickets_used FROM night_raid_daily WHERE user_id=?').get(attacker.uid);
    assert.equal(daily.tickets_used, 1, 'the ticket is spent, not returned');
  });

  test('a raider with fewer than 200 coins is emptied, not driven negative', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, 50);
    await seedHome(world, defender, 800);
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(Date.now() + 3600000, defender.uid);
    const { result } = await raid(world, attacker, defender);
    // The fee is clamped to what the raider has, because the same coins are
    // handed to the defender: a broke attacker must not mint money (db/021).
    assert.equal(result.loss, 50, 'you can only lose what you have');
    assert.equal(homeRow(world, attacker.uid).lootable_coins, 0);
    assert.equal(homeRow(world, defender.uid).lootable_coins, 850, 'and the defender gains exactly that');
  });

  test('an unshielded (or expired-shield) target is raided by the normal rules', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, 800);
    await seedHome(world, defender, 800);
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(Date.now() - 1000, defender.uid);
    const { start, result } = await raid(world, attacker, defender);
    assert.falsy(start.shielded);
    assert.falsy(result.shielded);
    // Since db/021 the ordinary marching fee is the flat `loss` (100), not the
    // old 5%-of-the-wallet slice, and shield_loss (200) applies to shields only.
    assert.equal(result.won ? result.loss : 100, result.loss,
      'normal loss is 0 on a win or the flat 100 on a loss: ' + result.loss);
    assert.equal(result.loss, result.defenderGain, 'whatever it is, the defender gets it');
  });

  test('GET /api/night-raid/home reports the owner\'s own shieldUntil', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await seedHome(world, kid);
    const until = Date.now() + 3600000;
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(until, kid.uid);
    const r = await world.call(homeHandler().onRequestGet, { url: '/api/night-raid/home', method: 'GET', token: kid.token });
    assert.equal(r.status, 200);
    assert.equal(r.data.home.shieldUntil, until);
  });

  test('the rules cannot produce a win against a pinned defense of 100000', () => {
    for (const dmg of [1, 100000, 999999]) {
      const sim = NR.resolveAutoBattle({ defense: 100000, castleHp: 200, layout: { cells: [], dogLane: 2, soldiers: 0 }, dogLevel: 1, attackerDamage: dmg });
      assert.equal(sim.won, false, 'damage ' + dmg);
    }
  });

  test('raiding the same shielded home twice in one day is refused with 409', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, 800);
    await seedHome(world, defender, 800);
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(Date.now() + 3600000, defender.uid);
    await raid(world, attacker, defender);
    const again = await world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
    assert.equal(again.status, 409);
  });
});

function adminHandler() { return loadModule('functions/api/admin/daily-tasks.js'); }

suite('daily task: admin API', () => {
  test('a child cannot use the admin endpoints', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=' + kid.uid, method: 'GET', token: kid.token });
    assert.equal(g.status, 403);
    const p = await world.call(adminHandler().onRequestPost, { token: kid.token, body: { userId: kid.uid, kind: 'phrases', target: 5 } });
    assert.equal(p.status, 403);
    const d = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=1', method: 'DELETE', token: kid.token });
    assert.equal(d.status, 403);
  });

  test('create validates kind, target and user', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const post = body => world.call(adminHandler().onRequestPost, { token: admin.token, body });
    assert.equal((await post({ userId: kid.uid, kind: 'nope', target: 5 })).status, 400);
    assert.equal((await post({ userId: kid.uid, kind: 'phrases', target: 0 })).status, 400);
    assert.equal((await post({ userId: kid.uid, kind: 'phrases', target: 51 })).status, 400);
    assert.equal((await post({ userId: kid.uid, kind: 'phrases', target: 2.5 })).status, 400);
    assert.equal((await post({ userId: 9999, kind: 'phrases', target: 5 })).status, 404);
    assert.equal((await post({ userId: admin.uid, kind: 'phrases', target: 5 })).status, 400, 'admins are not learners');
    const ok = await post({ userId: kid.uid, kind: 'units:hk1-mix', target: 5 });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.task.kind, 'units:hk1-mix');
    assert.equal(ok.data.task.label, 'Units HK1 · 🎲 Mix');
    assert.equal(ok.data.task.target, 5);
    const row = world.db.prepare('SELECT * FROM daily_tasks WHERE id=?').get(ok.data.task.id);
    assert.equal(row.activity_type, 'lesson');
    assert.deepEqual(JSON.parse(row.match_json), { titleExact: 'Unit hk1-mix words practice' });
    assert.equal(row.created_by, admin.uid);
    const dup = await post({ userId: kid.uid, kind: 'units:hk1-mix', target: 3 });
    assert.equal(dup.status, 409, 'same active kind twice');
  });

  test('list shows today\'s progress, reward state and shields; delete deactivates', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const a = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'phrases', target: 1 } });
    const b = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'collocation', target: 2 } });
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: new Date().toISOString().replace('T', ' ').slice(0, 19) });
    let g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=' + kid.uid, method: 'GET', token: admin.token });
    assert.equal(g.status, 200);
    assert.equal(g.data.tasks.length, 2);
    const phr = g.data.tasks.find(t => t.id === a.data.task.id);
    assert.equal(phr.count, 1);
    assert.equal(phr.done, true);
    assert.truthy(phr.created_at);
    assert.equal(g.data.allDone, false);
    assert.equal(g.data.rewardedToday, false, 'the admin list never pays out');
    assert.equal(rewards(world, kid.uid).length, 0);
    assert.deepEqual(g.data.shields, { count: 0, activeUntil: 0 });

    const d = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=' + b.data.task.id, method: 'DELETE', token: admin.token });
    assert.equal(d.status, 200);
    g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=' + kid.uid, method: 'GET', token: admin.token });
    assert.equal(g.data.tasks.length, 1);
    assert.equal(g.data.allDone, true);
    const gone = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=' + b.data.task.id, method: 'DELETE', token: admin.token });
    assert.equal(gone.status, 404);
    const again = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'collocation', target: 3 } });
    assert.equal(again.status, 200, 'a deleted kind can be assigned again');
  });

  test('GET without a numeric user_id is a 400', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks', method: 'GET', token: admin.token });
    assert.equal(g.status, 400);
  });

  test('a child is capped at MAX_ACTIVE_TASKS active tasks', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const kinds = ['phrases', 'collocation', 'wordform', 'rewrite', 'verbs', 'vocab',
      'grammar:unit1', 'grammar:unit2', 'grammar:unit3', 'grammar:unit4'];
    let lastId;
    for (const kind of kinds) {
      const r = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind, target: 5 } });
      assert.equal(r.status, 200, kind);
      lastId = r.data.task.id;
    }
    const eleventh = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'grammar:unit5', target: 5 } });
    assert.equal(eleventh.status, 400);
    assert.equal(eleventh.data.code, 'too_many');
    await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=' + lastId, method: 'DELETE', token: admin.token });
    const again = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'grammar:unit5', target: 5 } });
    assert.equal(again.status, 200, 'freeing a slot lets the next create through');
  });

  test('a literal null body is a 400, not a 500', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const p = await world.call(adminHandler().onRequestPost, { token: admin.token, body: null });
    assert.equal(p.status, 400);
  });

  test('malformed JSON body is a 400', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const request = new Request('http://app.test/api/admin/daily-tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + admin.token },
      body: '{not valid json',
    });
    const res = await adminHandler().onRequestPost({ request, env: world.env });
    assert.equal(res.status, 400);
  });

  test('no token is 401 on GET, POST and DELETE', async () => {
    const world = createWorld();
    const g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=1', method: 'GET' });
    assert.equal(g.status, 401);
    const p = await world.call(adminHandler().onRequestPost, { body: { userId: 1, kind: 'phrases', target: 5 } });
    assert.equal(p.status, 401);
    const d = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=1', method: 'DELETE' });
    assert.equal(d.status, 401);
  });

  test('DELETE requires a numeric id', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const bad = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=abc', method: 'DELETE', token: admin.token });
    assert.equal(bad.status, 400);
    const missing = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks', method: 'DELETE', token: admin.token });
    assert.equal(missing.status, 400);
  });

  test('a numeric-string target ("5") is accepted like a number', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const r = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'phrases', target: '5' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.task.target, 5);
  });

  test('an admin can delete a task belonging to a different child', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid1 = await world.createUser({});
    const kid2 = await world.createUser({});
    await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid2.uid, kind: 'phrases', target: 1 } });
    const t = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid1.uid, kind: 'phrases', target: 1 } });
    const d = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=' + t.data.task.id, method: 'DELETE', token: admin.token });
    assert.equal(d.status, 200, 'no ownership check ties a task to whichever child was last queried');
  });
});
if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
