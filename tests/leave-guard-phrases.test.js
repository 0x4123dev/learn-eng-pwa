// leave-guard-phrases.test.js — the Phrases tab (phrasesScreen) and its two
// sub-tabs, Prepositions (js/phrases.js) and Collocation (js/collocation.js),
// plus the owed-question drill both share (js/retrydrill.js keys 'phr'/'col'),
// driven the way a child drives them, against three rules:
//
//   (A) while a round is in progress every way OUT asks confirm() first;
//       Cancel leaves the child on the same question with state intact, OK
//       leaves and clears the round;
//   (B) once the result screen is up, leaving works with NO confirm and
//       nothing blocks it — nav visible, no active flag, no leftover overlay;
//   (C) after leaving either way, the next open of the tab is clean: no ghost
//       round, no double coins, no checkpoint offering the round back.
//
// Nothing here reads source text. The app is booted through
// tests/verify/client.js (index.html's real script list in one vm context,
// the real DOM shim, every confirm() answered from __confirmAnswer) and every
// tap is the onclick the screen actually rendered.
//
// The bug a parent reported — "after finishing a Collocation practice the
// child cannot tap out" — reproduces in `the drill's ✕ and its finished
// screen's home button draw the Collocation home` below: with mistakes, the
// result screen's "Practice again" opens the owed drill, whose ✕ and "Về trang
// chính" called renderCollocHome() — a function that RETURNS the sub-tab's
// HTML and draws nothing. Both buttons were dead.
const { suite, test, assert } = require('./harness');
const { mountApp, loginTestUser } = require('./verify/client.js');

const STUDY_CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';
const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n) => { for (let i = 0; i < (n || 6); i++) await tick(); };

// ---- driving the screen the way a finger does --------------------------

async function boot(overrides) {
  const h = mountApp();
  assert.deepEqual(h.loadErrors, [], 'files that threw while loading');
  loginTestUser(h, Object.assign({ coins: 100 }, overrides || {}));
  h.sandbox.__confirmAnswer = true;
  h.sandbox.__confirmLog.length = 0;
  assert.equal(h.sandbox.switchScreen('phrasesScreen'), true);
  await settle();
  assert.truthy(h.sandbox.LazyData.ready('phrasesScreen'), 'the Phrases banks arrived');
  return h;
}

