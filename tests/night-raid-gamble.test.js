// Cướp Đêm as a GAMBLE — every rule executed against a real SQLite DB through
// tests/pages-harness.js, never substring-checked.
//
//   - a sealed house ("nhà tan hoang") answers `ruined` instead of bouncing,
//     and the wasted march costs no ticket and no xu…
//   - …but it DOES start this child's own retry_hours clock on that house;
//   - the same house may not be attacked again inside retry_hours…
//   - …and MUST be attackable once they have passed, even on the same ICT day
//     (the regression the dropped UNIQUE (attacker, defender, day) index is
//     about — db/021);
//   - a win takes min(win_cap, win_pct%) from the victim and the system fills
//     any shortfall up to win_floor;
//   - a defeat burns exactly `loss` (or `shield_loss`) from the attacker,
//     clamped to what they hold, and the SYSTEM pays the defender a flat
//     defense_reward — capped per ICT day by defense_daily_cap (db/032);
//   - every one of those numbers comes from night_raid_config, is clamped on
//     read, and falls back to the defaults on a database that has no such
//     table yet.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const HOUR = 3600 * 1000, DAY = 24 * HOUR;
const homeHandler = () => loadModule('functions/api/night-raid/home.js');
const startHandler = () => loadModule('functions/api/night-raid/start.js');
const finishHandler = () => loadModule('functions/api/night-raid/finish.js');
const friendsHandler = () => loadModule('functions/api/night-raid/friends.js');
const reportsHandler = () => loadModule('functions/api/night-raid/reports.js');
const helper = () => loadModule('functions/api/_night-raid.js');

async function seedHome(world, user, o) {
  o = o || {};
  const r = await world.call(homeHandler().onRequestPut, {
    url: '/api/night-raid/home', method: 'PUT', token: user.token,
    body: { layout: { cells: [], soldiers: o.soldiers == null ? 0 : o.soldiers, dogLane: 2 },
      dogLevel: o.dogLevel || 1, castleSkin: o.castleSkin || 'stone-keep', coins: o.coins == null ? 800 : o.coins },
  });
  assert.truthy(r.ok, 'seeding the home must succeed: ' + JSON.stringify(r.data));
}
const STRONG = { dogLevel: 100, soldiers: 10 };
const WEAK = { dogLevel: 1, soldiers: 0 };

const coinsOf = (world, uid) => Number(world.db.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').get(uid).lootable_coins);
const ticketsUsed = (world, uid) => {
  const row = world.db.prepare('SELECT tickets_used FROM night_raid_daily WHERE user_id=?').get(uid);
  return row ? Number(row.tickets_used) : 0;
};
const setConfig = (world, key, value) =>
  world.db.prepare('INSERT OR REPLACE INTO night_raid_config(key,value,updated_at,updated_by) VALUES(?,?,?,?)')
    .run(key, value, Date.now(), 1);

const start = (world, attacker, defender) =>
  world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });

async function raid(world, attacker, defender) {
  const s = await start(world, attacker, defender);
  assert.truthy(s.ok && s.data && s.data.raid, 'start must create a raid: ' + JSON.stringify(s.data));
  const f = await world.call(finishHandler().onRequestPost, { token: attacker.token, body: { raidId: s.data.raid.raidId } });
  assert.truthy(f.ok && f.data && f.data.result, 'finish must resolve: ' + JSON.stringify(f.data));
  return { raidId: s.data.raid.raidId, result: f.data.result };
}
function befriend(world, a, b) {
  world.db.prepare("INSERT INTO friendships (requester_id, addressee_id, status, responded_at) VALUES (?,?,'accepted',datetime('now'))")
    .run(a.uid, b.uid);
}

