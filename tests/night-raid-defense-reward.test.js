// Cướp Đêm: holding the wall is paid by the SYSTEM, not by the raider.
//
// Until db/032 a repelled raid handed the defender exactly what the attacker
// lost, clamped to what the attacker held. Conserved, but unfair to the wall:
// a broke raider bounced off and the child who held it got 0. Now:
//
//   - the attacker still loses `loss` / `shield_loss`, clamped to their real
//     purse — and that fee is BURNED;
//   - the defender is paid defense_reward (100) by the system, on a plain
//     defeat and on a shielded one alike;
//   - one defender can earn at most defense_daily_cap (500) that way per ICT
//     day — ten losses against the same house in one day pay exactly 500,
//     the next ICT day starts again at 0;
//   - both numbers are admin-set through /api/admin/night-raid-config, and
//     clamped on read like every other rule;
//   - a database without the db/032 column pays nothing and says so
//     ('unmigrated'), never 500s.
//
// Every rule executes the real handlers against a real SQLite database
// (tests/pages-harness.js). Nothing is substring-checked.
'use strict';

const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const DAY = 24 * 3600 * 1000;
const homeHandler = () => loadModule('functions/api/night-raid/home.js');
const startHandler = () => loadModule('functions/api/night-raid/start.js');
const finishHandler = () => loadModule('functions/api/night-raid/finish.js');
const adminHandler = () => loadModule('functions/api/admin/night-raid-config.js');
const helper = () => loadModule('functions/api/_night-raid.js');

async function seedHome(world, user, o) {
  o = o || {};
  const r = await world.call(homeHandler().onRequestPut, {
    url: '/api/night-raid/home', method: 'PUT', token: user.token,
    body: { layout: { cells: [], soldiers: o.soldiers == null ? 0 : o.soldiers, dogLane: 2 },
      dogLevel: o.dogLevel || 1, castleSkin: 'stone-keep', coins: o.coins == null ? 800 : o.coins },
  });
  assert.truthy(r.ok, 'seeding the home must succeed: ' + JSON.stringify(r.data));
}
const STRONG = { dogLevel: 100, soldiers: 10 };
const WEAK = { dogLevel: 1, soldiers: 0 };