const screen = (h) => h.el('phrasesScreen');
const onclicks = (h) => (screen(h).innerHTML.match(/onclick="[^"]*"/g) || []).map((s) => s.slice(9, -1));

// Tap the FIRST rendered control whose onclick matches. Fails loudly when the
// screen does not offer it — a test that calls a global the screen never
// renders proves nothing about what a child can reach.
function tap(h, re) {
  const btn = screen(h).querySelectorAll('[onclick]').find((el) => re.test(el.getAttribute('onclick') || ''));
  assert.truthy(btn, 'the screen renders no control matching ' + re + ' — has: ' + onclicks(h).join(' | '));
  btn.click();
  return btn;
}
const offers = (h, re) => onclicks(h).some((s) => re.test(s));

// The listen gate: after an answer, Next is disabled until 🔊 is tapped.
function hearThenNext(h, nextRe) {
  const gate = screen(h).querySelector('.answer-gate-btn');
  if (gate) {
    const next = screen(h).querySelector('.grammar-next-btn');
    assert.truthy(next && next.disabled, 'Next is locked until the answer is heard');
    h.sandbox.hearAnswer(gate);
    assert.truthy(gate.closest('.answer-gate').classList.contains('heard'), 'the gate records the listen');
    // (The unlock itself walks gate.parentNode, which the DOM shim does not
    // model; the tap below is the same onclick the unlocked button carries.)
  }
  tap(h, nextRe);
}

function openCollocTab(h) {
  tap(h, /^switchPhrSubTab\('colloc'\)$/);
  assert.truthy(offers(h, /^startCollocPractice\(20\)$/) && offers(h, /^startCollocPractice\(10\)$/),
    'the Collocation sub-tab offers Practice (20) and Quick (10)');
}

function startColloc(h, n) {
  openCollocTab(h);
  tap(h, new RegExp('^startCollocPractice\\(' + n + '\\)$'));
  assert.truthy(h.sandbox.isCollocActive(), 'a Collocation practice is running');
  assert.truthy(offers(h, /^quitCollocPractice\(\)$/), 'the practice screen renders its ✕');
}

function startPhrases(h, n) {
  tap(h, /^switchPhrSubTab\('practice'\)$/);
  tap(h, new RegExp('^startPhrasesQuiz\\(' + n + '\\)$'));
  assert.truthy(h.sandbox.isPhrasesQuizActive(), 'a Phrases practice is running');
  assert.truthy(offers(h, /^quitPhrasesQuiz\(\)$/), 'the practice screen renders its ✕');
}

// Answer the collocation question on screen (right, or wrong when asked) and
// its follow-up check, tapping exactly what the screen shows.
function answerCollocOnScreen(h, wrong) {
  const st = h.peek('_colQuiz');
  const q = st.questions[st.idx];
  if (q.followup) {
    tap(h, new RegExp("^answerCollocFollowup\\('m'," + q.m.correct + '\\)$'));
    tap(h, new RegExp("^answerCollocFollowup\\('r'," + q.r.correct + '\\)$'));
    return;
  }
  if (Array.isArray(q.options) && q.options.length) {
    const pick = wrong ? (q.correct + 1) % q.options.length : q.correct;
    tap(h, new RegExp('^answerCollocChoice\\(' + pick + '\\)$'));
  } else {
    const inp = h.el('colTextInput');
    assert.truthy(inp, 'a typed collocation renders its text box');
    inp.value = wrong ? 'zzz' : q.answer;
    tap(h, /^submitCollocText\(\)$/);
  }
}

// Play a whole Collocation practice to its result screen. `wrongEvery` = 0
// answers everything right (the celebration path).
function playColloc(h, wrongEvery) {
  let n = 0, guard = 0;
  while (h.sandbox.isCollocActive() && guard++ < 400) {
    const st = h.peek('_colQuiz');
    const isBase = !st.questions[st.idx].followup;
    if (isBase) n++;
    answerCollocOnScreen(h, isBase && wrongEvery && n % wrongEvery === 0);
    hearThenNext(h, /^nextCollocQuestion\(\)$/);
  }
  assert.falsy(h.sandbox.isCollocActive(), 'the practice ended');
}

function answerPhrasesOnScreen(h, wrong) {
  const st = h.peek('_phrQuiz');
  const q = st.questions[st.idx];
  if (q.typed) {
    const inp = h.el('phrTextInput');
    assert.truthy(inp, 'a typed preposition renders its text box');
    inp.value = wrong ? 'zzz' : q.answer;
    tap(h, /^submitPhrTextAnswer\(\)$/);
  } else {
    const pick = wrong ? (q.correct + 1) % q.options.length : q.correct;
    tap(h, new RegExp('^answerPhrQuestion\\(' + pick + '\\)$'));
  }
}

function playPhrases(h, wrongEvery) {
  let n = 0, guard = 0;
  while (h.sandbox.isPhrasesQuizActive() && guard++ < 400) {
    const st = h.peek('_phrQuiz');
    const isBase = !st.questions[st.idx].meaning;
    if (isBase) n++;
    answerPhrasesOnScreen(h, isBase && wrongEvery && n % wrongEvery === 0);
    hearThenNext(h, /^nextPhrQuestion\(\)$/);
  }
  assert.falsy(h.sandbox.isPhrasesQuizActive(), 'the practice ended');
}

// One owed item, typed right, from the drill's own screen.
function answerDrillItemRight(h) {
  const st = h.peek('_retryDrill');
  const item = st.queue[st.idx % st.queue.length];
  const cfg = h.sandbox.retryCfg(st.key);
  h.el('retryInput').value = cfg.answerText(item);
  tap(h, /^submitRetryAnswer\(\)$/);
}

// The checkpoint the app would write after this tap's handlers (js/app.js
// schedules it on a click; the harness records timers rather than firing
// them, so it is asked for by hand here).
const checkpoint = (h) => { h.sandbox.saveStudyCheckpoint(); return h.store[STUDY_CHECKPOINT_KEY] || null; };

// ---- every way out --------------------------------------------------------
// Each route is a real tap: the bottom bar's four buttons (index.html), a
// Learn hub card, and the in-screen ✕. `leaves` says which screen a "yes"
// lands on.
const NAV_EXITS = [
  { name: 'bottom bar → Home', go: (h) => h.sandbox.switchScreen('homeScreen'), lands: 'homeScreen' },
  { name: 'bottom bar → Eng (Learn hub)', go: (h) => h.sandbox.switchScreen('learnHubScreen'), lands: 'learnHubScreen' },
  { name: 'bottom bar → Toán', go: (h) => h.sandbox.switchScreen('mathHubScreen'), lands: 'mathHubScreen' },
  { name: 'bottom bar → Arena (openPetBattle)', go: (h) => h.sandbox.openPetBattle(), lands: 'petBattleScreen', async: true },
  { name: 'Learn hub card → Grammar', go: (h) => h.sandbox.switchScreen('grammarScreen'), lands: 'grammarScreen' },
];

// The invariant of rule (A): Cancel = nothing changed; OK = gone, cleanly.
async function assertGuarded(h, exit, isActive, snapshot) {
  const before = snapshot();
  const html = screen(h).innerHTML;
  h.sandbox.__confirmAnswer = false;
  h.sandbox.__confirmLog.length = 0;
  let r = exit.go(h);
  if (exit.async) { r = await r; await settle(); }
  assert.equal(h.sandbox.__confirmLog.length, 1, exit.name + ': must ask exactly once (' + h.sandbox.__confirmLog.join(' / ') + ')');
  if (!exit.async) assert.equal(r, false, exit.name + ': switchScreen must report the refusal');
  assert.truthy(isActive(), exit.name + ': Cancel must keep the round running');
  assert.deepEqual(snapshot(), before, exit.name + ': Cancel must keep the same question and answers');
  assert.equal(screen(h).innerHTML, html, exit.name + ': Cancel must leave the screen exactly as it was');
  assert.truthy(screen(h).classList.contains('active'), exit.name + ': the child is still on the Phrases screen');

  h.sandbox.__confirmAnswer = true;
  h.sandbox.__confirmLog.length = 0;
  r = exit.go(h);
  if (exit.async) { r = await r; await settle(8); }
  assert.equal(h.sandbox.__confirmLog.length, 1, exit.name + ': OK asks once');
  if (!exit.async) assert.equal(r, true, exit.name + ': and leaves');
  assert.falsy(isActive(), exit.name + ': OK must end the round');
  assert.truthy(h.el(exit.lands).classList.contains('active'), exit.name + ': lands on ' + exit.lands);
  assert.falsy(screen(h).classList.contains('active'), exit.name + ': the Phrases screen is no longer active');
}

// Rule (C): the tab comes back clean.
async function assertCleanReopen(h, coinsBefore) {
  h.sandbox.__confirmLog.length = 0;
  assert.equal(h.sandbox.switchScreen('phrasesScreen'), true, 'reopening Phrases needs no confirm');
  await settle();
  assert.equal(h.sandbox.__confirmLog.length, 0, 'nothing asked on the way back in');
  assert.falsy(h.sandbox.isCollocActive() || h.sandbox.isPhrasesQuizActive() || h.sandbox.isRetryDrillActive(), 'no ghost round');
  assert.truthy(offers(h, /^switchPhrSubTab\('colloc'\)$/), 'the sub-tab bar is back');
  assert.truthy(offers(h, /^startCollocPractice\(20\)$/) || offers(h, /^startPhrasesQuiz\(20\)$/), 'a fresh practice is offered');
  assert.equal(checkpoint(h), null, 'no checkpoint offers the old round back');
  assert.falsy(h.sandbox._busyWithTimedActivity(), 'the app no longer counts the child as busy');
  if (coinsBefore !== undefined) assert.equal(h.state().coins, coinsBefore, 'coins are exactly what they should be');
}

// Rule (B): nothing on or around the result screen blocks a tap out.
function assertNothingBlocks(h) {
  assert.falsy(h.sandbox.isCollocActive(), 'isCollocActive is off');
  assert.falsy(h.sandbox.isPhrasesQuizActive(), 'isPhrasesQuizActive is off');
  assert.falsy(h.sandbox.isRetryDrillActive(), 'no drill is active');
  assert.equal(h.peek('_colQuiz'), null, '_colQuiz is null');
  const nav = h.el('bottomNav');
  assert.equal(nav.style.display, 'flex', 'the bottom bar is shown');
  assert.falsy(nav.hasAttribute('aria-hidden'), 'and not aria-hidden');
  assert.falsy(nav.style.pointerEvents === 'none', 'and accepts taps');
  assert.falsy(h.doc.documentElement.classList.contains('math-board-open'), 'no board lock on <html>');
  assert.equal(h.doc.body.className, '', 'no leftover body class');
  assert.falsy(screen(h).classList.contains('lazy-css-pending'), 'the screen is not hidden behind a pending stylesheet');
  assert.deepEqual(h.consoleLog.error, [], 'nothing threw on the way to the result');
  assert.falsy(h.sandbox._busyWithTimedActivity(), 'the app does not count the child as busy');
}

// =========================================================================
suite('leave guards — Collocation practice in progress (A)', () => {
  for (const exit of NAV_EXITS) {
    test('Collocation (Practice 20): ' + exit.name + ' asks; Cancel stays, OK leaves cleanly', async () => {
      const h = await boot();
      startColloc(h, 20);
      answerCollocOnScreen(h, false);          // one answer on the board
      const coins = h.state().coins;
      const snap = () => { const s = h.peek('_colQuiz'); return { idx: s.idx, answers: s.answers, n: s.questions.length }; };
      await assertGuarded(h, exit, () => h.sandbox.isCollocActive(), snap);
      await assertCleanReopen(h, coins);
    });
  }

  test('Collocation (Quick 10): the ✕ asks once work is on the board; Cancel stays, OK goes home', async () => {
    const h = await boot();
    startColloc(h, 10);
    // Starting and changing your mind is free — no work to lose yet.
    h.sandbox.__confirmLog.length = 0;
    tap(h, /^quitCollocPractice\(\)$/);
    assert.equal(h.sandbox.__confirmLog.length, 0, 'an untouched practice is closed without a question');
    assert.falsy(h.sandbox.isCollocActive());
    assert.truthy(offers(h, /^startCollocPractice\(10\)$/), 'back on the Collocation sub-tab');

    startColloc(h, 10);
    answerCollocOnScreen(h, false);
    hearThenNext(h, /^nextCollocQuestion\(\)$/);
    const st = h.peek('_colQuiz');
    const idx = st.idx, answers = st.answers.slice();
    const html = screen(h).innerHTML;
    const coins = h.state().coins;
    h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
    tap(h, /^quitCollocPractice\(\)$/);
    assert.equal(h.sandbox.__confirmLog.length, 1, 'the ✕ asks');
    assert.truthy(h.sandbox.isCollocActive(), 'Cancel keeps the practice');
    assert.equal(h.peek('_colQuiz').idx, idx, 'same question');
    assert.deepEqual(h.peek('_colQuiz').answers, answers, 'same answers');
    assert.equal(screen(h).innerHTML, html, 'same screen');
    h.sandbox.__confirmAnswer = true; h.sandbox.__confirmLog.length = 0;
    tap(h, /^quitCollocPractice\(\)$/);
    assert.equal(h.sandbox.__confirmLog.length, 1);
    assert.falsy(h.sandbox.isCollocActive(), 'OK ends it');
    assert.truthy(offers(h, /^startCollocPractice\(20\)$/), 'and draws the Collocation home');
    assert.equal(checkpoint(h), null, 'the checkpoint is gone');
    assert.equal(h.state().coins, coins, 'an abandoned round pays nothing');
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'and the bottom bar is free');
    assert.equal(h.sandbox.__confirmLog.length, 1, 'with nothing further asked');
  });

  test('a tab tap DURING a follow-up check screen is guarded too', async () => {
    const h = await boot();
    startColloc(h, 10);
    answerCollocOnScreen(h, false);
    hearThenNext(h, /^nextCollocQuestion\(\)$/);
    const st = h.peek('_colQuiz');
    assert.truthy(st.questions[st.idx].followup, 'the check screen follows the question');
    assert.truthy(offers(h, /^answerCollocFollowup\('m',\d\)$/), 'and is on screen');
    tap(h, new RegExp("^answerCollocFollowup\\('m'," + st.questions[st.idx].m.correct + '\\)$'));   // half answered
    const snap = () => { const s = h.peek('_colQuiz'); return { idx: s.idx, answers: s.answers }; };
    await assertGuarded(h, NAV_EXITS[0], () => h.sandbox.isCollocActive(), snap);
    await assertCleanReopen(h);
  });
});

