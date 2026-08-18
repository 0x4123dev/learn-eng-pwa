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
const WARS_SECONDS = 60;
const WARS_MAX = 99;                 // hàng chục: nothing above this, anywhere
const WARS_COINS_PER_CORRECT = 2;    // same rate as the Toán 7 tab
const WARS_HISTORY_CAP = 300;

let _warsQuiz = null;   // { questions, idx, answers, startedAt, endsAt, timer }
let _warsView = 'practice';  // 'practice' | 'history'

function warsEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- the questions ----------------------------------------------------
// rand is injectable so tests can pin a sequence instead of hoping.
function _warsInt(rand, lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }

// One question per operator, each built so that BOTH operands and the answer
// land inside 0..99 — a child doing this in their head never meets a number
// they have not been taught to hold.
function warsBuild(op, rand) {
  const r = rand || Math.random;
  let a, b, ans;
  if (op === '+') {
    a = _warsInt(r, 2, 89);
    b = _warsInt(r, 2, WARS_MAX - a);      // tổng không vượt 99
    ans = a + b;
  } else if (op === '−') {
    a = _warsInt(r, 11, WARS_MAX);
    b = _warsInt(r, 2, a - 1);             // hiệu luôn dương
    ans = a - b;
  } else if (op === '×') {
    b = _warsInt(r, 2, 9);
    a = _warsInt(r, 2, Math.floor(WARS_MAX / b));
    ans = a * b;
  } else {                                  // ':' — chia hết, không dư
    b = _warsInt(r, 2, 9);
    ans = _warsInt(r, 2, Math.floor(WARS_MAX / b));
    a = b * ans;                            // số bị chia dựng ngược từ thương
  }
  return { a: a, b: b, op: op, answer: ans };
}

// Wrong answers a child could actually arrive at: off by one, off by ten,
// digits swapped, or the neighbouring operation. Never a number outside the
// range, never a repeat, never the right answer twice.
function warsDistractors(q, rand) {
  const r = rand || Math.random;
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
    if (n < 0 || n > WARS_MAX || seen[n]) return;
    seen[n] = 1;
    out.push(n);
  });
  // Nothing plausible left (tiny answers run out of neighbours) — fill from
  // the range rather than ship a question with two options.
  let n = 0;
  while (out.length < 3 && n <= WARS_MAX) {
    if (!seen[n]) { seen[n] = 1; out.push(n); }
    n++;
  }
  return out;
}

function warsQuestion(rand) {
  const r = rand || Math.random;
  const ops = ['+', '−', '×', ':'];
  const op = ops[_warsInt(r, 0, ops.length - 1)];
  const q = warsBuild(op, r);
  const opts = [q.answer].concat(warsDistractors(q, r));
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

function warsQuestions(n, rand) {
  const out = [];
  const seen = {};
  let guard = 0;
  while (out.length < n && guard++ < n * 40) {
    const q = warsQuestion(rand);
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

function abandonWars() { warsStopClock(); _warsQuiz = null; }

function warsLeftMs() {
  if (!_warsQuiz) return 0;
  return Math.max(0, _warsQuiz.endsAt - Date.now());
}

function startWarsRound() {
  warsStopClock();
  const now = Date.now();
  _warsQuiz = {
    questions: warsQuestions(WARS_QUESTIONS),
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
  renderWars();
}

function warsClockTick() {
  if (!_warsQuiz) return;
  const left = warsLeftMs();
  const el = (typeof document !== 'undefined') && document.getElementById('warsClock');
  if (el) {
    el.textContent = '⏱ ' + Math.ceil(left / 1000) + 's';
    if (left <= 10000) el.className = 'wars-clock low';
  }
  if (left <= 0) finishWars(true);
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
  const answered = st.answers.length;
  const correct = st.answers.filter(a => a.ok).length;
  const wrong = answered - correct;
  const msSum = st.answers.reduce((s, a) => s + a.ms, 0);

  // Coins on the same terms as the Toán 7 tab: 2 per correct answer, plus any
  // combo treats the dog promised on screen during the round.
  const coinsEarned = correct * WARS_COINS_PER_CORRECT
    + (typeof petComboBonus === 'function' ? petComboBonus() : 0);
  if (typeof appState !== 'undefined' && appState) {
    appState.coins = (appState.coins || 0) + coinsEarned;
  }

  const run = {
    date: Date.now(),
    total: st.questions.length,
    answered: answered,
    correct: correct,
    wrong: wrong,
    meanMs: answered ? Math.round(msSum / answered) : 0,
    elapsedMs: Math.min(WARS_SECONDS * 1000, Date.now() - st.startedAt),
    timedOut: !!timedOut,
  };
  warsSaveRun(run);
  if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  _warsQuiz = null;
  renderWarsResult(run, coinsEarned);
}

// ---- rendering ---------------------------------------------------------
function warsClockHTML() {
  const left = Math.ceil(warsLeftMs() / 1000);
  return `<span class="wars-clock${left <= 10 ? ' low' : ''}" id="warsClock">⏱ ${left}s</span>`;
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
        <button class="grammar-back-btn" onclick="abandonWars(); renderMathHome()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        ${warsClockHTML()}
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${st.idx / total * 100}%"></div></div>
      </div>
      <div class="wars-sum">${warsEsc(q.q)} = <span class="wars-gap">?</span></div>
      <div class="wars-options">
        ${q.options.map((o, i) => `<button class="wars-option" onclick="answerWars(${i})">${o}</button>`).join('')}
      </div>
    </div>`;
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
      <button class="phrases-cta" onclick="startWarsRound()">
        <span class="phrases-cta-icon">⚔️</span>
        <span class="phrases-cta-text"><strong>Đấu lại</strong><small>10 câu · ${WARS_SECONDS} giây</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
      <button class="phrases-cta-secondary" onclick="switchWarsView('history')">📊 Xem thống kê</button>
    </div>`;
}

function switchWarsView(v) {
  _warsView = (v === 'history') ? 'history' : 'practice';
  renderMathHome();
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
      <p class="phrases-sub">${WARS_QUESTIONS} phép tính cộng – trừ – nhân – chia trong <b>${WARS_SECONDS} giây</b>. Số nào cũng nằm trong khoảng 0–${WARS_MAX} nên tính nhẩm được hết.</p>
    </div>
    <button class="phrases-cta" onclick="startWarsRound()">
      <span class="phrases-cta-icon">⚔️</span>
      <span class="phrases-cta-text"><strong>Vào trận</strong><small>${WARS_QUESTIONS} câu · ${WARS_SECONDS} giây · 2 🪙 mỗi câu đúng</small></span>
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
        <span class="phrases-cta-text"><strong>Vào trận</strong><small>${WARS_QUESTIONS} câu · ${WARS_SECONDS} giây</small></span>
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
    WARS_QUESTIONS, WARS_SECONDS, WARS_MAX, WARS_COINS_PER_CORRECT,
    warsBuild, warsDistractors, warsQuestion, warsQuestions,
    warsHistory, warsStats, warsSaveRun, warsEsc,
    startWarsRound, answerWars, finishWars, abandonWars, isWarsActive,
    warsLeftMs, warsClockTick, renderWars, renderWarsResult, warsDonutHTML,
    renderWarsHomeHTML, renderWarsPracticeHTML, renderWarsHistoryHTML,
    switchWarsView, warsWhen,
  };
}
