// mathwars.js — ⚔️ Math Wars: mental arithmetic against a 60-second clock.
//
// A different muscle from the Toán 7 tab. That one is about RECOGNISING the
// right formula and takes as long as it takes; this one is about doing
// 18 : 2 in your head, fast, over and over — the fluency a Grade 4 child needs
// before word problems stop being about arithmetic and start being about the
// problem.
//
// Every number stays inside 0–99 (hàng chục) in both the question and the
// answer, so nothing here needs paper.
//
// State lives in appState.warsHistory; the results feed the same coin, streak
// and admin-sync systems as every other practice.

const WARS_QUESTIONS = 10;
// Five minutes. A Grade 4 child doing 63 : 7 in their head needs thinking
// time; at 60s the clock was the difficulty rather than the sums, and even
// two minutes ended rounds with questions unseen. Ten questions in five
// minutes is thirty seconds each — room to work it out, still a race.
const WARS_SECONDS = 300;
const WARS_MAX = 99;                 // hàng chục: trần của thang Math Wars
// The wars ladder stops at 99, but Đấu Toán needs headroom above it to
// handicap two children who both reached the top rung. Only a fight ever
// passes a max above WARS_MAX. Solo practice stays capped at 99.
const WARS_HARD_MAX = 199;
const WARS_COINS_PER_CORRECT = 2;    // same rate as the Toán 7 tab
const WARS_PERFECT_BONUS = 20;       // 10/10 earns a visible accuracy bonus
const WARS_HISTORY_CAP = 300;

// ---- the hidden difficulty ladder -------------------------------------
// Retained for saved progress and the duel handicap. Solo practice now uses
// the harder filtered pool through 99 regardless of this legacy ladder.
// A Grade 4 child starting on 63 : 7 gives up; the same child starting on
// 12 : 2 finishes the round and comes back. So the round is not one
// difficulty — it is a ladder, and the child is never told they are on it.
//
// Bậc 1 keeps every answer under 20. More than twenty correct answers IN A
// ROW opens bậc 2, under 30, and so on to 99. A round is ten questions, so
// twenty-one means clearing two whole rounds without a single slip and then
// getting one more right — a bậc is earned by sustained accuracy, not by one
// good round. A wrong answer costs the streak, not the bậc: the ladder only
// ever goes up, because a child who has to re-earn ground they already had
// learns that trying is what costs them.
//
// The streak is counted across rounds, not inside one, so a run spread over
// the end of one round and the start of the next still counts.
const WARS_LEVEL_BASE = 20;          // trần bậc 1: đáp án < 20
const WARS_LEVEL_STEP = 10;          // mỗi bậc nới thêm 10
const WARS_LEVEL_UP_STREAK = 21;     // phải đúng > 20 câu liên tiếp mới lên bậc
// 19, 29, 39 … 99 — the last bậc is the old fixed range.
const WARS_LEVELS = Math.floor((WARS_MAX + 1 - WARS_LEVEL_BASE) / WARS_LEVEL_STEP) + 1;

let _warsQuiz = null;   // { questions, idx, answers, startedAt, endsAt, timer }
let _warsView = 'practice';  // 'practice' | 'history'
// Where the ladder lives when there is no appState to keep it in (tests, and
// the first paint before a user is loaded).
let _warsProgressFallback = { level: 0, streak: 0 };

function warsEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- where the child is on the ladder ---------------------------------
// Kept on appState so it rides the same save/sync as coins and history, and
// deliberately kept OFF the screen: the child sees "Math Wars", not "bậc 3".
function warsProgress() {
  const home = (typeof appState !== 'undefined' && appState) ? appState : null;
  const p = home ? home.warsProgress : _warsProgressFallback;
  const level = Math.min(WARS_LEVELS - 1, Math.max(0, Math.floor((p && p.level) || 0)));
  const streak = Math.max(0, Math.floor((p && p.streak) || 0));
  const out = { level: level, streak: streak };
  if (home) home.warsProgress = out; else _warsProgressFallback = out;
  return out;
}

// The ceiling for a bậc: bậc 1 → 19, bậc 2 → 29 … capped at 99.
function warsLevelMax(level) {
  const lv = Math.min(WARS_LEVELS - 1, Math.max(0, Math.floor(level || 0)));
  return Math.min(WARS_MAX, WARS_LEVEL_BASE + WARS_LEVEL_STEP * lv - 1);
}

