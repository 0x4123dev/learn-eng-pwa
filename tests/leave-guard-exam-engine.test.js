// leave-guard-exam-engine.test.js — every set that runs on js/exam.js, walked
// out of the way a child walks out, with the app booted for real.
//
// The rule (the same one for every exercise in the app):
//   (A) while a paper is running, every way OUT — the bottom bar (Home / Eng /
//       Arena / Toán), the Exam tab button, the in-screen ✕, a Daily Task deep
//       link — asks confirm() first. Cancel keeps the child on the SAME
//       question with the clock still running; OK abandons cleanly: state
//       nulled, clock stopped, bottom bar back, checkpoint gone.
//   (B) once the results screen is up, leaving asks nothing and nothing blocks
//       it: the bottom bar is visible, the target screen becomes active.
//   (C) after leaving either way, the tab reopens clean: its home draws, no
//       ghost paper, the attempt was written once and the coins paid once, and
//       no study checkpoint offers the paper back.
//
// Seven activities share the engine — the HCMC Exam tab, the PTNK papers, and
// the five practice menus (Reading, Cloze, Error Correction, Grammar &
// Vocabulary, Phonetics & Stress) — each on its own screen, and the guard in
// js/app.js switchScreen keys off the set's OWN screen (_examOwnScreen). So a
// switch to the tab's own screen must NOT ask, and — since the clock keeps
// running — must not paint the home over the live question either.
//
// Nothing here reads source text. tests/verify/client.js boots index.html's
// script list in one vm context; confirm() is answered from
// h.sandbox.__confirmAnswer and every prompt lands in h.sandbox.__confirmLog.
const { suite, test, assert } = require('./harness');
const { mountApp, loginTestUser } = require('./verify/client.js');

const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n) => { for (let i = 0; i < (n || 6); i++) await tick(); };

// The harness records timers and makes clearInterval a no-op; the exam clock
// "stopping" is therefore observable only as a clearInterval(timerId) call.
function boot() {
  const h = mountApp();
  loginTestUser(h, { coins: 100 });
  assert.deepEqual(h.loadErrors, [], 'the app must boot without a script error');
  h.cleared = [];
  h.sandbox.clearInterval = (id) => { h.cleared.push(id); };
  return h;
}

// Run the exact onclick a rendered button carries, the way a tap would.
function tapOnclick(h, screenId, fnName) {
  const html = h.el(screenId).innerHTML;
  const m = html.match(new RegExp('onclick="(' + fnName + '\\([^"]*\\))"'));
  assert.truthy(m, screenId + ' renders no button calling ' + fnName + '()');
  h.doc.__runInline(m[1]);
  return m[1];
}

const activeScreen = (h) => { const s = h.doc.querySelector('.screen.active'); return s ? s.id : null; };
const checkpoint = (h) => h.store[h.peek('STUDY_CHECKPOINT_KEY')];
const showsQuestion = (h, screenId) => !!h.el(screenId).querySelector('.exam-quiz-header');
const questionLabel = (h, screenId) => {
  const c = h.el(screenId).querySelector('.exam-quiz-count');
  return c ? c.textContent.trim() : '';
};

// ---------------------------------------------------------------------------
// The seven activities. `open` reaches the tab the way the Learn hub / bottom
// bar does; `start` taps the button the home renders (with confirm() answered
// "yes" where the set asks one — the HCMC and PTNK papers do, the practice
// menus start on the tap itself).
// ---------------------------------------------------------------------------
const ACTIVITIES = [
  { name: 'Exam (HCMC)', screen: 'examScreen', set: 'hcmc', startFn: 'confirmStartExam', link: 'ptnk:any' },
  { name: 'PTNK', screen: 'ptnkScreen', set: 'ptnk', startFn: 'startPtnkExam', link: 'reading:kc' },
  { name: 'Reading', screen: 'readingScreen', set: 'reading', startFn: 'startReadingPractice', link: 'ptnk:any' },
  { name: 'Cloze', screen: 'clozeScreen', set: 'cloze', startFn: 'startClozePractice', link: 'ptnk:any' },
  { name: 'Error Correction', screen: 'errorsScreen', set: 'errors', startFn: 'startErrorsPractice', link: 'ptnk:any' },
  { name: 'Grammar & Vocabulary', screen: 'grammarVocabScreen', set: 'grammarvocab', startFn: 'startGrammarVocabPractice', link: 'ptnk:any' },
  { name: 'Phonetics & Stress', screen: 'phoneticsScreen', set: 'phonetics', startFn: 'startPhoneticsPractice', link: 'ptnk:any',
    afterOpen: (h) => h.sandbox.switchPhoneticsSubTab('practice') },
];

