// rewrite.js — "Rewrite" tab: typed sentence-transformation practice.
// Data lives in js/rewrite-data.js (global REWRITE_QUESTIONS, 200 items).
// Every question is typed: the student reads the original sentence and
// completes the rewritten one ("→ stem ___") in a textbox. Mirrors the
// Word form/Phrases patterns: quick practice, wrong-answer review drill,
// filterable history, +5 coins per correct answer, admin activity sync.

const RW_HISTORY_CAP = 300;
const RW_TIER_LABELS = { all: 'All scores', perfect: '⭐ Perfect', great: '✅ Great', ok: '👍 OK', weak: '📝 Weak' };

let _rwQuiz = null;            // active quiz: { questions:[], idx, answers:[] }
let _rwHistoryFilter = 'all';

function rwEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function rwTier(pct) { return pct === 100 ? 'perfect' : pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'weak'; }
function rwTierEmoji(pct) { return pct === 100 ? '⭐' : pct >= 80 ? '✅' : pct >= 60 ? '👍' : '📝'; }

function rwShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rewriteBank() {
  return (typeof REWRITE_QUESTIONS !== 'undefined') ? REWRITE_QUESTIONS : [];
}
function rewriteById(id) {
  return rewriteBank().find(q => q.id === id) || null;
}

