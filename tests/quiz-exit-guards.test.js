// quiz-exit-guards.test.js — no screen may throw a child's work away silently.
//
// Written after the Toán 7 đề thi was found unlocked (v4.15.20) and the audit
// that followed. Two protections, and every practice screen needs both:
//
//   • the ✕ on the question card ASKS once there is work to lose. Five screens
//     were once binning the round on a single tap with nothing said; the one
//     practice left — the Book practice (js/units.js) — was among them.
//   • switchScreen ASKS before the bottom bar carries the child out. Three of
//     those five were missing from that guard entirely, so a mis-tap on Home
//     ended the round with no question at all.
//
// The registry test below is the one that matters most. It fails when SOMEONE
// ADDS A NEW SCREEN and forgets the guard, which is how every one of these
// holes got there in the first place.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---------------------------------------------------------------------------
// the registry: every "is something running?" must be answered by switchScreen
// ---------------------------------------------------------------------------
suite('leaving a screen: nothing that can be running is left unguarded', () => {
  // The scan below reads EVERY `function isX(...)` in js/ and demands a
  // decision about each one. That is deliberately blunt: the first version of
  // this test only matched top-level `is*Active` names, and Night Raid — whose
  // check lives inside a module as `isRaiding()` — walked straight past it
  // while its raid stage had two unguarded exits. A name-shaped filter decides
  // what to look at; a list you have to edit decides what is safe.
  const NOT_AN_ACTIVITY = {
    isAutoplayBlock: 'a browser capability probe',
    isUnitMastered: 'reads a mastery total',
    isCrop: 'FarmRules — classifies one layout cell',
    isFarmBuilding: 'FarmRules — classifies one layout cell',
    isWilted: 'FarmRules — reads a planting date against the task-day context',
    isGitHubPages: 'Hosting — reads which host the page is served from',
  };
  // Running activities that switchScreen may skip BY THIS NAME, each with what
  // is NOT lost. (switchScreen does ask about the drill, through
  // retryDrillKey() === 'word' — the check below is by function name.)
  const EXEMPT = {
    isRetryDrillActive:
      'the drill persists each item the moment it is fixed (retryClear in ' +
      'js/retrydrill.js), so walking out loses nothing but the item on screen',
  };

  const guard = (() => {
    const app = read('js/app.js');
    return app.slice(app.indexOf('function switchScreen(screenId) {'),
      app.indexOf('function navigateToProfile'));
  })();

  const found = [];
  for (const file of fs.readdirSync(path.join(ROOT, 'js'))) {
    if (!file.endsWith('.js') || file === 'phaser.min.js') continue;
    for (const m of read('js/' + file).matchAll(/function (is[A-Z][A-Za-z]*)\s*\(/g)) {
      if (!found.some(f => f.name === m[1])) found.push({ name: m[1], file });
    }
  }

  test('the scan actually reads the codebase', () => {
    assert.truthy(guard.length > 500, 'switchScreen not found');
    assert.truthy(found.length >= 5, `only found ${found.length} is…() functions — the scan is broken`);
    for (const name of ['isUnitPracticeActive', 'isRetryDrillActive']) {
      assert.truthy(found.some(f => f.name === name), `the scan missed ${name}`);
    }
  });

  test('the guard list in switchScreen is the Book practice and the word drill', () => {
    // The two live activities, each guarded on its own screen: a practice
    // belongs to unitPracticeScreen() (the Word screen), and the drill to
    // wordScreen — so switching between the three Book buttons asks too.
    assert.truthy(/isUnitPracticeActive\(\)/.test(guard), 'the Book practice is guarded');
    assert.truthy(/unitPracticeScreen\(\)/.test(guard), 'on the screen the engine names');
    assert.truthy(/retryDrillKey\(\) === 'word'/.test(guard), 'the word drill is guarded');
    assert.truthy(/screenId !== 'wordScreen' &&\s*typeof retryDrillKey/.test(guard), 'on the Word screen');
    assert.falsy(/isMathQuizActive|isExamActive|isRaiding|isFighting|GhostOfferingEvent/.test(guard),
      'no guard for an activity that no longer exists');
    const app = read('js/app.js');
    const busy = /const _BUSY_CHECKS = \[([^\]]*)\]/.exec(app);
    assert.truthy(busy, '_BUSY_CHECKS not found');
    assert.deepEqual([...busy[1].matchAll(/'([A-Za-z]+)'/g)].map(m => m[1]),
      ['isUnitPracticeActive', 'isRetryDrillActive'],
      'an update that reloads must be as careful as the bottom bar');
  });

  test('switchScreen asks about every live activity in the app', () => {
    const unguarded = found
      .filter(f => !EXEMPT[f.name] && !NOT_AN_ACTIVITY[f.name] && !guard.includes(f.name))
      .map(f => `${f.name} (js/${f.file})`);
    assert.deepEqual(unguarded, [],
      'switchScreen never asks about:\n  ' + unguarded.join('\n  ') +
      '\nAdd a guard, or say in EXEMPT what cannot be lost, or in ' +
      'NOT_AN_ACTIVITY that this is not a running activity at all.');
  });

  test('every entry in both lists says why it is there', () => {
    for (const [name, why] of Object.entries(EXEMPT)) {
      assert.truthy(String(why).length > 40, `${name} needs a real reason, not a shrug`);
    }
    for (const [name, why] of Object.entries(NOT_AN_ACTIVITY)) {
      assert.truthy(String(why).length > 10, `${name} needs a reason`);
    }
    // A stale entry is worse than none: it hides a name nobody checks any more.
    for (const name of Object.keys(EXEMPT).concat(Object.keys(NOT_AN_ACTIVITY))) {
      assert.truthy(found.some(f => f.name === name), `${name} no longer exists — drop it`);
    }
  });
});

