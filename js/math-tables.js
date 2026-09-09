// math-tables.js — 🔢 Bảng cửu chương: the times tables against a 30s clock.
//
// A third kind of maths in this tab, and deliberately its own module.
//
// Toán 4 Mix/Pre (js/math.js) is a paper: ten questions from a 500-question
// bank, no clock, scored when the child submits. Math Wars (js/mathwars.js) is
// mental arithmetic over four operators with a hidden difficulty ladder and a
// five-minute clock. This is neither. It is table RECALL — 6 × 7 and 42 : 7 —
// where the only thing being measured is whether the fact comes back fast
// enough to be useful, so the clock is 30 seconds for the whole round and the
// only way to answer is to tap.
//
// Six drills: nhân and chia, over tables 2–5, 6–7 and 8–9. Split that way
// because a child who is fine on ×8 can still lose :8, and splitting by table
// is the only thing that lets the admin skills page say so.
//
// Questions are GENERATED here, not shipped in a bank. There is no data file,
// nothing in LazyData.SCREEN_FILES and nothing extra for the service worker to
// fetch — the drill works offline from the first load.
//
// Rounds are written into appState.mathHistory with grade: 4 and a `g4set`
// code, which is what makes the server side free: js/auth.js already uploads
// grade-4 history carrying detail.g4set, and functions/api/_daily-task.js
// already matches daily tasks on that field. No API change, no migration.

const TABLES_QUESTIONS = 10;
// The clock for the WHOLE round, not per question — three seconds a question.
// A table drill is a fluency race; if there is time to work it out, it is
// measuring something other than recall. This is the single constant to change
// if 30s turns out to be too sharp for bảng chia 8, 9.
const TABLES_SECONDS = 30;
// Same rate as the rest of the maths tab (MATH_COINS_PER_CORRECT) and Math
// Wars, so a child cannot farm coins by picking the easiest mode.
const TABLES_COINS_PER_CORRECT = 2;
// Paid only for a clean 10/10 — the same shape as the Toán 4 Mix/Pre bonuses.
const TABLES_PERFECT_BONUS = 30;
const TABLES_HISTORY_CAP = 300;

const TABLES_GROUPS = [
  { group: '2345', tables: [2, 3, 4, 5], label: '2, 3, 4, 5' },
  { group: '67', tables: [6, 7], label: '6, 7' },
  { group: '89', tables: [8, 9], label: '8, 9' },
];

// The six modes, nhân first. `g4set` is the identity that travels to the
// server; 'cc' groups all six, 'ccx'/'ccd' group the operation, so a daily
// task can be "bất kỳ bảng nào" or one exact drill using nothing but a prefix.
const TABLES_MODES = [];
for (const op of ['x', 'd']) {
  for (const g of TABLES_GROUPS) {
    TABLES_MODES.push({
      key: op + g.group,
      op: op,
      group: g.group,
      tables: g.tables,
      g4set: 'cc' + op + g.group,
      title: (op === 'x' ? 'Bảng nhân ' : 'Bảng chia ') + g.label,
      short: (op === 'x' ? 'Nhân ' : 'Chia ') + g.label,
      icon: op === 'x' ? '✖️' : '➗',
    });
  }
}

function mathTablesModes() { return TABLES_MODES.slice(); }
function mathTablesMode(op, group) {
  return TABLES_MODES.find(m => m.op === op && m.group === group) || null;
}
function mathTablesModeByG4set(g4set) {
  return TABLES_MODES.find(m => m.g4set === g4set) || null;
}

function tablesInt(rand, lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }

// The three wrong options. The mistakes differ by operation, so the
// distractors do too — a wrong option that no child would ever produce turns
// the question into elimination and teaches nothing.
//
//   nhân: the neighbours in the table (one rung up, one rung down) and a + b,
//         the add-instead-of-multiply slip every Grade 4 class makes.
//   chia: the quotient one or two rungs out — "counted the sevens wrong",
//         which is exactly how a child misses a division fact.
//
// Padding exists because the shaped candidates can collide near the ends of
// the table (2 × 1 puts several of them on the same number). It fills upward
// from 1 with whatever is still unused, so the function ALWAYS returns four
// distinct positive integers.
function mathTablesOptions(mode, table, n, answer, rand) {
  const r = rand || Math.random;
  const shaped = mode.op === 'x'
    ? [table * (n - 1), table * (n + 1), table + n, table * (n + 2), table * (n - 2)]
    : [n - 1, n + 1, n + 2, n - 2];
  const wrong = [];
  for (const value of shaped) {
    if (!Number.isInteger(value) || value <= 0) continue;
    if (value === answer || wrong.indexOf(value) !== -1) continue;
    wrong.push(value);
    if (wrong.length === 3) break;
  }
  for (let value = 1; wrong.length < 3; value++) {
    if (value !== answer && wrong.indexOf(value) === -1) wrong.push(value);
  }
  return tablesShuffle(wrong.slice(0, 3).concat([answer]), r);
}

// Fisher–Yates with an injectable source, so a test can pin the order.
function tablesShuffle(arr, rand) {
  const r = rand || Math.random;
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

// One question. `rand` is injectable so a test can pin a sequence rather than
// hope — the same shape warsBuild() uses.
function mathTablesQuestion(mode, rand) {
  const r = rand || Math.random;
  const table = mode.tables[tablesInt(r, 0, mode.tables.length - 1)];
  const n = tablesInt(r, 1, 10);
  return mathTablesBuild(mode, table, n, r);
}

// Split out from mathTablesQuestion so a round can enumerate the facts itself
// and still build them exactly the same way.
function mathTablesBuild(mode, table, n, rand) {
  const r = rand || Math.random;
  const answer = mode.op === 'x' ? table * n : n;
  const q = mode.op === 'x'
    ? table + ' × ' + n
    : (table * n) + ' : ' + table;
  const options = mathTablesOptions(mode, table, n, answer, r);
  return {
    mode: mode.key, op: mode.op, table: table, n: n,
    q: q, answer: answer,
    options: options, correct: options.indexOf(answer),
  };
}

// A round enumerates the mode's whole fact list, shuffles it and takes ten,
// rather than drawing ten times at random. Random draws repeat: over a round
// of ten from bảng 8, 9 a duplicate is more likely than not, and being asked
// 8 × 4 twice in thirty seconds reads to a child as the app glitching.
function mathTablesFacts(mode) {
  const out = [];
  for (const table of mode.tables) {
    for (let n = 1; n <= 10; n++) out.push({ table: table, n: n });
  }
  return out;
}

function mathTablesRoundQuestions(mode, rand) {
  const r = rand || Math.random;
  return tablesShuffle(mathTablesFacts(mode), r)
    .slice(0, TABLES_QUESTIONS)
    .map(f => mathTablesBuild(mode, f.table, f.n, r));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TABLES_QUESTIONS, TABLES_SECONDS, TABLES_COINS_PER_CORRECT,
    TABLES_PERFECT_BONUS, TABLES_HISTORY_CAP, TABLES_MODES,
    mathTablesModes, mathTablesMode, mathTablesModeByG4set,
    mathTablesQuestion, mathTablesBuild, mathTablesOptions, tablesShuffle,
    mathTablesFacts, mathTablesRoundQuestions,
  };
}
