// math4-scope.test.js — the real-input answer boxes are for Toán 4 ONLY.
//
// Toán 4's answer boxes became real <input inputmode="numeric"> fields so an
// iPad raises its own number pad and the child can drag the caret into the
// middle of a number to fix one digit. Toán 7 must not follow, for two
// independent reasons:
//
//   • Its answers are not numbers a phone keypad can type. The real bank holds
//     41/30, −8/15, 9/2 and 2⁻³ — a digits-only input would silently eat the
//     slash and the minus and mark a right answer wrong.
//   • Its answer boxes are ordered steps of one worked problem (a, b, c), not
//     four independent sums, and it types them through the in-app keypad one
//     box at a time.
//
// So this file asks one question of the WHOLE app: does anything outside Toán
// 4 behave differently now? It sweeps every maths bank that ships, and then
// walks a real Toán 7 source exam through its answer boxes to prove the old
// path still works end to end.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const load = (p) => require(path.join(root, 'js', p));

const { MATH_CHAPTERS, MATH_QUESTIONS } = load('math-data.js');
const { MATH_LESSONS } = load('math-lessons.js');
const { MATH_EXAMS } = load('math-exams.js');
const { MATH_SOURCE_EXAMS } = load('math-source-exams.js');
const { MATH_LT_QUESTIONS } = load('math-luythua.js');
const { MATH4_QUESTIONS, MATH4_TYPES } = load('math4-data.js');

// Every question the maths tab can put in front of a child, with the bank it
// came from, so a failure names the file to open.
function allQuestions() {
  const out = [];
  const add = (bank, from) => (bank || []).forEach(q => out.push({ q, from }));
  add(MATH_QUESTIONS, 'js/math-data.js');
  add(MATH_LT_QUESTIONS, 'js/math-luythua.js');
  (MATH_EXAMS || []).forEach(e => add(e.questions, 'js/math-exams.js · ' + (e.id || e.title)));
  (MATH_SOURCE_EXAMS || []).forEach(e => add(e.questions, 'js/math-source-exams.js · ' + e.id));
  return out;
}

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
    MATH_CHAPTERS, MATH_QUESTIONS, MATH_LESSONS,
    MATH_EXAMS, MATH_SOURCE_EXAMS, MATH_LT_QUESTIONS,
    MATH4_QUESTIONS: MATH4_QUESTIONS.slice(),
    MATH4_TYPES: MATH4_TYPES.slice(),
  };
  ctx.global = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext([
    src('js/math.js'),
    `globalThis.__math = {
       math4FreeEntry, math4AllFilled, math4Clean, mathPartInput, mathAnswerPartsHTML,
       mathHasAnswerParts, mathIsTyped, mathIsWritten, mathIsCorrect, mathGrade,
       mathKeypadHTML, mathTypedBoxHTML, mathKey, mathTypedRaw, mathEditAnswerPart,
       submitMathTyped, nextMathQuestion, answerMathQuestion, startMathExam,
       mathCurrentQuestion, mathQuizAnswered, mathExams, startMathQuiz,
     };`,
  ].join('\n'), ctx, { filename: 'math4-scope.js' });
  return { ctx, m: ctx.__math, screen, nav };
}