// =========================================================================
suite('leave guards — Collocation finished (B) and the next open (C)', () => {
  for (const [label, wrongEvery] of [['100% (celebration path)', 0], ['with mistakes (retry owed)', 2]]) {
    test('Collocation finished ' + label + ': every exit is free and nothing blocks', async () => {
      const h = await boot();
      const coins0 = h.state().coins;
      startColloc(h, 10);
      playColloc(h, wrongEvery);
      // The result screen, as rendered.
      assert.truthy(offers(h, /^renderPhrasesHome\(\)$/), 'the result screen has its ‹ back button');
      assert.truthy(offers(h, /^startCollocPractice\(10\)$/), 'and Practice again');
      const hist = h.state().collocHistory;
      assert.equal(hist.length, 1, 'one history row');
      const paid = h.state().coins - coins0;
      assert.truthy(paid > 0, 'the round paid coins');
      assert.equal(paid, hist[0].score * 5 + 0 + (paid - hist[0].score * 5), 'paid = 5/point (+ combo)');
      if (wrongEvery) assert.truthy(h.sandbox.retryCount('col') > 0, 'the mistakes are owed');
      else assert.equal(h.sandbox.retryCount('col'), 0, 'nothing is owed after a perfect round');
      assertNothingBlocks(h);
      // Confetti is a fixed pointer-events:none layer, cleared by a timer; it
      // must not be the thing under the child's finger.
      const confetti = h.el('confettiContainer');
      assert.truthy(confetti && confetti.className === 'confetti-container', 'the confetti layer is the shared one');

      for (const exit of NAV_EXITS) {
        h.sandbox.__confirmLog.length = 0;
        let r = exit.go(h);
        if (exit.async) { r = await r; await settle(8); } else assert.equal(r, true, exit.name + ' must leave');
        assert.equal(h.sandbox.__confirmLog.length, 0, exit.name + ': no confirm after finishing');
        assert.truthy(h.el(exit.lands).classList.contains('active'), exit.name + ': lands on ' + exit.lands);
        // …and back to the result screen is not possible (it is gone), but the
        // tab itself comes back clean.
        await assertCleanReopen(h, coins0 + paid);
        assert.equal(h.state().collocHistory.length, 1, 'still one history row — no double record');
      }
    });
  }

  test('the result screen\'s own ‹ and "Practice again" work, and a second "See results" cannot pay twice', async () => {
    const h = await boot();
    const coins0 = h.state().coins;
    startColloc(h, 10);
    playColloc(h, 0);
    const paid = h.state().coins - coins0;
    // ‹ back
    h.sandbox.__confirmLog.length = 0;
    tap(h, /^renderPhrasesHome\(\)$/);
    assert.equal(h.sandbox.__confirmLog.length, 0, '‹ asks nothing');
    assert.truthy(offers(h, /^startCollocPractice\(20\)$/), '‹ draws the Collocation home');
    // Practice again from a fresh result screen
    startColloc(h, 10);
    playColloc(h, 0);
    tap(h, /^startCollocPractice\(10\)$/);
    assert.truthy(h.sandbox.isCollocActive(), 'Practice again starts a new practice when nothing is owed');
    assert.equal(h.peek('_colQuiz').idx, 0, 'from the first question');
    assert.equal(h.state().collocHistory.length, 2, 'two rounds recorded');
    // A stale "See results" tap after the round ended is a no-op.
    h.sandbox.abandonCollocPractice();
    const coins = h.state().coins;
    h.sandbox.finishCollocPractice();
    h.sandbox.nextCollocQuestion();
    assert.equal(h.state().coins, coins, 'no round → no pay');
    assert.equal(h.state().collocHistory.length, 2, 'no round → no record');
    assert.truthy(paid > 0);
  });

  test('finishing claims the round BEFORE paying, so a throw mid-result cannot leave it active or pay twice', async () => {
    const h = await boot();
    startColloc(h, 10);
    playCollocUntilLast(h);
    // Something on the result path throws once (here: the reward card).
    const real = h.sandbox.petRewardCardHTML;
    let calls = 0;
    h.sandbox.petRewardCardHTML = function () { calls++; if (calls === 1) throw new Error('boom'); return real.apply(this, arguments); };
    const coins = h.state().coins;
    let threw = false;
    try { tap(h, /^nextCollocQuestion\(\)$/); } catch (e) { threw = true; }
    assert.truthy(threw, 'the fault surfaced');
    assert.falsy(h.sandbox.isCollocActive(), 'the round is over even so — the bottom bar must not keep asking');
    assert.equal(checkpoint(h), null, 'and the checkpoint is gone');
    const paidOnce = h.state().coins - coins;
    assert.truthy(paidOnce > 0, 'the coins were banked before the throw');
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'the child can leave');
    assert.equal(h.sandbox.__confirmLog.length, 0, 'without being asked');
    h.sandbox.nextCollocQuestion();                    // a second stale tap on "See results"
    assert.equal(h.state().coins, coins + paidOnce, 'is not paid again');
    assert.equal(h.state().collocHistory.length, 1, 'nor recorded again');
    h.sandbox.petRewardCardHTML = real;
  });

  test('a tab tap DURING the reward animation leaves at once and the celebration does not follow', async () => {
    const h = await boot();
    startColloc(h, 10);
    playColloc(h, 0);
    const pending = h.timers.filter((t) => t.kind === 'timeout').length;
    assert.truthy(pending > 0, 'the celebration armed its timers');
    assertNothingBlocks(h);
    // Home, then the celebration's timers fire late — confetti clears, the
    // second burst fires — and none of it drags the child back or throws.
    assert.equal(h.sandbox.switchScreen('homeScreen'), true);
    assert.equal(h.sandbox.__confirmLog.length, 0);
    for (const t of h.timers.slice()) { if (t.kind === 'timeout') t.fn(); }
    assert.truthy(h.el('homeScreen').classList.contains('active'), 'Home stays');
    assert.falsy(screen(h).classList.contains('active'));
    assert.deepEqual(h.consoleLog.error, []);
    assert.equal(h.el('bottomNav').style.display, 'flex');
  });
});

