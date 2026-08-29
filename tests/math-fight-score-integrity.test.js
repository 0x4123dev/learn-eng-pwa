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
// On the device the generator is a global script; mirror that so the shared
// builder can be called the way the client calls it.
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
    setInterval: (fn, ms) => { const id = { fn, ms }; timers.add(id); return id; },
    clearInterval: (id) => timers.delete(id),
    setTimeout: (fn) => { fn(); return 0; }, clearTimeout() {},
    EngAuth: { tokenFor: () => 'tok', getAccount: () => ({ id: 11 }),
      api: (p, opts) => Promise.resolve(reply(p, opts)) },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/math-fight-rules.js'), ctx);
  vm.runInContext(read('js/math-fight.js'), ctx);
  const navDisplay = () => doc.getElementById('bottomNav').style.display;
  return { ctx, doc, navDisplay };
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

  test('a solo Math Wars round keeps its easy on-ramp', () => {
    // The fight rule must not leak into solo practice, where a beginner level
    // is deliberately gentle.
    const easy = wars.warsQuestions(60, MF.makeRng(5), 19);
    assert.truthy(easy.some(q => Math.abs(q.answer) < 10),
      'solo practice at the lowest level still offers small sums');
  });
});