function warsMax() { return warsLevelMax(warsProgress().level); }

// Called once per answered question. More than twenty in a row and the
// ceiling moves; one slip and the count starts over, but the bậc already
// earned stays.
function warsNoteAnswer(ok) {
  const home = (typeof appState !== 'undefined' && appState) ? appState : null;
  const p = warsProgress();
  if (!ok) { p.streak = 0; }
  else {
    p.streak += 1;
    if (p.streak >= WARS_LEVEL_UP_STREAK) {
      p.streak = 0;
      if (p.level < WARS_LEVELS - 1) p.level += 1;
    }
  }
  if (home) home.warsProgress = p; else _warsProgressFallback = p;
  return p;
}

// ---- the questions ----------------------------------------------------
// rand is injectable so tests can pin a sequence instead of hoping.
function _warsInt(rand, lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }

// One question per operator, each built so that BOTH operands and the answer
// land inside 0..max — a child doing this in their head never meets a number
// they have not been taught to hold, and never one above the bậc they are on.
function warsBuild(op, rand, max) {
  const r = rand || Math.random;
  const hi = Math.max(WARS_LEVEL_BASE - 1, Math.min(WARS_HARD_MAX, Math.floor(max || warsMax())));
  let a, b, ans;
  if (op === '+') {
    a = _warsInt(r, 2, hi - 2);
    b = _warsInt(r, 2, hi - a);            // tổng không vượt trần
    ans = a + b;
  } else if (op === '−') {
    a = _warsInt(r, 11, hi);
    b = _warsInt(r, 2, a - 1);             // hiệu luôn dương
    ans = a - b;
  } else if (op === '×') {
    b = _warsInt(r, 2, hi > WARS_MAX ? 12 : 9);
    a = _warsInt(r, 2, Math.max(2, Math.floor(hi / b)));
    ans = a * b;
  } else {                                  // ':' — chia hết, không dư
    b = _warsInt(r, 2, hi > WARS_MAX ? 12 : 9);
    ans = _warsInt(r, 2, Math.max(2, Math.floor(hi / b)));
    a = b * ans;                            // số bị chia dựng ngược từ thương
  }
  return { a: a, b: b, op: op, answer: ans };
}

// Wrong answers a child could actually arrive at: off by one, off by ten,
// digits swapped, or the neighbouring operation. Never a number outside the
// range, never a repeat, never the right answer twice.
function warsDistractors(q, rand, max) {
  const r = rand || Math.random;
  const hi = Math.max(WARS_LEVEL_BASE - 1, Math.min(WARS_HARD_MAX, Math.floor(max || warsMax())));
  const swap = (n) => (n >= 10 && n <= 99) ? (n % 10) * 10 + Math.floor(n / 10) : null;
  const pool = [
    q.answer + 1, q.answer - 1, q.answer + 2, q.answer - 2,
    q.answer + 10, q.answer - 10, swap(q.answer),
    q.op === '×' ? q.a + q.b : q.a * q.b,
    q.op === '+' ? q.a - q.b : q.a + q.b,
    q.op === ':' ? q.a - q.b : (q.a && q.b ? Math.round(q.a / q.b) : null),
  ];
  const seen = { [q.answer]: 1 };
  const out = [];
  // Shuffled so the same near-miss is not always option B.
  const idx = pool.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  idx.forEach(i => {
    const n = pool[i];
    if (out.length >= 3) return;
    if (n === null || !Number.isFinite(n)) return;
    if (n < 0 || n > hi || seen[n]) return;
    seen[n] = 1;
    out.push(n);
  });
  // Nothing plausible left (tiny answers run out of neighbours) — fill from
  // the range rather than ship a question with two options.
  let n = 0;
  while (out.length < 3 && n <= hi) {
    if (!seen[n]) { seen[n] = 1; out.push(n); }
    n++;
  }
  return out;
}

function warsQuestion(rand, max) {
  const r = rand || Math.random;
  const hi = Math.max(WARS_LEVEL_BASE - 1, Math.min(WARS_HARD_MAX, Math.floor(max || warsMax())));
  const ops = ['+', '−', '×', ':'];
  const op = ops[_warsInt(r, 0, ops.length - 1)];
  const q = warsBuild(op, r, hi);
  const opts = [q.answer].concat(warsDistractors(q, r, hi));
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = opts[i]; opts[i] = opts[j]; opts[j] = t;
  }
  return {
    q: q.a + ' ' + q.op + ' ' + q.b,
    a: q.a, b: q.b, op: q.op,
    answer: q.answer,
    options: opts,
    correct: opts.indexOf(q.answer),
  };
}

