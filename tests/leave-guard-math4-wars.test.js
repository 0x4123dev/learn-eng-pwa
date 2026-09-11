// leave-guard-math4-wars.test.js — the three Toán 4 activities in the Math hub
// and the roads OUT of them, driven the way a child taps them.
//
// The rule, for every exercise in the app:
//   (A) while a round is in progress, every way out — the bottom bar, the
//       Arena button, a daily-task deep link, the ✕ on the card, the hub's own
//       back buttons — asks first. Cancel keeps the child on the SAME question
//       with the clock still running; OK leaves and tears the round down
//       (state null, clock stopped, bottom bar back, checkpoint gone).
//   (B) once the result screen is up, leaving is free: no confirm, nothing
//       hidden, no stale "active" flag.
//   (C) the next open of the tab is clean: menu, no ghost round, coins paid
//       exactly once, no checkpoint offering the finished round back.
//
// Executed against the real app booted through tests/verify/client.js —
// every start and every exit here is the exact onclick the screen renders,
// read back out of mathHubScreen.innerHTML, never a function name typed from
// memory. The Math tab is a lazy code group (js/lazy-data.js), so each boot
// waits for it the way switchScreen does.
//
// Scope: Toán 4 Mix, Toán 4 Pre (js/math.js), Bảng cửu chương
// (js/math-tables.js), Math Wars solo (js/mathwars.js).
const { suite, test, assert } = require('./harness');
const { mountApp, loginTestUser } = require('./verify/client.js');

const CK = 'flashlingo-study-checkpoint-v1';           // js/app.js STUDY_CHECKPOINT_KEY
const settle = async (n) => { for (let i = 0; i < (n || 8); i++) await new Promise((r) => setImmediate(r)); };

async function boot(overrides) {
  const h = mountApp();
  loginTestUser(h, Object.assign({ coins: 100 }, overrides || {}));
  h.sandbox.switchScreen('mathHubScreen');
  await settle();
  await h.sandbox.LazyData.ensure('mathHubScreen');
  await settle();
  assert.truthy(h.sandbox.LazyData.ready('mathHubScreen'), 'the math group must have landed');
  // The sandbox's clearInterval is a no-op; record the calls so "the clock
  // stopped" is something this file can actually see.
  h.cleared = [];
  h.sandbox.clearInterval = (id) => h.cleared.push(id);
  h.sandbox.__confirmAnswer = true;
  h.sandbox.__confirmLog.length = 0;
  return h;
}

const hub = (h) => h.el('mathHubScreen');
const onclicks = (h) => [...hub(h).innerHTML.matchAll(/onclick="([^"]+)"/g)].map((m) => m[1]);
// Tap a button by the exact onclick the screen rendered. Fails loudly if the
// screen does not actually offer it — a route this file believes in but the
// child cannot reach is not a route.
function tap(h, code) {
  assert.contains(onclicks(h), code, 'the screen does not render onclick="' + code + '" — it offers: ' + onclicks(h).join(' | '));
  return h.run(code);
}
const navHidden = (h) => h.el('bottomNav').style.display === 'none';
// Tap the hub's ‹ until the Math home menu shows — a child who has just
// finished a round is standing in Toán 4 / cửu chương / Math Wars, not at home.
function goHome(h) {
  for (let i = 0; i < 4 && !onclicks(h).includes("openMathSection('toan4')"); i++) {
    const back = onclicks(h).find((c) => /^openMathSection\('(home|toan4|toan7)'\)$/.test(c));
    assert.truthy(back, 'no ‹ to tap on: ' + onclicks(h).join(' | '));
    tap(h, back);
  }
  assert.contains(onclicks(h), "openMathSection('toan4')", 'the Math home menu');
}
const checkpoint = (h) => { try { return JSON.parse(h.store[CK] || 'null'); } catch (e) { return null; } };
const nothingBlocks = (h, where) => {
  assert.falsy(navHidden(h), where + ': the bottom bar is still hidden');
  assert.falsy(h.el('bottomNav').classList.contains('hidden'), where + ': bottomNav carries .hidden');
  assert.falsy(hub(h).classList.contains('lazy-css-pending'), where + ': the hub is still behind lazy-css-pending');
  assert.falsy(h.doc.documentElement.classList.contains('math-board-open'), where + ': the scratch board still owns the page');
  const board = h.el('mathBoardOverlay');
  if (board) assert.truthy(board.classList.contains('hidden'), where + ': the scratch board overlay is still up');
};

