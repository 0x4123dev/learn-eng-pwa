// leave-guard-units.test.js — the way OUT of a Grade 4 units practice, its
// owed-words drill, and the Irregular Verbs speed run.
//
// The rule, for every exercise in the app:
//   (A) in progress: every exit — the bottom bar (Home / Eng / Arena / Toán),
//       the in-screen ✕ — asks first. Cancel keeps the child on the SAME
//       question with nothing changed; OK leaves and clears the round.
//   (B) finished: leaving asks nothing and nothing blocks it — the bottom bar
//       is back, no stale "active" flag makes switchScreen ask or refuse.
//   (C) after leaving either way, the next open of the tab is clean: no ghost
//       round, no second payment, no checkpoint offering the round back.
//
// Executed against the real app (tests/verify/client.js mounts index.html and
// every script in a DOM shim), never grepped: each activity is started from
// the onclick the screen actually renders, and each exit is the onclick the
// nav or the card actually carries.
const { suite, test, assert } = require('./harness');
const { mountApp, loginTestUser } = require('./verify/client.js');

const settle = async (n) => { for (let i = 0; i < (n || 6); i++) await new Promise((r) => setImmediate(r)); };
const CHECKPOINT_KEY = 'flashlingo-study-checkpoint-v1';

// The onclick attribute of the first button under `root` whose handler
// mentions `needle` — what a child's finger would run. Throws when there is
// none, so a test never "taps" thin air and passes for the wrong reason.
function onclickOf(root, needle) {
  const btn = root.querySelectorAll('button, [onclick]')
    .find((n) => String(n.getAttribute('onclick') || '').includes(needle));
  if (!btn) throw new Error('no button wired to ' + needle + ' under #' + (root.id || root.tagName));
  return btn.getAttribute('onclick');
}
function tap(h, root, needle) { return h.run(onclickOf(root, needle)); }

const activeScreen = (h) => (h.doc.querySelectorAll('.screen').find((s) => s.classList.contains('active')) || {}).id;
const navShown = (h) => h.el('bottomNav').style.display !== 'none';

// The bottom bar's four destinations, exactly as index.html wires them, plus
// how each is checked. openPetBattle() is the Arena button: a lazy placeholder
// that must consult switchScreen before it downloads anything.
const NAV_ROUTES = [
  { name: 'Home', go: (h) => h.sandbox.switchScreen('homeScreen') },
  { name: 'Eng', go: (h) => h.sandbox.switchScreen('learnHubScreen') },
  { name: 'Toán', go: (h) => h.sandbox.switchScreen('mathHubScreen') },
  { name: 'Arena', go: (h) => h.sandbox.openPetBattle(), async: true },
];

function boot(overrides) {
  const h = mountApp();
  loginTestUser(h, Object.assign({ coins: 100 }, overrides || {}));
  assert.deepEqual(h.loadErrors, [], 'scripts that failed to load');
  return h;
}

// The Learn hub's Grade 4 card, then the lazy stylesheet the screen waits on.
async function openGrade4(h) {
  h.sandbox.switchScreen('learnHubScreen'); await settle();
  tap(h, h.el('learnHubScreen'), "switchScreen('gradeFourScreen')");
  await h.sandbox.LazyData.ensure('gradeFourScreen'); await settle();
  assert.equal(activeScreen(h), 'gradeFourScreen');
  assert.truthy(h.el('unitsBar').innerHTML.includes('startUnitPractice'), 'the unit cards rendered');
}

// ---------------------------------------------------------------------------
// Grade 4 units practice — one word set per tab (Pre / Post / HK1 / HK2)
// ---------------------------------------------------------------------------
const UNIT_SETS = ['pre', 'posthk', 'hk1', 'hk2'];

