// tests/profile-switch-isolation.test.js — one iPad, two children.
//
// Reported from real use: a child has two accounts on the same device and
// battles one against the other. They switch from account A to account B, open
// the arena — and see A's battle. A's pet, A's castle, and the relay still
// animating turns with nobody at the controls.
//
// The cause is not the switcher losing appState (it clears that correctly). It
// is that a live battle lives in a MODULE variable, `_pbGame`, which no profile
// change ever cleared — and startPetBattleGame opens with
//
//     if (_pbGame) { if (!_pbGame.finished) return; }   // a live game keeps the screen
//
// a guard that is right within one child and wrong across two. B's own battle
// never started; A's stayed on screen.
//
// It only began to bite when battles stopped finishing (the FIRE button was
// dead — see tests/browser-namespace-parity.test.js), because a finished battle
// clears `_pbGame` on its way out. The leak was always there underneath, and a
// child who switches profile MID-battle would still hit it, so it is fixed at
// the root rather than left to depend on battles ending.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---------------------------------------------------------------------------
// A minimal browser, shared by the behavioural tests below. Elements remember
// their innerHTML and their classes, which is all these teardowns touch.
// ---------------------------------------------------------------------------
function fakeEl() {
  const classes = new Set();
  return {
    innerHTML: '', textContent: '', value: '', dataset: {}, style: {},
    classList: {
      add: c => classes.add(c), remove: c => classes.delete(c),
      contains: c => classes.has(c), toggle: (c, on) => (on ? classes.add(c) : classes.delete(c)),
    },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    insertAdjacentHTML(_, html) { this.innerHTML += html; },
    closest: () => null, focus() {}, scrollTop: 0, scrollLeft: 0,
    querySelector: () => null, querySelectorAll: () => [],
    removeProperty() {}, setAttribute() {}, getBoundingClientRect: () => ({ width: 0, height: 0 }),
  };
}

function fakeDoc() {
  const byId = {};
  return {
    _byId: byId,
    getElementById: id => (byId[id] = byId[id] || fakeEl()),
    querySelector: () => null, querySelectorAll: () => [], createElement: () => fakeEl(),
    addEventListener() {}, removeEventListener() {}, body: fakeEl(),
    visibilityState: 'visible', hidden: false,
  };
}