const coinsOf = (world, uid) => Number(world.db.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').get(uid).lootable_coins);
const grantsFor = (world, uid) =>
  world.db.prepare('SELECT amount, note FROM coin_grants WHERE user_id=? ORDER BY id').all(uid)
    .map(r => ({ amount: Number(r.amount), note: String(r.note || '') }));
const owedTo = (world, uid) => grantsFor(world, uid).reduce((sum, g) => sum + g.amount, 0);
const defenseEarned = (world, uid, date) => {
  const row = date
    ? world.db.prepare('SELECT defense_earned FROM night_raid_daily WHERE user_id=? AND raid_date=?').get(uid, date)
    : world.db.prepare('SELECT COALESCE(SUM(defense_earned),0) AS n FROM night_raid_daily WHERE user_id=?').get(uid);
  return row ? Number(date ? row.defense_earned : row.n) : 0;
};
const setConfig = (world, key, value) =>
  world.db.prepare('INSERT OR REPLACE INTO night_raid_config(key,value,updated_at,updated_by) VALUES(?,?,?,?)')
    .run(key, value, Date.now(), 1);

// A whole raid, attacker → defender; `coins` is what the attacker's device
// reports holding (finish.js clamps the fee to it).
async function raid(world, attacker, defender, coins) {
  const s = await world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
  assert.truthy(s.ok && s.data && s.data.raid, 'start must create a raid: ' + JSON.stringify(s.data));
  const body = { raidId: s.data.raid.raidId };
  if (coins !== undefined) body.coins = coins;
  const f = await world.call(finishHandler().onRequestPost, { token: attacker.token, body });
  assert.truthy(f.ok && f.data && f.data.result, 'finish must resolve: ' + JSON.stringify(f.data));
  return { raidId: s.data.raid.raidId, result: f.data.result };
}
// A weak raider with `coins` in the mirror, ready to lose to `wall`.
async function raider(world, coins) {
  const u = await world.createUser({ allowBot: true });
  await seedHome(world, u, Object.assign({ coins }, WEAK));
  return u;
}
async function wallFor(world, coins) {
  const u = await world.createUser({ allowBot: true });
  await seedHome(world, u, Object.assign({ coins: coins == null ? 800 : coins }, STRONG));
  return u;
}

suite('giữ thành: the defender is paid by the system, whatever the raider had', () => {
  test('a raider with 0 xu pays 0 — and the defender is still paid 100', async () => {
    const world = createWorld();
    const me = await raider(world, 0), wall = await wallFor(world, 800);
    const { result } = await raid(world, me, wall);
    assert.equal(result.won, false);
    assert.equal(result.loss, 0, 'an empty purse pays nothing');
    assert.equal(result.defenderGain, 100, 'the wall is paid the flat reward regardless');
    assert.equal(result.defenseReason, 'defense_reward');
    assert.equal(coinsOf(world, me.uid), 0);
    assert.equal(coinsOf(world, wall.uid), 900, 'the mirror is credited so the owner\'s next open shows it');
    assert.deepEqual(grantsFor(world, wall.uid), [{ amount: 100, note: 'Cướp Đêm: bạn giữ được nhà' }],
      'and the IOU that reaches the defender\'s device is the same 100, on the same note the client already knows');
    assert.equal(owedTo(world, me.uid), 0, 'the attacker settles on their own device');
    assert.equal(defenseEarned(world, wall.uid), 100, 'the day\'s ledger counts it');
  });

  test('a raider with 30 xu pays 30, which is burned; the defender is still paid 100', async () => {
    const world = createWorld();
    const me = await raider(world, 30), wall = await wallFor(world, 800);
    const before = coinsOf(world, me.uid) + coinsOf(world, wall.uid);
    const { result } = await raid(world, me, wall);
    assert.equal(result.loss, 30, 'clamped to what the raider has');
    assert.equal(result.defenderGain, 100);
    assert.equal(coinsOf(world, me.uid), 0);
    assert.equal(coinsOf(world, wall.uid), 900);
    assert.equal(coinsOf(world, me.uid) + coinsOf(world, wall.uid), before - 30 + 100,
      'the 30 went nowhere and the 100 came from nowhere — the two are independent');
  });

  test('a solvent raider pays the full fee; the defender is paid the same 100, not the fee', async () => {
    const world = createWorld();
    const me = await raider(world, 800), wall = await wallFor(world, 800);
    const { result } = await raid(world, me, wall);
    assert.equal(result.loss, 100);
    assert.equal(result.defenderGain, 100);
    assert.equal(coinsOf(world, me.uid), 700);
    assert.equal(coinsOf(world, wall.uid), 900);
  });

  test('a device that reports a smaller purse shrinks only the fee, never the reward', async () => {
    const world = createWorld();
    const me = await raider(world, 800), wall = await wallFor(world, 800);
    const { result } = await raid(world, me, wall, 0);
    assert.equal(result.loss, 0, 'the fee follows the reported purse');
    assert.equal(result.defenderGain, 100, 'the wall is paid anyway — under-reporting can no longer starve an opponent');
    assert.equal(owedTo(world, wall.uid), 100);
  });

  test('a shielded loss pays the same reward: it is for holding the wall, however it held', async () => {
    const world = createWorld();
    const me = await raider(world, 800), wall = await wallFor(world, 800);
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(Date.now() + DAY, wall.uid);
    const { result } = await raid(world, me, wall);
    assert.equal(result.shielded, true);
    assert.equal(result.loss, 200, 'shield_loss for the raider');
    assert.equal(result.defenderGain, 100, 'defense_reward for the defender — not the 200');
    assert.equal(result.defenseReason, 'defense_reward');
    assert.equal(coinsOf(world, me.uid), 600);
    assert.equal(coinsOf(world, wall.uid), 900);
    assert.equal(defenseEarned(world, wall.uid), 100);
  });

  test('a WIN pays the defender nothing and leaves their ledger untouched', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true });
    await seedHome(world, me, Object.assign({ coins: 500 }, STRONG));
    const victim = await raider(world, 1000);
    const { result } = await raid(world, me, victim);
    assert.equal(result.won, true);
    assert.equal(result.defenderGain, 0);
    assert.equal(result.defenseReason, 'won');
    assert.equal(defenseEarned(world, victim.uid), 0);
    assert.falsy(world.db.prepare('SELECT 1 FROM night_raid_daily WHERE user_id=?').get(victim.uid),
      'no daily row is written for the victim of a win');
  });
});

