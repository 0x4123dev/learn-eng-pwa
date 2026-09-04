// math4.test.js — Toán 4 · Đề ôn "Pre".
//
// 500 questions whose answers were produced by five generator scripts. The
// build (scripts/build-math4-data.js) already re-derives every one of them
// with its own arithmetic; this file asks the other question — can a CHILD
// actually sit the paper and be graded correctly?
//
// So nothing below matches source text. It opens the paper the way the button
// does, types every answer on the real keypad, submits, finishes, and reads
// the stored history back the way the timeline and the daily task do.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const { MATH4_QUESTIONS, MATH4_TYPES } = require(path.join(root, 'js', 'math4-data.js'));
const Catalog = require(path.join(root, 'js', 'daily-task-catalog.js'));

const PER_TYPE = 100;
const TYPES = [1, 2, 3, 4, 5];
const PARTS_PER_TYPE = { 1: 4, 2: 2, 3: 2, 4: 1, 5: 2 };

// js/math.js in its own realm, with the Toán 4 bank injected as an ordinary
// global — because on the real page it arrives from a lazy-loaded <script>
// (js/lazy-data.js SCREEN_FILES.mathHubScreen) long after math.js is parsed.
function loadMath() {
  const screen = { innerHTML: '', scrollTop: 0 };
  const nav = { style: { display: 'flex' } };
  const asked = [];
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
    confirm: (msg) => { asked.push(msg); return ctx.__confirmAnswer; },
    // A copy per realm. The "bank still loading" test truncates these arrays,
    // and require() hands every caller the same array object — so sharing them
    // emptied the bank for every test that ran afterwards.
    MATH4_QUESTIONS: MATH4_QUESTIONS.slice(),
    MATH4_TYPES: MATH4_TYPES.slice(),
    __confirmAnswer: true,
  };
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    src('js/math.js'),
    `globalThis.__math = {
       math4Bank, math4Types, math4Ready, math4History, math7History, math4Best,
       math4PickQuestions, startMath4Pre, renderToan4MenuHTML, renderMathMenuHTML,
       openMathSection, renderMathHome, mathIsTyped, mathHasAnswerParts, mathIsCorrect,
       mathGrade, mathKey, mathTypedReset, submitMathTyped, nextMathQuestion,
       mathCurrentQuestion, mathQuizQuit, isMathQuizActive, mathQuizAnswered,
       MATH4_QUIZ_SIZE, MATH4_PER_TYPE,
     };`,
  ].join('\n'), ctx, { filename: 'math4-combined.js' });
  return { ctx, m: ctx.__math, screen, nav, asked };
}

// Type one answer on the real keypad, one glyph at a time, then submit it.
function typeAnswer(m, text) {
  for (const ch of String(text)) m.mathKey(ch);
  m.submitMathTyped();
}

// Sit the whole paper. `wrongAt` holds the 0-based question positions to get
// deliberately wrong (one digit changed in the first box); everything else is
// answered exactly right.
function sitPaper(m, wrongAt) {
  m.startMath4Pre();
  const seen = [];
  for (let i = 0; i < 50; i++) {
    const q = m.mathCurrentQuestion();
    if (!q) break;
    seen.push(q);
    q.answerParts.forEach((part, k) => {
      const wrong = wrongAt.has(i) && k === 0;
      typeAnswer(m, wrong ? String(Number(part.answer) + 1) : part.answer);
    });
    m.nextMathQuestion();
  }
  return seen;
}

// The typesetter in js/math.js draws "a/b" as a stacked fraction and "x^2" as
// an exponent, so a story sentence containing a slash is drawn as a fraction
// of two half-sentences. <b> and <br> are the only tags a bank may carry.
function proseOffences(text) {
  const bare = String(text == null ? '' : text).replace(/<\/?(?:b|br)\s*\/?>/gi, '');
  return ['/', '^', '<', '>'].filter(ch => bare.indexOf(ch) !== -1);
}

