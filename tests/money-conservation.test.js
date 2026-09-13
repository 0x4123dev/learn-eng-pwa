// The loot/loss portions of a raid move coins and must never make them. A win
// may also contain an explicit, system-funded victoryBonus used to reach the
// configured minimum reward; that bonus is intentionally outside this ledger
// conservation check.
//
// This is the test that was missing, and its absence is why a fix that looked
// complete was not. The server suite asserted "the victim is owed exactly minus
// what the attacker took"; the client suite asserted "a child can owe the
// castle nothing". Both passed. Neither ever joined the two halves — and in
// between them the money was being created:
//
//     victim's mirror 5000, victim's REAL wallet 30, reward 100
//     attacker +100, victim −30 (clamped at zero)   →  70 xu from nowhere
//
// So this file runs BOTH sides of one raid: the real server handlers against a
// real SQLite database, and the real client wallet code applying the result on
// each child's device. Then it counts the coins in the world before and after.
//
// Two independent leaks are covered:
//   • the VICTIM cannot pay in full (their mirror is stale high) — the
//     shortfall is carried as a debt instead of being forgiven;
//   • the ATTACKER cannot pay in full (they spent the purse mid-raid, which
//     the 15-minute window makes comfortable) — the defender is credited only
//     what actually left the attacker.
'use strict';

const path = require('path');
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const homeHandler = () => loadModule('functions/api/night-raid/home.js');
const startHandler = () => loadModule('functions/api/night-raid/start.js');
const finishHandler = () => loadModule('functions/api/night-raid/finish.js');

const STRONG = { dogLevel: 100, soldiers: 10 };
const WEAK = { dogLevel: 1, soldiers: 0 };

async function seedHome(world, user, o) {
  o = o || {};
  const r = await world.call(homeHandler().onRequestPut, {
    url: '/api/night-raid/home', method: 'PUT', token: user.token,
    body: { layout: { cells: [], soldiers: 0, dogLane: 2 },
      dogLevel: o.dogLevel || 1, castleSkin: 'stone-keep', coins: o.mirror == null ? 800 : o.mirror },
  });
  assert.truthy(r.ok, JSON.stringify(r.data));
  if (o.soldiers) {
    const row = world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(user.uid);
    const layout = JSON.parse(row.layout_json);
    layout.soldiers = o.soldiers;
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?')
      .run(JSON.stringify(layout), user.uid);
  }
}

// ---- the two children's devices -------------------------------------------
//
// A wallet is `appState.coins` plus whatever js/auth.js says is still owed.
// The client code under test is the REAL applySignedGrant/settleCoinDebt, run
// against a stand-in appState — not a re-implementation of them.
function device(startingCoins) {
  const appState = { coins: startingCoins, coinDebt: 0 };
  const wallet = () => ({ coins: appState.coins, debt: appState.coinDebt || 0 });
  return { appState, wallet };
}

// js/auth.js is an IIFE that closes over `appState`; load it with ours bound.
function walletOpsFor(appState) {
  const fs = require('fs');
  const vm = require('vm');
  const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'auth.js'), 'utf8');
  const sandbox = {
    appState, currentUser: 'Kid', console, Math, JSON, Number, String, Object, Array, Date,
    localStorage: { _s: {}, getItem(k) { return this._s[k] || null; }, setItem(k, v) { this._s[k] = String(v); }, removeItem(k) { delete this._s[k]; } },
    fetch: () => Promise.reject(new Error('offline in this test')),
    crypto: require('crypto').webcrypto,
    setTimeout, clearTimeout,
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '\nthis.__EngAuth = EngAuth;', sandbox);
  const api = sandbox.__EngAuth;
  assert.truthy(typeof api.applySignedGrant === 'function', 'js/auth.js must expose the wallet ops');
  return api;
}

// Everything a child holds: spendable coins minus what they still owe.
const net = w => w.coins - w.debt;

