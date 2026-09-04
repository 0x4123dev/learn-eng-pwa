// verbs-speed-exit.test.js — two bugs that both lived in js/verbs.js, both
// only visible when you actually RUN the file rather than read it.
//
//   1. Leaving the Speed Challenge left speedState.isAnswering true. js/verbs.js
//      is loaded on every tab and puts a keydown listener on `document`, so the
//      next Enter the child pressed — in Rewrite, in Exam, in Word form, where
//      the inputs call preventDefault() but not stopPropagation() — ran
//      submitSpeedAnswer() as well: it read the hidden V2/V3 boxes, pushed a
//      bogus row into verbResults, and read an irregular verb aloud over the
//      answer they had just typed on a completely different tab.
//
//   2. The child's own typed answer was interpolated into innerHTML raw, and
//      it is persisted (appState.speedChallenge.history) and synced — so a
//      payload typed once re-rendered on every visit to the Verbs tab.
//
// js/verbs.js has no module.exports, so it is loaded in a vm the way the
// browser loads it: the real source, with the real retryEsc and the real
// answerGateHTML required in beside it.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const { retryEsc } = require(path.join(ROOT, 'js', 'retrydrill.js'));
const { answerGateHTML } = require(path.join(ROOT, 'js', 'answer-audio.js'));

// A DOM small enough to read, with the one thing the fix turns on: a real
// classList, so "is the overlay actually on screen?" has a real answer.
function makeEl(id) {
  const classes = new Set();
  return {
    id: id || '',
    innerHTML: '', textContent: '', value: '', className: '', disabled: false,
    style: {},
    classList: {
      add: (...c) => c.forEach(x => classes.add(x)),
      remove: (...c) => c.forEach(x => classes.delete(x)),
      toggle: () => {},
      contains: (x) => classes.has(x),
    },
    focus() {}, blur() {},
    appendChild() {}, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
  };
}

const VERBS = [
  { v1: 'go', v2: 'went', v3: 'gone', vi: 'đi', level: 1, ex: 'I go to school.' },
  { v1: 'see', v2: 'saw', v3: 'seen', vi: 'thấy', level: 1, ex: 'I see it.' },
];