async function openTab(h, a) {
  assert.equal(h.sandbox.switchScreen(a.screen), true, 'could not open ' + a.screen);
  await settle(8);
  if (a.afterOpen) a.afterOpen(h);
  assert.truthy(h.el(a.screen).innerHTML.includes(a.startFn), a.name + ' home renders no ' + a.startFn + ' button');
}

// Open the tab and start a paper the way the child does. Leaves the child on
// question 2 (one answered, one advanced) so "the same question" is provable.
async function startPaper(h, a) {
  await openTab(h, a);
  h.sandbox.__confirmAnswer = true;
  h.sandbox.__confirmLog.length = 0;
  tapOnclick(h, a.screen, a.startFn);
  assert.truthy(h.sandbox.isExamActive(), a.name + ' did not start');
  assert.equal(h.sandbox.examCurrentSet(), a.set, a.name + ' started in the wrong set');
  assert.truthy(showsQuestion(h, a.screen), 'the first question is drawn on ' + a.screen);
  assert.equal(h.el('bottomNav').style.display, 'none', 'the bottom bar hides while a paper runs');
  answerCurrent(h);
  h.sandbox.nextExamQuestion();
  const s = h.peek('_examState');
  assert.equal(s.idx, 1, 'on question 2');
  assert.truthy(questionLabel(h, a.screen).startsWith('Q 2/'), 'screen shows Q 2/N, got "' + questionLabel(h, a.screen) + '"');
  assert.truthy(checkpoint(h), 'a live paper is checkpointed');
  h.sandbox.__confirmLog.length = 0;
  return s;
}

function answerCurrent(h, wrong) {
  const s = h.peek('_examState');
  const q = s.questions[s.idx];
  if (q.type === 'text') {
    const inp = h.el('examTextInput');
    assert.truthy(inp, 'a text question renders its input');
    inp.value = wrong ? 'zzz-not-an-answer' : q.answer;
    h.sandbox.submitExamText();
  } else {
    h.sandbox.answerExamChoice(wrong ? (q.correct + 1) % q.options.length : q.correct);
  }
  assert.truthy(s.answers[s.idx], 'the answer was recorded');
}

// Answer every remaining question (right) and tap through to the results.
function finishPaper(h, a) {
  const s = h.peek('_examState');
  let guard = 0;
  while (h.sandbox.isExamActive() && guard++ < 500) {
    if (!s.answers[s.idx]) answerCurrent(h);
    h.sandbox.nextExamQuestion();
  }
  assert.falsy(h.sandbox.isExamActive(), 'the paper did not finish');
  assert.equal(h.peek('_examState'), null, 'finishExam leaves no state behind');
  assert.truthy(h.el(a.screen).querySelector('.exam-result'), 'the results screen is up');
  return s;
}

// The ways out of a running paper. Each returns what the guard returned, or
// undefined for the routes that do not report (quitExam, the deep link's
// promise is awaited separately).
const EXITS = [
  { name: 'bottom bar Home', go: (h) => h.sandbox.switchScreen('homeScreen'), lands: 'homeScreen' },
  { name: 'bottom bar Eng', go: (h) => h.sandbox.switchScreen('learnHubScreen'), lands: 'learnHubScreen' },
  { name: 'bottom bar Toán', go: (h) => h.sandbox.switchScreen('mathHubScreen'), lands: 'mathHubScreen' },
  { name: 'bottom bar Exam', go: (h, a) => h.sandbox.switchScreen('examScreen'), lands: 'examScreen', skipFor: 'examScreen' },
  { name: 'bottom bar Arena (openPetBattle)', go: (h) => h.sandbox.openPetBattle(), lands: 'petBattleScreen', async: true, noReturn: true },
  { name: 'in-screen ✕ (quitExam)', go: (h, a) => tapOnclick(h, a.screen, 'quitExam'), lands: null, viaQuit: true },
  { name: 'Daily Task deep link', go: (h, a) => h.sandbox.DailyTask.go(a.link), async: true, landsFromLink: true },
  { name: 'My Skills → Exam (goToSkillTab)', go: (h) => h.sandbox.goToSkillTab('exam'), lands: 'examScreen', skipFor: 'examScreen', noReturn: true },
];