suite('night raid: marching into ruins', () => {
  test('a sealed house answers ruined:true with the defender card, not a raid', async () => {
    const world = createWorld();
    const winner = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true, username: 'Bống' });
    const later = await world.createUser({ allowBot: true });
    await seedHome(world, winner, STRONG);
    await seedHome(world, defender, Object.assign({ castleSkin: 'ice-tower' }, WEAK));
    await seedHome(world, later, STRONG);
    const won = await raid(world, winner, defender);
    assert.equal(won.result.won, true, 'the fixture must seal the house first');

    const before = Date.now();
    const s = await start(world, later, defender);
    assert.equal(s.status, 200, 'the ruins are a 200, not an error: ' + JSON.stringify(s.data));
    assert.equal(s.data.ruined, true);
    assert.equal(s.data.raid, undefined, 'there is no battle to fight');
    assert.equal(s.data.name, 'Bống', 'the client still names the house it marched on');
    assert.equal(s.data.castleSkin, 'ice-tower', 'and draws the right castle before showing the rubble');
    assert.equal(s.data.homeLevel, 1);
    assert.inRange(s.data.retryAt - before, 12 * HOUR - 5000, 12 * HOUR + 5000,
      'retryAt is now + retry_hours');
  });

  test('the wasted march costs no ticket and no coins', async () => {
    const world = createWorld();
    const winner = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    const later = await world.createUser({ allowBot: true });
    for (const u of [winner, later]) await seedHome(world, u, STRONG);
    await seedHome(world, defender, WEAK);
    await raid(world, winner, defender);

    const coinsBefore = coinsOf(world, later.uid), victimBefore = coinsOf(world, defender.uid);
    const s = await start(world, later, defender);
    assert.equal(s.data.ruined, true);
    assert.equal(ticketsUsed(world, later.uid), 0, 'no ticket is spent on rubble');
    assert.equal(coinsOf(world, later.uid), coinsBefore, 'the raider pays nothing');
    assert.equal(coinsOf(world, defender.uid), victimBefore, 'and the ruined house loses nothing more');
    befriend(world, later, defender);
    const list = await world.call(friendsHandler().onRequestGet, { method: 'GET', token: later.token });
    assert.equal(list.data.ticketsLeft, 3, 'the ticket allowance is untouched');
  });

  test('but it DOES start my own 12 h cooldown on that house', async () => {
    const world = createWorld();
    const winner = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    const later = await world.createUser({ allowBot: true });
    for (const u of [winner, later]) await seedHome(world, u, STRONG);
    await seedHome(world, defender, WEAK);
    await raid(world, winner, defender);
    befriend(world, later, defender);

    const first = await start(world, later, defender);
    assert.equal(first.data.ruined, true);
    assert.equal(world.db.prepare("SELECT COUNT(*) AS n FROM night_raids WHERE attacker_id=? AND status='ruined'").get(later.uid).n, 1,
      'the attempt is recorded — that is what the clock hangs on');

    const again = await start(world, later, defender);
    assert.equal(again.status, 409, 'a second march inside 12 h is refused');
    assert.equal(again.data.error, 'Bạn vừa đánh nhà này rồi');
    assert.inRange(again.data.retryAt - Date.now(), 12 * HOUR - 5000, 12 * HOUR + 5000);

    const list = await world.call(friendsHandler().onRequestGet, { method: 'GET', token: later.token });
    const row = list.data.friends.find(f => f.targetId === defender.uid);
    assert.equal(row.retryAt, again.data.retryAt, 'the list quotes the same clock start.js enforces');
  });
});