// Play to the LAST question, answered, gate heard, "See results" on screen.
function playCollocUntilLast(h) {
  let guard = 0;
  while (guard++ < 400) {
    const st = h.peek('_colQuiz');
    answerCollocOnScreen(h, false);
    const gate = screen(h).querySelector('.answer-gate-btn');
    if (gate) h.sandbox.hearAnswer(gate);
    if (st.idx + 1 >= st.questions.length) break;
    tap(h, /^nextCollocQuestion\(\)$/);
  }
  assert.truthy(h.sandbox.isCollocActive(), 'still running, on the last question');
  assert.truthy(/See results/.test(screen(h).innerHTML), '"See results" is on screen');
}

// =========================================================================
suite('leave guards — the owed drill after a Collocation practice (the reported bug)', () => {
  async function intoDrill(h) {
    startColloc(h, 10);
    playColloc(h, 2);
    assert.truthy(h.sandbox.retryCount('col') > 0, 'mistakes are owed');
    tap(h, /^startCollocPractice\(10\)$/);            // "Practice again" → the gate opens the drill
    assert.falsy(h.sandbox.isCollocActive(), 'no new practice opens while questions are owed');
    assert.truthy(h.sandbox.isRetryDrillActive() && h.sandbox.retryDrillKey() === 'col', 'the owed drill opened instead');
    assert.truthy(offers(h, /^submitRetryAnswer\(\)$/), 'and is on screen');
  }

  test('the drill\'s ✕ and its finished screen\'s home button draw the Collocation home', async () => {
    const h = await boot();
    await intoDrill(h);
    // ✕ straight away: nothing answered yet, so no question, and it must DRAW.
    h.sandbox.__confirmLog.length = 0;
    tap(h, /quitRetryDrill|retryGoHome/);
    assert.equal(h.sandbox.__confirmLog.length, 0, 'an untouched drill closes without a question');
    assert.falsy(h.sandbox.isRetryDrillActive(), 'the drill is closed');
    assert.truthy(offers(h, /^switchPhrSubTab\('colloc'\)$/) && offers(h, /^startCollocPractice\(20\)$/),
      'the Collocation home is DRAWN — this is where the child used to be stuck on a dead screen');
    assert.falsy(offers(h, /^submitRetryAnswer\(\)$/), 'the drill screen is gone');
    // Finish the drill, then its own home button.
    tap(h, /^startCollocPractice\(10\)$/);
    assert.truthy(h.sandbox.isRetryDrillActive());
    let guard = 0;
    while (h.sandbox.isRetryDrillActive() && guard++ < 50) {
      answerDrillItemRight(h);
      tap(h, /^nextRetryQuestion\(\)$/);
    }
    assert.falsy(h.sandbox.isRetryDrillActive(), 'the drill finished');
    assert.equal(h.sandbox.retryCount('col'), 0, 'nothing is owed any more');
    assert.truthy(offers(h, /^retryGoHome\('col'\)$/), 'the finished screen offers "Về trang chính"');
    assertNothingBlocks(h);
    h.sandbox.__confirmLog.length = 0;
    tap(h, /^retryGoHome\('col'\)$/);
    assert.equal(h.sandbox.__confirmLog.length, 0);
    assert.truthy(offers(h, /^startCollocPractice\(20\)$/), '"Về trang chính" draws the Collocation home');
    assert.falsy(/Hết câu sai rồi/.test(screen(h).textContent), 'the finished-drill screen is gone');
    // …and from there a new practice really opens.
    tap(h, /^startCollocPractice\(10\)$/);
    assert.truthy(h.sandbox.isCollocActive(), 'the gate is open again');
  });

  for (const exit of NAV_EXITS) {
    test('drill in progress: ' + exit.name + ' asks; Cancel stays, OK leaves and the drill is not left running', async () => {
      const h = await boot();
      await intoDrill(h);
      answerDrillItemRight(h);                        // one item in
      const snap = () => { const s = h.peek('_retryDrill'); return { idx: s.idx, fixed: s.fixed, missed: s.missed, left: s.queue.length, answered: !!s.answered }; };
      await assertGuarded(h, exit, () => h.sandbox.isRetryDrillActive(), snap);
      await assertCleanReopen(h);
      assert.truthy(h.sandbox.retryCount('col') > 0, 'the debt itself survives — only the screen was left');
    });
  }

  test('drill in progress: the ✕ asks once work is on the board; Cancel keeps the same item', async () => {
    const h = await boot();
    await intoDrill(h);
    answerDrillItemRight(h);
    tap(h, /^nextRetryQuestion\(\)$/);
    const st = h.peek('_retryDrill');
    const snap = JSON.stringify({ idx: st.idx, left: st.queue.length, fixed: st.fixed });
    const html = screen(h).innerHTML;
    h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
    tap(h, /^quitRetryDrill\('col'\)$/);
    assert.equal(h.sandbox.__confirmLog.length, 1, 'the ✕ asks');
    assert.truthy(h.sandbox.isRetryDrillActive(), 'Cancel keeps the drill');
    assert.equal(JSON.stringify({ idx: h.peek('_retryDrill').idx, left: h.peek('_retryDrill').queue.length, fixed: h.peek('_retryDrill').fixed }), snap);
    assert.equal(screen(h).innerHTML, html, 'same screen');
    h.sandbox.__confirmAnswer = true; h.sandbox.__confirmLog.length = 0;
    tap(h, /^quitRetryDrill\('col'\)$/);
    assert.equal(h.sandbox.__confirmLog.length, 1);
    assert.falsy(h.sandbox.isRetryDrillActive(), 'OK closes it');
    assert.truthy(offers(h, /^startCollocPractice\(20\)$/), 'and draws the Collocation home');
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'the bottom bar is free');
    assert.equal(h.sandbox.__confirmLog.length, 1, 'with nothing further asked');
  });
});