// Solo practice now requires carrying/borrowing and harder multiplication
// and division. Keep this separate from the shared, seeded duel rules.
function warsIsEasyQuestion(q) {
  const { a, b, op, answer } = q;
  if (answer < 10) return true;
  if (op === '+') return a < 10 || b < 10 || a % 10 + b % 10 < 10;
  if (op === '−') return b < 10 || a % 10 >= b % 10;
  if (op === '×') return Math.min(a, b) <= 5 || a % 10 === 0 || b % 10 === 0;
  return b <= 5 || answer <= 5 || b % 10 === 0 || answer % 10 === 0;
}

// All saved levels use the filtered pool through 99 immediately. The saved
// ladder still advances for the duel handicap; it no longer gates practice.
// Apply the same criteria if the lazy-loaded bank is unavailable.
function warsRoundQuestions(level) {
  const R = typeof MathFightRules !== 'undefined' ? MathFightRules : null;
  const bank = typeof MATH_WARS_BANK !== 'undefined' ? MATH_WARS_BANK :
    (typeof MATH_FIGHT_BANK !== 'undefined' ? MATH_FIGHT_BANK : null);
  if (R && R.bankRound && bank) {
    const practiceBank = bank.filter(([a, b, op, answer]) =>
      !warsIsEasyQuestion({ a, b, op, answer }));
    const round = R.bankRound(practiceBank, WARS_QUESTIONS, 8, null);
    if (round.length === WARS_QUESTIONS) return round;
  }
  return warsQuestions(WARS_QUESTIONS, null, WARS_MAX, { excludeEasy: true });
}

function warsQuestions(n, rand, max, opts) {
  const min = Math.max(0, Math.trunc((opts && opts.minAnswer) || 0));
  const out = [];
  const seen = {};
  // Rejecting the easy half needs more draws than an unfiltered round does.
  let guard = 0, limit = n * (min || (opts && opts.excludeEasy) ? 200 : 40);
  while (out.length < n && guard++ < limit) {
    const q = warsQuestion(rand, max);
    if (min && Math.abs(q.answer) < min) continue;
    if (opts && opts.excludeEasy && warsIsEasyQuestion(q)) continue;
    if (seen[q.q]) continue;      // no repeat inside one round
    seen[q.q] = 1;
    out.push(q);
  }
  return out;
}

// ---- history ----------------------------------------------------------
function warsHistory() {
  if (typeof appState === 'undefined' || !appState) return [];
  if (!Array.isArray(appState.warsHistory)) appState.warsHistory = [];
  return appState.warsHistory;
}

function warsStats(list) {
  const runs = list || warsHistory();
  if (!runs.length) return null;
  let correct = 0, wrong = 0, msSum = 0, msCount = 0, best = 0;
  runs.forEach(r => {
    correct += r.correct || 0;
    wrong += r.wrong || 0;
    if (r.meanMs && r.answered) { msSum += r.meanMs * r.answered; msCount += r.answered; }
    if ((r.correct || 0) > best) best = r.correct;
  });
  const answered = correct + wrong;
  return {
    runs: runs.length,
    correct: correct,
    wrong: wrong,
    answered: answered,
    accuracy: answered ? Math.round(correct / answered * 100) : 0,
    meanSec: msCount ? (msSum / msCount / 1000) : 0,
    best: best,
  };
}

function warsSaveRun(run) {
  if (typeof appState === 'undefined' || !appState) return;
  const list = warsHistory();
  list.unshift(run);
  if (list.length > WARS_HISTORY_CAP) list.length = WARS_HISTORY_CAP;
  if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    try { saveUserData(currentUser, appState); } catch (e) {}
  }
}

// ---- the round ---------------------------------------------------------
// 10 questions, 60 seconds, whichever runs out first. The clock is the point:
// a child who can do these but needs ten seconds each has not finished
// learning them, and a round that waited for them would never say so.

// Guarded: the round's own bookkeeping (score, coins, history) must finish
// even where there is no DOM to draw on — headless tests, and the moment
// the clock fires after the screen has been torn down.
function warsScreen() {
  return (typeof document !== 'undefined' && document.getElementById)
    ? document.getElementById('mathHubScreen') : null;
}
function isWarsActive() { return !!_warsQuiz; }

