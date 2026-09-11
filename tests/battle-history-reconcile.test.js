// battle-history-reconcile.test.js — pbReconcileHistory: the arena's history
// (and its pay) comes from the server, so the child who was NOT watching the
// last shot land still gets the battle.
//
// finishPetBattle runs on the phone that observes the end of a battle. Two
// children on one phone, A battles B from A's profile: B's profile never saw
// it, so B's 📜 Lịch sử đấu had no entry and B was never paid. These tests
// EXECUTE js/petbattle.js (with the real js/cups.js beside it) against a
// stubbed EngAuth.api and prove the money rules:
//   • a battle observed live AND later reconciled is paid exactly once;
//   • a battle never observed is paid exactly once by reconcile, and never
//     again by the next reconcile;
//   • the trophy is shelved once however the cup and history reconciles
//     interleave.
'use strict';

const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// js/cups.js + js/petbattle.js in one sandbox with just enough browser.
function arena(opts) {
  opts = opts || {};
  const el = () => ({ innerHTML: '', dataset: {}, classList: { add() {}, remove() {}, contains: () => false },
    style: {}, addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    querySelector: () => null, querySelectorAll: () => [], getBoundingClientRect: () => ({ width: 0, height: 0 }) });
  const byId = {};
  const doc = {
    getElementById: id => (byId[id] = byId[id] || el()),
    querySelector: () => null, querySelectorAll: () => [], createElement: () => el(),
    addEventListener() {}, removeEventListener() {}, body: el(), visibilityState: 'visible',
  };
  class FakeGame {
    constructor(o) { this.opts = o; this.view = o.view; this.finished = false; FakeGame.last = this; }
    start() {}
    destroy() { this.destroyed = true; }
    render() {}
  }
  const calls = [];
  const saves = { n: 0 };
  const syncs = { n: 0 };
  let replies = opts.replies || (() => ({ ok: false, offline: true, data: null }));
  const sandbox = {
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise, Set, Map, RegExp, Error,
    isNaN, isFinite, parseInt, parseFloat, setTimeout: (fn) => { if (opts.runTimers) fn(); return 0; }, clearTimeout() {},
    setInterval: () => 0, clearInterval() {},
    document: doc, window: { addEventListener() {}, removeEventListener() {}, innerWidth: 900 },
    navigator: { vibrate() {}, language: 'vi' }, location: { origin: 'http://test' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, performance: { now: () => 0 },
    PetBattleGame: FakeGame,
    BattleLink: function () { return { start() {}, close() {}, sendTurn() {} }; },
    BattleCalc: require(path.join(ROOT, 'js/battlecalc.js')).BattleCalc,
    CastleSkins: { get: () => ({ name: { vi: 'Thành Đá' }, price: 0 }), defaultId: 'stone-keep', preload() {},
      normalize: (id) => id || 'stone-keep', skins: [], drawPreview() {} },
    EngAuth: {
      tokenFor: (u) => (opts.noToken ? null : 'tok-' + u),
      api: (p, o) => { calls.push(p); return Promise.resolve(replies(p, o)); },
      syncNow: () => { syncs.n++; return Promise.resolve({ ok: true }); },
    },
    appState: opts.appState || { coins: 100, petBattleHistory: [] },
    currentUser: opts.currentUser === undefined ? 'An' : opts.currentUser,
    saveUserData() { saves.n++; }, showToast() {}, switchScreen() {}, renderHome() {},
    createConfetti() {}, getDogStage: () => ({ stageCss: 'husky', name: 'Husky' }),
  };
  sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read('js/cups.js'), sandbox, { filename: 'js/cups.js' });
  if (opts.dropApplyServerWins) vm.runInContext('applyServerWins = undefined;', sandbox);
  vm.runInContext(read('js/petbattle.js'), sandbox, { filename: 'js/petbattle.js' });
  return {
    sandbox, calls, saves, syncs, FakeGame,
    setReplies: (fn) => { replies = fn; },
    state: () => sandbox.appState,
    setUser: (u) => { sandbox.currentUser = u; },
    reconcile: () => sandbox.pbReconcileHistory(),
  };
}

