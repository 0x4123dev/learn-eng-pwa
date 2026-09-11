// leave-guard-math7.test.js — Toán 7: every way OUT of a round asks first,
// and once the round is over nothing stands in the way.
//
// The rule, for every exercise on the Math tab (chapter rounds HK1/HK2, the
// lesson's "Luyện chương này", the lũy thừa & căn pack, a đề thi, the retry
// drill, "Luyện câu hay sai"):
//   (A) in progress → the bottom bar, the Learn hub, the Arena, the ✕ on the
//       card, the hub's own back arrows and Học kì tabs all ask confirm().
//       Cancel keeps the child on the SAME question with the state intact;
//       OK leaves and tears the round down (state null, board closed, nav back).
//   (B) finished → leaving asks nothing and nothing blocks it: the bar is
//       visible, no overlay, no `math-board-open`, no stale active flag.
//   (C) after leaving either way, the next open of the tab is clean: the
//       menu, no ghost round, no checkpoint offering the round back, coins
//       paid exactly once.
// A lesson page is reading, not an exercise, so it must NOT count as in
// progress. Executed against the real script list in tests/verify/client.js,
// never a substring match on the source.
const { suite, test, assert } = require('./harness');
const { mountApp, loginTestUser } = require('./verify/client.js');

const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n) => { for (let i = 0; i < (n || 6); i++) await tick(); };
const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';

// The board paints into <canvas id="mathBoardCanvas"> that arrives through
// innerHTML, which the DOM shim parses without a getContext. Hand such a
// canvas the harness's stubbed 2D context the moment the board looks it up.
function patchCanvas(h) {
  const getById = h.doc.getElementById;
  h.doc.getElementById = (id) => {
    const el = getById(id);
    if (el && el.tagName === 'CANVAS' && !el.getContext) {
      const probe = h.doc.createElement('canvas');
      el.getContext = probe.getContext; el.toDataURL = probe.toDataURL;
      el.width = 320; el.height = 320;
    }
    return el;
  };
}

async function boot(overrides) {
  const h = mountApp();
  patchCanvas(h);
  loginTestUser(h, Object.assign({ coins: 100 }, overrides || {}));
  const S = h.sandbox;
  assert.truthy(S.switchScreen('mathHubScreen'), 'the Math tab opens');
  await S.LazyData.ensure('mathHubScreen');
  await settle();
  assert.equal(typeof S.renderMathHome, 'function', 'the math group landed');
  assert.deepEqual(h.loadErrors, [], 'files that threw while loading');
  S.__confirmAnswer = true;
  S.__confirmLog.length = 0;
  return h;
}

async function ensureHk2(h) {
  const S = h.sandbox;
  S.openMathSection('hk2');
  await S.LazyData.ensure('mathHk2');
  await settle();
  assert.truthy(S.LazyData.ready('mathHk2'), 'the HK2 group landed');
  S.renderMathHome();
}

