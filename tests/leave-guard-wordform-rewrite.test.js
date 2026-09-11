// leave-guard-wordform-rewrite.test.js — every way OUT of a Word form or a
// Rewrite round, driven the way a child drives it.
//
// The rule, for each activity on wordformScreen and rewriteScreen:
//   (A) while the round is in progress, every exit — the five bottom-nav
//       buttons (Home / Eng / Arena / Math / Exam), the ✕ on the question card,
//       a Daily Task deep link — asks confirm() first. Cancel keeps the child
//       on the SAME question with the same answers, and a half-typed answer
//       still in the box. OK leaves: state nulled, checkpoint cleared, screen
//       switched, nav still there.
//   (B) once the result screen is up, leaving asks NOTHING and nothing blocks
//       it: the nav is visible and enabled, no hidden/overlay/body-class
//       residue, no stale "active" flag that makes switchScreen ask again.
//   (C) the next open of the tab is the practice home — no ghost round, no
//       second payout, no checkpoint offering the finished round back.
//
// Nothing here reads source text. The app is booted from index.html by
// tests/verify/client.js, a child is logged in, and every tap is the onclick
// the screen actually rendered.
const { suite, test, assert } = require('./harness');
const { mountApp, loginTestUser } = require('./verify/client.js');

const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n) => { for (let i = 0; i < (n || 4); i++) await tick(); };

const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';
const NAV = ['home', 'learn', 'arena', 'math', 'exam'];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function boot(overrides) {
  const h = mountApp();
  assert.deepEqual(h.loadErrors, [], 'the app must boot cleanly');
  loginTestUser(h, Object.assign({ coins: 100 }, overrides || {}));
  return h;
}

function navButton(h, key) {
  const btn = h.doc.querySelector('#bottomNav button[data-nav-key="' + key + '"]');
  assert.truthy(btn, 'the bottom bar has a ' + key + ' button');
  return btn;
}

// The onclick attribute a rendered button carries, run through the same
// inline runner a tap uses — so what the test taps is what the child taps.
function findButton(h, screenId, pattern) {
  const nodes = h.el(screenId).querySelectorAll('[onclick]');
  const hit = nodes.find((n) => pattern.test(n.getAttribute('onclick') || ''));
  return hit || null;
}
function tap(h, screenId, pattern, what) {
  const btn = findButton(h, screenId, pattern);
  assert.truthy(btn, what + ' is on screen (' + pattern + ')');
  btn.click();
  return btn;
}

// The study checkpoint (js/app.js) must not be holding a round that is over.
// Asserted as a yes/no so a failure names the rule instead of printing the
// whole serialised round.
function noCheckpoint(h, label) {
  const raw = h.store[CHECKPOINT_KEY];
  let kind = null;
  try { kind = raw ? JSON.parse(raw).kind : null; } catch (e) { kind = 'unreadable'; }
  assert.equal(kind, null, label + ' — a "' + kind + '" checkpoint is still stored');
}

function activeScreen(h) {
  const s = h.doc.querySelector('.screen.active');
  return s ? s.id : null;
}

function armConfirm(h, answer) {
  h.sandbox.__confirmAnswer = answer;
  h.sandbox.__confirmLog.length = 0;
  return h.sandbox.__confirmLog;
}

// (B)'s "nothing blocks the way out": the nav is there and tappable, and
// nothing about the screen or the document says otherwise.
function assertNothingBlocks(h, screenId) {
  const nav = h.el('bottomNav');
  assert.truthy(nav, 'bottomNav exists');
  assert.truthy(nav.style.display !== 'none', 'the bottom nav must be visible, not display:none');
  assert.falsy(nav.hidden, 'the bottom nav must not carry the hidden attribute');
  assert.truthy(nav.style.pointerEvents !== 'none', 'the bottom nav must accept taps');
  for (const key of NAV) assert.falsy(navButton(h, key).disabled, 'nav ' + key + ' is enabled');
  const screen = h.el(screenId);
  assert.truthy(screen.classList.contains('active'), screenId + ' is the active screen');
  assert.falsy(screen.hidden, screenId + ' is not hidden');
  assert.truthy(screen.style.pointerEvents !== 'none', screenId + ' accepts taps');
  const body = h.doc.body;
  const bodyClasses = body && body.className ? body.className.split(/\s+/).filter(Boolean) : [];
  const leftover = bodyClasses.filter((c) => /lock|modal|overlay|noscroll|no-scroll|busy|quiz|exam/i.test(c));
  assert.deepEqual(leftover, [], 'no leftover body class');
  // Overlays that other features raise: none may be left up over this tab.
  for (const id of ['speedGameOverlay', 'wotdOverlay', 'lessonScreen']) {
    const el = h.el(id);
    if (el) assert.falsy(el.classList.contains('active'), id + ' must not sit over the result screen');
  }
}

// A snapshot of what "the same place" means, so Cancel can be held to it.
function snapshot(h, stateName, inputId) {
  const st = h.peek(stateName);
  const input = inputId ? h.el(inputId) : null;
  return {
    idx: st ? st.idx : null,
    answers: st ? JSON.stringify(st.answers) : null,
    nQuestions: st ? st.questions.length : null,
    draft: input ? input.value : null,
    firstQuestionId: st ? st.questions[0].id : null,
  };
}
function assertSamePlace(h, before, stateName, inputId, screenId, label) {
  const after = snapshot(h, stateName, inputId);
  assert.truthy(h.peek(stateName), label + ': the round is still there');
  assert.equal(after.idx, before.idx, label + ': same question index');
  assert.equal(after.answers, before.answers, label + ': same answers');
  assert.equal(after.nQuestions, before.nQuestions, label + ': same question list');
  assert.equal(after.firstQuestionId, before.firstQuestionId, label + ': same round (not restarted)');
  assert.equal(activeScreen(h), screenId, label + ': still on ' + screenId);
  if (inputId) {
    assert.truthy(h.el(inputId), label + ': the answer box is still on screen');
    assert.equal(after.draft, before.draft, label + ': the half-typed answer is still in the box');
  }
}

