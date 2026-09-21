// Daily task server paths — handlers are EXECUTED against a real SQLite DB
// (tests/pages-harness.js), never substring-checked.
//
// Since the 2026-09 cut the catalog is the 48 Book tasks (word:prN-k /
// word:prN-mix, activity type 'lesson', matched by the exact title js/auth.js
// uploads) and the reward is 200 xu, nothing else — no shield, no sword, no
// pick to make later. The daily_task_rewards row is still written: it is the
// farm's day clock (functions/api/_farm.js counts them).
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');
const fs = require('fs');
const path = require('path');
const { createD1 } = require('./d1-mock');

const ROOT = path.join(__dirname, '..');

suite('daily task: schema', () => {
  test('a DB built from schema.sql has the daily task and farm seed tables', async () => {
    const world = createWorld();
    const tables = world.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(t => t.name);
    assert.contains(tables, 'daily_tasks');
    assert.contains(tables, 'daily_task_rewards');
    assert.contains(tables, 'farm_seed_days');
    assert.contains(tables, 'farm_seed_inventory');
  });

  test('db/018 applies cleanly to a pre-018 database', () => {
    const { db } = createD1();
    db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE);");
    db.prepare("INSERT INTO users (username) VALUES ('kid1')").run(); // id=1, satisfies the FK below
    db.exec(fs.readFileSync(path.join(ROOT, 'db/018-daily-tasks.sql'), 'utf8'));
    const objects = db.prepare("SELECT name FROM sqlite_master WHERE name LIKE 'daily_task%' OR name LIKE 'idx_daily%'")
      .all().map(r => r.name);
    assert.contains(objects, 'daily_tasks');
    assert.contains(objects, 'idx_daily_tasks_user');
    db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (1, '2026-09-02', 200, 0)").run();
    assert.throws(() => db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (1, '2026-09-02', 200, 0)").run(),
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

// The title js/auth.js uploads for a finished Book unit — the catalog's
// titleExact for word:<unitKey>.
function unitTitle(unitKey) { return 'Unit ' + unitKey + ' words practice'; }

function addTask(world, uid, kind, target) {
  const spec = core().taskSpec(kind);
  assert.truthy(spec, kind + ' is not in the catalog');
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
// A perfect Book unit session (the only thing a task can be completed by).
function addUnit(world, uid, unitKey, at, score, total) {
  addActivity(world, uid, { type: 'lesson', title: unitTitle(unitKey), score: score == null ? 10 : score, total: total == null ? 10 : total, at });
}
function rewards(world, uid) {
  return world.db.prepare('SELECT * FROM daily_task_rewards WHERE user_id=? ORDER BY task_date').all(uid);
}
function grants(world, uid) {
  return world.db.prepare('SELECT amount, note, claimed_at FROM coin_grants WHERE user_id=?').all(uid);
}
function userCols(world) { return world.db.prepare('PRAGMA table_info(users)').all().map(c => c.name); }
function userRow(world, uid) { return world.db.prepare('SELECT * FROM users WHERE id=?').get(uid); }

suite('daily task core: day window and task spec', () => {
  test('dayWindowUtc covers one GMT+7 day', () => {
    const w = core().dayWindowUtc(NOW);
    assert.equal(w.date, '2026-09-02');
    assert.equal(w.startUtc, '2026-09-01 17:00:00');
    assert.equal(w.endUtc, '2026-09-02 17:00:00');
  });
  test('taskSpec comes from the catalog; unknown and pre-cut kinds are null', () => {
    const s = core().taskSpec('word:pr1-mix');
    assert.equal(s.activityType, 'lesson');
    assert.equal(s.label, 'Book 1 · 🎲 Mix');
    assert.deepEqual(JSON.parse(s.matchJson), { titleExact: 'Unit pr1-mix words practice' });
    assert.equal(core().taskSpec('word:pr2-7').label, 'Book 2 · Unit 7 · Entertainment and Sports');
    assert.equal(core().taskSpec('bogus'), null);
    for (const gone of ['phrases', 'collocation', 'units:hk1-mix', 'grammar:unit12', 'math-exam:any-hk1', 'ptnk:any', 'reading:any']) {
      assert.equal(core().taskSpec(gone), null, gone + ' was cut with its menu');
    }
  });
  test('the reward is 200 xu and nothing else', () => {
    assert.deepEqual(core().DAILY_REWARD, { coins: 200 });
    for (const gone of ['REWARD_KINDS', 'SHIELD_MS', 'SHIELD_RAID_LOSS', 'armoryReady', 'shieldStatus', 'swordCount',
      'pendingRewards', 'recentRewards', 'armoryStatus', 'claimReward', 'claimAllRewards']) {
      assert.equal(typeof core()[gone], 'undefined', gone + ' should be gone with the Armory');
    }
  });
});

suite('daily task core: counting sessions at 100%', () => {
  test('title exact: 10/10 counts, 9/10 does not, total 0 does not, other type does not', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-3', 2);
    addUnit(world, kid.uid, 'pr1-3', '2026-09-02 09:00:00', 10, 10);
    addUnit(world, kid.uid, 'pr1-3', '2026-09-02 09:01:00', 9, 10);
    addUnit(world, kid.uid, 'pr1-3', '2026-09-02 09:02:00', 0, 0);
    addActivity(world, kid.uid, { type: 'review', title: unitTitle('pr1-3'), score: 10, total: 10, at: '2026-09-02 09:03:00' });
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks.length, 1);
    assert.equal(p.tasks[0].count, 1);
    assert.equal(p.tasks[0].done, false);
    assert.equal(p.allDone, false);
  });

  test('title exact: pr1-mix does not count for pr1-3, a Book 2 unit does not count for Book 1, and vice versa', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-mix', 1);
    addTask(world, kid.uid, 'word:pr1-3', 1);
    addTask(world, kid.uid, 'word:pr2-3', 1);
    addUnit(world, kid.uid, 'pr1-3', '2026-09-02 09:00:00');
    let p = await core().progress(world.env, kid.uid, NOW);
    let byKind = Object.fromEntries(p.tasks.map(t => [t.kind, t.count]));
    assert.equal(byKind['word:pr1-3'], 1);
    assert.equal(byKind['word:pr1-mix'], 0, 'a unit is not the Mix');
    assert.equal(byKind['word:pr2-3'], 0, 'Unit 3 of Book 1 is not Unit 3 of Book 2');
    assert.equal(p.allDone, false);
    addUnit(world, kid.uid, 'pr1-mix', '2026-09-02 09:05:00');
    addUnit(world, kid.uid, 'pr2-3', '2026-09-02 09:06:00');
    p = await core().progress(world.env, kid.uid, NOW);
    byKind = Object.fromEntries(p.tasks.map(t => [t.kind, t.count]));
    assert.deepEqual(byKind, { 'word:pr1-mix': 1, 'word:pr1-3': 1, 'word:pr2-3': 1 });
    assert.equal(p.allDone, true);
  });

  test('a title that merely starts or ends with the unit title does not count (exact, not LIKE)', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
    addActivity(world, kid.uid, { type: 'lesson', title: unitTitle('pr1-1') + ' (retry)', score: 10, total: 10 });
    addActivity(world, kid.uid, { type: 'lesson', title: unitTitle('pr1-10'), score: 10, total: 10, at: '2026-09-02 09:01:00' });
    addActivity(world, kid.uid, { type: 'lesson', title: unitTitle('pr1-11'), score: 10, total: 10, at: '2026-09-02 09:02:00' });
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].count, 0, 'pr1-10 and pr1-11 must not pay off pr1-1');
  });

  test('GMT+7 day boundary: 23:59 counts, 00:01 next day does not, yesterday does not', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 3);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 16:59:00');
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 17:01:00');
    addUnit(world, kid.uid, 'pr1-1', '2026-09-01 16:59:00');
    addUnit(world, kid.uid, 'pr1-1', '2026-09-01 17:00:00');
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
    assert.equal(core().matchSql({}).sql, '0');
    assert.equal(core().matchSql(null).sql, '0');
  });

  test('a structurally odd match_json never throws; progress just counts zero', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    world.db.prepare(
      'INSERT INTO daily_tasks (user_id, kind, label, target, activity_type, match_json, created_by) VALUES (?,?,?,?,?,?,1)'
    ).run(kid.uid, 'odd', 'Odd task', 1, 'lesson', '{"detail":{"field":"chapter"}}');
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 09:00:00');
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks.length, 1);
    assert.equal(p.tasks[0].count, 0);
  });

  test('a task row left over from a cut menu still lists, counts zero, and never completes', async () => {
    // Production still holds daily_tasks rows for kinds the catalog no longer
    // knows (grammar, maths…). Their match rules are plain JSON, so they
    // keep working as rules — they just match no row the app can upload now.
    const world = createWorld();
    const kid = await world.createUser({});
    world.db.prepare(
      'INSERT INTO daily_tasks (user_id, kind, label, target, activity_type, match_json, created_by) VALUES (?,?,?,?,?,?,1)'
    ).run(kid.uid, 'grammar:unit12', 'Grammar · Unit 12', 1, 'grammar', '{"detail":{"field":"unitId","value":"unit12"}}');
    addTask(world, kid.uid, 'word:pr1-1', 1);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 09:00:00');
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks.length, 2);
    assert.equal(p.tasks.find(t => t.kind === 'grammar:unit12').count, 0);
    assert.equal(p.allDone, false, 'the stale task still blocks the day until the admin deletes it');
  });

  test('no tasks → empty list, never allDone; inactive tasks are ignored', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    let p = await core().progress(world.env, kid.uid, NOW);
    assert.deepEqual(p.tasks, []);
    assert.equal(p.allDone, false);
    const id = addTask(world, kid.uid, 'word:pr1-1', 1);
    world.db.prepare('UPDATE daily_tasks SET active=0 WHERE id=?').run(id);
    p = await core().progress(world.env, kid.uid, NOW);
    assert.deepEqual(p.tasks, []);
  });
});