// Pick the set through its tab, then start the first open unit card.
async function startUnits(h, set) {
  await openGrade4(h);
  tap(h, h.el('unitsBar'), "switchUnitSet('" + set + "')"); await settle();
  assert.equal(h.sandbox.currentUnitSet(), set, 'the ' + set + ' tab did not take');
  const card = h.el('unitsBar').querySelectorAll('.g4-card')
    .find((c) => !c.classList.contains('g4-mix-card') && !c.disabled);
  assert.truthy(card, 'no open unit card in ' + set);
  h.run(card.getAttribute('onclick'));
  assert.truthy(h.sandbox.isUnitPracticeActive(), 'the practice did not start');
  assert.truthy(h.el('unitTextInput'), 'the first gap is on screen');
  assert.equal(h.el('unitsBar').style.display, 'none', 'the cards step aside');
  return h.peek('_unitQuiz');
}
function answerUnit(h, correct) {
  const st = h.peek('_unitQuiz');
  h.el('unitTextInput').value = correct ? st.questions[st.idx].w.en : 'zzz';
  h.sandbox.submitUnitAnswer();
  assert.truthy(st.answers[st.idx], 'the answer did not register');
}
function nextUnit(h) { tap(h, h.el('grade4Detail'), 'nextUnitQuestion'); }

// A practice with one answer banked and the second gap open — work to lose.
async function unitsMidway(h, set) {
  await startUnits(h, set);
  answerUnit(h, true);
  nextUnit(h);
  const st = h.peek('_unitQuiz');
  assert.equal(st.idx, 1);
  assert.truthy(h.el('unitTextInput'), 'question 2 is open');
  return st;
}

function assertUnitsStayed(h, before, label) {
  const st = h.peek('_unitQuiz');
  assert.truthy(h.sandbox.isUnitPracticeActive(), label + ': the practice must still be running');
  assert.truthy(st === before.state, label + ': the round object was replaced');
  assert.equal(st.idx, before.idx, label + ': the question index moved');
  assert.equal(h.el('grade4Detail').innerHTML, before.html, label + ': the question card changed under the child');
  assert.equal(activeScreen(h), 'gradeFourScreen', label + ': the screen changed');
}

function assertGrade4Clean(h, label) {
  assert.falsy(h.sandbox.isUnitPracticeActive(), label + ': a ghost round is still active');
  assert.falsy(h.el('unitTextInput'), label + ': a question is still on screen');
  assert.equal(h.el('unitsBar').style.display, '', label + ': the unit cards are hidden');
  assert.truthy(h.el('unitsBar').innerHTML.includes('startUnitPractice'), label + ': the unit cards are not drawn');
  assert.equal(h.el('grade4SubTabs').style.display, '', label + ': the Bài học / Lịch sử tabs are hidden');
  assert.equal(h.sandbox.buildStudyCheckpoint(), null, label + ': a checkpoint would still offer the round back');
  h.sandbox.saveStudyCheckpoint();
  assert.equal(h.store[CHECKPOINT_KEY], undefined, label + ': the stored checkpoint was not cleared');
}

