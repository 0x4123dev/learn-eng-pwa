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
    addEventListener() {}, removeEventListener() {}, ResizeObserver: function () {
      return { observe() {}, disconnect() {} };
    },
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

// ---- ⏱️ everything with a clock of its own ---------------------------------
// A timer that outlives the switch does not merely paint the wrong thing: it
// keeps counting against whatever appState is current, which by then is the
// NEXT child's. These four are checked for the same three properties — the
// clock stops, the state goes, and the bottom bar comes back.

suite('profile switch: Đấu Toán stops polling as the child who left', () => {
  function mf() {
    const cleared = [];
    const s = loadModule('js/math-fight.js', {
      setInterval: () => Math.floor(Math.random() * 1e6) + 1,
      clearInterval: id => cleared.push(id),
      MathFightRules: {}, EngAuth: { tokenFor: () => 'tok', api: () => Promise.resolve({ ok: true, data: {} }) },
    });
    s.__cleared = cleared;
    return s;
  }

  test('all four intervals are stopped and the duel is dropped', () => {
    const s = mf();
    s.currentUser = 'AccountA';
    s.appState = { coins: 900 };
    s.MathFight.open();                                  // ticker + poll
    const st = s.MathFight.__st();
    st.pulse = 4242; st.wait = 4243;                     // as a live bout would set them
    st.fight = { fightId: 7, status: 'active' };
    st.data = { friends: [{ userId: 11, username: 'BanCuaA' }] };
    st.qs = [{ a: 1 }]; st.answers = [3]; st.idx = 1; st.busy = true; st.moved = 200;

    s.MathFight.forgetProfile();

    for (const key of ['ticker', 'poll', 'pulse', 'wait']) {
      assert.equal(st[key], null, key + ' must be stopped — it re-authenticates as the NEW child');
    }
    assert.truthy(s.__cleared.includes(4242) && s.__cleared.includes(4243),
      'and actually cleared, not merely forgotten');
    assert.equal(st.fight, null, 'the duel goes');
    assert.equal(st.data, null, 'and so does the friends-and-coins payload the server sent A');
    assert.deepEqual(st.qs, []);
    assert.equal(st.idx, 0);
    assert.falsy(st.busy, 'a latched busy flag would wedge the next child\'s first tap');
    assert.equal(st.moved, 0, 'A\'s coin move must not be reported to B');
    assert.equal(s.document.getElementById('mfRoot').innerHTML, '');
  });

  test('the bottom bar comes back — a hidden nav with no fight is a trap', () => {
    const s = mf();
    s.currentUser = 'AccountA';
    s.appState = { coins: 900 };
    s.document.getElementById('bottomNav').style.display = 'none';   // as a live bout leaves it
    s.MathFight.forgetProfile();
    assert.equal(s.document.getElementById('bottomNav').style.display, '');
  });

  test('it is silent: no question, no navigation', () => {
    const src = read('js/math-fight.js');
    const fn = src.slice(src.indexOf('function forgetProfile()'), src.indexOf('function stopTimers()'));
    assert.truthy(fn.includes('leave()'), 'it must reuse leave(), not re-implement the four-timer clear');
    assert.falsy(fn.includes('confirm('), 'quit() asks; this must not — the child has already gone');
    assert.falsy(fn.includes('switchScreen'), 'the caller is on its way to the picker');
  });
});

suite('profile switch: a timed exam does not keep ticking under the next child', () => {
  test('examForgetProfile reuses abandonExam, so the clock really stops', () => {
    const cleared = [];
    const s = loadModule('js/exam.js', { clearInterval: id => cleared.push(id) },
      '\n;globalThis.__peekExam = () => _examState;'
      + '\n;globalThis.__setExam = (v) => { _examState = v; };');
    s.__setExam({ examId: 'exam1', idx: 4, answers: [1, 2], deadlineTs: Date.now() + 60000, timerId: 99, finished: false });
    assert.truthy(s.isExamActive(), 'A is mid-paper');

    s.examForgetProfile();
    assert.equal(s.__peekExam(), null, 'the paper goes');
    assert.deepEqual(cleared, [99], 'and its clock is cleared, not just dropped');
    assert.falsy(s.isExamActive(),
      'switchScreen asks "You are in the middle of a timed exam" off isExamActive() — '
      + 'B was getting that on every tab tap');
    assert.equal(s.document.getElementById('bottomNav').style.display, '',
      'examLockScreen(false): the paper hid the bar, something must put it back');
  });

  test('it is silent, and it does not re-implement abandonExam', () => {
    const src = read('js/exam.js');
    const fn = src.slice(src.indexOf('function examForgetProfile()'),
      src.indexOf('function examForgetProfile()') + 300);
    assert.truthy(fn.includes('abandonExam()'));
    assert.falsy(fn.includes('confirm('));
    assert.falsy(fn.includes('switchScreen'));
  });
});