// A finished battle as GET /api/battle/history returns it to `me`.
function serverBattle(over) {
  return Object.assign({
    id: 501, status: 'done', seed: 7, finishedAt: 1_700_000_000_000, winnerId: 1, draw: false,
    iAmChallenger: true,
    me: { id: 1, name: 'An', level: 12, hp: 55 },
    foe: { id: 2, name: 'Bình', level: 9, hp: 0 },
    turns: [
      { turnNo: 1, userId: 1, shots: 3, damage: 40, angle: 45, power: 80 },
      { turnNo: 2, userId: 2, shots: 2, damage: 45, angle: 50, power: 70 },
      { turnNo: 3, userId: 1, shots: 3, damage: 60, angle: 45, power: 80 },
    ],
  }, over || {});
}
const reply = (battles, wins) => () => ({ ok: true, data: { battles, wins: wins == null ? battles.filter(b => b.winnerId === 1).length : wins, now: Date.now() } });

suite('history reconcile: money — a battle is paid exactly once', () => {
  test('observed live, then reconciled: paid once, one entry, one cup', async () => {
    const t = arena();
    const st = t.state();
    // The phone watched the battle end: finishPetBattle pays 20 + 30.
    t.sandbox.finishPetBattle({ battleId: 501, won: true, draw: false, myHp: 55, foeHp: 0, foeName: 'Bình',
      myLevel: 12, foeLevel: 9, rounds: [{ mine: true, round: 1, shots: 3, damage: 40 }] });
    assert.equal(st.coins, 150, 'live pay');
    assert.equal(st.petBattleHistory.length, 1);
    assert.equal(st.petBattleHistory[0].battleId, 501, 'the live entry carries the server id');
    assert.equal(st.cups.won, 1);
    // Later the lobby reads the server back: the same battle, by id.
    t.setReplies(reply([serverBattle()]));
    const r = await t.reconcile();
    assert.deepEqual(r, { added: 0, coins: 0, wins: 0 });
    assert.equal(st.coins, 150, 'NOT paid a second time');
    assert.equal(st.petBattleHistory.length, 1, 'NOT duplicated');
    assert.falsy(st.petBattleHistory[0].reconciled, 'the live entry stays the live entry');
    assert.equal(st.cups.won, 1, 'NOT a second cup');
  });

  test('never observed: reconcile pays once; the next reconcile pays nothing', async () => {
    const t = arena({ replies: reply([serverBattle()]) });
    const st = t.state();
    const r1 = await t.reconcile();
    assert.deepEqual(r1, { added: 1, coins: 50, wins: 1 });
    assert.equal(st.coins, 150, '20 for fighting + 30 for the win — what finishPetBattle would have paid');
    assert.equal(st.petBattleHistory.length, 1);
    const e = st.petBattleHistory[0];
    assert.equal(e.battleId, 501);
    assert.truthy(e.won); assert.falsy(e.draw);
    assert.truthy(e.reconciled, 'flagged as rebuilt from the server');
    assert.equal(e.coins, 50);
    assert.equal(st.cups.won, 1, 'the trophy is shelved');
    assert.equal(st.cups.basic, 1);
    assert.truthy(t.saves.n >= 1, 'persisted');
    assert.equal(t.syncs.n, 1, 'and pushed to the server once');

    // The same server answer again — and again.
    const r2 = await t.reconcile();
    assert.deepEqual(r2, { added: 0, coins: 0, wins: 0 });
    await t.reconcile();
    assert.equal(st.coins, 150, 'paid exactly once');
    assert.equal(st.petBattleHistory.length, 1, 'recorded exactly once');
    assert.equal(st.cups.won, 1, 'one cup, ever');
    assert.equal(t.syncs.n, 1, 'nothing new to sync');
  });

  test('a draw pays 20 + 15 and no cup; a loss pays 20 and no cup', async () => {
    const t = arena({ replies: reply([
      serverBattle({ id: 601, winnerId: null, draw: true, finishedAt: 1_700_000_100_000, me: { id: 1, name: 'An', level: 12, hp: 30 }, foe: { id: 2, name: 'Bình', level: 9, hp: 30 } }),
      serverBattle({ id: 602, winnerId: 2, finishedAt: 1_700_000_200_000, me: { id: 1, name: 'An', level: 12, hp: 0 }, foe: { id: 2, name: 'Bình', level: 9, hp: 40 } }),
    ], 0) });
    const st = t.state();
    const r = await t.reconcile();
    assert.deepEqual(r, { added: 2, coins: 55, wins: 0 });
    assert.equal(st.coins, 155);
    assert.equal(st.cups.won, 0, 'no trophy for a draw or a loss');
    const byId = Object.fromEntries(st.petBattleHistory.map(e => [e.battleId, e]));
    assert.truthy(byId[601].draw); assert.falsy(byId[601].won); assert.equal(byId[601].coins, 35);
    assert.falsy(byId[602].draw); assert.falsy(byId[602].won); assert.equal(byId[602].coins, 20);
  });

  test('a winnerId that is not me is a loss even if the server forgot the draw flag', async () => {
    const t = arena({ replies: reply([serverBattle({ winnerId: 2, draw: undefined })], 0) });
    await t.reconcile();
    const e = t.state().petBattleHistory[0];
    assert.falsy(e.won); assert.falsy(e.draw);
    assert.equal(t.state().coins, 120);
  });

  test('the wallet is never left non-numeric', async () => {
    const t = arena({ appState: { coins: 'abc', petBattleHistory: [] }, replies: reply([serverBattle()]) });
    await t.reconcile();
    assert.equal(t.state().coins, 50);
  });
});