suite('toán 4: the question bank', () => {
  test('500 questions, five dạng of 100, ids sequential and unique', () => {
    assert.equal(MATH4_QUESTIONS.length, 500);
    assert.equal(MATH4_TYPES.length, 5);
    assert.deepEqual(MATH4_TYPES.map(t => t.t), TYPES);
    const ids = new Set();
    for (const t of TYPES) {
      const bank = MATH4_QUESTIONS.filter(q => q.t === t);
      assert.equal(bank.length, PER_TYPE, `dạng ${t}`);
      bank.forEach((q, i) => {
        assert.equal(q.id, `g4t${t}-${i + 1}`, `dạng ${t} câu ${i + 1}`);
        ids.add(q.id);
      });
      assert.equal(MATH4_TYPES.find(x => x.t === t).count, PER_TYPE);
    }
    assert.equal(ids.size, 500, 'two questions share an id');
  });

  test('every question is typed, carries its dạng’s answer boxes, and says it is Toán 4', () => {
    const { m } = loadMath();
    for (const q of MATH4_QUESTIONS) {
      assert.truthy(m.mathHasAnswerParts(q), q.id + ' has no answerParts');
      assert.truthy(m.mathIsTyped(q), q.id + ' would be drawn as multiple choice');
      assert.equal(q.answerParts.length, PARTS_PER_TYPE[q.t], q.id + ' box count');
      assert.equal(q.grade, 4, q.id + ' must be marked grade 4');
      assert.truthy(!q.options, q.id + ' must not carry options');
      assert.truthy(/🔑/.test(q.explanation || ''), q.id + ' explanation has no rule');
      assert.truthy(String(q.topic || '').startsWith('Toán 4'), q.id + ' topic: ' + q.topic);
    }
  });

  test('nothing in a question or its solution would be drawn as a fraction or an exponent', () => {
    const bad = [];
    for (const q of MATH4_QUESTIONS) {
      const inQ = proseOffences(q.q);
      const inE = proseOffences(q.explanation);
      if (inQ.length) bad.push(`${q.id} đề bài: ${inQ.join(' ')}`);
      if (inE.length) bad.push(`${q.id} lời giải: ${inE.join(' ')}`);
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} câu có ký tự sẽ bị vẽ sai`);
  });

  test('every lời giải works the problem — it never jumps to the answer', () => {
    // The one child who opens the solution is the child who got it wrong. A
    // rule sentence followed by the number already showing in the red box
    // teaches them nothing: they need the steps, with this question's own
    // digits. Two things are asserted, both derived from the text rather than
    // typed here:
    //
    //   • the solution has room for steps at all — a floor on its line count,
    //     per dạng, because a phép chia needs more lines than a phép đổi;
    //   • it contains INTERMEDIATE values: numbers it computes on the way that
    //     are not any of the final answers. "30 tấn = 30000 kg" has none and
    //     fails; "30 × 1000 = 30000" does not.
    const MIN_ROWS = { 1: 12, 2: 6, 3: 8, 4: 8, 5: 3 };
    const thin = [], jumped = [];
    for (const q of MATH4_QUESTIONS) {
      const rows = q.explanation.split(/<br\s*\/?>/i).filter(r => r.trim()).length;
      if (rows < MIN_ROWS[q.t]) thin.push(`${q.id}: ${rows} dòng`);
      const answers = new Set(q.answerParts.map(p => String(p.answer)));
      const computed = [...q.explanation.matchAll(/=\s*(?:<b>)?([0-9]+)/g)].map(m => m[1]);
      if (!computed.some(v => !answers.has(v))) jumped.push(q.id);
    }
    assert.deepEqual(thin.slice(0, 8), [], `${thin.length} lời giải quá ngắn để có bước nào`);
    assert.deepEqual(jumped.slice(0, 8), [],
      `${jumped.length} lời giải nhảy thẳng tới đáp án, không có bước trung gian nào`);
  });

  test('the rule at the 🔑 is not the same sentence twice in a row', () => {
    // Ten identical openings in a row teach a child to skip the line, and the
    // line is where the only reasoning lives.
    const repeats = [];
    for (const t of TYPES) {
      const bank = MATH4_QUESTIONS.filter(q => q.t === t);
      const ruleOf = (q) => q.explanation.split(/<br\s*\/?>/i)[0].trim();
      for (let i = 1; i < bank.length; i++) {
        if (ruleOf(bank[i]) === ruleOf(bank[i - 1])) repeats.push(bank[i].id);
      }
    }
    assert.deepEqual(repeats.slice(0, 8), [], `${repeats.length} câu lặp lại y hệt quy tắc của câu ngay trước`);
  });

  test('every stored answer is accepted, and a number one off is not', () => {
    const { m } = loadMath();
    const rejected = [], accepted = [];
    for (const q of MATH4_QUESTIONS) {
      const right = q.answerParts.map(p => p.answer);
      if (!m.mathIsCorrect(q, right)) rejected.push(q.id);
      const off = right.slice();
      off[0] = String(Number(off[0]) + 1);
      if (m.mathIsCorrect(q, off)) accepted.push(q.id);
    }
    assert.deepEqual(rejected.slice(0, 8), [], `${rejected.length} câu chấm SAI đáp án đúng của chính nó`);
    assert.deepEqual(accepted.slice(0, 8), [], `${accepted.length} câu chấm ĐÚNG một đáp án sai`);
  });

  test('the keypad can produce every answer — no glyph a child cannot type', () => {
    // MATH_KEYPAD_ROWS ships 0-9 plus ⌫ / − , ( ). An answer holding anything
    // else is an answer the child is asked for and cannot enter.
    const bad = MATH4_QUESTIONS.flatMap(q =>
      q.answerParts.filter(p => !/^[0-9]+$/.test(String(p.answer)))
        .map(p => `${q.id}: "${p.answer}"`));
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} đáp án không gõ được bằng bàn phím số`);
  });
});

