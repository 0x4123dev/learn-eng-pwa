// leave-guard-grammar.test.js — the Grammar tab, walked out of every door.
//
// THE RULE, for every exercise in the app:
//   (A) while a round is live, every way OUT — the bottom bar, the Learn hub,
//       the in-screen ✕ Exit, a Daily Task deep link — asks confirm() first.
//       Cancel keeps the child exactly where they were, state intact; OK
//       leaves and abandons the round cleanly.
//   (B) once the round is FINISHED (result card up), leaving is free: no
//       confirm, nothing blocking the bottom bar, no stale "active" flag.
//   (C) after leaving either way, the next open of the tab is clean: no ghost
//       round, no second payment, no checkpoint offering the round back.
//
// The bottom bar's Home button is already proved by the verify check
// `quiz-in-progress-guards-the-bottom-nav` (tests/verify/client.js). This file
// takes every OTHER door, for every way a grammar round can start: a unit
// card, a lesson's "Practise this lesson", Practice My Mistakes, the "replay
// wrong answers" button on a past session, a weak topic on History, the "Try
// Again" on a result card, and a round brought back by the study checkpoint.
//
// Executed, not grepped: the app boots in the same harness as
// tests/verify/client.js, every button is driven through the onclick it
// renders, and confirm() is answered from here.
const { suite, test, assert } = require('./harness');
const { mountApp, loginTestUser } = require('./verify/client.js');

const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';
const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n) => { for (let i = 0; i < (n || 6); i++) await tick(); };

// ---------------------------------------------------------------------------
// harness helpers
// ---------------------------------------------------------------------------

async function boot(overrides, storage) {
  const h = mountApp(storage ? { storage } : undefined);
  assert.deepEqual(h.loadErrors, [], 'the app must boot cleanly');
  loginTestUser(h, Object.assign({ coins: 100 }, overrides || {}));
  // init() arms this at boot (js/app.js): the capture-phase click net that
  // schedules a checkpoint save after every tap's handlers have run. The
  // harness never fires DOMContentLoaded, so arm it the way init() does.
  h.sandbox.startStudyCheckpointing();
  h.sandbox.switchScreen('grammarScreen');
  await settle();
  return h;
}

// Tap the way a finger does: the document's capture-phase listeners run first
// (scheduleStudyCheckpoint records a setTimeout(0)), then the button's onclick,
// then the after-tap save the net scheduled. Timers are recorded, never fired,
// in this harness — so the save is fired here, and only that one.
function tap(h, code) {
  const before = h.timers.length;
  h.doc.dispatch('click');
  const net = h.timers.slice(before);
  const r = h.run(code);
  net.forEach((t) => t.fn());
  return r;
}

const onclicks = (h) => [...h.el('grammarScreen').innerHTML.matchAll(/onclick="([^"]+)"/g)].map((m) => m[1]);
const findClick = (h, re) => {
  const c = onclicks(h).find((x) => re.test(x));
  assert.truthy(c, 'the screen renders a button matching ' + re + ' — has: ' + onclicks(h).join(' | '));
  return c;
};
const quiz = (h) => h.peek('_grammarQuizState');
const hasQuestionCard = (h) => /grammar-question-card/.test(h.el('grammarScreen').innerHTML);
const hasHomeCards = (h) => /grammar-unit-card|grammar-subtabs/.test(h.el('grammarScreen').innerHTML);
const hasResultCard = (h) => /grammar-result-card/.test(h.el('grammarScreen').innerHTML);
const navItems = (h) => Array.from(h.doc.querySelectorAll('#bottomNav .nav-item'));
const activeNavKey = (h) => (navItems(h).find((n) => n.classList.contains('active')) || { dataset: {} }).dataset.navKey;

function answerCurrent(h, correct) {
  const st = quiz(h);
  const q = st.questions[st.currentIdx];
  if (q.type === 'arrangement') {
    const order = q.parts.map((_, i) => i);
    if (!correct && order.length > 1) [order[0], order[1]] = [order[1], order[0]];
    order.forEach((i) => h.sandbox.placeArrangementTile(i));
    h.sandbox.submitArrangement();
  } else {
    h.sandbox.answerGrammarQuestion(correct ? q.correct : (q.correct + 1) % q.options.length);
  }
}