suite('history reconcile: the trophy is shelved once, whichever reconcile lands first', () => {
  test('the cup cabinet reconciled first (won already = server count): no extra cup', async () => {
    const t = arena({ replies: reply([serverBattle()], 1) });
    const st = t.state();
    // js/cups.js reconcileCupsFromServer ran first: applyServerWins(1).
    t.sandbox.applyServerWins(1);
    assert.equal(st.cups.won, 1); assert.equal(st.cups.basic, 1);
    await t.reconcile();
    assert.equal(st.coins, 150, 'the history reconcile still pays the coins');
    assert.equal(st.cups.won, 1, 'but does not shelve the cup a second time');
    assert.equal(st.cups.basic, 1);
  });

  test('the history reconciled first: the cup cabinet then adds nothing', async () => {
    const t = arena({ replies: reply([serverBattle()], 1) });
    const st = t.state();
    await t.reconcile();
    assert.equal(st.cups.won, 1);
    t.sandbox.applyServerWins(1);
    assert.equal(st.cups.won, 1); assert.equal(st.cups.basic, 1);
  });

  test('a stripped sandbox without applyServerWins falls back to awardCup, once per unseen win', async () => {
    const t = arena({ dropApplyServerWins: true, replies: reply([serverBattle()], 1) });
    const st = t.state();
    await t.reconcile();
    assert.equal(st.cups.won, 1);
    await t.reconcile();
    assert.equal(st.cups.won, 1);
  });
});

