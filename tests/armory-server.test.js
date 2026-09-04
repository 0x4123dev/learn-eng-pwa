// Kho Khiên & Kiếm — the daily-task reward as a CLAIM (db/019). Handlers are
// EXECUTED against a real SQLite DB (tests/pages-harness.js + tests/d1-mock.js),
// never substring-checked: every inventory path here changes a child's
// shields or swords, so it is exercised, not grepped.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');
const fs = require('fs');
const path = require('path');
const { createD1 } = require('./d1-mock');

const ROOT = path.join(__dirname, '..');
const NR = loadModule('js/night-raid-rules.js');
function core() { return loadModule('functions/api/_daily-task.js'); }
function claimHandler() { return loadModule('functions/api/daily-task/claim.js'); }
function claimAllHandler() { return loadModule('functions/api/daily-task/claim-all.js'); }
function meHandler() { return loadModule('functions/api/me/daily-tasks.js'); }
function activityHandler() { return loadModule('functions/api/activity.js'); }
function startHandler() { return loadModule('functions/api/night-raid/start.js'); }
function finishHandler() { return loadModule('functions/api/night-raid/finish.js'); }
function homeHandler() { return loadModule('functions/api/night-raid/home.js'); }
function shieldHandler() { return loadModule('functions/api/night-raid/shield.js'); }

// 10:00 UTC on 2026-09-02 = 17:00 GMT+7 on 2026-09-02.
const NOW = Date.UTC(2026, 8, 2, 10, 0, 0);
const DAY = 24 * 3600000;

function addTask(world, uid, kind, target) {
  const spec = core().taskSpec(kind);
  return Number(world.db.prepare(
    'INSERT INTO daily_tasks (user_id, kind, label, target, activity_type, match_json, created_by) VALUES (?,?,?,?,?,?,1)'
  ).run(uid, spec.kind, spec.label, target, spec.activityType, spec.matchJson).lastInsertRowid);
}
function addActivity(world, uid, o) {
  world.db.prepare(
    'INSERT INTO activities (user_id, type, title, score, total, detail_json, created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(uid, o.type, o.title || '', o.score, o.total, o.detail ? JSON.stringify(o.detail) : null, o.at || '2026-09-02 09:00:00');
}
function rewards(world, uid) { return world.db.prepare('SELECT * FROM daily_task_rewards WHERE user_id=? ORDER BY task_date').all(uid); }
function shields(world, uid) { return world.db.prepare('SELECT night_shields FROM users WHERE id=?').get(uid).night_shields; }
function swords(world, uid) { return world.db.prepare('SELECT night_swords FROM users WHERE id=?').get(uid).night_swords; }
function grants(world, uid) { return world.db.prepare('SELECT amount, note, claimed_at FROM coin_grants WHERE user_id=?').all(uid); }
// Seed already-earned reward days the way evaluate() writes them.
function earned(world, uid, dates) {
  for (const d of dates) {
    world.db.prepare('INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?,?,200,1)').run(uid, d);
  }
}
function claim(world, kid, body) { return world.call(claimHandler().onRequestPost, { token: kid.token, body }); }
function claimAll(world, kid, body) { return world.call(claimAllHandler().onRequestPost, { token: kid.token, body }); }
function me(world, kid) { return world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET', token: kid.token }); }

suite('armory: schema (db/019)', () => {
  test('a DB built from schema.sql has the claim columns and users.night_swords, both defaulting to "nothing yet"', async () => {
    const world = createWorld();
    const users = world.db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
    assert.contains(users, 'night_shields');
    assert.contains(users, 'night_swords');
    const rewardCols = world.db.prepare('PRAGMA table_info(daily_task_rewards)').all().map(c => c.name);
    assert.contains(rewardCols, 'claimed_kind');
    assert.contains(rewardCols, 'claimed_at');
    const kid = await world.createUser();
    assert.equal(swords(world, kid.uid), 0);
    earned(world, kid.uid, ['2026-09-02']);
    assert.equal(rewards(world, kid.uid)[0].claimed_kind, null, 'a fresh reward row is unclaimed');
    assert.equal(await core().armoryReady(world.env), true);
  });

  test('db/019 applies to a post-018 database and backfills every existing row as an already-granted shield', () => {
    const { db } = createD1();
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE);');
    db.prepare("INSERT INTO users (username) VALUES ('kid1')").run();
    db.exec(fs.readFileSync(path.join(ROOT, 'db/018-daily-tasks.sql'), 'utf8'));
    // Two days paid under 018: each already put a shield straight into users.night_shields.
    db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields, granted_at) VALUES (1, '2026-09-01', 200, 1, '2026-09-01 10:00:00')").run();
    db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields, granted_at) VALUES (1, '2026-09-02', 200, 1, '2026-09-02 10:00:00')").run();
    db.exec(fs.readFileSync(path.join(ROOT, 'db/019-armory-swords.sql'), 'utf8'));
    assert.contains(db.prepare('PRAGMA table_info(users)').all().map(c => c.name), 'night_swords');
    assert.equal(db.prepare('SELECT night_swords FROM users WHERE id=1').get().night_swords, 0);
    const rows = db.prepare('SELECT task_date, claimed_kind, claimed_at, granted_at FROM daily_task_rewards ORDER BY task_date').all();
    assert.deepEqual(rows.map(r => [r.task_date, r.claimed_kind]), [['2026-09-01', 'shield'], ['2026-09-02', 'shield']],
      'days paid before 019 are not offered a second pick');
    assert.equal(rows[0].claimed_at, rows[0].granted_at, 'the backfill dates the pick to when the shield was actually granted');
    db.prepare("INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (1, '2026-09-03', 200, 1)").run();
    assert.equal(db.prepare("SELECT claimed_kind FROM daily_task_rewards WHERE task_date='2026-09-03'").get().claimed_kind, null,
      'a day earned after the migration waits for the child');
    assert.throws(() => db.exec(fs.readFileSync(path.join(ROOT, 'db/019-armory-swords.sql'), 'utf8')),
      're-running the migration must fail loudly (duplicate column), never silently re-backfill');
  });
});

