// math-fight-score-integrity.test.js — a score, once submitted, is final.
//
// Reported from a real match (2026-08-29): a child answered all 20 correctly
// and finished FIRST, and the result screen showed CON 0 — BẠN ẤY 10.
//
// The cause: POST /api/math-fight/progress rewrites a side's score from the
// answer array the client sends, with no check that the side has already
// submitted. The child who finishes first keeps polling `progress` while
// waiting for the opponent — and any poll carrying an emptier array (a
// reload, a re-opened screen, a fresh module state) overwrote 20 correct
// answers with 0.
//
// These run the real handlers against a real SQLite database
// (tests/pages-harness.js), because this is exactly the kind of bug that
// reads fine in the source and destroys a child's win in production.
const { suite, test, assert } = require('./harness');
const path = require('path');
const { createWorld, loadModule } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const MF = require(path.join(ROOT, 'js', 'math-fight-rules.js'));
const wars = require(path.join(ROOT, 'js', 'mathwars.js'));
// On the device the question bank is a global script; mirror that so the
// shared builder can be called exactly the way the client calls it.
const { MATH_FIGHT_BANK } = require(path.join(ROOT, 'js', 'math-fight-bank.js'));
global.MATH_FIGHT_BANK = MATH_FIGHT_BANK;
global.MathFightRules = MF;
global.warsQuestions = wars.warsQuestions;

const progressHandler = () => loadModule('functions/api/math-fight/progress.js');
const submitHandler = () => loadModule('functions/api/math-fight/submit.js');

const SEED = 123456;
const FIGHT_ID = 'a'.repeat(32);

// The answers that score full marks for one side, computed the same way the
// server does — so "20/20" in these tests means genuinely 20 right.
function perfectAnswers(level) {
  return MF.fightQuestions(SEED, level).map(q => q.answer);
}

async function arena() {
  const world = createWorld();
  const kid = await world.createUser({ username: 'Kid' });
  const friend = await world.createUser({ username: 'Friend' });
  const now = Date.now();
  world.db.prepare(`INSERT INTO math_fights
    (id, challenger_id, opponent_id, seed, challenger_level, opponent_level, prize, status,
     created_at, expires_at, started_at, deadline_at, c_answered, o_answered)
    VALUES (?,?,?,?,?,?,?,'active',?,?,?,?,0,0)`)
    .run(FIGHT_ID, kid.uid, friend.uid, SEED, 3, 3, MF.PRIZE, now, now + 60000, now, now + MF.SECONDS * 1000);
  const row = () => world.db.prepare('SELECT * FROM math_fights WHERE id=?').get(FIGHT_ID);
  const post = (handler, user, body) => world.call(handler, { token: user.token, body });
  return { world, kid, friend, row, post };
}

