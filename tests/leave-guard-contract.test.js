// leave-guard-contract.test.js — THE contract behind the leave rule: every
// exercise in the app is CLAIMED here, and every claim is EXECUTED against it.
//
// The rule (the parent's words): while an exercise is in progress, any way
// out — the bottom bar (Home / another Book via openBook() / Nông trại via
// openNightRaid()), a Daily Task deep link — must confirm(). Cancel keeps the
// child exactly where they were. OK leaves cleanly: state cleared, the bottom
// bar back, _busyWithTimedActivity() false, no study checkpoint left behind.
//
// Two halves, same idea as tests/verify/manifest.js ("claim it or the run
// goes RED"):
//
//   PART 1 — the inventory must be claimed. Signals are scraped from the
//   code — every is*Active() helper, every name in js/app.js _BUSY_CHECKS,
//   every retry-drill key, every <div class="screen"> in index.html, every
//   start*/open* function that ends up drawing an answer control — and each
//   one must be owned by an ACTIVITIES entry below or sit in an allowlist
//   with a one-line reason. A new isFooActive, a new drill key, a new screen
//   or a new startFooQuiz() turns this file red until someone registers a
//   recipe.
//
//   PART 2 — the protocol, executed. For every ACTIVITIES entry the app is
//   booted for real (tests/verify/client.js), the recipe brings the activity
//   to a state with work on the table, and every exit route is tried with
//   confirm() answered "no" (exactly one prompt, refused, nothing moved) and
//   then "yes" (gone, clean). One booted app per entry, shared by its routes.
//
// What this file found on the day it was written (2026-09-11): the Verbs
// owed-drill (js/retrydrill.js key 'verbs') had no switchScreen branch — the
// bottom bar left it RUNNING under the next tab, isRetryDrillActive() stayed
// true and app updates were held back. Since the cut of 2026-09-21 the app
// has two activities, both on the Word screen: the Book practice and its
// owed-words drill (js/units.js, js/retrydrill.js key 'word'). The three
// Book buttons share that screen, so another Book is a way out too.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { mountApp, loginTestUser, stubServer } = require('./verify/client.js');
const { El } = require('./domshim.js');

const ROOT = path.join(__dirname, '..');
const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';
const settle = async (n) => { for (let i = 0; i < (n || 8); i++) await new Promise((r) => setImmediate(r)); };
const activeScreen = (h) => { const s = h.doc.querySelector('.screen.active'); return s ? s.id : null; };
const navShown = (h) => h.el('bottomNav').style.display !== 'none';

