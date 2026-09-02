// math-exam-lock.test.js — a đề thi holds the screen until the child is done.
//
// Reported 2026-09-02: "lớp 7 bài thi học kì chưa lock màn hình khi bé bấm lộn
// qua menu khác."
//
// A HK1 paper is 25 questions of real work and it is scored only when it ends —
// walk out at question 20 and nothing at all is recorded. Meanwhile the bottom
// bar sits under the thumb for the whole paper. Đấu Toán has hidden that bar
// during a live match ever since a mis-tap could forfeit a match; the đề thi
// never did. It leaned on the confirm() in switchScreen, which is a net rather
// than a lock — and the ✕ in the paper's own header had no net at all: one
// stray tap binned forty minutes with no question asked.
//
// So: the bar is HIDDEN while a paper is open, the ✕ ASKS once there is work to
// lose, and every way out puts the bar back — a bar left hidden would strand
// the child in the Math tab.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

const { MATH_EXAMS } = require(path.join(root, 'js', 'math-exams.js'));
const { MATH_CHAPTERS, MATH_QUESTIONS } = require(path.join(root, 'js', 'math-data.js'));
const { MATH_LESSONS } = require(path.join(root, 'js', 'math-lessons.js'));
global.MATH_CHAPTERS = MATH_CHAPTERS;
global.MATH_QUESTIONS = MATH_QUESTIONS;
global.MATH_LESSONS = MATH_LESSONS;
global.MATH_EXAMS = MATH_EXAMS;
const math = require(path.join(root, 'js', 'math.js'));

const PAPER = MATH_EXAMS[0].id;

// Enough DOM for the tab to render into, plus the one element this whole file
// is about. `display` is read back exactly as the browser would report it.
function withScreen(fn) {
  const screen = { innerHTML: '', scrollTop: 0 };
  const nav = { style: { display: 'flex' } };
  const had = Object.prototype.hasOwnProperty.call(global, 'document');
  const prev = global.document;
  global.document = {
    getElementById: (id) => id === 'mathHubScreen' ? screen
      : id === 'bottomNav' ? nav : null,
  };
  global.appState = { coins: 0, mathHistory: [] };
  try { return fn({ screen, nav, navHidden: () => nav.style.display === 'none' }); }
  finally {
    math.abandonMathQuiz();
    delete global.confirm;
    if (had) global.document = prev; else delete global.document;
    delete global.appState;
  }
}

// Record every question put to the child, and answer it the given way.
function armConfirm(answer) {
  const asked = [];
  global.confirm = (msg) => { asked.push(String(msg)); return answer; };
  return asked;
}

suite('toán 7 đề thi: the bottom bar is locked away while a paper is open', () => {
  test('opening a HK1 paper hides the bar', () => {
    withScreen(({ navHidden }) => {
      assert.falsy(navHidden(), 'the bar is there before the paper opens');
      math.startMathExam(PAPER);
      assert.truthy(math.isMathQuizActive(), 'the paper did not open');
      assert.truthy(navHidden(), 'a mis-tap on Arena must not be one tap away mid-paper');
    });
  });

  test('finishing the paper gives the bar straight back', () => {
    withScreen(({ navHidden }) => {
      math.startMathExam(PAPER);
      // Answer the whole paper. The score is beside the point here; what
      // matters is that the last "Xem kết quả" leaves the child able to leave.
      const total = math.mathQuizQuestions().length;
      for (let i = 0; i < total; i++) { math.answerMathQuestion(0); math.nextMathQuestion(); }
      assert.falsy(math.isMathQuizActive(), 'the paper should be finished');
      assert.falsy(navHidden(), 'a finished paper must not trap the child in the Math tab');
    });
  });

  test('walking out gives the bar back too', () => {
    withScreen(({ navHidden }) => {
      math.startMathExam(PAPER);
      math.abandonMathQuiz();
      assert.falsy(navHidden(), 'the bar can never be left hidden');
    });
  });

  test('the bar comes back when the paper is left through the ✕', () => {
    withScreen(({ navHidden }) => {
      math.startMathExam(PAPER);
      math.answerMathQuestion(0);
      armConfirm(true);
      math.mathQuizQuit();
      assert.falsy(math.isMathQuizActive());
      assert.falsy(navHidden(), 'the ✕ is an exit, so it must restore the bar');
    });
  });

  test('saying no to the ✕ keeps both the paper and the lock', () => {
    withScreen(({ navHidden }) => {
      math.startMathExam(PAPER);
      math.answerMathQuestion(0);
      armConfirm(false);
      math.mathQuizQuit();
      assert.truthy(math.isMathQuizActive(), 'saying no must keep the paper open');
      assert.truthy(navHidden(), 'and it must stay locked');
    });
  });

  test('a ten-question practice round leaves the bar alone', () => {
    // Deliberate: the lock is for a paper, where the whole sitting is lost.
    // A chapter round is ten questions and the ✕ already asks, so taking the
    // bar away there would be a cage with nothing to protect.
    withScreen(({ navHidden }) => {
      math.startMathQuiz(2);
      assert.truthy(math.isMathQuizActive(), 'the round did not start');
      assert.falsy(navHidden(), 'practice is not an exam');
    });
  });
});