for (const set of UNIT_SETS) {
  suite('Grade 4 units (' + set + '): in progress, every exit asks and Cancel keeps the question', () => {
    for (const route of NAV_ROUTES) {
      test(route.name + ' on the bottom bar', async () => {
        const h = boot();
        const st = await unitsMidway(h, set);
        const before = { state: st, idx: st.idx, html: h.el('grade4Detail').innerHTML };
        h.sandbox.__confirmAnswer = false;
        h.sandbox.__confirmLog.length = 0;
        const r = route.go(h);
        if (route.async) await r; else assert.equal(r, false, route.name + ': switchScreen must report that it did not switch');
        await settle();
        assert.equal(h.sandbox.__confirmLog.length, 1, route.name + ': must ask exactly once');
        assertUnitsStayed(h, before, route.name);
      });
    }

    test('the ✕ on the question card', async () => {
      const h = boot();
      const st = await unitsMidway(h, set);
      const before = { state: st, idx: st.idx, html: h.el('grade4Detail').innerHTML };
      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      tap(h, h.el('grade4Detail'), 'quitUnitPractice');
      assert.equal(h.sandbox.__confirmLog.length, 1, '✕: must ask exactly once');
      assertUnitsStayed(h, before, '✕');
    });
  });

  suite('Grade 4 units (' + set + '): OK leaves and the next open is clean', () => {
    test('OK on the bottom bar abandons the round and frees the nav', async () => {
      const h = boot();
      await unitsMidway(h, set);
      const coins = h.state().coins, hist = (h.state().unitsHistory || []).length;
      h.sandbox.__confirmAnswer = true;
      h.sandbox.__confirmLog.length = 0;
      assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'saying yes must leave');
      assert.equal(h.sandbox.__confirmLog.length, 1);
      assert.falsy(h.sandbox.isUnitPracticeActive(), 'the round must be cleared');
      assert.equal(activeScreen(h), 'homeScreen');
      assert.truthy(navShown(h), 'the bottom bar is back');
      assert.equal(h.sandbox.buildStudyCheckpoint(), null, 'no checkpoint survives an abandoned round');
      // The Arena and Toán tabs must now open without a word.
      h.sandbox.__confirmLog.length = 0;
      assert.equal(h.sandbox.switchScreen('mathHubScreen'), true);
      assert.equal(h.sandbox.__confirmLog.length, 0, 'nothing left to ask about');
      // (C) back on the tab: cards, not a ghost question, and nothing paid.
      await openGrade4(h);
      assertGrade4Clean(h, 'after leaving via Home');
      assert.equal(h.state().coins, coins, 'an abandoned round must not pay');
      assert.equal((h.state().unitsHistory || []).length, hist, 'an abandoned round must not be in the history');
    });

    test('OK on the ✕ goes back to the cards of the same set', async () => {
      const h = boot();
      await unitsMidway(h, set);
      h.sandbox.__confirmAnswer = true;
      h.sandbox.__confirmLog.length = 0;
      tap(h, h.el('grade4Detail'), 'quitUnitPractice');
      assert.equal(h.sandbox.__confirmLog.length, 1);
      assertGrade4Clean(h, 'after the ✕');
      assert.equal(h.sandbox.currentUnitSet(), set, 'the ✕ must land on the set the child was in');
      h.sandbox.__confirmLog.length = 0;
      assert.equal(h.sandbox.switchScreen('homeScreen'), true);
      assert.equal(h.sandbox.__confirmLog.length, 0, 'the bottom bar must be free after the ✕');
    });

    test('OK on the Arena button lands in the Arena with the round gone', async () => {
      const h = boot();
      await unitsMidway(h, set);
      h.sandbox.__confirmAnswer = true;
      h.sandbox.__confirmLog.length = 0;
      await h.sandbox.openPetBattle(); await settle(10);
      assert.equal(h.sandbox.__confirmLog.length, 1);
      assert.falsy(h.sandbox.isUnitPracticeActive());
      assert.equal(activeScreen(h), 'petBattleScreen');
      assert.truthy(navShown(h));
    });
  });

  suite('Grade 4 units (' + set + '): finished, nothing asks and nothing blocks', () => {
    test('the result screen frees every exit and pays exactly once', async () => {
      const h = boot();
      const st = await startUnits(h, set);
      const coins0 = h.state().coins, hist0 = (h.state().unitsHistory || []).length;
      for (let i = 0; i < st.questions.length; i++) { answerUnit(h, true); nextUnit(h); }
      // (B) the result screen is up, the round is over.
      assert.falsy(h.sandbox.isUnitPracticeActive(), 'the round must be over once the results show');
      assert.truthy(h.el('grade4Detail').innerHTML.includes('renderGrade4Home()'), 'the results carry a back button');
      const paid = h.state().coins - coins0;
      assert.truthy(paid >= st.questions.length * 5, 'a perfect round pays at least 5 a word (paid ' + paid + ')');
      assert.equal((h.state().unitsHistory || []).length, hist0 + 1, 'one history row');
      assert.equal(h.sandbox.buildStudyCheckpoint(), null, 'a finished round must not be checkpointed');
      assert.truthy(navShown(h), 'the bottom bar is visible on the result screen');
      h.sandbox.__confirmAnswer = false;                    // a confirm here would be a bug, so make one fail loudly
      h.sandbox.__confirmLog.length = 0;
      assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'Home must open with no question');
      assert.equal(h.sandbox.switchScreen('mathHubScreen'), true, 'Toán must open with no question');
      assert.equal(h.sandbox.switchScreen('learnHubScreen'), true, 'Eng must open with no question');
      await h.sandbox.openPetBattle(); await settle(10);
      assert.equal(activeScreen(h), 'petBattleScreen', 'Arena must open with no question');
      assert.equal(h.sandbox.__confirmLog.length, 0, 'asked ' + h.sandbox.__confirmLog.length + ' times after the round was over');
      // (C) the tab reopens on the cards, and nothing is paid twice.
      await openGrade4(h);
      assertGrade4Clean(h, 'after a finished round');
      assert.equal(h.state().coins, coins0 + paid, 'coins changed on reopening the tab');
      assert.equal((h.state().unitsHistory || []).length, hist0 + 1, 'the history grew on reopening the tab');
    });

    test('the result screen\'s own back button returns to the cards with no question', async () => {
      const h = boot();
      const st = await startUnits(h, set);
      for (let i = 0; i < st.questions.length; i++) { answerUnit(h, true); nextUnit(h); }
      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      tap(h, h.el('grade4Detail'), 'renderGrade4Home()');
      assert.equal(h.sandbox.__confirmLog.length, 0);
      assertGrade4Clean(h, 'after the results\' back button');
      assert.equal(h.sandbox.currentUnitSet(), set);
    });
  });
}

