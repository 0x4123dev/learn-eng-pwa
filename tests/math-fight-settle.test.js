// Đấu Toán: when a fight ends, and what that costs.
//
// Three reported defects, all executed here against a real SQLite database
// through tests/pages-harness.js:
//
//   1. POST /progress settled a LIVE fight the moment the other side went
//      quiet — even when that side had already submitted. A child who finished
//      at 1:30 and closed the app made their opponent lose at 1:50, with three
//      minutes and thirteen questions still on the clock.
//   2. settleFight wrote the pair's next handicap BEFORE the status guard, so
//      two overlapping settlers (both tickers at the deadline, the 5-second
//      pulse, or reapStale running on any other child's list poll) advanced
//      the ladder twice for one win.
//   3. The coin move only ever came back from /submit, so a fight settled
//      through the pulse paid nobody: the winner saw "THẮNG RỒI!" and got
//      nothing, the loser was never charged, and a finished fight is never
//      handed back by the list, so the xu were gone for good.
'use strict';

const { suite, test, assert } = require('./harness');
const path = require('path');
const { createWorld, loadModule } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const MF = require(path.join(ROOT, 'js', 'math-fight-rules.js'));
const wars = require(path.join(ROOT, 'js', 'mathwars.js'));
const { MATH_FIGHT_BANK } = require(path.join(ROOT, 'js', 'math-fight-bank.js'));
global.MATH_FIGHT_BANK = MATH_FIGHT_BANK;
global.MathFightRules = MF;
global.warsQuestions = wars.warsQuestions;

const progressHandler = () => loadModule('functions/api/math-fight/progress.js');
const submitHandler = () => loadModule('functions/api/math-fight/submit.js');
const lib = () => loadModule('functions/api/_math-fight.js');

const SEED = 123456;
const FIGHT_ID = 'b'.repeat(32);

const perfectAnswers = level => MF.fightQuestions(SEED, level).map(q => q.answer);

async function arena(opts) {
  opts = opts || {};
  const world = createWorld();
  const kid = await world.createUser({ username: 'Kid' });
  const friend = await world.createUser({ username: 'Friend' });
  const now = Date.now();
  world.db.prepare(`INSERT INTO math_fights
    (id, challenger_id, opponent_id, seed, challenger_level, opponent_level, prize, status,
     created_at, expires_at, started_at, deadline_at, c_answered, o_answered)
    VALUES (?,?,?,?,?,?,?,'active',?,?,?,?,0,0)`)
    .run(FIGHT_ID, kid.uid, friend.uid, SEED, 3, 3, MF.PRIZE, now, now + 60000, now,
      now + (opts.secondsLeft == null ? MF.SECONDS : opts.secondsLeft) * 1000);
  const row = () => world.db.prepare('SELECT * FROM math_fights WHERE id=?').get(FIGHT_ID);
  const post = (handler, user, body) => world.call(handler, { token: user.token, body });
  return { world, kid, friend, row, post, now };
}

// The beat of a side that has stopped talking to the server. It must be a
// REAL past beat, not zero: a player who never pulsed at all has not walked
// away, they simply have not started (MF.hasWalkedAway).
const silence = (a, who) =>
  a.world.db.prepare(`UPDATE math_fights SET ${who}_beat_at=? WHERE id=?`)
    .run(Date.now() - MF.FORFEIT_MS - 5000, FIGHT_ID);

suite('đấu toán: a finished opponent is not a runaway', () => {
  test('the child still working is not judged because the other one closed the app', async () => {
    const a = await arena();
    const answers = perfectAnswers(3);
    // Kid finishes early and walks off — their beat freezes.
    const done = await a.post(submitHandler().onRequestPost, a.kid,
      { fightId: FIGHT_ID, answers: answers.slice(0, 12).concat(new Array(8).fill(null)), coins: 500 });
    assert.equal(done.status, 200, JSON.stringify(done.data));
    assert.truthy(a.row().c_submitted_at, 'Kid really did submit');
    silence(a, 'c');

    // Friend is still on question 7 and pulses.
    const poll = await a.post(progressHandler().onRequestPost, a.friend,
      { fightId: FIGHT_ID, answers: answers.slice(0, 7) });
    assert.equal(poll.status, 200, JSON.stringify(poll.data));
    assert.equal(String(a.row().status), 'active',
      'a fight with time on the clock must stay open while one child is still answering');
    assert.equal(poll.data.fight.status, 'active');
  });

  test('a child who really walks off before submitting still forfeits', async () => {
    const a = await arena();
    const answers = perfectAnswers(3);
    silence(a, 'c');                       // Kid left without ever submitting
    const poll = await a.post(progressHandler().onRequestPost, a.friend,
      { fightId: FIGHT_ID, answers: answers.slice(0, 7) });
    assert.equal(poll.status, 200, JSON.stringify(poll.data));
    assert.equal(String(a.row().status), 'done', 'the abandoned fight is settled');
    assert.equal(Number(a.row().winner_id), a.friend.uid, 'and the child who stayed wins it');
  });

  test('the deadline still ends a fight whatever anyone is doing', async () => {
    const a = await arena({ secondsLeft: -1 });
    const poll = await a.post(progressHandler().onRequestPost, a.friend,
      { fightId: FIGHT_ID, answers: [] });
    assert.equal(poll.status, 200);
    assert.equal(String(a.row().status), 'done', 'time is time');
  });
});