suite('daily task core: the once-a-day reward', () => {
  test('not all done → nothing granted', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
    addTask(world, kid.uid, 'word:pr1-2', 1);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 09:00:00');
    const e = await core().evaluate(world.env, kid.uid, NOW);
    assert.equal(e.allDone, false);
    assert.equal(e.justRewarded, false);
    assert.equal(e.rewardedToday, false);
    assert.equal(rewards(world, kid.uid).length, 0);
    assert.equal(grants(world, kid.uid).length, 0);
  });

  test('all done → exactly one reward row and one 200-xu grant, no users column touched; repeated calls stay at one', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const before = userRow(world, kid.uid);
    addTask(world, kid.uid, 'word:pr1-1', 1);
    addTask(world, kid.uid, 'word:pr1-2', 1);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 09:00:00');
    addUnit(world, kid.uid, 'pr1-2', '2026-09-02 09:01:00');
    const first = await core().evaluate(world.env, kid.uid, NOW);
    assert.equal(first.allDone, true);
    assert.equal(first.justRewarded, true);
    assert.equal(first.rewardedToday, true);
    const second = await core().evaluate(world.env, kid.uid, NOW + 60000);
    assert.equal(second.justRewarded, false);
    assert.equal(second.rewardedToday, true);
    const rows = rewards(world, kid.uid);
    assert.equal(rows.length, 1, 'exactly one daily_task_rewards row — it is the farm\'s day tick');
    assert.equal(rows[0].task_date, '2026-09-02');
    assert.equal(rows[0].coins, 200);
    assert.equal(rows[0].shields, 0, 'the db/018 column is written as 0: there is no pick any more');
    assert.equal(rows[0].claimed_kind, null);
    const g = grants(world, kid.uid);
    assert.equal(g.length, 1, 'exactly one coin grant');
    assert.equal(g[0].amount, 200);
    assert.equal(g[0].note, 'Daily task 2026-09-02');
    assert.equal(g[0].claimed_at, null, 'paid out by the normal /api/coins claim, not here');
    // The whole users row is byte-for-byte what it was: the reward writes
    // no inventory anywhere (night_shields / night_swords included, while
    // the schema still carries them).
    assert.deepEqual(userRow(world, kid.uid), before, 'evaluate() must not touch the users row');
    for (const col of ['night_shields', 'night_swords']) {
      if (userCols(world).includes(col)) assert.equal(Number(userRow(world, kid.uid)[col] || 0), 0, col + ' stays 0');
    }
  });

  test('the next day starts from zero and can be rewarded again', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 09:00:00');
    await core().evaluate(world.env, kid.uid, NOW);
    const tomorrow = NOW + 24 * 3600000;
    let e = await core().evaluate(world.env, kid.uid, tomorrow);
    assert.equal(e.tasks[0].count, 0);
    assert.equal(e.rewardedToday, false);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-03 09:00:00');
    e = await core().evaluate(world.env, kid.uid, tomorrow);
    assert.equal(e.justRewarded, true);
    assert.deepEqual(rewards(world, kid.uid).map(r => [r.task_date, r.coins, r.shields]), [['2026-09-02', 200, 0], ['2026-09-03', 200, 0]]);
    assert.deepEqual(grants(world, kid.uid).map(g => g.note), ['Daily task 2026-09-02', 'Daily task 2026-09-03']);
    assert.equal(e.seeds.justRewarded && e.seeds.justRewarded.id, 'lettuce', 'the second consecutive day earns the first seed');
  });

  test('the learner then claims the 200 coins through POST /api/coins', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 09:00:00');
    await core().evaluate(world.env, kid.uid, NOW);
    const r = await world.call(loadModule('functions/api/coins.js').onRequestPost, { token: kid.token, body: { proto: 2 } });
    assert.equal(r.status, 200);
    assert.equal(r.data.granted, 200);
    const again = await world.call(loadModule('functions/api/coins.js').onRequestPost, { token: kid.token, body: { proto: 2 } });
    assert.equal(again.data.granted, 0, 'a second claim pays nothing more');
  });

  test('a replayed batch against a claimed day grants nothing', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 09:00:00');
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
  });

  test('the reward rows are the farm\'s clock: dayCount and the wilt context follow them', async () => {
    const farm = loadModule('functions/api/_farm.js');
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
    assert.equal(await farm.dayCount(world.env, kid.uid), 0);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 09:00:00');
    await core().evaluate(world.env, kid.uid, NOW);
    assert.equal(await farm.dayCount(world.env, kid.uid), 1, 'one fully-done day = one tick');
    const clock = await farm.farmClock(world.env, kid.uid, NOW);
    assert.equal(clock.dayCount, 1);
    assert.deepEqual(clock.ctx, { today: '2026-09-02', doneYesterday: false, doneToday: true });
  });
});