suite('night raid: the per-pair 12 h cooldown', () => {
  test('a second attack on the same house inside 12 h is refused', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), buddy = await world.createUser({ allowBot: true });
    await seedHome(world, me, WEAK); await seedHome(world, buddy, STRONG);
    befriend(world, me, buddy);
    const { result } = await raid(world, me, buddy);
    assert.equal(result.won, false, 'a LOST raid seals nothing, so only the pair clock can refuse');

    const again = await start(world, me, buddy);
    assert.equal(again.status, 409);
    assert.truthy(again.data.retryAt > Date.now());
    const list = await world.call(friendsHandler().onRequestGet, { method: 'GET', token: me.token });
    assert.equal(list.data.friends[0].retryAt, again.data.retryAt);
  });

  test('and allowed again 12 h later — ON THE SAME ICT DAY', async () => {
    // The regression the dropped UNIQUE(attacker_id, defender_id, created_date)
    // index exists for: it would refuse this insert outright, whatever the
    // clock said, for as long as both attempts fall on one Night Raid day.
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), buddy = await world.createUser({ allowBot: true });
    await seedHome(world, me, WEAK); await seedHome(world, buddy, STRONG);
    const first = await raid(world, me, buddy);
    assert.equal(first.result.won, false);
    const firstDate = world.db.prepare('SELECT created_date FROM night_raids WHERE id=?').get(first.raidId).created_date;

    // Only the clock moves back; the ICT day stays exactly what it was.
    world.db.prepare('UPDATE night_raids SET created_at=created_at-? WHERE id=?').run(13 * HOUR, first.raidId);

    const s = await start(world, me, buddy);
    assert.truthy(s.ok && s.data.raid, '13 h later the same house is fair game again: ' + JSON.stringify(s.data));
    const secondDate = world.db.prepare('SELECT created_date FROM night_raids WHERE id=?').get(s.data.raid.raidId).created_date;
    assert.equal(secondDate, firstDate, 'both attempts are on ONE ICT day — the old unique index would have blocked this');
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM night_raids WHERE attacker_id=? AND defender_id=?').get(me.uid, buddy.uid).n, 2);
  });

  test('the cooldown is per pair: another house is still open', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true });
    const a = await world.createUser({ allowBot: true }), b = await world.createUser({ allowBot: true });
    await seedHome(world, me, WEAK); await seedHome(world, a, STRONG); await seedHome(world, b, STRONG);
    befriend(world, me, a); befriend(world, me, b);
    await raid(world, me, a);
    const list = await world.call(friendsHandler().onRequestGet, { method: 'GET', token: me.token });
    const rowA = list.data.friends.find(f => f.targetId === a.uid), rowB = list.data.friends.find(f => f.targetId === b.uid);
    assert.truthy(rowA.retryAt > Date.now(), 'the house I hit is on my clock');
    assert.equal(rowB.retryAt, 0, 'the one I did not is untouched');
    assert.deepEqual(list.data.friends.map(f => f.targetId), [b.uid, a.uid], 'attackable houses sort first');
  });

  test('retry_hours = 0 means no cooldown at all', async () => {
    const world = createWorld();
    setConfig(world, 'retry_hours', 0);
    const me = await world.createUser({ allowBot: true }), buddy = await world.createUser({ allowBot: true });
    await seedHome(world, me, WEAK); await seedHome(world, buddy, STRONG);
    await raid(world, me, buddy);
    const s = await start(world, me, buddy);
    assert.truthy(s.ok && s.data.raid, 'with the clock switched off the same house is immediately open');
  });
});