// ---- the activities (two cửu chương drills, one per operation), each
// described by how a child gets in and what
// "still here" means. `clock` names the state whose .timer is the interval id.
const ACTIVITIES = [
  {
    name: 'Toán 4 · Pre',
    open: (h) => { goHome(h); tap(h, "openMathSection('toan4')"); tap(h, 'startMath4Pre()'); },
    active: (h) => h.sandbox.isMathQuizActive(),
    state: (h) => h.peek('_mathQuiz'),
    quit: 'mathQuizQuit()',
    hubBacks: [],                       // the card hides every hub button
    // The ✕ asks only once there is work to lose (tests/math-exam-lock.test.js
    // pins that for Toán 7) — so answer one before trying it.
    answerOne: (h) => { const st = h.peek('_mathQuiz'); const q = st.questions[st.idx]; tap(h, 'answerMathQuestion(' + q.correct + ')'); },
    finish: (h) => {
      const S = h.sandbox;
      for (let i = 0; i < 40 && S.isMathQuizActive(); i++) {
        const st = h.peek('_mathQuiz');
        if (st.answers[st.idx] === null) tap(h, 'answerMathQuestion(' + st.questions[st.idx].correct + ')');
        else tap(h, 'nextMathQuestion()');
      }
    },
    done: 'renderMathHome()',
    history: (h) => h.state().mathHistory.length,
    expectedCoins: (h) => 10 * h.peek('MATH_COINS_PER_CORRECT') + h.peek('MATH4_PRE_PERFECT_BONUS'),
    checkpointKind: 'math',
  },
  {
    name: 'Toán 4 · Mix',
    open: (h) => { goHome(h); tap(h, "openMathSection('toan4')"); tap(h, 'startMath4Mix()'); },
    active: (h) => h.sandbox.isMathQuizActive(),
    state: (h) => h.peek('_mathQuiz'),
    quit: 'mathQuizQuit()',
    hubBacks: [],
    answerOne: (h) => fillMix(h),
    finish: (h) => {
      const S = h.sandbox;
      for (let i = 0; i < 40 && S.isMathQuizActive(); i++) {
        const st = h.peek('_mathQuiz');
        if (st.answers[st.idx] === null) fillMix(h);
        else tap(h, 'nextMathQuestion()');
      }
    },
    done: 'renderMathHome()',
    history: (h) => h.state().mathHistory.length,
    expectedCoins: (h) => 10 * h.peek('MATH_COINS_PER_CORRECT') + h.peek('MATH4_MIX_PERFECT_BONUS'),
    checkpointKind: 'math',
  },
  {
    name: 'Bảng cửu chương · nhân 2–5',
    open: (h) => { goHome(h); tap(h, "openMathSection('toan4')"); tap(h, "openMathSection('cuuchuong')"); tap(h, "startMathTables('x','2345')"); },
    active: (h) => h.sandbox.isMathTablesActive(),
    state: (h) => h.peek('_tablesQuiz'),
    clock: true,
    quit: 'mathTablesQuit()',
    hubBacks: ["openMathSection('toan4')", "openMathSection('home')", "openMathSection('toan7')", "openMathSection('wars')"],
    answerOne: (h) => { const st = h.peek('_tablesQuiz'); tap(h, 'answerMathTables(' + st.questions[st.idx].correct + ')'); },
    finish: (h) => {
      const S = h.sandbox;
      for (let i = 0; i < 20 && S.isMathTablesActive(); i++) {
        const st = h.peek('_tablesQuiz');
        tap(h, 'answerMathTables(' + st.questions[st.idx].correct + ')');
      }
    },
    done: 'mathTablesBackToMenu()',
    history: (h) => h.state().mathHistory.length,
    expectedCoins: (h) => 10 * h.peek('TABLES_COINS_PER_CORRECT') + h.peek('TABLES_PERFECT_BONUS'),
    timeout: (h) => { h.sandbox.mathTablesExpireForTest(); h.sandbox.mathTablesClockTick(); },
  },
  {
    name: 'Bảng cửu chương · chia 8–9',
    open: (h) => { goHome(h); tap(h, "openMathSection('toan4')"); tap(h, "openMathSection('cuuchuong')"); tap(h, "startMathTables('d','89')"); },
    active: (h) => h.sandbox.isMathTablesActive(),
    state: (h) => h.peek('_tablesQuiz'),
    clock: true,
    quit: 'mathTablesQuit()',
    hubBacks: ["openMathSection('toan4')", "openMathSection('home')"],
    answerOne: (h) => { const st = h.peek('_tablesQuiz'); tap(h, 'answerMathTables(' + st.questions[st.idx].correct + ')'); },
    finish: (h) => {
      const S = h.sandbox;
      for (let i = 0; i < 20 && S.isMathTablesActive(); i++) {
        const st = h.peek('_tablesQuiz');
        tap(h, 'answerMathTables(' + st.questions[st.idx].correct + ')');
      }
    },
    done: 'mathTablesBackToMenu()',
    history: (h) => h.state().mathHistory.length,
    expectedCoins: (h) => 10 * h.peek('TABLES_COINS_PER_CORRECT') + h.peek('TABLES_PERFECT_BONUS'),
    timeout: (h) => { h.sandbox.mathTablesExpireForTest(); h.sandbox.mathTablesClockTick(); },
  },
  {
    name: 'Math Wars',
    open: (h) => { goHome(h); tap(h, "openMathSection('wars')"); tap(h, 'startWarsRound()'); },
    active: (h) => h.sandbox.isWarsActive(),
    state: (h) => h.peek('_warsQuiz'),
    clock: true,
    quit: 'warsQuit()',
    hubBacks: ["openMathSection('home')", "openMathSection('toan4')", "openMathSection('toan7')"],
    answerOne: (h) => { const st = h.peek('_warsQuiz'); tap(h, 'answerWars(' + st.questions[st.idx].correct + ')'); },
    finish: (h) => {
      const S = h.sandbox;
      for (let i = 0; i < 20 && S.isWarsActive(); i++) {
        const st = h.peek('_warsQuiz');
        tap(h, 'answerWars(' + st.questions[st.idx].correct + ')');
      }
    },
    done: 'renderMathHome()',
    history: (h) => h.state().warsHistory.length,
    expectedCoins: (h) => 10 * h.peek('WARS_COINS_PER_CORRECT') + h.peek('WARS_PERFECT_BONUS'),
    checkpointKind: 'mathwars',
    timeout: (h) => { const st = h.peek('_warsQuiz'); if (st) st.endsAt = Date.now() - 1; h.sandbox.warsClockTick(); },
  },
];