suite('giữ thành: the daily cap, executed', () => {
  test('ten lost raids against one house in one day pay exactly 500, then 0 — and the next ICT day starts over', async () => {
    const world = createWorld();
    const wall = await wallFor(world, 0);
    const { nightDate } = helper();
    const today = nightDate();
    const gains = [], reasons = [];
    for (let i = 0; i < 10; i++) {
      const me = await raider(world, 800);
      const { result } = await raid(world, me, wall);
      assert.equal(result.won, false, 'fixture ' + i + ' must be a defeat');
      assert.equal(result.loss, 100, 'the raider\'s fee never depends on the defender\'s cap');
      assert.equal(coinsOf(world, me.uid), 700, 'and is really taken, capped defender or not');
      gains.push(result.defenderGain); reasons.push(result.defenseReason);
    }
    assert.deepEqual(gains, [100, 100, 100, 100, 100, 0, 0, 0, 0, 0], 'five rewards reach the cap, the rest pay nothing');
    assert.deepEqual(reasons.slice(0, 5), Array(5).fill('defense_reward'));
    assert.deepEqual(reasons.slice(5), Array(5).fill('daily_cap'), 'and the result says why');
    assert.equal(owedTo(world, wall.uid), 500, 'the IOUs that reach the device total exactly the cap');
    assert.equal(grantsFor(world, wall.uid).length, 5, 'no empty IOU is written for a capped raid');
    assert.equal(coinsOf(world, wall.uid), 500, 'the mirror agrees');
    assert.equal(defenseEarned(world, wall.uid, today), 500);

    // Tomorrow, ICT. Tokens do not expire, so the only clock that moves is
    // nightDate()'s — and the ticket / retry clocks, which the fresh raiders
    // below do not need.
    const realNow = Date.now;
    const tomorrow = realNow() + DAY;
    Date.now = () => tomorrow;
    try {
      const me = await raider(world, 800);
      const { result } = await raid(world, me, wall);
      assert.equal(result.defenderGain, 100, 'a new day, a fresh 500');
      assert.equal(result.defenseReason, 'defense_reward');
      assert.equal(defenseEarned(world, wall.uid, nightDate(tomorrow)), 100, 'counted against the new date');
      assert.equal(defenseEarned(world, wall.uid, today), 500, 'yesterday\'s row is not touched');
      assert.equal(owedTo(world, wall.uid), 600);
    } finally { Date.now = realNow; }
  });

  test('the cap is not a multiple of the reward: the last payout is the remainder', async () => {
    const world = createWorld();
    setConfig(world, 'defense_daily_cap', 250);
    const wall = await wallFor(world, 0);
    const gains = [];
    for (let i = 0; i < 4; i++) {
      const me = await raider(world, 800);
      gains.push((await raid(world, me, wall)).result.defenderGain);
    }
    assert.deepEqual(gains, [100, 100, 50, 0]);
    assert.equal(owedTo(world, wall.uid), 250);
    assert.equal(defenseEarned(world, wall.uid), 250);
  });

  test('two overlapping /finish calls for one raid pay the reward once', async () => {
    const world = createWorld();
    const me = await raider(world, 800), wall = await wallFor(world, 800);
    const s = await world.call(startHandler().onRequestPost, { token: me.token, body: { targetId: wall.uid } });
    const raidId = s.data.raid.raidId;
    const call = () => world.call(finishHandler().onRequestPost, { token: me.token, body: { raidId } });
    const [a, b] = await Promise.all([call(), call()]);
    assert.truthy(a.ok && b.ok);
    assert.equal(a.data.result.defenderGain, 100);
    assert.equal(b.data.result.defenderGain, 100, 'both callers see the one stored result');
    assert.equal(owedTo(world, wall.uid), 100, 'one IOU');
    assert.equal(defenseEarned(world, wall.uid), 100, 'counted once');
    assert.equal(coinsOf(world, wall.uid), 900, 'credited once');
    const again = await call();
    assert.equal(again.data.result.defenderGain, 100);
    assert.equal(defenseEarned(world, wall.uid), 100, 'a later replay counts nothing more');
  });

  test('the ledger is written inside the settlement batch: a failed batch leaves it at 0', async () => {
    const world = createWorld();
    const me = await raider(world, 800), wall = await wallFor(world, 800);
    const s = await world.call(startHandler().onRequestPost, { token: me.token, body: { targetId: wall.uid } });
    const raidId = s.data.raid.raidId;
    const real = world.env.DB;
    world.env.DB = { prepare: sql => real.prepare(sql), exec: sql => real.exec(sql),
      batch: stmts => real.batch([...stmts, real.prepare('INSERT INTO missing_settlement_table(x) VALUES(1)')]) };
    let failed = false;
    try { await world.call(finishHandler().onRequestPost, { token: me.token, body: { raidId } }); } catch (e) { failed = true; }
    assert.truthy(failed, 'the injected failure must escape the handler');
    assert.equal(defenseEarned(world, wall.uid), 0, 'ledger rolled back');
    assert.equal(owedTo(world, wall.uid), 0, 'IOU rolled back');
    assert.equal(coinsOf(world, wall.uid), 800, 'mirror rolled back');
    world.env.DB = real;
    const retried = await world.call(finishHandler().onRequestPost, { token: me.token, body: { raidId } });
    assert.equal(retried.data.result.defenderGain, 100);
    assert.equal(defenseEarned(world, wall.uid), 100);
    assert.equal(owedTo(world, wall.uid), 100);
  });
});