// ---------------------------------------------------------------------------
// the owed-words drill (startUnitRetry): every missed word typed back
// ---------------------------------------------------------------------------
async function startUnitsDrill(h) {
  await openGrade4(h);
  const bar = h.el('unitsBar');
  assert.truthy(bar.querySelectorAll('.g4-card.locked').length > 0, 'owed words lock the cards');
  tap(h, bar, "startRetryDrill('units')");              // the banner's "Luyện ngay →"
  assert.truthy(h.sandbox.isRetryDrillActive(), 'the drill did not start');
  assert.equal(h.sandbox.retryDrillKey(), 'units');
  assert.truthy(h.el('retryInput'), 'the first owed word is on screen');
  return h.peek('_retryDrill');
}
function answerDrill(h, correct) {
  const st = h.peek('_retryDrill');
  const item = st.queue[st.idx % st.queue.length];
  h.el('retryInput').value = correct ? item.en : 'zzz';
  h.sandbox.submitRetryAnswer();
  assert.truthy(st.answered, 'the drill answer did not register');
  tap(h, h.el('grade4Detail'), 'nextRetryQuestion');
}

suite('Grade 4 owed-words drill: leaving', () => {
  const owed = (h) => {
    const bank = h.peek('UNIT_WORDS');
    return ['pre|' + bank[0].en, 'pre|' + bank[1].en];
  };

  for (const route of NAV_ROUTES) {
    test(route.name + ' on the bottom bar asks, and Cancel keeps the same word', async () => {
      const h = mountApp();
      loginTestUser(h, { coins: 100, unitsRetry: owed(h) });
      const st = await startUnitsDrill(h);
      const html = h.el('grade4Detail').innerHTML;
      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      const r = route.go(h);
      if (route.async) await r; else assert.equal(r, false);
      await settle();
      assert.equal(h.sandbox.__confirmLog.length, 1, route.name + ': must ask exactly once');
      assert.truthy(h.peek('_retryDrill') === st, 'the drill must be untouched');
      assert.equal(h.el('grade4Detail').innerHTML, html, 'the word on screen changed');
      assert.equal(activeScreen(h), 'gradeFourScreen');
    });
  }

  test('OK on the bottom bar drops the drill; the debt and the banner are still there next time', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100, unitsRetry: owed(h) });
    await startUnitsDrill(h);
    h.sandbox.__confirmAnswer = true;
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('homeScreen'), true);
    assert.equal(h.sandbox.__confirmLog.length, 1);
    assert.falsy(h.sandbox.isRetryDrillActive(), 'the drill outlived the tab');
    assert.equal(h.sandbox._busyWithTimedActivity(), false, 'a dropped drill must not hold app updates back');
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('mathHubScreen'), true);
    assert.equal(h.sandbox.__confirmLog.length, 0, 'nothing left to ask about');
    await openGrade4(h);
    assert.falsy(h.el('retryInput'), 'no ghost drill on screen');
    assert.equal(h.sandbox.unitsRetryCount(), 2, 'the debt persists — that is the point of the drill');
    assert.truthy(h.el('unitsBar').innerHTML.includes("startRetryDrill('units')"), 'the banner offers the drill again');
  });

  test('the ✕ leaves cleanly (nothing is lost, so it may go without asking)', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100, unitsRetry: owed(h) });
    await startUnitsDrill(h);
    h.sandbox.__confirmAnswer = false;                       // must not be consulted at all
    tap(h, h.el('grade4Detail'), 'retryGoHome');
    assert.falsy(h.sandbox.isRetryDrillActive(), 'the ✕ must end the drill');
    assert.equal(h.el('unitsBar').style.display, '', 'the cards are back');
    assert.truthy(h.el('unitsBar').innerHTML.includes("startRetryDrill('units')"), 'still owed, still offered');
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('homeScreen'), true);
    assert.equal(h.sandbox.__confirmLog.length, 0, 'the bottom bar must be free after the ✕');
  });

  test('finishing the drill unlocks the cards and frees every exit', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100, unitsRetry: owed(h) });
    const st = await startUnitsDrill(h);
    const n = st.queue.length;
    for (let i = 0; i < n; i++) answerDrill(h, true);
    assert.falsy(h.sandbox.isRetryDrillActive(), 'the drill must be over on the done screen');
    assert.equal(h.sandbox.unitsRetryCount(), 0, 'every word was cleared');
    assert.truthy(h.el('grade4Detail').innerHTML.includes('Hết'), 'the done screen is up');
    h.sandbox.__confirmAnswer = false;
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'Home must open with no question');
    assert.equal(h.sandbox.switchScreen('mathHubScreen'), true);
    assert.equal(h.sandbox.__confirmLog.length, 0);
    assert.truthy(navShown(h));
    await openGrade4(h);
    assert.falsy(h.el('retryInput'));
    assert.equal(h.el('unitsBar').querySelectorAll('.g4-card.locked').length, 0, 'the cards are unlocked');
    assert.falsy(h.el('unitsBar').innerHTML.includes("startRetryDrill('units')"), 'no banner once nothing is owed');
    // The done screen's own back button, from a fresh drill, works without a word.
  });

  test('the done screen\'s back button returns to the cards', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100, unitsRetry: owed(h) });
    const st = await startUnitsDrill(h);
    for (let i = 0; i < st.queue.length; i++) answerDrill(h, true);
    h.sandbox.__confirmAnswer = false;
    h.sandbox.__confirmLog.length = 0;
    tap(h, h.el('grade4Detail'), "retryGoHome('units')");
    assert.equal(h.sandbox.__confirmLog.length, 0);
    assert.equal(h.el('unitsBar').style.display, '');
    assert.truthy(h.el('unitsBar').innerHTML.includes('startUnitPractice'));
    assert.falsy(h.el('retryInput'));
  });
});

