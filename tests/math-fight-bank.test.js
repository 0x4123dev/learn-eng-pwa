// math-fight-bank.test.js — the 1000 pre-authored sums a Đấu Toán match uses.
//
// The match used to generate its questions, and at the lower levels most of
// what it produced was free: 76% of everything possible at the bottom level
// could be answered without calculating. The bank replaces that, and these
// tests are the reason it stays clean — nobody can re-check 1000 sums by eye.
//
// Rebuild with: node scripts/build-math-fight-bank.js
const { suite, test, assert } = require('./harness');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { MATH_FIGHT_BANK: BANK } = require(path.join(ROOT, 'js', 'math-fight-bank.js'));
const MF = require(path.join(ROOT, 'js', 'math-fight-rules.js'));

const A = 0, B = 1, OP = 2, ANS = 3, TIER = 4;
const show = q => `${q[A]} ${q[OP]} ${q[B]} = ${q[ANS]}`;

suite('math fight bank: the shape of every entry', () => {
  test('the bank holds 1000 sums, balanced across the four operations', () => {
    assert.equal(BANK.length, 1000);
    const counts = {};
    for (const q of BANK) counts[q[OP]] = (counts[q[OP]] || 0) + 1;
    for (const op of ['+', '−', '×', ':']) {
      assert.inRange(counts[op] || 0, 200, 300, `${op} has ${counts[op]} — the mix is lopsided`);
    }
  });

  test('every sum is arithmetically true', () => {
    const wrong = BANK.filter(q => {
      const [a, b, op, ans] = q;
      return ans !== (op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b);
    });
    assert.deepEqual(wrong.map(show), [], 'a wrong sum marks a right answer as wrong');
  });

  test('no sum appears twice', () => {
    const seen = new Set(), dupes = [];
    for (const q of BANK) { const k = `${q[A]}${q[OP]}${q[B]}`; if (seen.has(k)) dupes.push(show(q)); seen.add(k); }
    assert.deepEqual(dupes, [], 'a repeat wastes one of the twenty questions');
  });

  test('every tier is the lowest level that can hold the sum', () => {
    const bad = BANK.filter(q => {
      const top = Math.max(q[A], q[B], q[ANS]);
      let want = MF.FIGHT_LEVELS - 1;
      for (let L = 0; L < MF.FIGHT_LEVELS; L++) if (top <= MF.fightLevelMax(L)) { want = L; break; }
      return q[TIER] !== want;
    });
    assert.deepEqual(bad.map(show), [], 'a mis-tiered sum reaches the wrong child');
  });
});

suite('math fight bank: nothing here can be answered without calculating', () => {
  // The four kinds of free question the generator used to hand out.
  const RULES = [
    ['an answer under 10', q => q[ANS] < 10],
    ['single-digit + or −', q => (q[OP] === '+' || q[OP] === '−') && q[A] <= 9 && q[B] <= 9],
    ['taking away a single digit (no borrowing)', q => q[OP] === '−' && q[B] <= 9],
    ['doubling or halving', q => (q[OP] === '×' || q[OP] === ':') && Math.min(q[A], q[B]) <= 2],
  ];
  for (const [name, isEasy] of RULES) {
    test(`no sum is ${name}`, () => {
      const found = BANK.filter(isEasy).slice(0, 8).map(show);
      assert.deepEqual(found, [], `these are free points: ${found.join(', ')}`);
    });
  }

  test('the times table is kept — it is the skill the game is for', () => {
    const tables = BANK.filter(q => q[OP] === '×' && q[A] <= 9 && q[B] <= 9);
    assert.truthy(tables.length >= 15,
      'an over-broad "both digits" rule once removed the whole times table');
  });
});

suite('math fight bank: a real round drawn from it', () => {
  const bank = BANK;
  for (const level of [0, 1, 4, 9, 18]) {
    test(`level ${level} draws twenty distinct sums, none of them free`, () => {
      const qs = MF.fightQuestions(4242, level, bank);
      assert.equal(qs.length, MF.QUESTIONS, 'a short round is a broken round');
      assert.equal(new Set(qs.map(q => q.q)).size, MF.QUESTIONS, 'no repeats inside one round');
      const easy = qs.filter(q => q.answer < 10);
      assert.deepEqual(easy.map(q => q.q), [], 'every answer has two digits');
      for (const q of qs) {
        assert.equal(q.options.length, 4, q.q + ' must offer four choices');
        assert.equal(q.options[q.correct], q.answer, q.q + ' points at the wrong choice');
        assert.equal(new Set(q.options).size, 4, q.q + ' repeats an option');
        assert.truthy(q.options.every(o => o > 0), q.q + ' offers a negative answer');
      }
    });
  }

  test('the lowest levels borrow upward so a round is never repetitive', () => {
    // Tier 0 alone holds barely more than one round, and no subtraction or
    // division at all, so levels below FIGHT_MIN_TIER draw from tier 2.
    const qs = MF.fightQuestions(7, 0, bank);
    const ops = new Set(qs.map(q => q.op));
    assert.truthy(ops.size >= 3, 'a beginner still meets a mix of operations, got ' + [...ops]);
  });

  test('a harder level never draws below its own ladder', () => {
    const qs = MF.fightQuestions(11, 18, bank);
    assert.truthy(qs.some(q => q.answer > 99), 'the top level must reach the top of the bank');
  });

  test('the same seed and level always build the same round', () => {
    const a = MF.fightQuestions(31337, 6, bank).map(q => q.q + '=' + q.answer + q.options.join(','));
    const b = MF.fightQuestions(31337, 6, bank).map(q => q.q + '=' + q.answer + q.options.join(','));
    assert.deepEqual(a, b, 'the device and the server must build byte-identical rounds');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