suite('profile switch: a Math Wars round does not survive the switch', () => {
  test('warsForgetProfile reuses abandonWars: clock stopped, round dropped, bar back', () => {
    const cleared = [];
    const s = loadModule('js/mathwars.js', { clearInterval: id => cleared.push(id) },
      '\n;globalThis.__peekWars = () => _warsQuiz;'
      + '\n;globalThis.__setWars = (v) => { _warsQuiz = v; };'
      + '\n;globalThis.__setWarsView = (v) => { _warsView = v; };'
      + '\n;globalThis.__peekWarsView = () => _warsView;');
    s.appState = { warsProgress: { level: 3, streak: 2 } };
    s.__setWars({ questions: [1, 2], idx: 1, answers: [0], endsAt: Date.now() + 9000, timer: 77 });
    s.__setWarsView('history');
    s.document.getElementById('bottomNav').style.display = 'none';

    s.warsForgetProfile();
    assert.equal(s.__peekWars(), null);
    assert.deepEqual(cleared, [77], 'the 250ms clock must be cleared');
    assert.falsy(s.isWarsActive());
    assert.equal(s.__peekWarsView(), 'practice');
    assert.equal(s.document.getElementById('bottomNav').style.display, '');
  });

  test('it is silent', () => {
    const src = read('js/mathwars.js');
    const fn = src.slice(src.indexOf('function warsForgetProfile()'),
      src.indexOf('function warsForgetProfile()') + 300);
    assert.truthy(fn.includes('abandonWars()'));
    assert.falsy(fn.includes('confirm('), 'warsQuit() asks; this must not');
  });
});

suite('profile switch: the verbs speed run does not follow the child', () => {
  test('the clock stops, the run is dropped, and both overlays are closed', () => {
    const cleared = [];
    const s = loadModule('js/verbs.js', {
      clearInterval: id => cleared.push(id),
      irregularVerbs: [], shuffleArray: a => a,
      unlockAchievement() {}, addPoints() {}, EngAuth: { syncNow() {} },
    });
    // speedState lives in js/app.js; verbs.js reaches it as a global.
    s.speedState = {
      currentVerbs: [{ v1: 'go' }, { v1: 'see' }], currentIndex: 1, score: 40, streak: 3,
      bestStreakInGame: 3, correctCount: 4, timer: 55, timeLeft: 12000,
      isAnswering: true, level: 2, verbResults: [{ v1: 'go', correct: true }],
    };
    const overlay = s.document.getElementById('speedGameOverlay');
    overlay.classList.add('active');
    s.document.getElementById('bottomNav').style.display = 'none';

    s.verbsForgetProfile();

    assert.deepEqual(cleared, [55], 'the 100ms question clock must be cleared');
    assert.falsy(s.speedState.isAnswering,
      'a stale isAnswering makes the app-wide Enter listener submit a verb on B\'s next tab');
    assert.deepEqual(s.speedState.verbResults, [], 'A\'s answers must not be banked into B');
    assert.equal(s.speedState.score, 0);
    assert.equal(s.speedState.currentIndex, 0);
    assert.equal(s.speedState.timeLeft, 12000,
      'timeLeft is showSpeedQuestion\'s to set — reaching for js/app.js\'s const here would throw');
    assert.deepEqual(s.speedState.currentVerbs, []);
    assert.falsy(overlay.classList.contains('active'),
      'the overlay is not a `.screen`, so switchUser\'s sweep never reaches it');
    assert.equal(s.document.getElementById('bottomNav').style.display, '');
  });

  test('it is silent, unlike the ✕ it stands in for', () => {
    const src = read('js/verbs.js');
    const fn = src.slice(src.indexOf('function verbsForgetProfile()'),
      src.indexOf('// Is the speed game actually on screen?'));
    assert.falsy(fn.includes('confirm('),
      'exitSpeedGame() asks — and would be answered by whoever picks the iPad up next');
    assert.falsy(fn.includes('switchScreen'));
  });

  test('nothing throws when there is no run and no DOM at all', () => {
    const s = loadModule('js/verbs.js', {
      irregularVerbs: [], shuffleArray: a => a, unlockAchievement() {}, EngAuth: { syncNow() {} },
    });
    s.speedState = null;
    s.verbsForgetProfile();          // must not throw
  });
});