async function raid(world, attacker, defender, attackerRealWallet) {
  const s = await world.call(startHandler().onRequestPost,
    { token: attacker.token, body: { targetId: defender.uid } });
  assert.truthy(s.ok && s.data.raid, 'start: ' + JSON.stringify(s.data));
  const f = await world.call(finishHandler().onRequestPost, {
    token: attacker.token,
    body: { raidId: s.data.raid.raidId, coins: attackerRealWallet },
  });
  assert.truthy(f.ok && f.data.result, 'finish: ' + JSON.stringify(f.data));
  return f.data.result;
}
const grantsFor = (world, uid) =>
  world.db.prepare('SELECT amount FROM coin_grants WHERE user_id=? ORDER BY id').all(uid)
    .map(r => Number(r.amount));

suite('cướp đêm: the coins in the world are the same before and after', () => {
  test('a win against a victim whose real purse is far smaller than the mirror', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const victim = await world.createUser({ allowBot: true });
    // The victim built up a big pile, then spent it in the home shop — which
    // never tells any server, so the mirror still says 5000.
    await seedHome(world, attacker, Object.assign({ mirror: 500 }, STRONG));
    await seedHome(world, victim, Object.assign({ mirror: 5000 }, WEAK));

    const attackerDev = device(500);
    const victimDev = device(30);            // what the victim REALLY has
    const before = net(attackerDev.wallet()) + net(victimDev.wallet());

    const result = await raid(world, attacker, victim, attackerDev.appState.coins);
    assert.truthy(result.won, 'fixture must be a win: ' + JSON.stringify(result));
    assert.equal(result.victoryBonus, 0, 'this fixture isolates a pure loot transfer');
    assert.truthy(result.loot > victimDev.appState.coins,
      `the fixture needs loot (${result.loot}) bigger than the victim's purse (30)`);

    // The attacker applies its own half locally, as claimVerified does.
    attackerDev.appState.coins += result.reward;
    // The victim's device picks up the IOU on its next sync.
    const ops = walletOpsFor(victimDev.appState);
    for (const amount of grantsFor(world, victim.uid)) ops.applySignedGrant(amount);

    const after = net(attackerDev.wallet()) + net(victimDev.wallet());
    assert.equal(after, before,
      `coins were created: ${before} → ${after} (attacker +${result.reward}, victim ${JSON.stringify(victimDev.wallet())})`);
    assert.equal(victimDev.appState.coins, 0, 'the victim is emptied, never negative on screen');
    assert.equal(victimDev.appState.coinDebt, result.loot - 30, 'and the rest is carried, not forgiven');
  });

  test('the carried debt is collected out of what the victim earns next', async () => {
    const dev = device(30);
    const ops = walletOpsFor(dev.appState);
    ops.applySignedGrant(-100);
    assert.equal(dev.appState.coins, 0);
    assert.equal(dev.appState.coinDebt, 70);

    ops.applySignedGrant(50);                 // a lesson pays out
    assert.equal(dev.appState.coins, 0, 'the earnings go to the debt first');
    assert.equal(dev.appState.coinDebt, 20);

    ops.applySignedGrant(50);
    assert.equal(dev.appState.coins, 30, 'and once it is clear, the child keeps the rest');
    assert.equal(dev.appState.coinDebt, 0);
  });

  test('an attacker who spent the purse mid-raid cannot fund the defender', async () => {
    // The 15-minute window makes this comfortable: start, back out, spend in
    // the pet shop, come back and settle. Two profiles per device are allowed,
    // so this was self-dealable — lose to your own second profile, mint 100.
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ mirror: 900 }, WEAK));
    await seedHome(world, defender, Object.assign({ mirror: 900 }, STRONG));

    const attackerDev = device(0);            // purse emptied since /start
    const defenderDev = device(900);
    const before = net(attackerDev.wallet()) + net(defenderDev.wallet());

    const result = await raid(world, attacker, defender, attackerDev.appState.coins);
    assert.falsy(result.won, 'fixture must be a defeat: ' + JSON.stringify(result));
    assert.equal(result.loss, 0, 'an empty purse pays nothing');
    // The defender is no longer funded BY the attacker at all: the system
    // pays the flat defence reward, so a broke raider costs the wall nothing.
    assert.equal(result.defenderGain, 100, 'the defender is paid by the system, not by the raider');
    assert.deepEqual(grantsFor(world, defender.uid), [100], 'one IOU, the system\'s');

    const ops = walletOpsFor(attackerDev.appState);
    attackerDev.appState.coins = Math.max(0, attackerDev.appState.coins - result.loss);
    for (const amount of grantsFor(world, attacker.uid)) ops.applySignedGrant(amount);
    const defOps = walletOpsFor(defenderDev.appState);
    for (const amount of grantsFor(world, defender.uid)) defOps.applySignedGrant(amount);
    const after = net(attackerDev.wallet()) + net(defenderDev.wallet());
    assert.equal(after, before + result.defenderGain,
      `exactly the system reward was created, nothing else: ${before} → ${after}`);
  });

  test('an attacker who still has the money pays it in full', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ mirror: 900 }, WEAK));
    await seedHome(world, defender, Object.assign({ mirror: 900 }, STRONG));

    const attackerDev = device(900);
    const defenderDev = device(900);
    const before = net(attackerDev.wallet()) + net(defenderDev.wallet());

    const result = await raid(world, attacker, defender, attackerDev.appState.coins);
    assert.falsy(result.won);
    assert.truthy(result.loss > 0, 'a solvent attacker really pays');
    attackerDev.appState.coins -= result.loss;
    const ops = walletOpsFor(defenderDev.appState);
    for (const amount of grantsFor(world, defender.uid)) ops.applySignedGrant(amount);

    assert.equal(net(defenderDev.wallet()), 900 + result.defenderGain, 'the defender is paid the flat reward');
    assert.equal(net(attackerDev.wallet()) + net(defenderDev.wallet()), before - result.loss + result.defenderGain,
      'the fee is burned and the reward is minted — neither leaks into the other');
  });

  test('a client under-reporting its purse can starve its opponent but not mint', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ mirror: 900 }, WEAK));
    await seedHome(world, defender, Object.assign({ mirror: 900 }, STRONG));

    // A modified client claims to be broke while really holding 900.
    const result = await raid(world, attacker, defender, 0);
    assert.equal(result.loss, 0);
    assert.equal(result.defenderGain, 100, 'lying about the purse no longer starves the opponent');
    assert.deepEqual(grantsFor(world, defender.uid), [100]);
    // The cheat still loses the raid and its 12 h door; it buys no coins.
    assert.falsy(result.won);
  });

  test('an old client that sends no balance still behaves as it always did', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true });
    const defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, Object.assign({ mirror: 900 }, WEAK));
    await seedHome(world, defender, Object.assign({ mirror: 900 }, STRONG));
    const s = await world.call(startHandler().onRequestPost,
      { token: attacker.token, body: { targetId: defender.uid } });
    const f = await world.call(finishHandler().onRequestPost,
      { token: attacker.token, body: { raidId: s.data.raid.raidId } });   // no coins field
    assert.truthy(f.ok, JSON.stringify(f.data));
    assert.truthy(f.data.result.loss > 0, 'it falls back to the mirror rather than paying nothing');
  });
});

suite('the wallet never shows a child a negative number', () => {
  test('however deep the debt goes', () => {
    const dev = device(5);
    const ops = walletOpsFor(dev.appState);
    ops.applySignedGrant(-1000);
    ops.applySignedGrant(-1000);
    assert.equal(dev.appState.coins, 0);
    assert.equal(dev.appState.coinDebt, 1995);
    ops.applySignedGrant(2000);
    assert.equal(dev.appState.coins, 5, 'and it settles exactly');
    assert.equal(dev.appState.coinDebt, 0);
  });

  test('junk in coinDebt cannot brick the wallet', () => {
    for (const junk of [undefined, null, NaN, -5, 'lots', {}]) {
      const dev = device(100);
      dev.appState.coinDebt = junk;
      const ops = walletOpsFor(dev.appState);
      ops.applySignedGrant(10);
      assert.equal(dev.appState.coins, 110, 'a junk debt is treated as no debt: ' + String(junk));
    }
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