suite('night raid: loot transfers and victory rewards', () => {
  test('the victim loses only the loot while the system fills a win to the floor', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), rich = await world.createUser({ allowBot: true });
    const modest = await world.createUser({ allowBot: true });
    await seedHome(world, me, STRONG);
    await seedHome(world, rich, Object.assign({ coins: 5000 }, WEAK));
    await seedHome(world, modest, Object.assign({ coins: 800 }, WEAK));

    // 10% of 5000 = 500, but win_cap is 100.
    const big = await raid(world, me, rich);
    assert.equal(big.result.won, true);
    assert.equal(big.result.reward, 100, 'the cap bites');
    assert.equal(big.result.loot, 100, 'the loot itself reaches the per-win cap');
    assert.equal(coinsOf(world, rich.uid), 4900);

    // 10% of 800 = 80. The victim loses 80 and the system adds 20 so a win
    // still pays the 100-xu floor.
    const small = await raid(world, me, modest);
    assert.equal(small.result.reward, 100);
    assert.equal(small.result.loot, 80);
    assert.equal(small.result.victoryBonus, 20);
    assert.equal(coinsOf(world, modest.uid), 720);
  });

  test('a defeat burns the attacker\'s loss and the SYSTEM pays the defender defense_reward', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), wall = await world.createUser({ allowBot: true });
    await seedHome(world, me, Object.assign({ coins: 800 }, WEAK));
    await seedHome(world, wall, Object.assign({ coins: 800 }, STRONG));

    const { result } = await raid(world, me, wall);
    assert.equal(result.won, false);
    assert.equal(result.loss, 100, 'the default marching fee');
    assert.equal(result.defenderGain, 100, 'the default defence reward — the same number by coincidence, not by rule');
    assert.equal(result.defenseReason, 'defense_reward');
    assert.equal(coinsOf(world, me.uid), 700, 'the fee is gone');
    assert.equal(coinsOf(world, wall.uid), 900, 'and the reward arrived');
    assert.equal(Number(world.db.prepare('SELECT defense_earned FROM night_raid_daily WHERE user_id=?').get(wall.uid).defense_earned), 100,
      'the day\'s ledger counts it');
  });

  test('hitting a shield costs shield_loss, and the defender is paid the same flat reward', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), shielded = await world.createUser({ allowBot: true });
    await seedHome(world, me, Object.assign({ coins: 800 }, STRONG));
    await seedHome(world, shielded, Object.assign({ coins: 800 }, WEAK));
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(Date.now() + DAY, shielded.uid);

    const { result } = await raid(world, me, shielded);
    assert.equal(result.won, false, 'a shield decides the raid outright, however strong the raider');
    assert.equal(result.shielded, true);
    assert.equal(result.loss, 200);
    assert.equal(result.defenderGain, 100, 'the reward is for holding the wall, however the raid broke');
    assert.equal(result.defenseReason, 'defense_reward');
    assert.equal(coinsOf(world, me.uid), 600);
    assert.equal(coinsOf(world, shielded.uid), 900);
  });

  test('a win pays the defender nothing', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), weak = await world.createUser({ allowBot: true });
    await seedHome(world, me, STRONG); await seedHome(world, weak, WEAK);
    const { result } = await raid(world, me, weak);
    assert.equal(result.won, true);
    assert.equal(result.defenderGain, 0);
    assert.equal(result.defenseReason, 'won');
    assert.equal(result.loss, 0);
  });

  test('an empty house pays the 100-xu win floor entirely from the system', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), empty = await world.createUser({ allowBot: true });
    await seedHome(world, me, STRONG);
    await seedHome(world, empty, Object.assign({ coins: 0 }, WEAK));
    const { result } = await raid(world, me, empty);
    assert.equal(result.won, true);
    assert.equal(result.reward, 100);
    assert.equal(result.loot, 0);
    assert.equal(result.victoryBonus, 100);
    assert.equal(result.rewardReason, 'victory_bonus');
    assert.equal(coinsOf(world, empty.uid), 0, 'the empty defender is never pushed negative');
  });

  test('a broke raider still pays only what they have — and the defender is still paid in full', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), wall = await world.createUser({ allowBot: true });
    await seedHome(world, me, Object.assign({ coins: 30 }, WEAK));
    await seedHome(world, wall, Object.assign({ coins: 800 }, STRONG));
    const { result } = await raid(world, me, wall);
    assert.equal(result.won, false);
    assert.equal(result.loss, 30, 'the fee is clamped to what the attacker actually has');
    assert.equal(result.defenderGain, 100, 'the reward no longer depends on the raider\'s purse');
    assert.equal(coinsOf(world, me.uid), 0);
    assert.equal(coinsOf(world, wall.uid), 900);
  });

  test('the daily reward cap still bites, at daily_reward_cap', async () => {
    const world = createWorld();
    setConfig(world, 'daily_reward_cap', 120);
    const me = await world.createUser({ allowBot: true });
    const a = await world.createUser({ allowBot: true }), b = await world.createUser({ allowBot: true });
    await seedHome(world, me, STRONG);
    for (const u of [a, b]) await seedHome(world, u, Object.assign({ coins: 5000 }, WEAK));

    const first = await raid(world, me, a);
    assert.equal(first.result.reward, 100, 'win_cap first');
    const second = await raid(world, me, b);
    assert.equal(second.result.reward, 20, 'then only what is left of the day');
    assert.equal(coinsOf(world, b.uid), 4980, 'and the second victim loses exactly the capped amount');
    assert.equal(Number(world.db.prepare('SELECT reward_earned FROM night_raid_daily WHERE user_id=?').get(me.uid).reward_earned), 120);
  });
});

