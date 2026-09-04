// exam-history-storage.test.js — the Exam tab's history is the child's record
// of every paper they have sat, and it used to be able to stop existing.
//
// Each attempt stored the full question text AND the explanation HTML of all
// 40 questions: 17k–49k chars apiece. Nothing capped the list, and
// saveExamHistory answered a full quota with an empty catch block. So at
// somewhere around a hundred attempts localStorage.setItem started throwing,
// the old list stayed on disk untouched, and from then on every exam ended the
// same way: the results screen appeared, the coins were paid, and the attempt
// was gone — "Best:" frozen, History frozen, nothing said.
//
// js/exam.js has no module.exports, so it is run in a vm the way the browser
// runs it, on top of the real js/exam-data.js bank, against a localStorage
// that can be given a real byte budget.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// A localStorage with a quota. `budget` is a character ceiling across the
// whole store; setItem throws QuotaExceededError above it, exactly as a
// browser does — which is the one behaviour the old code got wrong.
function memStorage(budget) {
  const store = {};
  return {
    store,
    api: {
      getItem: (k) => (store[k] !== undefined ? store[k] : null),
      setItem: (k, v) => {
        v = String(v);
        let used = 0;
        for (const key of Object.keys(store)) if (key !== k) used += store[key].length;
        if (budget != null && used + v.length > budget) {
          const err = new Error('QuotaExceededError: exceeded the quota.');
          err.name = 'QuotaExceededError';
          throw err;
        }
        store[k] = v;
      },
      removeItem: (k) => { delete store[k]; },
    },
  };
}

function makeEl() {
  return {
    innerHTML: '', textContent: '', value: '', scrollTop: 0, style: {},
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    focus() {}, addEventListener() {}, removeEventListener() {},
    querySelector: () => null, querySelectorAll: () => [],
  };
}

function world(opts) {
  opts = opts || {};
  const els = {};
  const el = (id) => (els[id] || (els[id] = makeEl()));
  const ls = memStorage(opts.budget);
  const ctx = vm.createContext({
    console,
    document: {
      getElementById: el, querySelector: () => null, querySelectorAll: () => [],
      createElement: makeEl, body: makeEl(), addEventListener() {}, removeEventListener() {},
    },
    window: { scrollTo() {} },
    localStorage: ls.api,
    // Held still: a live 1-second tick could auto-submit a paper mid-assertion.
    setInterval: () => 1, clearInterval: () => {}, setTimeout, clearTimeout,
    Date, Math, JSON, Object, Array, Set, String, Number, RegExp,
    appState: { coins: 0 }, currentUser: 'tester',
    saveUserData: () => {}, recordStudy: () => {}, confirm: () => true,
  });
  for (const f of ['js/exam-data.js', 'js/exam.js']) {
    vm.runInContext(read(f), ctx, { filename: f });
  }
  // Top-level const/let are lexical to their script — hand the ones the tests
  // need over to the context rather than re-declaring the values here.
  vm.runInContext(`
    globalThis.__EXAMS = EXAMS;
    globalThis.__KEY = EXAM_HISTORY_KEY;
    globalThis.__CAP = EXAM_HISTORY_CAP;
    globalThis.__examState = () => _examState;
  `, ctx, { filename: 'epilogue.js' });
  return {
    ctx, els, store: ls.store,
    exams: ctx.__EXAMS,
    key: ctx.__KEY,
    cap: ctx.__CAP,
    raw: () => ls.store[ctx.__KEY],
    history: () => ctx.loadExamHistory(),
    screen: () => els.examScreen.innerHTML,
  };
}

// Sit the whole paper: the first `correctCount` questions right, the rest wrong.
function takeExam(w, examId, correctCount) {
  w.ctx.startExam(examId);
  const s = w.ctx.__examState();
  assert.truthy(s, 'the exam did not start');
  const questions = s.questions;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const want = i < correctCount;
    if (q.type === 'text') {
      w.els.examTextInput.value = want ? (q.accept && q.accept[0]) || q.answer : 'zzz not this';
      w.ctx.submitExamText();
    } else {
      w.ctx.answerExamChoice(want ? q.correct : (q.correct + 1) % q.options.length);
    }
    w.ctx.nextExamQuestion();     // on the last question this finishes the paper
  }
  assert.falsy(w.ctx.__examState(), 'the paper should be over');
}

const EXAM_ID = 'exam1';