// Answer every question (all right, or all wrong) and press Next through to
// the result card. Returns what the child was owed.
function finish(h, opts) {
  opts = opts || {};
  const st = quiz(h);
  assert.truthy(st, 'a round must be live to finish it');
  let score = 0;
  while (quiz(h)) {
    const correct = opts.wrong ? false : true;
    answerCurrent(h, correct);
    if (correct) score++;
    // the top "Next →" and the bottom "Next Question →" both call this
    findClick(h, /^nextGrammarQuestion\(\)$/);
    h.sandbox.nextGrammarQuestion();
  }
  assert.truthy(hasResultCard(h), 'the result card is up');
  return { score };
}

function assertFrozen(h, before, label) {
  const st = quiz(h);
  assert.truthy(st === before.state, label + ': the very same round object is still live');
  assert.equal(st.currentIdx, before.idx, label + ': still on the same question');
  assert.deepEqual(st.answers, before.answers, label + ': no answer changed');
  assert.deepEqual(st.arrangements.map((a) => a && a.ordered), before.ordered, label + ': placed tiles untouched');
  assert.equal(h.el('grammarScreen').innerHTML, before.html, label + ': the screen did not so much as repaint');
  assert.truthy(h.el('grammarScreen').classList.contains('active'), label + ': the grammar screen is still the one showing');
}

function snapshot(h) {
  const st = quiz(h);
  return {
    state: st, idx: st.currentIdx, answers: st.answers.slice(),
    ordered: st.arrangements.map((a) => a && a.ordered.slice()),
    html: h.el('grammarScreen').innerHTML,
    coins: h.state().coins, history: (h.state().grammarHistory || []).length,
  };
}

// Every door out of a live round, other than the Home button on the bottom
// bar. Each returns a promise that resolves once the app has settled.
const EXITS = [
  { name: 'the ✕ Exit button on the quiz', leavesScreen: false,
    go: async (h) => { tap(h, findClick(h, /^confirmExitGrammarQuiz\(\)$/)); await settle(); } },
  { name: 'the Learn tab on the bottom bar', leavesScreen: true, nav: 'learn',
    go: async (h) => { tap(h, "switchScreen('learnHubScreen')"); await settle(); } },
  { name: 'the Toán tab on the bottom bar', leavesScreen: true, nav: 'math',
    go: async (h) => { tap(h, "switchScreen('mathHubScreen')"); await settle(12); } },
  { name: 'the Arena tab on the bottom bar (openPetBattle)', leavesScreen: true, nav: 'arena',
    go: async (h) => { const p = tap(h, 'openPetBattle()'); await p; await settle(12); } },
  { name: 'the Exam tab on the bottom bar', leavesScreen: true, nav: 'exam',
    go: async (h) => { tap(h, "switchScreen('examScreen')"); await settle(); } },
  { name: 'the Daily Task screen (DailyTask.open)', leavesScreen: true, nav: 'home',
    go: async (h) => { tap(h, 'DailyTask.open()'); await settle(); } },
];

// ---------------------------------------------------------------------------
// the ways a grammar round starts
// ---------------------------------------------------------------------------

// Seed a mistake bank + a session with wrong answers, the way a child does:
// finish a unit quiz getting everything wrong. Leaves the tab on its home.
async function seedMistakes(h) {
  const unit = h.peek('GRAMMAR_UNITS')[0];
  // 25 wrong across unit 1's ~21 topics: at least one topic is missed twice,
  // which is what a weak-topic drill needs.
  h.sandbox.startGrammarQuiz(unit.id, 25);
  finish(h, { wrong: true });
  h.sandbox.renderGrammarHome();
  assert.truthy(h.sandbox.getActiveMistakes().length >= 2, 'the wrong answers landed in the mistake bank');
  assert.truthy(h.sandbox.getWeakTopics()[0].count >= 2, 'a topic missed at least twice');
}