suite('armory: finishing the day leaves a pick waiting — the 200 xu are paid exactly as before', () => {
  test('the activity POST that finishes the last task: 200-xu grant, unclaimed row, zero shields, zero swords', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'collocation', 1);
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token,
      body: { items: [{ type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, at: Date.now() }] },
    });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.dailyTask, { allDone: true, justRewarded: true, rewardedToday: true });
    const rows = rewards(world, kid.uid);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].coins, 200);
    assert.equal(rows[0].claimed_kind, null);
    assert.equal(rows[0].claimed_at, null);
    assert.equal(shields(world, kid.uid), 0, 'no shield is auto-granted any more');
    assert.equal(swords(world, kid.uid), 0);
    const g = grants(world, kid.uid);
    assert.equal(g.length, 1);
    assert.equal(g[0].amount, 200);
    assert.equal(g[0].note, 'Daily task ' + rows[0].task_date);
    const coins = await world.call(loadModule('functions/api/coins.js').onRequestPost, { token: kid.token, body: { proto: 2 } });
    assert.equal(coins.data.granted, 200, 'the 200 xu are still claimed through /api/coins, unchanged');
    const m = await me(world, kid);
    assert.deepEqual(m.data.pending, [rows[0].task_date]);
    assert.deepEqual(m.data.swords, { count: 0 });
    assert.deepEqual(m.data.shields, { count: 0, activeUntil: 0 });
    assert.equal(m.data.armoryReady, true);
    assert.deepEqual(m.data.recent, [{ date: rows[0].task_date, kind: null }]);
  });

  test('five days finished, never opened: five picks waiting, oldest first, nothing expired', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    for (let i = 0; i < 5; i++) {
      addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: '2026-09-0' + (2 + i) + ' 09:00:00' });
      const e = await core().evaluate(world.env, kid.uid, NOW + i * DAY);
      assert.equal(e.justRewarded, true, 'day ' + i);
    }
    assert.deepEqual(await core().pendingRewards(world.env, kid.uid), ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);
    assert.equal(shields(world, kid.uid), 0);
    assert.equal(grants(world, kid.uid).length, 5, 'and five separate 200-xu grants');
  });
});