suite('toán 4 chỉ đổi cho toán 4: the sweep', () => {
  test('no question outside Toán 4 is treated as free entry', () => {
    const { m } = loadMath();
    const leaked = allQuestions()
      .filter(({ q }) => m.math4FreeEntry(q))
      .map(({ q, from }) => `${from} · ${q.id || q.n}`);
    assert.deepEqual(leaked.slice(0, 8), [],
      `${leaked.length} Toán 7 question(s) would get a digits-only input`);
  });

  test('and every Toán 4 question is', () => {
    const { m } = loadMath();
    const missed = MATH4_QUESTIONS.filter(q => !m.math4FreeEntry(q)).map(q => q.id);
    assert.deepEqual(missed.slice(0, 8), [], `${missed.length} Toán 4 question(s) kept the old keypad`);
    assert.equal(MATH4_QUESTIONS.length, 500, 'the sweep must actually have covered the bank');
  });

  test('grade 4 is the only marker, and nothing else in the app carries it', () => {
    const strays = allQuestions().filter(({ q }) => q.grade != null)
      .map(({ q, from }) => `${from} · ${q.id || q.n} grade=${q.grade}`);
    assert.deepEqual(strays.slice(0, 8), [],
      'a Toán 7 question stamped with a grade would silently switch renderer');
  });

  test('no Toán 7 answer box renders a numeric input', () => {
    const { m } = loadMath();
    const offenders = [];
    for (const { q, from } of allQuestions()) {
      if (!m.mathHasAnswerParts(q)) continue;
      const html = m.mathAnswerPartsHTML(q, null);
      if (/math-answer-input|inputmode="numeric"/.test(html)) offenders.push(from + ' · ' + q.id);
      if (!/mathAnswerSlot/.test(html)) offenders.push(from + ' · ' + q.id + ' lost its active box');
    }
    assert.deepEqual(offenders.slice(0, 8), [], `${offenders.length} Toán 7 box(es) changed`);
  });

  test('a digits-only box would have destroyed the answers Toán 7 actually asks for', () => {
    const { m } = loadMath();
    // This is why the gate exists, stated as data rather than as a comment.
    const wouldBreak = allQuestions()
      .filter(({ q }) => m.mathHasAnswerParts(q))
      .flatMap(({ q }) => q.answerParts)
      .filter(p => m.math4Clean(p.answer) !== String(p.answer));
    assert.truthy(wouldBreak.length >= 10,
      'expected many Toán 7 answers to contain a slash, a minus or a comma');
    assert.truthy(wouldBreak.some(p => /\//.test(String(p.answer))), 'fractions are in there');
  });

  test('Toán 7 keeps the "Mở bảng nháp" banner — its workNote is not its stem', () => {
    const math = src('js/math.js');
    const render = math.slice(math.indexOf('function renderMathQuestion'));
    assert.truthy(/math4FreeEntry\(q\) \? '' : `<div class="math-written-help math-board-prompt">/
      .test(render), 'only Toán 4 drops the banner');
    assert.truthy(/Mở bảng nháp/.test(render), 'Toán 7 still offers it');
    // And it still has something worth saying: its workNote is a real
    // instruction, not a restatement of the question.
    const { m } = loadMath();
    const noted = allQuestions()
      .filter(({ q }) => m.mathHasAnswerParts(q) || q.type === 'written')
      .filter(({ q }) => /bảng nháp/i.test(q.workNote || ''));
    assert.truthy(noted.length > 0, 'Toán 7 papers point at the board through workNote');
  });

  test('typed Toán 7 questions still get the in-app keypad, glyphs and all', () => {
    const { m } = loadMath();
    const typed = allQuestions().filter(({ q }) => m.mathIsTyped(q) && !m.mathHasAnswerParts(q));
    assert.truthy(typed.length > 0, 'the calc bank must not be empty, or this proves nothing');
    for (const { q, from } of typed.slice(0, 40)) {
      const pad = m.mathKeypadHTML(q);
      assert.truthy(/math-key/.test(pad), from + ' · ' + q.id + ' lost its keypad');
    }
    // The exponent key is the one no phone keyboard offers.
    const pow = typed.find(({ q }) => (q.keys || []).indexOf('^') !== -1);
    if (pow) assert.truthy(/math-key-pow/.test(m.mathKeypadHTML(pow.q)), 'xⁿ key must survive');
  });
});

suite('toán 4 chỉ đổi cho toán 4: a real Toán 7 paper still works', () => {
  // hk1-source-2 question 9 is "Thực hiện phép tính" with three ordered boxes
  // whose answers are 41/30, 1/4 and 4 — a fraction the numeric input would
  // have eaten. Everything before it is multiple choice, so the walk is honest.
  function walkToParts(m) {
    m.startMathExam('hk1-source-2');
    for (let i = 0; i < 30; i++) {
      const q = m.mathCurrentQuestion();
      if (!q) return null;
      if (m.mathHasAnswerParts(q)) return q;
      m.answerMathQuestion(0);
      m.nextMathQuestion();
    }
    return null;
  }

  test('its boxes are still filled one at a time, on the drawn keypad', () => {
    const { m, screen } = loadMath();
    const q = walkToParts(m);
    assert.truthy(q, 'the walk never reached an answer-box question');
    assert.equal(q.answerParts.length, 3);
    assert.truthy(/math-keypad/.test(screen.innerHTML), 'the drawn keypad must still be there');
    assert.truthy(/mathAnswerSlot/.test(screen.innerHTML), 'and one box must be active');
    assert.truthy(/Lưu kết quả này/.test(screen.innerHTML),
      'the first of three boxes still saves rather than marking the question');
    assert.falsy(/math-answer-input/.test(screen.innerHTML), 'no numeric input in Toán 7');
  });

  test('free-entry typing is refused for it, so nothing can leak across', () => {
    const { m } = loadMath();
    const q = walkToParts(m);
    // The walk answered the eight multiple-choice questions ahead of this one.
    const before = m.mathQuizAnswered();
    assert.equal(m.mathPartInput(0, '41/30'), '', 'mathPartInput must decline a Toán 7 question');
    assert.falsy(m.math4AllFilled(q));
    assert.equal(m.mathQuizAnswered(), before, 'and it must not have marked this question');
    assert.equal(m.mathCurrentQuestion().id, q.id, 'nor moved off it');
  });

  test('typing its fractions on the keypad still marks the paper correctly', () => {
    const { m, screen } = loadMath();
    const q = walkToParts(m);
    const before = m.mathQuizAnswered();
    q.answerParts.forEach(part => {
      for (const ch of String(part.answer)) m.mathKey(ch);
      m.submitMathTyped();
    });
    assert.equal(m.mathQuizAnswered(), before + 1, 'the third box marks the question');
    assert.truthy(/math-answer-box correct/.test(screen.innerHTML),
      'a fraction typed on the keypad must still be graded right');
  });

  test('and Sửa still exists there — it is the only way back to an earlier box', () => {
    const { m, screen } = loadMath();
    const q = walkToParts(m);
    for (const ch of String(q.answerParts[0].answer)) m.mathKey(ch);
    m.submitMathTyped();                       // box 1 saved, box 2 active
    assert.truthy(/math-part-edit/.test(screen.innerHTML), 'Sửa must stay for Toán 7');
    m.mathEditAnswerPart(0);
    assert.equal(m.mathTypedRaw(), String(q.answerParts[0].answer),
      'Sửa reopens box 1 with what was in it');
  });
});

suite('toán 4 chỉ đổi cho toán 4: the scratch board', () => {
  const board = src('js/math-board.js');

  test('only a grade-4 question locks the board question open', () => {
    assert.truthy(/function mathBoardQuestionLocked\(q\)\s*\{\s*return !!q && q\.grade === 4; \}/.test(board),
      'the lock must key on grade 4 and nothing else');
    const strip = board.slice(board.indexOf('function mathBoardStripHTML'),
      board.indexOf('function mathBoardHintText'));
    assert.truthy(/if\s*\(!full\)\s*return\s*''/.test(strip),
      'Toán 7 must keep its collapse, which removes the strip from layout entirely');
    assert.truthy(/Thu gọn đề/.test(board) && /Mở đề/.test(board),
      'and keep both halves of that control');
  });

  test('the tap handler refuses only for grade 4', () => {
    const tap = board.slice(board.indexOf('window.mathBoardStripTap'),
      board.indexOf('window.openMathBoard'));
    assert.truthy(/mathBoardQuestionLocked/.test(tap), 'the guard must be in the handler');
    assert.truthy(/_mathBoardQuestionExpanded = !_mathBoardQuestionExpanded/.test(tap),
      'and Toán 7 must still toggle');
  });

  test('Toán 4 keeps three controls, in the question header, and no toolbar row', () => {
    const icons = board.slice(board.indexOf('function mathBoardIconToolsHTML'),
      board.indexOf('function mathBoardStripHTML'));
    assert.equal((icons.match(/<button/g) || []).length, 3,
      'exactly three: wipe the board, the maths keyboard, put it away');
    assert.truthy(/mathBoardClearTap/.test(icons), 'xoá bảng');
    assert.truthy(/mathBoardKeyboardToggle/.test(icons), 'bàn phím toán');
    assert.truthy(/minimizeMathBoard/.test(icons), 'thu nhỏ');
    // An icon with no name is unusable with VoiceOver and unguessable for a
    // child, so each one has to say what it does.
    assert.equal((icons.match(/aria-label="/g) || []).length, 3, 'every icon needs a name');
    assert.truthy(/lockedBoard \? '' :/.test(board),
      'the chips-and-toggles row must be left out for Toán 4, not drawn and hidden');
  });

  test('Toán 7 keeps its whole writing toolbar — tools, undo, eraser', () => {
    for (const [needle, what] of [
      ['mathBoardToolsToggle', 'the Công cụ toggle'],
      ['mathBoardUndoTap', 'Lùi một bước'],
      ['mathBoardWritingToolsHTML', 'the pen and eraser'],
      ['Xoá bảng', 'the worded clear button'],
    ]) assert.truthy(board.includes(needle), 'Toán 7 lost ' + what);
    assert.falsy(/mathBoardChipsHTML|math-board-chips|mathBoardTabTap/.test(board),
      'the one-page board must not bring the redundant B1/B2/+ controls back');
  });

  test('a control that is an icon never has a sentence written into it', () => {
    // mathBoardClearTap arms with "Chắc chưa?" and the keyboard toggle relabels
    // itself. Writing either straight into a 44px icon button replaces the
    // icon with text that does not fit.
    assert.truthy(/function mathBoardFace\(btn, word, icon, label\)/.test(board),
      'both faces must be chosen in one place');
    const face = board.slice(board.indexOf('function mathBoardFace'),
      board.indexOf('window.mathBoardClearTap'));
    assert.truthy(/math-board-icon/.test(face), 'it decides by looking for the icon class');
    const after = board.slice(board.indexOf('window.mathBoardClearTap'));
    assert.falsy(/textContent = 'Chắc chưa\?'/.test(after),
      'the armed label must go through mathBoardFace');
    assert.falsy(/textContent = _mathBoardKeyboardOpen \?/.test(after),
      'so must the keyboard label');
  });

  test('the sums sit two-up so the header stops eating the writing space', () => {
    const body = board.slice(board.indexOf('function mathBoardQuestionBodyHTML'),
      board.indexOf('function mathBoardStripHTML'));
    assert.truthy(/Math\.ceil\(parts\.length \/ 2\)/.test(body),
      'the row count must be half the sums, rounded up — two columns, never three');
    assert.truthy(/--board-rows:/.test(body), 'and be handed to CSS, which cannot count them');
    const css = require('./css-all').readAllCss();
    const grid = css.slice(css.indexOf('.math-board-strip-parts {'),
      css.indexOf('.math-board-strip-part {'));
    // Row-major would read 1 2 / 3 4. The sums must read DOWN each column.
    assert.truthy(/grid-auto-flow:\s*column/.test(grid),
      'filled across instead of down would number the sums 1 2 / 3 4');
    assert.truthy(/grid-template-rows:\s*repeat\(var\(--board-rows/.test(grid),
      'the row count from the markup must actually be used');
    assert.truthy(/@media \(min-width: 500px\)/.test(grid),
      'a narrow phone keeps one column — two would wrap a long đổi-đơn-vị label into mush');
  });

  test('the two-up header is Toán 4 only, and cannot reach Toán 7', () => {
    const { m } = loadMath();
    // The parts list is drawn only for a locked (grade 4) question, so the
    // grid it lives in can never appear on a Toán 7 board.
    const body = board.slice(board.indexOf('function mathBoardQuestionBodyHTML'),
      board.indexOf('function mathBoardStripHTML'));
    assert.truthy(/mathBoardQuestionLocked\(q\) && parts\.length/.test(body),
      'the whole block, grid included, is behind the grade-4 gate');
    const withParts = allQuestions().filter(({ q }) => m.mathHasAnswerParts(q));
    assert.truthy(withParts.length > 0, 'Toán 7 does have answer-box questions to protect');
    assert.deepEqual(withParts.filter(({ q }) => q.grade === 4).map(({ q }) => q.id), [],
      'none of them is grade 4, so none of them draws the grid');
  });

  test('the answer-box labels are printed for grade 4 only', () => {
    const body = board.slice(board.indexOf('function mathBoardQuestionBodyHTML'),
      board.indexOf('function mathBoardStripHTML'));
    assert.truthy(/mathBoardQuestionLocked\(q\) && parts\.length/.test(body),
      'Toán 7 answer-box labels are step names, not the problem — they must not print');
    assert.truthy(/mathFormula\(p\.label\)/.test(body), 'labels go through the typesetter');
  });
});

suite('toán 4 chỉ đổi cho toán 4: the styles', () => {
  const css = require('./css-all').readAllCss();

  test('the input styles are new rules, not edits to the shared answer box', () => {
    // .math-answer-box is what every other typed question draws. If the new
    // work had been done by editing it, Toán 7 would have moved too.
    const box = css.slice(css.indexOf('.math-answer-box {'), css.indexOf('.math-answer-box.correct'));
    assert.truthy(/min-height:\s*56px/.test(box) && /font-size:\s*24px/.test(box),
      'the shared box must be untouched');
    assert.truthy(css.includes('.math-answer-input {'), 'the input needs its own rule');
    assert.truthy(css.includes('.math-answer-part:focus-within'),
      'the ring must follow real focus, so it cannot fall out of step with the caret');
  });

  test('the drawn caret and the keypad styles are still there for Toán 7', () => {
    assert.truthy(css.includes('.math-caret {'), 'Toán 7 still draws its own caret');
    assert.truthy(css.includes('.math-keypad {'), 'and still lays out the keypad');
    assert.truthy(css.includes('.math-part-edit {'), 'and still styles Sửa');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
