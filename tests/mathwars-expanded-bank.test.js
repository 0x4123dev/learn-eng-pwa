const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { MATH_WARS_BANK: BANK } = require('../js/mathwars-bank');
const { MATH_FIGHT_BANK: OLD_BANK } = require('../js/math-fight-bank');
const { warsIsEasyQuestion } = require('../js/mathwars');
const { build, render } = require('../scripts/build-mathwars-bank');
const read = file => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const key = ([a, b, op]) => `${a}${op}${b}`;

suite('math wars: 500 hard practice questions', () => {
  test('retains all 102 original entries and adds exactly 398 distinct questions', () => {
    const original = OLD_BANK.filter(([a, b, op, answer, tier]) =>
      tier <= 8 && !warsIsEasyQuestion({ a, b, op, answer }));
    const originalKeys = new Set(original.map(key));
    const keys = new Set(BANK.map(key));
    assert.equal(original.length, 102);
    assert.equal(BANK.length, 500);
    assert.equal(keys.size, 500);
    assert.deepEqual(BANK.slice(0, 102), original);
    assert.equal(BANK.filter(q => !originalKeys.has(key(q))).length, 398);
  });

  test('every entry is correct, hard, in range and correctly tiered', () => {
    for (const [a, b, op, answer, tier] of BANK) {
      assert.truthy(['+', '−', '×', ':'].includes(op));
      assert.equal(answer, op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b);
      for (const value of [a, b, answer]) {
        assert.truthy(Number.isInteger(value));
        assert.inRange(value, 1, 99);
      }
      assert.falsy(warsIsEasyQuestion({ a, b, op, answer }), `${a} ${op} ${b}`);
      assert.equal(tier, Math.max(0, Math.ceil((Math.max(a, b, answer) - 19) / 10)));
    }
  });

  test('the operation counts match the agreed expansion', () => {
    const counts = {};
    for (const op of ['+', '−', '×', ':']) counts[op] = BANK.filter(q => q[2] === op).length;
    assert.deepEqual(counts, { '+': 223, '−': 222, '×': 42, ':': 13 });
  });

  test('the checked-in artifact is reproducible', () => {
    assert.deepEqual(build(), BANK);
    assert.equal(read('js/mathwars-bank.js'), render());
  });

  test('the new bank is lazy-loaded and available offline', () => {
    assert.truthy(read('js/lazy-data.js').includes("'js/mathwars-bank.js'"));
    assert.truthy(read('sw.js').includes("'/js/mathwars-bank.js'"));
    assert.falsy(read('index.html').includes('src="js/mathwars-bank.js"'));
  });

  test('real round selection reaches all 500 questions with valid choices at every level', () => {
    const rules = require('../js/math-fight-rules');
    const context = vm.createContext({
      Math: Object.create(Math), MathFightRules: rules,
      MATH_WARS_BANK: BANK, MATH_FIGHT_BANK: OLD_BANK,
    });
    context.Math.random = rules.makeRng(398500);
    // bankRound uses its own Math.random unless injected; wrap it with the
    // same deterministic stream to make this reachability check repeatable.
    context.MathFightRules = { ...rules, bankRound: (bank, count, tier) =>
      rules.bankRound(bank, count, tier, context.Math.random) };
    vm.runInContext(read('js/mathwars.js'), context);
    const keys = new Set(BANK.map(key));
    const reached = new Set();
    for (let i = 0; i < 1000; i++) {
      const round = context.warsRoundQuestions(i % 9);
      assert.equal(round.length, 10);
      const roundKeys = round.map(q => key([q.a, q.b, q.op]));
      assert.equal(new Set(roundKeys).size, 10);
      for (const q of round) {
        const k = key([q.a, q.b, q.op]);
        assert.truthy(keys.has(k), q.q);
        reached.add(k);
        assert.equal(new Set(q.options).size, 4);
        assert.equal(q.options[q.correct], q.answer);
      }
    }
    assert.equal(reached.size, 500, 'every new question must be reachable');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