suite('armory: POST /api/daily-task/claim', () => {
  test('claim as shield: +1 shield exactly once, row marked, pending empties, the reply carries the whole armory', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-02']);
    const r = await claim(world, kid, { date: '2026-09-02', kind: 'shield' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.ok, true);
    assert.equal(r.data.kind, 'shield');
    assert.equal(r.data.date, '2026-09-02');
    assert.equal(r.data.armory.shields.count, 1);
    assert.equal(r.data.armory.swords.count, 0);
    assert.deepEqual(r.data.armory.pending, []);
    assert.deepEqual(r.data.armory.recent, [{ date: '2026-09-02', kind: 'shield' }]);
    assert.equal(shields(world, kid.uid), 1);
    assert.equal(swords(world, kid.uid), 0);
    const row = rewards(world, kid.uid)[0];
    assert.equal(row.claimed_kind, 'shield');
    assert.truthy(row.claimed_at, 'claimed_at is stamped');
  });

  test('claim as sword: +1 sword exactly once, shields untouched', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-02']);
    const r = await claim(world, kid, { date: '2026-09-02', kind: 'sword' });
    assert.equal(r.status, 200);
    assert.equal(r.data.armory.swords.count, 1);
    assert.equal(swords(world, kid.uid), 1);
    assert.equal(shields(world, kid.uid), 0);
    assert.equal(rewards(world, kid.uid)[0].claimed_kind, 'sword');
  });

  test('a second tap, a replay, or the other kind for the same day: 409 claimed, nothing moves, and it says what the day became', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-02']);
    assert.equal((await claim(world, kid, { date: '2026-09-02', kind: 'shield' })).status, 200);
    for (const kind of ['shield', 'sword']) {
      const again = await claim(world, kid, { date: '2026-09-02', kind });
      assert.equal(again.status, 409, kind);
      assert.equal(again.data.code, 'claimed');
      assert.equal(again.data.kind, 'shield', 'the reply names the pick that stands');
      assert.equal(again.data.armory.shields.count, 1, 'the refusal still carries the armory so the screen can repaint');
    }
    assert.equal(shields(world, kid.uid), 1);
    assert.equal(swords(world, kid.uid), 0);
  });

  test('two devices claiming the same day at once: exactly one increment', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-02']);
    const [a, b] = await Promise.all([
      claim(world, kid, { date: '2026-09-02', kind: 'sword' }),
      claim(world, kid, { date: '2026-09-02', kind: 'shield' }),
    ]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    assert.equal(shields(world, kid.uid) + swords(world, kid.uid), 1, 'one day, one item');
  });

  test('a date with no reward → 404 no_reward; nothing changes', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-02']);
    for (const date of ['2026-09-01', '2026-09-03', '2099-01-01']) {
      const r = await claim(world, kid, { date, kind: 'shield' });
      assert.equal(r.status, 404, date);
      assert.equal(r.data.code, 'no_reward');
    }
    assert.equal(shields(world, kid.uid), 0);
    assert.deepEqual(await core().pendingRewards(world.env, kid.uid), ['2026-09-02'], 'the real pending day is still there');
  });

  test('another child\'s day cannot be claimed — the row is looked up under the caller\'s id', async () => {
    const world = createWorld();
    const a = await world.createUser({});
    const b = await world.createUser({});
    earned(world, a.uid, ['2026-09-02']);
    const r = await claim(world, b, { date: '2026-09-02', kind: 'sword' });
    assert.equal(r.status, 404);
    assert.equal(swords(world, b.uid), 0);
    assert.equal(rewards(world, a.uid)[0].claimed_kind, null, 'a still has their pick');
  });

  test('bad kind, bad date, non-object body → 400; nothing changes', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-02']);
    let r = await claim(world, kid, { date: '2026-09-02', kind: 'axe' });
    assert.equal(r.status, 400); assert.equal(r.data.code, 'bad_kind');
    r = await claim(world, kid, { date: '02/09/2026', kind: 'sword' });
    assert.equal(r.status, 400); assert.equal(r.data.code, 'bad_date');
    r = await claim(world, kid, { kind: 'sword' });
    assert.equal(r.status, 400); assert.equal(r.data.code, 'bad_date');
    r = await claim(world, kid, null);
    assert.equal(r.status, 400);
    r = await claim(world, kid, { date: "2026-09-02' OR 1=1 --", kind: 'sword' });
    assert.equal(r.status, 400, 'the date is validated before it reaches SQL');
    assert.equal(shields(world, kid.uid), 0);
    assert.equal(swords(world, kid.uid), 0);
    assert.equal(rewards(world, kid.uid)[0].claimed_kind, null);
  });

  test('needs a login; a disabled account is refused before it can touch the inventory', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-02']);
    const anon = await world.call(claimHandler().onRequestPost, { body: { date: '2026-09-02', kind: 'sword' } });
    assert.equal(anon.status, 401);
    world.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(kid.uid);
    const r = await claim(world, kid, { date: '2026-09-02', kind: 'sword' });
    assert.equal(r.status, 401);
    assert.equal(swords(world, kid.uid), 0);
  });

  test('claiming one day leaves the other pending days alone', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-01', '2026-09-02', '2026-09-03']);
    const r = await claim(world, kid, { date: '2026-09-02', kind: 'sword' });
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.armory.pending, ['2026-09-01', '2026-09-03']);
    assert.equal(swords(world, kid.uid), 1);
  });

  test('malformed JSON body is a 400', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const request = new Request('http://app.test/api/daily-task/claim', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kid.token }, body: '{nope',
    });
    const res = await claimHandler().onRequestPost({ request, env: world.env });
    assert.equal(res.status, 400);
  });
});