suite('toán 4: một tờ đề Pre', () => {
  test('a paper is 10 questions — two of each dạng, in the order of the real paper', () => {
    const { m } = loadMath();
    for (let round = 0; round < 30; round++) {
      const picked = m.math4PickQuestions();
      assert.equal(picked.length, m.MATH4_QUIZ_SIZE, 'round ' + round);
      assert.deepEqual(picked.map(q => q.t), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5], 'round ' + round);
      assert.equal(new Set(picked.map(q => q.id)).size, 10, 'a question was drawn twice');
    }
  });

  test('two papers in a row are not the same paper', () => {
    const { m } = loadMath();
    const a = m.math4PickQuestions().map(q => q.id).join(',');
    let differed = false;
    for (let i = 0; i < 10 && !differed; i++) {
      if (m.math4PickQuestions().map(q => q.id).join(',') !== a) differed = true;
    }
    assert.truthy(differed, 'ten draws in a row produced the identical paper');
  });

  test('sitting it perfectly banks 10/10 and files the run as Toán 4', () => {
    const { ctx, m } = loadMath();
    const seen = sitPaper(m, new Set());
    assert.equal(seen.length, 10, 'the paper should have run to the end');
    assert.equal(m.isMathQuizActive(), false, 'finishing must clear the round');
    const h = ctx.appState.mathHistory[0];
    assert.truthy(h, 'nothing was written to the history');
    assert.equal(h.score, 10);
    assert.equal(h.total, 10);
    assert.equal(h.grade, 4, 'the run must say which môn it was');
    assert.equal(h.g4set, 'pre');
    assert.equal(h.chapter, 'g4-pre');
    assert.equal(h.label, 'Toán 4 · Đề ôn Pre');
    assert.truthy(ctx.appState.coins > 0, 'a finished paper pays coins');
    // Toán 4 rounds must not be counted as Toán 7 rounds anywhere.
    assert.equal(m.math4History().length, 1);
    assert.equal(m.math7History().length, 0);
  });

  test('a wrong box costs the mark for that question and nothing else', () => {
    const { ctx, m } = loadMath();
    sitPaper(m, new Set([0, 4, 9]));
    const h = ctx.appState.mathHistory[0];
    assert.equal(h.total, 10);
    assert.equal(h.score, 7, 'three wrong questions should score 7');
    assert.equal((h.wrong || []).length, 3);
  });

  test('a missed question shows the number wanted in EVERY box, not an empty tick', () => {
    // A Toán 4 question has no single `answer` — one per box — so the review
    // card has to print all of them. It used to print `q.answer`, which for
    // these questions is undefined: a green tick with nothing beside it.
    const { m, screen } = loadMath();
    const seen = sitPaper(m, new Set([0]));
    const missed = seen[0];
    const card = screen.innerHTML;
    assert.truthy(card.includes('Cần xem lại'), 'the review list is missing');
    for (const part of missed.answerParts) {
      assert.truthy(card.includes(part.answer),
        'the review card does not show the answer ' + part.answer + ' for ' + missed.id);
    }
    assert.truthy(!/✅\s*<b class="math-formula"><\/b>/.test(card), 'an empty tick was rendered');
  });

  test('the bottom bar goes away for the paper and comes back after it', () => {
    const { m, nav } = loadMath();
    assert.equal(nav.style.display, 'flex');
    m.startMath4Pre();
    assert.equal(nav.style.display, 'none', 'the bar must not sit under the thumb for ten questions');
    sitPaperFinish(m);
    assert.equal(nav.style.display, '', 'the bar must come back when the paper is over');
  });

  test('walking out mid-paper asks first, and staying keeps the work', () => {
    const { ctx, m, asked } = loadMath();
    m.startMath4Pre();
    const q = m.mathCurrentQuestion();
    q.answerParts.forEach(p => typeAnswer(m, p.answer));
    assert.equal(m.mathQuizAnswered(), 1);

    ctx.__confirmAnswer = false;
    m.mathQuizQuit();
    assert.equal(asked.length, 1, 'quitting with work done must ask');
    assert.truthy(m.isMathQuizActive(), 'saying no must keep the paper open');

    ctx.__confirmAnswer = true;
    m.mathQuizQuit();
    assert.equal(m.isMathQuizActive(), false, 'saying yes must close it');
    assert.equal(ctx.appState.mathHistory.length, 0, 'an abandoned paper is not scored');
  });

  test('the Toán 4 menu offers Pre, and the Toán tab lists Toán 4 under Toán 7', () => {
    const { m, screen } = loadMath();
    m.openMathSection('home');
    const home = screen.innerHTML;
    assert.truthy(home.includes("openMathSection('toan7')"), 'Toán 7 card missing');
    assert.truthy(home.includes("openMathSection('toan4')"), 'Toán 4 card missing');
    assert.truthy(home.indexOf("openMathSection('toan7')") < home.indexOf("openMathSection('toan4')"),
      'Toán 4 must sit below Toán 7');

    m.openMathSection('toan4');
    const menu = screen.innerHTML;
    assert.truthy(menu.includes('startMath4Pre()'), 'the Pre button is missing');
    assert.truthy(menu.includes('TOÁN 4'), 'the header does not say which môn this is');
    for (const t of MATH4_TYPES) {
      assert.truthy(menu.includes(t.title), 'dạng not listed: ' + t.title);
    }
  });

  test('the menu says the bank is loading rather than offering an empty paper', () => {
    // The bank is lazy-loaded, so a cold, offline first visit reaches this
    // screen with MATH4_QUESTIONS still undefined. Rendering a live Pre button
    // there would open a paper of nothing.
    const { m, screen, ctx } = loadMath();
    vm.runInContext('MATH4_QUESTIONS.length = 0; MATH4_TYPES.length = 0;', ctx);
    m.openMathSection('toan4');
    assert.truthy(!screen.innerHTML.includes('startMath4Pre()'), 'an empty bank must not offer a paper');
    assert.truthy(screen.innerHTML.includes('Đang tải'), 'and must say why');
    assert.deepEqual(m.math4PickQuestions(), []);
    m.startMath4Pre();
    assert.equal(m.isMathQuizActive(), false, 'starting an empty paper must do nothing');
  });
});

