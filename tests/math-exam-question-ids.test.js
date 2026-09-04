// math-exam-question-ids.test.js — a missed đề-thi question must come back.
//
// The bug this file exists for: only js/math-source-exams.js ever shipped
// per-question `id`s. The other three exam banks — HK1 Exam 1..10, HK2 Exam
// 1..10 and the 30 đề thật HK2, 1,108 questions in all — had none. So:
//
//   • finishMathQuiz stored `wrong: [undefined, undefined, …]`;
//   • mathById(undefined) ran `exam.questions.find(q => q.id === undefined)`
//     and matched the FIRST question of the FIRST exam, so "Dạng toán cần ôn"
//     showed a child a question they had never seen, wearing their miss count;
//   • retryAdd('math', …) drops any item whose id is empty, so "Luyện lại câu
//     hay sai" never held the questions actually missed;
//   • and after one round trip through localStorage `undefined` became `null`,
//     at which point the misses vanished from the panel altogether.
//
// Everything below EXECUTES the real quiz path — open a paper, answer some
// questions wrong, finish it — then reads the stored history back the way the
// review panel and the retry drill do. Nothing here matches source text.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const load = (p) => require(path.join(root, 'js', p));

// The practice banks are read-only here, so they are shared. The four EXAM
// banks are deep-copied per context: this file has to exercise the stamping
// from a pristine, id-less bank whatever any other test file did first.
const SHARED = {
  MATH_QUESTIONS: load('math-data.js').MATH_QUESTIONS,
  MATH_CHAPTERS: load('math-data.js').MATH_CHAPTERS,
  MATH_LESSONS: load('math-lessons.js').MATH_LESSONS,
};
const EXAM_BANKS = {
  MATH_EXAMS: load('math-exams.js').MATH_EXAMS,
  MATH_SOURCE_EXAMS: load('math-source-exams.js').MATH_SOURCE_EXAMS,
  MATH_EXAMS_HK2: load('math-exams-hk2.js').MATH_EXAMS_HK2,
  MATH_SOURCE_EXAMS_HK2: load('math-source-exams-hk2.js').MATH_SOURCE_EXAMS_HK2,
};