// PetBattleGame and the Night Raid renderer draw into a <canvas> that arrives
// through innerHTML, which the DOM shim builds without getContext (mountApp
// patches createElement only). Same additive stub as leave-guard-fight-arena.
if (!El.prototype.getContext) {
  const CTX = ('arc arcTo beginPath bezierCurveTo clearRect clip closePath drawImage ellipse fill fillRect '
    + 'fillText lineTo moveTo quadraticCurveTo rect resetTransform restore rotate save scale setLineDash '
    + 'setTransform stroke strokeRect strokeText transform translate putImageData').split(' ');
  El.prototype.getContext = function () {
    if (this.tagName !== 'CANVAS') return null;
    if (!this._ctx) {
      const c = { canvas: this };
      for (const m of CTX) c[m] = () => {};
      c.measureText = (t) => ({ width: String(t).length * 6, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      c.getImageData = (x, y, w, h) => ({ width: w | 0, height: h | 0, data: new Uint8Array(Math.max(0, (w | 0) * (h | 0) * 4)) });
      c.createLinearGradient = () => ({ addColorStop() {} });
      c.createRadialGradient = () => ({ addColorStop() {} });
      c.createPattern = () => null;
      this._ctx = c;
    }
    return this._ctx;
  };
}

// ---------------------------------------------------------------------------
// Driving helpers shared by the recipes. Each recipe is the start path the
// matching per-feature file uses (tests/leave-guard-*.test.js), trimmed to
// "get in, put one answer on the table".
// ---------------------------------------------------------------------------

function login(h, overrides) {
  loginTestUser(h, Object.assign({ coins: 100 }, overrides || {}));
  h.sandbox.__confirmAnswer = true;
  h.sandbox.__confirmLog.length = 0;
}

// Every onclick a screen renders, and "tap the first control matching re".
const onclicksOf = (h, screenId) => h.el(screenId).querySelectorAll('[onclick]').map((n) => n.getAttribute('onclick') || '');
function tap(h, screenId, re) {
  const code = onclicksOf(h, screenId).find((c) => re.test(c));
  assert.truthy(code, screenId + ' renders no control matching ' + re + ' — has: ' + Array.from(new Set(onclicksOf(h, screenId))).join(' | '));
  return h.doc.__runInline(code);
}

// --- the Word screen: one engine (js/units.js), three Book buttons, a lazy
// bank (js/word-data.js) and one owed-words queue ('word').
async function openWordTab(h, set) {
  assert.equal(h.sandbox.openBook(set || 'pr1'), true);                  // the bottom-bar button
  await h.sandbox.LazyData.ensure('wordScreen'); await settle();
  assert.equal(activeScreen(h), 'wordScreen');
  assert.truthy(h.el('wordUnitsBar').innerHTML.includes("startUnitPractice('" + (set || 'pr1') + "-1')"), 'Unit 1 of the book is on the bar');
}
// A Book other than the one the activity is on: tapping it is a way out.
const otherBook = (h) => (h.sandbox.currentUnitSet('word') === 'pr1' ? 'pr2' : 'pr1');

// --- the shared retry drill (js/retrydrill.js) ---
function drillSnap(h, screenId) {
  const d = h.peek('_retryDrill');
  return JSON.stringify({ key: d.key, idx: d.idx, fixed: d.fixed, missed: d.missed, answered: !!d.answered,
    queue: d.queue.map((q) => h.sandbox.retryCfg(d.key).idOf(q)), screen: h.el(screenId).innerHTML });
}

// ---------------------------------------------------------------------------
// THE REGISTRY. One entry per exercise/game:
//   id       a name for the failure message
//   screen   the screen the activity lives on (its own tab is not a way out)
//   busy     the is*Active global (a string — must be in _BUSY_CHECKS) or a
//            () => bool over the booted app for the object-style games
//   claims   what else this entry owns from the scraped inventory: extra
//            helper names, drill keys, start*/open* functions
//   start    async (h): log in, reach the activity the way a child does and
//            put one answer/move on the table
//   snap     (h) => string: what "exactly where they were" means
//   answersOne  false only where the child has no move to make (documented)
//   deepLink    the Daily Task kind that drops the round (default 'word:pr2-7',
//               a unit of ANOTHER book — every deep link lands on wordScreen)
// ---------------------------------------------------------------------------
const ACTIVITIES = [
  // --- the Book practice and its owed-words drill: js/units.js on wordScreen (UNIT_HOSTS.word) ---
  { id: 'word practice', screen: 'wordScreen', busy: 'isUnitPracticeActive',
    claims: { starts: ['startUnitPractice'] },
    start: async (h) => {
      login(h);
      await openWordTab(h);
      tap(h, 'wordUnitsBar', /^startUnitPractice\('pr1-1'\)$/);           // Book 1 · Unit 1
      const st = h.peek('_unitQuiz');
      assert.equal(st.unit, 'pr1-1', 'the Book practice is running');
      assert.equal(h.sandbox.unitPracticeScreen(), 'wordScreen', 'and it belongs to the Word screen');
      assert.truthy(h.el('wordDetail').innerHTML.includes('unitTextInput'), 'its answer box is on the Word screen');
      h.el('unitTextInput').value = st.questions[st.idx].w.en;
      h.sandbox.submitUnitAnswer();
      tap(h, 'wordDetail', /^nextUnitQuestion\(/);
      assert.equal(h.peek('_unitQuiz').idx, 1, 'question 2 is open');
    },
    snap: (h) => { const s = h.peek('_unitQuiz'); return JSON.stringify({ idx: s.idx, answers: s.answers, set: h.sandbox.currentUnitSet('word'), screen: h.el('wordDetail').innerHTML }); } },
  { id: 'word drill', screen: 'wordScreen', busy: (h) => h.sandbox.retryDrillKey() === 'word',
    // startRetryDrill is the shared engine's entry (js/retrydrill.js): owned
    // here, on behalf of the one drill key.
    claims: { fns: ['isRetryDrillActive'], drills: ['word'], starts: ['startUnitRetry', 'startRetryDrill'] },
    start: async (h) => {
      login(h);
      await openWordTab(h);                                                // the bank is lazy: ids need its words
      const bank = h.peek('UNIT_WORDS_PR1');
      h.state().wordRetry = ['pr1|' + bank[0].en, 'pr1|' + bank[1].en];
      h.sandbox.saveUserData(h.peek('currentUser'), h.state());
      h.sandbox.renderWordHome();
      assert.equal(h.sandbox.retryCount('word'), 2, 'two words are owed');
      tap(h, 'wordUnitsBar', /^startRetryDrill\('word'\)$/);
      assert.truthy(h.el('retryInput'), 'the first owed word is on screen');
      const st = h.peek('_retryDrill');
      h.el('retryInput').value = st.queue[0].en;
      h.sandbox.submitRetryAnswer();
      tap(h, 'wordDetail', /^nextRetryQuestion\(\)$/);
      assert.truthy(h.sandbox.isRetryDrillActive(), 'one word fixed, one still owed');
    },
    snap: (h) => drillSnap(h, 'wordScreen') },
];

// Names in js/app.js _BUSY_CHECKS that are not an exercise's own is*Active.
const BUSY_CHECKS_NOT_EXERCISES = {};

// Screens in index.html on which no exercise runs.
const SCREENS_WITHOUT_EXERCISE = {
  onboardingScreen: 'profile picker — nothing to lose',
  homeScreen: 'Home — cards, the dog and the streak; every round it starts runs on wordScreen',
  dailyTaskScreen: 'the Daily Task list; its "Vào học" buttons deep-link INTO an exercise elsewhere (the DailyTask.go route below)',
  profileScreen: 'settings and history — reading',
  nightRaidScreen: 'Nông trại — the farm builder; no round runs on it (no raid buttons since the cut)',
};

// start*/open* functions that end up drawing an answer control but are not
// an exercise. Each reason names what the function is; where the reason is
// checkable, `still` proves it on every run.
const START_NOT_EXERCISES = {
  openWord: { why: 'the Word hub (unit cards) — js/units.js UNIT_HOSTS.word; its practice is "word practice" above' },
  openBook: { why: 'a Book button: switchUnitSet + switchScreen(wordScreen), which paints the unit cards; it starts no round (a route below proves it asks before dropping one)' },
  startPetRename: { why: "the pet's name box on Home" },
};

// ---------------------------------------------------------------------------
// PART 1 — scraping the inventory
// ---------------------------------------------------------------------------

const JS_FILES = fs.readdirSync(path.join(ROOT, 'js')).filter((f) => f.endsWith('.js'))
  .map((f) => ({ name: 'js/' + f, src: fs.readFileSync(path.join(ROOT, 'js', f), 'utf8') }));
const INDEX_HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// The text between the `{` at `from` and its matching `}`.
function braced(src, from) {
  const i = src.indexOf('{', from);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return src.slice(i, j + 1);
  }
  return src.slice(i);
}

// The text from `from` to the `;` that ends the statement, brackets balanced.
function statement(src, from) {
  let depth = 0;
  for (let j = from; j < src.length; j++) {
    const c = src[j];
    if (c === '{' || c === '(' || c === '[') depth++;
    else if (c === '}' || c === ')' || c === ']') depth--;
    else if (c === ';' && depth === 0) return src.slice(from, j + 1);
  }
  return src.slice(from);
}

// (a) every top-level is*Active() → { name: file }
function scrapeIsActive() {
  const out = {};
  for (const f of JS_FILES) {
    const re = /^\s*(?:async\s+)?function\s+(is[A-Z]\w*Active)\s*\(/gm;
    let m; while ((m = re.exec(f.src))) out[m[1]] = f.name;
  }
  return out;
}
// (b) js/app.js _BUSY_CHECKS
function scrapeBusyChecks() {
  const src = JS_FILES.find((f) => f.name === 'js/app.js').src;
  const i = src.indexOf('const _BUSY_CHECKS = [');
  assert.truthy(i >= 0, 'js/app.js declares _BUSY_CHECKS');
  const body = src.slice(i, src.indexOf('];', i));
  return body.match(/'(\w+)'/g).map((s) => s.slice(1, -1));
}
// (d) every retry-drill key → { key: file }
function scrapeDrillKeys() {
  const out = {};
  for (const f of JS_FILES) {
    const re = /defineRetryDrill\(\s*([{\w]+)/g;
    let m;
    while ((m = re.exec(f.src))) {
      if (m[1] === 'cfg') continue;                       // the engine's own declaration
      let body;
      if (m[1] === '{') body = braced(f.src, m.index);
      else {
        // A literal (`const X = {…}`) or one derived from another config
        // (`const X = Object.assign({}, BASE, { key: … })`, js/units.js
        // WORD_RETRY_CONFIG): the whole declaration, either way.
        const d = f.src.indexOf('const ' + m[1] + ' = ');
        assert.truthy(d >= 0, f.name + ': ' + m[1] + ' is declared');
        body = statement(f.src, d);
      }
      const k = /key:\s*'(\w+)'/.exec(body);
      assert.truthy(k, f.name + ': defineRetryDrill without a key');
      out[k[1]] = f.name;
    }
  }
  return out;
}
// (e) every screen in index.html
function scrapeScreens() {
  return (INDEX_HTML.match(/<div class="screen[^"]*" id="(\w+)"/g) || []).map((s) => /id="(\w+)"/.exec(s)[1]);
}
// (f) every top-level start*/open* function whose call graph (any depth,
// top-level functions across js/) reaches a body that draws a `.grammar-option`
// or an `<input` → { name: file }. A heuristic: it names the shape every quiz
// in this app has (option buttons or a typed box), not a guarantee.
function scrapeStarters() {
  const fns = new Map();
  for (const f of JS_FILES) {
    const re = /^(?:async\s+)?function\s+([A-Za-z_]\w*)\s*\(/gm;
    let m; while ((m = re.exec(f.src))) fns.set(m[1], { file: f.name, body: braced(f.src, m.index) });
  }
  const memo = new Map();
  const renders = (name, seen) => {
    if (memo.has(name)) return memo.get(name);
    const fn = fns.get(name);
    if (!fn || seen.has(name)) return false;
    seen.add(name);
    let hit = /grammar-option|<input/.test(fn.body);
    if (!hit) for (const c of fn.body.match(/\b[A-Za-z_]\w*(?=\s*\()/g) || []) { if (fns.has(c) && renders(c, seen)) { hit = true; break; } }
    memo.set(name, hit);
    return hit;
  };
  const out = {};
  for (const [name, fn] of fns) if (/^(start|open)[A-Z]/.test(name) && renders(name, new Set())) out[name] = fn.file;
  return out;
}

// What the registry claims.
const claimed = { busy: new Set(), fns: new Set(), drills: new Set(), starts: new Set(), screens: new Set() };
for (const a of ACTIVITIES) {
  if (typeof a.busy === 'string') claimed.busy.add(a.busy);
  claimed.screens.add(a.screen);
  for (const n of (a.claims && a.claims.fns) || []) claimed.fns.add(n);
  for (const n of (a.claims && a.claims.drills) || []) claimed.drills.add(n);
  for (const n of (a.claims && a.claims.starts) || []) claimed.starts.add(n);
}

function unclaimed(found, sets, label) {
  return Object.keys(found).filter((n) => !sets.some((s) => s.has(n)))
    .map((n) => n + ' (' + found[n] + ')');
}
const HOW = ' — register it in ACTIVITIES with a start recipe, or allowlist it with a reason';

// One booted app with every lazy group landed, for the runtime checks.
async function bootEverything() {
  const h = mountApp();
  assert.deepEqual(h.loadErrors, [], 'the app boots');
  login(h);
  for (const id of scrapeScreens()) {
    if (h.sandbox.LazyData.filesFor(id).length) await h.sandbox.LazyData.ensure(id);
  }
  await settle();
  assert.deepEqual(h.loadErrors, [], 'every lazy group loads');
  return h;
}

suite('leave-guard contract · PART 1 · the inventory is claimed', () => {
  test('the registry itself: unique ids, every screen real, every string busy a runtime function', async () => {
    const ids = ACTIVITIES.map((a) => a.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate ids: ' + ids.filter((x, i) => ids.indexOf(x) !== i).join(', '));
    const screens = new Set(scrapeScreens());
    for (const a of ACTIVITIES) {
      assert.truthy(screens.has(a.screen), a.id + ': screen ' + a.screen + ' is not in index.html');
      assert.truthy(typeof a.start === 'function' && typeof a.snap === 'function', a.id + ': needs start() and snap()');
    }
    const h = await bootEverything();
    for (const a of ACTIVITIES) {
      if (typeof a.busy === 'string') assert.equal(typeof h.sandbox[a.busy], 'function', a.id + ': busy "' + a.busy + '" is not a global function');
    }
  });

  test('(a) every is*Active() in js/ belongs to an activity', () => {
    const found = scrapeIsActive();
    assert.deepEqual(Object.keys(found).sort(), ['isRetryDrillActive', 'isUnitPracticeActive'], 'the scrape works: the two activities left');
    assert.deepEqual(unclaimed(found, [claimed.busy, claimed.fns]), [], 'unclaimed is*Active helpers' + HOW);
    for (const n of [...claimed.busy, ...claimed.fns]) assert.truthy(found[n], 'stale claim: ' + n + ' is no longer declared in js/');
  });

  test('(b) _BUSY_CHECKS: every registry busy global is listed, every listed name is claimed and exists at runtime', async () => {
    const list = scrapeBusyChecks();
    for (const n of claimed.busy) assert.contains(list, n, n + ' guards a leave but is missing from js/app.js _BUSY_CHECKS — an update would reload over it');
    const owned = new Set([...claimed.busy, ...claimed.fns, ...Object.keys(BUSY_CHECKS_NOT_EXERCISES)]);
    const stray = list.filter((n) => !owned.has(n));
    assert.deepEqual(stray, [], 'names in _BUSY_CHECKS nobody claims' + HOW);
    for (const n of Object.keys(BUSY_CHECKS_NOT_EXERCISES)) assert.contains(list, n, 'stale allowlist entry: ' + n);
    const h = await bootEverything();
    for (const n of list) assert.equal(typeof h.sandbox[n], 'function', '_BUSY_CHECKS names ' + n + ', which is not a function once every group has loaded');
  });

  test('(d) every retry-drill key is an activity', async () => {
    const found = scrapeDrillKeys();
    assert.deepEqual(Object.keys(found), ['word'], 'exactly one drill key is registered by the app');
    assert.deepEqual(unclaimed(found, [claimed.drills]), [], 'unclaimed drill keys' + HOW);
    for (const n of claimed.drills) assert.truthy(found[n], 'stale claim: drill key ' + n + ' is no longer defined');
    const h = await bootEverything();
    assert.deepEqual(Object.keys(h.peek('RETRY_DRILLS')).sort(), Object.keys(found).sort(), 'the runtime RETRY_DRILLS differ from what the scrape found');
  });

  test('(e) every <div class="screen"> in index.html is an activity\'s screen or allowlisted', () => {
    const found = {};
    for (const id of scrapeScreens()) found[id] = 'index.html';
    assert.deepEqual(unclaimed(found, [claimed.screens, new Set(Object.keys(SCREENS_WITHOUT_EXERCISE))]), [], 'unclaimed screens' + HOW);
    for (const n of Object.keys(SCREENS_WITHOUT_EXERCISE)) assert.truthy(found[n], 'stale allowlist entry: ' + n + ' is not in index.html');
  });

  test('(f) every start*/open* that draws an answer control is an activity\'s start or allowlisted', () => {
    const found = scrapeStarters();
    assert.truthy(Object.keys(found).length >= 4, 'the scrape works (' + Object.keys(found).length + ')');
    assert.deepEqual(unclaimed(found, [claimed.starts, new Set(Object.keys(START_NOT_EXERCISES))]), [], 'unclaimed start*/open* functions' + HOW);
    for (const n of claimed.starts) assert.truthy(found[n], 'stale claim: ' + n + ' no longer exists or no longer draws an answer control');
    for (const [n, entry] of Object.entries(START_NOT_EXERCISES)) {
      assert.truthy(found[n], 'stale allowlist entry: ' + n);
      assert.truthy(entry.why, n + ': an allowlist entry needs a reason');
      if (entry.still) assert.truthy(entry.still(), n + ': its allowlist reason no longer holds — "' + entry.why + '"');
    }
  });
});

// ---------------------------------------------------------------------------
// PART 2 — the protocol, executed for every entry
// ---------------------------------------------------------------------------

// Every way out. `lands` is the screen a "yes" would reach; a route whose
// destination is the activity's own screen is not a way out and is skipped.
const ROUTES = [
  { name: "switchScreen('homeScreen')", lands: () => 'homeScreen', reports: true, go: (h) => h.sandbox.switchScreen('homeScreen') },
  // The three Book buttons share wordScreen. Another Book lands on the same
  // screen but repaints it with that book's cards — the round is gone from
  // view — so it IS a way out (js/app.js switchScreen says so too).
  { name: 'openBook(<another book>)', lands: () => 'wordScreen', wayOut: true, reports: true, go: (h) => h.sandbox.openBook(otherBook(h)) },
  { name: 'openNightRaid()', lands: () => 'nightRaidScreen', reports: false, go: async (h) => { await h.sandbox.openNightRaid(); } },
  // Every catalog entry deep-links INTO a Book practice on wordScreen; one
  // for another book's unit replaces the round on the table.
  { name: 'DailyTask.go(<deep link>)', reports: true, wayOut: true,
    lands: (h, a) => h.peek('DailyTaskCatalog').get(a.deepLink || 'word:pr2-7').go.screen,
    go: (h, a) => h.peek('DailyTask').go(a.deepLink || 'word:pr2-7') },
];

const isBusy = (h, a) => (typeof a.busy === 'string' ? !!h.sandbox[a.busy]() : !!a.busy(h));

for (const a of ACTIVITIES) {
  suite('leave-guard contract · ' + a.id, () => {
    let h = null;
    const app = () => { assert.truthy(h, a.id + ': the app did not boot (see the first test of this suite)'); return h; };

    test('boots, starts the activity and is busy', async () => {
      const booted = mountApp();
      assert.deepEqual(booted.loadErrors, [], 'the app boots');
      await a.start(booted);
      await settle();
      h = booted;
      assert.equal(activeScreen(h), a.screen, 'the activity is on its own screen');
      assert.truthy(isBusy(h, a), a.id + ': busy after start');
      assert.truthy(h.sandbox._busyWithTimedActivity(), a.id + ': _busyWithTimedActivity() knows (an update must wait)');
      assert.deepEqual(h.loadErrors, [], 'nothing threw while loading');
    });

    for (const r of ROUTES) {
      test(r.name + ' → Cancel: asks once, refuses, nothing moves', async () => {
        const H = app();
        if (!r.wayOut && r.lands(H, a) === a.screen) return;          // the activity's own tab: not a way out
        assert.truthy(isBusy(H, a), 'still busy going in');
        const before = a.snap(H);
        const screen = activeScreen(H);
        H.sandbox.__confirmAnswer = false;
        H.sandbox.__confirmLog.length = 0;
        const res = await r.go(H, a);
        await settle();
        assert.equal(H.sandbox.__confirmLog.length, 1, r.name + ': must ask exactly once (asked ' + H.sandbox.__confirmLog.length + ': ' + H.sandbox.__confirmLog.join(' | ') + ')');
        if (r.reports) assert.equal(res, false, r.name + ': must report the refusal');
        assert.truthy(isBusy(H, a), r.name + ': Cancel must keep the activity running');
        assert.equal(activeScreen(H), screen, r.name + ': Cancel must not change the screen');
        assert.equal(a.snap(H), before, r.name + ': Cancel must leave the state and the screen exactly as they were');
      });
    }

    test("OK on the first way out: leaves cleanly", async () => {
      const H = app();
      const r = ROUTES.find((x) => x.wayOut || x.lands(H, a) !== a.screen);
      const lands = r.lands(H, a);
      H.sandbox.__confirmAnswer = true;
      H.sandbox.__confirmLog.length = 0;
      const res = await r.go(H, a);
      await settle(10);
      assert.equal(H.sandbox.__confirmLog.length, 1, r.name + ': asks once on the way out');
      if (r.reports) assert.equal(res, true, r.name + ': OK must let the leave happen');
      assert.equal(activeScreen(H), lands, 'landed on ' + lands);
      assert.falsy(isBusy(H, a), 'the activity is over');
      assert.falsy(H.sandbox._busyWithTimedActivity(), '_busyWithTimedActivity() is false — an update may proceed');
      assert.truthy(navShown(H), 'the bottom bar is back');
      assert.falsy(H.el('bottomNav').hasAttribute('aria-hidden'), 'and not aria-hidden');
      assert.equal(H.sandbox.buildStudyCheckpoint(), null, 'nothing left to checkpoint');
      H.sandbox.saveStudyCheckpoint();
      assert.equal(H.store[CHECKPOINT_KEY], undefined, 'no stored checkpoint offers the round back');
      assert.falsy(H.el(lands).classList.contains('lazy-css-pending'), 'the destination is not hidden behind a pending stylesheet');
      assert.falsy(H.doc.documentElement.classList.contains('math-board-open'), 'no board lock on <html>');
      assert.equal(H.doc.body.className, '', 'no body class left behind');
      // No stale flag: the next switch asks nothing.
      H.sandbox.__confirmAnswer = false;
      H.sandbox.__confirmLog.length = 0;
      assert.equal(H.sandbox.switchScreen(lands === 'homeScreen' ? 'dailyTaskScreen' : 'homeScreen'), true, 'the next switch goes through');
      assert.equal(H.sandbox.__confirmLog.length, 0, 'and asks nothing');
      assert.deepEqual(H.consoleLog.error, [], 'console.error stayed quiet');
    });
  });
}

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