// ---------------------------------------------------------------------------
suite('exam history: an attempt stores only what cannot be looked back up', () => {
  test('the explanation HTML and the question text are no longer written to disk', () => {
    const w = world();
    takeExam(w, EXAM_ID, 10);
    const a = w.history()[0].answers[0];
    assert.equal(a.explanation, undefined, 'the explanation HTML is re-derivable from EXAMS');
    assert.equal(a.q, undefined, 'so is the question text');
    // …and the rest still is stored, because the review needs it.
    for (const field of ['n', 'section', 'type', 'userValue', 'isCorrect', 'correctAnswer']) {
      assert.truthy(Object.prototype.hasOwnProperty.call(a, field), `${field} must still be stored`);
    }
  });

  test('nothing of the bank\'s explanation prose leaks into the blob', () => {
    const w = world();
    takeExam(w, EXAM_ID, 40);
    const blob = w.raw();
    const q1 = w.exams.find(e => e.id === EXAM_ID).questions[0];
    assert.truthy(q1.explanation.length > 40, 'the bank should have a real explanation to leak');
    // Compare against the JSON-ESCAPED text, which is the form it would take on
    // disk — the explanations are HTML and full of quotes, so comparing the raw
    // string would be a test that can never fail.
    const onDisk = (s) => JSON.stringify(String(s)).slice(1, -1);
    assert.truthy(blob.includes(onDisk(q1.correct != null && q1.options
      ? q1.options[q1.correct].replace(/<\/?u>/g, '') : q1.answer)),
      'the correct answer IS meant to be stored — check the comparison works at all');
    assert.falsy(blob.includes(onDisk(q1.explanation)), 'the explanation HTML is still on disk');
    assert.falsy(blob.includes(onDisk(q1.q)), 'the question text is still on disk');
  });

  test('an attempt now costs a fraction of what it did', () => {
    // The old shape, measured off the same bank rather than hard-coded, so
    // this stays honest if the bank grows.
    const w = world();
    takeExam(w, EXAM_ID, 20);
    const now = JSON.stringify(w.history()[0]).length;
    const ex = w.exams.find(e => e.id === EXAM_ID);
    const before = now + ex.questions.reduce(
      (n, q) => n + JSON.stringify(q.q).length + JSON.stringify(q.explanation).length, 0);
    assert.truthy(now * 3 < before,
      `an attempt is ${now} chars against ${before} before — the shrink is the whole fix`);
  });
});

// ---------------------------------------------------------------------------
suite('exam history: the review screen still shows everything it used to', () => {
  test('the question and its explanation come back out of the bank', () => {
    const w = world();
    takeExam(w, EXAM_ID, 5);
    w.ctx.renderExamHistory();
    w.ctx.reviewExamAttempt(0);
    const html = w.screen();
    const q1 = w.exams.find(e => e.id === EXAM_ID).questions[0];
    assert.truthy(html.includes(q1.explanation),
      'the explanation must still be on the review screen, read from EXAMS');
    assert.truthy(html.includes('Review — every question'), 'the review did not render');
    assert.truthy(html.includes('Your answer:'), 'the marks must still be there');
  });

  test('the results screen straight after the paper is unchanged', () => {
    const w = world();
    takeExam(w, EXAM_ID, 40);
    const html = w.screen();
    const q1 = w.exams.find(e => e.id === EXAM_ID).questions[0];
    assert.truthy(html.includes(q1.explanation), 'the child must see why, immediately');
    assert.truthy(html.includes('40<span>/40</span>'), 'the score did not render');
  });

  test('an attempt saved by the OLD code still renders from its own copy', () => {
    // Histories outlive deploys. An entry written before this change carries
    // `q` and `explanation` inline, and must keep working exactly as it did.
    const w = world();
    w.store[w.key] = JSON.stringify([{
      examId: 'a-paper-that-was-retired', title: 'Old Exam', ts: Date.now(),
      score: 1, total: 2, timeSpentSec: 60, coinsEarned: 5, autoSubmitted: false,
      answers: [
        { n: 1, q: 'Legacy question one?', section: 'A', type: 'mcq', userValue: 0,
          isCorrect: true, correctAnswer: 'alpha', explanation: 'Because of the legacy rule.' },
        { n: 2, q: 'Legacy question two?', section: 'A', type: 'text', userValue: 'nope',
          isCorrect: false, correctAnswer: 'beta', explanation: 'The other legacy rule.' },
      ],
    }]);
    w.ctx.reviewExamAttempt(0);
    const html = w.screen();
    assert.truthy(html.includes('Legacy question one?'), 'the stored question text must win');
    assert.truthy(html.includes('Because of the legacy rule.'), 'and the stored explanation');
    assert.truthy(html.includes('beta'), 'and the correct answer');
  });

  test('a stripped attempt whose exam has left the bank degrades, it does not throw', () => {
    // The floor: the marks and the right answers survive even with no bank
    // entry to read the wording back out of.
    const w = world();
    w.store[w.key] = JSON.stringify([{
      examId: 'no-such-exam', title: 'Gone', ts: Date.now(),
      score: 0, total: 1, timeSpentSec: 30, coinsEarned: 0, autoSubmitted: false,
      answers: [{ n: 1, section: '', type: 'text', userValue: 'guess', isCorrect: false,
                  correctAnswer: 'the right one' }],
    }]);
    w.ctx.reviewExamAttempt(0);
    const html = w.screen();
    assert.truthy(html.includes('the right one'), 'the correct answer is the minimum kept');
    assert.truthy(html.includes('guess'), 'and what the child actually wrote');
  });
});