const screenHTML = (h) => h.el('mathHubScreen').innerHTML;
const onclicks = (h) => (screenHTML(h).match(/onclick="([^"]+)"/g) || []).map((s) => s.slice(9, -1));
const navHidden = (h) => h.el('bottomNav').style.display === 'none';
const boardOpen = (h) => !h.el('mathBoardOverlay').classList.contains('hidden');
const htmlHasBoardClass = (h) => h.doc.documentElement.classList.contains('math-board-open');
const activeScreen = (h) => (h.doc.querySelector('.screen.active') || {}).id;
const quiz = (h) => h.peek('_mathQuiz');
const progressText = (h) => { const m = screenHTML(h).match(/grammar-quiz-progress">([^<]+)</); return m ? m[1] : null; };

// Answer the question on screen the way the child would, through the same
// handlers the card renders, whatever its type.
function answerCurrent(h, right) {
  const S = h.sandbox;
  const st = quiz(h);
  const q = st.questions[st.idx];
  if (S.mathIsWritten(q)) {
    S.revealMathWritten();
    S.gradeMathWritten(!!right);
  } else if (S.mathHasAnswerParts(q)) {
    for (let p = 0; p < q.answerParts.length; p++) {
      const want = right ? String(q.answerParts[p].answer || q.answerParts[p]) : '7';
      for (const ch of (right && /^[0-9]+$/.test(want) ? want : '7')) S.mathKey(ch);
      S.submitMathTyped();
    }
  } else if (S.mathIsTyped(q)) {
    S.mathKey('7');
    S.submitMathTyped();
  } else {
    S.answerMathQuestion(right ? q.correct : (q.correct + 1) % q.options.length);
  }
  assert.truthy(st.answers[st.idx] !== null, 'the answer landed');
}

function playToEnd(h) {
  const S = h.sandbox;
  let guard = 0;
  while (S.isMathQuizActive() && guard++ < 60) {
    answerCurrent(h, true);
    S.nextMathQuestion();
  }
  assert.falsy(S.isMathQuizActive(), 'the round ended');
  assert.truthy(/grammar-result-card/.test(screenHTML(h)), 'the result card is on screen');
}

// (A) for one exit route: asked, Cancel stays with the state intact, then
// OK leaves and the round is torn down. `leave` is the exact call the
// child's tap makes; `isActive`/`snapshot` describe the exercise.
function assertGuarded(h, label, leave, opts) {
  const S = h.sandbox;
  const before = opts.snapshot();
  S.__confirmAnswer = false;
  S.__confirmLog.length = 0;
  const refused = leave();
  assert.equal(S.__confirmLog.length, 1, label + ': must ask exactly once — asked ' + S.__confirmLog.length);
  assert.truthy(refused === false || refused === undefined, label + ': Cancel must not switch (' + refused + ')');
  assert.truthy(opts.isActive(), label + ': Cancel must keep the exercise running');
  assert.equal(activeScreen(h), 'mathHubScreen', label + ': Cancel must keep the child on the Math tab');
  assert.deepEqual(opts.snapshot(), before, label + ': Cancel must keep the same question and state');
  if (opts.afterCancel) opts.afterCancel();
  S.__confirmAnswer = true;
  S.__confirmLog.length = 0;
  const left = leave();
  assert.equal(S.__confirmLog.length, 1, label + ': OK must ask once too');
  assert.truthy(left !== false, label + ': OK must leave');
  assert.falsy(opts.isActive(), label + ': OK must end the exercise');
  if (opts.afterLeave) opts.afterLeave();
}

// The exits every exercise on this tab has: the four bottom-bar tabs that
// point elsewhere, the Learn hub, and the Arena's placeholder door.
function bottomBarExits(h) {
  const S = h.sandbox;
  return [
    ['bottom bar · Home', () => S.switchScreen('homeScreen')],
    ['bottom bar · Learn hub', () => S.switchScreen('learnHubScreen')],
    ['bottom bar · Exam', () => S.switchScreen('examScreen')],
    ['bottom bar · Arena (openPetBattle placeholder)', () => {
      // The placeholder refuses before it downloads anything; a "yes" would
      // fetch the arena group, which is another file's business.
      const ensure = S.LazyData.ensure;
      S.LazyData.ensure = () => Promise.resolve();
      try { S.openPetBattle(); return S.__confirmAnswer; }
      finally { S.LazyData.ensure = ensure; }
    }],
  ];
}

// After a quiz has been left through `leave`, the tab and the shell must be
// clean: state gone, board closed, bar back, no checkpoint.
function assertTornDown(h, label) {
  const S = h.sandbox;
  assert.falsy(S.isMathQuizActive(), label + ': _mathQuiz must be null');
  assert.falsy(navHidden(h), label + ': the bottom bar must not be display:none');
  assert.falsy(h.el('bottomNav').hasAttribute('aria-hidden'), label + ': the bar must not be aria-hidden');
  assert.falsy(boardOpen(h), label + ': the board overlay must be hidden');
  assert.falsy(htmlHasBoardClass(h), label + ': <html> must not keep math-board-open');
  assert.equal(h.store[CHECKPOINT_KEY], undefined, label + ': no checkpoint may offer the round back');
  assert.equal(S.buildStudyCheckpoint(), null, label + ': nothing left to checkpoint');
}

// (C): the next open of the tab is the menu, not a ghost round.
function assertNextOpenClean(h, label) {
  const S = h.sandbox;
  S.__confirmLog.length = 0;
  assert.truthy(S.switchScreen('homeScreen') !== false, label + ': leaving after the round asks nothing');
  assert.equal(S.__confirmLog.length, 0, label + ': no confirm once the round is over');
  assert.equal(h.el('bottomNav').style.display, 'flex', label + ': Home repairs the bar to flex');
  assert.truthy(S.switchScreen('mathHubScreen'), label + ': the tab reopens');
  assert.falsy(S.isMathQuizActive(), label + ': no ghost round on reopen');
  assert.falsy(/grammar-quiz-progress/.test(screenHTML(h)), label + ': no question card on reopen');
  assert.truthy(/math-back-btn|openMathSection/.test(screenHTML(h)), label + ': the menu is back');
  assert.equal(S.restoreStudyCheckpoint(), false, label + ': no checkpoint to restore');
}

// One full audit of a quiz-shaped exercise (chapter round, lesson round, LT
// pack, đề thi, câu hay sai): every exit route under (A), then play it to
// the end for (B) and (C).
async function auditQuiz(name, start, opts) {
  opts = opts || {};
  const h = await boot(opts.overrides);
  const S = h.sandbox;
  if (opts.prepare) await opts.prepare(h);
  const coinsBefore = h.state().coins;
  start(h);
  await settle();
  assert.truthy(S.isMathQuizActive(), name + ': the round started');
  assert.truthy(/grammar-quiz-progress/.test(screenHTML(h)), name + ': a question card is on screen');
  const total = quiz(h).questions.length;
  assert.equal(progressText(h), '1/' + total);
  if (opts.expectLocked) assert.truthy(navHidden(h), name + ': a đề thi hides the bar while open');
  else assert.falsy(navHidden(h), name + ': a practice round leaves the bar alone');

  // The card's own exits, read from the rendered HTML — not assumed.
  const rendered = onclicks(h);
  assert.contains(rendered, 'mathQuizQuit()', name + ': the card renders the ✕ that asks');
  assert.contains(rendered, 'openMathBoard()', name + ': the card offers the board');
  assert.falsy(rendered.some((c) => /^(openMathSection|switchMathSubTab|renderMathHome)\(/.test(c)),
    name + ': no silent hub navigation is rendered on the card: ' + rendered.join(' '));

  // Get some work on the table so the ✕ has something to protect, then
  // move to the second question: Cancel must keep us THERE, not at 1.
  answerCurrent(h, true);
  S.nextMathQuestion();
  assert.equal(quiz(h).idx, 1);
  const stateSnapshot = () => ({ idx: quiz(h).idx, answers: quiz(h).answers.slice(), first: quiz(h).questions[0].id, label: quiz(h).label || null });
  const sameQuestion = () => assert.equal(progressText(h), '2/' + total, name + ': the same question stays on screen');
  const guardOpts = { isActive: () => S.isMathQuizActive(), snapshot: stateSnapshot, afterCancel: sameQuestion };

  const exits = bottomBarExits(h).concat([
    ['the ✕ on the card (mathQuizQuit)', () => { S.mathQuizQuit(); return activeScreen(h) === 'mathHubScreen' && S.isMathQuizActive() ? false : true; }],
  ]);
  for (const [label, leave] of exits) {
    // A fresh round for each route, at question 2 with one answer banked.
    if (!S.isMathQuizActive()) {
      start(h); await settle();
      answerCurrent(h, true); S.nextMathQuestion();
      if (opts.expectLocked) assert.truthy(navHidden(h), name + '/' + label + ': the bar is hidden again for the new paper');
    }
    assert.equal(quiz(h).idx, 1, name + '/' + label + ': at question 2 before leaving');
    if (opts.expectLocked) {
      guardOpts.afterCancel = () => { sameQuestion(); assert.truthy(navHidden(h), name + '/' + label + ': Cancel keeps the paper locked'); };
    }
    assertGuarded(h, name + ' / ' + label, leave, guardOpts);
    assertTornDown(h, name + ' / ' + label);
    // Whatever tab OK landed on, walking back in must be the menu.
    assert.truthy(S.switchScreen('mathHubScreen'));
    assert.falsy(S.isMathQuizActive(), name + '/' + label + ': no ghost round after leaving');
    assert.falsy(/grammar-quiz-progress/.test(screenHTML(h)), name + '/' + label + ': the question card is gone');
    assert.equal(h.state().coins, coinsBefore, name + '/' + label + ': an abandoned round pays nothing');
  }

  // The hub's own back arrows and Học kì tabs are not on the card, but a
  // queued tap or a stale node can still reach them. They must not throw
  // the round away: the question stays, the state stays.
  S.__confirmAnswer = true;
  start(h); await settle();
  answerCurrent(h, true); S.nextMathQuestion();
  const snap = stateSnapshot();
  for (const stale of [() => S.openMathSection('toan7'), () => S.openMathSection('home'), () => S.switchMathSubTab('exams'), () => S.switchMathSubTab('lessons'), () => S.renderMathHome()]) {
    S.__confirmLog.length = 0;
    stale();
    assert.truthy(S.isMathQuizActive(), name + ': a hub repaint must not end the round');
    assert.deepEqual(stateSnapshot(), snap, name + ': nor change its state');
    assert.equal(progressText(h), '2/' + total, name + ': the question is redrawn, not the menu');
    // openMathSection() runs MathFight.leave(), which used to hand the bar
    // back under a paper still in progress.
    if (opts.expectLocked) assert.truthy(navHidden(h), name + ': a stray hub tap must not unlock the paper');
    else assert.falsy(navHidden(h), name + ': and must not lock a practice round');
  }

  // (B) and (C): play it out with the board open at the last question, the
  // way a child who was writing rough work leaves it.
  while (quiz(h).idx + 1 < total) { answerCurrent(h, true); S.nextMathQuestion(); }
  S.openMathBoard();
  assert.truthy(boardOpen(h) && htmlHasBoardClass(h), name + ': the board opened over the last question');
  const historyBefore = h.state().mathHistory.length;
  playToEnd(h);
  assertTornDown(h, name + ' / finished');
  assert.equal(h.state().mathHistory.length, historyBefore + 1, name + ': one session banked');
  assert.truthy(h.state().coins > coinsBefore, name + ': a finished round pays');
  const coinsAfter = h.state().coins;
  // The result card's own "Xong" is the in-screen exit: no question asked.
  const done = onclicks(h).find((c) => c === 'renderMathHome()');
  assert.truthy(done, name + ': the result card renders Xong → renderMathHome()');
  S.__confirmLog.length = 0;
  S.renderMathHome();
  assert.equal(S.__confirmLog.length, 0, name + ': Xong asks nothing');
  assert.falsy(/grammar-result-card/.test(screenHTML(h)), name + ': Xong leaves the result card');
  assertNextOpenClean(h, name + ' / finished');
  assert.equal(h.state().coins, coinsAfter, name + ': reopening does not pay again');
  assert.equal(h.state().mathHistory.length, historyBefore + 1, name + ': nor bank the round twice');
  assert.deepEqual(h.consoleLog.error, [], name + ': console.error stayed quiet');
  return h;
}

suite('leave guard · Toán 7 chapter rounds and packs', () => {
  test('Học kì 1 chapter round (startMathQuiz)', () => auditQuiz('HK1 chapter 1', (h) => {
    h.sandbox.openMathSection('hk1');
    assert.contains(onclicks(h), 'startMathQuiz(1)', 'the practice list offers chương 1');
    h.sandbox.startMathQuiz(1);
  }));

  test('Học kì 1 ôn tổng hợp (startMathQuiz(0))', () => auditQuiz('HK1 mixed', (h) => {
    h.sandbox.openMathSection('hk1');
    assert.contains(onclicks(h), 'startMathQuiz(0)');
    h.sandbox.startMathQuiz(0);
  }));

  test('Học kì 2 chapter round, after its own lazy group', () => auditQuiz('HK2 chapter', (h) => {
    const S = h.sandbox;
    const first = onclicks(h).find((c) => /^startMathQuiz\([6-9]|10\)$/.test(c));
    assert.truthy(first, 'the HK2 practice list offers a chapter: ' + onclicks(h).join(' '));
    S.__run(first);
  }, { prepare: ensureHk2 }));

  test('lũy thừa & căn pack (startMathLtQuiz)', () => auditQuiz('LT pack', (h) => {
    h.sandbox.openMathSection('hk1');
    assert.contains(onclicks(h), 'startMathLtQuiz()');
    h.sandbox.startMathLtQuiz();
  }));

  test('"Luyện chương này" from a lesson (startMathQuizForLesson)', () => auditQuiz('lesson round', (h) => {
    const S = h.sandbox;
    S.openMathSection('hk1'); S.switchMathSubTab('lessons');
    const open = onclicks(h).find((c) => /^openMathLesson\(/.test(c));
    assert.truthy(open, 'the lessons list renders a lesson');
    S.__run(open);
    const go = onclicks(h).find((c) => /^startMathQuizForLesson\(/.test(c));
    assert.truthy(go, 'the lesson offers Luyện chương này');
    S.__run(go);
  }));

  test('"Luyện câu hay sai" (startMathWrongPractice)', () => auditQuiz('wrong practice', (h) => {
    const S = h.sandbox;
    S.openMathSection('history');
    assert.contains(onclicks(h), 'startMathWrongPractice()', 'the history page offers the wrong-answer drill');
    S.startMathWrongPractice();
  }, {
    prepare: (h) => {
      const ids = h.peek('MATH_QUESTIONS').filter((q) => q.options && q.correct !== undefined).slice(0, 4).map((q) => q.id);
      h.state().mathHistory = [{ date: Date.now(), chapter: 1, label: 'Chương 1', score: 6, total: 10, wrong: ids }];
    },
  }));
});

suite('leave guard · Toán 7 đề thi', () => {
  test('Học kì 1 paper (startMathExam) — the bar is locked while open and back once over', () => auditQuiz('HK1 exam', (h) => {
    const S = h.sandbox;
    S.openMathSection('hk1'); S.switchMathSubTab('exams');
    const go = onclicks(h).find((c) => /^startMathExam\('hk1-/.test(c));
    assert.truthy(go, 'the exams list renders an HK1 paper');
    S.__run(go);
  }, { expectLocked: true }));

  test('Học kì 2 paper (startMathExam) after its lazy group', () => auditQuiz('HK2 exam', (h) => {
    const S = h.sandbox;
    S.switchMathSubTab('exams');
    const go = onclicks(h).find((c) => /^startMathExam\('hk2-/.test(c));
    assert.truthy(go, 'the exams list renders an HK2 paper: ' + onclicks(h).join(' '));
    S.__run(go);
  }, { prepare: ensureHk2, expectLocked: true }));
});

suite('leave guard · the lesson page is reading, not an exercise', () => {
  test('a lesson counts as nothing in progress: every exit is free and the back arrow works', async () => {
    const h = await boot();
    const S = h.sandbox;
    S.openMathSection('hk1'); S.switchMathSubTab('lessons');
    const open = onclicks(h).find((c) => /^openMathLesson\(/.test(c));
    S.__run(open);
    assert.truthy(/exam-lesson-detail/.test(screenHTML(h)), 'the lesson rendered');
    assert.falsy(S.isMathQuizActive(), 'a lesson is not a round');
    assert.equal(S.buildStudyCheckpoint(), null, 'nothing to checkpoint');
    assert.falsy(navHidden(h));
    S.__confirmLog.length = 0;
    assert.contains(onclicks(h), 'renderMathHome()', 'the lesson renders its back arrow');
    S.renderMathHome();
    assert.equal(S.__confirmLog.length, 0, 'back asks nothing');
    assert.truthy(/switchMathSubTab/.test(screenHTML(h)), 'back lands on the Học kì view');
    S.__run(open);
    for (const [label, leave] of bottomBarExits(h)) {
      S.__confirmLog.length = 0;
      assert.truthy(leave() !== false, label + ': leaving a lesson must not be refused');
      assert.equal(S.__confirmLog.length, 0, label + ': leaving a lesson asks nothing');
      assert.truthy(S.switchScreen('mathHubScreen'));
      S.__run(open);
    }
  });
});

suite('leave guard · the retry drill (câu sai owed back)', () => {
  const owedIds = (h) => h.peek('MATH_QUESTIONS').filter((q) => q.options && q.correct !== undefined && q.id).slice(0, 3).map((q) => String(q.id));
  async function bootDrill() {
    const h = await boot();
    h.state().mathRetry = owedIds(h);
    const S = h.sandbox;
    S.openMathSection('toan7');
    assert.contains(onclicks(h), "startRetryDrill('math')", 'the owed banner offers the drill');
    return h;
  }
  const drillOn = (h) => h.sandbox.isRetryDrillActive() && h.sandbox.retryDrillKey() === 'math';
  const drillSnap = (h) => { const d = h.peek('_retryDrill'); return { idx: d.idx, fixed: d.fixed, missed: d.missed, queue: d.queue.map((q) => q.id), answered: !!d.answered }; };

  test('(A) every exit asks, Cancel keeps the same item, OK abandons cleanly', async () => {
    const h = await bootDrill();
    const S = h.sandbox;
    S.startMathRetry();
    assert.truthy(drillOn(h), 'the drill started');
    assert.truthy(/Luyện câu sai/.test(screenHTML(h)));
    const rendered = onclicks(h);
    const close = rendered.find((c) => /abandonRetryDrill|quitRetryDrill/.test(c));
    assert.truthy(close, 'the drill renders its ✕: ' + rendered.join(' '));
    // Miss one first so the queue has moved: Cancel must keep THAT order.
    const wrongPick = rendered.find((c) => /^mathRetryPick\(/.test(c));
    assert.truthy(wrongPick);
    S.__run(wrongPick.replace(/\d+/, (n) => String((Number(n) + 1) % 4)));
    S.nextRetryQuestion();
    assert.truthy(drillOn(h));
    const exits = bottomBarExits(h).concat([['the ✕ on the drill card', () => { S.__run(close); return drillOn(h) ? false : true; }]]);
    for (const [label, leave] of exits) {
      if (!drillOn(h)) {
        // A fresh drill has no work on the board, and the ✕ (like every
        // quiz's ✕) only asks once there is — so miss one again first.
        S.startMathRetry();
        const pick = onclicks(h).find((c) => /^mathRetryPick\(/.test(c));
        S.__run(pick.replace(/\d+/, (n) => String((Number(n) + 1) % 4)));
        S.nextRetryQuestion();
      }
      assertGuarded(h, 'retry drill / ' + label, leave, {
        isActive: () => drillOn(h), snapshot: () => drillSnap(h),
        afterCancel: () => assert.truthy(/Luyện câu sai/.test(screenHTML(h)), label + ': the drill card stays'),
      });
      assert.falsy(S.isRetryDrillActive(), label + ': the drill state is gone');
      assert.falsy(navHidden(h));
      assert.truthy(S.switchScreen('mathHubScreen'));
      assert.falsy(/Luyện câu sai · còn/.test(screenHTML(h)), label + ': the drill card is gone from the tab');
      assert.equal(h.state().mathRetry.length, owedIds(h).length, label + ': the debt itself is kept — leaving is not a way out of it');
    }
  });

  test('a Toán tab repaint mid-drill redraws the drill, not the menu over it', async () => {
    const h = await bootDrill();
    const S = h.sandbox;
    S.startMathRetry();
    const snap = drillSnap(h);
    S.__confirmLog.length = 0;
    assert.truthy(S.switchScreen('mathHubScreen'), 'the Math tab button while on the Math tab');
    assert.equal(S.__confirmLog.length, 0, 'it is not an exit');
    assert.truthy(drillOn(h), 'the drill survives');
    assert.deepEqual(drillSnap(h), snap);
    assert.truthy(/Luyện câu sai · còn/.test(screenHTML(h)), 'the drill card is still what is on screen');
    S.renderMathHome();
    assert.truthy(/Luyện câu sai · còn/.test(screenHTML(h)), 'renderMathHome() redraws the drill too');
  });

  test('(B)(C) finished: free to leave, nothing owed, next open clean', async () => {
    const h = await bootDrill();
    const S = h.sandbox;
    S.startMathRetry();
    let guard = 0;
    while (drillOn(h) && guard++ < 20) {
      const right = onclicks(h).find((c) => /^mathRetryPick\(/.test(c));
      const d = h.peek('_retryDrill');
      const q = d.queue[d.idx % d.queue.length];
      const i = q.options.findIndex((o) => String(o).trim() === String(q.answer).trim());
      assert.truthy(i >= 0, 'the owed question has its answer among its options');
      S.mathRetryPick(i);
      S.nextRetryQuestion();
    }
    assert.falsy(S.isRetryDrillActive(), 'the drill ended');
    assert.equal(h.state().mathRetry.length, 0, 'the debt is paid');
    assert.truthy(/Hết câu sai rồi/.test(screenHTML(h)), 'the done card');
    assert.contains(onclicks(h), "retryGoHome('math')", 'the done card offers the way home');
    S.__confirmLog.length = 0;
    for (const [label, leave] of bottomBarExits(h)) {
      assert.truthy(leave() !== false, label + ': free once finished');
      assert.equal(S.__confirmLog.length, 0, label + ': asks nothing');
      assert.truthy(S.switchScreen('mathHubScreen'));
    }
    S.retryGoHome('math');
    assert.equal(S.__confirmLog.length, 0);
    assert.falsy(/Luyện câu sai/.test(screenHTML(h)), 'home again');
    assert.falsy(/unit-owed-banner/.test(screenHTML(h)), 'no owed banner once the debt is paid');
    assert.equal(S.buildStudyCheckpoint(), null);
  });
});

suite('leave guard · the whiteboard never outlives the round', () => {
  test('closing the board mid-question is not an exit; leaving with it open closes it; the bar comes back', async () => {
    const h = await boot();
    const S = h.sandbox;
    S.openMathSection('hk1');
    S.startMathQuiz(2);
    S.openMathBoard();
    assert.truthy(boardOpen(h) && htmlHasBoardClass(h), 'open');
    const boardClicks = (h.el('mathBoardOverlay').innerHTML.match(/onclick="([^"]+)"/g) || []).map((s) => s.slice(9, -1));
    assert.contains(boardClicks, 'minimizeMathBoard()', 'the board renders its close');
    S.__confirmLog.length = 0;
    S.minimizeMathBoard();
    assert.equal(S.__confirmLog.length, 0, 'closing the board asks nothing');
    assert.falsy(boardOpen(h)); assert.falsy(htmlHasBoardClass(h));
    assert.truthy(S.isMathQuizActive(), 'the round is still on');
    assert.equal(quiz(h).idx, 0);
    // Reopen, then leave through the bar: Cancel keeps the board up, OK drops it.
    S.openMathBoard();
    S.__confirmAnswer = false; S.__confirmLog.length = 0;
    assert.equal(S.switchScreen('homeScreen'), false);
    assert.equal(S.__confirmLog.length, 1);
    assert.truthy(boardOpen(h) && htmlHasBoardClass(h), 'Cancel keeps the board and the rough work');
    S.__confirmAnswer = true;
    assert.truthy(S.switchScreen('homeScreen'));
    assert.falsy(boardOpen(h), 'OK closes the board');
    assert.falsy(htmlHasBoardClass(h), 'and drops the html class that hides the bar');
    assert.equal(h.el('bottomNav').style.display, 'flex', 'Home shows the bar');
    assert.equal(h.el('mathBoardOverlay').innerHTML, '', 'the overlay DOM is dropped');
  });

  test('a paper finished with the board open: the bar is back, the shell repairs itself, leaving is free', async () => {
    const h = await boot();
    const S = h.sandbox;
    S.openMathSection('hk1'); S.switchMathSubTab('exams');
    S.__run(onclicks(h).find((c) => /^startMathExam\('hk1-/.test(c)));
    assert.truthy(navHidden(h), 'locked during the paper');
    S.openMathBoard();
    playToEnd(h);
    assertTornDown(h, 'paper finished with board open');
    assert.equal(h.el('bottomNav').style.display, '', 'mathLockScreen(false) cleared the inline display');
    S.__confirmLog.length = 0;
    assert.truthy(S.switchScreen('homeScreen'));
    assert.equal(S.__confirmLog.length, 0);
    S.ensureHomeBottomNav();
    assert.equal(h.el('bottomNav').style.display, 'flex');
    assert.falsy(htmlHasBoardClass(h), 'ensureHomeBottomNav finds nothing to repair');
  });

  test('the shell invariant clears a board class left behind, but respects a board that is really open', async () => {
    const h = await boot();
    const S = h.sandbox;
    S.switchScreen('homeScreen');
    h.doc.documentElement.classList.add('math-board-open');   // stale, overlay hidden
    h.el('bottomNav').style.display = 'none';
    S.ensureHomeBottomNav();
    assert.falsy(htmlHasBoardClass(h), 'a stale class with no overlay is removed');
    assert.equal(h.el('bottomNav').style.display, 'flex');
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