suite('toán 7: the ✕ asks before it bins the work', () => {
  test('it says which paper and how much is already done', () => {
    withScreen(() => {
      math.startMathExam(PAPER);
      for (let i = 0; i < 3; i++) { math.answerMathQuestion(0); math.nextMathQuestion(); }
      const asked = armConfirm(false);
      math.mathQuizQuit();
      assert.equal(asked.length, 1, 'it must ask before throwing the paper away');
      assert.truthy(/3\/25/.test(asked[0]), `the cost must be visible — got: ${asked[0]}`);
      assert.truthy(/bài thi/.test(asked[0]), `it must say this is an exam — got: ${asked[0]}`);
    });
  });

  test('saying yes scores nothing at all', () => {
    withScreen(() => {
      math.startMathExam(PAPER);
      for (let i = 0; i < 5; i++) { math.answerMathQuestion(0); math.nextMathQuestion(); }
      armConfirm(true);
      math.mathQuizQuit();
      assert.falsy(math.isMathQuizActive(), 'the paper should be gone');
      assert.deepEqual(global.appState.mathHistory, [], 'a walked-away paper is not a result');
      assert.equal(global.appState.coins, 0, 'and it pays nothing');
    });
  });

  test('with nothing answered yet, the ✕ just goes back', () => {
    withScreen(() => {
      math.startMathExam(PAPER);
      const asked = armConfirm(true);
      math.mathQuizQuit();
      assert.equal(asked.length, 0, 'nothing is at stake, so nothing to ask');
      assert.falsy(math.isMathQuizActive());
    });
  });

  test('a practice round is protected by the same ✕', () => {
    withScreen(() => {
      math.startMathQuiz(2);
      math.answerMathQuestion(0);
      const asked = armConfirm(false);
      math.mathQuizQuit();
      assert.equal(asked.length, 1, 'ten questions of work is still work');
      assert.truthy(math.isMathQuizActive(), 'saying no must keep the round');
    });
  });

  test('a stray repaint of the tab redraws the paper instead of covering it', () => {
    // The bar is hidden during a paper, but a practice round still shows it —
    // and tapping Math painted the menu over the round. The questions went,
    // _mathQuiz stayed alive, and the NEXT tab change asked about work the
    // child could no longer see or finish.
    withScreen(({ screen }) => {
      math.startMathQuiz(2);
      math.answerMathQuestion(0);
      math.renderMathHome();
      assert.truthy(math.isMathQuizActive(), 'the round must survive the repaint');
      assert.truthy(/grammar-quiz-progress/.test(screen.innerHTML),
        'the round should be back on screen, not the menu');
    });
  });

  test('the paper header wires ✕ to the asking exit, not the silent one', () => {
    withScreen(({ screen }) => {
      math.startMathExam(PAPER);
      const header = /<button class="grammar-back-btn"[^>]*onclick="([^"]+)"/.exec(screen.innerHTML);
      assert.truthy(header, 'no ✕ rendered on the paper');
      assert.truthy(/mathQuizQuit\(\)/.test(header[1]),
        `the ✕ must ask — it calls: ${header[1]}`);
    });
  });
});

suite('the bottom bar is the last line of defence, and it holds', () => {
  // The lock hides the bar; these cover the case where something still reaches
  // switchScreen — the Arena button, a deep link, a future caller.
  const { loadAppCode } = require('./setup');

  function shell(quizActive, saysYes) {
    const abandoned = [];
    const app = loadAppCode({
      includeHome: false,
      extraGlobals: {
        confirm: () => saysYes,
        isMathQuizActive: () => quizActive,
        abandonMathQuiz: () => { abandoned.push(1); },
      },
    });
    return { app, abandoned };
  }

  test('saying no to the leave question reports the refusal to the caller', () => {
    const { app, abandoned } = shell(true, false);
    assert.equal(app.switchScreen('homeScreen'), false,
      'switchScreen must SAY it refused — a caller that carries on regardless ' +
      'opens the next screen behind the exam');
    assert.equal(abandoned.length, 0, 'and the paper must survive');
  });

  test('an ordinary switch reports success', () => {
    const { app } = shell(false, true);
    assert.truthy(app.switchScreen('homeScreen') !== false,
      'a switch that happened must not read as a refusal');
  });

  test('the Arena button does not open behind a refused switch', () => {
    // openPetBattle used to call switchScreen and then render, refresh and
    // START POLLING no matter what it answered — so "no, stay in my exam" left
    // the Arena running underneath the paper.
    const calls = [];
    const ctx = vm.createContext({
      console,
      document: {
        getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
        body: { appendChild() {} }, addEventListener() {},
      },
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
      window: {}, navigator: {},
      setTimeout, clearTimeout, setInterval, clearInterval,
      fetch: () => Promise.resolve({ json: () => ({}) }),
      switchScreen: () => false,                 // the child said "no, stay"
    });
    vm.runInContext(fs.readFileSync(path.join(root, 'js', 'petbattle.js'), 'utf8'),
      ctx, { filename: 'petbattle.js' });
    // Replace the real ones AFTER loading: the file declares them itself, so a
    // stub installed beforehand is simply overwritten and never sees a call.
    ctx.renderPetBattle = () => calls.push('render');
    ctx.refreshPetBattle = () => calls.push('refresh');
    ctx.openPetBattle();
    assert.deepEqual(calls, [], 'nothing about the Arena may happen after a refusal');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