// js/retrydrill.js and js/math.js run in their own realm, with the exam banks
// injected as ordinary globals — because on the real page they arrive from
// lazy-loaded <script>s long after math.js has been parsed (js/lazy-data.js
// SCREEN_FILES.mathHubScreen), which is exactly why ids cannot be stamped at
// parse time.
function loadMath() {
  const screen = { innerHTML: '', scrollTop: 0 };
  const nav = { style: { display: 'flex' } };
  const ctx = {
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    document: {
      getElementById: (id) => (id === 'mathHubScreen' ? screen : id === 'bottomNav' ? nav : null),
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    appState: { coins: 0, mathHistory: [] },
    currentUser: 'tester',
    saveUserData: () => {},
    showToast: () => {},
    confirm: () => true,
  };
  Object.assign(ctx, SHARED);
  for (const [name, bank] of Object.entries(EXAM_BANKS)) {
    ctx[name] = JSON.parse(JSON.stringify(bank));
  }
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // One script, so the `const`s of both files share a scope, plus an epilogue
  // that surfaces the lexical declarations these tests call.
  const combined = [
    '//===== js/retrydrill.js =====', src('js/retrydrill.js'),
    '//===== js/math.js =====', src('js/math.js'),
    `globalThis.__math = {
       mathById, mathExams, mathExamsAll, startMathExam, answerMathQuestion,
       nextMathQuestion, mathCurrentQuestion, mathIsTyped, mathIsWritten,
       mathHasAnswerParts, mathWrongAggregate, openMathSection,
       retryCount, retryList,
     };`,
  ].join('\n');
  vm.runInContext(combined, ctx, { filename: 'math-exam-question-ids-combined.js' });
  return { ctx, m: ctx.__math, screen };
}

// Sit a whole paper. `wrongAt` holds the 0-based positions to get deliberately
// wrong; every other question is answered correctly. Returns the question
// objects that were missed, in the order they were missed.
function sitPaper(m, examId, wrongAt) {
  m.startMathExam(examId);
  const missed = [];
  for (let i = 0; i < 500; i++) {
    const q = m.mathCurrentQuestion();
    if (!q) break;                          // finishMathQuiz has cleared the run
    const wantWrong = wrongAt.has(i);
    if (wantWrong) missed.push(q);
    m.answerMathQuestion(wantWrong ? (q.correct + 1) % q.options.length : q.correct);
    m.nextMathQuestion();
  }
  return missed;
}

// A paper that is four-option multiple choice all the way through, so the run
// can be driven entirely through answerMathQuestion().
function isAllMcq(m, e) {
  return !!e && e.questions.length > 0 && e.questions.every(q =>
    Array.isArray(q.options) && q.options.length === 4
    && !m.mathIsTyped(q) && !m.mathIsWritten(q) && !m.mathHasAnswerParts(q));
}

suite('toán 7 đề thi: a missed question is stored by id, and that id resolves', () => {
  test('every question in all four exam banks carries a non-empty id', () => {
    const { m } = loadMath();
    const missing = [];
    let total = 0;
    for (const e of m.mathExamsAll()) {
      e.questions.forEach((q, i) => {
        total++;
        const id = q.id;
        if (id === undefined || id === null || String(id).trim() === '') missing.push(`${e.id}#${i + 1}`);
      });
    }
    assert.truthy(total > 1000, `expected the whole exam corpus, saw ${total} questions`);
    assert.deepEqual(missing.slice(0, 8), [], `${missing.length} of ${total} exam questions have no id`);
  });

  test('the exam ids are unique across all four banks, so derived ids cannot collide', () => {
    const { m } = loadMath();
    const seen = new Set();
    const clashes = [];
    for (const e of m.mathExamsAll()) {
      if (seen.has(e.id)) clashes.push(e.id);
      seen.add(e.id);
    }
    assert.deepEqual(clashes, [], 'two exams share an id — their question ids would collide');
    assert.equal(seen.size, 55, 'HK1 10 + HK1 source 5 + HK2 10 + HK2 source 30');
  });

  test('no two questions anywhere in the exam banks share an id', () => {
    const { m } = loadMath();
    const seen = new Map();
    const clashes = [];
    for (const e of m.mathExamsAll()) {
      for (const q of e.questions) {
        if (seen.has(q.id)) clashes.push(`${q.id}: ${seen.get(q.id)} vs ${e.id}`);
        seen.set(q.id, e.id);
      }
    }
    assert.deepEqual(clashes.slice(0, 5), [], 'duplicate ids would cross-wire the review panel');
  });

  test('stamping never overwrites an id a bank already wrote (s1-1 stays s1-1)', () => {
    const { m } = loadMath();
    const src1 = m.mathExamsAll().find(e => e.id === 'hk1-source-1');
    assert.truthy(src1, 'hk1-source-1 must be in the bank');
    assert.equal(src1.questions[0].id, 's1-1');
    assert.equal(m.mathById('s1-1'), src1.questions[0]);
  });

  test('finishing a HK1 paper stores the ids of the questions actually missed', () => {
    const { ctx, m } = loadMath();
    const exam = m.mathExamsAll().find(e => e.id === 'hk1-exam1');
    assert.truthy(isAllMcq(m, exam), 'hk1-exam1 must be an all-MCQ paper');

    const missed = sitPaper(m, exam.id, new Set([2, 7, 15]));
    assert.equal(missed.length, 3, 'the run did not reach every question');

    const run = ctx.appState.mathHistory[0];
    assert.truthy(run, 'the paper was not saved to history');
    assert.equal(run.examId, exam.id);
    assert.equal(run.score, exam.questions.length - 3);

    // (a) real ids, not undefined/null placeholders
    assert.equal(run.wrong.length, 3, 'one id per missed question');
    run.wrong.forEach((id, k) => {
      assert.truthy(id !== undefined && id !== null && String(id).trim() !== '',
        `wrong[${k}] is empty — the review panel would have nothing to look up`);
    });

    // (b) each id resolves back to the SAME question that was missed…
    run.wrong.forEach((id, k) => {
      const found = m.mathById(id);
      assert.truthy(found, `mathById(${id}) found nothing`);
      assert.equal(found.q, missed[k].q, `mathById(${id}) resolved to a different question`);
      assert.equal(found.answer, missed[k].answer);
    });

    // …and never to the first question of the first paper, which is what the
    // old `q.id === undefined` lookup returned for every miss in the app.
    const decoy = m.mathExamsAll()[0].questions[0];
    run.wrong.forEach(id => {
      assert.truthy(m.mathById(id) !== decoy,
        'the lookup fell back on the first question of the first paper');
    });
  });

  test('the review panel counts the misses against the right questions', () => {
    const { ctx, m } = loadMath();
    const exam = m.mathExamsAll().find(e => e.id === 'hk1-exam2');
    assert.truthy(isAllMcq(m, exam), 'hk1-exam2 must be an all-MCQ paper');
    const missed = sitPaper(m, exam.id, new Set([0, 4]));
    assert.equal(missed.length, 2);

    // A round trip through localStorage: this is where `undefined` turned into
    // `null` and the misses disappeared from the panel for good.
    ctx.appState.mathHistory = JSON.parse(JSON.stringify(ctx.appState.mathHistory));

    const panel = m.mathWrongAggregate();
    assert.equal(panel.length, 2, 'the panel must list exactly the two missed questions');
    assert.deepEqual(panel.map(x => x.q.q).sort(), missed.map(x => x.q).sort());
    panel.forEach(x => assert.equal(x.misses, 1));
  });

  test('a missed exam question is owed back in the retry drill', () => {
    const { ctx, m } = loadMath();
    const exam = m.mathExamsAll().find(e => e.id === 'hk1-exam3');
    assert.truthy(isAllMcq(m, exam), 'hk1-exam3 must be an all-MCQ paper');
    const missed = sitPaper(m, exam.id, new Set([1, 9]));
    assert.equal(missed.length, 2);

    assert.equal(m.retryCount('math'), 2, 'the drill queue must hold both missed questions');
    assert.deepEqual(m.retryList('math').map(q => q.q).sort(), missed.map(x => x.q).sort());
    assert.equal((ctx.appState.mathRetry || []).length, 2, 'the debt must persist as ids');
  });

  test('a HK2 paper is stored and resolved the same way', () => {
    const { ctx, m } = loadMath();
    m.openMathSection('hk2');
    const hk2 = m.mathExams().find(e => isAllMcq(m, e));
    assert.truthy(hk2, 'học kì 2 must offer at least one all-MCQ paper');
    const missed = sitPaper(m, hk2.id, new Set([0]));
    assert.equal(missed.length, 1);

    const run = ctx.appState.mathHistory[0];
    assert.equal(run.examId, hk2.id);
    assert.equal(run.wrong.length, 1);
    assert.truthy(String(run.wrong[0]).trim() !== '');
    assert.equal(m.mathById(run.wrong[0]), missed[0]);
  });

  test('mathById refuses an empty id instead of matching the first exam question', () => {
    const { m } = loadMath();
    assert.equal(m.mathById(undefined), null, 'mathById(undefined) must not resolve');
    assert.equal(m.mathById(null), null, 'mathById(null) must not resolve');
    assert.equal(m.mathById(''), null, "mathById('') must not resolve");
  });

  test('a history written before the fix leaves the panel empty, not wrong', () => {
    const { ctx, m } = loadMath();
    // In-memory, straight after an old run: `wrong` held three `undefined`s,
    // and every one of them resolved to hk1-exam1 question 1 — a question the
    // child had never seen, shown with a miss count of 3.
    const run = { date: 1, examId: 'hk1-exam1', label: 'HK1 Exam 1', score: 22, total: 25 };
    ctx.appState.mathHistory = [Object.assign({}, run, { wrong: [undefined, undefined, undefined] })];
    assert.deepEqual(m.mathWrongAggregate(), [],
      'an id-less history must not pin its miss count on somebody else’s question');

    // And after the reload that turned those into `null`s.
    ctx.appState.mathHistory = [Object.assign({}, run, { wrong: [null, null, null] })];
    assert.deepEqual(m.mathWrongAggregate(), []);
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