suite('profile switch: Cướp Cô Hồn lets go without re-arming the Arena', () => {
  const src = read('js/ghost-offering-event.js');
  const fn = src.slice(src.indexOf('function forgetProfile(){'), src.indexOf('function syncLobbyCard()'));

  test('it stops the countdown, the socket and the animation loop', () => {
    assert.truthy(fn.includes('clearInterval(timer)'), 'the 1s countdown');
    assert.truthy(fn.includes('realtimeLink.close()'), 'the socket still holding A\'s grabs');
    assert.truthy(fn.includes('stopHookGame()'), 'the requestAnimationFrame loop');
    assert.truthy(fn.includes('stopQaBots()'));
    assert.truthy(/\bstate=null\b/.test(fn), 'and the event state itself');
    assert.truthy(/\bactive=false\b/.test(fn), 'isActive() gates switchScreen — it must go false');
  });

  test('it unlocks petBattleScreen, which pbForgetProfile does not', () => {
    assert.truthy(fn.includes("classList.remove('go-event-active')"));
    assert.truthy(fn.includes("removeProperty('overflow')"),
      'without this B\'s Arena lobby comes back unable to scroll');
    assert.truthy(fn.includes('delete screen.dataset.pbLobbySig'),
      'the same end state as pbForgetProfile, so the order of the two cannot matter');
  });

  test('and it must NOT do what close() does last: re-arm the arena poll', () => {
    assert.falsy(fn.includes('_pbStartPolling'),
      'close() ends with _pbStartPolling() — running that here would undo pbForgetProfile()');
    assert.falsy(fn.includes('refreshPetBattle'), 'and would fetch the arena as the child who left');
    assert.truthy(src.includes('_pbStartPolling'), 'close() itself still does it — that is why this is separate');
  });

  test('it is exported on the module object, the way this IIFE exposes things', () => {
    assert.truthy(/GhostOfferingEvent=\{open,openHumanTest,close,forgetProfile,/.test(src));
  });
});

suite('profile switch: the maths scratch pad is wiped between children', () => {
  test('mathBoardForgetProfile drops the strokes and closes the sheet', () => {
    let closed = 0;
    const s = loadModule('js/math-board.js', {},
      '\n;globalThis.__peekBoard = () => _mathBoardSession;');
    s.mathBoardSession().boards[0].strokes.push({ pts: [1, 2, 3] });
    assert.truthy(s.__peekBoard(), 'A has written on the pad');

    s.mathBoardCloseForSession = () => { closed++; };   // the browser-only UI half
    s.mathBoardForgetProfile();
    assert.equal(s.__peekBoard(), null, 'B must not open the board on A\'s handwriting');
    assert.equal(closed, 1, 'and the full-screen sheet must be taken down, not left painted');
  });

  test('it works with no browser half at all — that function is a window.* assignment', () => {
    const s = loadModule('js/math-board.js', {}, '\n;globalThis.__peekBoard = () => _mathBoardSession;');
    s.mathBoardSession();
    s.mathBoardForgetProfile();               // mathBoardCloseForSession is undefined here
    assert.equal(s.__peekBoard(), null);
  });

  test('nothing else was ever going to call it: reset only runs when a quiz ENDS', () => {
    const math = read('js/math.js');
    assert.truthy(math.includes('mathBoardReset'), 'js/math.js clears the pad…');
    const starts = math.split('_mathQuiz = {').length - 1;
    assert.truthy(starts >= 4, 'sanity: several roads start a maths quiz');
    // Every mathBoardReset() call in js/math.js sits in an END-of-quiz function.
    for (const m of math.matchAll(/mathBoardReset/g)) {
      const before = math.slice(0, m.index);
      const fnName = (before.match(/function (\w+)\([^)]*\)\s*\{(?![\s\S]*function \w+\()/) || [])[1];
      assert.truthy(fnName === 'finishMathQuiz' || fnName === 'abandonMathQuiz',
        'mathBoardReset is only called from a quiz ending, and switchUser() ends no quiz — got ' + fnName);
    }
  });
});

// ---- ✍️ rounds in progress -------------------------------------------------
// None of these has a clock. They leak by two roads, both of which are read out
// of js/app.js below rather than described: the is…Active() guards inside
// switchScreen, and buildStudyCheckpoint(), which reads them once a second and
// writes whichever it finds to localStorage tagged with the CURRENT user.

// [module, the quiz variable, the teardown, the is…Active guard, a live value]
const ROUNDS = [
  ['js/units.js', '_unitQuiz', 'unitsForgetProfile', 'isUnitPracticeActive',
    { unit: 3, questions: [{ w: { en: 'chicken' } }], idx: 0, answers: [null] }],
  ['js/phrases.js', '_phrQuiz', 'phrasesForgetProfile', 'isPhrasesQuizActive',
    { questions: [{ id: 'p1' }], idx: 0, answers: [null] }],
  ['js/wordform.js', '_wfQuiz', 'wordformForgetProfile', 'isWordformQuizActive',
    { questions: [{ id: 'wf-1' }], idx: 0, answers: [null] }],
  ['js/rewrite.js', '_rwQuiz', 'rewriteForgetProfile', 'isRewriteQuizActive',
    { questions: [{ id: 'rw-1' }], idx: 0, answers: [null] }],
  ['js/collocation.js', '_colQuiz', 'collocForgetProfile', 'isCollocActive',
    { questions: [{ id: 'col-1' }], idx: 0, answers: [null] }],
  ['js/grammar-ui.js', '_grammarQuizState', 'grammarForgetProfile', 'isGrammarQuizActive',
    { unitId: 1, questions: [{ id: 'g1' }], currentIdx: 0, answers: [] }],
  ['js/math.js', '_mathQuiz', 'mathForgetProfile', 'isMathQuizActive',
    { chapter: 1, questions: [{ id: 'm1' }], idx: 0, answers: [null] }],
  ['js/retrydrill.js', '_retryDrill', 'retryDrillForgetProfile', 'isRetryDrillActive',
    { key: 'math', queue: ['x'], idx: 0, revealed: false, answered: null, fixed: 0, missed: 0 }],
];

suite('profile switch: an unfinished round does not become the next child\'s', () => {
  for (const [file, varName, teardown, guard, live] of ROUNDS) {
    test(`${file}: ${teardown}() clears ${varName}, so ${guard}() goes quiet`, () => {
      const s = loadModule(file, {
        appState: { coins: 0 }, MATH_QUESTIONS: [], WORDFORM_QUESTIONS: [],
        PHRASES: [], REWRITE_QUESTIONS: [], COLLOCATION_QUESTIONS: [], GRAMMAR_UNITS: [],
      }, `\n;globalThis.__set = (v) => { ${varName} = v; };`
        + `\n;globalThis.__peek = () => ${varName};`);

      s.__set(live);
      assert.truthy(s[guard](), 'sanity: the previous child is mid-round');

      s[teardown]();
      assert.equal(s.__peek(), null, `${varName} must be dropped — it is A's work`);
      assert.falsy(s[guard](),
        `switchScreen reads ${guard}() and was asking B about a round that was never theirs`);
    });

    test(`${file}: ${teardown}() is SILENT and reuses the module's own clear`, () => {
      const src = read(file);
      const at = src.indexOf(`function ${teardown}()`);
      assert.truthy(at > 0, `${teardown} must be a real top-level function`);
      // The function body only: up to its own closing brace at column 0. Any
      // more and a following comment's prose would be read as code.
      const rest = src.slice(at);
      const end = rest.indexOf('\n}');
      const fn = rest.slice(0, end === -1 ? rest.length : end);
      assert.falsy(/\bconfirm\s*\(/.test(fn),
        'the quit✕ asks; this must not — the child has already gone, and whoever '
        + 'picks the iPad up next would be answering for them');
      assert.falsy(/switchScreen|renderTopicsHome|renderPhrasesHome|renderMathHome/.test(fn),
        'and it must not navigate: the caller is on its way to the profile picker');
      assert.truthy(/\babandon\w*\(\)/.test(fn),
        'it must reuse the module\'s existing clear rather than writing a second one');
    });

    test(`${file}: it is reachable — exported to Node and a plain global in the browser`, () => {
      const src = read(file);
      assert.truthy(new RegExp('^function ' + teardown + '\\(\\)', 'm').test(src),
        'a top-level function declaration is what a browser gets; an arrow inside '
        + 'module.exports is Node-only (see js/cups.js _resetCupReconcile)');
      // Only where the module has a Node door at all — js/grammar-ui.js has none
      // and is loaded straight into a vm sandbox by tests/setup.js.
      if (src.includes('module.exports')) {
        assert.truthy(src.includes(teardown + ','),
          `${teardown} must also be listed in module.exports, or no test can reach it`);
      }
    });
  }

  test('every one of them is actually registered in forgetProfileState', () => {
    const app = read('js/app.js');
    const fn = app.slice(app.indexOf('function forgetProfileState()'), app.indexOf('function switchUser()'));
    for (const [, , teardown] of ROUNDS) {
      assert.truthy(fn.includes(teardown), teardown + ' is not registered — the module is asked nothing');
    }
  });

  test('and the checkpoint really does read them, which is the road that persists', () => {
    const app = read('js/app.js');
    const fn = app.slice(app.indexOf('function buildStudyCheckpoint()'), app.indexOf('function saveStudyCheckpoint()'));
    for (const [, varName] of ROUNDS) {
      if (varName === '_retryDrill') continue;          // not checkpointed; it leaks by the guards only
      assert.truthy(fn.includes(varName),
        varName + ' is read by buildStudyCheckpoint, so a round left standing is '
        + 'written to localStorage under the NEXT child\'s name');
    }
    assert.truthy(fn.includes('user:currentUser') || fn.includes('user: currentUser'),
      'and it is tagged with whoever is logged in AT THAT MOMENT — that is the whole problem');
  });
});

suite('profile switch: the combo bonus is coins, and must not change hands', () => {
  test('an abandoned streak is not paid to whoever finishes the next round', () => {
    const s = loadModule('js/petcheer.js', { appState: { coins: 0 } });
    // A answers five in a row: PET_COMBO_STEP hits and the bonus accrues.
    const step = s.module.exports.PET_COMBO_STEP;   // a top-level const is script-scoped
    for (let i = 0; i < step; i++) s.petCheerAnswer(true);
    assert.truthy(s.petComboState().bonus > 0, 'sanity: A has earned a combo bonus');

    s.petCheerForgetProfile();
    assert.deepEqual(s.petComboState(), { streak: 0, best: 0, bonus: 0 });
    assert.equal(s.petComboBonus(), 0, 'B\'s next finished round must bank nothing of A\'s');
  });

  test('nothing else was ever going to clear it', () => {
    let hits = 0;
    for (const f of ['js/units.js', 'js/phrases.js', 'js/wordform.js', 'js/rewrite.js',
      'js/collocation.js', 'js/grammar-ui.js', 'js/math.js', 'js/mathwars.js']) {
      if (read(f).includes('petCheerReset')) hits++;
    }
    assert.equal(hits, 0,
      'petComboBonus() at the END of a round is the only clear — an abandoned round leaves it standing');
  });
});

suite('profile switch: js/app.js forgets its own per-child state too', () => {
  const app = read('js/app.js');
  const fn = app.slice(app.indexOf('function forgetProfileState()'), app.indexOf('function switchUser()'));

  test('the matching round is reset — the checkpoint reads lessonState as well', () => {
    assert.truthy(/lessonState = \{/.test(fn), 'lessonState must be put back to its empty shape');
    for (const key of ['roundWords', 'lessonPoints', 'matchedPairs', 'correctInLesson']) {
      assert.truthy(fn.includes(key), 'lessonState.' + key + ' must be reset');
    }
  });

  test('the two per-login checkpoint flags are cleared, including the one nothing reset', () => {
    assert.truthy(/_studyCheckpointRestored = false/.test(fn));
    assert.truthy(/_studyCheckpointWaited = false/.test(fn),
      'this one was never reset ANYWHERE: once A hit a slow lazy bank, every later '
      + 'child\'s own checkpoint was thrown away instead of waited for');
    // Prove the claim rather than asserting it in prose.
    const others = app.split('_studyCheckpointWaited').length - 1;
    assert.truthy(others >= 3, 'sanity: the flag is read and set elsewhere');
    // Its declaration is the ONLY other place it is set back to false: nothing
    // ever reset it at runtime, which is exactly what made it outlive a child.
    const resets = app.match(/_studyCheckpointWaited = false/g) || [];
    assert.equal(resets.length, 2, 'the declaration, and this teardown — nothing else');
    assert.truthy(/let _studyCheckpointWaited = false/.test(app), 'one of those two is the declaration');
  });

  test('the Home screen\'s history view is put back to the top', () => {
    assert.truthy(/currentHistoryTab = 'history'/.test(fn), 'B landed on A\'s Mistakes tab');
    assert.truthy(/historyPage = 0/.test(fn), 'and on page 4 of a list they had never seen');
    assert.truthy(/selectedDifficultyFilter = 'beginning'/.test(fn),
      'and inside A\'s word band, which is what "next lesson" is picked from');
  });

  test('the two page-lifetime timers are deliberately LEFT RUNNING', () => {
    assert.falsy(/_studyCheckpointTimer\s*=\s*null/.test(fn),
      'stopping the checkpoint saver would leave the NEXT child with no checkpointing at all; '
      + 'it re-reads currentUser every tick and saves nothing while there is no user');
    assert.falsy(/_updateRetryTimer\s*=\s*null/.test(fn),
      'the app-update nag belongs to the page, not to a child');
    assert.falsy(/_profileOriginScreen\s*=/.test(fn),
      'openProfile() sets it before anything can read it, so clearing it would be churn');
  });

  test('and buildStudyCheckpoint returns nothing at all with no user logged in', () => {
    const build = app.slice(app.indexOf('function buildStudyCheckpoint()'),
      app.indexOf('function saveStudyCheckpoint()'));
    assert.truthy(/if \(!currentUser\) return null;/.test(build),
      'the window between switchUser() and the next login must write nothing');
  });
});

// ===========================================================================
//  THE GUARD
//
//  Everything above is one bug found nineteen times. The shape is always the
//  same: a module keeps a child's state in a module-level variable, appState
//  is swapped underneath it, and nothing tells the module. This walks js/ and
//  fails when a module holds state of that shape without either a
//  forgetProfile of its own or an entry below saying, in words, why not.
//
//  Deliberately narrow. A `const` that never changes is not state; neither is
//  a plain cache of the static word bank, nor a string that only names which
//  sub-tab is showing. What it looks for is a MUTABLE CONTAINER OR FLAG — an
//  object, an array, a Set/Map, a null handle, a boolean latch — because that
//  is what every one of the nineteen turned out to be. If this ever cries
//  wolf, the fix is to narrow the shape, not to pad the allow-list.
// ===========================================================================

// A module-scope `let`/`var` whose initial value is a mutable container, a
// null handle, or a boolean latch. Strings and numbers are excluded on
// purpose: `_mathView = 'home'` is a view position, not a child's data.
const PER_CHILD_SHAPE = /^\s*(?:let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(\{|\[|null|false|true|new Set\(|new Map\()/;

// Files that hold state of that shape and do NOT have a forgetProfile.
// Every entry is a claim that was checked, and says what was checked.
const NO_TEARDOWN_NEEDED = {
  'battle.js':
    'DEAD CODE. renderBattleCard() and openBattleSetup() have no caller anywhere '
    + '(index.html, js/, css/, tests/): the two-player battle is unreachable, so '
    + 'battleState is never filled and its 100ms timer never starts. Delete the '
    + 'file or wire it up — but do not give an unreachable game a teardown.',
  'word-hunt.js':
    'DEAD CODE, same as battle.js: nothing calls startWordHunt() or '
    + 'renderWordHuntCard(), and #wordHuntOverlay is never filled. If it is ever '
    + 'wired up again it WILL need one — completeWordHunt() writes '
    + 'appState._huntWins and calls saveUserData(currentUser, …) from a timer.',
  'sentence-builder.js':
    'sentenceBuilderState is reassigned wholesale by offerSentenceBuilder() '
    + 'before its overlay is shown, and nothing reads it before that. The '
    + 'overlay is also inescapable except through saveSentence()/'
    + 'skipSentenceBuilder(), both of which close it — so it cannot still be '
    + 'open when the child reaches the profile picker.',
  'daily-task.js':
    'ALREADY GUARDED, and better than a teardown could: refresh() captures '
    + '`const asked = currentUser` before the await and returns early if '
    + 'currentUser has changed, so an in-flight reply cannot land in the next '
    + "child's appState. shieldBusy is cleared in a finally.",
  'armory.js':
    'busy is cleared in a finally; returnTo is set by open() before close() can '
    + 'read it; flash is consumed by the render() that settle() calls in the '
    + 'same tick, so none of the three can be observed by the next child.',
  'topics.js':
    '_wordTopicsCache is derived from the static word bank, not from the child '
    + '— the same words for everyone, so there is nothing to leak.',
  'lazy-data.js':
    'warmed is "have we started pre-warming the question banks?". The banks are '
    + 'static files shared by every profile.',
  'night-raid-art.js':
    'sharedBattleBoardCutout is a cached art cutout — a picture, identical for '
    + 'every child.',
  'night-raid-phaser.js':
    'runtimePromise memoises the one-time load of the Phaser runtime. A library, '
    + 'not a child.',
  'petbattlegame.js':
    'PB_MATE_IMAGES_LOADING is a latch around preloading the teammate sprite '
    + 'sheets — static art. The battle itself lives in js/petbattle.js _pbGame, '
    + 'which pbForgetProfile() destroys.',
  'math-fight-bank.js':
    'MATH_FIGHT_BANK is the question bank itself, a `var` only so the browser '
    + 'and the test sandbox both see it. Never written to.',
  'mathwars-bank.js':
    'MATH_WARS_BANK is static arithmetic data shared by every profile. '
    + 'Round selection filters and shuffles copies; no child state is stored in it.',
};

function moduleScopeState(file) {
  const src = read('js/' + file);
  const lines = src.split('\n');
  // Module scope is column 0 — except in a file that is ONE IIFE from its
  // first line of code to its last, where the module's own scope is indented
  // by two. Requiring the IIFE to be the FIRST thing in the file is what keeps
  // js/petbattlegame.js's function locals out of this.
  const first = lines.find(l => l.trim() && !l.trim().startsWith('//')) || '';
  const wrapped = /^(?:var|const|let)\s+[A-Za-z_$][\w$]*\s*=\s*\(?(?:function\s*\(|\(\s*[\w,\s]*\)\s*=>)/.test(first)
    || /^\(function\s*\(/.test(first);
  const found = [];
  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    if (indent !== 0 && !(wrapped && indent === 2)) continue;
    const m = line.match(PER_CHILD_SHAPE);
    if (m) found.push(m[1]);
  }
  return found;
}

// The object an IIFE module hangs itself on: `var NightRaid = (() => {…` or
// `global.GhostOfferingEvent = {…}`. Null for a script that defines globals.
function namespaceOf(file, src) {
  const first = src.split('\n').find(l => l.trim() && !l.trim().startsWith('//')) || '';
  const named = first.match(/^(?:var|const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(/);
  if (named) return named[1];
  const onGlobal = src.match(/^\s*global\.([A-Za-z_$][\w$]*)\s*=\s*\{/m);
  return onGlobal ? onGlobal[1] : null;
}

suite('GUARD: a module that keeps per-child state must know how to forget it', () => {
  const files = fs.readdirSync(path.join(ROOT, 'js'))
    .filter(f => f.endsWith('.js') && f !== 'phaser.min.js').sort();

  test('the detector still sees the bug it was written for', () => {
    // If a refactor ever makes this stop finding _pbGame, the guard has quietly
    // stopped guarding — so this is checked before anything is concluded.
    assert.truthy(moduleScopeState('petbattle.js').includes('_pbGame'),
      'the original leak must still be detectable, or this whole suite is theatre');
    assert.truthy(moduleScopeState('math-fight.js').includes('st'),
      'and so must state inside an IIFE module');
    assert.falsy(moduleScopeState('petbattlegame.js').includes('allDone'),
      'while a function local inside a non-IIFE file must NOT be reported');
    assert.falsy(moduleScopeState('math.js').includes('_mathView'),
      "and a plain string view position is not a child's data");
  });

  for (const file of files) {
    const held = moduleScopeState(file);
    if (!held.length) continue;
    test(`js/${file} holds ${held.join(', ')}`, () => {
      const src = read('js/' + file);
      const hasTeardown = /[Ff]orgetProfile/.test(src);
      const excused = NO_TEARDOWN_NEEDED[file];
      if (hasTeardown) {
        assert.falsy(excused, `js/${file} has a teardown AND an allow-list entry — drop the entry`);
        return;
      }
      assert.truthy(excused,
        `js/${file} keeps module-level per-child state (${held.join(', ')}) with no `
        + 'forgetProfile. Two children share one iPad: give it a SILENT teardown and '
        + 'register it in forgetProfileState() (js/app.js), or add an entry to '
        + 'NO_TEARDOWN_NEEDED in this file saying why it cannot be observed by the '
        + 'next child.');
      assert.truthy(excused.length > 60,
        `the reason for js/${file} must be an actual reason, not a shrug`);
    });
  }

  test('the allow-list has no entries for files that no longer qualify', () => {
    const stale = Object.keys(NO_TEARDOWN_NEEDED)
      .filter(f => !fs.existsSync(path.join(ROOT, 'js', f)) || !moduleScopeState(f).length);
    assert.deepEqual(stale, [],
      'these are excused from a rule they no longer trip — delete them: ' + stale.join(', '));
  });

  test('every teardown in js/ is actually reached from forgetProfileState', () => {
    const app = read('js/app.js');
    const fn = app.slice(app.indexOf('function forgetProfileState()'), app.indexOf('function switchUser()'));
    const missing = [];
    for (const file of files) {
      if (file === 'app.js') continue;
      const src = read('js/' + file);
      // Named teardowns: `function xForgetProfile()` for a globals script,
      // `function forgetProfile()` inside an IIFE module.
      for (const m of src.matchAll(/^\s*function\s+(\w*[Ff]orgetProfile)\s*\(/gm)) {
        const name = m[1];
        let reached;
        if (name === 'forgetProfile') {
          // An IIFE's member is reached through its namespace object — and the
          // namespace is read out of the file rather than matched loosely, so
          // "some module calls .forgetProfile()" cannot excuse this one.
          const ns = namespaceOf(file, src);
          assert.truthy(ns, 'js/' + file + ' names its teardown forgetProfile but exposes no namespace');
          reached = new RegExp('\\b' + ns + '\\.forgetProfile\\(\\)').test(fn);
          if (!reached) missing.push('js/' + file + ' → ' + ns + '.forgetProfile()');
          continue;
        }
        reached = new RegExp('\\b' + name + '\\(\\)').test(fn);
        if (!reached) missing.push('js/' + file + ' → ' + name);
      }
    }
    assert.deepEqual(missing, [],
      'a teardown nobody calls is worse than none — it reads as handled: ' + missing.join(', '));
  });

  test('and none of them asks a question or navigates', () => {
    const offenders = [];
    for (const file of files) {
      const src = read('js/' + file);
      for (const m of src.matchAll(/^\s*function\s+(\w*[Ff]orgetProfile)\s*\(\)\s*\{/gm)) {
        const rest = src.slice(m.index);
        // The body only, to its own closing brace at this declaration's indent.
        const indent = ' '.repeat(m[0].length - m[0].trimStart().length);
        const end = rest.indexOf('\n' + indent + '}');
        const body = rest.slice(0, end === -1 ? rest.length : end);
        if (/\bconfirm\s*\(/.test(body)) offenders.push('js/' + file + ' ' + m[1] + ' asks a question');
        if (/\bswitchScreen\s*\(/.test(body)) offenders.push('js/' + file + ' ' + m[1] + ' navigates');
      }
    }
    assert.deepEqual(offenders, [],
      'a teardown runs while the child is already walking away: a confirm() would be '
      + 'answered by whoever picks the iPad up next, and a switchScreen() would fight '
      + 'the caller for the screen. ' + offenders.join('; '));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