// ---------------------------------------------------------------------------
// the ✕ on the question card
// ---------------------------------------------------------------------------
//
// The tab is loaded the way the browser gives it to itself: its bank as
// globals, then the module. The table shape is kept so a second practice can
// be added to it.
function bank(file, names) {
  const mod = require(path.join(ROOT, 'js', file));
  for (const name of names) global[name] = mod[name];
  return mod;
}

// No document stub here: withDom() installs one per test and takes it away
// again, because other files in the suite delete global.document on purpose.
global.appState = global.appState || {};
global.currentUser = global.currentUser || 'tester';
global.saveUserData = global.saveUserData || (() => {});
Object.assign(global, require(path.join(ROOT, 'js', 'answer-audio.js')));

bank('word-data.js', ['UNIT_WORDS_PR1', 'UNIT_WORDS_PR2', 'UNIT_WORDS_PR3', 'UNIT_PR_TITLES']);

const TABS = [
  {
    label: 'Book practice',
    mod: require(path.join(ROOT, 'js', 'units.js')),
    file: 'js/units.js',
    start: (m) => m.startUnitPractice('pr1-1'),
    // No input box in this DOM stub, so the answer lands as a blank — which
    // is still an answer, and still work to lose.
    answer: (m) => m.submitUnitAnswer(),
    answered: (m) => m.unitAnsweredCount(),
    active: (m) => m.isUnitPracticeActive(),
    quit: 'quitUnitPractice',
  },
];

function armConfirm(answer) {
  const asked = [];
  global.confirm = (msg) => { asked.push(String(msg)); return answer; };
  return asked;
}

// Other test files install and then DELETE global.document (deliberately — they
// assert their code survives having none), and the suite runs them all in one
// process. So the stub is installed per test and taken away again, rather than
// once when this file loads.
function withDom(fn) {
  const had = Object.prototype.hasOwnProperty.call(global, 'document');
  const prev = global.document;
  const prevState = global.appState;
  global.document = {
    getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
  };
  global.appState = { coins: 0 };
  try { return fn(); }
  finally {
    delete global.confirm;
    global.appState = prevState;
    if (had) global.document = prev; else delete global.document;
  }
}

suite('the ✕ on a question card asks before it bins the round', () => {
  for (const tab of TABS) {
    test(`${tab.label}: saying no keeps the round`, () => {
      const m = tab.mod;
      withDom(() => {
        tab.start(m);
        assert.truthy(tab.active(m), `${tab.label}: the round did not start`);
        tab.answer(m);
        // The ✕ only asks when there is work to lose, so a helper that quietly
        // answered nothing would make the real assertion below fail for the
        // wrong reason. Say which it is.
        assert.truthy(tab.answered(m) > 0, `${tab.label}: the answer did not register`);
        const asked = armConfirm(false);
        m[tab.quit]();
        assert.equal(asked.length, 1, `${tab.label}: it must ask before throwing work away`);
        assert.truthy(tab.active(m), `${tab.label}: saying no must keep the round`);
        armConfirm(true); m[tab.quit]();       // leave nothing running for the next test
      });
    });

    test(`${tab.label}: saying yes ends it`, () => {
      const m = tab.mod;
      withDom(() => {
        tab.start(m);
        tab.answer(m);
        assert.truthy(tab.answered(m) > 0, `${tab.label}: the answer did not register`);
        armConfirm(true);
        m[tab.quit]();
        assert.falsy(tab.active(m), `${tab.label}: saying yes must end the round`);
      });
    });

    test(`${tab.label}: with nothing answered, it just goes back`, () => {
      const m = tab.mod;
      withDom(() => {
        tab.start(m);
        const asked = armConfirm(true);
        m[tab.quit]();
        assert.equal(asked.length, 0, `${tab.label}: nothing at stake, nothing to ask`);
        assert.falsy(tab.active(m));
      });
    });

    test(`${tab.label}: the ✕ is wired to the asking exit`, () => {
      // The behaviour above is worthless if the button still calls the old
      // silent abandon — which is exactly what shipped for months.
      const src = read(tab.file);
      const x = /<button class="grammar-back-btn" onclick="([^"]+)">✕<\/button>/.exec(src);
      assert.truthy(x, `${tab.label}: no ✕ found on the question card`);
      assert.truthy(x[1].includes(tab.quit + '()'),
        `${tab.label}: the ✕ calls "${x[1]}" — it must go through ${tab.quit}()`);
    });
  }
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
