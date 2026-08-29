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
    global.MATH_FIGHT_BANK = BANK;
  });
});

if (require.main === module) require('./harness').runAll().then(c => process.exit(c));