// ---------------------------------------------------------------------------
suite('exam history: the list is capped', () => {
  test('it never grows past the cap, and the newest is the one kept', () => {
    const w = world();
    const filler = [];
    for (let i = 0; i < w.cap + 5; i++) {
      filler.push({ examId: EXAM_ID, title: 'Old', ts: 1000 + i, score: 1, total: 40,
                    timeSpentSec: 60, coinsEarned: 5, autoSubmitted: false, answers: [] });
    }
    w.store[w.key] = JSON.stringify(filler);
    takeExam(w, EXAM_ID, 40);
    const hist = w.history();
    assert.equal(hist.length, w.cap, 'the cap must be enforced on write');
    assert.equal(hist[0].score, 40, 'and the attempt just finished must be at the front');
  });

  test('the cap matches the other practice tabs', () => {
    const w = world();
    assert.equal(w.cap, 300, 'wordform, rewrite, phrases, math and grammar all use 300');
  });
});

// ---------------------------------------------------------------------------
suite('exam history: a full quota never eats the attempt just finished', () => {
  // The reported symptom, end to end: the child sits a paper, the results
  // screen and the coins arrive, and then "Best:" does not move because the
  // write was swallowed.
  function fillToBursting(w, n) {
    const junk = [];
    for (let i = 0; i < n; i++) {
      junk.push({ examId: EXAM_ID, title: 'Exam 2026', ts: 1000 + i, score: 1, total: 40,
                  timeSpentSec: 60, coinsEarned: 5, autoSubmitted: false,
                  answers: Array.from({ length: 40 }, (_, k) => ({
                    n: k + 1, section: 'A', type: 'mcq', userValue: 0, isCorrect: false,
                    correctAnswer: 'x'.repeat(40),
                  })) });
    }
    w.store[w.key] = JSON.stringify(junk);
  }

  test('the attempt lands on disk instead of vanishing', () => {
    const w = world({ budget: 120000 });
    fillToBursting(w, 40);                    // comfortably over the budget already
    const before = w.history().length;
    takeExam(w, EXAM_ID, 37);

    const hist = w.history();
    assert.equal(hist[0].score, 37,
      'the newest attempt must survive a full quota — it is the one just earned');
    assert.truthy(hist.length < before,
      'older attempts are what get shed, not the new one');
  });

  test('and "Best:" moves, which is what the child actually sees', () => {
    const w = world({ budget: 120000 });
    fillToBursting(w, 40);
    assert.truthy(w.ctx.renderExamsBody().includes('Best: 1/40'), 'the old best is 1/40');
    takeExam(w, EXAM_ID, 37);
    assert.truthy(w.ctx.renderExamsBody().includes('Best: 37/40'),
      'the Exam card froze at the old best — the attempt never reached disk');
  });

  test('saveExamHistory says whether it worked', () => {
    const w = world({ budget: 120000 });
    assert.truthy(w.ctx.saveExamHistory([]), 'an easy write reports success');
    fillToBursting(w, 40);
    const tooBig = w.history();
    assert.truthy(w.ctx.saveExamHistory(tooBig),
      'over quota it must shed and retry, not give up');
    assert.truthy(w.history().length < tooBig.length, 'the shed must be real');
    assert.equal(w.history()[0].ts, tooBig[0].ts, 'and it sheds from the OLD end');
  });

  test('a quota too small for even one attempt is survived, not thrown', () => {
    const w = world({ budget: 50 });
    const one = [{ examId: EXAM_ID, title: 'T', ts: 1, score: 1, total: 40,
                   answers: Array.from({ length: 40 }, (_, k) => ({ n: k + 1 })) }];
    assert.falsy(w.ctx.saveExamHistory(one), 'it reports the failure');
    // And the whole finish path still completes: coins, results screen, no throw.
    takeExam(w, EXAM_ID, 3);
    assert.truthy(w.screen().includes('Review — every question'),
      'a child must never be left staring at a broken results screen');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