// ---------------------------------------------------------------------------
// Irregular Verbs speed run — timed, overlay, bottom bar hidden
// ---------------------------------------------------------------------------
function bootVerbs() {
  const h = boot();
  // The harness records timers and makes clearInterval a no-op; the run's
  // clock is the one thing here that must be proven STOPPED, so record the
  // ids the app clears.
  const cleared = [];
  h.sandbox.clearInterval = (id) => { cleared.push(id); };
  h.cleared = cleared;
  return h;
}
async function openVerbs(h) {
  h.sandbox.switchScreen('learnHubScreen'); await settle();
  tap(h, h.el('learnHubScreen'), "switchScreen('speedChallengeScreen')"); await settle();
  assert.equal(activeScreen(h), 'speedChallengeScreen');
}
async function startVerbs(h) {
  await openVerbs(h);
  tap(h, h.el('speedChallengeScreen'), 'startSpeedChallenge');
  const s = h.peek('speedState');
  assert.truthy(h.sandbox.isSpeedGameActive(), 'the run did not start');
  assert.truthy(h.el('speedGameOverlay').classList.contains('active'));
  assert.equal(h.el('bottomNav').style.display, 'none', 'a timed run hides the bottom bar');
  assert.truthy(s.timer, 'the question clock is running');
  assert.equal(h.timers[s.timer - 1].kind, 'interval', 'the clock is an interval');
  assert.equal(s.currentVerbs.length, h.peek('SPEED_QUESTIONS_PER_GAME'));
  return s;
}
function answerVerb(h, correct) {
  const s = h.peek('speedState');
  const v = s.currentVerbs[s.currentIndex];
  h.el('inputV2').value = correct ? v.v2.split('/')[0].trim() : 'zzz';
  h.el('inputV3').value = correct ? v.v3.split('/')[0].trim() : 'zzz';
  h.el('speedSubmitBtn').click();                       // wired by addEventListener, not onclick
  assert.falsy(s.isAnswering, 'the answer did not register');
  tap(h, h.el('speedFeedback'), 'nextSpeedQuestion');
}
// One verb banked, the second question's clock running — a run to lose.
async function verbsMidway(h) {
  const s = await startVerbs(h);
  answerVerb(h, true);
  assert.equal(s.currentIndex, 1);
  assert.truthy(s.isAnswering, 'question 2 is open');
  assert.truthy(s.timer && !h.cleared.includes(s.timer), 'question 2 has a live clock');
  return s;
}
function assertVerbsStayed(h, before, label) {
  const s = h.peek('speedState');
  assert.truthy(h.sandbox.isSpeedGameActive(), label + ': the run must still be up');
  assert.equal(s.currentIndex, before.idx, label + ': the verb moved');
  assert.equal(h.el('verbV1').textContent, before.v1, label + ': the verb on screen changed');
  assert.truthy(s.isAnswering, label + ': the run stopped taking answers');
  assert.equal(s.timer, before.timer, label + ': the clock was replaced');
  assert.falsy(h.cleared.includes(before.timer), label + ': the clock was stopped');
  assert.equal(h.el('bottomNav').style.display, 'none', label + ': the bar came back under a live run');
  assert.equal(activeScreen(h), 'speedChallengeScreen', label + ': the screen changed under the overlay');
}
function assertVerbsGone(h, before, label) {
  const s = h.peek('speedState');
  assert.falsy(h.sandbox.isSpeedGameActive(), label + ': the overlay is still up');
  assert.falsy(h.el('speedGameOverlay').classList.contains('active'));
  assert.truthy(h.cleared.includes(before.timer), label + ': the clock is still ticking');
  assert.falsy(s.isAnswering, label + ': the Enter listener would still submit verbs');
  assert.truthy(navShown(h), label + ': the bottom bar is not back');
  assert.equal(h.sandbox.buildStudyCheckpoint(), null, label + ': a checkpoint would offer the dropped run back');
}