suite('night raid: the admin rulebook', () => {
  test('defaults are the ten documented numbers', async () => {
    const world = createWorld();
    const cfg = await helper().readRaidConfig(world.env);
    assert.deepEqual(cfg, {
      win_cap: 100, win_floor: 100, win_pct: 10, loss: 100, shield_loss: 200,
      defense_reward: 100, defense_daily_cap: 500,
      seal_hours: 24, retry_hours: 12, daily_reward_cap: 400,
    });
    assert.deepEqual(cfg, helper().RAID_CONFIG_DEFAULTS);
  });

  test('stored values win, and the answer is always complete', async () => {
    const world = createWorld();
    setConfig(world, 'win_pct', 25);
    setConfig(world, 'loss', 7);
    const cfg = await helper().readRaidConfig(world.env);
    assert.equal(cfg.win_pct, 25);
    assert.equal(cfg.loss, 7);
    assert.equal(cfg.seal_hours, 24, 'a key nobody stored keeps its default');
    assert.deepEqual(Object.keys(cfg).sort(), Object.keys(helper().RAID_CONFIG_DEFAULTS).sort());
  });

  test('a typo in the admin page cannot break the game — every value is clamped', async () => {
    const world = createWorld();
    setConfig(world, 'win_pct', 9999);
    setConfig(world, 'seal_hours', -5);
    setConfig(world, 'retry_hours', 100000);
    setConfig(world, 'loss', 999999999);
    setConfig(world, 'daily_reward_cap', -1);
    const cfg = await helper().readRaidConfig(world.env);
    assert.equal(cfg.win_pct, 100, 'a percentage stops at 100');
    assert.equal(cfg.seal_hours, 0, 'hours never go negative');
    assert.equal(cfg.retry_hours, 168, 'and never past a week');
    assert.equal(cfg.loss, 100000, 'a coin amount stops at the wallet ceiling');
    assert.equal(cfg.daily_reward_cap, 0);
    for (const v of Object.values(cfg)) assert.equal(Number.isInteger(v), true, 'always integers');
  });

  test('a junk value falls back to the default rather than silently to zero', async () => {
    const world = createWorld();
    // The column is INTEGER NOT NULL, but SQLite affinity lets a non-numeric
    // string through — the one shape of junk that CAN reach the reader.
    world.db.prepare('INSERT INTO night_raid_config(key,value,updated_at) VALUES(?,?,0)').run('win_cap', 'abc');
    world.db.prepare('INSERT INTO night_raid_config(key,value,updated_at) VALUES(?,?,0)').run('nonsense_key', 5);
    const cfg = await helper().readRaidConfig(world.env);
    assert.equal(cfg.win_cap, 100, 'a broken row must not turn the rule off');
    assert.equal(cfg.nonsense_key, undefined, 'a stray row cannot invent a rule');
    assert.equal(helper().clampRaidConfigValue('nope', 3), null);
  });

  test('a raid honours the stored numbers end to end', async () => {
    const world = createWorld();
    setConfig(world, 'win_pct', 50);
    setConfig(world, 'win_cap', 4000);
    setConfig(world, 'daily_reward_cap', 9000);
    setConfig(world, 'seal_hours', 3);
    const me = await world.createUser({ allowBot: true }), rich = await world.createUser({ allowBot: true });
    await seedHome(world, me, STRONG);
    await seedHome(world, rich, Object.assign({ coins: 5000 }, WEAK));
    const before = Date.now();
    const { result } = await raid(world, me, rich);
    assert.equal(result.reward, 2500, 'half the pile, under the raised cap');
    assert.equal(coinsOf(world, rich.uid), 2500);
    assert.inRange(result.lockedUntil - before, 3 * HOUR - 5000, 3 * HOUR + 5000, 'and the seal is the stored 3 h');
  });

  test('a database with no night_raid_config table still plays, on the defaults', async () => {
    const world = createWorld();
    world.db.exec('DROP TABLE night_raid_config');
    const cfg = await helper().readRaidConfig(world.env);
    assert.deepEqual(cfg, helper().RAID_CONFIG_DEFAULTS, 'the code ships before the migration and must not care');

    const me = await world.createUser({ allowBot: true }), wall = await world.createUser({ allowBot: true });
    await seedHome(world, me, Object.assign({ coins: 800 }, WEAK));
    await seedHome(world, wall, Object.assign({ coins: 800 }, STRONG));
    const { result } = await raid(world, me, wall);
    assert.equal(result.loss, 100);
    assert.equal(coinsOf(world, wall.uid), 900);
    const list = await world.call(friendsHandler().onRequestGet, { method: 'GET', token: me.token });
    assert.truthy(list.ok, 'and the friends list answers too: ' + JSON.stringify(list.data));
  });
});