suite('history reconcile: merge rules', () => {
  test('an entry written before ids existed is matched by foe + minute, adopts the id, is not paid', async () => {
    const at = 1_700_000_000_000;
    const legacy = { won: true, draw: false, myHp: 55, foeHp: 0, foe: 'Bình', date: at + 40_000, coins: 50, rounds: [] };
    const t = arena({ appState: { coins: 100, petBattleHistory: [legacy], cups: { basic: 1, ruby: 0, diamond: 0, won: 1 } },
      replies: reply([serverBattle({ finishedAt: at })]) });
    const st = t.state();
    const r = await t.reconcile();
    assert.equal(r.added, 0);
    assert.equal(st.petBattleHistory.length, 1, 'not duplicated');
    assert.equal(st.petBattleHistory[0].battleId, 501, 'the legacy entry now carries the id');
    assert.equal(st.coins, 100, 'not paid again');
    assert.equal(st.cups.won, 1);
  });

  test('a legacy entry against the same foe but a different time is a different battle', async () => {
    const at = 1_700_000_000_000;
    const legacy = { won: false, draw: false, myHp: 0, foeHp: 20, foe: 'Bình', date: at - 3 * 3600_000, coins: 20, rounds: [] };
    const t = arena({ appState: { coins: 100, petBattleHistory: [legacy] }, replies: reply([serverBattle({ finishedAt: at })]) });
    const st = t.state();
    const r = await t.reconcile();
    assert.equal(r.added, 1);
    assert.equal(st.petBattleHistory.length, 2);
    assert.falsy(legacy.battleId, 'the old battle keeps its own identity');
    assert.equal(st.coins, 150);
  });

  test('a legacy entry against a different foe at the same minute is a different battle', async () => {
    const at = 1_700_000_000_000;
    const legacy = { won: true, draw: false, myHp: 55, foeHp: 0, foe: 'Cường', date: at + 10_000, coins: 50, rounds: [] };
    const t = arena({ appState: { coins: 100, petBattleHistory: [legacy] }, replies: reply([serverBattle({ finishedAt: at })]) });
    const r = await t.reconcile();
    assert.equal(r.added, 1);
    assert.equal(t.state().petBattleHistory.length, 2);
  });

  test('entries are kept newest first and capped at 100', async () => {
    const at = 1_700_000_000_000;
    const existing = { battleId: 1, won: true, draw: false, myHp: 1, foeHp: 0, foe: 'X', date: at + 50_000, coins: 50, rounds: [] };
    const many = [];
    for (let i = 0; i < 105; i++) many.push(serverBattle({ id: 1000 + i, finishedAt: at - i * 1000 }));
    const t = arena({ appState: { coins: 0, petBattleHistory: [existing] }, replies: reply(many) });
    const st = t.state();
    await t.reconcile();
    assert.equal(st.petBattleHistory.length, 100);
    assert.equal(st.petBattleHistory[0].battleId, 1, 'the newest (existing) entry stays on top');
    assert.equal(st.petBattleHistory[1].battleId, 1000);
    for (let i = 1; i < st.petBattleHistory.length; i++) {
      assert.truthy(st.petBattleHistory[i - 1].date >= st.petBattleHistory[i].date, 'sorted newest first');
    }
    assert.equal(st.coins, 105 * 50, 'every battle read back was paid — including the ones later trimmed off the list');
  });

  test('unfinished, malformed or id-less battles in the answer are ignored', async () => {
    const t = arena({ replies: reply([
      serverBattle({ status: 'active' }),
      serverBattle({ id: 0 }),
      null,
      { id: 9, status: 'done' },                    // no me/foe
    ], 0) });
    const r = await t.reconcile();
    assert.equal(r.added, 0);
    assert.equal(t.state().coins, 100);
  });
});