// Drive every exit route with Cancel, then prove the child is exactly where
// they were. `inputId` is the typed box currently on screen (or null).
function assertEveryExitAsks(h, cfg, inputId) {
  const { screenId, stateName, quitPattern, isActive } = cfg;
  const before = snapshot(h, stateName, inputId);
  const routes = [];
  for (const key of NAV) {
    const log = armConfirm(h, false);
    navButton(h, key).click();
    assert.equal(log.length, 1, 'nav ' + key + ' must ask exactly once — got ' + log.length + ': ' + JSON.stringify(log));
    assert.truthy(isActive(h), 'nav ' + key + ': Cancel keeps the round running');
    assertSamePlace(h, before, stateName, inputId, screenId, 'nav ' + key);
    routes.push('nav:' + key);
  }
  // The ✕ on the question card, as rendered.
  {
    const log = armConfirm(h, false);
    tap(h, screenId, quitPattern, 'the ✕ on the question card');
    assert.equal(log.length, 1, 'the ✕ must ask — got ' + log.length);
    assert.truthy(isActive(h), '✕: Cancel keeps the round running');
    assertSamePlace(h, before, stateName, inputId, screenId, '✕');
    routes.push('✕');
  }
  // A Daily Task deep link into ANOTHER tab goes through switchScreen too.
  {
    const log = armConfirm(h, false);
    const DailyTask = h.peek('DailyTask');
    assert.truthy(DailyTask && typeof DailyTask.go === 'function', 'DailyTask.go exists');
    let result;
    DailyTask.go(cfg.otherDeepLink).then((r) => { result = r; });
    return settle().then(() => {
      assert.equal(result, false, 'the deep link must report it did not go');
      assert.equal(log.length, 1, 'the deep link must ask — got ' + log.length);
      assert.truthy(isActive(h), 'deep link: Cancel keeps the round running');
      assertSamePlace(h, before, stateName, inputId, screenId, 'deep link');
      routes.push('deeplink:' + cfg.otherDeepLink);
      // The direct calls the buttons make, once more, so a future change to the
      // markup that bypasses switchScreen still fails here.
      for (const target of ['homeScreen', 'learnHubScreen', 'mathHubScreen', 'examScreen']) {
        const log2 = armConfirm(h, false);
        assert.equal(h.sandbox.switchScreen(target), false, 'switchScreen(' + target + ') refuses on Cancel');
        assert.equal(log2.length, 1, 'switchScreen(' + target + ') asks');
      }
      return routes;
    });
  }
}

// Leave for real through `route`, then prove the round is gone for good.
function assertLeaveAbandons(h, cfg, route) {
  const { screenId, stateName, isActive } = cfg;
  const log = armConfirm(h, true);
  if (route.nav) navButton(h, route.nav).click();
  else if (route.quit) tap(h, screenId, cfg.quitPattern, 'the ✕');
  assert.equal(log.length, 1, route.label + ': asked once before leaving');
  assert.falsy(isActive(h), route.label + ': the round is over');
  assert.equal(h.peek(stateName), null, route.label + ': state is nulled');
  assert.falsy(h.peek('_retryDrill'), route.label + ': no drill left standing');
  noCheckpoint(h, route.label + ': the checkpoint is cleared at once');
  if (route.nav) assert.truthy(activeScreen(h) !== screenId, route.label + ': the screen changed');
  else assert.equal(activeScreen(h), screenId, route.label + ': the ✕ stays on the tab');
  assert.truthy(h.el('bottomNav').style.display !== 'none', route.label + ': the nav is still there');
  // And after that, nothing asks any more.
  const log2 = armConfirm(h, false);
  assert.equal(h.sandbox.switchScreen('homeScreen'), true, route.label + ': the next switch is free');
  assert.equal(log2.length, 0, route.label + ': …and asks nothing');
}

// (C): reopen the tab the way the nav does and expect the practice home.
function assertCleanReopen(h, cfg) {
  const { screenId, stateName, homeMarker, questionMarker, isActive } = cfg;
  const log = armConfirm(h, false);
  h.sandbox.switchScreen('homeScreen');
  assert.equal(h.sandbox.switchScreen(screenId), true, 'the tab opens');
  assert.equal(log.length, 0, 'opening the tab asks nothing');
  assert.falsy(isActive(h), 'no round is running');
  assert.equal(h.peek(stateName), null, 'no ghost round');
  const html = h.el(screenId).innerHTML;
  assert.truthy(homeMarker.test(html), 'the practice home is drawn');
  assert.falsy(questionMarker.test(html), 'no question card is drawn');
  noCheckpoint(h, 'no checkpoint offers a round back');
}

// ---------------------------------------------------------------------------
// Word form
// ---------------------------------------------------------------------------

