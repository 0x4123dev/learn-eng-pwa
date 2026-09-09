const { suite, test, assert } = require('./harness');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const { MATH_FIGHT_BANK: BANK } = require(path.join(ROOT, 'js', 'math-fight-bank.js'));

suite('math wars: practice draws from the same 1000-sum bank', () => {
  function round(level) {
    // Mirror the device: the bank and the shared rules are global scripts.
    global.MATH_FIGHT_BANK = BANK;
    global.MathFightRules = require(path.join(ROOT, 'js', 'math-fight-rules.js'));
    delete require.cache[require.resolve(path.join(ROOT, 'js', 'mathwars.js'))];
    global.appState = { warsHistory: [], warsProgress: null };
    const w = require(path.join(ROOT, 'js', 'mathwars.js'));
    return w.warsRoundQuestions(level);
  }
  const key = q => `${q.a}${q.op}${q.b}`;
  const inBank = new Set(BANK.map(b => `${b[0]}${b[2]}${b[1]}`));

  test('the practice filter removes 314 easy entries and retains 102 through 99', () => {
    const w = require(path.join(ROOT, 'js', 'mathwars.js'));
    const counts = {};
    for (const [a, b, op, answer, tier] of BANK) {
      if (tier > 8) continue;
      if (!counts[op]) counts[op] = { removed: 0, kept: 0 };
      counts[op][w.warsIsEasyQuestion({ a, b, op, answer }) ? 'removed' : 'kept']++;
    }
    assert.deepEqual(counts, {
      '+': { removed: 97, kept: 23 },
      '×': { removed: 91, kept: 27 },
      '−': { removed: 73, kept: 39 },
      ':': { removed: 53, kept: 13 },
    });
  });

  test('easy shortcuts are excluded while carrying, borrowing and harder tables remain', () => {
    const w = require(path.join(ROOT, 'js', 'mathwars.js'));
    for (const [a, b, op, answer, easy] of [
      [7, 18, '+', 25, true], [12, 23, '+', 35, true], [18, 27, '+', 45, false],
      [47, 23, '−', 24, true], [42, 8, '−', 34, true], [42, 18, '−', 24, false],
      [5, 9, '×', 45, true], [10, 8, '×', 80, true], [7, 8, '×', 56, false],
      [65, 5, ':', 13, true], [70, 7, ':', 10, true], [84, 7, ':', 12, false],
      [42, 7, ':', 6, true],
    ]) assert.equal(w.warsIsEasyQuestion({ a, b, op, answer }), easy, `${a} ${op} ${b}`);
  });

  test('all saved levels immediately get ten challenging questions within 99', () => {
    for (let level = 0; level <= 8; level++) {
      for (let run = 0; run < 20; run++) {
        const qs = round(level);
        const w = require(path.join(ROOT, 'js', 'mathwars.js'));
        assert.equal(qs.length, 10);
        assert.equal(new Set(qs.map(key)).size, 10);
        for (const q of qs) {
          assert.falsy(w.warsIsEasyQuestion(q), q.q);
          assert.truthy(Math.max(q.a, q.b, q.answer) <= 99, q.q);
        }
      }
    }
  });

  test('every question in a round comes from the bank', () => {
    for (const level of [0, 1, 4, 8]) {
      const qs = round(level);
      assert.equal(qs.length, 10, `level ${level} must still be a ten-question round`);
      const strays = qs.filter(q => !inBank.has(key(q))).map(q => q.q);
      assert.deepEqual(strays, [], `level ${level} drew a sum that is not in the bank`);
    }
  });

  test('solo practice is no longer free either', () => {
    for (const level of [0, 1, 4, 8]) {
      const easy = round(level).filter(q => q.answer < 10).map(q => q.q);
      assert.deepEqual(easy, [], `level ${level} handed out a one-digit answer`);
    }
  });

  test('a round never repeats a sum, and every question offers four choices', () => {
    const qs = round(3);
    assert.equal(new Set(qs.map(key)).size, qs.length, 'no repeats inside one round');
    for (const q of qs) {
      assert.equal(q.options.length, 4, q.q);
      assert.equal(q.options[q.correct], q.answer, q.q + ' points at the wrong choice');
    }
  });

  test('without the bank loaded, practice still works', () => {
    // The bank is lazy-loaded with the Math tab; a round must never be empty.
    delete global.MATH_FIGHT_BANK;
    delete require.cache[require.resolve(path.join(ROOT, 'js', 'mathwars.js'))];
    global.appState = { warsHistory: [] };
    const w = require(path.join(ROOT, 'js', 'mathwars.js'));
    const qs = w.warsRoundQuestions(2);
    assert.equal(qs.length, 10, 'the generator still covers a missing bank');
    assert.equal(new Set(qs.map(key)).size, 10);
    for (const q of qs) {
      assert.falsy(w.warsIsEasyQuestion(q), 'fallback must not reintroduce ' + q.q);
      assert.truthy(Math.max(q.a, q.b, q.answer) <= 99, q.q);
      assert.equal(new Set(q.options).size, 4);
      assert.equal(q.options[q.correct], q.answer);
    }
    global.MATH_FIGHT_BANK = BANK;
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