// Lenient grading: case / punctuation / whitespace-insensitive, plus
// contraction-insensitive (don't ≡ do not) so honest variants pass.
function _rwNormalize(s) {
  return String(s || '').toLowerCase().normalize('NFC')
    .replace(/’/g, "'")
    .replace(/\b(can)not\b/g, "can't")
    .replace(/\b(do|does|did|is|are|was|were|has|have|had|would|should|could|will|must)\s+not\b/g, (m, v) =>
      v === 'will' ? "won't" : v + "n't")
    .replace(/[.,!?;:"“”`]/g, '')
    .replace(/\s+/g, ' ').trim();
}
function _rwTextCorrect(text, q) {
  const u = _rwNormalize(text);
  if (!u) return false;
  const list = (q.accept && q.accept.length) ? q.accept : [q.answer];
  return list.some(a => _rwNormalize(a) === u);
}

// ---- history storage (per-user, in appState) ----
function rewriteHistory() {
  if (typeof appState !== 'undefined' && appState) {
    if (!Array.isArray(appState.rewriteHistory)) appState.rewriteHistory = [];
    return appState.rewriteHistory;
  }
  return [];
}
function saveRewriteSession(session) {
  const hist = rewriteHistory();
  hist.unshift(session);
  if (hist.length > RW_HISTORY_CAP) hist.length = RW_HISTORY_CAP;
  if (typeof appState !== 'undefined' && typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    while (true) {
      try { saveUserData(currentUser, appState); break; }
      catch (e) { if (hist.length > 1) hist.pop(); else break; }
    }
  }
}

// ---- home ----
function renderRewriteHome() {
  const screen = document.getElementById('rewriteScreen');
  if (!screen) return;
  if (_rwQuiz) { renderRwQuestion(); return; }

  const bank = rewriteBank();
  const body = `
      <div class="phrases-hero">
        <div class="phrases-hero-icon">✍️</div>
        <h1>Rewrite</h1>
        <p class="phrases-sub">Viết lại câu sao cho nghĩa không đổi — ${bank.length} câu, tự gõ phần hoàn thành, có giải thích công thức rõ ràng.</p>
      </div>

      <button class="phrases-cta" onclick="startRewriteQuiz(10)">
        <span class="phrases-cta-icon">⚡</span>
        <span class="phrases-cta-text"><strong>Quick practice</strong><small>10 random questions</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <button class="phrases-cta" onclick="startRewriteQuiz(5)">
        <span class="phrases-cta-icon">⏱️</span>
        <span class="phrases-cta-text"><strong>Short practice</strong><small>5 random questions</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      ${renderRewriteReviewPanel()}
      ${renderRewriteHistory()}`;

  screen.innerHTML = `<div class="phrases-wrap">${body}</div>`;
}

// ---- wrong-answer aggregation + review panel ----
function rewriteWrongAggregate() {
  const counts = new Map();
  rewriteHistory().forEach(s => (s.wrong || []).forEach(w => {
    counts.set(w.qid, (counts.get(w.qid) || 0) + 1);
  }));
  const out = [];
  counts.forEach((misses, qid) => {
    const q = rewriteById(qid);
    if (q) out.push({ q, misses });
  });
  out.sort((a, b) => b.misses - a.misses);
  return out;
}
function renderRewriteReviewPanel() {
  const wrong = rewriteWrongAggregate();
  if (!wrong.length) return '';
  const chips = wrong.slice(0, 10).map(w =>
    `<span class="phrases-word-chip">${rwEsc(w.q.vi.split(' — ')[0] || w.q.cat)}<i>${w.misses}×</i></span>`
  ).join('');
  const qids = wrong.map(w => w.q.id);
  return `
    <div class="phrases-review-words">
      <div class="phrases-section-title">📉 Structures to review <span class="phrases-count">${wrong.length}</span></div>
      <div class="phrases-word-chips">${chips}</div>
      <button class="phrases-cta-secondary phrases-review-btn" onclick='startRewriteReviewQuiz(${JSON.stringify(qids)})'>
        🔁 Practice wrong answers (${qids.length})
      </button>
    </div>`;
}

// ---- history list ----
function renderRewriteHistory() {
  const hist = rewriteHistory();
  if (!hist.length) {
    return `<div class="phrases-section-title">📜 History</div>
      <div class="phrases-empty">No practice yet — tap <strong>Quick practice</strong> to start.</div>`;
  }
  const tierChips = ['all', 'perfect', 'great', 'ok', 'weak'].map(t =>
    `<button class="filter-chip ${_rwHistoryFilter === t ? 'active' : ''}" onclick="setRwHistoryFilter('${t}')">${RW_TIER_LABELS[t]}</button>`
  ).join('');

  let sessions = hist.map((s, idx) => ({ s, idx }));
  if (_rwHistoryFilter !== 'all') {
    sessions = sessions.filter(({ s }) => rwTier(Math.round((s.score / s.total) * 100)) === _rwHistoryFilter);
  }

  const list = sessions.length === 0
    ? `<div class="phrases-empty">No sessions match this filter.</div>`
    : sessions.map(({ s, idx }) => {
        const pct = Math.round((s.score / s.total) * 100);
        const tier = rwTier(pct);
        const wrongN = (s.wrong || []).length;
        const when = s.date ? new Date(s.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
        return `
          <div class="grammar-history-item history-tier-${tier}" onclick="openRwSession(${idx})">
            <div class="grammar-history-emoji">${rwTierEmoji(pct)}</div>
            <div class="grammar-history-text">
              <div class="grammar-history-unit">${s.score}/${s.total} <span class="phrases-pct">(${pct}%)</span></div>
              <div class="grammar-history-meta">${when}${wrongN ? ` · ${wrongN} to review` : ' · perfect'}</div>
            </div>
            <div class="grammar-history-arrow">›</div>
          </div>`;
      }).join('');

  return `
    <div class="phrases-section-title">📜 History <span class="phrases-count">${hist.length}</span></div>
    <div class="grammar-filters"><div class="grammar-filter-row">${tierChips}</div></div>
    <div class="grammar-history-list">${list}</div>`;
}
function setRwHistoryFilter(tier) { _rwHistoryFilter = tier; renderRewriteHome(); }

// ---- quiz lifecycle ----
function startRewriteQuiz(n) {
  const bank = rewriteBank();
  if (!bank.length) return;
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
  const qs = (n === 'all') ? bank.slice() : rwShuffle(bank, seed).slice(0, Math.min(n, bank.length));
  _rwQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderRwQuestion();
}
function startRewriteReviewQuiz(qids) {
  const ids = Array.isArray(qids) ? qids : [];
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
  const qs = rwShuffle(ids.map(rewriteById).filter(Boolean), seed);
  if (!qs.length) return;
  _rwQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderRwQuestion();
}
function isRewriteQuizActive() { return !!_rwQuiz; }
function abandonRewriteQuiz() { _rwQuiz = null; }

function renderRwQuestion() {
  const screen = document.getElementById('rewriteScreen');
  if (!screen || !_rwQuiz) return;
  const st = _rwQuiz;
  const q = st.questions[st.idx];
  const userAns = st.answers[st.idx];         // null | { value, isCorrect }
  const answered = userAns !== null;
  const isCorrect = answered && userAns.isCorrect;
  const total = st.questions.length;

  let bodyHtml;
  if (answered) {
    bodyHtml = `<div class="wf-text-answer ${isCorrect ? 'correct' : 'wrong'}">
      <span class="wf-text-answer-label">Your answer:</span>
      <span class="wf-text-answer-value">${userAns.value ? rwEsc(userAns.value) : '<em>(blank)</em>'}</span>
    </div>`;
  } else {
    bodyHtml = `<div class="rw-text-wrap">
      <textarea id="rwTextInput" class="rw-text-input" rows="2" placeholder="Gõ phần còn lại của câu…"
                autocomplete="off" autocapitalize="off" spellcheck="false"
                onkeydown="if(event.key==='Enter'){event.preventDefault();submitRwText();}"></textarea>
      <button class="wf-text-submit rw-text-submit" onclick="submitRwText()">Check</button>
    </div>`;
  }

  let explain = '';
  if (answered) {
    const fullSentence = q.stem + ' ' + q.answer;
    const header = isCorrect ? '✅ ' : `❌ Đáp án: <b>${rwEsc(fullSentence)}</b>.<br>`;
    explain = `<div class="grammar-explanation ${isCorrect ? 'correct' : 'wrong'}">
      <div class="phrases-vi">📘 ${rwEsc(q.vi)}</div>
      <div>${header}${rwEsc(q.explanation)}</div>
    </div>
    <button class="grammar-next-btn" onclick="nextRwQuestion()">${st.idx + 1 < total ? 'Next →' : 'See results'}</button>`;
  }

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonRewriteQuiz(); renderRewriteHome()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round(((st.idx) / total) * 100)}%"></div></div>
      </div>
      <div class="grammar-question-card">
        <div class="rw-orig">${rwEsc(q.orig)}</div>
        <div class="rw-stem">→ <b>${rwEsc(q.stem)}</b> <span class="phrases-blank">_____</span></div>
        ${bodyHtml}
        ${explain}
      </div>
    </div>`;

  if (!answered) {
    const inp = document.getElementById('rwTextInput');
    if (inp) setTimeout(() => inp.focus(), 50);
  }
}

function submitRwText() {
  const st = _rwQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  const inp = document.getElementById('rwTextInput');
  const raw = inp ? inp.value : '';
  st.answers[st.idx] = { value: raw.trim(), isCorrect: _rwTextCorrect(raw, q) };
  renderRwQuestion();
}
function nextRwQuestion() {
  const st = _rwQuiz;
  if (!st) return;
  if (st.idx + 1 < st.questions.length) { st.idx++; renderRwQuestion(); }
  else finishRewriteQuiz();
}

function finishRewriteQuiz() {
  const st = _rwQuiz;
  if (!st) return;
  const total = st.questions.length;
  let score = 0;
  const wrong = [];
  st.questions.forEach((q, i) => {
    const a = st.answers[i];
    if (a && a.isCorrect) score++;
    else wrong.push({ qid: q.id, ua: a ? a.value : null });
  });
  const pct = total ? Math.round((score / total) * 100) : 0;

  // Reward coins for the pet shop: 5 per correct answer (matches Grammar).
  const coinsEarned = score * 5;
  if (typeof appState !== 'undefined' && appState) appState.coins = (appState.coins || 0) + coinsEarned;

  let date = 0;
  try { date = Date.now(); } catch (e) { date = 0; }
  saveRewriteSession({ id: 'rw-' + date, date, score, total, wrong });

  // Sync rewrite activity to the server (best-effort) for the admin view.
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  const screen = document.getElementById('rewriteScreen');
  const reviewHtml = wrong.map(w => {
    const q = rewriteById(w.qid);
    if (!q) return '';
    return `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${rwEsc(q.orig)}<br>→ <b>${rwEsc(q.stem)} ${rwEsc(q.answer)}</b></div>
        <div class="grammar-review-explain">📘 ${rwEsc(q.vi)}<br>💡 ${rwEsc(q.explanation)}</div>
      </div>`;
  }).join('');

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderRewriteHome()">‹</button>
        <span class="grammar-quiz-progress">${rwTierEmoji(pct)} ${score}/${total} (${pct}%)</span>
      </div>
      ${coinsEarned ? `<div class="grammar-result-coins" style="text-align:center;margin:6px 0 2px;">+${coinsEarned} 🪙 earned</div>` : ''}
      <div class="phrases-section-title">Review${wrong.length ? ` · ${wrong.length} wrong` : ' · perfect! 🎉'}</div>
      ${reviewHtml}
      ${wrong.length ? `<button class="phrases-cta-secondary phrases-review-btn" onclick='startRewriteReviewQuiz(${JSON.stringify(wrong.map(w => w.qid))})'>🔁 Re-practice these (${wrong.length})</button>` : ''}
    </div>`;
  _rwQuiz = null;
}

// ---- review a past session (read-only) ----
function openRwSession(idx) {
  const s = rewriteHistory()[idx];
  if (!s) return;
  const screen = document.getElementById('rewriteScreen');
  const pct = Math.round((s.score / s.total) * 100);
  const wrong = s.wrong || [];
  const items = wrong.map(w => {
    const q = rewriteById(w.qid);
    if (!q) return '';
    return `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${rwEsc(q.orig)}<br>→ <b>${rwEsc(q.stem)} ${rwEsc(q.answer)}</b></div>
        <div class="grammar-review-explain">📘 ${rwEsc(q.vi)}<br>💡 ${rwEsc(q.explanation)}</div>
      </div>`;
  }).join('') || `<div class="phrases-empty">Perfect session — nothing to review. 🎉</div>`;
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderRewriteHome()">‹</button>
        <span class="grammar-quiz-progress">${rwTierEmoji(pct)} ${s.score}/${s.total} (${pct}%)</span>
      </div>
      <div class="phrases-section-title">Review${wrong.length ? ` · ${wrong.length} wrong` : ''}</div>
      ${items}
      ${wrong.length ? `<button class="phrases-cta-secondary phrases-review-btn" onclick='startRewriteReviewQuiz(${JSON.stringify(wrong.map(w => w.qid))})'>🔁 Re-practice these (${wrong.length})</button>` : ''}
    </div>`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderRewriteHome, startRewriteQuiz, startRewriteReviewQuiz, submitRwText,
    nextRwQuestion, finishRewriteQuiz, isRewriteQuizActive, abandonRewriteQuiz,
    setRwHistoryFilter, openRwSession, rewriteById, rewriteBank, _rwTextCorrect, _rwNormalize,
  };
}
