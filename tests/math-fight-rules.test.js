// math-fight-rules.test.js — the whole of Đấu Toán that can be decided
// without a network: the difficulty ladder, the stake, the SILENT per-pair
// handicap, and who won.
//
// The handicap is the reason this feature exists. A child who loses three
// times in a row stops playing, so the server quietly pushes the winner two
// rungs up the ladder per straight win and leaves the loser on the shared
// base rung. Neither child is ever told. These tests pin the arithmetic of
// that ladder, because nothing in the UI can reveal a mistake in it.
const { suite, test, assert } = require('./harness');
const MF = require('../js/math-fight-rules.js');
const wars = require('../js/mathwars.js');

suite('math fight: the difficulty ladder', () => {
  test('the fight ladder extends the wars ladder past 99', () => {
    assert.equal(MF.fightLevelMax(0), 19);
    assert.equal(MF.fightLevelMax(2), 39);
    assert.equal(MF.fightLevelMax(8), 99);      // top of the wars ladder
    assert.equal(MF.fightLevelMax(9), 109);     // fight-only headroom starts
    assert.equal(MF.fightLevelMax(18), 199);
  });
  test('the ladder is clamped at both ends, never NaN', () => {
    assert.equal(MF.fightLevelMax(-5), 19);
    assert.equal(MF.fightLevelMax(999), 199);
    assert.equal(MF.fightLevelMax(null), 19);
    assert.equal(MF.fightLevelMax('x'), 19);
  });
  test('a fight is 20 questions in 5 minutes', () => {
    assert.equal(MF.QUESTIONS, 20);
    assert.equal(MF.SECONDS, 300);
  });
});

suite('math fight: the prize', () => {
  test('winning pays a flat 200, and nobody chooses a stake', () => {
    assert.equal(MF.PRIZE, 200);
    assert.equal(MF.coinChange(true, 0), 200, 'the winner is paid whatever they own');
    assert.equal(MF.coinChange(true, 5000), 200);
    assert.equal(MF.BET_MIN, undefined, 'there is no stake to pick any more');
  });
  test('a loser pays what they can and never goes negative', () => {
    assert.equal(MF.coinChange(false, 5000), -200);
    assert.equal(MF.coinChange(false, 200), -200);
    assert.equal(MF.coinChange(false, 120), -120, 'pays only what is in the purse');
    assert.equal(MF.coinChange(false, 0), 0, 'an empty purse loses nothing');
    assert.equal(MF.coinChange(false, -50), 0, 'a junk balance cannot become a payout');
  });
});

suite('math fight: the pair key', () => {
  test('A-B and B-A land on one row', () => {
    assert.deepEqual(MF.pairKey(7, 3), { lo: 3, hi: 7 });
    assert.deepEqual(MF.pairKey(3, 7), { lo: 3, hi: 7 });
  });
});

suite('math fight: the seeded generator', () => {
  test('one seed always walks the same sequence', () => {
    const a = MF.makeRng(12345), b = MF.makeRng(12345);
    for (let i = 0; i < 50; i++) assert.equal(a(), b());
  });
  test('different seeds diverge', () => {
    assert.truthy(MF.makeRng(1)() !== MF.makeRng(2)());
  });
  test('every draw is inside [0,1)', () => {
    const r = MF.makeRng(99);
    for (let i = 0; i < 500; i++) { const v = r(); assert.truthy(v >= 0 && v < 1); }
  });
});

suite('math fight: the silent handicap', () => {
  const A = 11, B = 22;

  test('a first meeting is played on level ground', () => {
    assert.deepEqual(MF.levelsFor(null, 2, A, B), { a: 2, b: 2 });
  });
  test('the base is the HIGHER of the two wars levels', () => {
    assert.equal(MF.baseLevel(1, 5), 5);
    assert.equal(MF.baseLevel(5, 1), 5);
    assert.equal(MF.baseLevel(-3, 99), MF.WARS_TOP_LEVEL, 'clamped to the wars ladder');
  });
  test('each straight win pushes the winner two rungs, the loser none', () => {
    let st = MF.nextPairState(null, A);
    assert.deepEqual(st, { leaderId: A, streak: 1 });
    assert.deepEqual(MF.levelsFor(st, 2, A, B), { a: 4, b: 2 });

    st = MF.nextPairState(st, A);
    assert.deepEqual(st, { leaderId: A, streak: 2 });
    assert.deepEqual(MF.levelsFor(st, 2, A, B), { a: 6, b: 2 });

    st = MF.nextPairState(st, A);
    assert.deepEqual(MF.levelsFor(st, 2, A, B), { a: 8, b: 2 });
  });
  test('an upset wipes the handicap back to equal', () => {
    let st = { leaderId: A, streak: 3 };
    st = MF.nextPairState(st, B);
    assert.deepEqual(st, { leaderId: null, streak: 0 });
    assert.deepEqual(MF.levelsFor(st, 2, A, B), { a: 2, b: 2 });
  });
  test('the handicap tops out at +8 rungs', () => {
    let st = { leaderId: A, streak: MF.STREAK_MAX };
    st = MF.nextPairState(st, A);
    assert.equal(st.streak, MF.STREAK_MAX, 'streak cannot run away');
    assert.deepEqual(MF.levelsFor(st, 2, A, B), { a: 10, b: 2 });
  });
  test('the hardest rung a fight can ever reach still fits the ladder', () => {
    // Worst case: both children topped the wars ladder AND one of them is on
    // a full streak. base 8 + 2*4 = rung 16, sums up to 179 — inside the
    // 0..18 fight ladder, so the clamp in levelsFor never has to bite.
    const st = { leaderId: A, streak: MF.STREAK_MAX };
    const lv = MF.levelsFor(st, MF.WARS_TOP_LEVEL, A, B);
    assert.deepEqual(lv, { a: 16, b: 8 });
    assert.truthy(lv.a <= MF.FIGHT_LEVELS - 1, 'never off the end of the ladder');
    assert.equal(MF.fightLevelMax(lv.a), 179);
  });
  test('a draw changes nothing', () => {
    assert.deepEqual(MF.nextPairState({ leaderId: A, streak: 2 }, null), { leaderId: A, streak: 2 });
  });
});