const WF = {
  screenId: 'wordformScreen',
  stateName: '_wfQuiz',
  quitPattern: /^quitWordformQuiz\(\)$/,
  isActive: (h) => h.sandbox.isWordformQuizActive(),
  otherDeepLink: 'rewrite',
  homeMarker: /startWordformQuiz\(20\)/,
  questionMarker: /quitWordformQuiz\(\)|wfTextInput|answerWfQuestion\(/,
};

async function openWordform(h) {
  h.sandbox.switchScreen('wordformScreen'); await settle();
  assert.truthy(h.sandbox.wordformBank().length > 0, 'the bank arrived');
}

// The typed box on screen right now, if the current question has one.
function wfInputId(h) { return h.el('wfTextInput') ? 'wfTextInput' : null; }

// Answer the question on screen through its rendered controls. `right` picks
// the model answer or a wrong one. Follow-up screens are answered right.
function wfAnswerCurrent(h, right) {
  const st = h.peek('_wfQuiz');
  const q = st.questions[st.idx];
  if (q.followup) {
    for (const part of h.sandbox.wfFollowParts(q)) {
      const btns = h.el('wordformScreen').querySelectorAll('.grammar-option');
      assert.truthy(btns.length > 0, 'follow-up options are drawn');
      const want = right ? q[part].correct : (q[part].correct + 1) % q[part].options.length;
      tap(h, 'wordformScreen', new RegExp("^answerWfFollowup\\('" + part + "'," + want + "\\)$"), 'follow-up option');
    }
    return;
  }
  if (q.type === 'text') {
    const input = h.el('wfTextInput');
    assert.truthy(input, 'a typed question offers a text box');
    input.value = right ? q.answer : 'zzz-not-a-word';
    tap(h, 'wordformScreen', /^submitWfText\(\)$/, 'Check');
  } else {
    const want = right ? q.correct : (q.correct + 1) % q.options.length;
    tap(h, 'wordformScreen', new RegExp('^answerWfQuestion\\(' + want + '\\)$'), 'an option');
  }
  const a = st.answers[st.idx];
  assert.truthy(a, 'the answer registered');
  assert.equal(!!a.isCorrect, !!right, 'graded as ' + (right ? 'right' : 'wrong'));
}

// Tap Next the way the child must: the 🔊 gate first where there is one.
// (The gate unlocks Next through closest()/parentNode, which the DOM shim
// does not model; the gate itself is another test's subject — here it is
// tapped, and Next is tapped after it.)
function wfNext(h) {
  const gate = findButton(h, 'wordformScreen', /^hearAnswer\(this\)$/);
  if (gate) gate.click();
  const next = findButton(h, 'wordformScreen', /^nextWfQuestion\(\)$/);
  assert.truthy(next, 'a Next button is drawn');
  next.click();
}

// Play a round to the result screen. `wrongEvery` makes every n-th base
// question wrong (0 = all right).
function wfPlayToEnd(h, wrongEvery) {
  const st = h.peek('_wfQuiz');
  let baseSeen = 0;
  const total = st.questions.length;
  for (let guard = 0; guard < total + 2 && h.peek('_wfQuiz'); guard++) {
    const cur = h.peek('_wfQuiz');
    const q = cur.questions[cur.idx];
    const a = cur.answers[cur.idx];
    const done = q.followup ? h.sandbox.wfFollowDone(q, a || {}) : a !== null;
    if (!done) {
      let right = true;
      if (!q.followup) { baseSeen++; right = !(wrongEvery && baseSeen % wrongEvery === 0); }
      wfAnswerCurrent(h, right);
    }
    wfNext(h);
  }
  assert.falsy(h.peek('_wfQuiz'), 'the round finished');
}

suite('Word form — quick practice (A): every exit asks, Cancel keeps the place', () => {
  test('at the first question, nothing answered: the nav and deep links ask; the ✕ is free with nothing at stake', async () => {
    const h = await boot();
    await openWordform(h);
    tap(h, 'wordformScreen', /^startWordformQuiz\(20\)$/, 'Quick practice');
    assert.truthy(h.sandbox.isWordformQuizActive(), 'the round started');
    const before = snapshot(h, '_wfQuiz', wfInputId(h));
    for (const key of NAV) {
      const log = armConfirm(h, false);
      navButton(h, key).click();
      assert.equal(log.length, 1, 'nav ' + key + ' asks even before the first answer');
      assertSamePlace(h, before, '_wfQuiz', wfInputId(h), 'wordformScreen', 'nav ' + key);
    }
    // The ✕ with nothing typed and nothing answered: "starting and changing
    // your mind stays free" (tests/quiz-exit-guards.test.js) — and it must
    // leave cleanly.
    const log = armConfirm(h, false);
    tap(h, 'wordformScreen', /^quitWordformQuiz\(\)$/, 'the ✕');
    assert.equal(log.length, 0, 'nothing at stake, nothing asked');
    assert.falsy(h.sandbox.isWordformQuizActive(), 'the round is gone');
    noCheckpoint(h, 'and so is its checkpoint');
    assert.truthy(/startWordformQuiz\(20\)/.test(h.el('wordformScreen').innerHTML), 'back on the practice home');
  });

  test('a half-typed answer on the FIRST question is work: the ✕ asks, Cancel keeps the draft', async () => {
    const h = await boot();
    await openWordform(h);
    h.sandbox.startWordformQuiz(20);
    // Walk to the first typed question through the real handlers.
    let hops = 0;
    while (!h.el('wfTextInput') && hops++ < 40) { wfAnswerCurrent(h, true); wfNext(h); }
    assert.truthy(h.el('wfTextInput'), 'reached a typed question');
    // Reset to "nothing answered" is not possible mid-round, so also cover the
    // pure case: a fresh round whose first question is typed.
    const input = h.el('wfTextInput');
    input.value = 'half-typ';
    const routes = await assertEveryExitAsks(h, WF, 'wfTextInput');
    assert.truthy(routes.length >= 7, 'covered ' + routes.join(', '));
    assert.equal(h.el('wfTextInput').value, 'half-typ', 'the draft survived every Cancel');
  });

  test('fresh round, first question typed, draft only: the ✕ asks and keeps the draft', async () => {
    const h = await boot();
    await openWordform(h);
    // Draw until the first screen is a typed question (the draw is seeded by
    // the clock; a handful of tries is plenty).
    let tries = 0;
    for (;;) {
      h.run('_wfQuiz = null');
      h.sandbox.startWordformQuiz(10);
      if (h.el('wfTextInput')) break;
      assert.truthy(tries++ < 500, 'no typed first question in 500 draws');
    }
    assert.equal(h.sandbox.wfAnsweredCount(), 0, 'nothing answered yet');
    h.el('wfTextInput').value = 'educ';
    const log = armConfirm(h, false);
    tap(h, 'wordformScreen', /^quitWordformQuiz\(\)$/, 'the ✕');
    assert.equal(log.length, 1, 'the ✕ asks about a half-typed answer');
    assert.truthy(h.sandbox.isWordformQuizActive(), 'Cancel keeps the round');
    assert.equal(h.el('wfTextInput').value, 'educ', 'the draft is still there');
    armConfirm(h, true);
    tap(h, 'wordformScreen', /^quitWordformQuiz\(\)$/, 'the ✕');
    assert.falsy(h.sandbox.isWordformQuizActive(), 'OK ends it');
    noCheckpoint(h, 'checkpoint cleared');
  });

  test('mid-round on a base question, on a follow-up check, and after an answer is revealed: every exit asks', async () => {
    const h = await boot();
    await openWordform(h);
    tap(h, 'wordformScreen', /^startWordformQuiz\(10\)$/, 'Short practice');
    // 1. answer the first base question, then (revealed answer on screen) test.
    wfAnswerCurrent(h, true);
    assert.truthy(h.sandbox.wfAnsweredCount() > 0, 'one answer given');
    await assertEveryExitAsks(h, WF, null);
    // 2. move on to its understanding check (follow-up) and test there.
    wfNext(h);
    const st = h.peek('_wfQuiz');
    assert.truthy(st.questions[st.idx].followup, 'the understanding check follows');
    await assertEveryExitAsks(h, WF, null);
    // Half of the check answered: state is a partial object.
    const q = st.questions[st.idx];
    const parts = h.sandbox.wfFollowParts(q);
    tap(h, 'wordformScreen', new RegExp("^answerWfFollowup\\('" + parts[0] + "'," + q[parts[0]].correct + "\\)$"), 'first check option');
    await assertEveryExitAsks(h, WF, null);
    // 3. the rest of the check, then the next base question with a draft if typed.
    for (const part of parts.slice(1)) {
      tap(h, 'wordformScreen', new RegExp("^answerWfFollowup\\('" + part + "'," + q[part].correct + "\\)$"), 'check option');
    }
    wfNext(h);
    const inputId = wfInputId(h);
    if (inputId) h.el(inputId).value = 'partial';
    await assertEveryExitAsks(h, WF, inputId);
    // 4. finally leave through each nav button (fresh round each time) and the ✕.
    for (const route of [{ nav: 'home', label: 'Home' }, { nav: 'learn', label: 'Eng' }, { nav: 'math', label: 'Math' }, { nav: 'exam', label: 'Exam' }, { quit: true, label: '✕' }]) {
      if (!h.sandbox.isWordformQuizActive()) {
        h.sandbox.switchScreen('wordformScreen'); await settle();
        h.sandbox.startWordformQuiz(10);
        wfAnswerCurrent(h, true);
      }
      assertLeaveAbandons(h, WF, route);
    }
  });

  test('Arena (openPetBattle) while a round runs: asks, Cancel stays, OK leaves', async () => {
    const h = await boot();
    await openWordform(h);
    h.sandbox.startWordformQuiz(10);
    wfAnswerCurrent(h, true);
    const before = snapshot(h, '_wfQuiz', null);
    let log = armConfirm(h, false);
    await h.sandbox.openPetBattle();
    assert.equal(log.length, 1, 'the Arena button asks');
    assertSamePlace(h, before, '_wfQuiz', null, 'wordformScreen', 'Arena/Cancel');
    log = armConfirm(h, true);
    await h.sandbox.openPetBattle(); await settle(8);
    assert.equal(log.length, 1, 'asked once');
    assert.falsy(h.sandbox.isWordformQuizActive(), 'OK ends the round');
    noCheckpoint(h, 'checkpoint cleared');
    assert.truthy(activeScreen(h) !== 'wordformScreen', 'left the tab');
  });
});

suite('Word form — quick practice (B)+(C): finished means free', () => {
  test('result screen: no confirm, nothing blocks, next open is clean, coins paid once', async () => {
    const h = await boot({ coins: 100 });
    await openWordform(h);
    tap(h, 'wordformScreen', /^startWordformQuiz\(10\)$/, 'Short practice');
    const histBefore = h.sandbox.wordformHistory().length;
    wfPlayToEnd(h, 3);                       // some wrong, so the owed banner appears too
    const coinsAfter = h.state().coins;
    assert.truthy(coinsAfter > 100, 'the round paid out');
    assert.equal(h.sandbox.wordformHistory().length, histBefore + 1, 'one session saved');
    assert.falsy(h.sandbox.isWordformQuizActive(), 'no round is active on the result screen');
    assert.truthy(/renderWordformHome\(\)/.test(h.el('wordformScreen').innerHTML), 'the result screen has its ‹ back button');
    assertNothingBlocks(h, 'wordformScreen');
    noCheckpoint(h, 'the finished round is not checkpointed');

    // (B) each nav button leaves with no question asked.
    for (const key of NAV) {
      if (key === 'arena') continue;          // async placeholder — covered below
      h.sandbox.switchScreen('wordformScreen'); await settle();
      const log = armConfirm(h, false);
      navButton(h, key).click();
      assert.equal(log.length, 0, 'nav ' + key + ' asks nothing after the result');
      assert.truthy(activeScreen(h) !== 'wordformScreen', 'nav ' + key + ' actually left');
    }
    h.sandbox.switchScreen('wordformScreen'); await settle();
    {
      const log = armConfirm(h, false);
      await h.sandbox.openPetBattle(); await settle(8);
      assert.equal(log.length, 0, 'Arena asks nothing after the result');
      assert.truthy(activeScreen(h) !== 'wordformScreen', 'Arena actually left');
    }
    // The in-screen ‹ on the result page.
    h.sandbox.switchScreen('wordformScreen'); await settle();
    // (C) reopening shows the home, not the result and not a question.
    assertCleanReopen(h, WF);
    assert.equal(h.state().coins, coinsAfter, 'reopening pays nothing more');
    assert.equal(h.sandbox.wordformHistory().length, histBefore + 1, 'and writes no second session');
    // finishWordformQuiz called again is a no-op (no double payout).
    h.sandbox.finishWordformQuiz();
    assert.equal(h.state().coins, coinsAfter, 'a second finish pays nothing');
  });

  test('the ‹ on the result screen goes home with no question', async () => {
    const h = await boot();
    await openWordform(h);
    h.sandbox.startWordformQuiz(10);
    wfPlayToEnd(h, 0);
    const log = armConfirm(h, false);
    const back = h.el('wordformScreen').querySelector('.grammar-back-btn');
    assert.truthy(back && /renderWordformHome\(\)/.test(back.getAttribute('onclick')), 'the result ‹ renders the home');
    back.click();
    assert.equal(log.length, 0, 'asked nothing');
    assert.truthy(/startWordformQuiz\(20\)/.test(h.el('wordformScreen').innerHTML), 'the practice home is back');
    assert.falsy(h.sandbox.isWordformQuizActive());
  });
});

suite('Word form — review quiz and re-practice (A)(B)(C)', () => {
  async function seedWrong(h) {
    // A finished round with wrong answers gives the review panel and the
    // owed drill something to show. Clear the owed queue so the review CTA
    // (hidden while questions are owed) can be tapped.
    h.sandbox.startWordformQuiz(10);
    wfPlayToEnd(h, 2);
    for (const q of h.sandbox.retryList('wf')) h.sandbox.retryClear('wf', q.id);
    assert.equal(h.sandbox.retryCount('wf'), 0, 'nothing owed');
    h.sandbox.renderWordformHome();
  }

  test('Practice wrong answers: every exit asks; finishing frees the tab', async () => {
    const h = await boot();
    await openWordform(h);
    await seedWrong(h);
    tap(h, 'wordformScreen', /^startWordformReviewQuiz\(/, 'Practice wrong answers');
    assert.truthy(h.sandbox.isWordformQuizActive(), 'the review round started');
    // A typed first question: a draft is work, so every exit asks. (An MCQ
    // first question with nothing answered has nothing at stake — the ✕ is
    // free there by design; the nav still asks, checked below.)
    const inputId = wfInputId(h);
    if (inputId) {
      h.el(inputId).value = 'dra';
      await assertEveryExitAsks(h, WF, inputId);
    } else {
      const before = snapshot(h, '_wfQuiz', null);
      const log = armConfirm(h, false);
      navButton(h, 'home').click();
      assert.equal(log.length, 1, 'the nav asks before the first answer');
      assertSamePlace(h, before, '_wfQuiz', null, 'wordformScreen', 'nav home');
    }
    wfAnswerCurrent(h, true);
    await assertEveryExitAsks(h, WF, null);
    const coins = h.state().coins;
    wfPlayToEnd(h, 0);
    assert.truthy(h.state().coins > coins, 'the review round pays');
    assertNothingBlocks(h, 'wordformScreen');
    const log = armConfirm(h, false);
    navButton(h, 'home').click();
    assert.equal(log.length, 0, 'leaving the result asks nothing');
    assertCleanReopen(h, WF);
  });

  test('Re-practice from a past session (openWfSession): the session view is free; the round it starts is guarded', async () => {
    const h = await boot();
    await openWordform(h);
    await seedWrong(h);
    tap(h, 'wordformScreen', /^openWfSession\(0\)$/, 'the newest history row');
    assert.falsy(h.sandbox.isWordformQuizActive(), 'a read-only session is not a round');
    let log = armConfirm(h, false);
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'leaving a session view is free');
    assert.equal(log.length, 0);
    h.sandbox.switchScreen('wordformScreen'); await settle();
    tap(h, 'wordformScreen', /^openWfSession\(0\)$/, 'the newest history row');
    tap(h, 'wordformScreen', /^startWordformReviewQuiz\(/, 'Re-practice these');
    assert.truthy(h.sandbox.isWordformQuizActive(), 'the re-practice round started');
    wfAnswerCurrent(h, false);
    await assertEveryExitAsks(h, WF, null);
    assertLeaveAbandons(h, WF, { nav: 'learn', label: 'Eng' });
    assertCleanReopen(h, WF);
  });
});

suite('Word form — owed-questions drill (startWfRetry)', () => {
  test('the drill: the bottom bar asks, Cancel keeps the item and the draft, OK leaves; the ✕ closes it cleanly', async () => {
    const h = await boot();
    await openWordform(h);
    h.sandbox.startWordformQuiz(10);
    wfPlayToEnd(h, 2);
    assert.truthy(h.sandbox.retryCount('wf') > 0, 'questions are owed');
    tap(h, 'wordformScreen', /^startRetryDrill\('wf'\)$/, 'Luyện lại … câu sai');
    assert.truthy(h.sandbox.isRetryDrillActive() && h.sandbox.retryDrillKey() === 'wf', 'the drill runs');
    assert.truthy(h.el('retryInput'), 'a typed box is on screen');
    h.el('retryInput').value = 'half';
    const owed = h.sandbox.retryCount('wf');
    const item = h.peek('_retryDrill').queue[0];
    for (const key of NAV) {
      const log = armConfirm(h, false);
      navButton(h, key).click();
      assert.equal(log.length, 1, 'nav ' + key + ' asks during the drill');
      assert.truthy(h.sandbox.isRetryDrillActive(), 'nav ' + key + ': Cancel keeps the drill');
      assert.equal(h.peek('_retryDrill').queue[0], item, 'nav ' + key + ': same item');
      assert.equal(activeScreen(h), 'wordformScreen', 'nav ' + key + ': still on the tab');
      assert.equal(h.el('retryInput').value, 'half', 'nav ' + key + ': the draft survived');
    }
    // OK leaves; the owed queue is the child's homework and stays.
    const log = armConfirm(h, true);
    navButton(h, 'home').click();
    assert.equal(log.length, 1, 'asked once');
    assert.falsy(h.sandbox.isRetryDrillActive(), 'the drill is gone');
    assert.equal(activeScreen(h), 'homeScreen', 'on Home');
    assert.equal(h.sandbox.retryCount('wf'), owed, 'what was owed is still owed');
    // Back on the tab: the home with the owed banner, nothing asked.
    const log2 = armConfirm(h, false);
    h.sandbox.switchScreen('wordformScreen'); await settle();
    assert.equal(log2.length, 0);
    assert.truthy(/startRetryDrill\('wf'\)/.test(h.el('wordformScreen').innerHTML), 'the owed banner is back');
    // The drill's own ✕ (quitRetryDrill): an untouched drill closes without a
    // question — it asks only once an item has been answered this session,
    // like every quiz's ✕ — and must leave nothing running.
    tap(h, 'wordformScreen', /^startRetryDrill\('wf'\)$/, 'the drill');
    const log3 = armConfirm(h, false);
    tap(h, 'wordformScreen', /^quitRetryDrill\('wf'\)$/, 'the drill ✕');
    assert.equal(log3.length, 0, 'the drill ✕ is free (nothing but the item on screen is lost)');
    assert.falsy(h.sandbox.isRetryDrillActive(), 'nothing left running');
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'and the nav is free afterwards');
    assert.equal(h.sandbox.__confirmLog.length, 0);
  });

  test('finishing the drill frees the tab', async () => {
    const h = await boot();
    await openWordform(h);
    h.sandbox.startWordformQuiz(10);
    wfPlayToEnd(h, 2);
    tap(h, 'wordformScreen', /^startRetryDrill\('wf'\)$/, 'the drill');
    let guard = 0;
    while (h.sandbox.isRetryDrillActive() && guard++ < 40) {
      const st = h.peek('_retryDrill');
      if (!st.answered) {
        const item = st.queue[st.idx % st.queue.length];
        h.el('retryInput').value = item.answer;
        tap(h, 'wordformScreen', /^submitRetryAnswer\(\)$/, 'Check');
      } else {
        tap(h, 'wordformScreen', /^nextRetryQuestion\(\)$/, 'Next');
      }
    }
    assert.falsy(h.sandbox.isRetryDrillActive(), 'the drill finished');
    assert.equal(h.sandbox.retryCount('wf'), 0, 'nothing owed');
    assertNothingBlocks(h, 'wordformScreen');
    const log = armConfirm(h, false);
    for (const key of ['home', 'learn', 'math', 'exam']) {
      h.sandbox.switchScreen('wordformScreen'); await settle();
      navButton(h, key).click();
      assert.truthy(activeScreen(h) !== 'wordformScreen', 'nav ' + key + ' left');
    }
    assert.equal(log.length, 0, 'nothing asked after the drill finished');
    assertCleanReopen(h, WF);
  });
});

suite('Word form — what is NOT a round: Lessons and a lesson page leave freely', () => {
  test('Lessons sub-tab and openWordformLesson never count as in progress', async () => {
    const h = await boot();
    await openWordform(h);
    tap(h, 'wordformScreen', /^switchWfSubTab\('lessons'\)$/, 'Lessons');
    assert.falsy(h.sandbox.isWordformQuizActive(), 'the lessons list is not a round');
    const lessonBtn = findButton(h, 'wordformScreen', /^openWordformLesson\(/);
    assert.truthy(lessonBtn, 'there is at least one lesson');
    lessonBtn.click();
    assert.falsy(h.sandbox.isWordformQuizActive(), 'a lesson page is not a round');
    assert.truthy(/renderWordformHome\(\)/.test(h.el('wordformScreen').innerHTML), 'the lesson has its ← back');
    noCheckpoint(h, 'no checkpoint for a lesson');
    for (const key of NAV) {
      if (key === 'arena') continue;
      h.sandbox.switchScreen('wordformScreen'); await settle();
      lessonBtn.click();
      const log = armConfirm(h, false);
      navButton(h, key).click();
      assert.equal(log.length, 0, 'nav ' + key + ' asks nothing on a lesson page');
      assert.truthy(activeScreen(h) !== 'wordformScreen', 'nav ' + key + ' left');
    }
    h.sandbox.switchScreen('wordformScreen'); await settle();
    lessonBtn.click();
    const log = armConfirm(h, false);
    tap(h, 'wordformScreen', /^renderWordformHome\(\)$/, 'the lesson ←');
    assert.equal(log.length, 0);
    assert.truthy(/switchWfSubTab\('practice'\)/.test(h.el('wordformScreen').innerHTML), 'back on the tab home');
  });
});

// ---------------------------------------------------------------------------
// Rewrite
// ---------------------------------------------------------------------------

const RW = {
  screenId: 'rewriteScreen',
  stateName: '_rwQuiz',
  quitPattern: /^quitRewriteQuiz\(\)$/,
  isActive: (h) => h.sandbox.isRewriteQuizActive(),
  otherDeepLink: 'wordform',
  homeMarker: /startRewriteQuiz\(10\)/,
  questionMarker: /quitRewriteQuiz\(\)|rwTextInput/,
};

async function openRewrite(h) {
  h.sandbox.switchScreen('rewriteScreen'); await settle();
  assert.truthy(h.sandbox.rewriteBank().length > 0, 'the bank arrived');
}

function rwAnswerCurrent(h, right) {
  const st = h.peek('_rwQuiz');
  const q = st.questions[st.idx];
  const input = h.el('rwTextInput');
  assert.truthy(input, 'the sentence box is on screen');
  input.value = right ? q.answer : 'qqqq wrong sentence qqqq';
  tap(h, 'rewriteScreen', /^submitRwText\(\)$/, 'Check');
  const a = st.answers[st.idx];
  assert.truthy(a, 'the answer registered');
  assert.equal(!!a.isCorrect, !!right, 'graded as ' + (right ? 'right' : 'wrong'));
}
function rwNext(h) { tap(h, 'rewriteScreen', /^nextRwQuestion\(\)$/, 'Next'); }
function rwPlayToEnd(h, wrongEvery) {
  let n = 0;
  for (let guard = 0; guard < 30 && h.peek('_rwQuiz'); guard++) {
    n++;
    rwAnswerCurrent(h, !(wrongEvery && n % wrongEvery === 0));
    rwNext(h);
  }
  assert.falsy(h.peek('_rwQuiz'), 'the round finished');
}

suite('Rewrite — quick practice (A): every exit asks, Cancel keeps the place and the draft', () => {
  test('first question, nothing answered: the nav asks; a half-typed sentence makes the ✕ ask too', async () => {
    const h = await boot();
    await openRewrite(h);
    tap(h, 'rewriteScreen', /^startRewriteQuiz\(10\)$/, 'Quick practice');
    assert.truthy(h.sandbox.isRewriteQuizActive(), 'the round started');
    assert.truthy(h.el('rwTextInput'), 'every Rewrite question is typed');
    // Empty box: the nav asks, the ✕ is free (nothing at stake) — see
    // tests/quiz-exit-guards.test.js.
    const before = snapshot(h, '_rwQuiz', 'rwTextInput');
    for (const key of NAV) {
      const log = armConfirm(h, false);
      navButton(h, key).click();
      assert.equal(log.length, 1, 'nav ' + key + ' asks before the first answer');
      assertSamePlace(h, before, '_rwQuiz', 'rwTextInput', 'rewriteScreen', 'nav ' + key);
    }
    // Now a draft.
    h.el('rwTextInput').value = 'she had not seen';
    const routes = await assertEveryExitAsks(h, RW, 'rwTextInput');
    assert.truthy(routes.length >= 7, 'covered ' + routes.join(', '));
    assert.equal(h.el('rwTextInput').value, 'she had not seen', 'the draft survived every Cancel');
    // Empty the box again: the ✕ goes back freely and leaves nothing behind.
    h.el('rwTextInput').value = '';
    const log = armConfirm(h, false);
    tap(h, 'rewriteScreen', /^quitRewriteQuiz\(\)$/, 'the ✕');
    assert.equal(log.length, 0, 'nothing at stake, nothing asked');
    assert.falsy(h.sandbox.isRewriteQuizActive());
    noCheckpoint(h, 'checkpoint cleared');
    assert.truthy(/startRewriteQuiz\(10\)/.test(h.el('rewriteScreen').innerHTML), 'back on the practice home');
  });

  test('mid-round (answer revealed, then next question with a draft): every exit asks; each exit abandons cleanly', async () => {
    const h = await boot();
    await openRewrite(h);
    tap(h, 'rewriteScreen', /^startRewriteQuiz\(10\)$/, 'Quick practice');
    rwAnswerCurrent(h, false);
    await assertEveryExitAsks(h, RW, null);
    rwNext(h);
    h.el('rwTextInput').value = 'half a sentence';
    await assertEveryExitAsks(h, RW, 'rwTextInput');
    for (const route of [{ nav: 'home', label: 'Home' }, { nav: 'learn', label: 'Eng' }, { nav: 'math', label: 'Math' }, { nav: 'exam', label: 'Exam' }, { quit: true, label: '✕' }]) {
      if (!h.sandbox.isRewriteQuizActive()) {
        h.sandbox.switchScreen('rewriteScreen'); await settle();
        h.sandbox.startRewriteQuiz(10);
        rwAnswerCurrent(h, true);
      }
      assertLeaveAbandons(h, RW, route);
    }
  });

  test('Arena (openPetBattle) while a round runs: asks, Cancel stays, OK leaves', async () => {
    const h = await boot();
    await openRewrite(h);
    h.sandbox.startRewriteQuiz(10);
    rwAnswerCurrent(h, true);
    const before = snapshot(h, '_rwQuiz', null);
    let log = armConfirm(h, false);
    await h.sandbox.openPetBattle();
    assert.equal(log.length, 1, 'the Arena button asks');
    assertSamePlace(h, before, '_rwQuiz', null, 'rewriteScreen', 'Arena/Cancel');
    log = armConfirm(h, true);
    await h.sandbox.openPetBattle(); await settle(8);
    assert.equal(log.length, 1, 'asked once');
    assert.falsy(h.sandbox.isRewriteQuizActive(), 'OK ends the round');
    noCheckpoint(h, 'checkpoint cleared');
    assert.truthy(activeScreen(h) !== 'rewriteScreen', 'left the tab');
  });
});

suite('Rewrite — (B)+(C): finished means free', () => {
  test('result screen: no confirm, nothing blocks, next open is clean, coins paid once', async () => {
    const h = await boot({ coins: 100 });
    await openRewrite(h);
    tap(h, 'rewriteScreen', /^startRewriteQuiz\(10\)$/, 'Quick practice');
    const histBefore = h.sandbox.rewriteHistory().length;
    rwPlayToEnd(h, 3);
    const coinsAfter = h.state().coins;
    assert.truthy(coinsAfter > 100, 'the round paid out');
    assert.equal(h.sandbox.rewriteHistory().length, histBefore + 1, 'one session saved');
    assert.falsy(h.sandbox.isRewriteQuizActive(), 'no round is active on the result screen');
    assertNothingBlocks(h, 'rewriteScreen');
    noCheckpoint(h, 'the finished round is not checkpointed');
    for (const key of NAV) {
      if (key === 'arena') continue;
      h.sandbox.switchScreen('rewriteScreen'); await settle();
      const log = armConfirm(h, false);
      navButton(h, key).click();
      assert.equal(log.length, 0, 'nav ' + key + ' asks nothing after the result');
      assert.truthy(activeScreen(h) !== 'rewriteScreen', 'nav ' + key + ' actually left');
    }
    h.sandbox.switchScreen('rewriteScreen'); await settle();
    {
      const log = armConfirm(h, false);
      await h.sandbox.openPetBattle(); await settle(8);
      assert.equal(log.length, 0, 'Arena asks nothing after the result');
      assert.truthy(activeScreen(h) !== 'rewriteScreen', 'Arena actually left');
    }
    assertCleanReopen(h, RW);
    assert.equal(h.state().coins, coinsAfter, 'reopening pays nothing more');
    assert.equal(h.sandbox.rewriteHistory().length, histBefore + 1, 'no second session');
    h.sandbox.finishRewriteQuiz();
    assert.equal(h.state().coins, coinsAfter, 'a second finish pays nothing');
  });

  test('the ‹ on the result screen goes home with no question; Re-practice from it is a guarded round', async () => {
    const h = await boot();
    await openRewrite(h);
    h.sandbox.startRewriteQuiz(10);
    rwPlayToEnd(h, 2);
    // The result screen offers "Re-practice these" for the wrong ones. While
    // those are still OWED, that tap is taken over by the owed drill
    // (retryGate) — so pay the debt first to reach the review round itself.
    for (const q of h.sandbox.retryList('rw')) h.sandbox.retryClear('rw', q.id);
    const log = armConfirm(h, false);
    tap(h, 'rewriteScreen', /^startRewriteReviewQuiz\(/, 'Re-practice these');
    assert.equal(log.length, 0, 'starting a review round from the result asks nothing');
    assert.truthy(h.sandbox.isRewriteQuizActive(), 'the review round started');
    h.el('rwTextInput').value = 'dra';
    await assertEveryExitAsks(h, RW, 'rwTextInput');
    rwPlayToEnd(h, 0);
    assertNothingBlocks(h, 'rewriteScreen');
    const back = h.el('rewriteScreen').querySelector('.grammar-back-btn');
    assert.truthy(back && /renderRewriteHome\(\)/.test(back.getAttribute('onclick')), 'the result ‹ renders the home');
    const log2 = armConfirm(h, false);
    back.click();
    assert.equal(log2.length, 0, 'asked nothing');
    assert.truthy(/startRewriteQuiz\(10\)/.test(h.el('rewriteScreen').innerHTML), 'the practice home is back');
    assertCleanReopen(h, RW);
  });
});

suite('Rewrite — review quiz, past session, owed drill, lessons', () => {
  async function seedWrong(h) {
    h.sandbox.startRewriteQuiz(10);
    rwPlayToEnd(h, 2);
    for (const q of h.sandbox.retryList('rw')) h.sandbox.retryClear('rw', q.id);
    assert.equal(h.sandbox.retryCount('rw'), 0, 'nothing owed');
    h.sandbox.renderRewriteHome();
  }

  test('Practice wrong answers from the home panel: guarded while running, free once finished', async () => {
    const h = await boot();
    await openRewrite(h);
    await seedWrong(h);
    tap(h, 'rewriteScreen', /^startRewriteReviewQuiz\(/, 'Practice wrong answers');
    assert.truthy(h.sandbox.isRewriteQuizActive(), 'the review round started');
    rwAnswerCurrent(h, true);
    await assertEveryExitAsks(h, RW, null);
    assertLeaveAbandons(h, RW, { quit: true, label: '✕' });
    assertCleanReopen(h, RW);
  });

  test('openRwSession is read-only and free; Re-practice from it is guarded', async () => {
    const h = await boot();
    await openRewrite(h);
    await seedWrong(h);
    tap(h, 'rewriteScreen', /^openRwSession\(0\)$/, 'the newest history row');
    assert.falsy(h.sandbox.isRewriteQuizActive(), 'a session view is not a round');
    let log = armConfirm(h, false);
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'leaving a session view is free');
    assert.equal(log.length, 0);
    h.sandbox.switchScreen('rewriteScreen'); await settle();
    tap(h, 'rewriteScreen', /^openRwSession\(0\)$/, 'the newest history row');
    tap(h, 'rewriteScreen', /^startRewriteReviewQuiz\(/, 'Re-practice these');
    assert.truthy(h.sandbox.isRewriteQuizActive(), 'the re-practice round started');
    h.el('rwTextInput').value = 'typing…';
    await assertEveryExitAsks(h, RW, 'rwTextInput');
    assertLeaveAbandons(h, RW, { nav: 'math', label: 'Math' });
    assertCleanReopen(h, RW);
  });

  test('the owed drill on rewriteScreen: the bottom bar asks, Cancel keeps item and draft, OK leaves; finishing frees it', async () => {
    const h = await boot();
    await openRewrite(h);
    h.sandbox.startRewriteQuiz(10);
    rwPlayToEnd(h, 2);
    assert.truthy(h.sandbox.retryCount('rw') > 0, 'questions are owed');
    // The Rewrite tab draws no owed banner of its own: the way into its drill
    // is the gate on every start button (retryGate), so tap what the child
    // would — "Re-practice these" on the result, then "Quick practice" on the
    // home — and land in the drill both times.
    const log0 = armConfirm(h, false);
    tap(h, 'rewriteScreen', /^startRewriteReviewQuiz\(/, 'Re-practice these');
    assert.equal(log0.length, 0, 'entering the drill from the result asks nothing');
    assert.truthy(h.sandbox.isRetryDrillActive() && h.sandbox.retryDrillKey() === 'rw', 'the drill runs (retryGate took over)');
    assert.falsy(h.sandbox.isRewriteQuizActive(), 'no review round started behind it');
    h.el('retryInput').value = 'half';
    const item = h.peek('_retryDrill').queue[0];
    for (const key of NAV) {
      const log = armConfirm(h, false);
      navButton(h, key).click();
      assert.equal(log.length, 1, 'nav ' + key + ' asks during the drill');
      assert.truthy(h.sandbox.isRetryDrillActive(), 'nav ' + key + ': Cancel keeps the drill');
      assert.equal(h.peek('_retryDrill').queue[0], item, 'nav ' + key + ': same item');
      assert.equal(h.el('retryInput').value, 'half', 'nav ' + key + ': the draft survived');
    }
    const owed = h.sandbox.retryCount('rw');
    const log = armConfirm(h, true);
    navButton(h, 'exam').click();
    assert.equal(log.length, 1);
    assert.falsy(h.sandbox.isRetryDrillActive(), 'OK ends the drill');
    assert.equal(h.sandbox.retryCount('rw'), owed, 'the homework stays owed');
    // Finish it for real — entered from the home's Quick practice this time.
    h.sandbox.switchScreen('rewriteScreen'); await settle();
    tap(h, 'rewriteScreen', /^startRewriteQuiz\(10\)$/, 'Quick practice (gated into the drill)');
    assert.truthy(h.sandbox.isRetryDrillActive(), 'the drill runs again');
    let guard = 0;
    while (h.sandbox.isRetryDrillActive() && guard++ < 40) {
      const st = h.peek('_retryDrill');
      if (!st.answered) {
        h.el('retryInput').value = st.queue[st.idx % st.queue.length].answer;
        tap(h, 'rewriteScreen', /^submitRetryAnswer\(\)$/, 'Check');
      } else tap(h, 'rewriteScreen', /^nextRetryQuestion\(\)$/, 'Next');
    }
    assert.falsy(h.sandbox.isRetryDrillActive(), 'the drill finished');
    assert.equal(h.sandbox.retryCount('rw'), 0, 'nothing owed');
    assertNothingBlocks(h, 'rewriteScreen');
    const log2 = armConfirm(h, false);
    navButton(h, 'home').click();
    assert.equal(log2.length, 0, 'nothing asked after the drill finished');
    assert.equal(activeScreen(h), 'homeScreen');
    assertCleanReopen(h, RW);
  });

  test('Lessons sub-tab and openRewriteLesson never count as in progress', async () => {
    const h = await boot();
    await openRewrite(h);
    tap(h, 'rewriteScreen', /^switchRwSubTab\('lessons'\)$/, 'Lessons');
    assert.falsy(h.sandbox.isRewriteQuizActive());
    const lessonBtn = findButton(h, 'rewriteScreen', /^openRewriteLesson\(/);
    assert.truthy(lessonBtn, 'there is at least one lesson');
    lessonBtn.click();
    assert.falsy(h.sandbox.isRewriteQuizActive(), 'a lesson page is not a round');
    noCheckpoint(h, 'no checkpoint for a lesson');
    for (const key of ['home', 'learn', 'math', 'exam']) {
      h.sandbox.switchScreen('rewriteScreen'); await settle();
      lessonBtn.click();
      const log = armConfirm(h, false);
      navButton(h, key).click();
      assert.equal(log.length, 0, 'nav ' + key + ' asks nothing on a lesson page');
      assert.truthy(activeScreen(h) !== 'rewriteScreen', 'nav ' + key + ' left');
    }
    h.sandbox.switchScreen('rewriteScreen'); await settle();
    lessonBtn.click();
    const log = armConfirm(h, false);
    tap(h, 'rewriteScreen', /^renderRewriteHome\(\)$/, 'the lesson ←');
    assert.equal(log.length, 0);
    assert.truthy(/switchRwSubTab\('practice'\)/.test(h.el('rewriteScreen').innerHTML), 'back on the tab home');
  });
});

// One tab's round must not make the OTHER tab's guard fire, and a Word form
// round left standing must not leak into a Rewrite deep link and vice versa.
suite('Word form and Rewrite do not confuse each other', () => {
  test('a Word form round is abandoned by OK on a Rewrite deep link, and Rewrite then opens clean', async () => {
    const h = await boot();
    await openWordform(h);
    h.sandbox.startWordformQuiz(10);
    wfAnswerCurrent(h, true);
    const log = armConfirm(h, true);
    const went = await h.peek('DailyTask').go('rewrite');
    await settle(8);
    assert.equal(went, true, 'the deep link went through after OK');
    assert.equal(log.length, 1, 'asked once');
    assert.falsy(h.sandbox.isWordformQuizActive(), 'the Word form round is gone');
    assert.truthy(h.sandbox.isRewriteQuizActive(), 'the Rewrite round the link asked for is running');
    assert.equal(activeScreen(h), 'rewriteScreen');
    // …and that new round is itself guarded.
    const log2 = armConfirm(h, false);
    navButton(h, 'home').click();
    assert.equal(log2.length, 1, 'the Rewrite round asks');
    assert.truthy(h.sandbox.isRewriteQuizActive());
    armConfirm(h, true);
    navButton(h, 'home').click();
    assert.falsy(h.sandbox.isRewriteQuizActive());
    noCheckpoint(h, 'no checkpoint');
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