suite('Verbs speed run: in progress, every exit asks and Cancel keeps the clock running', () => {
  test('the ✕ on the overlay', async () => {
    const h = bootVerbs();
    const s = await verbsMidway(h);
    const before = { idx: s.currentIndex, v1: h.el('verbV1').textContent, timer: s.timer };
    h.sandbox.__confirmAnswer = false;
    h.sandbox.__confirmLog.length = 0;
    tap(h, h.el('speedGameOverlay'), 'exitSpeedGame');
    assert.equal(h.sandbox.__confirmLog.length, 1, '✕: must ask exactly once');
    assertVerbsStayed(h, before, '✕');
  });

  for (const route of NAV_ROUTES) {
    test(route.name + ' (the bar is hidden, but code can still call it)', async () => {
      const h = bootVerbs();
      const s = await verbsMidway(h);
      const before = { idx: s.currentIndex, v1: h.el('verbV1').textContent, timer: s.timer };
      h.sandbox.__confirmAnswer = false;
      h.sandbox.__confirmLog.length = 0;
      const r = route.go(h);
      if (route.async) await r; else assert.equal(r, false, route.name + ': switchScreen must report that it did not switch');
      await settle();
      assert.equal(h.sandbox.__confirmLog.length, 1, route.name + ': must ask exactly once');
      assertVerbsStayed(h, before, route.name);
    });
  }
});

