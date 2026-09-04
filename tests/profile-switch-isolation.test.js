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

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
