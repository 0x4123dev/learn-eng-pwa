// tests/profile-switch-isolation.test.js — one iPad, two children.
//
// Reported from real use: a child has two accounts on the same device. They
// switch from account A to account B — and see A's half-finished work: A's
// practice round, A's combo bonus, A's farm builder zone.
//
// The cause is not the switcher losing appState (it clears that correctly). It
// is that live state lives in MODULE variables (`_unitQuiz`, `_retryDrill`,
// `_petCombo`, the farm's `lastHarvest` …) which no profile change ever
// cleared. Guards like isUnitPracticeActive() are right within one child and
// wrong across two, so it is fixed at the root: every module that keeps a
// child's state exposes a SILENT teardown, and js/app.js forgetProfileState()
// calls each one on the way to the profile picker.
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
// readable.
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

  test('forgetProfileState reaches the farm, the Book practice, the drill, the combo, Home and the account link — and tolerates a module that is not loaded', () => {
    const fn = app.slice(app.indexOf('function forgetProfileState()'), app.indexOf('function switchUser()'));
    assert.truthy(fn.includes('NightRaid') && fn.includes('NightRaid.forgetProfile()'), 'the farm must be torn down');
    for (const name of ['unitsForgetProfile', 'retryDrillForgetProfile', 'petCheerForgetProfile', 'homeForgetProfile']) {
      assert.truthy(fn.includes(name + '()'), name + ' must be called');
    }
    assert.truthy(fn.includes('EngAuth.forgetProfile()'), 'and the account-link status');
    assert.truthy((fn.match(/typeof/g) || []).length >= 6, 'each call must be guarded — a lazy module may not be loaded');
    assert.truthy((fn.match(/try\s*\{/g) || []).length >= 6, 'and must not let one failure block the others');
  });

  test('the farm exposes a SILENT teardown: it must not ask a question or navigate', () => {
    const nr = read('js/night-raid.js');
    assert.truthy(/return Object\.freeze\(\{forgetProfile/.test(nr), 'forgetProfile must be exported');
    const fn = nr.slice(nr.indexOf('function forgetProfile()'), nr.indexOf('function cleanup()'));
    assert.truthy(fn.includes('cleanup()'), 'it must stop the timers');
    assert.falsy(fn.includes('confirm'), 'it must not ask — the child has already left');
    assert.falsy(fn.includes('switchScreen'), 'and must not navigate; the caller is going to the picker');
    for (const held of ['builderZone', 'lastHarvest', 'homeRead', 'pendingBuildPurchase']) {
      assert.truthy(fn.includes(held), 'forgetProfile must reset ' + held);
    }
  });
});

// ---- ✍️ rounds in progress -------------------------------------------------
// Neither of these has a clock. They leak by two roads, both of which are read
// out of js/app.js below rather than described: the is…Active() guards inside
// switchScreen, and buildStudyCheckpoint(), which reads the Book practice at
// every save and writes whatever it finds to localStorage tagged with the
// CURRENT user.

// [module, the quiz variable, the teardown, the is…Active guard, a live value]
const ROUNDS = [
  ['js/units.js', '_unitQuiz', 'unitsForgetProfile', 'isUnitPracticeActive',
    { unit: 'pr1-3', questions: [{ w: { en: 'chicken' } }], idx: 0, answers: [null] }],
  ['js/retrydrill.js', '_retryDrill', 'retryDrillForgetProfile', 'isRetryDrillActive',
    { key: 'word', queue: ['x'], idx: 0, revealed: false, answered: null, fixed: 0, missed: 0 }],
];

suite('profile switch: an unfinished round does not become the next child\'s', () => {
  for (const [file, varName, teardown, guard, live] of ROUNDS) {
    test(`${file}: ${teardown}() clears ${varName}, so ${guard}() goes quiet`, () => {
      const s = loadModule(file, { appState: { coins: 0 } },
        `\n;globalThis.__set = (v) => { ${varName} = v; };`
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
      assert.falsy(/switchScreen|renderWordHome|openBook/.test(fn),
        'and it must not navigate: the caller is on its way to the profile picker');
      assert.truthy(/\babandon\w*\(\)/.test(fn),
        'it must reuse the module\'s existing clear rather than writing a second one');
    });

    test(`${file}: it is reachable — exported to Node and a plain global in the browser`, () => {
      const src = read(file);
      assert.truthy(new RegExp('^function ' + teardown + '\\(\\)', 'm').test(src),
        'a top-level function declaration is what a browser gets; an arrow inside '
        + 'module.exports is Node-only');
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

  test('and the checkpoint really does read the Book practice, which is the road that persists', () => {
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
    for (const f of ['js/units.js', 'js/retrydrill.js']) {
      if (read(f).includes('petCheerReset')) hits++;
    }
    assert.equal(hits, 0,
      'petComboBonus() at the END of a round is the only clear — an abandoned round leaves it standing');
  });
});

suite('profile switch: js/app.js forgets its own per-child state too', () => {
  const app = read('js/app.js');
  const fn = app.slice(app.indexOf('function forgetProfileState()'), app.indexOf('function switchUser()'));

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

  test('the two page-lifetime mechanisms are deliberately LEFT RUNNING', () => {
    assert.falsy(/_studyCheckpointListening\s*=\s*(null|false)/.test(fn),
      'disarming the checkpoint listeners would leave the NEXT child with no checkpointing at all; '
      + 'they re-read currentUser at every save and write nothing while there is no user');
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
//  Everything above is one bug found many times over. The shape is always the
//  same: a module keeps a child's state in a module-level variable, appState
//  is swapped underneath it, and nothing tells the module. This walks js/ and
//  fails when a module holds state of that shape without either a
//  forgetProfile of its own or an entry below saying, in words, why not.
//
//  Deliberately narrow. A `const` that never changes is not state; neither is
//  a plain cache of the static word bank, nor a string that only names which
//  sub-tab is showing. What it looks for is a MUTABLE CONTAINER OR FLAG — an
//  object, an array, a Set/Map, a null handle, a boolean latch — because that
//  is what every one of the leaks turned out to be. If this ever cries wolf,
//  the fix is to narrow the shape, not to pad the allow-list.
// ===========================================================================

// A module-scope `let`/`var` whose initial value is a mutable container, a
// null handle, or a boolean latch. Strings and numbers are excluded on
// purpose: `_shopTab = 'food'` is a view position, not a child's data.
const PER_CHILD_SHAPE = /^\s*(?:let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(\{|\[|null|false|true|new Set\(|new Map\()/;

// Files that hold state of that shape and do NOT have a forgetProfile.
// Every entry is a claim that was checked, and says what was checked.
const NO_TEARDOWN_NEEDED = {
  'daily-task.js':
    'ALREADY GUARDED, and better than a teardown could: refresh() captures '
    + '`const asked = currentUser` before the await and returns early if '
    + 'currentUser has changed, so an in-flight reply cannot land in the next '
    + "child's appState. inflight is cleared in a finally.",
  'lazy-data.js':
    'warmed is "have we started pre-warming the question banks?". The banks are '
    + 'static files shared by every profile.',
};

function moduleScopeState(file) {
  const src = read('js/' + file);
  const lines = src.split('\n');
  // Module scope is column 0 — except in a file that is ONE IIFE from its
  // first line of code to its last, where the module's own scope is indented
  // by two. Requiring the IIFE to be the FIRST thing in the file is what keeps
  // function locals out of this.
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
// `const EngAuth = (function () {…`. Null for a script that defines globals.
function namespaceOf(file, src) {
  const first = src.split('\n').find(l => l.trim() && !l.trim().startsWith('//')) || '';
  const named = first.match(/^(?:var|const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*\(/);
  if (named) return named[1];
  const onGlobal = src.match(/^\s*global\.([A-Za-z_$][\w$]*)\s*=\s*\{/m);
  return onGlobal ? onGlobal[1] : null;
}

suite('GUARD: a module that keeps per-child state must know how to forget it', () => {
  const files = fs.readdirSync(path.join(ROOT, 'js'))
    .filter(f => f.endsWith('.js')).sort();

  test('the detector still sees the bug it was written for', () => {
    // If a refactor ever makes this stop finding _unitQuiz, the guard has
    // quietly stopped guarding — so this is checked before anything is concluded.
    assert.truthy(moduleScopeState('units.js').includes('_unitQuiz'),
      'the practice-round leak must still be detectable, or this whole suite is theatre');
    assert.truthy(moduleScopeState('night-raid.js').includes('lastHarvest'),
      'and so must state inside an IIFE module');
    assert.falsy(moduleScopeState('app.js').includes('checkpoint'),
      'while a function local (restoreStudyCheckpoint\'s `let checkpoint = null`) must NOT be reported');
    assert.falsy(moduleScopeState('home.js').includes('_shopTab'),
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