// Toán 4 Mix: the boxes are real inputs and one press marks the whole
// question (js/math.js submitMathTyped, math4Values reads the DOM).
function fillMix(h) {
  const st = h.peek('_mathQuiz');
  const q = st.questions[st.idx];
  assert.truthy(Array.isArray(q.answerParts) && q.answerParts.length, 'a Mix question carries answerParts');
  q.answerParts.forEach((part, i) => {
    const el = h.el('mathPart' + i);
    assert.truthy(el, 'input #mathPart' + i + ' is on screen');
    el.value = String(part.answer);
  });
  tap(h, 'submitMathTyped()');
}

// What "the same question" means, captured before an exit is tried and
// compared after Cancel. The clock's interval id is part of it: a Cancel that
// quietly restarted the timer would be a leak, not a stay.
function snapshot(h, a) {
  const st = a.state(h);
  return {
    idx: st.idx,
    q: JSON.stringify(st.questions[st.idx]),
    answered: Array.isArray(st.answers) ? st.answers.filter((x) => x !== null).length : 0,
    timer: st.timer,
    endsAt: st.endsAt,
    screen: hub(h).innerHTML,
  };
}
function stillHere(h, a, before, route) {
  assert.truthy(a.active(h), route + ': Cancel must keep the round running');
  const after = snapshot(h, a);
  assert.equal(after.idx, before.idx, route + ': Cancel moved the child to another question');
  assert.equal(after.q, before.q, route + ': Cancel changed the question under the child');
  assert.equal(after.answered, before.answered, route + ': Cancel lost or gained an answer');
  if (a.clock) {
    assert.equal(after.timer, before.timer, route + ': Cancel replaced the clock');
    assert.equal(after.endsAt, before.endsAt, route + ': Cancel moved the deadline');
    assert.equal(h.cleared.length, 0, route + ': Cancel stopped the clock (' + h.cleared.length + ' clearInterval calls)');
  }
  assert.truthy(hub(h).classList.contains('active'), route + ': Cancel left the Math tab');
  assert.equal(after.screen, before.screen, route + ': Cancel repainted the card');
  assert.truthy(navHidden(h), route + ': the bar is meant to stay away for the whole round');
}
function gone(h, a, route) {
  assert.falsy(a.active(h), route + ': OK must end the round');
  assert.equal(a.state(h), null, route + ': OK must null the round state');
  assert.falsy(navHidden(h), route + ': OK must give the bottom bar back');
  assert.equal(checkpoint(h), null, route + ': OK must clear the study checkpoint');
  if (a.clock) assert.truthy(h.cleared.length >= 1, route + ': OK must stop the round clock');
}

