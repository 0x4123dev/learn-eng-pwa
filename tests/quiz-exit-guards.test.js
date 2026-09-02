// quiz-exit-guards.test.js — no screen may throw a child's work away silently.
//
// Written after the Toán 7 đề thi was found unlocked (v4.15.20) and the audit
// that followed. Two protections, and every practice screen needs both:
//
//   • the ✕ on the question card ASKS once there is work to lose. Five screens
//     were binning the round on a single tap with nothing said — wordform,
//     rewrite, phrases, collocation and the Grade 4 units practice.
//   • switchScreen ASKS before the bottom bar carries the child out. Three of
//     those five were missing from that guard entirely, so a mis-tap on Home
//     ended the round with no question at all.
//
// A third protection — hiding the bottom bar outright — is for the two
// sittings you cannot dip out of: an exam, and a round against a clock.
//
// The registry test below is the one that matters most. It fails when SOMEONE
// ADDS A NEW SCREEN and forgets the guard, which is how every one of these
// holes got there in the first place.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

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
    isArrangementCorrect: 'grades one answer',
    isQuestionBookmarked: 'reads a bookmark flag',
    isWordStruggling: 'reads a word\'s SRS record',
    isBonusTopicLesson: 'classifies a lesson',
    isUnitMastered: 'reads a mastery total',
    isActive: 'GhostOfferingEvent — switchScreen guards it as GhostOfferingEvent.isActive()',
  };
  // Running activities that switchScreen may skip, each with what is NOT lost.
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
    assert.truthy(found.length >= 15, `only found ${found.length} is…() functions — the scan is broken`);
    for (const name of ['isMathQuizActive', 'isExamActive', 'isRaiding', 'isFighting']) {
      assert.truthy(found.some(f => f.name === name), `the scan missed ${name}`);
    }
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
// Each tab is loaded the way the browser gives it to itself: its bank as a
// global, then the module. They all keep the same quiz shape
// ({questions, idx, answers}), so one table drives the lot.
function bank(file, name) {
  const mod = require(path.join(ROOT, 'js', file));
  global[name] = mod[name];
  return mod[name];
}

// No document stub here: withDom() installs one per test and takes it away
// again, because other files in the suite delete global.document on purpose.
global.appState = global.appState || {};
global.currentUser = global.currentUser || 'tester';
global.saveUserData = global.saveUserData || (() => {});
Object.assign(global, require(path.join(ROOT, 'js', 'answer-audio.js')));

bank('wordform-data.js', 'WORDFORM_QUESTIONS');
bank('rewrite-data.js', 'REWRITE_QUESTIONS');
bank('phrases-data.js', 'PREPOSITION_QUESTIONS');
bank('collocation-data.js', 'COLLOCATION_QUESTIONS');
bank('units-data.js', 'UNIT_WORDS');

