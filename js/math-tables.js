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

// ---- the round --------------------------------------------------------
let _tablesQuiz = null;   // { mode, questions, idx, answers, startedAt, endsAt, timer, askedAt }

function isMathTablesActive() { return !!_tablesQuiz; }
function mathTablesQuizQuestions() { return _tablesQuiz ? _tablesQuiz.questions : []; }
function mathTablesCurrentMode() { return _tablesQuiz ? _tablesQuiz.mode : null; }

function mathTablesScreen() {
  return (typeof document !== 'undefined' && document.getElementById)
    ? document.getElementById('mathHubScreen') : null;
}

function mathTablesStopClock() {
  if (_tablesQuiz && _tablesQuiz.timer && typeof clearInterval === 'function') {
    clearInterval(_tablesQuiz.timer);
    _tablesQuiz.timer = null;
  }
}

// Thirty seconds of concentration scored only at the end, and the bottom nav
// sits exactly where a thumb lands between taps. It goes away for the round,
// as it does for Math Wars and for a đề thi; every exit below puts it back.
function mathTablesLockScreen(locked) {
  if (typeof document === 'undefined') return;
  const nav = document.getElementById('bottomNav');
  if (nav) nav.style.display = locked ? 'none' : '';
}

function abandonMathTables() {
  mathTablesStopClock();
  _tablesQuiz = null;
  mathTablesLockScreen(false);
}

// SILENT teardown for a profile change — no confirm(), no render. Two children
// share one iPad: without this, A's 30-second clock keeps ticking after B has
// been picked, and the study checkpoint writes A's unfinished round into
// localStorage under B's name. Registered in forgetProfileState() (js/app.js).
function mathTablesForgetProfile() { abandonMathTables(); }

function mathTablesLeftMs() {
  if (!_tablesQuiz) return 0;
  return Math.max(0, _tablesQuiz.endsAt - Date.now());
}

// Test seam: pull the deadline into the past so a test can prove the timeout
// path without waiting thirty real seconds.
function mathTablesExpireForTest() {
  if (_tablesQuiz) _tablesQuiz.endsAt = Date.now() - 1;
}

function startMathTables(op, group) {
  mathTablesStopClock();
  const mode = mathTablesMode(op, group);
  if (!mode) return;
  if (typeof retryGate === 'function' && retryGate('math')) return;
  const now = Date.now();
  _tablesQuiz = {
    mode: mode,
    questions: mathTablesRoundQuestions(mode),
    idx: 0,
    answers: [],
    startedAt: now,
    askedAt: now,
    endsAt: now + TABLES_SECONDS * 1000,
    timer: null,
  };
  // The clock repaints only its own node. Re-rendering the whole card every
  // tick would fight the child's finger on the option they are tapping — at
  // three seconds a question there is no margin for that.
  if (typeof setInterval === 'function') {
    _tablesQuiz.timer = setInterval(mathTablesClockTick, 250);
  }
  mathTablesLockScreen(true);
  renderMathTables();
}

function mathTablesClockTick() {
  if (!_tablesQuiz) return;
  const left = mathTablesLeftMs();
  const el = (typeof document !== 'undefined') && document.getElementById('mathTablesClock');
  if (el) {
    el.textContent = '⏱ ' + mathTablesClockText(left);
    if (left <= 10000) el.className = 'wars-clock low';
  }
  if (left <= 0) finishMathTables(true);
}

function mathTablesClockText(ms) {
  const left = Math.max(0, Math.ceil(ms / 1000));
  if (left < 60) return left + 's';
  return Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
}

function answerMathTables(i) {
  const st = _tablesQuiz;
  if (!st || st.idx >= st.questions.length) return;
  if (mathTablesLeftMs() <= 0) { finishMathTables(true); return; }
  const q = st.questions[st.idx];
  const now = Date.now();
  const ok = i === q.correct;
  st.answers.push({ pick: i, ok: ok, ms: Math.max(0, now - st.askedAt) });
  if (typeof petCheerAnswer === 'function') petCheerAnswer(ok);
  st.idx++;
  st.askedAt = now;
  if (st.idx >= st.questions.length) { finishMathTables(false); return; }
  renderMathTables();
}

function mathTablesCoinsEarned(correct, total, comboBonus) {
  return correct * TABLES_COINS_PER_CORRECT
    + (comboBonus || 0)
    + (total > 0 && correct === total ? TABLES_PERFECT_BONUS : 0);
}

function renderMathTables() { /* Task 6 draws the card */ }
function renderMathTablesResult(run, coinsEarned) { /* Task 6 draws the card */ }

function mathTablesSaveRun(run) {
  if (typeof appState === 'undefined' || !appState) return;
  if (!Array.isArray(appState.mathHistory)) appState.mathHistory = [];
  appState.mathHistory.unshift(run);
  if (appState.mathHistory.length > TABLES_HISTORY_CAP) {
    appState.mathHistory.length = TABLES_HISTORY_CAP;
  }
}

function finishMathTables(timedOut) {
  const st = _tablesQuiz;
  if (!st) return;
  mathTablesStopClock();
  mathTablesLockScreen(false);   // the round is scored: let the child leave
  const answered = st.answers.length;
  const correct = st.answers.filter(a => a.ok).length;
  const msSum = st.answers.reduce((s, a) => s + a.ms, 0);
  const comboBonus = typeof petComboBonus === 'function' ? petComboBonus() : 0;
  const coinsEarned = mathTablesCoinsEarned(correct, TABLES_QUESTIONS, comboBonus);
  if (typeof appState !== 'undefined' && appState) {
    appState.coins = (appState.coins || 0) + coinsEarned;
  }
  const run = {
    date: Date.now(),
    // `total` is the FULL round, never the number reached before the clock
    // stopped. Everything downstream — the daily task's "score === total", the
    // best-percentage pin, the admin timeline — reads a short round as a low
    // score, which is what it is.
    total: TABLES_QUESTIONS,
    score: correct,
    answered: answered,
    wrong: [],
    timedOut: !!timedOut,
    meanMs: answered ? Math.round(msSum / answered) : 0,
    elapsedMs: Math.min(TABLES_SECONDS * 1000, Date.now() - st.startedAt),
    grade: 4,
    g4set: st.mode.g4set,
    chapter: 'g4-' + st.mode.g4set,
    label: 'Toán 4 · ' + st.mode.title,
    skills: [],
  };
  mathTablesSaveRun(run);
  _tablesQuiz = null;
  renderMathTablesResult(run, coinsEarned);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TABLES_QUESTIONS, TABLES_SECONDS, TABLES_COINS_PER_CORRECT,
    TABLES_PERFECT_BONUS, TABLES_HISTORY_CAP, TABLES_MODES,
    mathTablesModes, mathTablesMode, mathTablesModeByG4set,
    mathTablesQuestion, mathTablesBuild, mathTablesOptions, tablesShuffle,
    mathTablesFacts, mathTablesRoundQuestions,
    isMathTablesActive, mathTablesQuizQuestions, mathTablesCurrentMode,
    mathTablesStopClock, mathTablesLockScreen, abandonMathTables,
    mathTablesForgetProfile, mathTablesLeftMs, mathTablesExpireForTest,
    startMathTables, mathTablesClockTick, mathTablesClockText, answerMathTables,
    mathTablesCoinsEarned, finishMathTables, mathTablesSaveRun,
    renderMathTables, renderMathTablesResult,
  };
}