suite('history reconcile: the entry is rebuilt the way finishPetBattle would have written it', () => {
  test('rounds, totals, levels and HP come from the server row and its turns', async () => {
    const t = arena({ replies: reply([serverBattle()]) });
    await t.reconcile();
    const e = t.state().petBattleHistory[0];
    assert.equal(e.foe, 'Bình');
    assert.equal(e.myHp, 55); assert.equal(e.foeHp, 0);
    assert.equal(e.myLevel, 12); assert.equal(e.foeLevel, 9);
    assert.equal(e.date, 1_700_000_000_000, 'dated when the server finished it');
    assert.equal(e.rounds.length, 3);
    assert.deepEqual(e.rounds.map(r => r.mine), [true, false, true]);
    assert.deepEqual(e.rounds.map(r => r.round), [1, 1, 2]);
    assert.deepEqual(e.rounds.map(r => r.shots), [3, 2, 3]);
    assert.deepEqual(e.rounds.map(r => r.damage), [40, 45, 60]);
    assert.equal(e.rounds[1].angle, 50); assert.equal(e.rounds[1].power, 70);
    assert.equal(e.shotsFired, 6);
    assert.equal(e.volleys, 2);
    assert.equal(e.hits, 2);
    assert.equal(e.damageDealt, 100);
    assert.equal(e.damageTaken, 45);
  });

  test('the wind per round is the same deterministic wind the game showed', async () => {
    const t = arena({ replies: reply([serverBattle({ seed: 12345 })]) });
    await t.reconcile();
    const e = t.state().petBattleHistory[0];
    const calc = t.sandbox.BattleCalc;
    assert.equal(e.rounds[0].wind, calc.windForRound(12345, 1));
    assert.equal(e.rounds[2].wind, calc.windForRound(12345, 2));
  });

  test('a miss counts as a volley but not a hit', async () => {
    const t = arena({ replies: reply([serverBattle({ turns: [
      { turnNo: 1, userId: 1, shots: 2, damage: 0 },
      { turnNo: 2, userId: 2, shots: 1, damage: 10 },
      { turnNo: 3, userId: 1, shots: 2, damage: 30 },
    ] })]) });
    await t.reconcile();
    const e = t.state().petBattleHistory[0];
    assert.equal(e.volleys, 2); assert.equal(e.hits, 1); assert.equal(e.shotsFired, 4);
  });

  test('the history panel renders a reconciled entry like any other', async () => {
    const t = arena({ replies: reply([serverBattle()]) });
    await t.reconcile();
    const html = t.sandbox._pbHistoryPanel();
    assert.truthy(html.includes('Bình'), 'the foe is named');
    assert.truthy(html.includes('55 ❤️ – 0 ❤️'), 'the score is shown');
    const detail = t.sandbox._pbHistoryDetail(t.state().petBattleHistory[0]);
    assert.truthy(detail.includes('-40 HP') && detail.includes('-60 HP'), 'the volleys are replayed');
  });
});

suite('history reconcile: cheap, safe offline, and per profile', () => {
  test('the first call asks for everything; later calls send since=<newest finished_at>', async () => {
    const t = arena({ replies: reply([serverBattle({ finishedAt: 1_700_000_000_000 })]) });
    await t.reconcile();
    assert.equal(t.calls[0], 'battle/history');
    assert.equal(t.state().petBattleHistorySyncedAt, 1_700_000_000_000);
    t.setReplies(reply([]));
    await t.reconcile();
    assert.equal(t.calls[1], 'battle/history?since=1700000000000');
    assert.equal(t.state().petBattleHistorySyncedAt, 1_700_000_000_000, 'an empty answer keeps the mark');
  });

  test('offline: nothing changes and nothing is saved', async () => {
    const t = arena({ replies: () => ({ ok: false, offline: true, data: null }) });
    const r = await t.reconcile();
    assert.equal(r, null);
    assert.equal(t.state().coins, 100);
    assert.equal(t.state().petBattleHistory.length, 0);
    assert.equal(t.saves.n, 0);
    assert.equal(t.syncs.n, 0);
  });

  test('a server error or a malformed body is treated like offline', async () => {
    for (const bad of [{ ok: true, data: null }, { ok: true, data: { battles: 'nope' } }, { ok: false, status: 500, data: { error: 'x' } }]) {
      const t = arena({ replies: () => bad });
      assert.equal(await t.reconcile(), null);
      assert.equal(t.state().coins, 100);
    }
  });

  test('an api that throws is swallowed', async () => {
    const t = arena({ replies: () => { throw new Error('boom'); } });
    assert.equal(await t.reconcile(), null);
    assert.equal(t.state().coins, 100);
  });

  test('a profile with no server token never calls out', async () => {
    const t = arena({ noToken: true, replies: reply([serverBattle()]) });
    assert.equal(await t.reconcile(), null);
    assert.equal(t.calls.length, 0);
    assert.equal(t.state().coins, 100);
  });

  test('two callers in the same tick share one request', async () => {
    const t = arena({ replies: reply([serverBattle()]) });
    const p1 = t.reconcile(), p2 = t.reconcile();
    assert.truthy(p1 === p2, 'the second caller gets the in-flight promise');
    await p1;
    assert.equal(t.calls.length, 1);
    assert.equal(t.state().coins, 150, 'paid once');
  });

  test('a profile switch while the request is in flight drops the answer', async () => {
    let release;
    const t = arena({ replies: () => new Promise(res => { release = () => res(reply([serverBattle()])()); }) });
    const anState = t.state();
    const p = t.reconcile();
    // The next child signs in: their appState is installed and the arena is told.
    const binhState = { coins: 5, petBattleHistory: [] };
    t.sandbox.appState = binhState;
    t.setUser('Bình');
    t.sandbox.pbForgetProfile();
    release();
    assert.equal(await p, null);
    assert.equal(anState.coins, 100, "An's wallet untouched");
    assert.equal(binhState.coins, 5, "Bình was not paid for An's battle");
    assert.equal(binhState.petBattleHistory.length, 0);
  });

  test('after pbForgetProfile the next child gets their own request', async () => {
    let release;
    const t = arena({ replies: () => new Promise(res => { release = () => res(reply([])()); }) });
    const p = t.reconcile();
    t.sandbox.pbForgetProfile();
    t.setReplies(reply([serverBattle()]));
    const p2 = t.reconcile();
    assert.truthy(p !== p2, 'a fresh request for the new profile');
    release();
    await p; await p2;
    assert.equal(t.calls.length, 2);
  });
});