suite('math fight: a submitted score can never be lowered', () => {
  test('the child who finishes first keeps 20/20 while waiting', async () => {
    const a = await arena();
    const answers = perfectAnswers(3);
    const done = await a.post(submitHandler().onRequestPost, a.kid,
      { fightId: FIGHT_ID, answers, coins: 9000 });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.equal(a.row().c_correct, 20, 'the submission itself must score 20');
    assert.truthy(a.row().c_submitted_at, 'and be marked as submitted');

    // The waiting screen polls `progress` every few seconds. This is the poll
    // that destroyed the win: the module had been re-created, so it carried an
    // empty answer array.
    const poll = await a.post(progressHandler().onRequestPost, a.kid,
      { fightId: FIGHT_ID, answers: [] });
    assert.equal(poll.status, 200);
    assert.equal(a.row().c_correct, 20,
      'a heartbeat must never rewrite a score that is already submitted');
    assert.equal(a.row().c_answered, 20);
  });

  test('a stale poll cannot lower a score that is still being played', async () => {
    // Even before submitting, answers only ever accumulate. An out-of-order
    // poll arriving with fewer answers must not undo the ones already counted.
    const a = await arena();
    const answers = perfectAnswers(3);
    await a.post(progressHandler().onRequestPost, a.kid,
      { fightId: FIGHT_ID, answers: answers.slice(0, 12) });
    assert.equal(a.row().c_correct, 12);
    await a.post(progressHandler().onRequestPost, a.kid,
      { fightId: FIGHT_ID, answers: answers.slice(0, 4) });
    assert.equal(a.row().c_correct, 12, 'a late, emptier poll must not lower the score');
    await a.post(progressHandler().onRequestPost, a.kid,
      { fightId: FIGHT_ID, answers: answers.slice(0, 17) });
    assert.equal(a.row().c_correct, 17, 'real progress still counts');
  });

  test('a forfeit cannot erase a real submission', async () => {
    // Leaving the screen calls submit(forfeit). If the child had already
    // finished, that must not turn their win into a walk-away.
    const a = await arena();
    const answers = perfectAnswers(3);
    await a.post(submitHandler().onRequestPost, a.kid, { fightId: FIGHT_ID, answers, coins: 0 });
    const submittedAt = a.row().c_submitted_at;
    await a.post(submitHandler().onRequestPost, a.kid,
      { fightId: FIGHT_ID, answers: [], forfeit: true, coins: 0 });
    assert.equal(a.row().c_correct, 20, 'the 20 correct answers stand');
    assert.equal(a.row().c_submitted_at, submittedAt, 'and the child is still marked as finished');
  });

  test('the finisher wins when the opponent scores lower', async () => {
    // End to end, the shape from the screenshots: 20 against 10.
    const a = await arena();
    const mine = perfectAnswers(3), theirs = perfectAnswers(3);
    await a.post(submitHandler().onRequestPost, a.kid, { fightId: FIGHT_ID, answers: mine, coins: 0 });
    await a.post(progressHandler().onRequestPost, a.kid, { fightId: FIGHT_ID, answers: [] });
    const opp = theirs.map((v, i) => (i < 10 ? v : null));
    const end = await a.post(submitHandler().onRequestPost, a.friend,
      { fightId: FIGHT_ID, answers: opp, coins: 0 });
    assert.equal(end.status, 200, JSON.stringify(end.data));
    const row = a.row();
    assert.equal(row.status, 'done');
    assert.equal(row.c_correct, 20, 'the child who finished first still has 20');
    assert.equal(row.o_correct, 10);
    assert.equal(row.winner_id, a.kid.uid, 'and must be the winner');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}

// ---------------------------------------------------------------------------
// The screen lock. A five-minute match sits behind the ordinary bottom nav, so
// one mis-tap on Home/Learn/Exam used to drop a child out of a live fight —
// and dropping out is a forfeit that costs the stake. The nav is hidden while
// the questions are on screen, exactly as Night Raid hides it during a raid,
// and comes back the moment the fight is over.
const fs = require('fs');
const vm = require('vm');
const { createDocument } = require('./domshim');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

function mountFight(reply) {
  const doc = createDocument('<div id="mfRoot"></div><div id="bottomNav"></div>');
  const timers = new Set();
  const posts = [];
  const ctx = {
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise, RegExp, Set, Map, isNaN,
    document: doc, window: {}, currentUser: 'z',
    appState: { coins: 1000, dogGrowthXP: 0, mathFightClaimed: {} },
    saveUserData() {}, showToast() {},
    warsProgress: () => ({ level: 2 }),
    warsQuestions: (n) => Array.from({ length: n }, (_, i) => ({
      q: (i + 2) + ' + 3', answer: i + 5, options: [i + 5, i + 4, i + 6, i + 7], correct: 0,
    })),
    confirm: () => true,
    navigator: { vibrate() {} },
    MATH_FIGHT_BANK,          // the bank is a global script on the device
    setInterval: (fn, ms) => { const id = { fn, ms }; timers.add(id); return id; },
    clearInterval: (id) => timers.delete(id),
    setTimeout: (fn) => { fn(); return 0; }, clearTimeout() {},
    EngAuth: { tokenFor: () => 'tok', getAccount: () => ({ id: 11 }),
      api: (p, opts) => { posts.push({ path: 'math-fight/' + p.replace(/^math-fight\/?/, ''), body: (opts || {}).body });
        return Promise.resolve(reply(p, opts)); } },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/math-fight-rules.js'), ctx);
  vm.runInContext(read('js/math-fight.js'), ctx);
  // Buttons in this app carry onclick="mfAnswer(0,3)" attributes; run them in
  // the same sandbox so a tap in a test does what a tap does on the device.
  doc.__runInline = code => vm.runInContext(code, ctx);
  const navDisplay = () => doc.getElementById('bottomNav').style.display;
  return { ctx, doc, navDisplay, posts };
}

const ACTIVE_FIGHT = {
  fightId: 'a'.repeat(32), status: 'active', prize: 200, seed: 7, level: 2,
  role: 'challenger', foeId: 22, startedAt: 1000, deadlineAt: 9e14,
  myCorrect: 0, myAnswered: 0, foeCorrect: 0, foeAnswered: 0, winnerId: null, outcome: null,
};
const listReply = fight => ({ ok: true, data: {
  now: Date.now(), prize: 200, questions: 20, seconds: 300, heartbeatMs: 5000,
  friends: [], fight: fight || null } });

suite('math fight: the screen is locked while the questions are up', () => {
  test('the bottom nav is hidden during a live fight', async () => {
    const h = mountFight(() => listReply(ACTIVE_FIGHT));
    assert.equal(h.navDisplay(), '', 'the nav starts visible');
    await h.ctx.MathFight.refresh();
    assert.equal(h.navDisplay(), 'none',
      'a five-minute match must not sit one mis-tap away from a forfeit');
  });

  test('the nav comes back the moment the fight is decided', async () => {
    // The real path out of a bout: the child submits and the server returns a
    // finished fight, so the result screen paints and the app is handed back.
    const done = Object.assign({}, ACTIVE_FIGHT, {
      status: 'done', myCorrect: 20, foeCorrect: 10, winnerId: 11, outcome: 'win' });
    const h = mountFight(p => p === 'submit'
      ? { ok: true, data: { fight: done, coins: 200 } }
      : listReply(ACTIVE_FIGHT));
    await h.ctx.MathFight.refresh();
    assert.equal(h.navDisplay(), 'none', 'locked while the questions are up');
    await h.ctx.MathFight.submit(false);
    assert.equal(h.navDisplay(), '', 'a decided fight gives the app back');
  });

  test('finishing first unlocks the app while the opponent is still playing', async () => {
    // The child who submits first waits for the verdict. Their score is final
    // by then, so keeping them pinned to a waiting screen would be pointless
    // confinement — and this is exactly where the old code let a stray poll
    // wipe the win.
    const h = mountFight(p => p === 'submit'
      ? { ok: true, data: { fight: ACTIVE_FIGHT, coins: 0 } }
      : listReply(ACTIVE_FIGHT));
    await h.ctx.MathFight.refresh();
    assert.equal(h.navDisplay(), 'none');
    await h.ctx.MathFight.submit(false);
    assert.equal(h.navDisplay(), '', 'waiting is not a lock');
  });

  test('leaving the fight screen always restores the nav', async () => {
    const h = mountFight(() => listReply(ACTIVE_FIGHT));
    await h.ctx.MathFight.refresh();
    assert.equal(h.navDisplay(), 'none');
    h.ctx.MathFight.leave();
    assert.equal(h.navDisplay(), '', 'the nav must never be left hidden');
  });

  test('the leave warning says the match ends and is scored', () => {
    const src = read('js/app.js');
    const at = src.indexOf('MathFight.isFighting');
    const block = src.slice(at - 400, at + 600);
    assert.truthy(/kết thúc|XỬ THUA/i.test(block), 'the child must be told the match ends');
    assert.truthy(block.includes('forfeitNow'), 'and the fight is closed out, not left hanging');
  });
});

// ---------------------------------------------------------------------------
// Question difficulty. A five-minute match against a friend is not the place
// for "3 + 4". Measured before this rule: at the lowest fight level 96 of 200
// generated questions had a single-digit answer — nearly half the match was
// free. Every fight answer now has at least two digits.
//
// The seed must produce the SAME twenty questions on the device and on the
// server, or a child is marked wrong for the right answer. Both sides now call
// one shared builder so they cannot drift apart.
suite('math fight: every question is worth answering', () => {
  const LEVELS = [0, 1, 2, 5, 9, 18];

  test('no fight answer is ever a single digit, at any level', () => {
    assert.truthy(typeof MF.fightQuestions === 'function',
      'one shared builder must own the fight questions');
    for (const level of LEVELS) {
      for (const seed of [1, 4242, 999999]) {
        const qs = MF.fightQuestions(seed, level);
        assert.equal(qs.length, MF.QUESTIONS, `level ${level} must still yield a full round`);
        const easy = qs.filter(q => Math.abs(q.answer) < 10);
        assert.deepEqual(easy.map(q => q.q + ' = ' + q.answer), [],
          `level ${level} handed the child a one-digit answer`);
      }
    }
  });

  test('the same seed builds the same round every time', () => {
    const a = MF.fightQuestions(2026, 3).map(q => q.q + '=' + q.answer);
    const b = MF.fightQuestions(2026, 3).map(q => q.q + '=' + q.answer);
    assert.deepEqual(a, b, 'the round must be reproducible from the seed alone');
  });

  test('the device and the server build the identical round', () => {
    // The client calls the builder through the rules module; the server scores
    // with it. If these ever differ, a child is marked wrong for a right answer.
    const server = loadModule('functions/api/_math-fight.js');
    const perfect = MF.fightQuestions(777, 4).map(q => q.answer);
    const marked = server.scoreAnswers(777, 4, perfect);
    assert.equal(marked.correct, MF.QUESTIONS,
      'answering the device round correctly must score full marks on the server');
    assert.equal(marked.answered, MF.QUESTIONS);
  });

  test('solo Math Wars draws from the same bank, so it is not free either', () => {
    // Both modes now share the one curated set of sums — see
    // tests/mathwars-bank.test.js. The raw generator survives only as the
    // fallback for a device whose lazy-loaded bank has not arrived yet, and
    // it is deliberately still unconstrained there: a round with easy sums
    // beats no round at all.
    const round = wars.warsRoundQuestions(0);
    assert.equal(round.length, wars.WARS_QUESTIONS);
    assert.deepEqual(round.filter(q => q.answer < 10).map(q => q.q), [],
      'practice must not hand out one-digit answers any more');
  });
});

// ---------------------------------------------------------------------------
// The whole thing, once, the way two children actually play it: a challenge is
// sent and accepted, both answer, the server decides, and each wallet moves.
// Every screenshot bug this file was opened for lives somewhere on this path.
suite('math fight: two children can play a match end to end', () => {
  const challengeHandler = () => loadModule('functions/api/math-fight/challenge.js');
  const respondHandler = () => loadModule('functions/api/math-fight/respond.js');

  async function twoFriends() {
    const world = createWorld();
    const kid = await world.createUser({ username: 'Kid' });
    const pal = await world.createUser({ username: 'Pal' });
    // Đấu Toán is behind an admin flag, and a fresh friendship has to wait
    // three days before it may battle — so the fixture ages the friendship.
    world.db.prepare("INSERT OR REPLACE INTO app_flags(key,value,updated_at) VALUES('math_fight',1,0)").run();
    world.db.prepare(`INSERT INTO friendships (requester_id, addressee_id, status, created_at, responded_at)
      VALUES (?,?,'accepted', datetime('now','-10 days'), datetime('now','-10 days'))`)
      .run(kid.uid, pal.uid);
    return { world, kid, pal };
  }

  test('challenge, accept, answer, and both wallets move the right way', async () => {
    const { world, kid, pal } = await twoFriends();
    const post = (h, u, b) => world.call(h, { token: u.token, body: b });

    const invite = await post(challengeHandler().onRequestPost, kid, { friendId: pal.uid, level: 3, foeLevel: 3 });
    assert.equal(invite.status, 200, JSON.stringify(invite.data));
    const fightId = invite.data.fight.fightId;

    const accepted = await post(respondHandler().onRequestPost, pal, { fightId, accept: true });
    assert.equal(accepted.status, 200, JSON.stringify(accepted.data));
    const row = () => world.db.prepare('SELECT * FROM math_fights WHERE id=?').get(fightId);
    assert.equal(row().status, 'active', 'both children are in the bout');

    // Each side draws its OWN round from the shared bank, at its own level.
    const mine = MF.fightQuestions(row().seed, row().challenger_level, MATH_FIGHT_BANK);
    const theirs = MF.fightQuestions(row().seed, row().opponent_level, MATH_FIGHT_BANK);
    assert.equal(mine.length, MF.QUESTIONS);
    assert.deepEqual(mine.filter(q => q.answer < 10).map(q => q.q), [],
      'no free question reaches a real match');

    // The child answers everything; the friend gets eight right.
    await post(submitHandler().onRequestPost, kid,
      { fightId, answers: mine.map(q => q.answer), coins: 9000 });
    await post(progressHandler().onRequestPost, kid, { fightId, answers: [] }); // the poll that used to wipe it
    const end = await post(submitHandler().onRequestPost, pal,
      { fightId, answers: theirs.map((q, i) => (i < 8 ? q.answer : null)), coins: 15850 });
    assert.equal(end.status, 200, JSON.stringify(end.data));

    const done = row();
    assert.equal(done.status, 'done');
    assert.equal(done.c_correct, 20, 'the child who finished first keeps every mark');
    assert.equal(done.o_correct, 8);
    assert.equal(done.winner_id, kid.uid, 'and wins');

    // The coin move each device applies to its own wallet.
    const server = loadModule('functions/api/_math-fight.js');
    assert.equal(server.coinDelta(done, kid.uid, 9000), MF.PRIZE, 'the winner collects the prize');
    assert.equal(server.coinDelta(done, pal.uid, 15850), -MF.PRIZE, 'the loser pays it');
  });

  test('a loser with an empty purse pays nothing', async () => {
    const { world, kid, pal } = await twoFriends();
    const post = (h, u, b) => world.call(h, { token: u.token, body: b });
    const invite = await post(challengeHandler().onRequestPost, kid, { friendId: pal.uid, level: 3, foeLevel: 3 });
    const fightId = invite.data.fight.fightId;
    await post(respondHandler().onRequestPost, pal, { fightId, accept: true });
    const row = world.db.prepare('SELECT * FROM math_fights WHERE id=?').get(fightId);
    const mine = MF.fightQuestions(row.seed, row.challenger_level, MATH_FIGHT_BANK);
    await post(submitHandler().onRequestPost, kid, { fightId, answers: mine.map(q => q.answer), coins: 0 });
    await post(submitHandler().onRequestPost, pal, { fightId, answers: [], coins: 0 });
    const done = world.db.prepare('SELECT * FROM math_fights WHERE id=?').get(fightId);
    const server = loadModule('functions/api/_math-fight.js');
    assert.equal(server.coinDelta(done, pal.uid, 0), 0, 'an empty wallet is never pushed below zero');
  });
});

// ---------------------------------------------------------------------------
// The running scoreboard. The strip showed st.fight.myCorrect — the SERVER's
// count, which only arrives on the five-second pulse. A child who answered the
// first question correctly watched their own score sit at 0 for five seconds
// and reasonably concluded the game was broken.
//
// The device can count its own marks exactly: it holds the same twenty sums
// the server marks, so comparing the chosen value with q.answer is the same
// arithmetic. The opponent's number still comes from the server, because only
// the server knows it.
suite('math fight: my own score updates the moment I answer', () => {
  function bout(reply) {
    const h = mountFight(reply || (() => listReply(ACTIVE_FIGHT)));
    return h.ctx.MathFight.refresh().then(() => h);
  }
  const mine = h => h.doc.getElementById('mfMine').textContent;
  const st = h => h.ctx.MathFight;

  test('answering the first question correctly shows 1 at once', async () => {
    const h = await bout();
    const q = h.ctx.MathFight.__questions()[0];
    assert.equal(mine(h), '0', 'the round starts at zero');
    h.ctx.MathFight.answer(q.correct);
    assert.equal(mine(h), '1', 'the child must see their mark immediately, not in five seconds');
  });

  test('a wrong answer does not raise the score', async () => {
    const h = await bout();
    const q = h.ctx.MathFight.__questions()[0];
    h.ctx.MathFight.answer((q.correct + 1) % 4);
    assert.equal(mine(h), '0', 'only correct answers count');
  });

  test('the count keeps up across several questions', async () => {
    const h = await bout();
    const qs = h.ctx.MathFight.__questions();
    h.ctx.MathFight.answer(qs[0].correct);                 // right
    h.ctx.MathFight.answer((qs[1].correct + 1) % 4);       // wrong
    h.ctx.MathFight.answer(qs[2].correct);                 // right
    assert.equal(mine(h), '2', 'two right out of three');
  });

  test('a stale pulse cannot pull my own score backwards', async () => {
    // The server's number arrives seconds late. It must never overwrite a
    // count the child has already earned on screen.
    const h = await bout();
    const qs = h.ctx.MathFight.__questions();
    h.ctx.MathFight.answer(qs[0].correct);
    h.ctx.MathFight.answer(qs[1].correct);
    assert.equal(mine(h), '2');
    await h.ctx.MathFight.__beat();      // the server still believes it is 0
    assert.equal(mine(h), '2', 'my own marks are mine to count');
  });
});

// ---------------------------------------------------------------------------
// The whole answering journey, tap by tap: what is on the card, what a tap
// records, how the round advances, and what happens on the last question.
suite('math fight: answering, question by question', () => {
  async function bout() {
    const h = mountFight(p => p === 'submit'
      ? { ok: true, data: { fight: ACTIVE_FIGHT, coins: 0 } }
      : listReply(ACTIVE_FIGHT));
    await h.ctx.MathFight.refresh();
    return h;
  }
  const text = h => h.doc.getElementById('mfRoot').textContent;

  test('the card shows the sum, four choices and the position in the round', async () => {
    const h = await bout();
    const qs = h.ctx.MathFight.__questions();
    assert.equal(qs.length, 20, 'a full round');
    const body = text(h);
    assert.truthy(body.includes(qs[0].q), 'the sum itself must be on screen: ' + qs[0].q);
    assert.truthy(body.includes('Câu 1 / 20'), 'the child can see how far along they are');
    const options = h.doc.querySelectorAll('.mf-option');
    assert.equal(options.length, 4, 'four choices');
    const shown = [...options].map(o => Number(o.textContent));
    assert.deepEqual(shown.slice().sort((a, b) => a - b), qs[0].options.slice().sort((a, b) => a - b),
      'the buttons show the four options the round was built with');
    assert.truthy(shown.includes(qs[0].answer), 'one of them must be right');
  });

  test('a tap records the VALUE chosen and moves to the next question', async () => {
    const h = await bout();
    const qs = h.ctx.MathFight.__questions();
    h.ctx.MathFight.answer(0);
    const body = text(h);
    assert.truthy(body.includes('Câu 2 / 20'), 'the round advances');
    assert.truthy(body.includes(qs[1].q), 'and shows the next sum');
    assert.falsy(body.includes('Câu 1 / 20'), 'the old question is gone');
  });

  test('the answer sent to the server is the number, never the button index', async () => {
    // The server marks by value. Sending an index would mark every answer
    // wrong for a child who chose the fourth button.
    const h = await bout();
    const qs = h.ctx.MathFight.__questions();
    const chosen = qs[0].options[3];
    h.ctx.MathFight.answer(3);
    await h.ctx.MathFight.__beat();
    const sent = h.posts.filter(p => p.path === 'math-fight/progress').pop();
    assert.truthy(sent, 'the pulse carries the answers');
    assert.equal(sent.body.answers[0], chosen, 'the value chosen, not the index 3');
  });

  test('tapping twice on one question cannot answer it twice', async () => {
    const h = await bout();
    // Tap through the DOM, the way a finger does: the second tap lands on the
    // button from question 1, which is still alive in the detached card.
    const stale = h.doc.querySelectorAll('.mf-option')[0];
    stale.dispatch('click', {});
    stale.dispatch('click', {});
    assert.truthy(text(h).includes('Câu 2 / 20'),
      'a double tap must not skip a question the child never saw');
  });

  test('the last answer ends the round and submits', async () => {
    const h = await bout();
    const qs = h.ctx.MathFight.__questions();
    for (const q of qs) h.ctx.MathFight.answer(q.correct);
    await new Promise(r => setTimeout(r, 0));
    const submitted = h.posts.filter(p => p.path === 'math-fight/submit');
    assert.truthy(submitted.length >= 1, 'finishing the twentieth question submits the round');
    assert.equal(submitted[0].body.answers.filter(v => v !== null).length, 20,
      'all twenty answers go up');
  });

  test('every answer the child gave is carried, in order', async () => {
    const h = await bout();
    const qs = h.ctx.MathFight.__questions();
    const given = [];
    for (let i = 0; i < 5; i++) { const pick = (qs[i].correct + i) % 4; given.push(qs[i].options[pick]); h.ctx.MathFight.answer(pick); }
    await h.ctx.MathFight.__beat();
    const sent = h.posts.filter(p => p.path === 'math-fight/progress').pop();
    assert.deepEqual(sent.body.answers.slice(0, 5), given, 'order and values must survive');
  });
});