suite('armory: POST /api/daily-task/claim-all', () => {
  test('turns every pending day into the chosen kind, exactly once, and only pending days', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-08-30', '2026-09-01', '2026-09-02', '2026-09-03']);
    assert.equal((await claim(world, kid, { date: '2026-08-30', kind: 'shield' })).status, 200);
    const r = await claimAll(world, kid, { kind: 'sword' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.ok, true);
    assert.equal(r.data.kind, 'sword');
    assert.equal(r.data.claimed, 3);
    assert.deepEqual(r.data.armory.pending, []);
    assert.equal(r.data.armory.swords.count, 3);
    assert.equal(r.data.armory.shields.count, 1);
    assert.equal(swords(world, kid.uid), 3);
    assert.equal(shields(world, kid.uid), 1);
    assert.deepEqual(rewards(world, kid.uid).map(x => [x.task_date, x.claimed_kind]),
      [['2026-08-30', 'shield'], ['2026-09-01', 'sword'], ['2026-09-02', 'sword'], ['2026-09-03', 'sword']],
      'the already-claimed shield day is left as it was');
    const again = await claimAll(world, kid, { kind: 'sword' });
    assert.equal(again.status, 200);
    assert.equal(again.data.claimed, 0, 'a replay opens nothing');
    assert.equal(swords(world, kid.uid), 3);
  });

  test('a day claimed from another device a moment before the batch is neither re-claimed nor double-credited', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-01', '2026-09-02', '2026-09-03']);
    // The other device wins the race: its claim lands as this request's
    // claim-all UPDATE is being prepared — after this request looked at the
    // screen, before its batch runs. The guard has to be IN the statement.
    const real = world.env.DB;
    let raced = false;
    world.env.DB = {
      prepare: sql => {
        if (!raced && /UPDATE daily_task_rewards/.test(sql) && /claimed_kind IS NULL/.test(sql) && !/task_date = \?/.test(sql)) {
          raced = true;
          world.db.prepare("UPDATE daily_task_rewards SET claimed_kind='shield', claimed_at='2026-09-03 10:00:00' WHERE user_id=? AND task_date='2026-09-02'").run(kid.uid);
          world.db.prepare('UPDATE users SET night_shields = night_shields + 1 WHERE id=?').run(kid.uid);
        }
        return real.prepare(sql);
      },
      batch: s => real.batch(s),
    };
    const r = await claimAll(world, kid, { kind: 'sword' });
    assert.equal(r.status, 200);
    assert.equal(r.data.claimed, 2, 'only the two days that were still pending');
    assert.equal(swords(world, kid.uid), 2);
    assert.equal(shields(world, kid.uid), 1);
    assert.deepEqual(rewards(world, kid.uid).map(x => x.claimed_kind), ['sword', 'shield', 'sword']);
  });

  test('bad kind → 400; nothing pending → 200 with claimed 0; no token → 401', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    let r = await claimAll(world, kid, { kind: 'both' });
    assert.equal(r.status, 400); assert.equal(r.data.code, 'bad_kind');
    r = await claimAll(world, kid, { kind: 'shield' });
    assert.equal(r.status, 200); assert.equal(r.data.claimed, 0);
    assert.equal(shields(world, kid.uid), 0);
    const anon = await world.call(claimAllHandler().onRequestPost, { body: { kind: 'shield' } });
    assert.equal(anon.status, 401);
  });
});