// Finish whatever paper is open by answering everything correctly.
function sitPaperFinish(m) {
  for (let i = 0; i < 50; i++) {
    const q = m.mathCurrentQuestion();
    if (!q) return;
    q.answerParts.forEach(p => typeAnswer(m, p.answer));
    m.nextMathQuestion();
  }
}

suite('toán 4: an admin can hand it out like every other task', () => {
  test('the catalog carries one Toán 4 task, in its own group', () => {
    const entry = Catalog.get('math4:pre');
    assert.truthy(entry, 'math4:pre is missing from the catalog');
    assert.equal(entry.group, 'math4');
    assert.equal(entry.activityType, 'math');
    assert.truthy(Catalog.groups().some(g => g.id === 'math4'), 'the admin dropdown has no Toán 4 group');
    assert.equal(Catalog.entries('math4').length, 1);
  });

  test('it matches on what js/auth.js actually uploads for a Toán 4 run', () => {
    const entry = Catalog.get('math4:pre');
    assert.deepEqual(entry.match, { detail: { field: 'g4set', value: 'pre' } });
    // And that field really is written — by the same code path a finished
    // paper takes. auth.js builds it from the session, so read the session.
    const { ctx, m } = loadMath();
    sitPaper(m, new Set());
    assert.equal(ctx.appState.mathHistory[0].g4set, 'pre',
      'the task matches on g4set, so the run has to carry it');
    // A Toán 7 chapter task must never be satisfied by a Toán 4 paper: its
    // chapter is a string and can equal no chapter number.
    assert.equal(typeof ctx.appState.mathHistory[0].chapter, 'string');
  });

  test('the deep link opens Toán 4 and starts the paper', () => {
    const entry = Catalog.get('math4:pre');
    assert.equal(entry.go.screen, 'mathHubScreen');
    assert.deepEqual(entry.go.calls.map(c => c.slice()),
      [['openMathSection', 'toan4'], ['startMath4Pre']]);
    // Both really exist as top-level functions — that is what DailyTask.go
    // looks up on globalThis.
    const math = src('js/math.js');
    for (const [fn] of entry.go.calls) {
      assert.truthy(new RegExp('^function ' + fn + '\\s*\\(', 'm').test(math), fn + ' is not a function');
    }
    // Driven for real, the way the "Vào học" button does it.
    const { m } = loadMath();
    for (const [fn, ...args] of entry.go.calls) m[fn] ? m[fn](...args) : null;
    assert.truthy(m.isMathQuizActive(), 'the deep link did not open a paper');
  });

  test('js/auth.js files a grade-4 run under Toán 4, not Toán 7', () => {
    const auth = src('js/auth.js');
    assert.truthy(auth.includes('g4set: h.g4set'), 'auth.js does not upload g4set');
    assert.truthy(auth.includes('h.grade === 4'), 'auth.js does not tell the two môn apart');
    // Skill analytics too: a Toán 4 sheet averaged into Toán 7's numbers on
    // the admin page can never be told apart again.
    assert.truthy(auth.includes("addSession('math4', 'm4', h)"), 'skills still go up as math7');
    assert.truthy(src('functions/api/skills.js').includes("'math4'"),
      "the server would drop every math4 skill row it is sent");
  });

  test('a Toán 4 run really produces math4.* skill rows', () => {
    const { ctx, m } = loadMath();
    sitPaper(m, new Set([1]));
    const skills = ctx.appState.mathHistory[0].skills || [];
    assert.truthy(skills.length > 0, 'no skill summary was attached');
    const wrongPrefix = skills.filter(s => !String(s.skillKey).startsWith('math4.'));
    assert.deepEqual(wrongPrefix.map(s => s.skillKey), [], 'a Toán 4 sheet filed under another môn');
    assert.equal(skills.reduce((n, s) => n + s.attempts, 0), 10, 'every question should be counted once');
  });
});