suite('math fight: who won', () => {
  const A = { id: 11, correct: 12, ms: 200000, forfeit: false };
  const B = { id: 22, correct: 9, ms: 150000, forfeit: false };

  test('more correct answers wins, however slow', () => {
    assert.deepEqual(MF.adjudicate(A, B), { winnerId: 11, outcome: 'win' });
    assert.deepEqual(MF.adjudicate(B, A), { winnerId: 11, outcome: 'win' });
  });
  test('a tie on answers breaks on the shorter total time', () => {
    const slow = { id: 11, correct: 10, ms: 200000, forfeit: false };
    const fast = { id: 22, correct: 10, ms: 150000, forfeit: false };
    assert.deepEqual(MF.adjudicate(slow, fast), { winnerId: 22, outcome: 'win' });
  });
  test('identical score and identical time is a draw', () => {
    const x = { id: 11, correct: 10, ms: 150000, forfeit: false };
    const y = { id: 22, correct: 10, ms: 150000, forfeit: false };
    assert.deepEqual(MF.adjudicate(x, y), { winnerId: null, outcome: 'draw' });
  });
  test('walking away loses no matter how far ahead you were', () => {
    const quitter = { id: 11, correct: 20, ms: 100000, forfeit: true };
    const stayer = { id: 22, correct: 1, ms: 300000, forfeit: false };
    assert.deepEqual(MF.adjudicate(quitter, stayer), { winnerId: 22, outcome: 'forfeit' });
  });
  test('both walking away is a draw, not a double loss', () => {
    const x = { id: 11, correct: 5, ms: 100000, forfeit: true };
    const y = { id: 22, correct: 6, ms: 100000, forfeit: true };
    assert.deepEqual(MF.adjudicate(x, y), { winnerId: null, outcome: 'draw' });
  });
});

suite('math fight: the 3-day cooldown', () => {
  test('a finished fight seals the pair for 72 hours', () => {
    assert.equal(MF.cooldownUntil(1000), 1000 + 3 * 24 * 3600 * 1000);
  });
  test('silence longer than 20 seconds counts as walking away', () => {
    assert.truthy(MF.hasWalkedAway(1000, 1000 + 20001));
    assert.falsy(MF.hasWalkedAway(1000, 1000 + 19999));
    assert.falsy(MF.hasWalkedAway(null, 999999), 'a player who never beat has not walked away yet');
  });
});

suite('math fight: questions above the wars ceiling', () => {
  test('the wars ladder itself is untouched', () => {
    assert.equal(wars.WARS_MAX, 99);
    assert.equal(wars.warsLevelMax(8), 99);
    assert.equal(wars.warsLevelMax(99), 99, 'the wars ladder still tops out at 99');
  });
  test('a fight can ask for sums above 99', () => {
    const qs = wars.warsQuestions(20, MF.makeRng(7), MF.fightLevelMax(14));
    assert.equal(qs.length, 20);
    assert.truthy(qs.some(q => q.answer > 99), 'the extra rungs must actually be reachable');
    for (const q of qs) assert.truthy(q.answer <= 159, 'nothing above the requested ceiling');
  });
  test('every generated question stays inside its ceiling', () => {
    for (const level of [0, 4, 8, 12, 18]) {
      const max = MF.fightLevelMax(level);
      for (const q of wars.warsQuestions(20, MF.makeRng(level + 1), max)) {
        assert.truthy(q.answer <= max, 'answer ' + q.answer + ' > ' + max);
        assert.truthy(q.a <= max && q.b <= max, 'an operand escaped the ceiling');
      }
    }
  });
  test('high rungs widen the times-table beyond 9', () => {
    let sawBig = false;
    for (let s = 1; s <= 40 && !sawBig; s++) {
      for (const q of wars.warsQuestions(20, MF.makeRng(s), MF.fightLevelMax(16))) {
        if ((q.op === '×' || q.op === ':') && q.b > 9) sawBig = true;
      }
    }
    assert.truthy(sawBig, 'above 99 the factors must reach 10..12');
  });
  test('the two modules agree on the hard ceiling', () => {
    assert.equal(MF.FIGHT_MAX, wars.WARS_HARD_MAX);
  });
  test('same seed and level, same twenty questions', () => {
    const a = wars.warsQuestions(20, MF.makeRng(4242), MF.fightLevelMax(3));
    const b = wars.warsQuestions(20, MF.makeRng(4242), MF.fightLevelMax(3));
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });
});
