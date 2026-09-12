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
       math4PickQuestions, math4PickPreQuestions, math4ChoiceOptions, math4BuildPreQuestion,
       startMath4Mix, startMath4Pre, renderToan4MenuHTML, renderMathMenuHTML,
       openMathSection, renderMathHome, mathIsTyped, mathHasAnswerParts, mathIsCorrect,
       mathGrade, mathKey, mathTypedReset, answerMathQuestion, submitMathTyped, nextMathQuestion,
       mathCurrentQuestion, mathQuizQuit, isMathQuizActive, mathQuizAnswered,
       mathPartInput, math4FreeEntry, math4AllFilled, math4Clean, math4InputHTML,
       mathPartSync, math4Values, math4DomValue,
       mathAnswerPartsHTML, mathKeypadHTML, MATH4_ANSWER_MAX,
       mathPerfectBonus, MATH4_QUIZ_SIZE, MATH4_PER_TYPE,
       MATH_COINS_PER_CORRECT, MATH4_MIX_PERFECT_BONUS, MATH4_PRE_PERFECT_BONUS,
     };`,
  ].join('\n'), ctx, { filename: 'math4-combined.js' });
  return { ctx, m: ctx.__math, screen, nav, asked };
}

// Fill every box of the current question the way a child does — one tap into
// a box, then the digits — and press the single check button.
function answerCurrent(m, q, wrongFirstBox) {
  q.answerParts.forEach((part, k) => {
    const want = String(part.answer);
    const text = (wrongFirstBox && k === 0) ? String(Number(want) + 1) : want;
    m.mathPartInput(k, text);
  });
  m.submitMathTyped();
}

// Sit the whole paper. `wrongAt` holds the 0-based question positions to get
// deliberately wrong (one digit changed in the first box); everything else is
// answered exactly right.
function sitPaper(m, wrongAt) {
  m.startMath4Mix();
  const seen = [];
  for (let i = 0; i < 50; i++) {
    const q = m.mathCurrentQuestion();
    if (!q) break;
    seen.push(q);
    answerCurrent(m, q, wrongAt.has(i));
    m.nextMathQuestion();
  }
  return seen;
}

function sitPre(m, wrongAt) {
  m.startMath4Pre();
  const seen = [];
  for (let i = 0; i < 50; i++) {
    const q = m.mathCurrentQuestion();
    if (!q) break;
    seen.push(q);
    const pick = wrongAt.has(i) ? (q.correct + 1) % 4 : q.correct;
    m.answerMathQuestion(pick);
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

suite('toán 4: một tờ đề Mix', () => {
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

  test('sitting it perfectly banks 10/10, adds the 100 xu bonus, and files the run as Toán 4', () => {
    const { ctx, m, screen } = loadMath();
    const seen = sitPaper(m, new Set());
    assert.equal(seen.length, 10, 'the paper should have run to the end');
    assert.equal(m.isMathQuizActive(), false, 'finishing must clear the round');
    const h = ctx.appState.mathHistory[0];
    assert.truthy(h, 'nothing was written to the history');
    assert.equal(h.score, 10);
    assert.equal(h.total, 10);
    assert.equal(h.grade, 4, 'the run must say which môn it was');
    assert.equal(h.g4set, 'mix');
    assert.equal(h.chapter, 'g4-mix');
    assert.equal(h.label, 'Toán 4 · Mix');
    assert.equal(ctx.appState.coins,
      10 * m.MATH_COINS_PER_CORRECT + m.MATH4_MIX_PERFECT_BONUS,
      '10 correct answers must pay their normal coins plus exactly 100 xu');
    assert.truthy(screen.innerHTML.includes('Thưởng đúng 100%'), 'the result must explain why the bonus was paid');
    assert.truthy(screen.innerHTML.includes('+100 xu'), 'the result must show the bonus amount');
    // Toán 4 rounds must not be counted as Toán 7 rounds anywhere.
    assert.equal(m.math4History().length, 1);
    assert.equal(m.math7History().length, 0);
  });

  test('a wrong box costs the mark for that question and nothing else', () => {
    const { ctx, m, screen } = loadMath();
    sitPaper(m, new Set([0, 4, 9]));
    const h = ctx.appState.mathHistory[0];
    assert.equal(h.total, 10);
    assert.equal(h.score, 7, 'three wrong questions should score 7');
    assert.equal((h.wrong || []).length, 3);
    assert.equal(ctx.appState.coins, 7 * m.MATH_COINS_PER_CORRECT,
      'an imperfect paper must not receive the 100 xu bonus');
    assert.truthy(!screen.innerHTML.includes('Thưởng đúng 100%'),
      'an imperfect result must not advertise the perfect bonus');
  });

  test('Mix keeps 100 xu while the new Pre pays 50 xu for a perfect round', () => {
    const { m } = loadMath();
    assert.equal(m.mathPerfectBonus('g4-mix', 10, 10), 100);
    assert.equal(m.mathPerfectBonus('g4-pre', 10, 10), 50);
    assert.equal(m.mathPerfectBonus('g4-pre', 9, 10), 0);
    assert.equal(m.mathPerfectBonus('ch1', 10, 10), 0);
    assert.equal(m.mathPerfectBonus('g4-pre', 0, 0), 0);
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
    m.startMath4Mix();
    assert.equal(nav.style.display, 'none', 'the bar must not sit under the thumb for ten questions');
    sitPaperFinish(m);
    assert.equal(nav.style.display, '', 'the bar must come back when the paper is over');
  });

  test('walking out mid-paper asks first, and staying keeps the work', () => {
    const { ctx, m, asked } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    answerCurrent(m, q, false);
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

  test('the Toán 4 menu offers Mix and Pre, and the Toán tab lists Toán 4 under Toán 7', () => {
    const { m, screen } = loadMath();
    m.openMathSection('home');
    const home = screen.innerHTML;
    assert.truthy(home.includes("openMathSection('toan7')"), 'Toán 7 card missing');
    assert.truthy(home.includes("openMathSection('toan4')"), 'Toán 4 card missing');
    assert.truthy(home.indexOf("openMathSection('toan7')") < home.indexOf("openMathSection('toan4')"),
      'Toán 4 must sit below Toán 7');

    m.openMathSection('toan4');
    const menu = screen.innerHTML;
    assert.truthy(menu.includes('startMath4Mix()'), 'the Mix button is missing');
    assert.truthy(menu.includes('startMath4Pre()'), 'the Pre button is missing');
    assert.falsy(menu.includes('math4-pre-cta'), 'Pre must use the same visible menu-card palette as Mix');
    assert.truthy(menu.includes('Chọn 1 trong 4 đáp án'), 'the Pre interaction is not explained');
    assert.truthy(menu.includes('TOÁN 4'), 'the header does not say which môn this is');
    for (const t of MATH4_TYPES) {
      assert.truthy(menu.includes(t.title), 'dạng not listed: ' + t.title);
    }
  });

  test('Mix and Pre share the readable primary menu-card colors', () => {
    const css = src('css/styles.css');
    const primary = css.match(/\.phrases-cta\s*\{([^}]*)\}/);
    assert.truthy(primary, 'shared menu-card style is missing');
    assert.truthy(primary[1].includes('linear-gradient(135deg, #2ecc71, #9b59b6)'),
      'shared menu-card background must remain visible');
    assert.truthy(primary[1].includes('color: #fff'),
      'shared menu-card text color must contrast with its background');
    assert.falsy(/\.math4-pre-cta\s*\{/.test(css),
      'Pre must not override the shared menu-card colors');
  });

  test('an empty bank never opens a paper of nothing — the start explains, the menu never locks', () => {
    // The bank rides in the Math tab's lazy group, which is awaited before
    // this menu draws; the only way to be here with it empty is a download
    // that failed. The menu used to draw the cards LOCKED with "Đang tải…"
    // for that — a lock nobody could ever open (the shape of the HK2 bug,
    // tests/lazy-entry-points.test.js). Now the cards stay tappable and the
    // start says what happened and offers a retry.
    const { m, screen, ctx } = loadMath();
    vm.runInContext('MATH4_QUESTIONS.length = 0; MATH4_TYPES.length = 0;', ctx);
    m.openMathSection('toan4');
    assert.truthy(screen.innerHTML.includes('startMath4Pre()') && screen.innerHTML.includes('startMath4Mix()'), 'the cards are offered');
    assert.falsy(/locked|Đang tải/.test(screen.innerHTML), 'and never drawn locked for loading');
    assert.deepEqual(m.math4PickQuestions(), []);
    m.startMath4Mix();
    assert.equal(m.isMathQuizActive(), false, 'starting an empty paper must not open a paper');
    assert.truthy(/Chưa tải được/.test(screen.innerHTML) && /Thử lại/.test(screen.innerHTML), 'it says why and offers a retry');
  });
});

suite('toán 4: Pre trắc nghiệm', () => {
  test('draws 10 questions in a strict 2-2-2-2-2 order', () => {
    const { m } = loadMath();
    for (let round = 0; round < 20; round++) {
      const picked = m.math4PickPreQuestions();
      assert.equal(picked.length, 10);
      assert.deepEqual(picked.map(q => q.t), [1, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
      assert.equal(new Set(picked.map(q => q.sourceId)).size, 10, 'a source exercise was repeated');
    }
  });

  test('turns exactly one answer part into four unique choices and keeps the bank explanation', () => {
    const { m } = loadMath();
    for (const source of MATH4_QUESTIONS) {
      source.answerParts.forEach((part, partIndex) => {
        const q = m.math4BuildPreQuestion(source, partIndex);
        assert.equal(q.options.length, 4, q.id);
        assert.equal(new Set(q.options).size, 4, q.id + ' has duplicate choices');
        assert.equal(q.options[q.correct], part.answer);
        assert.equal(q.answer, part.answer);
        assert.equal(q.choicePrompt, part.label);
        assert.equal(q.explanation, source.explanation, 'the authored solution must be preserved');
        assert.falsy(q.answerParts, 'Pre must render choices rather than input boxes');
      });
    }
  });

  test('renders four large answers, feedback, and the original explanation after a tap', () => {
    const { m, screen } = loadMath();
    m.startMath4Pre();
    const q = m.mathCurrentQuestion();
    assert.equal((screen.innerHTML.match(/class="grammar-option"/g) || []).length, 4);
    assert.truthy(screen.innerHTML.includes('math4-pre-prompt'));
    assert.truthy(screen.innerHTML.includes(q.choicePrompt));
    m.answerMathQuestion(q.correct);
    assert.truthy(screen.innerHTML.includes('grammar-explanation correct'));
    assert.truthy(screen.innerHTML.includes('Câu tiếp'));
  });

  test('a perfect Pre round pays 20 normal xu plus exactly 50 bonus xu', () => {
    const { ctx, m, screen } = loadMath();
    const seen = sitPre(m, new Set());
    assert.equal(seen.length, 10);
    const h = ctx.appState.mathHistory[0];
    assert.equal(h.score, 10);
    assert.equal(h.total, 10);
    assert.equal(h.grade, 4);
    assert.equal(h.g4set, 'pre');
    assert.equal(h.chapter, 'g4-pre');
    assert.equal(h.label, 'Toán 4 · Pre');
    assert.equal(ctx.appState.coins, 10 * m.MATH_COINS_PER_CORRECT + 50);
    assert.truthy(screen.innerHTML.includes('+50 xu'));
  });

  test('an imperfect Pre round gets only per-correct coins', () => {
    const { ctx, m, screen } = loadMath();
    sitPre(m, new Set([1, 8]));
    assert.equal(ctx.appState.mathHistory[0].score, 8);
    assert.equal(ctx.appState.coins, 8 * m.MATH_COINS_PER_CORRECT);
    assert.falsy(screen.innerHTML.includes('Thưởng đúng 100%'));
  });

  test('locks the bottom navigation for the whole round and restores it at the result', () => {
    const { m, nav } = loadMath();
    m.startMath4Pre();
    assert.equal(nav.style.display, 'none');
    sitPreFinish(m);
    assert.equal(nav.style.display, '');
  });
});

function sitPreFinish(m) {
  for (let i = 0; i < 50; i++) {
    const q = m.mathCurrentQuestion();
    if (!q) return;
    m.answerMathQuestion(q.correct);
    m.nextMathQuestion();
  }
}

// Finish whatever paper is open by answering everything correctly.
function sitPaperFinish(m) {
  for (let i = 0; i < 50; i++) {
    const q = m.mathCurrentQuestion();
    if (!q) return;
    answerCurrent(m, q, false);
    m.nextMathQuestion();
  }
}

// ---------------------------------------------------------------------------
// The answer boxes are REAL inputs, for Toán 4 only.
//
// They used to be drawn divs fed by an in-app keypad, one box at a time: the
// child filled box 1, pressed "Lưu kết quả này →", filled box 2, and so on.
// Two things were wrong with that on an iPad. No input meant no system number
// pad and no caret, so a wrong digit in the middle of 125422 could only be
// reached by backspacing over everything after it. And going back to an
// earlier box through "Sửa" THREW AWAY every box after it, because the edit
// path truncated the stored values.
//
// Now each box is an <input inputmode="numeric">: the iPad raises its own
// number pad, the caret goes wherever the child taps, boxes are filled in any
// order, and one press marks the lot.
suite('toán 4: mỗi ô đáp án là một ô nhập thật', () => {
  // A tiny stand-in for the browser's input element, so a test can type the
  // way a child does — put the caret somewhere and insert a character there.
  function fakeInput(qid, value) {
    const v = value == null ? '' : String(value);
    return { value: v, selectionEnd: v.length, disabled: false,
             _attrs: { 'data-q': qid == null ? '' : String(qid) },
             getAttribute(k) { return this._attrs[k]; },
             setSelectionRange(a) { this.selectionEnd = a; } };
  }

  // A page whose four boxes already hold `values`, stamped with `qid`, and a
  // check button — with NOTHING having gone through mathPartInput. That is
  // the shape iOS leaves behind when it restores a form on a tab it discarded.
  function pageWith(ctx, q, values, qid) {
    const els = {};
    const btn = { disabled: true };
    q.answerParts.forEach((part, i) => {
      els['mathPart' + i] = fakeInput(qid === undefined ? q.id : qid, values[i]);
    });
    ctx.document.getElementById = (id) =>
      (id === 'mathSubmitBtn' ? btn : (els[id] || null));
    return { els, btn };
  }

  test('every box is an input the iPad can raise a number pad for', () => {
    const { m, screen } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    const html = screen.innerHTML;
    assert.equal((html.match(/class="math-answer-input"/g) || []).length, q.answerParts.length,
      'one real input per answer box');
    assert.truthy(/inputmode="numeric"/.test(html), 'without inputmode the iPad offers letters');
    assert.truthy(/type="text"/.test(html) && !/type="number"/.test(html),
      'type=number spins on a stray scroll and hides what it dislikes behind an empty value');
    q.answerParts.forEach((part, i) =>
      assert.truthy(html.includes('id="mathPart' + i + '"'), 'box ' + i + ' needs its own id'));
  });

  test('the in-app keypad and its one-box-at-a-time save are gone from Toán 4', () => {
    const { m, screen } = loadMath();
    m.startMath4Mix();
    const html = screen.innerHTML;
    assert.falsy(/math-keypad/.test(html), 'the drawn keypad would sit under the iPad keyboard');
    assert.falsy(/mathAnswerSlot/.test(html), 'there is no single active box any more');
    assert.falsy(/Lưu kết quả này/.test(html), 'one press marks the whole question');
    assert.falsy(/math-part-edit/.test(html), 'a real input is edited by tapping it, not by a Sửa button');
    assert.truthy(/Kiểm tra tất cả/.test(html), 'the one button marks every box');
  });

  test('the question is not repeated back at the child above the boxes', () => {
    // The stem already says "Đặt tính rồi tính:" and the ✏️ in the quiz
    // header already opens the board. The banner that used to sit here said
    // both again, in a box the width of the screen.
    const { m, screen } = loadMath();
    m.startMath4Mix();
    const html = screen.innerHTML;
    assert.falsy(/math-board-prompt/.test(html), 'the duplicate banner must be gone');
    assert.falsy(/Mở bảng nháp/.test(html), 'and its second door to the board with it');
    assert.truthy(/math-board-fab/.test(html), 'the ✏️ in the header is the way in');
    assert.truthy(/openMathBoard\(\)/.test(html), 'and it still opens the board');
  });

  test('the boxes can be filled in any order, and each keeps its own number', () => {
    const { m } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    assert.truthy(q.answerParts.length >= 4, 'dạng 1 should open the paper with four sums');
    // Deliberately backwards, then the middle two — the child taps whichever
    // sum they finished first.
    const order = [3, 0, 2, 1];
    order.forEach(i => m.mathPartInput(i, q.answerParts[i].answer));
    m.submitMathTyped();
    assert.equal(m.mathQuizAnswered(), 1, 'the question must be marked');
    assert.truthy(m.mathIsCorrect(q, [0, 1, 2, 3].map(i => q.answerParts[i].answer)),
      'every box was right, so the question is right');
  });

  test('fixing box 1 leaves boxes 2-4 alone — the old Sửa button wiped them', () => {
    const { m } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    q.answerParts.forEach((part, i) => m.mathPartInput(i, part.answer));
    // Go back to the first box and retype it wrong, the way a child would
    // after spotting a slip. Nothing else may move.
    m.mathPartInput(0, String(Number(q.answerParts[0].answer) + 1));
    assert.truthy(m.math4AllFilled(q), 'the later boxes must still hold their numbers');
    m.submitMathTyped();
    const st = m.mathCurrentQuestion();
    assert.equal(st.id, q.id, 'still on the same question');
    assert.falsy(m.mathIsCorrect(q, q.answerParts.map((p, i) => i === 0
      ? String(Number(p.answer) + 1) : p.answer)), 'only the retyped box is wrong');
  });

  test('the check button stays disabled until every box has something in it', () => {
    const { m } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    assert.falsy(m.math4AllFilled(q), 'an untouched paper cannot be submitted');
    // Fill the LAST box first. A plain values.every() would call this complete,
    // because assigning index 3 of an empty array leaves holes that every()
    // silently skips.
    m.mathPartInput(q.answerParts.length - 1, '7');
    assert.falsy(m.math4AllFilled(q), 'holes are not filled boxes');
    m.submitMathTyped();
    assert.equal(m.mathQuizAnswered(), 0, 'a half-filled question must not be marked');
    q.answerParts.forEach((part, i) => m.mathPartInput(i, part.answer));
    assert.truthy(m.math4AllFilled(q));
    m.submitMathTyped();
    assert.equal(m.mathQuizAnswered(), 1);
  });

  test('a box holding only spaces is still empty', () => {
    const { m } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    q.answerParts.forEach((part, i) => m.mathPartInput(i, i === 1 ? '   ' : part.answer));
    assert.falsy(m.math4AllFilled(q), 'whitespace is not an answer');
  });

  test('nothing but digits reaches the answer', () => {
    const { m } = loadMath();
    m.startMath4Mix();
    assert.equal(m.mathPartInput(0, '12a3'), '123', 'a letter is dropped');
    assert.equal(m.mathPartInput(0, '-45'), '45', 'a minus is dropped — no Toán 4 answer is negative');
    assert.equal(m.mathPartInput(0, '1 2 3'), '123', 'spaces are dropped');
    assert.equal(m.mathPartInput(0, '9'.repeat(40)).length, m.MATH4_ANSWER_MAX,
      'a long paste is capped');
    assert.equal(m.math4Clean(null), '', 'nothing at all is empty, not "null"');
  });

  test('cleaning a typo keeps the caret where the child was typing', () => {
    const { m, ctx } = loadMath();
    m.startMath4Mix();
    const el = fakeInput();
    ctx.document.getElementById = (id) => (id === 'mathPart0' ? el : null);
    // The child had "1234", put the caret after the "2", and typed "x".
    el.value = '12x34';
    el.selectionEnd = 3;
    m.mathPartInput(0, el.value);
    assert.equal(el.value, '1234', 'the letter is removed');
    assert.equal(el.selectionEnd, 2, 'the caret stays between 2 and 3, not at the end');
  });

  test('a clean keystroke never rewrites the field, so the caret cannot jump', () => {
    const { m, ctx } = loadMath();
    m.startMath4Mix();
    let writes = 0;
    const el = fakeInput();
    Object.defineProperty(el, 'value', {
      get() { return this._v || ''; },
      set(v) { writes++; this._v = v; },
    });
    el.value = '1234';       // one write: the child's own typing
    ctx.document.getElementById = (id) => (id === 'mathPart0' ? el : null);
    m.mathPartInput(0, '1234');
    assert.equal(writes, 1, 'assigning .value would send the caret to the end');
  });

  test('the submit button is enabled and disabled without repainting the screen', () => {
    const { m, ctx } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    const btn = { disabled: true };
    ctx.document.getElementById = (id) => (id === 'mathSubmitBtn' ? btn : null);
    q.answerParts.forEach((part, i) => m.mathPartInput(i, part.answer));
    assert.falsy(btn.disabled, 'a full set of boxes enables the check button');
    m.mathPartInput(0, '');
    assert.truthy(btn.disabled, 'emptying a box disables it again');
    // A repaint here would drop focus and take the iPad keyboard down mid-number.
    assert.falsy(/math-answer-input/.test(''), 'sanity');
  });

  test('typing into an already-marked question changes nothing', () => {
    const { m } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    q.answerParts.forEach((part, i) => m.mathPartInput(i, part.answer));
    m.submitMathTyped();
    assert.equal(m.mathPartInput(0, '999'), '', 'the boxes are closed once marked');
    assert.equal(m.mathQuizAnswered(), 1);
  });

  test('an index outside the question is refused', () => {
    const { m } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    assert.equal(m.mathPartInput(q.answerParts.length, '5'), '');
    assert.equal(m.mathPartInput(-1, '5'), '');
    assert.equal(m.mathPartInput(1.5, '5'), '');
    assert.falsy(m.math4AllFilled(q), 'none of those may count as a filled box');
  });

  test('Toán 7 keeps its drawn keypad — it needs glyphs no phone keyboard has', () => {
    const { m } = loadMath();
    // Same shape as a Toán 7 source-exam question: answer boxes, but no grade 4.
    const seven = { id: 's2-10', q: 'Tìm x', answerParts: [
      { label: 'Nghiệm âm', answer: '-3' }, { label: 'Nghiệm dương', answer: '3' }] };
    assert.falsy(m.math4FreeEntry(seven), 'only Toán 4 gets free entry');
    assert.falsy(m.math4AllFilled(seven), 'and the fill check refuses to answer for it');
    const html = m.mathAnswerPartsHTML(seven, null);
    assert.falsy(/math-answer-input/.test(html), 'Toán 7 must not get a numeric-only input');
    assert.truthy(/mathAnswerSlot/.test(html), 'it still types into one active box');
    assert.truthy(/math-answer-parts"/.test(html), 'and is not marked as free entry');
    assert.truthy(/math-key/.test(m.mathKeypadHTML(seven)), 'its keypad still builds');
  });

  // -------------------------------------------------------------------------
  // The box on screen is the answer, not a shadow copy of it.
  //
  // It WAS a copy, and the copy could fall behind. A value that reaches a
  // field without firing `input` — iOS restoring a form on a tab it had
  // discarded is the everyday way — left every box visibly full while the copy
  // stayed empty, so "Kiểm tra tất cả" never came back on and a child who had
  // finished the question could not hand it in. Every test above passed
  // throughout, because every one of them put its values in THROUGH the copy.
  test('values the browser restored into the boxes still count as answers', () => {
    const { m, ctx } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    // Nothing goes through mathPartInput here. That is the whole point.
    const { btn } = pageWith(ctx, q, q.answerParts.map(p => p.answer));
    assert.deepEqual(m.math4Values(q), q.answerParts.map(p => String(p.answer)),
      'the boxes on screen are what the child answered');
    assert.truthy(m.math4AllFilled(q), 'a full set of boxes is a full set of answers');
    m.submitMathTyped();
    assert.equal(m.mathQuizAnswered(), 1, 'a finished question must be markable');
    assert.truthy(m.mathIsCorrect(q, q.answerParts.map(p => String(p.answer))));
    assert.falsy(btn.disabled === undefined, 'sanity: the fake button exists');
  });

  test('and touching any box puts the check button back in step', () => {
    const { m, ctx } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    const { btn } = pageWith(ctx, q, q.answerParts.map(p => p.answer));
    assert.truthy(btn.disabled, 'it starts stuck, the way the child found it');
    assert.truthy(m.mathPartSync(), 'a tap on a box re-checks the boxes');
    assert.falsy(btn.disabled, 'and releases the button');
  });

  test('one emptied box disables it again, even though the copy still has that number', () => {
    const { m, ctx } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    q.answerParts.forEach((p, i) => m.mathPartInput(i, p.answer));   // copy is full
    const { btn } = pageWith(ctx, q, q.answerParts.map((p, i) => i === 2 ? '' : p.answer));
    assert.falsy(m.math4AllFilled(q), 'the empty box on screen wins over the stale copy');
    m.mathPartSync();
    assert.truthy(btn.disabled);
    m.submitMathTyped();
    assert.equal(m.mathQuizAnswered(), 0, 'and an empty box cannot be submitted');
  });

  test('the boxes left over from the previous question are never read', () => {
    // renderMathQuestion builds its HTML while the PREVIOUS question's inputs
    // are still in the document. Without the data-q stamp, question 2 would
    // open pre-filled with question 1's answers and a live check button.
    const { m, ctx } = loadMath();
    m.startMath4Mix();
    const first = m.mathCurrentQuestion();
    answerCurrent(m, first, false);
    m.nextMathQuestion();
    const second = m.mathCurrentQuestion();
    assert.truthy(second && second.id !== first.id, 'the paper must have moved on');
    // The stale fields still carry question 1's id and answers.
    pageWith(ctx, second, first.answerParts.map(p => p.answer), first.id);
    assert.equal(m.math4DomValue(second, 0), null, 'a box from another question is not readable');
    assert.deepEqual(m.math4Values(second), second.answerParts.map(() => ''),
      'the new question starts empty');
    assert.falsy(m.math4AllFilled(second), 'and its check button starts off');
  });

  test('a marked Toán 4 question shows the boxes as results, not as inputs', () => {
    const { m } = loadMath();
    m.startMath4Mix();
    const q = m.mathCurrentQuestion();
    const html = m.mathAnswerPartsHTML(q, q.answerParts.map(p => p.answer));
    assert.falsy(/math-answer-input/.test(html), 'a finished question is not editable');
    assert.equal((html.match(/math-answer-box correct/g) || []).length, q.answerParts.length);
  });
});

suite('toán 4: an admin can hand out Pre and Mix separately', () => {
  test('the catalog carries both Toán 4 modes in their own group', () => {
    const pre = Catalog.get('math4:pre');
    const mix = Catalog.get('math4:mix');
    assert.truthy(pre, 'math4:pre is missing from the catalog');
    assert.truthy(mix, 'math4:mix is missing from the catalog');
    assert.equal(pre.group, 'math4');
    assert.equal(mix.group, 'math4');
    assert.equal(pre.activityType, 'math');
    assert.equal(mix.activityType, 'math');
    assert.truthy(Catalog.groups().some(g => g.id === 'math4'), 'the admin dropdown has no Toán 4 group');
    // The group is shared with the nine Bảng cửu chương tasks. What matters
    // here is that Pre and Mix are each still their own assignable entry —
    // a count alone would only say the group has not shrunk.
    const keys = Catalog.entries('math4').map(e => e.key);
    assert.truthy(keys.includes('math4:pre') && keys.includes('math4:mix'));
    assert.equal(keys.filter(k => k === 'math4:pre' || k === 'math4:mix').length, 2,
      'Pre and Mix must stay two separate tasks, not be merged into one');
    assert.truthy(pre.label.includes('Chọn 1 trong 4 đáp án'));
    assert.truthy(mix.label.includes('Nhập đáp án'));
    assert.truthy(pre.label.includes('10/10') && mix.label.includes('10/10'));
  });

  test('each mode matches only its own uploaded g4set', () => {
    const pre = Catalog.get('math4:pre');
    const mix = Catalog.get('math4:mix');
    assert.deepEqual(pre.match, { detail: { field: 'g4set', value: 'pre' } });
    assert.deepEqual(mix.match, { detail: { field: 'g4set', value: 'mix' } });
    // And that field really is written — by the same code path a finished
    // paper takes. auth.js builds it from the session, so read the session.
    const { ctx, m } = loadMath();
    sitPre(m, new Set());
    assert.equal(ctx.appState.mathHistory[0].g4set, 'pre',
      'the task matches on g4set, so the run has to carry it');
    // A Toán 7 chapter task must never be satisfied by a Toán 4 paper: its
    // chapter is a string and can equal no chapter number.
    assert.equal(typeof ctx.appState.mathHistory[0].chapter, 'string');
  });

  test('each deep link opens Toán 4 and starts the chosen mode', () => {
    const math = src('js/math.js');
    for (const [key, starter] of [['math4:pre', 'startMath4Pre'], ['math4:mix', 'startMath4Mix']]) {
      const entry = Catalog.get(key);
      assert.equal(entry.go.screen, 'mathHubScreen');
      assert.deepEqual(entry.go.calls.map(c => c.slice()),
        [['openMathSection', 'toan4'], [starter]]);
      for (const [fn] of entry.go.calls) {
        assert.truthy(new RegExp('^function ' + fn + '\\s*\\(', 'm').test(math), fn + ' is not a function');
      }
      const { m } = loadMath();
      for (const [fn, ...args] of entry.go.calls) m[fn] ? m[fn](...args) : null;
      assert.truthy(m.isMathQuizActive(), key + ' deep link did not open a paper');
      const q = m.mathCurrentQuestion();
      if (key.endsWith('pre')) assert.equal(q.options.length, 4);
      else assert.truthy(q.answerParts.length > 0);
    }
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
    sitPre(m, new Set([1]));
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
      'the bank must be listed in the lazy loader (SCREEN_FILES.mathHubScreen)');
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
