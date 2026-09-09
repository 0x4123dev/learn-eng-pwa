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

suite('bảng cửu chương: the clock scores the round', () => {
  function freshRound(modeKey) {
    global.appState = { coins: 0, mathHistory: [] };
    const m = t.mathTablesModes().find(x => x.key === modeKey);
    t.startMathTables(m.op, m.group);
    return m;
  }

  test('a round starts with a full clock and ten questions', () => {
    freshRound('x67');
    assert.truthy(t.isMathTablesActive(), 'the round did not start');
    assert.equal(t.mathTablesQuizQuestions().length, t.TABLES_QUESTIONS);
    const left = t.mathTablesLeftMs();
    const secs = t.mathTablesSeconds(t.mathTablesMode('x', '67'));
    assert.truthy(left > (secs - 2) * 1000 && left <= secs * 1000,
      'the clock did not start at ' + secs + 's, it read ' + left);
    t.abandonMathTables();
  });

  test('answering every question correctly scores 10/10', () => {
    freshRound('x2345');
    for (let i = 0; i < t.TABLES_QUESTIONS; i++) {
      const q = t.mathTablesQuizQuestions()[i];
      t.answerMathTables(q.correct);
    }
    assert.falsy(t.isMathTablesActive(), 'the round did not end on the last question');
    const run = global.appState.mathHistory[0];
    assert.equal(run.score, 10);
    assert.equal(run.total, 10);
  });

  test('the clock running out ends the round, and unanswered counts as WRONG out of ten', () => {
    // This is what makes a "phải đúng 10/10" daily task mean something:
    // answering four and letting the clock go scores 4 of 10, not 4 of 4.
    const m = freshRound('d89');
    for (let i = 0; i < 4; i++) t.answerMathTables(t.mathTablesQuizQuestions()[i].correct);
    t.mathTablesExpireForTest();
    t.mathTablesClockTick();
    assert.falsy(t.isMathTablesActive(), 'the clock did not end the round');
    const run = global.appState.mathHistory[0];
    assert.equal(run.total, 10, 'total must be the full round, not the number reached');
    assert.equal(run.score, 4);
    assert.equal(run.answered, 4);
    assert.equal(run.timedOut, true);
    assert.equal(run.g4set, m.g4set);
  });
});

suite('bảng cửu chương: coins', () => {
  test('two xu a correct answer', () => {
    assert.equal(t.mathTablesCoinsEarned(7, 10, 0), 14);
    assert.equal(t.mathTablesCoinsEarned(0, 10, 0), 0);
  });

  test('a clean 10/10 adds the thirty-xu bonus, and nothing else does', () => {
    assert.equal(t.mathTablesCoinsEarned(10, 10, 0), 20 + t.TABLES_PERFECT_BONUS);
    assert.equal(t.mathTablesCoinsEarned(9, 10, 0), 18, '9/10 must not pay the bonus');
  });

  test('a pending combo bonus is banked with the round', () => {
    assert.equal(t.mathTablesCoinsEarned(10, 10, 5), 20 + t.TABLES_PERFECT_BONUS + 5);
  });

  test('the wallet actually receives them', () => {
    global.appState = { coins: 100, mathHistory: [] };
    const m = t.mathTablesModes()[0];
    t.startMathTables(m.op, m.group);
    for (let i = 0; i < t.TABLES_QUESTIONS; i++) {
      t.answerMathTables(t.mathTablesQuizQuestions()[i].correct);
    }
    assert.equal(global.appState.coins, 100 + 20 + t.TABLES_PERFECT_BONUS);
  });
});