// =========================================================================
suite('leave guards — Prepositions (Phrases) practice', () => {
  for (const exit of NAV_EXITS) {
    test('Phrases (Quick 10) in progress: ' + exit.name + ' asks; Cancel stays, OK leaves cleanly', async () => {
      const h = await boot();
      startPhrases(h, 10);
      answerPhrasesOnScreen(h, false);
      const coins = h.state().coins;
      const snap = () => { const s = h.peek('_phrQuiz'); return { idx: s.idx, answers: s.answers, n: s.questions.length }; };
      await assertGuarded(h, exit, () => h.sandbox.isPhrasesQuizActive(), snap);
      await assertCleanReopen(h, coins);
    });
  }

  test('Phrases (Practice 20): the ✕ asks once work is on the board; Cancel stays, OK goes home', async () => {
    const h = await boot();
    startPhrases(h, 20);
    h.sandbox.__confirmLog.length = 0;
    tap(h, /^quitPhrasesQuiz\(\)$/);
    assert.equal(h.sandbox.__confirmLog.length, 0, 'an untouched practice closes without a question');
    assert.falsy(h.sandbox.isPhrasesQuizActive());
    assert.truthy(offers(h, /^startPhrasesQuiz\(20\)$/), 'back on the Practice sub-tab');

    startPhrases(h, 20);
    answerPhrasesOnScreen(h, false);
    const st = h.peek('_phrQuiz');
    const idx = st.idx, answers = st.answers.slice();
    const html = screen(h).innerHTML;
    h.sandbox.__confirmAnswer = false; h.sandbox.__confirmLog.length = 0;
    tap(h, /^quitPhrasesQuiz\(\)$/);
    assert.equal(h.sandbox.__confirmLog.length, 1, 'the ✕ asks');
    assert.truthy(h.sandbox.isPhrasesQuizActive(), 'Cancel keeps the practice');
    assert.equal(h.peek('_phrQuiz').idx, idx);
    assert.deepEqual(h.peek('_phrQuiz').answers, answers);
    assert.equal(screen(h).innerHTML, html);
    h.sandbox.__confirmAnswer = true; h.sandbox.__confirmLog.length = 0;
    tap(h, /^quitPhrasesQuiz\(\)$/);
    assert.falsy(h.sandbox.isPhrasesQuizActive(), 'OK ends it');
    assert.truthy(offers(h, /^startPhrasesQuiz\(20\)$/), 'and draws the Phrases home');
    assert.equal(checkpoint(h), null);
  });

  for (const [label, wrongEvery] of [['100%', 0], ['with mistakes', 2]]) {
    test('Phrases finished ' + label + ': every exit is free, Done and the review path work, next open is clean', async () => {
      const h = await boot();
      const coins0 = h.state().coins;
      startPhrases(h, 10);
      playPhrases(h, wrongEvery);
      const paid = h.state().coins - coins0;
      assert.truthy(paid > 0, 'the round paid');
      assert.equal(h.sandbox.phrasesHistory().length, 1, 'one session recorded');
      assert.truthy(offers(h, /renderPhrasesHome\(\)$/), 'the result screen has Done');
      assertNothingBlocks(h);
      for (const exit of NAV_EXITS) {
        h.sandbox.__confirmLog.length = 0;
        let r = exit.go(h);
        if (exit.async) { r = await r; await settle(8); } else assert.equal(r, true, exit.name + ' must leave');
        assert.equal(h.sandbox.__confirmLog.length, 0, exit.name + ': no confirm after finishing');
        assert.truthy(h.el(exit.lands).classList.contains('active'));
        await assertCleanReopen(h, coins0 + paid);
        assert.equal(h.sandbox.phrasesHistory().length, 1, 'no double record');
      }
      // Done, from a fresh result screen. With mistakes owed, the Practice
      // button opens the drill first (the gate); clear the debt, then play.
      if (wrongEvery) {
        tap(h, /^switchPhrSubTab\('practice'\)$/);
        tap(h, /^startPhrasesQuiz\(10\)$/);
        assert.truthy(h.sandbox.isRetryDrillActive() && h.sandbox.retryDrillKey() === 'phr', 'the gate opens the drill');
        let guard = 0;
        while (h.sandbox.isRetryDrillActive() && guard++ < 50) { answerDrillItemRight(h); tap(h, /^nextRetryQuestion\(\)$/); }
        tap(h, /^retryGoHome\('phr'\)$/);
        assert.equal(h.sandbox.retryCount('phr'), 0, 'debt cleared');
      }
      startPhrases(h, 10);
      playPhrases(h, wrongEvery);
      h.sandbox.__confirmLog.length = 0;
      tap(h, /renderPhrasesHome\(\)$/);
      assert.equal(h.sandbox.__confirmLog.length, 0, 'Done asks nothing');
      assert.truthy(offers(h, /^startPhrasesQuiz\(20\)$/), 'Done draws the Phrases home');
      // Re-practice / review: a past session opens read-only and its ‹ is free.
      assert.truthy(offers(h, /^openPhrSession\(0\)$/), 'the history lists the session');
      tap(h, /^openPhrSession\(0\)$/);
      assert.falsy(h.sandbox.isPhrasesQuizActive(), 'a review is not a round');
      h.sandbox.__confirmLog.length = 0;
      assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'leaving a review is free');
      assert.equal(h.sandbox.__confirmLog.length, 0);
      if (wrongEvery) {
        h.sandbox.switchScreen('phrasesScreen'); await settle();
        tap(h, /^openPhrSession\(0\)$/);
        // "Re-practice these" is gated by the owed drill while mistakes are owed…
        assert.truthy(h.sandbox.retryCount('phr') > 0, 'mistakes are owed');
        tap(h, /^startPhrasesReviewQuiz\(/);
        assert.truthy(h.sandbox.isRetryDrillActive() && h.sandbox.retryDrillKey() === 'phr', 'the gate opens the drill first');
        // …whose ✕ draws the Phrases home and whose nav exit is guarded.
        answerDrillItemRight(h);
        const snap = () => { const s = h.peek('_retryDrill'); return { idx: s.idx, fixed: s.fixed, left: s.queue.length }; };
        await assertGuarded(h, NAV_EXITS[1], () => h.sandbox.isRetryDrillActive(), snap);
        await assertCleanReopen(h);
      }
    });
  }

  test('the review quiz (Re-practice these) is a round like any other: guarded while running, free once done', async () => {
    const h = await boot();
    startPhrases(h, 10);
    playPhrases(h, 2);
    // Clear the debt first so the review quiz itself can open.
    tap(h, /renderPhrasesHome\(\)$/);
    tap(h, /^openPhrSession\(0\)$/);
    tap(h, /^startPhrasesReviewQuiz\(/);
    let guard = 0;
    while (h.sandbox.isRetryDrillActive() && guard++ < 50) { answerDrillItemRight(h); tap(h, /^nextRetryQuestion\(\)$/); }
    tap(h, /^retryGoHome\('phr'\)$/);
    assert.truthy(offers(h, /^startPhrasesQuiz\(20\)$/), 'the finished drill goes home');
    tap(h, /^openPhrSession\(0\)$/);
    tap(h, /^startPhrasesReviewQuiz\(/);
    assert.truthy(h.sandbox.isPhrasesQuizActive(), 'the review quiz opened');
    answerPhrasesOnScreen(h, false);
    const snap = () => { const s = h.peek('_phrQuiz'); return { idx: s.idx, answers: s.answers }; };
    await assertGuarded(h, NAV_EXITS[0], () => h.sandbox.isPhrasesQuizActive(), snap);
    await assertCleanReopen(h);
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