suite('giữ thành: the two numbers are admin-set and clamped', () => {
  const post = (world, admin, key, value) =>
    world.call(adminHandler().onRequestPost, { url: '/api/admin/night-raid-config', token: admin.token, body: { key, value } });

  test('the admin route exposes both keys with their defaults and ranges', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const r = await world.call(adminHandler().onRequestGet, { url: '/api/admin/night-raid-config', method: 'GET', token: admin.token });
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.equal(r.data.config.defense_reward, 100);
    assert.equal(r.data.config.defense_daily_cap, 500);
    assert.deepEqual(r.data.ranges.defense_reward, [0, 100000]);
    assert.deepEqual(r.data.ranges.defense_daily_cap, [0, 100000]);
  });

  test('edits through the admin route change what the next raid pays', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    let r = await post(world, admin, 'defense_reward', 40);
    assert.truthy(r.ok, JSON.stringify(r.data));
    r = await post(world, admin, 'defense_daily_cap', 100);
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.equal(r.data.config.defense_reward, 40);
    assert.equal(r.data.config.defense_daily_cap, 100);

    const wall = await wallFor(world, 0);
    const gains = [];
    for (let i = 0; i < 4; i++) {
      const me = await raider(world, 800);
      gains.push((await raid(world, me, wall)).result.defenderGain);
    }
    assert.deepEqual(gains, [40, 40, 20, 0], 'the stored reward, then the stored cap');
    assert.equal(owedTo(world, wall.uid), 100);
  });

  test('a reward of 0 switches the payout off and says daily_cap, never a negative', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    assert.truthy((await post(world, admin, 'defense_reward', 0)).ok);
    const me = await raider(world, 800), wall = await wallFor(world, 800);
    const { result } = await raid(world, me, wall);
    assert.equal(result.defenderGain, 0);
    assert.equal(result.defenseReason, 'daily_cap');
    assert.equal(result.loss, 100, 'the raider still pays');
    assert.equal(grantsFor(world, wall.uid).length, 0, 'and no IOU is written');
    assert.equal(coinsOf(world, wall.uid), 800);
  });

  test('the admin route refuses a value outside the range, and a row written by hand is clamped on read', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    let r = await post(world, admin, 'defense_reward', 100001);
    assert.equal(r.status, 400, 'over the wallet ceiling: ' + JSON.stringify(r.data));
    r = await post(world, admin, 'defense_daily_cap', -1);
    assert.equal(r.status, 400, 'a negative cap: ' + JSON.stringify(r.data));
    r = await post(world, admin, 'defense_reward', 12.5);
    assert.equal(r.status, 400, 'not an integer');

    setConfig(world, 'defense_reward', 999999999);
    setConfig(world, 'defense_daily_cap', -50);
    const cfg = await helper().readRaidConfig(world.env);
    assert.equal(cfg.defense_reward, 100000, 'clamped to the wallet ceiling');
    assert.equal(cfg.defense_daily_cap, 0, 'clamped to zero');
    assert.deepEqual(helper().defenseAmounts(cfg, 0), { gain: 0, reason: 'daily_cap' }, 'a zero cap pays nothing');
    world.db.prepare('INSERT OR REPLACE INTO night_raid_config(key,value,updated_at) VALUES(?,?,0)').run('defense_reward', 'abc');
    assert.equal((await helper().readRaidConfig(world.env)).defense_reward, 100, 'junk falls back to the default, not to 0');
  });

  test('defenseAmounts never pays past the cap, never negative, always an integer', () => {
    const { defenseAmounts } = helper();
    const cfg = { defense_reward: 100, defense_daily_cap: 500 };
    assert.deepEqual(defenseAmounts(cfg, 0), { gain: 100, reason: 'defense_reward' });
    assert.deepEqual(defenseAmounts(cfg, 400), { gain: 100, reason: 'defense_reward' });
    assert.deepEqual(defenseAmounts(cfg, 450), { gain: 50, reason: 'defense_reward' });
    assert.deepEqual(defenseAmounts(cfg, 500), { gain: 0, reason: 'daily_cap' });
    assert.deepEqual(defenseAmounts(cfg, 9999), { gain: 0, reason: 'daily_cap' }, 'a ledger past the cap (cap lowered mid-day) pays nothing');
    assert.deepEqual(defenseAmounts(cfg, -20), { gain: 100, reason: 'defense_reward' }, 'a negative ledger is read as 0');
    assert.deepEqual(defenseAmounts(cfg, 'abc'), { gain: 100, reason: 'defense_reward' });
    assert.deepEqual(defenseAmounts({ defense_reward: 100.7, defense_daily_cap: 150.2 }, 0), { gain: 100, reason: 'defense_reward' });
    assert.deepEqual(defenseAmounts({ defense_reward: 100, defense_daily_cap: 150 }, 100), { gain: 50, reason: 'defense_reward' });
  });
});

suite('giữ thành: a database without db/032 pays nothing and says so', () => {
  test('the code is safe to ship ahead of the migration', async () => {
    const { SQL_FILES } = require('./pages-harness');
    const world = createWorld({ sqlFiles: SQL_FILES.filter(f => !/032-night-raid-defense-daily/.test(f)) });
    assert.falsy(world.db.prepare('PRAGMA table_info(night_raid_daily)').all().some(c => c.name === 'defense_earned'),
      'the fixture really lacks the column');
    const me = await raider(world, 800), wall = await wallFor(world, 800);
    const { result } = await raid(world, me, wall);
    assert.equal(result.won, false);
    assert.equal(result.loss, 100, 'the raider still pays the fee');
    assert.equal(coinsOf(world, me.uid), 700);
    assert.equal(result.defenderGain, 0, 'no reward without a ledger to cap it');
    assert.equal(result.defenseReason, 'unmigrated');
    assert.equal(grantsFor(world, wall.uid).length, 0);
    assert.equal(coinsOf(world, wall.uid), 800);
    assert.equal(world.db.prepare('SELECT tickets_used FROM night_raid_daily WHERE user_id=?').get(me.uid).tickets_used, 1,
      'the attacker\'s own ledger still works');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