suite('bảng cửu chương: what a finished round records', () => {
  function playPerfect(modeKey) {
    global.appState = { coins: 0, mathHistory: [] };
    const m = t.mathTablesModes().find(x => x.key === modeKey);
    t.startMathTables(m.op, m.group);
    for (let i = 0; i < t.TABLES_QUESTIONS; i++) {
      t.answerMathTables(t.mathTablesQuizQuestions()[i].correct);
    }
    return { mode: m, run: global.appState.mathHistory[0] };
  }

  test('it lands in mathHistory as a grade-4 session carrying its g4set', () => {
    // grade + g4set is the whole server integration: js/auth.js uploads a
    // grade-4 session as detail.g4set, and the daily-task matcher reads it.
    for (const m of t.mathTablesModes()) {
      const { run } = playPerfect(m.key);
      assert.equal(run.grade, 4, m.key + ': not filed as Toán 4');
      assert.equal(run.g4set, m.g4set, m.key + ': wrong g4set');
      assert.equal(run.label, 'Toán 4 · ' + m.title);
    }
  });

  test('it records NO wrong ids and never feeds the retry drill', () => {
    // The questions are generated, so they have no bank id mathById() could
    // resolve. Ids here would poison "dạng toán cần ôn" with questions that
    // look up to null — the exact bug the id-stamping comments in math.js
    // describe. A generated round owes nothing back.
    let retryCalls = 0;
    global.retryAdd = () => { retryCalls++; };
    const { run } = playPerfect('d67');
    delete global.retryAdd;
    assert.deepEqual(run.wrong, []);
    assert.equal(retryCalls, 0, 'a cửu chương round must not add to the retry drill');
  });

  test('one skill row per table, named so the admin page can tell nhân from chia', () => {
    const { mode, run } = playPerfect('d89');
    const keys = run.skills.map(s => s.skillKey).sort();
    assert.deepEqual(keys, ['math4.cuuchuong.chia.8', 'math4.cuuchuong.chia.9']);
    const labels = run.skills.map(s => s.skillLabel).sort();
    assert.deepEqual(labels, ['Bảng chia 8', 'Bảng chia 9']);
    const attempts = run.skills.reduce((s, r) => s + r.attempts, 0);
    assert.equal(attempts, t.TABLES_QUESTIONS, 'every question must be counted once');
    assert.equal(run.skills.reduce((s, r) => s + r.correct, 0), t.TABLES_QUESTIONS);
    assert.truthy(mode.tables.length === 2);
  });

  test('nhân rows are named nhân', () => {
    const { run } = playPerfect('x67');
    assert.deepEqual(run.skills.map(s => s.skillKey).sort(),
      ['math4.cuuchuong.nhan.6', 'math4.cuuchuong.nhan.7']);
  });

  test('an unanswered question is counted skipped, not wrong', () => {
    global.appState = { coins: 0, mathHistory: [] };
    t.startMathTables('x', '89');
    t.answerMathTables(t.mathTablesQuizQuestions()[0].correct);
    t.mathTablesExpireForTest();
    t.mathTablesClockTick();
    const run = global.appState.mathHistory[0];
    const total = run.skills.reduce((s, r) => s + r.attempts, 0);
    const skipped = run.skills.reduce((s, r) => s + r.skipped, 0);
    assert.equal(total, t.TABLES_QUESTIONS);
    assert.equal(skipped, 9, 'nine questions were never seen');
  });

  test('it asks the app to save and to sync, when those exist', () => {
    let saved = 0, synced = 0, studied = 0;
    global.saveMathSession = () => { saved++; };
    global.recordStudy = () => { studied++; };
    global.EngAuth = { syncNow: () => { synced++; } };
    playPerfect('x2345');
    delete global.saveMathSession; delete global.recordStudy; delete global.EngAuth;
    assert.equal(saved, 1, 'must go through saveMathSession so one write persists it');
    assert.equal(synced, 1, 'a child who only does maths must not look inactive');
    assert.equal(studied, 1);
  });
});

suite('bảng cửu chương: the menu offers all six drills', () => {
  test('six buttons, each wired to startMathTables with its own op and group', () => {
    const html = t.renderMathTablesMenuHTML();
    for (const m of t.mathTablesModes()) {
      const call = "startMathTables('" + m.op + "','" + m.group + "')";
      assert.truthy(html.indexOf(call) !== -1, 'no button starts ' + m.key);
      assert.truthy(html.indexOf(m.title) !== -1, 'no label for ' + m.title);
    }
  });

  test('nhân and chia are separated by a heading, not left as six numbers in a row', () => {
    const html = t.renderMathTablesMenuHTML();
    assert.truthy(html.indexOf('Bảng nhân') !== -1 && html.indexOf('Bảng chia') !== -1);
    assert.truthy(html.indexOf('openMathSection(\'toan4\')') !== -1, 'no way back to Toán 4');
  });

  test('the round length and the bonus are stated on the menu, not discovered', () => {
    const html = t.renderMathTablesMenuHTML();
    for (const m of t.mathTablesModes()) {
      assert.truthy(html.indexOf(t.mathTablesSeconds(m) + ' giây') !== -1,
        m.key + ': its own clock is not shown on the menu');
    }
    assert.truthy(html.indexOf(String(t.TABLES_PERFECT_BONUS)) !== -1, 'the bonus is not shown');
  });
});

suite('bảng cửu chương: the clock is per drill, not one number', () => {
  test('bảng chia 8, 9 gets the longest clock — a division fact is slowest to recall', () => {
    assert.equal(t.mathTablesSeconds(t.mathTablesMode('d', '89')), 60);
  });

  test('every other drill runs on the default clock', () => {
    for (const m of t.mathTablesModes()) {
      if (m.key === 'd89') continue;
      assert.equal(t.mathTablesSeconds(m), t.TABLES_SECONDS,
        m.key + ' must run on the default clock');
    }
    assert.equal(t.TABLES_SECONDS, 45);
  });

  test('a round really runs for its own mode\'s length', () => {
    global.appState = { coins: 0, mathHistory: [] };
    t.startMathTables('d', '89');
    const long = t.mathTablesLeftMs();
    t.abandonMathTables();
    t.startMathTables('x', '89');
    const short = t.mathTablesLeftMs();
    t.abandonMathTables();
    assert.truthy(long > short + 10000,
      'bảng chia 8, 9 must get a longer round than bảng nhân 8, 9 (' + long + ' vs ' + short + ')');
  });

  test('elapsedMs is capped by the round\'s OWN length, not a shared constant', () => {
    // Capping a 60s round at 45s would have written an elapsed time shorter
    // than the round actually ran — a silent lie in the admin timeline.
    global.appState = { coins: 0, mathHistory: [] };
    t.startMathTables('d', '89');
    for (let i = 0; i < t.TABLES_QUESTIONS; i++) {
      t.answerMathTables(t.mathTablesQuizQuestions()[i].correct);
    }
    const run = global.appState.mathHistory[0];
    assert.truthy(run.elapsedMs <= 60 * 1000, 'elapsed cannot exceed the round length');
    assert.equal(run.seconds, 60, 'the round must record the clock it was scored against');
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