// A world whose database has NOT run db/019 yet — the one deploy window the
// code has to survive in either order.
function pre019World() {
  const world = createWorld();
  world.db.exec('ALTER TABLE daily_task_rewards DROP COLUMN claimed_kind; ALTER TABLE daily_task_rewards DROP COLUMN claimed_at; ALTER TABLE users DROP COLUMN night_swords;');
  return world;
}

suite('armory: a database that has not run db/019 yet does not 500 — it behaves like 018', () => {
  test('GET /api/me/daily-tasks answers with an empty armory instead of failing', async () => {
    const world = pre019World();
    const kid = await world.createUser({});
    const m = await me(world, kid);
    assert.equal(m.status, 200);
    assert.deepEqual(m.data.pending, []);
    assert.deepEqual(m.data.swords, { count: 0 });
    assert.equal(m.data.armoryReady, false);
    assert.equal(await core().armoryReady(world.env), false);
    assert.equal(await core().swordCount(world.env, kid.uid), 0);
  });

  test('finishing the day still pays 200 xu AND puts the shield straight into the inventory, as 018 did', async () => {
    const world = pre019World();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20 });
    const e = await core().evaluate(world.env, kid.uid, NOW);
    assert.equal(e.justRewarded, true);
    assert.equal(grants(world, kid.uid).length, 1);
    assert.equal(grants(world, kid.uid)[0].amount, 200);
    assert.equal(shields(world, kid.uid), 1, 'no column to park the pick in → it is a shield right away');
    assert.equal(rewards(world, kid.uid).length, 1);
  });

  test('claim and claim-all refuse with 503 not_ready rather than crashing', async () => {
    const world = pre019World();
    const kid = await world.createUser({});
    earned(world, kid.uid, ['2026-09-02']);
    const a = await claim(world, kid, { date: '2026-09-02', kind: 'sword' });
    assert.equal(a.status, 503); assert.equal(a.data.code, 'not_ready');
    const b = await claimAll(world, kid, { kind: 'sword' });
    assert.equal(b.status, 503); assert.equal(b.data.code, 'not_ready');
    assert.equal(shields(world, kid.uid), 0);
  });

  test('the moment db/019 lands the same isolate switches over: the 018-paid day is a shield, the next day waits for the child', async () => {
    const world = pre019World();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'phrases', 1);
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20 });
    await core().evaluate(world.env, kid.uid, NOW);
    assert.equal(shields(world, kid.uid), 1);
    // Apply the migration to the live database — no restart, same env.DB.
    world.db.exec(fs.readFileSync(path.join(ROOT, 'db/019-armory-swords.sql'), 'utf8'));
    assert.equal(await core().armoryReady(world.env), true, 'a negative answer is re-asked, never cached');
    assert.deepEqual(await core().pendingRewards(world.env, kid.uid), [], 'the backfill marked the 018 day as its shield');
    assert.equal(rewards(world, kid.uid)[0].claimed_kind, 'shield');
    addActivity(world, kid.uid, { type: 'phrases', title: 'Phrases practice (20 Qs)', score: 20, total: 20, at: '2026-09-03 09:00:00' });
    const e = await core().evaluate(world.env, kid.uid, NOW + DAY);
    assert.equal(e.justRewarded, true);
    assert.equal(shields(world, kid.uid), 1, 'no auto-shield any more');
    assert.deepEqual(await core().pendingRewards(world.env, kid.uid), ['2026-09-03']);
    const r = await claim(world, kid, { date: '2026-09-03', kind: 'sword' });
    assert.equal(r.status, 200);
    assert.equal(swords(world, kid.uid), 1);
  });
});