function warsStopClock() {
  if (_warsQuiz && _warsQuiz.timer && typeof clearInterval === 'function') {
    clearInterval(_warsQuiz.timer);
    _warsQuiz.timer = null;
  }
}

function abandonWars() {
  warsStopClock();
  _warsQuiz = null;
  warsLockScreen(false);
  // No round left → the checkpoint is cleared at once (js/app.js), the way
  // finishWars and abandonMathQuiz do. It used to wait for the next tap's
  // coalesced save, so a round abandoned from the bottom bar was still on
  // offer for a moment — and for good, if the page was reloaded first.
  if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
}

// SILENT teardown for a profile change. abandonWars() already stops the clock
// and restores the bottom bar, but it is only reached from openMathSection and
// from switchScreen's confirm() — neither of which is on the road to the
// profile picker. So A's round kept its 250ms clock, and the study checkpoint
// (js/app.js) wrote A's unfinished round into localStorage under B's name.
// _warsProgressFallback only stands in when there is no appState at all (a
// logged-out page, a test), so it is not how the ladder normally travels — but
// it is a per-child level and streak in the one case it IS read, and resetting
// it costs nothing.
function warsForgetProfile() {
  abandonWars();
  _warsView = 'practice';
  _warsProgressFallback = { level: 0, streak: 0 };
}

// Five minutes against a clock, scored only when the clock stops — a mis-tap on
// the bottom bar costs the whole round and the clock does not wait while the
// child works out how to get back. So the bar goes away for the round, exactly
// as it does for Đấu Toán, and every exit below restores it.
function warsLockScreen(locked) {
  if (typeof document === 'undefined') return;
  const nav = document.getElementById('bottomNav');
  if (nav) nav.style.display = locked ? 'none' : '';
}

// The ✕ sits exactly where a thumb rests while tapping answers. A round is two
// minutes of concentration and is scored only at the end, so a stray tap costs
// everything — it asks first.
function _warsBackToMenu() {
  // math.js owns the menu; guarded because mathwars.js is also loaded on its
  // own in tests, where there is no menu to go back to.
  if (typeof renderMathHome === 'function') renderMathHome();
}

function warsQuit() {
  if (!isWarsActive()) { _warsBackToMenu(); return; }
  const left = warsClockText(warsLeftMs());
  const ask = (typeof confirm === 'function')
    ? confirm('Con đang trong trận Math Wars, còn ' + left + '.\n'
            + 'Ra bây giờ thì trận này không được tính điểm.\n\nVẫn ra chứ?')
    : true;
  if (!ask) return;
  abandonWars();
  _warsBackToMenu();
}

function warsLeftMs() {
  if (!_warsQuiz) return 0;
  return Math.max(0, _warsQuiz.endsAt - Date.now());
}

function startWarsRound() {
  warsStopClock();
  const now = Date.now();
  // The bậc is pinned when the round opens, so a ladder step earned on
  // question 9 does not change the sums under the child's fingers — it shows
  // up in the next round, which is the only place they could notice it.
  const level = warsProgress().level;
  _warsQuiz = {
    level: level,
    max: warsLevelMax(level),
    questions: warsRoundQuestions(level),
    idx: 0,
    answers: [],
    askedAt: now,
    startedAt: now,
    endsAt: now + WARS_SECONDS * 1000,
    timer: null,
  };
  // The clock only repaints its own node — re-rendering the whole card every
  // second would fight the child's finger on the option they are tapping.
  if (typeof setInterval === 'function') {
    _warsQuiz.timer = setInterval(warsClockTick, 250);
  }
  warsLockScreen(true);
  renderWars();
}

function warsClockTick() {
  if (!_warsQuiz) return;
  const left = warsLeftMs();
  const el = (typeof document !== 'undefined') && document.getElementById('warsClock');
  if (el) {
    el.textContent = '⏱ ' + warsClockText(left);
    if (left <= 10000) el.className = 'wars-clock low';
  }
  if (left <= 0) finishWars(true);
  // The remaining time is in the checkpoint; keep it near true (js/app.js).
  else if (typeof saveStudyCheckpointOnClock === 'function') saveStudyCheckpointOnClock();
}