const STARTERS = [
  { name: 'a unit card quiz', seed: null,
    start: async (h) => {
      h.sandbox.switchGrammarSubTab('units');
      const unit = h.peek('GRAMMAR_UNITS')[0];
      h.run(findClick(h, new RegExp("^toggleGrammarUnitExpanded\\('" + unit.id + "'\\)$")));
      h.run(findClick(h, new RegExp("^startGrammarQuiz\\('" + unit.id + "', 10\\)$")));
    } },
  { name: 'a lesson drill (Practise this lesson)', seed: null,
    start: async (h) => {
      h.sandbox.switchGrammarSubTab('lessons');
      const u = h.peek('GRAMMAR_LESSONS')[0];
      h.run(findClick(h, new RegExp("^toggleGrammarLessonUnitExpanded\\('" + u.unitId + "'\\)$")));
      h.run(findClick(h, /^openGrammarLesson\('unit1', '1a'\)$/));
      assert.truthy(/lesson-detail/.test(h.el('grammarScreen').innerHTML), 'the lesson view is open');
      h.run(findClick(h, /^practiceGrammarLesson\('unit1', '1a'\)$/));
    } },
  { name: 'Practice My Mistakes', seed: seedMistakes,
    start: async (h) => {
      h.sandbox.switchGrammarSubTab('units');
      h.run(findClick(h, /^startMistakesQuiz\(10\)$/));
    } },
  { name: 'replay the wrong answers of a past session', seed: seedMistakes,
    start: async (h) => {
      h.sandbox.switchGrammarSubTab('history');
      h.run(findClick(h, /^openGrammarSession\(0\)$/));
      h.run(findClick(h, /^rePracticeWrongFromSession\(0\)$/));
    } },
  { name: 'a weak topic on History', seed: seedMistakes,
    start: async (h) => {
      h.sandbox.switchGrammarSubTab('history');
      h.run(findClick(h, /^practiceWeakTopic\(/));
    } },
  { name: 'Try Again on a result card', seed: null,
    start: async (h) => {
      h.sandbox.switchGrammarSubTab('units');
      h.sandbox.startGrammarQuiz(h.peek('GRAMMAR_UNITS')[0].id, 4);
      finish(h);
      h.run(findClick(h, /^startGrammarQuiz\('unit1', 4\)$/));
    } },
];

async function fresh(starter) {
  const h = await boot();
  if (starter.seed) await starter.seed(h);
  await starter.start(h);
  assert.truthy(h.sandbox.isGrammarQuizActive(), starter.name + ': a round is live');
  assert.truthy(hasQuestionCard(h), starter.name + ': a question is on screen');
  return h;
}

// ---------------------------------------------------------------------------
// (A) every door asks; Cancel freezes, OK abandons cleanly
// ---------------------------------------------------------------------------

for (const starter of STARTERS) {
  suite('leave guard (A) — ' + starter.name, () => {
    for (const exit of EXITS) {
      test(exit.name + ': asks; Cancel keeps the same question; OK leaves and abandons', async () => {
        const h = await fresh(starter);
        // Get one answer in first, so "state intact" has something to lose.
        answerCurrent(h, true);
        const before = snapshot(h);

        // Cancel — the child stays, exactly where they were.
        h.sandbox.__confirmAnswer = false;
        h.sandbox.__confirmLog.length = 0;
        await exit.go(h);
        assert.equal(h.sandbox.__confirmLog.length, 1, exit.name + ' must ask exactly once (asked ' + h.sandbox.__confirmLog.length + ')');
        assertFrozen(h, before, 'after Cancel');
        assert.equal(activeNavKey(h), 'learn', 'the bottom bar still points at Learn');

        // OK — the round is abandoned, cleanly.
        h.sandbox.__confirmAnswer = true;
        h.sandbox.__confirmLog.length = 0;
        await exit.go(h);
        assert.equal(h.sandbox.__confirmLog.length, 1, exit.name + ' asks once more on the way out');
        assert.falsy(h.sandbox.isGrammarQuizActive(), 'the round is over');
        assert.equal(quiz(h), null, 'no state left behind');
        if (exit.leavesScreen) {
          // (The hidden grammar screen keeps its last paint, like every tab;
          // the return below proves it is repainted before it is seen.)
          assert.falsy(h.el('grammarScreen').classList.contains('active'), 'the grammar screen was left');
          assert.equal(activeNavKey(h), exit.nav, 'the bottom bar moved to ' + exit.nav);
        } else {
          assert.truthy(h.el('grammarScreen').classList.contains('active'), 'still on the grammar tab');
          assert.falsy(hasQuestionCard(h), 'no question left on the grammar screen');
          assert.truthy(hasHomeCards(h), 'back on the grammar home');
          assert.equal(activeNavKey(h), 'learn');
        }
        const nav = h.el('bottomNav');
        assert.equal(nav.style.display, 'flex', 'the bottom bar is showing');
        assert.falsy(nav.classList.contains('hidden'));
        assert.falsy(nav.style.pointerEvents, 'the bottom bar is tappable');
        // The abandoned round was never paid and never recorded.
        assert.equal(h.state().coins, before.coins, 'no coins for an abandoned round');
        assert.equal((h.state().grammarHistory || []).length, before.history, 'nothing written to history');
        // …and the study checkpoint no longer offers it back (the after-tap
        // save ran with no round live → cleared).
        assert.equal(h.store[CHECKPOINT_KEY], undefined, 'the checkpoint was cleared on the way out');
        assert.equal(h.sandbox.buildStudyCheckpoint(), null);

        // (C) the next open of the tab is clean.
        h.sandbox.__confirmLog.length = 0;
        assert.equal(h.sandbox.switchScreen('grammarScreen'), true);
        await settle();
        assert.equal(h.sandbox.__confirmLog.length, 0, 'coming back asks nothing');
        assert.truthy(h.el('grammarScreen').classList.contains('active'));
        assert.falsy(h.sandbox.isGrammarQuizActive(), 'no ghost round on return');
        assert.falsy(hasQuestionCard(h), 'no ghost question on return');
        assert.truthy(hasHomeCards(h), 'the grammar home is what comes up');
        // and leaving again from the home is free
        h.sandbox.__confirmAnswer = false;
        assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'leaving the grammar home needs no confirm');
        assert.equal(h.sandbox.__confirmLog.length, 0);
      });
    }

    test('the grammar tab itself, the Learn hub card and the sub-tabs keep the round (no door there)', async () => {
      const h = await fresh(starter);
      answerCurrent(h, true);
      const before = snapshot(h);
      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      // The Learn hub's Grammar card and the Grammar route both re-enter the
      // same screen; renderGrammarHome keeps a live round rather than
      // discarding it silently.
      assert.equal(h.sandbox.switchScreen('grammarScreen'), true);
      await settle();
      h.sandbox.renderGrammarHome();
      h.sandbox.switchGrammarSubTab('lessons');
      h.sandbox.switchGrammarSubTab('history');
      h.sandbox.switchGrammarSubTab('units');
      assert.equal(h.sandbox.__confirmLog.length, 0, 'none of these is a way out, so none asks');
      const st = quiz(h);
      assert.truthy(st === before.state && st.currentIdx === before.idx, 'the same round, same question');
      assert.deepEqual(st.answers, before.answers);
      assert.truthy(hasQuestionCard(h), 'the question is still what the screen shows');
      assert.falsy(hasHomeCards(h), 'the home did not paint over the question');
    });
  });
}