suite('armory: swords in the shared score card (js/night-raid-rules.js)', () => {
  const layout = { cells: [{ type: 'water-cannon', gx: 0, gy: 0 }], soldiers: 4, dogLane: 2 };
  test('combatPower rises by exactly SWORD_DAMAGE x min(swords, SWORD_CAP); DEF never moves', () => {
    const base = NR.combatPower(layout, 10, 4);
    for (const n of [0, 1, 2, 5, 9, 10, 11, 30, 999]) {
      const p = NR.combatPower(layout, 10, 4, n);
      const expected = NR.SWORD_DAMAGE * Math.min(n, NR.SWORD_CAP);
      assert.equal(p.damage - base.damage, expected, n + ' swords');
      assert.equal(p.swordDamage, expected);
      assert.equal(p.swords, Math.min(n, NR.SWORD_CAP), 'the counted stock is what the HUD shows as n/cap');
      assert.equal(p.defense, base.defense, 'swords are attack only');
      assert.equal(NR.swordBonus(n), expected);
    }
  });
  test('a missing, non-numeric or negative count is zero swords — the 3-argument call is unchanged', () => {
    const base = NR.combatPower(layout, 10, 4);
    for (const bad of [undefined, null, NaN, 'abc', -3, {}]) {
      const p = NR.combatPower(layout, 10, 4, bad);
      assert.equal(p.damage, base.damage, String(bad));
      assert.equal(p.swordDamage, 0);
    }
    assert.equal(base.swords, 0);
    assert.equal(base.swordDamage, 0);
  });
  test('the constants mean what the comment says: two swords = a soldier, a full stock beats a coin flip by a 3-star margin', () => {
    assert.equal(NR.SWORD_DAMAGE, 10);
    assert.equal(NR.SWORD_CAP, 10);
    const one = NR.combatPower({ cells: [], soldiers: 0 }, 10), soldier = NR.combatPower({ cells: [], soldiers: 1 }, 10);
    assert.equal(NR.swordBonus(2), soldier.damage - one.damage, 'two swords are worth one soldier (+20)');
    // A coin flip: DAM == DEF loses (won = damage > defense). With a full
    // stock the same fight is won by 100, past finish.js's 60-point 3-star line.
    const target = NR.trainingTarget(5);
    assert.falsy(NR.resolveAutoBattle(target, target.defense).won);
    const full = NR.resolveAutoBattle(target, target.defense + NR.swordBonus(NR.SWORD_CAP));
    assert.truthy(full.won);
    assert.truthy(full.margin >= 60, 'margin ' + full.margin);
    assert.equal(NR.swordBonus(30), NR.swordBonus(NR.SWORD_CAP), 'hoarding past the cap adds nothing');
  });
});