const TABS = [
  {
    label: 'Word form',
    mod: require(path.join(ROOT, 'js', 'wordform.js')),
    file: 'js/wordform.js',
    start: (m) => m.startWordformQuiz(10),
    answer: (m) => m.answerWfQuestion(0),
    active: (m) => m.isWordformQuizActive(),
    quit: 'quitWordformQuiz',
  },
  {
    label: 'Rewrite',
    mod: require(path.join(ROOT, 'js', 'rewrite.js')),
    file: 'js/rewrite.js',
    start: (m) => m.startRewriteQuiz(10),
    answer: (m) => m.submitRwText('anything at all'),
    active: (m) => m.isRewriteQuizActive(),
    quit: 'quitRewriteQuiz',
  },
  {
    label: 'Phrases',
    mod: require(path.join(ROOT, 'js', 'phrases.js')),
    file: 'js/phrases.js',
    start: (m) => m.startPhrasesQuiz(10),
    answer: (m) => m.answerPhrQuestion(0),
    active: (m) => m.isPhrasesQuizActive(),
    quit: 'quitPhrasesQuiz',
  },
  {
    label: 'Collocation',
    mod: require(path.join(ROOT, 'js', 'collocation.js')),
    file: 'js/collocation.js',
    start: (m) => m.startCollocPractice(10),
    answer: (m) => m.answerCollocChoice(0),
    active: (m) => m.isCollocActive(),
    quit: 'quitCollocPractice',
  },
  {
    label: 'Grade 4 units',
    mod: require(path.join(ROOT, 'js', 'units.js')),
    file: 'js/units.js',
    start: (m) => m.startUnitPractice(1),
    answer: (m) => m.submitUnitAnswer('anything at all'),
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

// ---------------------------------------------------------------------------
// the lock: a sitting you cannot dip out of takes the bottom bar away
// ---------------------------------------------------------------------------
//
// Both of these live in files with no module.exports, so they run in a vm the
// way the browser runs them — the real source, not a copy of it.
function vmModule(files, extra, after) {
  const nav = { style: { display: 'flex' } };
  const el = () => ({
    innerHTML: '', scrollTop: 0, textContent: '', style: {}, value: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    focus() {}, querySelector: () => null, querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
  });
  const ctx = vm.createContext(Object.assign({
    console,
    document: {
      getElementById: (id) => id === 'bottomNav' ? nav : el(),
      querySelector: () => el(), querySelectorAll: () => [], createElement: () => el(),
      body: el(), addEventListener() {},
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    window: { scrollTo() {} }, navigator: {},
    setTimeout, clearTimeout, setInterval, clearInterval, Date, Math, JSON,
    appState: { coins: 0 },
    currentUser: 'tester',
    saveUserData: () => {},
    confirm: () => true,
  }, extra || {}));
  for (const file of [].concat(files)) vm.runInContext(read(file), ctx, { filename: file });
  // A top-level `const` is lexically scoped to its own script, so a bank
  // declared that way is invisible to the context until it is handed over.
  if (after) vm.runInContext(after, ctx, { filename: 'epilogue.js' });
  return { ctx, nav, hidden: () => nav.style.display === 'none' };
}

suite('the timed exam locks the screen for its whole hour', () => {
  // 40 to 90 minutes with a clock running, and walking out saves nothing at
  // all. The bottom bar had no business sitting under the thumb for that.
  function examWorld() {
    // exam-data.js declares EXAMS and getExam as plain top-level consts, so it
    // is loaded into the same context rather than required.
    const w = vmModule(['js/exam-data.js', 'js/exam.js'], { recordStudy: () => {} },
      'globalThis.__EXAMS = EXAMS;');
    const timed = w.ctx.__EXAMS.find(e => e.durationMin && e.questions && e.questions.length);
    assert.truthy(timed, 'no timed exam in the bank to test with');
    return { w, examId: timed.id };
  }

  test('starting a timed exam hides the bottom bar', () => {
    const { w, examId } = examWorld();
    assert.falsy(w.hidden(), 'the bar is there beforehand');
    w.ctx.startExam(examId);
    assert.truthy(w.ctx.isExamActive(), 'the exam did not start');
    assert.truthy(w.hidden(), 'a mis-tap must not be one tap away during a timed exam');
    w.ctx.abandonExam();
  });

  test('quitting through the ✕ gives the bar back', () => {
    const { w, examId } = examWorld();
    w.ctx.startExam(examId);
    w.ctx.quitExam();                       // confirm() says yes in this world
    assert.falsy(w.ctx.isExamActive());
    assert.falsy(w.hidden(), 'the bar can never be left hidden');
  });

  test('abandoning gives the bar back', () => {
    const { w, examId } = examWorld();
    w.ctx.startExam(examId);
    w.ctx.abandonExam();
    assert.falsy(w.hidden());
  });

  test('running out of time gives the bar back', () => {
    // The one exit nobody taps: the clock ends it for them.
    const { w, examId } = examWorld();
    w.ctx.startExam(examId);
    w.ctx.finishExam(true);
    assert.falsy(w.ctx.isExamActive());
    assert.falsy(w.hidden(), 'a child left staring at a locked results screen');
  });
});

suite('a Math Wars round locks the screen while its clock runs', () => {
  function warsWorld() {
    const MFR = require(path.join(ROOT, 'js', 'math-fight-rules.js'));
    const { MATH_FIGHT_BANK } = require(path.join(ROOT, 'js', 'math-fight-bank.js'));
    return vmModule('js/mathwars.js', {
      MathFightRules: MFR, MATH_FIGHT_BANK,
      renderMathHome: () => {}, recordStudy: () => {},
    });
  }

  test('starting a round hides the bottom bar', () => {
    const w = warsWorld();
    w.ctx.startWarsRound();
    assert.truthy(w.ctx.isWarsActive(), 'the round did not start');
    assert.truthy(w.hidden(), 'the clock does not wait for a mis-tap to be undone');
    w.ctx.abandonWars();
  });

  test('the ✕ gives the bar back', () => {
    const w = warsWorld();
    w.ctx.startWarsRound();
    w.ctx.warsQuit();                       // confirm() says yes in this world
    assert.falsy(w.ctx.isWarsActive());
    assert.falsy(w.hidden());
  });

  test('the round ending gives the bar back', () => {
    const w = warsWorld();
    w.ctx.startWarsRound();
    w.ctx.finishWars(true);
    assert.falsy(w.hidden(), 'a finished round must not strand the child');
  });
});

suite('the × on a lesson asks before it drops the lesson', () => {
  // The lesson screen has always hidden the bottom bar, so it was never the
  // mis-tap risk the practice tabs were. But its × had the same silent bin:
  // half a lesson, one tap, nothing saved and nothing said.
  //
  // exitLesson() itself must stay silent — it is also how a FINISHED lesson
  // closes (js/lessons.js and js/daily-challenge.js both call it), and asking
  // there would question a child who has already earned their coins.
  function lessonWorld(state) {
    const w = vmModule('js/lessons.js', {
      lessonState: state,
      renderHome: () => {}, renderTopicsHome: () => {}, openTopicDetail: () => {},
      openReviewDetail: () => {}, recordStudy: () => {},
    });
    w.nav.style.display = 'none';   // a lesson is running: the bar is already away
    return w;
  }
  const halfDone = () => ({ correctInLesson: 3, wrongInLesson: 1, words: [] });

  test('saying no keeps the child in the lesson', () => {
    let asked = 0;
    const w = lessonWorld(halfDone());
    w.ctx.confirm = () => { asked++; return false; };
    w.ctx.quitLesson();
    assert.equal(asked, 1, 'it must ask before dropping the lesson');
    assert.truthy(w.hidden(), 'saying no must leave the lesson exactly as it was');
  });

  test('saying yes leaves, and hands the bottom bar back', () => {
    const w = lessonWorld(halfDone());
    w.ctx.confirm = () => true;
    w.ctx.quitLesson();
    assert.falsy(w.hidden(), 'leaving a lesson must restore the bar');
  });

  test('a lesson with nothing answered yet closes without a question', () => {
    let asked = 0;
    const w = lessonWorld({ correctInLesson: 0, wrongInLesson: 0, words: [] });
    w.ctx.confirm = () => { asked++; return false; };
    w.ctx.quitLesson();
    assert.equal(asked, 0, 'nothing at stake, nothing to ask');
    assert.falsy(w.hidden());
  });

  test('a finished lesson closes without a question', () => {
    let asked = 0;
    const w = lessonWorld(Object.assign(halfDone(), { finished: true }));
    w.ctx.confirm = () => { asked++; return false; };
    w.ctx.quitLesson();
    assert.equal(asked, 0, 'the coins are already banked — do not question that');
    assert.falsy(w.hidden());
  });

  test('the internal exits stay silent', () => {
    // js/lessons.js "Continue" and js/daily-challenge.js "Collect!" both call
    // exitLesson() on a lesson that is over.
    let asked = 0;
    const w = lessonWorld(halfDone());
    w.ctx.confirm = () => { asked++; return false; };
    w.ctx.exitLesson();
    assert.equal(asked, 0, 'exitLesson is the silent exit, by design');
    assert.falsy(w.hidden());
  });

  test('the × in index.html goes through the asking exit', () => {
    const html = read('index.html');
    const x = /<button class="close-btn" onclick="([^"]+)">×<\/button>/.exec(html);
    assert.truthy(x, 'no × found on the lesson header');
    assert.equal(x[1], 'quitLesson()', `the × calls "${x[1]}"`);
  });

  test('completing a lesson marks it finished', () => {
    const src = read('js/lessons.js');
    const body = src.slice(src.indexOf('function completeLesson()'), src.indexOf('function completeLesson()') + 400);
    assert.truthy(/lessonState\.finished = true/.test(body),
      'completeLesson must say so, or the × will question a child who has finished');
  });
});

suite('the ✕ on the Verbs speed game asks before it drops the run', () => {
  // The last silent ✕ in the app. The speed game is timed and scored only when
  // it ends, and its ✕ sits beside the answer box.
  function speedWorld(state) {
    const w = vmModule('js/verbs.js', {
      speedState: state,
      SPEED_TIME_LIMIT: 10000, SPEED_PENALTY_TIME: 2000, SPEED_QUESTIONS_PER_GAME: 10,
      renderSpeedChallenge: () => {},
    });
    w.nav.style.display = 'none';   // a game is running: the bar is already away
    return w;
  }
  const midGame = () => ({ timer: null, currentIndex: 4, verbResults: [1, 2, 3, 4], score: 40 });

  test('saying no keeps the run alive', () => {
    let asked = 0;
    const w = speedWorld(midGame());
    w.ctx.confirm = () => { asked++; return false; };
    w.ctx.exitSpeedGame();
    assert.equal(asked, 1, 'it must ask before dropping a timed run');
    assert.truthy(w.hidden(), 'saying no must leave the game exactly as it was');
  });

  test('saying yes ends it and hands the bottom bar back', () => {
    const w = speedWorld(midGame());
    w.ctx.confirm = () => true;
    w.ctx.exitSpeedGame();
    assert.falsy(w.hidden(), 'leaving must restore the bar');
  });

  test('a run with nothing answered closes without a question', () => {
    let asked = 0;
    const w = speedWorld({ timer: null, currentIndex: 0, verbResults: [], score: 0 });
    w.ctx.confirm = () => { asked++; return false; };
    w.ctx.exitSpeedGame();
    assert.equal(asked, 0, 'nothing at stake, nothing to ask');
    assert.falsy(w.hidden());
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