// Answering is the only thing that advances the round, so the time a question
// took is simply the gap since the last one appeared.
function answerWars(i) {
  const st = _warsQuiz;
  if (!st || st.idx >= st.questions.length) return;
  if (warsLeftMs() <= 0) { finishWars(true); return; }
  const q = st.questions[st.idx];
  const now = Date.now();
  st.answers.push({ pick: i, ok: i === q.correct, ms: Math.max(0, now - st.askedAt) });
  warsNoteAnswer(i === q.correct);
  if (typeof petCheerAnswer === 'function') petCheerAnswer(i === q.correct);
  st.idx++;
  st.askedAt = now;
  if (st.idx >= st.questions.length) { finishWars(false); return; }
  renderWars();
}

function finishWars(timedOut) {
  const st = _warsQuiz;
  if (!st) return;
  warsStopClock();
  warsLockScreen(false);   // the round is scored: let the child leave
  const answered = st.answers.length;
  const correct = st.answers.filter(a => a.ok).length;
  const wrong = answered - correct;
  const msSum = st.answers.reduce((s, a) => s + a.ms, 0);

  // Coins on the same terms as the Toán 7 tab: 2 per correct answer, plus any
  // combo treats the dog promised on screen during the round.
  const comboBonus = typeof petComboBonus === 'function' ? petComboBonus() : 0;
  const coinsEarned = warsCoinsEarned(correct, st.questions.length, comboBonus);
  if (typeof appState !== 'undefined' && appState) {
    appState.coins = (appState.coins || 0) + coinsEarned;
  }

  const opLabels = { '+': 'Phép cộng', '−': 'Phép trừ', '×': 'Phép nhân', ':': 'Phép chia' };
  const opKeys = { '+': 'add', '−': 'subtract', '×': 'multiply', ':': 'divide' };
  const skillMap = {};
  st.questions.forEach((q, i) => {
    const key = 'mathwars.' + (opKeys[q.op] || 'other');
    const row = skillMap[key] || (skillMap[key] = {
      skillKey: key, skillLabel: opLabels[q.op] || 'Phép tính khác',
      attempts: 0, correct: 0, wrong: 0, skipped: 0, wrongRefs: []
    });
    row.attempts++;
    const answer = st.answers[i];
    if (!answer) row.skipped++;
    else if (answer.ok) row.correct++;
    else {
      row.wrong++;
      if (row.wrongRefs.length < 20) row.wrongRefs.push(q.q);
    }
  });

  const run = {
    date: Date.now(),
    total: st.questions.length,
    answered: answered,
    correct: correct,
    wrong: wrong,
    meanMs: answered ? Math.round(msSum / answered) : 0,
    elapsedMs: Math.min(WARS_SECONDS * 1000, Date.now() - st.startedAt),
    timedOut: !!timedOut,
    // Not shown anywhere in the app — it is here so a parent (and the admin
    // timeline) can see the sums were getting harder, and so a run's score
    // can be read against the bậc it was scored at.
    level: (st.level || 0) + 1,
    max: st.max || WARS_MAX,
    skills: Object.keys(skillMap).map(k => skillMap[k]),
  };
  warsSaveRun(run);
  if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  _warsQuiz = null;
  // No round → the checkpoint is cleared, so a finished one is never offered back.
  if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
  renderWarsResult(run, coinsEarned);
}

// ---- rendering ---------------------------------------------------------
// "107s" is a number to decode; "1:47" is a clock a child has read since they
// were six. Under a minute it drops back to plain seconds, which counts down
// more urgently at exactly the moment that matters.
// One phrase for "how long is a round", so the length can move without
// leaving "60 giây" written somewhere on screen.
function warsLengthLabel() {
  return (WARS_SECONDS % 60 === 0)
    ? (WARS_SECONDS / 60) + ' phút'
    : WARS_SECONDS + ' giây';
}

function warsClockText(ms) {
  const left = Math.max(0, Math.ceil(ms / 1000));
  if (left < 60) return left + 's';
  return Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
}

function warsClockHTML() {
  const ms = warsLeftMs();
  return `<span class="wars-clock${ms <= 10000 ? ' low' : ''}" id="warsClock">⏱ ${warsClockText(ms)}</span>`;
}