function world(opts) {
  opts = opts || {};
  const els = {};
  const keyListeners = [];
  const spoken = [];
  const saved = [];

  const el = (id) => (els[id] || (els[id] = makeEl(id)));
  const ctx = vm.createContext({
    console,
    document: {
      getElementById: el,
      querySelector: () => null,
      querySelectorAll: () => [],
      createElement: () => makeEl(),
      body: makeEl('body'),
      addEventListener: (type, fn) => { if (type === 'keydown') keyListeners.push(fn); },
      removeEventListener: () => {},
    },
    window: { scrollTo() {} },
    // Real timers would let a 60-second question expire mid-test and rewrite
    // the very state under assertion. Time is held still instead; every
    // transition here is driven explicitly.
    setInterval: () => 1, clearInterval: () => {},
    setTimeout, clearTimeout,
    Date, Math, JSON, Object, Array, Set, String, Number,
    // ---- the globals js/verbs.js expects from app.js and its siblings ----
    irregularVerbs: VERBS,
    SPEED_TIME_LIMIT: 60000,
    SPEED_PENALTY_TIME: 2000,
    SPEED_QUESTIONS_PER_GAME: opts.perGame || 1,
    speedState: { timer: null, currentIndex: 0, verbResults: [], isAnswering: false },
    appState: opts.appState || { points: 0, coins: 0 },
    currentUser: 'tester',
    saveUserData: (u, s) => { saved.push(s); },
    shuffleArray: (a) => a.slice(),          // deterministic draw
    formatDate: () => '1 Jan 2026',
    recordStudy: () => {},
    retryEsc,                                 // the real escaper, js/retrydrill.js
    answerGateHTML,                           // the real gate, js/answer-audio.js
    speakAnswer: (text) => { spoken.push(text); },
    confirm: () => true,
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/verbs.js'), 'utf8'),
    ctx, { filename: 'js/verbs.js' });

  return {
    ctx, els, spoken, saved,
    state: () => ctx.speedState,
    // What a child pressing Enter anywhere in the app actually does: the event
    // reaches document whether or not the Verbs tab is the one on screen.
    pressEnter: () => keyListeners.forEach(fn => fn({ key: 'Enter', preventDefault() {} })),
    pressKey: (key) => keyListeners.forEach(fn => fn({ key, preventDefault() {} })),
    overlayActive: () => els.speedGameOverlay.classList.contains('active'),
    history: () => els.speedHistoryList.innerHTML,
  };
}

// Answer the question on screen, right or wrong, the way the inputs are read.
function typeAnswer(w, v2, v3) {
  w.els.inputV2.value = v2;
  w.els.inputV3.value = v3;
}

// ---------------------------------------------------------------------------
suite('verbs: leaving the speed challenge stops it answering for other tabs', () => {
  test('exiting mid-question clears isAnswering', () => {
    const w = world();
    w.ctx.startSpeedChallenge(0);
    assert.truthy(w.state().isAnswering, 'the question did not open');
    w.ctx.exitSpeedGame();
    assert.falsy(w.state().isAnswering,
      'the flag the app-wide Enter listener reads was left true after the exit');
  });

  test('Enter after leaving submits nothing, scores nothing and says nothing', () => {
    const w = world();
    w.ctx.startSpeedChallenge(0);
    typeAnswer(w, 'went', 'gone');       // half-typed work still sitting in the boxes
    w.ctx.exitSpeedGame();

    const rows = w.state().verbResults.length;
    const said = w.spoken.length;
    w.pressEnter();                      // the child is on Rewrite/Exam/Word form now

    assert.equal(w.state().verbResults.length, rows,
      'Enter on another tab pushed a verb result into the abandoned run');
    assert.equal(w.spoken.length, said,
      'an irregular verb was read aloud over another tab\'s answer');
  });

  test('a stale isAnswering cannot resurrect it — the overlay decides', () => {
    // The belt to exitSpeedGame's braces: this is what any FUTURE exit path
    // that forgets the flag will look like. The listener must still refuse.
    const w = world();
    w.ctx.startSpeedChallenge(0);
    w.ctx.exitSpeedGame();
    assert.falsy(w.overlayActive(), 'the overlay is down once the run is left');

    w.state().isAnswering = true;        // pretend some other path set it and left
    const rows = w.state().verbResults.length;
    w.pressEnter();

    assert.equal(w.state().verbResults.length, rows,
      'the listener acted on a flag while the game was not on screen');
    assert.falsy(w.state().isAnswering, 'and it should retire the stale flag, not keep it');
  });

  test('Enter still submits while the challenge really is on screen', () => {
    // The fix must not cost the feature it is protecting.
    const w = world();
    w.ctx.startSpeedChallenge(0);
    assert.truthy(w.overlayActive(), 'the overlay is up while a question is open');
    typeAnswer(w, 'went', 'gone');
    w.pressEnter();

    assert.equal(w.state().verbResults.length, 1, 'Enter must still answer the question');
    assert.truthy(w.state().verbResults[0].correct, 'and grade it');
    assert.equal(w.spoken.length, 1, 'and read the answer out, on the tab that asked for it');
  });

  test('a key that is not Enter is ignored anywhere', () => {
    const w = world();
    w.ctx.startSpeedChallenge(0);
    typeAnswer(w, 'went', 'gone');
    w.pressKey('a');
    assert.equal(w.state().verbResults.length, 0);
  });
});

// ---------------------------------------------------------------------------
suite('verbs: a typed answer is never markup in the saved-game list', () => {
  const PAYLOAD = '<img src=x onerror=alert(1)>';

  function playOneWrongAnswer(typedV2, typedV3) {
    const w = world({ perGame: 1 });
    w.ctx.startSpeedChallenge(0);
    typeAnswer(w, typedV2, typedV3);
    w.ctx.submitSpeedAnswer();
    w.ctx.nextSpeedQuestion();           // one question per game: this completes it
    w.ctx.renderSpeedChallenge();
    return w;
  }

  test('what the child typed is escaped, not executed', () => {
    const w = playOneWrongAnswer(PAYLOAD, 'gone');
    const html = w.history();
    assert.truthy(html.includes('Your answer:'), 'the wrong row did not render at all');
    assert.falsy(html.includes('<img'),
      'the typed answer reached innerHTML as live markup');
    // The handler text may survive — it is only dangerous inside a tag, and
    // there is no longer a tag for it to be inside.
    assert.truthy(html.includes('&lt;img src=x onerror=alert(1)&gt;'),
      'it must still be SHOWN, just inert');
  });

  test('it is escaped again on every later visit, not just the first', () => {
    // The payload is persisted (and synced), so the re-render is the real
    // exposure: renderSpeedChallenge runs on every trip to the Verbs tab.
    const w = playOneWrongAnswer(PAYLOAD, PAYLOAD);
    assert.truthy(w.saved.length, 'the game must be persisted for this to matter');
    w.ctx.renderSpeedChallenge();
    w.ctx.renderSpeedChallenge();
    assert.falsy(w.history().includes('<img'), 'a later re-render let it through');
  });

  test('an entry already on disk is escaped when it is read back', () => {
    // Nothing guarantees the stored history was written by today's code — it
    // outlives deploys and arrives over the sync. Rendering trusts none of it.
    const w = world();
    w.ctx.appState.speedChallenge = {
      bestScore: 10, bestStreak: 1, totalGames: 1,
      history: [{
        date: Date.now(), level: 1, score: 10, correct: 1, total: 2,
        verbs: [
          { v1: '<b>go</b>', v2: 'went', v3: 'gone', correct: true },
          { v1: 'see', v2: 'saw', v3: 'seen', correct: false,
            userV2: '"><script>alert(1)</script>', userV3: '' },
        ],
      }],
    };
    w.ctx.renderSpeedChallenge();
    const html = w.history();
    assert.falsy(html.includes('<script>'), 'a stored payload rendered as a script tag');
    assert.falsy(html.includes('<b>go</b>'), 'a stored verb form rendered as markup');
    assert.truthy(html.includes('&lt;script&gt;') || html.includes('&lt;script'),
      'it must still be shown, escaped');
  });

  test('an ordinary answer still reads as plain words', () => {
    // Escaping that mangles normal output is its own bug.
    const w = playOneWrongAnswer('goed', 'goned');
    const html = w.history();
    assert.truthy(html.includes('goed / goned'), 'the child must see what they typed');
    assert.truthy(html.includes('go → went → gone'), 'and the forms they should have typed');
  });

  test('an unanswered verb still says "no answer"', () => {
    const w = playOneWrongAnswer('', '');
    assert.truthy(w.history().includes('no answer'));
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
