// math-fight-api.test.js — the server half of Đấu Toán, read as source.
//
// Two things matter more than anything else here and both are pinned below:
//   1. The client never reports a score. It sends the values it chose; the
//      server rebuilds the same twenty questions from the seed and marks them.
//   2. The handicap is invisible. No payload may carry the opponent's rung,
//      the pair's leader or its streak — a child who could see the handicap
//      would learn that losing is rewarded.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const api = n => read('functions/api/math-fight/' + n + '.js');

suite('math fight: schema', () => {
  test('the migration creates both tables', () => {
    const sql = read('db/011-math-fight.sql');
    for (const t of ['math_fights', 'math_fight_pairs'])
      assert.truthy(sql.includes('CREATE TABLE IF NOT EXISTS ' + t), t);
  });
  test('a fight stores the seed and both rungs, so any result can be rebuilt', () => {
    const sql = read('db/011-math-fight.sql');
    for (const col of ['seed', 'challenger_level', 'opponent_level', 'c_answers_json', 'o_answers_json'])
      assert.truthy(sql.includes(col), col);
  });
  test('the handicap is keyed on the sorted pair, so A-B and B-A share one row', () => {
    const sql = read('db/011-math-fight.sql');
    assert.truthy(sql.includes('PRIMARY KEY (lo_id, hi_id)'));
    assert.truthy(sql.includes('next_ready_at'));
  });
  test('the migration carries the command that applies it', () => {
    assert.truthy(read('db/011-math-fight.sql').includes('wrangler@3 d1 execute'));
  });
});

suite('math fight: server helpers', () => {
  const src = () => read('functions/api/_math-fight.js');
  test('scoring runs the shared generator, never a client-supplied score', () => {
    assert.truthy(src().includes('warsQuestions('));
    assert.truthy(src().includes('MF.fightLevelMax('));
    assert.falsy(/body\.correct/.test(src()), 'the client must never report a score');
  });
  test('the pair row is read and written through the sorted key', () => {
    assert.truthy(src().includes('MF.pairKey('));
    assert.truthy(src().includes('math_fight_pairs'));
  });
  test('the fight view never leaks the opponent rung or the handicap', () => {
    const s = src();
    const view = s.slice(s.indexOf('export function fightView'), s.indexOf('export', s.indexOf('export function fightView') + 10) + 1 || undefined);
    for (const leak of ['streak', 'leaderId', 'foeLevel', 'opponentLevel'])
      assert.falsy(view.includes(leak), 'fightView must not carry ' + leak);
  });
  test('settlement writes the handicap, the cooldown and the coins together', () => {
    const s = src();
    const fn = s.slice(s.indexOf('export async function settleFight'));
    assert.truthy(fn.includes('MF.adjudicate('));
    assert.truthy(fn.includes('MF.nextPairState('));
    assert.truthy(fn.includes('MF.cooldownUntil('));
    assert.truthy(fn.includes('MF.hasWalkedAway('));
  });
  test('the coin delta is the stake, decided by the server', () => {
    const s = src();
    const fn = s.slice(s.indexOf('export function coinDelta'));
    assert.truthy(fn.includes('row.bet'));
    assert.truthy(fn.includes('winner_id'));
  });
});

suite('math fight: challenge and accept', () => {
  test('every endpoint requires auth', () => {
    for (const n of ['index', 'challenge', 'respond', 'progress', 'submit'])
      assert.truthy(api(n).includes('requireAuth'), n + ' must require auth');
  });
  test('a challenge is only ever against a friend', () => {
    assert.truthy(api('challenge').includes('areFriends'));
  });
  test('a challenge enforces the stake, the balance and both cooldowns', () => {
    const src = api('challenge');
    assert.truthy(src.includes('MF.isValidBet('), 'stake must be validated server-side');
    assert.truthy(src.includes('friendBattleReadyAt'), 'the 3-day friendship gate still applies');
    assert.truthy(src.includes('nextReadyAt'), 'the 3-day pair cooldown must be checked');
    assert.truthy(src.includes('currentFight'), 'one fight at a time');
    assert.truthy(src.includes('MF.INVITE_TTL_MS'));
  });
  test('the rungs are decided by the server at challenge time', () => {
    const src = api('challenge');
    assert.truthy(src.includes('MF.baseLevel('));
    assert.truthy(src.includes('MF.levelsFor('));
    assert.falsy(src.includes('body.bet)') && src.includes('body.level)') && !src.includes('MF.baseLevel('),
      'a client may not pick its own difficulty');
  });
  test('accepting starts the five-minute clock on the server', () => {
    const src = api('respond');
    assert.truthy(src.includes("status='active'"));
    assert.truthy(src.includes('MF.SECONDS * 1000'));
  });
});

suite('math fight: scoring and settlement', () => {
  test('the heartbeat carries answers, never a score', () => {
    const src = api('progress');
    assert.truthy(src.includes('scoreAnswers('), 'the server scores the array itself');
    assert.falsy(/body\.correct/.test(src), 'a client-reported score is a cheat vector');
    assert.truthy(src.includes('beat_at'), 'the pulse doubles as walk-away detection');
  });
  test('submitting scores the same way and settles once', () => {
    const src = api('submit');
    assert.truthy(src.includes('scoreAnswers('));
    assert.truthy(src.includes('settleFight('));
    assert.falsy(/body\.reward/.test(src));
  });
  test('a fight that nobody finished still gets settled', () => {
    assert.truthy(read('functions/api/_math-fight.js').includes('reapStale'));
    assert.truthy(api('index').includes('reapStale'));
  });
});