function meHandler() { return loadModule('functions/api/me/daily-tasks.js'); }
function activityHandler() { return loadModule('functions/api/activity.js'); }

suite('daily task: GET /api/me/daily-tasks and the /api/activity hook', () => {
  test('needs a token; returns empty tasks for a learner with nothing assigned', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const anon = await world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET' });
    assert.equal(anon.status, 401);
    const r = await world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET', token: kid.token });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.tasks, []);
    assert.equal(r.data.allDone, false);
    assert.equal(r.data.rewardedToday, false);
    assert.equal(r.data.justRewarded, false);
    assert.truthy(r.data.seeds && typeof r.data.seeds === 'object', 'the seed streak rides along');
  });

  test('the reply carries date, tasks, reward state, seeds and farm — and nothing of the Armory', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
    const r = await world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET', token: kid.token });
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.data).sort(), ['allDone', 'date', 'farm', 'justRewarded', 'rewardedToday', 'seeds', 'tasks']);
    for (const gone of ['shields', 'swords', 'pending', 'recent', 'armoryReady']) assert.falsy(gone in r.data, gone + ' must not be in the reply');
    assert.deepEqual(Object.keys(r.data.tasks[0]).sort(), ['count', 'done', 'id', 'kind', 'label', 'target']);
    assert.equal(r.data.tasks[0].kind, 'word:pr1-1');
  });

  test('a synced 100% session moves the counter and pays the reward inside the activity POST', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr2-7', 1);
    const at = Date.now();
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token,
      body: { items: [{ type: 'lesson', title: unitTitle('pr2-7'), score: 10, total: 10, at }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    assert.deepEqual(r.data.dailyTask, { allDone: true, justRewarded: true, rewardedToday: true });
    assert.equal(rewards(world, kid.uid).length, 1);
    assert.equal(grants(world, kid.uid).length, 1);
    const me = await world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET', token: kid.token });
    assert.equal(me.data.tasks[0].count, 1);
    assert.equal(me.data.tasks[0].done, true);
    assert.equal(me.data.rewardedToday, true);
    assert.equal(me.data.justRewarded, false, 'already paid by the activity POST');
    assert.equal(rewards(world, kid.uid).length, 1, 'the GET pays nothing more');
  });

  test('the single-item activity POST also evaluates', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token, body: { type: 'lesson', title: unitTitle('pr1-1'), score: 10, total: 10 },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.dailyTask.justRewarded, true);
  });

  test('offline sync backfills each affected ICT day once, including the seed earned across two days', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const spec = core().taskSpec('word:pr1-1');
    const today = core().dayWindowUtc(Date.now()).date;
    const todayStart = Date.parse(today + 'T00:00:00Z') - 7 * 3600000;
    const firstAt = todayStart - 2 * 86400000 + 3600000;
    const secondAt = firstAt + 86400000;
    const assignedAt = new Date(firstAt - 86400000).toISOString().replace('T', ' ').slice(0, 19);
    world.db.prepare(`INSERT INTO daily_tasks
      (user_id,kind,label,target,activity_type,match_json,created_by,created_at,active)
      VALUES(?,?,?,?,?,?,1,?,1)`).run(kid.uid,spec.kind,spec.label,1,spec.activityType,spec.matchJson,assignedAt);
    const body={items:[
      {type:'lesson',title:unitTitle('pr1-1'),score:10,total:10,at:firstAt},
      {type:'lesson',title:unitTitle('pr1-1'),score:10,total:10,at:secondAt},
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
    ).run(kid.uid, 'x', 'x', 1, 'lesson', '{"detail":{"field":"a\\"b'  /* not JSON */);
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token, body: { items: [{ type: 'lesson', title: unitTitle('pr1-1'), score: 10, total: 10, at: Date.now() }] },
    });
    assert.equal(r.status, 200, 'activity sync must succeed even if evaluation cannot');
    assert.equal(r.data.ok, true);
  });

  test('an evaluation that throws cannot fail the sync', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
    const real = world.env.DB;
    world.env.DB = {
      prepare: sql => { if (/FROM daily_tasks/.test(sql)) throw new Error('D1 down'); return real.prepare(sql); },
      batch: s => real.batch(s),
    };
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token,
      body: { items: [{ type: 'lesson', title: unitTitle('pr1-1'), score: 10, total: 10, at: Date.now() }] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.ok, true);
    assert.equal(r.data.dailyTask, null, 'a failed evaluation is reported as unknown, not as "no tasks"');
    assert.equal(world.db.prepare('SELECT COUNT(*) n FROM activities WHERE user_id=?').get(kid.uid).n, 1, 'the activity itself still landed');
  });

  test('a balance-only sync (items: []) skips evaluation but still snapshots the balance', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-1', 1);
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

function adminHandler() { return loadModule('functions/api/admin/daily-tasks.js'); }

suite('daily task: admin API', () => {
  test('a learner cannot use the admin endpoints', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=' + kid.uid, method: 'GET', token: kid.token });
    assert.equal(g.status, 403);
    const p = await world.call(adminHandler().onRequestPost, { token: kid.token, body: { userId: kid.uid, kind: 'word:pr1-1', target: 5 } });
    assert.equal(p.status, 403);
    const d = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=1', method: 'DELETE', token: kid.token });
    assert.equal(d.status, 403);
  });

  test('create validates kind, target and user; a cut kind is refused like an unknown one', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const post = body => world.call(adminHandler().onRequestPost, { token: admin.token, body });
    assert.equal((await post({ userId: kid.uid, kind: 'nope', target: 5 })).status, 400);
    for (const gone of ['phrases', 'units:hk1-mix', 'grammar:unit12', 'math-exam:any-hk1', 'ptnk:any']) {
      assert.equal((await post({ userId: kid.uid, kind: gone, target: 5 })).status, 400, gone + ' is no longer assignable');
    }
    assert.equal((await post({ userId: kid.uid, kind: 'word:pr1-1', target: 0 })).status, 400);
    assert.equal((await post({ userId: kid.uid, kind: 'word:pr1-1', target: 51 })).status, 400);
    assert.equal((await post({ userId: kid.uid, kind: 'word:pr1-1', target: 2.5 })).status, 400);
    assert.equal((await post({ userId: 9999, kind: 'word:pr1-1', target: 5 })).status, 404);
    assert.equal((await post({ userId: admin.uid, kind: 'word:pr1-1', target: 5 })).status, 400, 'admins are not learners');
    const ok = await post({ userId: kid.uid, kind: 'word:pr1-mix', target: 5 });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.task.kind, 'word:pr1-mix');
    assert.equal(ok.data.task.label, 'Book 1 · 🎲 Mix');
    assert.equal(ok.data.task.target, 5);
    const row = world.db.prepare('SELECT * FROM daily_tasks WHERE id=?').get(ok.data.task.id);
    assert.equal(row.activity_type, 'lesson');
    assert.deepEqual(JSON.parse(row.match_json), { titleExact: 'Unit pr1-mix words practice' });
    assert.equal(row.created_by, admin.uid);
    const dup = await post({ userId: kid.uid, kind: 'word:pr1-mix', target: 3 });
    assert.equal(dup.status, 409, 'same active kind twice');
  });

  test('every one of the 48 catalog keys is assignable', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));
    const keys = Catalog.all().map(e => e.key);
    assert.equal(keys.length, 48);
    // MAX_ACTIVE_TASKS caps one learner at 10, so spread them over learners.
    let kid = null, n = 0;
    for (const kind of keys) {
      if (n % 10 === 0) kid = await world.createUser({});
      n++;
      const r = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind, target: 1 } });
      assert.equal(r.status, 200, kind + ': ' + JSON.stringify(r.data));
    }
  });

  test('list shows today\'s progress and reward state (no shields); delete deactivates', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const a = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'word:pr1-1', target: 1 } });
    const b = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'word:pr1-2', target: 2 } });
    addUnit(world, kid.uid, 'pr1-1', new Date().toISOString().replace('T', ' ').slice(0, 19));
    let g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=' + kid.uid, method: 'GET', token: admin.token });
    assert.equal(g.status, 200);
    assert.deepEqual(Object.keys(g.data).sort(), ['allDone', 'date', 'rewardedToday', 'tasks']);
    assert.equal(g.data.tasks.length, 2);
    const one = g.data.tasks.find(t => t.id === a.data.task.id);
    assert.equal(one.count, 1);
    assert.equal(one.done, true);
    assert.truthy(one.created_at);
    assert.equal(g.data.allDone, false);
    assert.equal(g.data.rewardedToday, false, 'the admin list never pays out');
    assert.equal(rewards(world, kid.uid).length, 0);
    assert.falsy('shields' in g.data, 'no shield status in the admin view');

    const d = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=' + b.data.task.id, method: 'DELETE', token: admin.token });
    assert.equal(d.status, 200);
    g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=' + kid.uid, method: 'GET', token: admin.token });
    assert.equal(g.data.tasks.length, 1);
    assert.equal(g.data.allDone, true);
    assert.equal(g.data.rewardedToday, false, 'still never pays out');
    assert.equal(rewards(world, kid.uid).length, 0);
    const gone = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=' + b.data.task.id, method: 'DELETE', token: admin.token });
    assert.equal(gone.status, 404);
    const again = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'word:pr1-2', target: 3 } });
    assert.equal(again.status, 200, 'a deleted kind can be assigned again');
  });

  test('days=N adds a per-day history: task in force that day, count that day, reward that day', async () => {
    // The admin's who-studied-who-skipped grid. Three GMT+7 days ending on
    // "today" (2026-09-02, NOW): a task assigned on the 1st (so the 31st of
    // August must not count it), done on the 1st, missed on the 2nd.
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const id = addTask(world, kid.uid, 'word:pr1-1', 1);
    world.db.prepare("UPDATE daily_tasks SET created_at = '2026-09-01 01:00:00' WHERE id = ?").run(id);
    addUnit(world, kid.uid, 'pr1-1', '2026-09-01 05:00:00');
    addUnit(world, kid.uid, 'pr1-1', '2026-08-31 16:30:00'); // 23:30 VN on the 31st
    addUnit(world, kid.uid, 'pr1-1', '2026-09-02 05:00:00', 9, 10); // not perfect
    world.db.prepare('INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?, ?, 200, 0)').run(kid.uid, '2026-09-01');
    const realNow = Date.now; Date.now = () => NOW;
    let g;
    try { g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=' + kid.uid + '&days=3', method: 'GET', token: admin.token }); }
    finally { Date.now = realNow; }
    assert.equal(g.status, 200);
    assert.deepEqual(g.data.history.map(h => h.date), ['2026-08-31', '2026-09-01', '2026-09-02'], 'oldest first, ending today');
    const [d31, d1, d2] = g.data.history;
    assert.deepEqual(d31.tasks, [], 'the task did not exist on the 31st, so its perfect run that night counts for nothing');
    assert.equal(d31.allDone, false);
    assert.equal(d1.tasks.length, 1);
    assert.equal(d1.tasks[0].count, 1);
    assert.equal(d1.allDone, true);
    assert.equal(d1.rewarded, true);
    assert.equal(d2.tasks[0].count, 0, '9/10 is not a completed task');
    assert.equal(d2.allDone, false);
    assert.equal(d2.rewarded, false);
    assert.equal(g.data.tasks.length, 1, 'today\'s list is still there beside the history');
  });

  test('days= is clamped to 1–31 and ignored when not a number', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const big = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=' + kid.uid + '&days=400', method: 'GET', token: admin.token });
    assert.equal(big.data.history.length, 31);
    const junk = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks?user_id=' + kid.uid + '&days=abc', method: 'GET', token: admin.token });
    assert.equal(junk.data.history, undefined, 'no history unless asked for');
  });

  test('GET without a numeric user_id is a 400', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const g = await world.call(adminHandler().onRequestGet, { url: '/api/admin/daily-tasks', method: 'GET', token: admin.token });
    assert.equal(g.status, 400);
  });

  test('a learner is capped at MAX_ACTIVE_TASKS active tasks', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const kinds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(u => 'word:pr1-' + u);
    let lastId;
    for (const kind of kinds) {
      const r = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind, target: 5 } });
      assert.equal(r.status, 200, kind);
      lastId = r.data.task.id;
    }
    const eleventh = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'word:pr1-11', target: 5 } });
    assert.equal(eleventh.status, 400);
    assert.equal(eleventh.data.code, 'too_many');
    await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=' + lastId, method: 'DELETE', token: admin.token });
    const again = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'word:pr1-11', target: 5 } });
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
    const p = await world.call(adminHandler().onRequestPost, { body: { userId: 1, kind: 'word:pr1-1', target: 5 } });
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
    const r = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid.uid, kind: 'word:pr1-1', target: '5' } });
    assert.equal(r.status, 200);
    assert.equal(r.data.task.target, 5);
  });

  test('an admin can delete a task belonging to a different learner', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid1 = await world.createUser({});
    const kid2 = await world.createUser({});
    await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid2.uid, kind: 'word:pr1-1', target: 1 } });
    const t = await world.call(adminHandler().onRequestPost, { token: admin.token, body: { userId: kid1.uid, kind: 'word:pr1-1', target: 1 } });
    const d = await world.call(adminHandler().onRequestDelete, { url: '/api/admin/daily-tasks?id=' + t.data.task.id, method: 'DELETE', token: admin.token });
    assert.equal(d.status, 200, 'no ownership check ties a task to whichever learner was last queried');
  });
});
if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