function farmLayout() {
  return NR.normalizeLayout({ cells: [{ type: 'rice-field', lane: 0, col: 1, gx: 0, gy: 0, tier: 1, uid: 'p-testfarm01', readyAt: Date.now() + 3600000 }], soldiers: 2, dogLane: 2 });
}
async function seedHome(world, user, coins) {
  const r = await world.call(homeHandler().onRequestPut, {
    url: '/api/night-raid/home', method: 'PUT', token: user.token,
    body: { layout: farmLayout(), dogLevel: 7, castleSkin: 'royal-keep', coins: coins == null ? 800 : coins, vaultCoins: 40 },
  });
  assert.truthy(r.ok, 'seeding the home must succeed: ' + JSON.stringify(r.data));
}
function homeRow(world, uid) { return world.db.prepare('SELECT * FROM night_raid_homes WHERE user_id=?').get(uid); }
// What js/night-raid.js ownPower() computes on the client for this home and
// sword count — the same call, so the numbers must be identical.
function clientOwnPower(world, uid, swordsInStock) {
  const h = homeRow(world, uid);
  const layout = NR.normalizeLayout(JSON.parse(h.layout_json));
  return NR.combatPower(layout, h.dog_level, layout.soldiers, swordsInStock);
}

suite('armory: the server scores a raid with the attacker\'s swords, and agrees with the client', () => {
  test('start reads users.night_swords, folds it into attackerDamage, and records attackerSwords in the immutable snapshot', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, 800);
    await seedHome(world, defender, 800);
    world.db.prepare('UPDATE users SET night_swords=3 WHERE id=?').run(attacker.uid);
    const s = await world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
    assert.truthy(s.ok && s.data.raid, JSON.stringify(s.data));
    assert.equal(s.data.raid.attackerSwords, 3);
    const expected = clientOwnPower(world, attacker.uid, 3).damage;
    const without = clientOwnPower(world, attacker.uid, 0).damage;
    assert.equal(s.data.raid.attackerDamage, expected, 'server DAM == client ownPower() for the same inputs');
    assert.equal(expected - without, 30, '3 swords, +30');
    const raid = world.db.prepare('SELECT snapshot_json FROM night_raids WHERE attacker_id=?').get(attacker.uid);
    const snap = JSON.parse(raid.snapshot_json);
    assert.equal(snap.attackerSwords, 3);
    assert.equal(snap.attackerDamage, expected);
    const f = await world.call(finishHandler().onRequestPost, { token: attacker.token, body: { raidId: s.data.raid.raidId } });
    assert.truthy(f.ok && f.data.result, JSON.stringify(f.data));
    assert.equal(f.data.result.damage, expected, 'the re-simulation uses the snapshotted DAM, swords included');
  });

  test('the bonus is capped on the server too: 25 swords score as 10', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, 800);
    await seedHome(world, defender, 800);
    world.db.prepare('UPDATE users SET night_swords=25 WHERE id=?').run(attacker.uid);
    const s = await world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
    assert.equal(s.data.raid.attackerSwords, 25, 'the stock is recorded as it is');
    assert.equal(s.data.raid.attackerDamage - clientOwnPower(world, attacker.uid, 0).damage, NR.SWORD_DAMAGE * NR.SWORD_CAP);
    assert.equal(s.data.raid.attackerDamage, clientOwnPower(world, attacker.uid, 25).damage, 'client and server cap identically');
  });

  test('swords make the attacker win a fight they would otherwise have lost', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, 800);
    await seedHome(world, defender, 800);
    // Tune the defender's DEF to sit just above the attacker's sword-less DAM:
    // a fight the rules score as a loss (won = damage > defense) by a hair.
    // The farm layout has no defences, so DEF = 50 + (30 + 3·dogLevel).
    const without = clientOwnPower(world, attacker.uid, 0).damage;
    const dogLevel = Math.ceil((without - 80) / 3);
    world.db.prepare('UPDATE night_raid_homes SET dog_level=? WHERE user_id=?').run(dogLevel, defender.uid);
    const defRow = homeRow(world, defender.uid);
    const layout = NR.normalizeLayout(JSON.parse(defRow.layout_json));
    const defense = NR.combatPower(layout, dogLevel, layout.soldiers).defense;
    assert.truthy(defense >= without && defense - without < NR.SWORD_DAMAGE, 'fixture: DEF ' + defense + ' vs DAM ' + without);
    // Enough swords to cross the line by at least one point — here, one.
    const need = Math.max(1, Math.ceil((defense - without + 1) / NR.SWORD_DAMAGE));
    world.db.prepare('UPDATE users SET night_swords=? WHERE id=?').run(need, attacker.uid);
    const s = await world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
    assert.truthy(s.ok && s.data.raid, JSON.stringify(s.data));
    const f = await world.call(finishHandler().onRequestPost, { token: attacker.token, body: { raidId: s.data.raid.raidId } });
    assert.truthy(f.ok && f.data.result, JSON.stringify(f.data));
    assert.equal(f.data.result.defense, defense);
    assert.equal(f.data.result.damage, without + need * NR.SWORD_DAMAGE);
    assert.truthy(f.data.result.won, 'with the swords the raid is won');
    assert.falsy(NR.resolveAutoBattle({ defense, castleHp: 200, layout, dogLevel, attackerDamage: without }).won,
      'and without them the same fight is lost');
  });

  test('a defender\'s swords never raise their DEF, and a shielded target still always loses', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, 800);
    await seedHome(world, defender, 800);
    world.db.prepare('UPDATE users SET night_swords=10 WHERE id=?').run(defender.uid);
    world.db.prepare('UPDATE users SET night_swords=10 WHERE id=?').run(attacker.uid);
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(Date.now() + 3600000, defender.uid);
    const s = await world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
    assert.equal(s.data.raid.shielded, true);
    const f = await world.call(finishHandler().onRequestPost, { token: attacker.token, body: { raidId: s.data.raid.raidId } });
    assert.equal(f.data.result.won, false, 'ten swords do not beat a shield');
    assert.equal(f.data.result.loss, 200);
    // Same defender, no shield: DEF is what the layout says, swords or not.
    const other = await world.createUser({ allowBot: true });
    await seedHome(world, other, 800);
    const s2 = await world.call(startHandler().onRequestPost, { token: other.token, body: { targetId: attacker.uid } });
    assert.equal(s2.data.raid.defense, clientOwnPower(world, attacker.uid, 0).defense, 'the attacker-as-target has 10 swords and the same DEF');
  });

  test('GET /api/night-raid/home shows the owner their DAM with swords in, as the server will score it', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await seedHome(world, kid);
    world.db.prepare('UPDATE users SET night_swords=4 WHERE id=?').run(kid.uid);
    const r = await world.call(homeHandler().onRequestGet, { url: '/api/night-raid/home', method: 'GET', token: kid.token });
    assert.equal(r.status, 200);
    assert.equal(r.data.home.swords, 4);
    assert.equal(r.data.home.damage, clientOwnPower(world, kid.uid, 4).damage);
  });

  test('a pre-019 database raids with zero swords instead of failing', async () => {
    const world = pre019World();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, 800);
    await seedHome(world, defender, 800);
    const s = await world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
    assert.truthy(s.ok, JSON.stringify(s.data));
    assert.equal(s.data.raid.attackerSwords, 0);
    assert.equal(s.data.raid.attackerDamage, clientOwnPower(world, attacker.uid, 0).damage);
  });
});

suite('armory: shields keep their behaviour after being claimed', () => {
  test('a claimed shield can be spent through POST /api/night-raid/shield exactly as before', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await seedHome(world, kid);
    earned(world, kid.uid, ['2026-09-02']);
    assert.equal((await claim(world, kid, { date: '2026-09-02', kind: 'shield' })).status, 200);
    const r = await world.call(shieldHandler().onRequestPost, { token: kid.token, body: {} });
    assert.equal(r.status, 200);
    assert.equal(r.data.shields.count, 0);
    assert.truthy(r.data.shields.activeUntil > Date.now());
    const m = await me(world, kid);
    assert.equal(m.data.shields.count, 0);
    assert.equal(m.data.shields.activeUntil, r.data.shields.activeUntil);
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