// Every road out of a running round, as a child would take it. Each returns
// what switchScreen returned (false = stayed) or undefined for in-screen taps.
function exitRoutes(a) {
  const routes = [
    { name: 'bottom bar → Home', go: (h) => h.sandbox.switchScreen('homeScreen') },
    { name: 'bottom bar → Eng (Learn hub)', go: (h) => h.sandbox.switchScreen('learnHubScreen') },
    { name: 'bottom bar → Arena (openPetBattle)', go: (h) => { h.sandbox.openPetBattle(); } },
    { name: 'daily-task deep link (DailyTask.go → wordformScreen)', go: (h) => h.sandbox.DailyTask.go('wordform:10') },
    { name: 'the ✕ on the card (' + a.quit + ')', go: (h) => tap(h, a.quit) },
  ];
  for (const back of a.hubBacks) routes.push({ name: 'hub back button ' + back, go: (h) => h.sandbox[back.match(/^(\w+)/)[1]].apply(null, [back.match(/'([^']+)'/)[1]]) });
  return routes;
}

for (const a of ACTIVITIES) {
  suite('leave guard · ' + a.name, () => {
    test('(A) every way out asks first, and Cancel keeps the same question with the clock running', async () => {
      const h = await boot();
      const S = h.sandbox;
      a.open(h);
      assert.truthy(a.active(h), 'the round did not start');
      assert.truthy(navHidden(h), 'the bar goes away for the round');
      if (a.answerOne) a.answerOne(h);
      assert.truthy(a.active(h), 'still running after one answer');
      if (a.checkpointKind) assert.equal((checkpoint(h) || {}).kind, a.checkpointKind, 'the round is checkpointed while it runs');
      S.__confirmAnswer = false;
      for (const r of exitRoutes(a)) {
        S.__confirmLog.length = 0;
        const before = snapshot(h, a);
        const res = await r.go(h);
        assert.equal(S.__confirmLog.length, 1, r.name + ': must ask exactly once (asked ' + S.__confirmLog.length + ')');
        if (res !== undefined) assert.equal(res, false, r.name + ': must report that the child stayed');
        stillHere(h, a, before, r.name);
        await settle();
        stillHere(h, a, before, r.name + ' (after settling)');
      }
      // Tapping the Toán tab itself is not a way out: it redraws the round.
      S.__confirmLog.length = 0;
      const before = snapshot(h, a);
      assert.equal(S.switchScreen('mathHubScreen'), true);
      await settle();
      assert.equal(S.__confirmLog.length, 0, 'the Toán tab must not ask — it is where the round lives');
      assert.truthy(a.active(h), 'the Toán tab must not end the round');
      assert.equal(a.state(h).idx, before.idx);
      assert.contains(onclicks(h), a.quit, 'the round is still on screen');
    });

    test('(A) OK on the bottom bar leaves cleanly: state null, clock stopped, bar back, checkpoint gone', async () => {
      const h = await boot();
      const S = h.sandbox;
      const coins = h.state().coins;
      a.open(h);
      if (a.answerOne) a.answerOne(h);
      S.__confirmAnswer = true; S.__confirmLog.length = 0;
      assert.equal(S.switchScreen('homeScreen'), true, 'saying yes must leave');
      assert.equal(S.__confirmLog.length, 1);
      gone(h, a, 'Home');
      assert.truthy(h.el('homeScreen').classList.contains('active'), 'and land on Home');
      assert.equal(h.state().coins, coins, 'an abandoned round pays nothing');
      assert.equal(a.history(h), 0, 'and is not a result');
    });

    test('(A) OK on the ✕ leaves cleanly too', async () => {
      const h = await boot();
      const S = h.sandbox;
      a.open(h);
      if (a.answerOne) a.answerOne(h);
      S.__confirmAnswer = true; S.__confirmLog.length = 0;
      tap(h, a.quit);
      assert.equal(S.__confirmLog.length, 1, 'the ✕ asks');
      gone(h, a, '✕');
      assert.truthy(hub(h).classList.contains('active'), 'the ✕ stays inside the Math tab');
      assert.falsy(onclicks(h).includes(a.quit), 'the card is gone');
      assert.truthy(onclicks(h).some((c) => /^openMathSection|^startMath|^startWars|^switchWarsView/.test(c)), 'a menu is back: ' + onclicks(h).join(' | '));
    });

    if (a.hubBacks.length) {
      test('(A) OK on a hub back button leaves cleanly', async () => {
        const h = await boot();
        const S = h.sandbox;
        a.open(h);
        if (a.answerOne) a.answerOne(h);
        S.__confirmAnswer = true; S.__confirmLog.length = 0;
        S.openMathSection('home');
        assert.equal(S.__confirmLog.length, 1, 'the hub back button asks');
        gone(h, a, "openMathSection('home')");
        assert.contains(onclicks(h), "openMathSection('toan4')", 'the Math home menu is back');
      });
    }

    test('(B) once finished, leaving is free — no confirm, nothing hidden, no stale flag', async () => {
      const h = await boot();
      const S = h.sandbox;
      const bodyClass = h.doc.body.className;
      const coins = h.state().coins;
      a.open(h);
      a.finish(h);
      assert.falsy(a.active(h), 'the round is over');
      assert.equal(a.state(h), null, 'the round state is nulled');
      assert.truthy(h.state().coins - coins >= a.expectedCoins(h), 'paid at least the per-question rate and the 10/10 bonus (' + (h.state().coins - coins) + ')');
      assert.equal(a.history(h), 1, 'one result was written');
      assert.equal(checkpoint(h), null, 'a finished round leaves no checkpoint');
      assert.contains(onclicks(h), a.done, 'the result screen offers its own way back');
      nothingBlocks(h, 'result screen');
      assert.equal(h.doc.body.className, bodyClass, 'no body class left behind');
      if (a.clock) assert.truthy(h.cleared.length >= 1, 'the clock was stopped at the finish');
      // The result's own way back, no question asked.
      S.__confirmLog.length = 0;
      tap(h, a.done);
      assert.equal(S.__confirmLog.length, 0, 'the result\'s own back button must not ask');
      nothingBlocks(h, 'after the result\'s own back button');
      assert.falsy(onclicks(h).includes(a.done), 'the result screen is gone');
      assert.truthy(onclicks(h).some((c) => /^openMathSection|^startMath|^startWars|^switchWarsView/.test(c)), 'a menu is back: ' + onclicks(h).join(' | '));
      // And every other road out of a fresh result, no question asked.
      a.open(h); a.finish(h);
      assert.falsy(a.active(h));
      assert.contains(onclicks(h), a.done);
      S.__confirmLog.length = 0;
      assert.equal(S.switchScreen('homeScreen'), true, 'Home must open at once');
      assert.equal(S.switchScreen('learnHubScreen'), true, 'Learn must open at once');
      S.openPetBattle(); await settle();
      assert.truthy(h.el('petBattleScreen').classList.contains('active'), 'the Arena must open at once');
      assert.equal(await S.DailyTask.go('wordform:10'), true, 'a daily-task deep link must go through');
      assert.truthy(h.el('wordformScreen').classList.contains('active'), 'and land where it points');
      if (S.isWordformQuizActive()) S.abandonWordformQuiz();   // the link started one; not ours
      S.switchScreen('mathHubScreen'); await settle();
      assert.equal(S.__confirmLog.length, 0, 'none of that may ask (' + S.__confirmLog.join(' || ') + ')');
      nothingBlocks(h, 'back on the Math tab');
      assert.falsy(a.active(h), 'no stale active flag');
    });

    test('(C) the next open is clean: a menu, no ghost round, coins paid exactly once', async () => {
      const h = await boot();
      const S = h.sandbox;
      a.open(h);
      a.finish(h);
      const paid = h.state().coins;
      const hist = a.history(h);
      // Anything that could pay a second time: a late clock tick, a repeated
      // finish, the tab being repainted.
      if (a.timeout) { try { a.timeout(h); } catch (e) { throw new Error('a late tick threw: ' + e.message); } }
      S.renderMathHome();
      S.switchScreen('homeScreen');
      S.switchScreen('mathHubScreen'); await settle();
      assert.equal(h.state().coins, paid, 'coins must not move again');
      assert.equal(a.history(h), hist, 'no second result');
      assert.falsy(a.active(h), 'no ghost round');
      assert.equal(checkpoint(h), null, 'no checkpoint offering the finished round back');
      assert.falsy(navHidden(h));
      // Starting again is a fresh round from question 1, and the same
      // buttons the child used the first time are back.
      S.__confirmLog.length = 0;
      a.open(h);
      assert.equal(S.__confirmLog.length, 0, 'starting a new round must not ask about the old one');
      assert.truthy(a.active(h));
      assert.equal(a.state(h).idx, 0, 'fresh round starts at question 1');
      assert.equal(a.state(h).answers.filter((x) => x !== null).length, 0, 'with nothing answered');
      assert.truthy(navHidden(h));
      S.__confirmAnswer = true;
      assert.equal(S.switchScreen('homeScreen'), true);
      gone(h, a, 'second round, Home');
    });

    test('(C) after an abandoned round the next open is clean too', async () => {
      const h = await boot();
      const S = h.sandbox;
      const coins = h.state().coins;
      a.open(h);
      if (a.answerOne) a.answerOne(h);
      S.__confirmAnswer = true;
      S.switchScreen('homeScreen');
      // A tick from the old clock, if one were somehow still armed, must be
      // inert: the state is gone, so it has nothing to finish.
      for (const t of h.timers) if (t.kind === 'interval') { try { t.fn(); } catch (e) { throw new Error('a stale tick threw: ' + e.message); } }
      assert.falsy(a.active(h), 'a stale tick must not resurrect the round');
      assert.equal(h.state().coins, coins, 'a stale tick must not pay');
      assert.equal(a.history(h), 0);
      S.switchScreen('mathHubScreen'); await settle();
      assert.falsy(a.active(h), 'no ghost round on reopening the tab');
      assert.equal(checkpoint(h), null);
      assert.truthy(onclicks(h).length > 0, 'a menu rendered');
      assert.falsy(onclicks(h).includes(a.quit), 'not the old card');
      S.__confirmLog.length = 0;
      a.open(h);
      assert.equal(S.__confirmLog.length, 0);
      assert.equal(a.state(h).idx, 0, 'a fresh round');
    });

    if (a.timeout) {
      test('(B) a round that runs out of time is finished the same way: free to leave, paid once', async () => {
        const h = await boot();
        const S = h.sandbox;
        const coins = h.state().coins;
        a.open(h);
        if (a.answerOne) a.answerOne(h);
        a.timeout(h);
        assert.falsy(a.active(h), 'the clock ending finishes the round');
        assert.equal(a.state(h), null);
        assert.equal(a.history(h), 1, 'a timed-out round is still a result');
        const paid = h.state().coins;
        assert.truthy(paid > coins, 'the one right answer was paid');
        assert.equal(checkpoint(h), null);
        nothingBlocks(h, 'timed-out result');
        assert.truthy(h.cleared.length >= 1, 'the clock was stopped');
        a.timeout(h);                                   // a second, late tick
        assert.equal(h.state().coins, paid, 'a late tick must not pay again');
        assert.equal(a.history(h), 1);
        S.__confirmLog.length = 0;
        assert.equal(S.switchScreen('homeScreen'), true);
        assert.equal(S.__confirmLog.length, 0, 'leaving a timed-out result must not ask');
      });
    }
  });
}

// ---- things that are specific to one activity -----------------------------

suite('leave guard · Bảng cửu chương specifics', () => {
  test('the 10/10 bonus is in the coins exactly once, and only for a clean round', async () => {
    const h = await boot();
    const S = h.sandbox;
    const PER = h.peek('TABLES_COINS_PER_CORRECT'), BONUS = h.peek('TABLES_PERFECT_BONUS');
    assert.truthy(PER > 0 && BONUS > 0, 'the rates are readable');
    const coins = h.state().coins;
    tap(h, "openMathSection('toan4')"); tap(h, "openMathSection('cuuchuong')"); tap(h, "startMathTables('d','67')");
    const st = h.peek('_tablesQuiz');
    // Nine right, one wrong: no bonus.
    tap(h, 'answerMathTables(' + ((st.questions[0].correct + 1) % 4) + ')');
    while (S.isMathTablesActive()) { const s = h.peek('_tablesQuiz'); tap(h, 'answerMathTables(' + s.questions[s.idx].correct + ')'); }
    const paid = h.state().coins - coins;
    const run = h.state().mathHistory[0];
    assert.equal(run.score, 9);
    assert.equal(run.total, 10);
    assert.truthy(paid < 9 * PER + BONUS, 'no 10/10 bonus for 9/10 (paid ' + paid + ')');
    assert.truthy(paid >= 9 * PER, 'but the nine right answers were paid (paid ' + paid + ')');
    assert.falsy(/Thưởng đúng 100%/.test(hub(h).innerHTML), 'the result must not advertise a bonus it did not pay');
    // A clean round: the bonus, once, and the result says so.
    const before = h.state().coins;
    tap(h, 'mathTablesBackToMenu()');
    tap(h, "startMathTables('d','67')");
    while (S.isMathTablesActive()) { const s = h.peek('_tablesQuiz'); tap(h, 'answerMathTables(' + s.questions[s.idx].correct + ')'); }
    const paid2 = h.state().coins - before;
    assert.truthy(paid2 >= 10 * PER + BONUS, '10/10 pays the bonus (paid ' + paid2 + ')');
    assert.truthy(paid2 < 10 * PER + 2 * BONUS, 'and pays it once (paid ' + paid2 + ')');
    assert.truthy(/Thưởng đúng 100%/.test(hub(h).innerHTML), 'the result shows the bonus');
    const after = h.state().coins;
    S.mathTablesClockTick(); S.finishMathTables(true); S.finishMathTables(false); S.renderMathHome();
    assert.equal(h.state().coins, after, 'nothing after the finish pays again');
    assert.equal(h.state().mathHistory.length, 2, 'two rounds, two results');
  });

  test('abandoning stops the round clock, so a tick after leaving is inert', async () => {
    const h = await boot();
    const S = h.sandbox;
    tap(h, "openMathSection('toan4')"); tap(h, "openMathSection('cuuchuong')"); tap(h, "startMathTables('x','89')");
    const id = h.peek('_tablesQuiz').timer;
    assert.truthy(id, 'the round armed a clock');
    S.__confirmAnswer = true;
    S.switchScreen('homeScreen');
    assert.contains(h.cleared, id, 'abandonMathTables must clearInterval the round clock');
    const coins = h.state().coins;
    S.mathTablesClockTick();
    assert.falsy(S.isMathTablesActive());
    assert.equal(h.state().coins, coins, 'a tick after abandoning must not score');
    assert.equal(h.state().mathHistory.length, 0);
  });
});

suite('leave guard · Math Wars specifics', () => {
  test('abandoning stops the 250 ms clock and drops the checkpoint at once', async () => {
    const h = await boot();
    const S = h.sandbox;
    tap(h, "openMathSection('wars')"); tap(h, 'startWarsRound()');
    const id = h.peek('_warsQuiz').timer;
    const armed = h.timers[id - 1];
    assert.truthy(armed && armed.kind === 'interval' && armed.ms === 250, 'the round runs on a 250 ms interval');
    assert.equal((checkpoint(h) || {}).kind, 'mathwars', 'checkpointed while running');
    S.__confirmAnswer = true;
    assert.equal(S.switchScreen('homeScreen'), true);
    assert.contains(h.cleared, id, 'abandonWars must clearInterval the round clock');
    assert.equal(checkpoint(h), null, 'the checkpoint must go with the round, not wait for the next tap');
    const coins = h.state().coins;
    armed.fn();                                          // the old tick, if it ever fired
    assert.falsy(S.isWarsActive());
    assert.equal(h.state().coins, coins, 'must not score');
    assert.equal(h.state().warsHistory.length, 0);
  });

  test('the result screen\'s ‹ and "Đấu lại" both work without a confirm', async () => {
    const h = await boot();
    const S = h.sandbox;
    tap(h, "openMathSection('wars')"); tap(h, 'startWarsRound()');
    while (S.isWarsActive()) { const s = h.peek('_warsQuiz'); tap(h, 'answerWars(' + s.questions[s.idx].correct + ')'); }
    S.__confirmLog.length = 0;
    tap(h, 'startWarsRound()');                          // Đấu lại
    assert.equal(S.__confirmLog.length, 0, 'a rematch from the result must not ask');
    assert.truthy(S.isWarsActive());
    assert.equal(h.peek('_warsQuiz').idx, 0);
    S.__confirmAnswer = true;
    tap(h, 'warsQuit()');
    assert.falsy(S.isWarsActive());
    tap(h, 'startWarsRound()');
    while (S.isWarsActive()) { const s = h.peek('_warsQuiz'); tap(h, 'answerWars(' + s.questions[s.idx].correct + ')'); }
    S.__confirmLog.length = 0;
    tap(h, 'renderMathHome()');                          // the ‹ on the result
    assert.equal(S.__confirmLog.length, 0);
    assert.contains(onclicks(h), 'startWarsRound()', 'back on the Math Wars home');
    assert.falsy(navHidden(h));
  });
});

suite('leave guard · Toán 4 specifics', () => {
  test('the scratch board opened mid-paper is closed by the exit, not left over the next screen', async () => {
    const h = await boot();
    const S = h.sandbox;
    tap(h, "openMathSection('toan4')"); tap(h, 'startMath4Mix()');
    fillMix(h);
    // The board builds its <canvas> through innerHTML, past the harness's
    // createElement stub — give the shim a 2D context that draws nothing.
    const { El } = require('./domshim');
    const hadCtx = Object.prototype.hasOwnProperty.call(El.prototype, 'getContext');
    El.prototype.getContext = function () {
      return new Proxy({ canvas: this }, { get: (t, k) => (k in t ? t[k] : () => undefined) });
    };
    try { tap(h, 'openMathBoard()'); }
    finally { if (!hadCtx) delete El.prototype.getContext; }
    assert.truthy(h.doc.documentElement.classList.contains('math-board-open') || !h.el('mathBoardOverlay').classList.contains('hidden'), 'the board opened');
    S.__confirmAnswer = false;
    assert.equal(S.switchScreen('homeScreen'), false, 'asks even with the board up');
    assert.truthy(S.isMathQuizActive());
    S.__confirmAnswer = true;
    assert.equal(S.switchScreen('homeScreen'), true);
    nothingBlocks(h, 'Home after leaving with the board open');
    assert.truthy(h.el('homeScreen').classList.contains('active'));
  });

  test('a Pre paper with mistakes still frees the bar and leaves without asking', async () => {
    const h = await boot();
    const S = h.sandbox;
    tap(h, "openMathSection('toan4')"); tap(h, 'startMath4Pre()');
    for (let i = 0; i < 40 && S.isMathQuizActive(); i++) {
      const st = h.peek('_mathQuiz');
      if (st.answers[st.idx] === null) tap(h, 'answerMathQuestion(' + ((st.questions[st.idx].correct + 1) % 4) + ')');
      else tap(h, 'nextMathQuestion()');
    }
    assert.falsy(S.isMathQuizActive());
    assert.equal(h.state().mathHistory.length, 1);
    assert.equal(h.state().mathHistory[0].score, 0);
    nothingBlocks(h, '0/10 result');
    S.__confirmLog.length = 0;
    assert.equal(S.switchScreen('homeScreen'), true);
    assert.equal(S.__confirmLog.length, 0, 'a finished paper, however bad, is free to leave');
    assert.equal(checkpoint(h), null);
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