suite('Verbs speed run: OK leaves, stops the clock, and the next open is clean', () => {
  test('OK on the ✕', async () => {
    const h = bootVerbs();
    const s = await verbsMidway(h);
    const before = { timer: s.timer };
    const coins = h.state().coins;
    h.sandbox.__confirmAnswer = true;
    h.sandbox.__confirmLog.length = 0;
    tap(h, h.el('speedGameOverlay'), 'exitSpeedGame');
    assert.equal(h.sandbox.__confirmLog.length, 1);
    assertVerbsGone(h, before, '✕');
    assert.equal(activeScreen(h), 'speedChallengeScreen', 'the ✕ leaves the child on the Verbs tab');
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'the bar must be free after the ✕');
    assert.equal(h.sandbox.__confirmLog.length, 0);
    await openVerbs(h);
    assert.falsy(h.sandbox.isSpeedGameActive(), 'a ghost run on reopening');
    assert.equal(h.state().coins, coins, 'a dropped run must not pay');
    assert.equal(((h.state().speedChallenge || {}).history || []).length, 0, 'a dropped run must not be in the history');
  });

  test('OK on the bottom bar', async () => {
    const h = bootVerbs();
    const s = await verbsMidway(h);
    const before = { timer: s.timer };
    h.sandbox.__confirmAnswer = true;
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'saying yes must leave');
    assert.equal(h.sandbox.__confirmLog.length, 1);
    assertVerbsGone(h, before, 'Home');
    assert.equal(activeScreen(h), 'homeScreen');
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('mathHubScreen'), true);
    assert.equal(h.sandbox.__confirmLog.length, 0, 'nothing left to ask about');
  });
});

suite('Verbs speed run: finished, nothing asks and nothing blocks', () => {
  test('the result overlay, Continue, and every exit after it', async () => {
    const h = bootVerbs();
    const s = await startVerbs(h);
    const coins0 = h.state().coins;
    let lastTimer = null;
    for (let i = 0; i < s.currentVerbs.length; i++) { lastTimer = s.timer; answerVerb(h, true); }
    // (B) the run is over: scored, paid, the clock stopped.
    assert.falsy(h.sandbox.isSpeedGameActive(), 'the game overlay must be down once the results show');
    assert.truthy(h.el('speedCompleteOverlay').classList.contains('active'), 'the result overlay is up');
    assert.truthy(h.cleared.includes(lastTimer), 'the last question\'s clock is still ticking');
    assert.equal(h.state().coins, coins0 + s.currentVerbs.length * 5, '5 coins a verb, once');
    assert.equal(h.state().speedChallenge.history.length, 1, 'one history row');
    assert.equal(h.sandbox.buildStudyCheckpoint(), null, 'a finished run must not be checkpointed');
    // The result overlay's one button hands the bottom bar back.
    h.sandbox.__confirmAnswer = false;
    h.sandbox.__confirmLog.length = 0;
    tap(h, h.el('speedCompleteOverlay'), 'closeSpeedComplete');
    assert.falsy(h.el('speedCompleteOverlay').classList.contains('active'));
    assert.truthy(navShown(h), 'Continue must restore the bottom bar');
    assert.equal(h.el('totalPlayed').textContent, '1', 'the leaderboard counts the game');
    assert.equal(h.sandbox.switchScreen('homeScreen'), true, 'Home must open with no question');
    assert.equal(h.sandbox.switchScreen('mathHubScreen'), true);
    assert.equal(h.sandbox.switchScreen('learnHubScreen'), true);
    await h.sandbox.openPetBattle(); await settle(10);
    assert.equal(activeScreen(h), 'petBattleScreen', 'Arena must open with no question');
    assert.equal(h.sandbox.__confirmLog.length, 0, 'asked ' + h.sandbox.__confirmLog.length + ' times after the run was over');
    // (C) the tab reopens clean and nothing is paid twice.
    await openVerbs(h);
    assert.falsy(h.sandbox.isSpeedGameActive());
    assert.equal(h.state().coins, coins0 + s.currentVerbs.length * 5, 'coins changed on reopening the tab');
    assert.equal(h.state().speedChallenge.history.length, 1);
    assert.equal(h.el('bottomNav').style.display, 'flex');
  });

  test('even before Continue is tapped, a switchScreen from code asks nothing', async () => {
    // The result overlay covers the bar, so a child cannot tap it — but the
    // finished run must not be mistaken for a live one by any code path.
    const h = bootVerbs();
    const s = await startVerbs(h);
    for (let i = 0; i < s.currentVerbs.length; i++) answerVerb(h, true);
    h.sandbox.__confirmAnswer = false;
    h.sandbox.__confirmLog.length = 0;
    assert.equal(h.sandbox.switchScreen('homeScreen'), true);
    assert.equal(h.sandbox.__confirmLog.length, 0);
    tap(h, h.el('speedCompleteOverlay'), 'closeSpeedComplete');
    assert.truthy(navShown(h));
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