suite('đấu toán: one win moves the ladder one rung', () => {
  test('two settlers racing the same fight advance the pair exactly once', async () => {
    const a = await arena({ secondsLeft: -1 });
    const answers = perfectAnswers(3);
    a.world.db.prepare('UPDATE math_fights SET c_correct=?, o_correct=? WHERE id=?')
      .run(20, 5, FIGHT_ID);
    const { settleFight } = lib();
    const stale = a.row();                 // both callers hold the SAME active row
    await settleFight(a.world.env, stale, Date.now());
    await settleFight(a.world.env, stale, Date.now());

    const pair = a.world.db.prepare(
      'SELECT * FROM math_fight_pairs WHERE lo_id=? AND hi_id=?'
    ).get(Math.min(a.kid.uid, a.friend.uid), Math.max(a.kid.uid, a.friend.uid));
    assert.truthy(pair, 'the pair state must exist');
    assert.equal(Number(pair.streak), 1, 'one win is one rung, however many settlers raced');
    assert.equal(Number(pair.leader_id), a.kid.uid);
  });

  test('a fight settled twice still reports one winner', async () => {
    const a = await arena({ secondsLeft: -1 });
    a.world.db.prepare('UPDATE math_fights SET c_correct=?, o_correct=? WHERE id=?')
      .run(20, 5, FIGHT_ID);
    const { settleFight } = lib();
    const first = await settleFight(a.world.env, a.row(), Date.now());
    const second = await settleFight(a.world.env, first, Date.now());
    assert.equal(Number(second.winner_id), a.kid.uid);
    assert.equal(Number(second.finished_at), Number(first.finished_at), 'the first verdict stands');
  });
});

suite('đấu toán: the winner is actually paid', () => {
  test('a forfeit win still has its coin move waiting to be claimed', async () => {
    // The pulse settles the fight; /progress deliberately carries no coins, so
    // the client asks /submit for the move afterwards. That call must answer
    // with the prize rather than zero.
    const a = await arena();
    const answers = perfectAnswers(3);
    silence(a, 'c');
    const poll = await a.post(progressHandler().onRequestPost, a.friend,
      { fightId: FIGHT_ID, answers: answers.slice(0, 7) });
    assert.equal(String(a.row().status), 'done');
    assert.falsy(poll.data.coins, '/progress carries no money — that is the contract');

    const claim = await a.post(submitHandler().onRequestPost, a.friend,
      { fightId: FIGHT_ID, answers: answers.slice(0, 7), coins: 500 });
    assert.equal(claim.status, 200, JSON.stringify(claim.data));
    assert.truthy(claim.data.coins > 0, 'the winner must be able to collect: ' + claim.data.coins);
    assert.equal(claim.data.coins, MF.PRIZE);
  });

  test('and the loser is charged the same way, from their own purse', async () => {
    const a = await arena();
    const answers = perfectAnswers(3);
    silence(a, 'c');
    await a.post(progressHandler().onRequestPost, a.friend, { fightId: FIGHT_ID, answers: answers.slice(0, 7) });
    assert.equal(String(a.row().status), 'done');
    const loser = await a.post(submitHandler().onRequestPost, a.kid,
      { fightId: FIGHT_ID, answers: [], coins: 500 });
    assert.truthy(loser.data.coins < 0, 'the loser pays: ' + loser.data.coins);
    const broke = await arena();
    // A child with nothing loses nothing — the balance is only used to make
    // the charge smaller, never to invent one.
    silence(broke, 'c');
    await broke.post(progressHandler().onRequestPost, broke.friend, { fightId: FIGHT_ID, answers: [] });
    const empty = await broke.post(submitHandler().onRequestPost, broke.kid,
      { fightId: FIGHT_ID, answers: [], coins: 0 });
    assert.equal(empty.data.coins, 0, 'an empty purse cannot go negative');
  });

  test('the client asks for that move wherever the verdict lands', () => {
    // js/math-fight.js beat() used to call paintResult() directly, so a fight
    // that ended under the pulse never went through applyCoins at all.
    const fs = require('fs');
    const src = fs.readFileSync(path.join(ROOT, 'js', 'math-fight.js'), 'utf8');
    const beat = src.slice(src.indexOf('async function beat()'), src.indexOf('async function claimVerdictCoins'));
    assert.truthy(/await claimVerdictCoins\(\)/.test(beat), 'the pulse must claim before painting');
    const claim = src.slice(src.indexOf('async function claimVerdictCoins'));
    assert.truthy(/api\('submit'/.test(claim.slice(0, 900)), 'and it claims through /submit');
    assert.truthy(/st\.moved = applyCoins\(/.test(claim.slice(0, 900)), 'applying the move to this wallet');
    assert.truthy(/st\.moved = 0;/.test(src), 'a new fight starts having moved nothing');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