suite('toán 4: the bank is lazy, and reachable', () => {
  test('it is a lazy bank of the Toán tab, not a startup script', () => {
    assert.truthy(src('js/lazy-data.js').includes("'js/math4-data.js'"),
      'the bank must be listed in SCREEN_FILES.mathHubScreen');
    assert.truthy(!src('index.html').includes('math4-data.js'),
      '500 questions must not be parsed on every app open');
    assert.truthy(src('sw.js').includes("'/js/math4-data.js'"),
      'the service worker must precache it, or the tab is empty offline');
  });

  test('the feature manifest claims it', () => {
    const { FEATURES } = require(path.join(root, 'tests', 'verify', 'manifest.js'));
    const owner = FEATURES.find(f => (f.banks || []).includes('js/math4-data.js'));
    assert.truthy(owner, 'js/math4-data.js belongs to no feature — npm run verify would go red');
    assert.truthy(owner.verifiedBy, owner.id + ' does not say who verifies it');
  });

  test('the generated bank matches the five author files', () => {
    // js/math4-data.js is generated; hand-editing it is reverted by the next
    // build, silently. Prove the checked-in file is what the build produces.
    const { execFileSync } = require('child_process');
    const before = src('js/math4-data.js');
    execFileSync(process.execPath, [path.join(root, 'scripts', 'build-math4-data.js')], { cwd: root });
    assert.equal(src('js/math4-data.js'), before,
      'js/math4-data.js is out of date — run node scripts/build-math4-data.js');
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