suite('GET /api/night-raid/reports: my own attacks', () => {
  test('wins, losses and ruins all come back, newest first', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true });
    const loot = await world.createUser({ allowBot: true, username: 'Kho' });
    const wall = await world.createUser({ allowBot: true, username: 'Tường' });
    const rubble = await world.createUser({ allowBot: true, username: 'Đổ' });
    const winner = await world.createUser({ allowBot: true });
    await seedHome(world, me, STRONG); await seedHome(world, winner, STRONG);
    await seedHome(world, loot, WEAK); await seedHome(world, rubble, WEAK);
    await seedHome(world, wall, { dogLevel: 400, soldiers: 40 });
    await raid(world, winner, rubble);          // somebody else seals that house

    const won = await raid(world, me, loot);
    assert.equal(won.result.won, true);
    const lost = await raid(world, me, wall);
    assert.equal(lost.result.won, false);
    const ruins = await start(world, me, rubble);
    assert.equal(ruins.data.ruined, true);

    const r = await world.call(reportsHandler().onRequestGet, { method: 'GET', token: me.token });
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.deepEqual(r.data.attacks.map(a => a.kind), ['ruined', 'lost', 'won'], 'newest first');
    assert.deepEqual(r.data.attacks.map(a => a.defenderName), ['Đổ', 'Tường', 'Kho']);
    const [ruined, lostRow, wonRow] = r.data.attacks;
    assert.equal(ruined.reward, 0); assert.equal(ruined.loss, 0); assert.equal(ruined.stars, 0);
    assert.truthy(ruined.finishedAt > 0, 'a ruins row is finished the moment it is written');
    assert.equal(lostRow.loss, 100);
    assert.equal(wonRow.reward, 100);
    assert.truthy(wonRow.stars >= 1);
    assert.deepEqual(r.data.reports, [], 'nobody attacked me, so the defence log is empty');
    assert.equal(r.data.attacks.length <= 20, true);
  });

  test('the defence log still only shows raids against MY house', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true });
    const raider = await world.createUser({ allowBot: true, username: 'Cướp' });
    await seedHome(world, me, WEAK); await seedHome(world, raider, STRONG);
    await raid(world, raider, me);
    const r = await world.call(reportsHandler().onRequestGet, { method: 'GET', token: me.token });
    assert.equal(r.data.reports.length, 1);
    assert.equal(r.data.reports[0].attackerName, 'Cướp');
    assert.deepEqual(r.data.attacks, [], 'I attacked nobody');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