function renderWars() {
  const screen = warsScreen();
  const st = _warsQuiz;
  if (!screen || !st) return;
  const q = st.questions[st.idx];
  const total = st.questions.length;
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="warsQuit()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        ${warsClockHTML()}
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${st.idx / total * 100}%"></div></div>
      </div>
      <div class="wars-sum">${warsEsc(q.q)} = <span class="wars-gap">?</span></div>
      <div class="wars-options">
        ${q.options.map((o, i) => `<button class="wars-option" onclick="answerWars(${i})">${o}</button>`).join('')}
      </div>
    </div>`;
  // The screen and the checkpoint change together (js/app.js).
  if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
}

// The donut the results and the history screen share: accuracy in the middle,
// wrong on the left, right on the right — the shape from the reference design.
function warsDonutHTML(correct, wrong, meanSec) {
  const answered = correct + wrong;
  const pct = answered ? Math.round(correct / answered * 100) : 0;
  return `
    <div class="wars-stats">
      <div class="wars-stat wrong">
        <div class="wars-stat-label">Sai</div>
        <div class="wars-stat-value">${wrong}</div>
      </div>
      <div class="wars-donut" style="--pct:${pct}">
        <div class="wars-donut-hole">
          <div class="wars-donut-label">Chính xác</div>
          <div class="wars-donut-value">${pct}<span>%</span></div>
        </div>
      </div>
      <div class="wars-stat right">
        <div class="wars-stat-label">Đúng</div>
        <div class="wars-stat-value">${correct}</div>
      </div>
    </div>
    <div class="wars-mean">⏱ Thời gian trung bình <b>${meanSec.toFixed(2)}s</b></div>`;
}

function renderWarsResult(run, coinsEarned) {
  const screen = warsScreen();
  if (!screen) return;
  const meanSec = run.meanMs / 1000;
  const skipped = run.total - run.answered;
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderMathHome()">‹</button>
        <span class="grammar-quiz-progress">⚔️ ${run.correct}/${run.total}</span>
      </div>
      <div class="wars-result-card">
        <div class="wars-result-title">${run.timedOut ? '⏰ Hết giờ!' : '🎉 Xong 10 câu!'}</div>
        ${warsDonutHTML(run.correct, run.wrong, meanSec)}
        ${skipped ? `<div class="wars-skipped">Còn <b>${skipped}</b> câu chưa kịp làm</div>` : ''}
      </div>
      ${typeof petRewardCardHTML === 'function'
        ? petRewardCardHTML(run.correct, run.total, coinsEarned, WARS_COINS_PER_CORRECT)
        : `<div class="grammar-result-coins">+${coinsEarned} 🪙</div>`}
      ${run.total > 0 && run.correct === run.total ? `<div class="wars-perfect-bonus">🎯 Đúng 100% · thưởng thêm +${WARS_PERFECT_BONUS} xu</div>` : ''}
      <button class="phrases-cta" onclick="startWarsRound()">
        <span class="phrases-cta-icon">⚔️</span>
        <span class="phrases-cta-text"><strong>Đấu lại</strong><small>${WARS_QUESTIONS} câu · ${warsLengthLabel()}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
      <button class="phrases-cta-secondary" onclick="switchWarsView('history')">📊 Xem thống kê</button>
    </div>`;
}

function switchWarsView(v) {
  _warsView = (v === 'history') ? 'history' : 'practice';
  renderMathHome();
}

function warsCoinsEarned(correct,total,comboBonus=0) {
  const right=Math.max(0,Math.trunc(+correct||0)),count=Math.max(0,Math.trunc(+total||0));
  return right*WARS_COINS_PER_CORRECT+Math.max(0,Math.trunc(+comboBonus||0))
    +(count>0&&right===count?WARS_PERFECT_BONUS:0);
}

function warsWhen(ts) {
  try {
    return new Date(ts).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return ''; }
}

function renderWarsPracticeHTML() {
  const s = warsStats();
  return `
    <div class="phrases-hero">
      <div class="phrases-hero-icon">⚔️</div>
      <h1>Math Wars</h1>
      <p class="phrases-sub">${WARS_QUESTIONS} phép tính cộng – trừ – nhân – chia trong <b>${warsLengthLabel()}</b>. Số nào cũng tính nhẩm được, không cần giấy bút.</p>
    </div>
    <button class="phrases-cta" onclick="startWarsRound()">
      <span class="phrases-cta-icon">⚔️</span>
      <span class="phrases-cta-text"><strong>Vào trận</strong><small>${WARS_QUESTIONS} câu · ${warsLengthLabel()} · 2 🪙 mỗi câu đúng</small></span>
      <span class="phrases-cta-arrow">›</span>
    </button>
    ${s ? `<div class="phrases-cat-row"><span>🏆 Kỷ lục</span><strong>${s.best}/${WARS_QUESTIONS}</strong></div>
           <div class="phrases-cat-row"><span>🎯 Chính xác chung</span><strong>${s.accuracy}%</strong></div>`
        : '<div class="phrases-empty">Chưa có trận nào — bấm “Vào trận” để bắt đầu nhé!</div>'}`;
}