// ---------------------------------------------------------------------------
// (B) finished: free to leave; (C) paid once, no checkpoint, clean return
// ---------------------------------------------------------------------------

for (const starter of STARTERS) {
  suite('leave guard (B)+(C) — ' + starter.name, () => {
    test('the result card blocks nothing: every door opens with no confirm', async () => {
      for (const exit of EXITS) {
        const h = await fresh(starter);
        finish(h);
        assert.falsy(h.sandbox.isGrammarQuizActive(), 'nothing is "active" once the result card is up');
        h.sandbox.__confirmAnswer = false;      // a confirm here would be answered "stay" — and must not appear
        h.sandbox.__confirmLog.length = 0;
        if (exit.leavesScreen) {
          await exit.go(h);
          assert.equal(h.sandbox.__confirmLog.length, 0, exit.name + ' must not ask after the round is finished');
          assert.falsy(h.el('grammarScreen').classList.contains('active'), exit.name + ' actually left');
          assert.equal(activeNavKey(h), exit.nav, 'the bottom bar moved to ' + exit.nav);
        } else {
          // the in-quiz ✕ Exit is gone from a result card; its doors are
          // Done / Review / Try Again, covered below
          assert.falsy(onclicks(h).some((c) => /confirmExitGrammarQuiz/.test(c)), 'no ✕ Exit on a result card');
        }
        const nav = h.el('bottomNav');
        assert.equal(nav.style.display, 'flex', 'the bottom bar is showing');
        assert.falsy(nav.classList.contains('hidden'));
        assert.falsy(nav.hasAttribute('aria-hidden'));
        assert.falsy(nav.style.pointerEvents);
        assert.equal(h.doc.body.className, '', 'no body class left behind');
        assert.equal(h.doc.documentElement.className, '', 'no html class left behind');
        assert.falsy(h.el('grammarScreen').classList.contains('lazy-css-pending'));
      }
    });

    test('the result card\'s own buttons: Done, Review Answers → Back, Try Again', async () => {
      const h = await fresh(starter);
      finish(h);
      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      // Review Answers → the session view → ‹ Back → home
      tap(h, findClick(h, /^reviewLastGrammarSession\(\)$/));
      assert.truthy(/grammar-review-list/.test(h.el('grammarScreen').innerHTML), 'the review opened');
      tap(h, findClick(h, /^renderGrammarHome\(\)$/));
      assert.truthy(hasHomeCards(h), 'back on the grammar home');
      assert.equal(h.sandbox.__confirmLog.length, 0, 'none of that asked');
      // Try Again → a NEW live round (guarded again), Done → home. Finished
      // with wrong answers so a mistakes round has a bank left to draw on.
      const h2 = await fresh(starter);
      finish(h2, { wrong: true });
      h2.sandbox.__confirmLog.length = 0;
      const again = onclicks(h2).find((c) => /^startGrammarQuiz\(|^startMistakesQuiz\(/.test(c));
      if (again) {
        tap(h2, again);
        assert.truthy(h2.sandbox.isGrammarQuizActive(), 'Try Again starts a fresh round');
        h2.sandbox.__confirmAnswer = false;
        assert.equal(h2.sandbox.switchScreen('homeScreen'), false, 'and that round is guarded like any other');
        assert.equal(h2.sandbox.__confirmLog.length, 1);
        h2.sandbox.__confirmAnswer = true;
        assert.equal(h2.sandbox.switchScreen('homeScreen'), true);
        assert.falsy(h2.sandbox.isGrammarQuizActive());
      }
      const h3 = await fresh(starter);
      finish(h3);
      h3.sandbox.__confirmAnswer = false;
      h3.sandbox.__confirmLog.length = 0;
      tap(h3, findClick(h3, /^renderGrammarHome\(\)$/));          // 🏠 Done
      assert.truthy(hasHomeCards(h3), 'Done lands on the grammar home');
      assert.equal(h3.sandbox.__confirmLog.length, 0);
      assert.equal(h3.sandbox.switchScreen('homeScreen'), true, 'and Home is one tap away, no question asked');
    });

    test('(C) paid exactly once, checkpoint gone, clean return — even after a reload', async () => {
      const h = await fresh(starter);
      const coins0 = h.state().coins;
      const history0 = (h.state().grammarHistory || []).length;
      assert.truthy(h.store[CHECKPOINT_KEY], 'mid-round the checkpoint holds the round (so a reload brings it back)');
      // Answer all but the last, read the bonus the combo has banked, then
      // press through to the result card.
      const total = quiz(h).questions.length;
      while (quiz(h).currentIdx < total - 1) { answerCurrent(h, true); h.sandbox.nextGrammarQuestion(); }
      answerCurrent(h, true);
      const bonus = h.sandbox.petComboState().bonus;
      h.sandbox.nextGrammarQuestion();
      assert.truthy(hasResultCard(h));
      const expected = coins0 + total * 5 + bonus;
      assert.equal(h.state().coins, expected, 'paid score×5 plus the combo bonus, once');
      assert.equal(h.store[CHECKPOINT_KEY], undefined, 'a finished round is not kept in the checkpoint');
      assert.equal((h.state().grammarHistory || []).length, history0 + 1, 'one session recorded');
      // Leave and come back: no ghost, no second payment.
      h.sandbox.__confirmAnswer = false;
      assert.equal(h.sandbox.switchScreen('homeScreen'), true);
      assert.equal(h.sandbox.switchScreen('grammarScreen'), true);
      await settle();
      assert.falsy(h.sandbox.isGrammarQuizActive());
      assert.truthy(hasHomeCards(h));
      assert.equal(h.state().coins, expected, 'coming back paid nothing more');
      assert.equal((h.state().grammarHistory || []).length, history0 + 1);
      // A reload on the same device: the checkpoint has nothing to offer.
      const h2 = mountApp({ storage: Object.assign({}, h.store) });
      h2.sandbox.loginUser('BeNa');
      await h2.sandbox.LazyData.ensure('grammarScreen');
      await settle();
      assert.equal(h2.sandbox.restoreStudyCheckpoint(), false, 'nothing to restore');
      await settle();
      assert.falsy(h2.sandbox.isGrammarQuizActive(), 'no ghost round after a reload');
      assert.truthy(h2.el('homeScreen').classList.contains('active'), 'Home, as after any reload');
      assert.equal(h2.state().coins, expected, 'and the reload paid nothing');
    });
  });
}

// ---------------------------------------------------------------------------
// a round brought back by the study checkpoint is guarded like any other
// ---------------------------------------------------------------------------

suite('leave guard — a round restored from the study checkpoint', () => {
  test('restored mid-quiz: the doors ask, Cancel freezes, OK abandons and clears the checkpoint', async () => {
    const h = await boot();
    h.sandbox.startGrammarQuiz(h.peek('GRAMMAR_UNITS')[0].id, 5);
    answerCurrent(h, true); h.sandbox.nextGrammarQuestion();
    assert.truthy(h.store[CHECKPOINT_KEY]);
    // reload
    const h2 = mountApp({ storage: Object.assign({}, h.store) });
    h2.sandbox.startStudyCheckpointing();
    h2.sandbox.loginUser('BeNa');
    assert.equal(h2.sandbox.restoreStudyCheckpoint(), false, 'waits for the grammar bank first');
    await settle(12);
    assert.truthy(h2.sandbox.isGrammarQuizActive(), 'the round came back');
    assert.truthy(h2.el('grammarScreen').classList.contains('active'));
    assert.equal(quiz(h2).currentIdx, 1, 'on the second question, as left');
    const before = snapshot(h2);
    h2.sandbox.__confirmAnswer = false; h2.sandbox.__confirmLog.length = 0;
    tap(h2, findClick(h2, /^confirmExitGrammarQuiz\(\)$/));
    assert.equal(h2.sandbox.__confirmLog.length, 1);
    assertFrozen(h2, before, 'after Cancel');
    assert.equal(h2.sandbox.switchScreen('homeScreen'), false);
    assertFrozen(h2, before, 'after Cancel on the bottom bar');
    h2.sandbox.__confirmAnswer = true;
    tap(h2, "switchScreen('homeScreen')");
    assert.falsy(h2.sandbox.isGrammarQuizActive());
    assert.equal(h2.store[CHECKPOINT_KEY], undefined, 'abandoned → the checkpoint is gone too');
    assert.equal(h2.state().coins, before.coins, 'unpaid');
    // a second reload has nothing to bring back
    const h3 = mountApp({ storage: Object.assign({}, h2.store) });
    h3.sandbox.loginUser('BeNa');
    assert.equal(h3.sandbox.restoreStudyCheckpoint(), false);
    await settle(12);
    assert.falsy(h3.sandbox.isGrammarQuizActive(), 'no ghost round');
  });
});

// ---------------------------------------------------------------------------
// the lesson view is not an exercise: its back button and links are free
// ---------------------------------------------------------------------------

suite('leave guard — the lesson view', () => {
  test('open a lesson, hop to a sibling, ← All, leave the tab: no confirm anywhere', async () => {
    const h = await boot();
    h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
    h.sandbox.switchGrammarSubTab('lessons');
    const u = h.peek('GRAMMAR_LESSONS')[0];
    h.run(findClick(h, new RegExp("^toggleGrammarLessonUnitExpanded\\('" + u.unitId + "'\\)$")));
    h.run(findClick(h, /^openGrammarLesson\('unit1', '1a'\)$/));
    assert.truthy(/lesson-detail/.test(h.el('grammarScreen').innerHTML));
    h.run(findClick(h, /^openGrammarLesson\('unit1', '1b'\)$/));       // sibling chip
    assert.truthy(/lesson-detail-id">1b</.test(h.el('grammarScreen').innerHTML), 'sibling lesson opened');
    h.run(findClick(h, /^closeGrammarLesson\(\)$/));                    // ← All
    assert.falsy(/lesson-detail/.test(h.el('grammarScreen').innerHTML), 'back on the lessons list');
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'leaving a lesson page asks nothing');
    assert.equal(h.sandbox.__confirmLog.length, 0);
    assert.falsy(h.sandbox.isGrammarQuizActive());
  });

  test('a drill started from a lesson: ✕ Exit (OK) lands back on that lesson, still free to leave', async () => {
    const h = await boot();
    h.sandbox.switchGrammarSubTab('lessons');
    h.sandbox.openGrammarLesson('unit1', '1a');
    h.run(findClick(h, /^practiceGrammarLesson\('unit1', '1a'\)$/));
    assert.truthy(h.sandbox.isGrammarQuizActive());
    h.sandbox.__confirmAnswer = true; h.sandbox.__confirmLog.length = 0;
    tap(h, findClick(h, /^confirmExitGrammarQuiz\(\)$/));
    assert.equal(h.sandbox.__confirmLog.length, 1);
    assert.falsy(h.sandbox.isGrammarQuizActive());
    assert.truthy(/lesson-detail-id">1a</.test(h.el('grammarScreen').innerHTML), 'back on lesson 1a');
    h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('homeScreen'), true);
    assert.equal(h.sandbox.__confirmLog.length, 0);
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
