// math-tables.test.js — 🔢 Bảng cửu chương: six drills over the times tables.
//
// The questions are GENERATED, not drawn from a bank, so there is no data file
// a human can read to check them. This file is that check: it sweeps thousands
// of generated questions and asserts the arithmetic is real, the options are
// four distinct plausible numbers, and the key points at the right one.
const { suite, test, assert } = require('./harness');
const path = require('path');

const root = path.join(__dirname, '..');
global.appState = { coins: 0, mathHistory: [] };
global.currentUser = 'tester';
global.saveUserData = () => {};
global.document = { getElementById: () => null, querySelectorAll: () => [] };
const t = require(path.join(root, 'js', 'math-tables.js'));

// A pinned LCG, so a failure is reproducible rather than "it happened once".
function seeded(seed) {
  let s = seed || 1;
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; };
}
const RUNS = 5000;

suite('bảng cửu chương: the six modes', () => {
  test('there are exactly six, three nhân and three chia', () => {
    const modes = t.mathTablesModes();
    assert.equal(modes.length, 6);
    assert.deepEqual(modes.map(m => m.key),
      ['x2345', 'x67', 'x89', 'd2345', 'd67', 'd89']);
    assert.deepEqual(modes.map(m => m.g4set),
      ['ccx2345', 'ccx67', 'ccx89', 'ccd2345', 'ccd67', 'ccd89']);
  });

  test('every g4set starts with cc, and the op prefix separates nhân from chia', () => {
    for (const m of t.mathTablesModes()) {
      assert.truthy(m.g4set.startsWith('cc'), m.key + ': g4set must start with cc');
      assert.truthy(m.g4set.startsWith(m.op === 'x' ? 'ccx' : 'ccd'),
        m.key + ': the op prefix is what an "any nhân/chia" task matches on');
    }
  });

  test('the three table groups are 2–5, 6–7 and 8–9', () => {
    const byGroup = {};
    for (const m of t.mathTablesModes()) byGroup[m.group] = m.tables;
    assert.deepEqual(byGroup['2345'], [2, 3, 4, 5]);
    assert.deepEqual(byGroup['67'], [6, 7]);
    assert.deepEqual(byGroup['89'], [8, 9]);
  });
});

suite('bảng cửu chương: the arithmetic is real', () => {
  test('a nhân question is table × n, and its answer is the product', () => {
    const rand = seeded(7);
    for (const m of t.mathTablesModes().filter(m => m.op === 'x')) {
      for (let i = 0; i < RUNS; i++) {
        const q = t.mathTablesQuestion(m, rand);
        assert.truthy(m.tables.indexOf(q.table) !== -1, q.q + ': table out of the mode');
        assert.truthy(q.n >= 1 && q.n <= 10, q.q + ': multiplier left 1–10');
        assert.equal(q.answer, q.table * q.n, q.q + ': wrong answer');
        assert.equal(q.q, q.table + ' × ' + q.n, 'the question text must read as the table does');
      }
    }
  });

  test('a chia question divides BY the table, and its answer is the quotient 1–10', () => {
    // "bảng chia 7" means 7:7=1, 14:7=2 … 70:7=10 — the divisor is the table.
    const rand = seeded(11);
    for (const m of t.mathTablesModes().filter(m => m.op === 'd')) {
      for (let i = 0; i < RUNS; i++) {
        const q = t.mathTablesQuestion(m, rand);
        assert.truthy(m.tables.indexOf(q.table) !== -1, q.q + ': table out of the mode');
        assert.equal(q.answer, q.n, q.q + ': the answer is the quotient');
        assert.truthy(q.answer >= 1 && q.answer <= 10, q.q + ': quotient left 1–10');
        assert.equal(q.q, (q.table * q.n) + ' : ' + q.table, 'divisor must be the table');
      }
    }
  });
});

suite('bảng cửu chương: four options, and the wrong ones are believable', () => {
  test('always four distinct options, all positive, key on the answer', () => {
    const rand = seeded(13);
    for (const m of t.mathTablesModes()) {
      for (let i = 0; i < RUNS; i++) {
        const q = t.mathTablesQuestion(m, rand);
        assert.equal(q.options.length, 4, q.q + ': not four options');
        assert.equal(new Set(q.options).size, 4, q.q + ': duplicate options ' + q.options);
        assert.equal(q.options[q.correct], q.answer, q.q + ': key points at the wrong option');
        for (const o of q.options) {
          assert.truthy(Number.isInteger(o) && o > 0,
            q.q + ': option ' + o + ' is not a positive whole number');
        }
      }
    }
  });

  test('a chia option is always a plausible quotient, never a wild number', () => {
    // The child is choosing "how many sevens", so an option of 137 tells them
    // the answer by elimination and teaches nothing.
    const rand = seeded(17);
    for (const m of t.mathTablesModes().filter(m => m.op === 'd')) {
      for (let i = 0; i < RUNS; i++) {
        const q = t.mathTablesQuestion(m, rand);
        for (const o of q.options) {
          assert.truthy(o >= 1 && o <= 13, q.q + ': implausible quotient option ' + o);
        }
      }
    }
  });

  test('a nhân distractor is a near miss, not a random number', () => {
    // Every wrong option must be within one table-step of the answer, or be
    // the add-instead-of-multiply slip. That is what makes the drill teach.
    const rand = seeded(19);
    for (const m of t.mathTablesModes().filter(m => m.op === 'x')) {
      for (let i = 0; i < RUNS; i++) {
        const q = t.mathTablesQuestion(m, rand);
        const near = new Set([
          q.table * (q.n - 1), q.table * (q.n + 1),
          q.table * (q.n - 2), q.table * (q.n + 2),
          q.table + q.n,
        ]);
        const wrong = q.options.filter(o => o !== q.answer);
        // Padding may contribute at most one filler when the shaped candidates
        // collide (e.g. 2 × 1, where several land on the same number).
        const strays = wrong.filter(o => !near.has(o));
        assert.truthy(strays.length <= 1,
          q.q + ': too many stray distractors ' + strays);
      }
    }
  });
});

suite('bảng cửu chương: a round is ten different facts', () => {
  test('ten questions, all inside the mode, no fact asked twice', () => {
    const rand = seeded(23);
    for (const m of t.mathTablesModes()) {
      for (let run = 0; run < 400; run++) {
        const qs = t.mathTablesRoundQuestions(m, rand);
        assert.equal(qs.length, t.TABLES_QUESTIONS, m.key + ': wrong round length');
        const seen = new Set();
        for (const q of qs) {
          assert.truthy(m.tables.indexOf(q.table) !== -1, m.key + ': ' + q.q + ' is not in this mode');
          const fact = q.table + ':' + q.n;
          assert.falsy(seen.has(fact), m.key + ': ' + q.q + ' asked twice in one round');
          seen.add(fact);
        }
      }
    }
  });

  test('every mode has at least ten facts to draw from', () => {
    // 2–5 has 40, 6–7 has 20, 8–9 has 20. If a group ever shrinks below ten,
    // "no fact twice" becomes impossible and this says so before a child sees it.
    for (const m of t.mathTablesModes()) {
      assert.truthy(m.tables.length * 10 >= t.TABLES_QUESTIONS,
        m.key + ': not enough facts for a round of ' + t.TABLES_QUESTIONS);
    }
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