suite('history reconcile: wired into the app', () => {
  test('opening the lobby reconciles', () => {
    const t = arena({ replies: (p) => p === 'battle'
      ? { ok: true, data: { ammo: 1, readyAt: null, stats: {}, battle: null } }
      : reply([])() });
    t.sandbox.openPetBattle();
    assert.truthy(t.calls.includes('battle/history'), 'openPetBattle asks the server for finished battles');
  });

  test('a finished game hands its battle id to finishPetBattle', () => {
    const t = arena({ replies: () => ({ ok: false, data: null }) });
    const view = { id: 9001, status: 'active', seed: 1, iAmChallenger: true, turnNo: 1, myTurn: true,
      me: { id: 1, name: 'An', ammo: 3, level: 5, hp: 100, hires: [] },
      foe: { id: 2, name: 'Bình', ammo: 3, level: 5, hp: 100, hires: [] } };
    t.sandbox.startPetBattleGame(view);
    const game = t.FakeGame.last;
    assert.truthy(game && game.opts.onFinish, 'the game got an onFinish');
    // The engine's own result (js/petbattlegame.js) carries battleId too, but
    // the lobby does not rely on it.
    game.opts.onFinish({ won: false, draw: false, myHp: 0, foeHp: 30, foeName: 'Bình', rounds: [] });
    assert.equal(t.state().petBattleHistory[0].battleId, 9001);
    assert.equal(t.state().coins, 120);
  });

  test('js/petbattlegame.js puts the battle id in the finish result', () => {
    const fin = read('js/petbattlegame.js');
    const block = fin.slice(fin.indexOf('this.onFinish({'), fin.indexOf('this.onFinish({') + 200);
    assert.truthy(block.includes('battleId: this.view.id'));
  });

  test('login links the reconcile, guarded for the lazy arena group', () => {
    const auth = read('js/auth.js');
    assert.truthy(auth.includes("if (typeof pbReconcileHistory === 'function')"), 'syncAccount must reach for it guarded');
    const app = read('js/app.js');
    assert.falsy(/[^.\w]pbReconcileHistory\(/.test(app.replace(/typeof pbReconcileHistory/g, '')), 'app.js must not call it bare');
  });

  test('both pay paths use the one _pbBattleCoins definition', () => {
    const src = read('js/petbattle.js');
    assert.equal((src.match(/_pbBattleCoins\(/g) || []).length, 3, 'defined once, called from finishPetBattle and the reconcile');
    const t = arena();
    assert.equal(t.sandbox._pbBattleCoins(true, false), 50);
    assert.equal(t.sandbox._pbBattleCoins(false, true), 35);
    assert.equal(t.sandbox._pbBattleCoins(false, false), 20);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