// Load one app script into a sandbox. `peek` is appended verbatim, which is how
// a top-level `let` (script-scoped, never a property of the sandbox) is made
// readable — the same trick the pet-battle arena() below uses.
function loadModule(file, extra, peek) {
  const doc = fakeDoc();
  const sandbox = Object.assign({
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise,
    Set, Map, RegExp, Error, isNaN, parseInt, parseFloat, encodeURIComponent, decodeURIComponent,
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    document: doc, navigator: { language: 'vi' }, location: { origin: 'http://test', search: '' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    appState: null, currentUser: null,
    saveUserData() {}, showToast() {}, switchScreen() {}, renderHome() {}, createConfetti() {},
    module: { exports: {} },
  }, extra || {});
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(read(file) + (peek || ''), sandbox, { filename: file });
  return sandbox;
}

// js/petbattle.js in a sandbox, with just enough of a browser to start a game.
function arena() {
  const el = () => ({ innerHTML: '', dataset: {}, classList: { add() {}, remove() {}, contains: () => false },
    style: {}, addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    querySelector: () => null, querySelectorAll: () => [], getBoundingClientRect: () => ({ width: 0, height: 0 }) });
  const byId = {};
  const doc = {
    getElementById: id => (byId[id] = byId[id] || el()),
    querySelector: () => null, querySelectorAll: () => [], createElement: () => el(),
    addEventListener() {}, removeEventListener() {}, body: el(),
  };
  // A stand-in engine: it only has to look alive and be destroyable.
  class FakeGame {
    constructor(opts) { this.view = opts.view; this.finished = false; this.destroyed = false; }
    start() { this.started = true; }
    destroy() { this.destroyed = true; }
    render() {}
  }
  const sandbox = {
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise, Set, Map, RegExp, Error,
    isNaN, parseInt, parseFloat, setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    document: doc, window: { addEventListener() {}, removeEventListener() {}, innerWidth: 900 },
    navigator: { vibrate() {}, language: 'vi' }, location: { origin: 'http://test' },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    matchMedia: () => ({ matches: false, addEventListener() {} }),
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, performance: { now: () => 0 },
    PetBattleGame: FakeGame,
    BattleLink: function () { return { start() {}, close() {}, sendTurn() {} }; },
    BattleCalc: require(path.join(ROOT, 'js/battlecalc.js')).BattleCalc,
    CastleSkins: { get: () => ({ name: { vi: 'Thành Đá' } }), defaultId: 'stone-keep', preload() {} },
    appState: null, currentUser: null,
    saveUserData() {}, showToast() {}, switchScreen() {}, renderHome() {},
    createConfetti() {}, getDogStage: () => ({ stageCss: 'husky', name: 'Husky' }),
  };
  sandbox.globalThis = sandbox; sandbox.self = sandbox;
  vm.createContext(sandbox);
  // `_pbGame` is a top-level `let`, so it lives in the script's lexical scope
  // and never lands on the sandbox object. Surface a reader the same way
  // tests/money-client.test.js surfaces EngAuth.
  vm.runInContext(read('js/petbattle.js') + '\n;globalThis.__peekGame = () => _pbGame;',
    sandbox, { filename: 'js/petbattle.js' });
  return sandbox;
}

const viewFor = (id, name, skin) => ({
  id, status: 'active', seed: id, iAmChallenger: true, turnNo: 1, myTurn: true, fieldVersion: 6,
  backgroundId: 'cloudstep-meadow',
  me: { id: id + 1, name, ammo: 20, level: 10, stage: 'husky', hp: 100, hires: [], castleSkin: skin },
  foe: { id: id + 2, name: 'Khac', ammo: 20, level: 10, stage: 'husky', hp: 100, hires: [], castleSkin: 'stone-keep' },
});

suite('profile switch: a live battle does not follow the child who left', () => {
  test('the reported bug: without a teardown, the second child gets the first one\'s battle', () => {
    const s = arena();
    s.currentUser = 'AccountA';
    s.appState = { coins: 500, petName: 'CunA' };
    s.startPetBattleGame(viewFor(100, 'CunA', 'stone-keep'));
    assert.equal(s.__peekGame().view.id, 100);
    // The switcher clears appState but NOT the module — that alone is the bug.
    s.currentUser = 'AccountB';
    s.appState = { coins: 500, petName: 'CunB' };
    s.startPetBattleGame(viewFor(200, 'CunB', 'royal-keep'));
    assert.equal(s.__peekGame().view.id, 100,
      'this asserts the BUG on purpose: the guard keeps A\'s live game');
  });

  test('pbForgetProfile clears the game, so the second child starts their own', () => {
    const s = arena();
    s.currentUser = 'AccountA';
    s.appState = { coins: 500, petName: 'CunA' };
    s.startPetBattleGame(viewFor(100, 'CunA', 'stone-keep'));
    const aGame = s.__peekGame();

    s.pbForgetProfile();
    assert.equal(s.__peekGame(), null, 'the live game must be gone');
    assert.truthy(aGame.destroyed, 'and destroyed, not merely dropped — its relay must stop');

    s.currentUser = 'AccountB';
    s.appState = { coins: 500, petName: 'CunB' };
    s.startPetBattleGame(viewFor(200, 'CunB', 'royal-keep'));
    const bGame = s.__peekGame();
    assert.equal(bGame.view.id, 200, 'B gets their own battle');
    assert.equal(bGame.view.me.name, 'CunB');
    assert.equal(bGame.view.me.castleSkin, 'royal-keep', 'and their own castle, not A\'s');
  });

  test('it also empties the arena, so nothing of A is left painted on screen', () => {
    const s = arena();
    const screen = s.document.getElementById('petBattleScreen');
    s.currentUser = 'AccountA';
    s.appState = { coins: 500, petName: 'CunA' };
    s.startPetBattleGame(viewFor(100, 'CunA', 'stone-keep'));
    screen.innerHTML = '<div>CunA</div>';
    screen.dataset.pbLobbySig = 'stale';
    s.pbForgetProfile();
    assert.equal(screen.innerHTML, '');
    assert.equal(screen.dataset.pbLobbySig, undefined, 'the cached lobby signature must go too');
  });

  test('calling it twice, or with nothing running, is harmless', () => {
    const s = arena();
    s.pbForgetProfile();
    s.pbForgetProfile();
    assert.equal(s.__peekGame(), null);
  });
});

suite('profile switch: the app actually asks the modules to forget', () => {
  const app = read('js/app.js');

  test('switchUser tears the previous child down before showing the picker', () => {
    const fn = app.slice(app.indexOf('function switchUser()'), app.indexOf('function showDeleteModal'));
    assert.truthy(fn.includes('forgetProfileState()'), 'switchUser must call forgetProfileState()');
    assert.truthy(fn.indexOf('forgetProfileState()') < fn.indexOf("currentUser = null"),
      'and before currentUser is cleared, so the teardown still knows whose state it is');
  });

  test('loginUser clears a DIFFERENT child\'s leftovers, since a profile is entered by several roads', () => {
    const fn = app.slice(app.indexOf('function loginUser(username)'), app.indexOf('function loginUser(username)') + 900);
    assert.truthy(/currentUser && currentUser !== username/.test(fn) && fn.includes('forgetProfileState()'),
      'loginUser must forget the previous child when it is a different one');
  });

  test('forgetProfileState reaches both games, and tolerates a module that is not loaded', () => {
    const fn = app.slice(app.indexOf('function forgetProfileState()'), app.indexOf('function switchUser()'));
    assert.truthy(fn.includes('pbForgetProfile'), 'the arena must be torn down');
    assert.truthy(fn.includes('NightRaid') && fn.includes('forgetProfile'), 'and Cướp Đêm');
    assert.truthy((fn.match(/typeof/g) || []).length >= 2, 'each call must be guarded — a screen may not be loaded');
    assert.truthy((fn.match(/try\s*\{/g) || []).length >= 2, 'and must not let one failure block the other');
  });

  test('Cướp Đêm exposes a SILENT teardown: it must not ask a question or navigate', () => {
    const nr = read('js/night-raid.js');
    assert.truthy(/return Object\.freeze\(\{forgetProfile/.test(nr), 'forgetProfile must be exported');
    const fn = nr.slice(nr.indexOf('function forgetProfile()'), nr.indexOf('function cleanup()'));
    assert.truthy(fn.includes('cleanup()'), 'it must stop the timers and the running battle');
    assert.falsy(fn.includes('confirmLeaveRaid'), 'it must not ask — the child has already left');
    assert.falsy(fn.includes('switchScreen'), 'and must not navigate; the caller is going to the picker');
    for (const held of ['raidStage', 'liveTargets', 'builderZone', 'lastHarvest', 'homeLockedUntil']) {
      assert.truthy(fn.includes(held), 'forgetProfile must reset ' + held);
    }
  });
});

// ===========================================================================
//  The same shape, found elsewhere by audit. Each suite below states what the
//  second child could actually SEE, because a teardown that closes nothing is
//  just churn in a live app.
// ===========================================================================

// Let every pending microtask settle: these teardowns sit around awaited
// network calls, so one tick is not enough to see their effect.
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

// ---- 🏆 the trophy cabinet -------------------------------------------------
function cupboard(wins) {
  const calls = [];
  const s = loadModule('js/cups.js', {
    EngAuth: {
      tokenFor: u => 'tok-' + u,
      api: (path) => { calls.push(path); return Promise.resolve({ ok: true, data: { wins: wins[calls.length - 1] } }); },
    },
  }, '\n;globalThis.__peekReconciled = () => _cupsReconciled;');
  s.__calls = calls;
  return s;
}

suite('profile switch: the trophy cabinet must reconcile for EVERY child', () => {
  test('the bug: the latch is per-page, so only the first child ever reconciles', async () => {
    const s = cupboard([7, 7]);
    s.currentUser = 'AccountA';
    s.appState = { cups: { basic: 0, ruby: 0, diamond: 0, won: 0 } };
    s.renderCupCabinet();
    await flush();
    assert.equal(s.__calls.length, 1, 'A asks the server how many battles they won');
    assert.truthy(s.__peekReconciled(), 'and the latch is now set for the whole page');

    // A profile change that only swaps appState leaves the latch standing.
    s.currentUser = 'AccountB';
    s.appState = { cups: { basic: 0, ruby: 0, diamond: 0, won: 0 } };
    s.renderCupCabinet();
    await flush();
    assert.equal(s.__calls.length, 1,
      'this asserts the BUG on purpose: B never asks, so B\'s shelf is whatever localStorage said');
    assert.equal(s.appState.cups.won, 0, 'B is shown zero wins on a server that knows seven');
  });

  test('cupsForgetProfile drops the latch, so the next child reconciles too', async () => {
    const s = cupboard([7, 7]);
    s.currentUser = 'AccountA';
    s.appState = { cups: { basic: 0, ruby: 0, diamond: 0, won: 0 } };
    s.renderCupCabinet();
    await flush();

    s.cupsForgetProfile();
    assert.falsy(s.__peekReconciled(), 'the latch must be down again');

    s.currentUser = 'AccountB';
    s.appState = { cups: { basic: 0, ruby: 0, diamond: 0, won: 0 } };
    s.renderCupCabinet();
    await flush();
    assert.equal(s.__calls.length, 2, 'B asks for their own win count');
    assert.equal(s.appState.cups.won, 7, 'and gets their own trophies back');
  });

  test('it never touches the cups themselves — those leave with the profile', () => {
    const s = cupboard([0]);
    s.currentUser = 'AccountA';
    s.appState = { cups: { basic: 3, ruby: 1, diamond: 0, won: 8 } };
    s.cupsForgetProfile();
    assert.deepEqual(s.appState.cups, { basic: 3, ruby: 1, diamond: 0, won: 8 },
      'appState is the previous child\'s and loginUser swaps it wholesale');
  });

  test('the browser really has it: the old reset only ever existed under module.exports', () => {
    const src = read('js/cups.js');
    assert.truthy(/^function cupsForgetProfile\(\)/m.test(src),
      'it must be a real top-level function, not an arrow inside module.exports — '
      + 'a browser never runs that block, which is why _resetCupReconcile could not be called');
  });
});

// ---- 👥 the friends list ---------------------------------------------------
suite('profile switch: the friends list must not be painted for the wrong child', () => {
  const aData = {
    friends: [{ userId: 11, username: 'BanCuaA', summary: { sessions: 3, correct: 9, daysThisWeek: 2 } }],
    incoming: [{ friendshipId: 501, username: 'AiDoMoiA' }],
    outgoing: [],
  };

  function fr() {
    return loadModule('js/friends.js', { EngAuth: { tokenFor: () => 'tok' } },
      '\n;globalThis.__peekFriends = () => _friendsData;'
      + '\n;globalThis.__peekMsg = () => _friendsMsg;'
      + '\n;globalThis.__setFriends = (d) => { _friendsData = d; };');
  }

  test('the bug: initFriendsSection paints the cache BEFORE the new request lands', () => {
    const s = fr();
    s.currentUser = 'AccountA';
    s.__setFriends(aData);
    s.currentUser = 'AccountB';                     // the switch, module untouched
    s.renderFriendsSection();
    const html = s.document.getElementById('friendsSection').innerHTML;
    assert.truthy(html.includes('BanCuaA'), 'this asserts the BUG: B is shown A\'s friend');
    assert.truthy(html.includes('501'),
      'and A\'s pending invitation, with ✓/✕ wired to a friendshipId that is not B\'s');
  });

  test('friendsForgetProfile empties the cache and the section it owns', () => {
    const s = fr();
    s.currentUser = 'AccountA';
    s.__setFriends(aData);
    s.renderFriendsSection();
    s.friendsForgetProfile();

    assert.equal(s.__peekFriends(), null, 'the list must be gone');
    assert.equal(s.document.getElementById('friendsSection').innerHTML, '',
      'and nothing of A left painted');

    // null is the "loading…" state on purpose: B waits rather than being lied to.
    s.currentUser = 'AccountB';
    s.renderFriendsSection();
    const html = s.document.getElementById('friendsSection').innerHTML;
    assert.falsy(html.includes('BanCuaA'), 'B must not see A\'s friend');
    assert.falsy(html.includes('501'), 'nor A\'s invitation');
  });

  test('a stale status message does not follow the child either', () => {
    const s = fr();
    s.__setFriends(aData);
    s.friendsForgetProfile();
    assert.equal(s.__peekMsg(), '', '"✅ Đã gửi lời mời tới …" belonged to the previous child');
  });

  test('calling it twice, or with nothing loaded, is harmless', () => {
    const s = fr();
    s.friendsForgetProfile();
    s.friendsForgetProfile();
    assert.equal(s.__peekFriends(), null);
  });

  test('the arena reads the same cache, so clearing it closes that road too', () => {
    const pb = read('js/petbattle.js');
    assert.truthy(pb.includes('_friendsData'),
      'js/petbattle.js builds its "challenge a friend" list from _friendsData — '
      + 'if that ever stops being true, this teardown covers one road fewer');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