function linkScreen(h, kind) { return h.sandbox.DailyTaskCatalog.get(kind).go.screen; }

for (const a of ACTIVITIES) {
  suite('leave guard · ' + a.name + ' (' + a.screen + ')', () => {
    for (const x of EXITS) {
      if (x.skipFor === a.screen) continue;

      test('(A) ' + x.name + ': asks, and Cancel keeps question 2 with the clock running', async () => {
        const h = boot();
        const s = await startPaper(h, a);
        const timerId = s.timerId;
        h.sandbox.__confirmAnswer = false;
        let r = x.go(h, a);
        if (x.async) r = await r;
        await settle();
        assert.equal(h.sandbox.__confirmLog.length, 1, 'exactly one confirm() (' + h.sandbox.__confirmLog.length + ')');
        if (!x.viaQuit && !x.noReturn) assert.equal(r, false, 'a refused leave must report false');
        assert.truthy(h.sandbox.isExamActive(), 'the paper must still be running');
        assert.equal(h.peek('_examState'), s, 'the very same session object');
        assert.equal(s.idx, 1, 'still on question 2');
        assert.equal(s.timerId, timerId, 'same clock');
        assert.notContains(h.cleared, timerId, 'the clock must not have been stopped');
        assert.equal(activeScreen(h), a.screen, 'still on ' + a.screen);
        assert.truthy(showsQuestion(h, a.screen), 'the question is still drawn');
        assert.truthy(questionLabel(h, a.screen).startsWith('Q 2/'), 'still shows Q 2/N');
        assert.equal(h.el('bottomNav').style.display, 'none', 'the bottom bar stays hidden');
        assert.truthy(checkpoint(h), 'the checkpoint is kept for the paper that goes on');
      });

      test('(A) ' + x.name + ': OK leaves and abandons cleanly', async () => {
        const h = boot();
        const s = await startPaper(h, a);
        const timerId = s.timerId;
        const coins = h.state().coins;
        const historyBefore = h.sandbox.loadExamHistory().length;
        h.sandbox.__confirmAnswer = true;
        let r = x.go(h, a);
        if (x.async) r = await r;
        await settle(8);
        assert.equal(h.sandbox.__confirmLog.length, 1, 'exactly one confirm()');
        if (!x.viaQuit && !x.noReturn) assert.truthy(r !== false, 'OK must let the leave happen');
        assert.falsy(h.sandbox.isExamActive(), 'the paper is abandoned');
        assert.equal(h.peek('_examState'), null, 'state is nulled');
        assert.contains(h.cleared, timerId, 'the clock was stopped');
        assert.truthy(h.el('bottomNav').style.display !== 'none', 'the bottom bar is back');
        assert.falsy(checkpoint(h), 'no checkpoint offers the abandoned paper back');
        const lands = x.landsFromLink ? linkScreen(h, a.link) : (x.lands || a.screen);
        assert.equal(activeScreen(h), lands, 'landed on ' + lands);
        if (x.viaQuit) assert.truthy(h.el(a.screen).innerHTML.includes(a.startFn) || h.el(a.screen).innerHTML.includes('grammar-subtab'), 'quit draws the set\'s home');
        assert.equal(h.state().coins, coins, 'walking out pays nothing');
        h.sandbox.examSelectSet(a.set);
        assert.equal(h.sandbox.loadExamHistory().length, historyBefore, 'walking out writes no attempt');
        // (C) the tab reopens clean.
        await openTab(h, a);
        assert.falsy(h.sandbox.isExamActive(), 'no ghost paper on reopen');
        assert.falsy(showsQuestion(h, a.screen), 'the home, not a question');
        assert.equal(h.el('bottomNav').style.display !== 'none', true, 'bottom bar still there');
      });
    }

    test('(A) re-rendering its own screen asks nothing and keeps the live question', async () => {
      const h = boot();
      const s = await startPaper(h, a);
      h.sandbox.__confirmAnswer = false;   // would refuse if asked — so a prompt fails the test
      const r = h.sandbox.switchScreen(a.screen);
      await settle(8);
      assert.equal(r, true, 'a switch to the tab\'s own screen goes through');
      assert.equal(h.sandbox.__confirmLog.length, 0, 'no confirm() for staying where you are');
      assert.equal(h.peek('_examState'), s, 'same session');
      assert.truthy(h.sandbox.isExamActive() && s.idx === 1, 'still on question 2, still running');
      assert.truthy(showsQuestion(h, a.screen), 'the QUESTION is on screen, not the home over a ticking clock');
      assert.truthy(questionLabel(h, a.screen).startsWith('Q 2/'));
      assert.equal(h.el('bottomNav').style.display, 'none', 'the bottom bar stays hidden');
      // The set's own home renderer, asked directly (a same-screen Daily Task
      // deep link calls it after switchScreen), yields to the live paper too.
      h.sandbox.renderExamHome();
      assert.truthy(showsQuestion(h, a.screen), 'renderExamHome() does not paint over a running paper');
      assert.equal(h.sandbox.__confirmLog.length, 0);
    });

    test('(B)+(C) finished: results leave freely, nav visible, paid once, reopen clean', async () => {
      const h = boot();
      await startPaper(h, a);
      const coins0 = h.state().coins;
      h.sandbox.examSelectSet(a.set);
      const historyBefore = h.sandbox.loadExamHistory().length;
      const s = finishPaper(h, a);
      assert.contains(h.cleared, s.timerId, 'the clock stopped at finish');
      assert.truthy(h.el('bottomNav').style.display !== 'none', 'the bottom bar is visible on the results screen');
      assert.falsy(h.el('bottomNav').hasAttribute('aria-hidden'), 'and not aria-hidden');
      assert.falsy(h.el(a.screen).classList.contains('lazy-css-pending'), 'no leftover pending class');
      assert.falsy(checkpoint(h), 'a finished paper is not checkpointed');
      const history = h.sandbox.loadExamHistory();
      assert.equal(history.length, historyBefore + 1, 'one attempt written');
      const attempt = history[0];
      assert.equal(attempt.score, attempt.total, 'every question answered right');
      assert.truthy(attempt.coinsEarned >= 5 * attempt.total, 'paid at least 5 a question');
      assert.equal(h.state().coins, coins0 + attempt.coinsEarned, 'coins paid exactly once');
      const coins1 = h.state().coins;
      // The results screen's own buttons are the set's: home and retake.
      assert.truthy(h.el(a.screen).innerHTML.includes('renderExamHome()'), 'a home button on the results');
      assert.truthy(h.el(a.screen).innerHTML.includes("confirmStartExam('" + attempt.examId + "')"), 'a retake button on the results');
      // (B) every way out, no question asked.
      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      for (const target of ['homeScreen', 'learnHubScreen', 'mathHubScreen', 'examScreen']) {
        h.sandbox.switchScreen(a.screen); await settle(4);
        assert.equal(h.sandbox.switchScreen(target), true, 'leaving the results to ' + target + ' must work');
        await settle(4);
        assert.equal(activeScreen(h), target, 'landed on ' + target);
      }
      const arena = await h.sandbox.openPetBattle();
      await settle(8);
      assert.equal(h.sandbox.__confirmLog.length, 0, 'no confirm() once the paper is scored (' + h.sandbox.__confirmLog.join(' | ') + ')');
      assert.falsy(h.sandbox.isExamActive(), 'nothing still active');
      // (C) reopen: the home, the attempt once, the coins once, no ghost.
      await openTab(h, a);
      assert.falsy(h.sandbox.isExamActive(), 'no ghost paper');
      assert.falsy(showsQuestion(h, a.screen), 'the home draws, not a question');
      assert.equal(h.sandbox.loadExamHistory().length, historyBefore + 1, 'still one attempt');
      assert.equal(h.state().coins, coins1, 'no double coins');
      assert.falsy(checkpoint(h), 'no checkpoint');
      assert.truthy(h.el('bottomNav').style.display !== 'none');
      void arena;
    });

    test('(B) the results screen\'s own home button and a retake work', async () => {
      const h = boot();
      await startPaper(h, a);
      const s = finishPaper(h, a);
      h.sandbox.__confirmLog.length = 0;
      h.sandbox.__confirmAnswer = false;
      tapOnclick(h, a.screen, 'renderExamHome');
      assert.equal(h.sandbox.__confirmLog.length, 0, 'home from the results asks nothing');
      assert.falsy(h.el(a.screen).querySelector('.exam-result'), 'the results gave way to the home');
      assert.equal(h.sandbox.examCurrentSet(), a.set, 'home of the SAME set');
      assert.equal(activeScreen(h), a.screen);
      // Retake: the confirm here is the paper's own "Start?", not a leave guard.
      h.sandbox.__confirmAnswer = true;
      await startPaper(h, a);
      finishPaper(h, a);
      h.sandbox.__confirmAnswer = true;
      h.sandbox.__confirmLog.length = 0;
      tapOnclick(h, a.screen, 'confirmStartExam');
      assert.equal(h.sandbox.__confirmLog.length, 1, 'retake asks "Start?" once');
      assert.truthy(h.sandbox.isExamActive(), 'retake started a fresh paper');
      const s2 = h.peek('_examState');
      assert.truthy(s2 !== s && s2.idx === 0, 'a fresh session from question 1');
      assert.equal(h.sandbox.examCurrentSet(), a.set);
    });

    test('history and review views leave freely and belong to the set', async () => {
      const h = boot();
      await startPaper(h, a);
      finishPaper(h, a);
      // Back to the home, then its History button (the exact onclick it renders).
      tapOnclick(h, a.screen, 'renderExamHome');
      const html = h.el(a.screen).innerHTML;
      const m = html.match(/onclick="((?:examSelectSet\('[a-z]+'\); )?renderExamHistory\(\))"/);
      assert.truthy(m, 'the home renders a History button');
      h.doc.__runInline(m[1]);
      assert.equal(h.sandbox.examCurrentSet(), a.set, 'history of the SAME set');
      assert.truthy(h.el(a.screen).querySelector('.exam-history-item'), 'the attempt is listed');
      tapOnclick(h, a.screen, 'reviewExamAttempt');
      assert.truthy(h.el(a.screen).querySelector('.exam-review-list'), 'the review opens');
      assert.truthy(h.el(a.screen).innerHTML.includes('renderExamHistory()'), 'with a way back to history');
      assert.falsy(h.sandbox.isExamActive(), 'a review is not a live paper');
      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'leaving a review asks nothing');
      assert.equal(h.sandbox.__confirmLog.length, 0);
      assert.truthy(h.el('bottomNav').style.display !== 'none');
    });
  });
}