function renderWarsHistoryHTML() {
  const runs = warsHistory();
  const s = warsStats(runs);
  if (!s) {
    return `
      <div class="phrases-hero">
        <div class="phrases-hero-icon">📊</div>
        <h1>Chưa có trận nào</h1>
        <p class="phrases-sub">Đánh một trận Math Wars là thống kê hiện ở đây.</p>
      </div>
      <button class="phrases-cta" onclick="switchWarsView('practice')">
        <span class="phrases-cta-icon">⚔️</span>
        <span class="phrases-cta-text"><strong>Vào trận</strong><small>${WARS_QUESTIONS} câu · ${warsLengthLabel()}</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>`;
  }
  const rows = runs.slice(0, 30).map(r => {
    const pct = r.answered ? Math.round(r.correct / r.answered * 100) : 0;
    return `
      <div class="math-hist-row">
        <span class="math-hist-emoji">${pct === 100 ? '⭐' : pct >= 60 ? '✅' : '📝'}</span>
        <div class="math-hist-main">
          <div class="math-hist-title">${r.correct}/${r.total} đúng${r.timedOut ? ' · hết giờ' : ''}</div>
          <div class="math-hist-bar"><div class="math-hist-fill tier-${pct === 100 ? 'perfect' : pct >= 60 ? 'great' : 'weak'}" style="width:${pct}%"></div></div>
        </div>
        <div class="math-hist-side">
          <strong>${(r.meanMs / 1000).toFixed(2)}s</strong>
          <span>${pct}% · ${warsWhen(r.date)}</span>
        </div>
      </div>`;
  }).join('');
  return `
    <div class="wars-result-card">
      ${warsDonutHTML(s.correct, s.wrong, s.meanSec)}
    </div>
    <div class="math-hist-stats">
      <div class="math-hist-stat"><strong>${s.runs}</strong><span>trận</span></div>
      <div class="math-hist-stat"><strong>${s.best}/${WARS_QUESTIONS}</strong><span>kỷ lục</span></div>
      <div class="math-hist-stat"><strong>${s.answered}</strong><span>câu đã làm</span></div>
    </div>
    <div class="math-hist-list">${rows}</div>`;
}

function renderWarsHomeHTML() {
  const tabs = [['practice', '⚔️ Luyện tập'], ['history', '📊 Thống kê']].map(([v, lbl]) =>
    `<button class="grammar-subtab ${_warsView === v ? 'active' : ''}" onclick="switchWarsView('${v}')">${lbl}</button>`).join('');
  const body = _warsView === 'history' ? renderWarsHistoryHTML() : renderWarsPracticeHTML();
  return `<div class="grammar-subtabs" role="tablist">${tabs}</div><div class="phrases-wrap">${body}</div>`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WARS_QUESTIONS, WARS_SECONDS, WARS_MAX, WARS_HARD_MAX, WARS_COINS_PER_CORRECT, WARS_PERFECT_BONUS,
    WARS_LEVEL_BASE, WARS_LEVEL_STEP, WARS_LEVEL_UP_STREAK, WARS_LEVELS,
    warsProgress, warsLevelMax, warsMax, warsNoteAnswer,
    warsBuild, warsDistractors, warsQuestion, warsQuestions, warsRoundQuestions, warsIsEasyQuestion,
    warsHistory, warsStats, warsSaveRun, warsEsc,
    startWarsRound, answerWars, finishWars, abandonWars, warsForgetProfile, warsQuit, isWarsActive,
    warsLeftMs, warsClockTick, warsClockText, warsLengthLabel,
    renderWars, renderWarsResult, warsDonutHTML,
    renderWarsHomeHTML, renderWarsPracticeHTML, renderWarsHistoryHTML,
    switchWarsView, warsWhen, warsCoinsEarned,
  };
}
