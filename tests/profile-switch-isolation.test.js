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

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