// ---------------------------------------------------------------------------
// Things only one set has.
// ---------------------------------------------------------------------------
suite('leave guard · exam engine specifics', () => {
  test('the Phonetics Lessons sub-tab (and an open lesson) is not a paper in progress', async () => {
    const h = boot();
    assert.equal(h.sandbox.switchScreen('phoneticsScreen'), true); await settle(8);
    assert.truthy(h.el('phoneticsScreen').querySelector('.exam-lesson-card'), 'Lessons is the first sub-tab');
    tapOnclick(h, 'phoneticsScreen', 'openPhoneticsLesson');
    assert.truthy(h.el('phoneticsScreen').querySelector('.exam-lesson-content'), 'a lesson is open');
    h.sandbox.__confirmAnswer = false;
    h.sandbox.__confirmLog.length = 0;
    assert.falsy(h.sandbox.isExamActive());
    for (const target of ['homeScreen', 'learnHubScreen', 'mathHubScreen', 'examScreen']) {
      h.sandbox.switchScreen('phoneticsScreen'); await settle(4);
      assert.equal(h.sandbox.switchScreen(target), true, 'leaving a lesson to ' + target);
    }
    assert.equal(h.sandbox.__confirmLog.length, 0, 'no confirm() for reading a lesson');
    // The lesson's own back buttons return to the lessons list, asking nothing.
    h.sandbox.switchScreen('phoneticsScreen'); await settle(4);
    tapOnclick(h, 'phoneticsScreen', 'openPhoneticsLesson');
    tapOnclick(h, 'phoneticsScreen', 'renderPhoneticsHome');
    assert.truthy(h.el('phoneticsScreen').querySelector('.exam-lesson-card'), 'back on the lessons list');
    assert.equal(h.sandbox.__confirmLog.length, 0);
  });

  test('the Exam tab draws the HCMC list after a visit to a practice menu or PTNK', async () => {
    // Before the fix, renderExamHome() delegated to whichever set was last
    // selected — the Reading home was drawn on readingScreen and the Exam
    // tab sat on "Đang tải bài…" for the rest of the session.
    const h = boot();
    for (const other of ['readingScreen', 'ptnkScreen', 'phoneticsScreen', 'clozeScreen']) {
      assert.equal(h.sandbox.switchScreen(other), true); await settle(8);
      assert.truthy(h.sandbox.examCurrentSet() !== 'hcmc', other + ' selects its own set');
      assert.equal(h.sandbox.switchScreen('examScreen'), true); await settle(8);
      assert.equal(h.sandbox.examCurrentSet(), 'hcmc', 'the Exam tab is the HCMC set');
      const text = h.el('examScreen').textContent;
      assert.falsy(/Đang tải bài/.test(text), 'the Exam tab must not be stuck on its loading line after ' + other);
      assert.truthy(h.el('examScreen').innerHTML.includes('confirmStartExam('), 'the HCMC papers are listed');
      assert.truthy(h.el('examScreen').innerHTML.includes('renderExamHistory()'), 'with the HCMC history button');
    }
    // …and the same through My Skills → Exam on Home.
    h.sandbox.switchScreen('ptnkScreen'); await settle(8);
    h.sandbox.switchScreen('homeScreen'); await settle(4);
    h.sandbox.goToSkillTab('exam'); await settle(8);
    assert.equal(activeScreen(h), 'examScreen');
    assert.equal(h.sandbox.examCurrentSet(), 'hcmc');
    assert.truthy(h.el('examScreen').innerHTML.includes('confirmStartExam('));
  });

  test('a PTNK results screen still goes home to PTNK, and a practice one to its list', async () => {
    for (const a of ACTIVITIES.filter(x => x.set !== 'hcmc')) {
      const h = boot();
      await startPaper(h, a);
      finishPaper(h, a);
      tapOnclick(h, a.screen, 'renderExamHome');
      assert.equal(h.sandbox.examCurrentSet(), a.set, a.name + ': home from results stays in its set');
      assert.equal(activeScreen(h), a.screen);
      assert.truthy(h.el(a.screen).innerHTML.includes(a.startFn) || h.el(a.screen).innerHTML.includes('grammar-subtab'),
        a.name + ': its own home is drawn on ' + a.screen);
      assert.falsy(h.el('examScreen').innerHTML.includes('exam-result'), 'nothing was drawn on the Exam tab');
    }
  });

  test('abandonExam() itself clears the study checkpoint (a leave that skips the click listener)', async () => {
    const h = boot();
    await startPaper(h, ACTIVITIES[2]);
    assert.truthy(checkpoint(h));
    h.sandbox.abandonExam();
    assert.falsy(checkpoint(h), 'the abandoned paper must not be offered back on the next open');
    assert.truthy(h.el('bottomNav').style.display !== 'none');
  });

  test('switching profile mid-paper stops the clock and clears everything', async () => {
    const h = boot();
    const s = await startPaper(h, ACTIVITIES[1]);
    h.sandbox.examForgetProfile();
    assert.falsy(h.sandbox.isExamActive());
    assert.contains(h.cleared, s.timerId, 'the clock stopped');
    assert.equal(h.sandbox.examCurrentSet(), 'hcmc');
    assert.falsy(checkpoint(h));
    assert.truthy(h.el('bottomNav').style.display !== 'none');
  });

  test('the wrong answer path finishes and leaves as freely as the right one', async () => {
    const h = boot();
    const a = ACTIVITIES[4];
    await startPaper(h, a);
    const s = h.peek('_examState');
    let guard = 0;
    while (h.sandbox.isExamActive() && guard++ < 100) {
      if (!s.answers[s.idx]) answerCurrent(h, true);
      h.sandbox.nextExamQuestion();
    }
    assert.falsy(h.sandbox.isExamActive());
    const attempt = h.sandbox.loadExamHistory()[0];
    assert.equal(attempt.score, 1, 'only the first (right) answer scored');
    h.sandbox.__confirmAnswer = false;
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('homeScreen'), true);
    assert.equal(h.sandbox.__confirmLog.length, 0);
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
