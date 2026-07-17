// wordform.js — "Word form" tab: word-formation MCQ practice.
// Data lives in js/wordform-data.js (global WORDFORM_QUESTIONS, 500 items).
// Mirrors the Phrases tab: quick practice CTA, a wrong-answer review drill, and
// a filterable history — and, like Phrases, the clear Vietnamese explanation is
// revealed when the learner clicks an option.

const WF_CAT_LABELS = {
  noun: 'Noun (danh từ)',
  adj: 'Adjective (tính từ)',
  adv: 'Adverb (trạng từ)',
  verb: 'Verb (động từ)',
};
const WF_CAT_ICON = { noun: '📦', adj: '🎨', adv: '⚡', verb: '🏃' };
const WF_HISTORY_CAP = 300;
const WF_TIER_LABELS = { all: 'All scores', perfect: '⭐ Perfect', great: '✅ Great', ok: '👍 OK', weak: '📝 Weak' };

let _wfQuiz = null;            // active quiz: { questions:[], idx, answers:[] }
let _wfHistoryFilter = 'all';

function wfEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function wfTier(pct) { return pct === 100 ? 'perfect' : pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'weak'; }
function wfTierEmoji(pct) { return pct === 100 ? '⭐' : pct >= 80 ? '✅' : pct >= 60 ? '👍' : '📝'; }

function wfShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wordformBank() {
  return (typeof WORDFORM_QUESTIONS !== 'undefined') ? WORDFORM_QUESTIONS : [];
}
function wordformById(id) {
  return wordformBank().find(q => q.id === id) || null;
}

// ---- history storage (per-user, in appState) ----
function wordformHistory() {
  if (typeof appState !== 'undefined' && appState) {
    if (!Array.isArray(appState.wordformHistory)) appState.wordformHistory = [];
    return appState.wordformHistory;
  }
  return [];
}
function saveWordformSession(session) {
  const hist = wordformHistory();
  hist.unshift(session);
  if (hist.length > WF_HISTORY_CAP) hist.length = WF_HISTORY_CAP;
  if (typeof appState !== 'undefined' && typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    while (true) {
      try { saveUserData(currentUser, appState); break; }
      catch (e) { if (hist.length > 1) hist.pop(); else break; }
    }
  }
}

// ---- home ----
function renderWordformHome() {
  const screen = document.getElementById('wordformScreen');
  if (!screen) return;
  if (_wfQuiz) { renderWfQuestion(); return; }

  const bank = wordformBank();
  const counts = { noun: 0, adj: 0, adv: 0, verb: 0 };
  bank.forEach(q => { counts[q.cat] = (counts[q.cat] || 0) + 1; });
  const catRows = Object.keys(WF_CAT_LABELS).map(c =>
    `<div class="phrases-cat-row"><span>${WF_CAT_ICON[c]} ${WF_CAT_LABELS[c]}</span><strong>${counts[c] || 0}</strong></div>`
  ).join('');

  const body = `
      <div class="phrases-hero">
        <div class="phrases-hero-icon">🔤</div>
        <h1>Word form</h1>
        <p class="phrases-sub">Chọn dạng đúng của từ (danh/động/tính/trạng từ) — ${bank.length} câu, có giải thích rõ ràng khi bạn chọn đáp án.</p>
      </div>

      <button class="phrases-cta" onclick="startWordformQuiz(20)">
        <span class="phrases-cta-icon">⚡</span>
        <span class="phrases-cta-text"><strong>Quick practice</strong><small>20 random questions</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <button class="phrases-cta" onclick="startWordformQuiz(10)">
        <span class="phrases-cta-icon">⏱️</span>
        <span class="phrases-cta-text"><strong>Short practice</strong><small>10 random questions</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <details class="phrases-cats-wrap">
        <summary>Categories</summary>
        <div class="phrases-cats">${catRows}</div>
      </details>

      ${renderWordformReviewPanel()}
      ${renderWordformHistory()}`;

  screen.innerHTML = `<div class="phrases-wrap">${body}</div>`;
}

// ---- wrong-answer aggregation + review panel ----
function wordformWrongAggregate() {
  const counts = new Map();
  wordformHistory().forEach(s => (s.wrong || []).forEach(w => {
    counts.set(w.qid, (counts.get(w.qid) || 0) + 1);
  }));
  const out = [];
  counts.forEach((misses, qid) => {
    const q = wordformById(qid);
    if (q) out.push({ q, misses });
  });
  out.sort((a, b) => b.misses - a.misses);
  return out;
}
function renderWordformReviewPanel() {
  const wrong = wordformWrongAggregate();
  if (!wrong.length) return '';
  const chips = wrong.slice(0, 10).map(w =>
    `<span class="phrases-word-chip">${wfEsc(w.q.answer || w.q.base)}<i>${w.misses}×</i></span>`
  ).join('');
  const qids = wrong.map(w => w.q.id);
  return `
    <div class="phrases-review-words">
      <div class="phrases-section-title">📉 Words to review <span class="phrases-count">${wrong.length}</span></div>
      <div class="phrases-word-chips">${chips}</div>
      <button class="phrases-cta-secondary phrases-review-btn" onclick='startWordformReviewQuiz(${JSON.stringify(qids)})'>
        🔁 Practice wrong answers (${qids.length})
      </button>
    </div>`;
}

// ---- history list ----
function renderWordformHistory() {
  const hist = wordformHistory();
  if (!hist.length) {
    return `<div class="phrases-section-title">📜 History</div>
      <div class="phrases-empty">No practice yet — tap <strong>Quick practice</strong> to start.</div>`;
  }
  const tierChips = ['all', 'perfect', 'great', 'ok', 'weak'].map(t =>
    `<button class="filter-chip ${_wfHistoryFilter === t ? 'active' : ''}" onclick="setWfHistoryFilter('${t}')">${WF_TIER_LABELS[t]}</button>`
  ).join('');

  let sessions = hist.map((s, idx) => ({ s, idx }));
  if (_wfHistoryFilter !== 'all') {
    sessions = sessions.filter(({ s }) => wfTier(Math.round((s.score / s.total) * 100)) === _wfHistoryFilter);
  }

  const list = sessions.length === 0
    ? `<div class="phrases-empty">No sessions match this filter.</div>`
    : sessions.map(({ s, idx }) => {
        const pct = Math.round((s.score / s.total) * 100);
        const tier = wfTier(pct);
        const wrongN = (s.wrong || []).length;
        const when = s.date ? new Date(s.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (s.when || '');
        return `
          <div class="grammar-history-item history-tier-${tier}" onclick="openWfSession(${idx})">
            <div class="grammar-history-emoji">${wfTierEmoji(pct)}</div>
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
function setWfHistoryFilter(tier) { _wfHistoryFilter = tier; renderWordformHome(); }

// ---- quiz lifecycle ----
function startWordformQuiz(n) {
  const bank = wordformBank();
  if (!bank.length) return;
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
  const qs = (n === 'all') ? bank.slice() : wfShuffle(bank, seed).slice(0, Math.min(n, bank.length));
  _wfQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderWfQuestion();
}
function startWordformReviewQuiz(qids) {
  const ids = Array.isArray(qids) ? qids : [];
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
  const qs = wfShuffle(ids.map(wordformById).filter(Boolean), seed);
  if (!qs.length) return;
  _wfQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderWfQuestion();
}
function isWordformQuizActive() { return !!_wfQuiz; }
function abandonWordformQuiz() { _wfQuiz = null; }

function renderWfQuestion() {
  const screen = document.getElementById('wordformScreen');
  if (!screen || !_wfQuiz) return;
  const st = _wfQuiz;
  const q = st.questions[st.idx];
  const userAns = st.answers[st.idx];
  const answered = userAns !== null;
  const total = st.questions.length;

  const qHtml = wfEsc(q.q)
    .replace('___', '<span class="phrases-blank">_____</span>')
    .replace(/\(([A-Z][A-Z\- ]*)\)/, '<span class="wf-base">($1)</span>');

  const opts = q.options.map((opt, i) => {
    let cls = 'grammar-option';
    if (answered) {
      if (i === q.correct) cls += ' correct';
      else if (i === userAns) cls += ' wrong';
    }
    const letter = String.fromCharCode(65 + i);
    return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="answerWfQuestion(${i})">
      <span class="grammar-option-letter">${letter}</span>
      <span class="grammar-option-text">${wfEsc(opt)}</span>
    </button>`;
  }).join('');

  let explain = '';
  if (answered) {
    const ok = userAns === q.correct;
    explain = `<div class="grammar-explanation ${ok ? 'correct' : 'wrong'}">
      <div class="phrases-vi">📘 ${wfEsc(q.vi)}</div>
      <div>${ok ? '✅ ' : '❌ '}${wfEsc(q.explanation)}</div>
    </div>
    <button class="grammar-next-btn" onclick="nextWfQuestion()">${st.idx + 1 < total ? 'Next →' : 'See results'}</button>`;
  }

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonWordformQuiz(); renderWordformHome()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round(((st.idx) / total) * 100)}%"></div></div>
      </div>
      <div class="grammar-question-card">
        <div class="grammar-question-tag">🔤 ${WF_CAT_LABELS[q.cat] || 'Word form'}</div>
        <div class="grammar-question-text">${qHtml}</div>
        <div class="grammar-options">${opts}</div>
        ${explain}
      </div>
    </div>`;
}

function answerWfQuestion(i) {
  const st = _wfQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  st.answers[st.idx] = i;
  renderWfQuestion();
}
function nextWfQuestion() {
  const st = _wfQuiz;
  if (!st) return;
  if (st.idx + 1 < st.questions.length) { st.idx++; renderWfQuestion(); }
  else finishWordformQuiz();
}

function finishWordformQuiz() {
  const st = _wfQuiz;
  if (!st) return;
  const total = st.questions.length;
  let score = 0;
  const wrong = [];
  st.questions.forEach((q, i) => {
    if (st.answers[i] === q.correct) score++;
    else wrong.push({ qid: q.id, ua: st.answers[i] });
  });
  const pct = total ? Math.round((score / total) * 100) : 0;
  let date = 0;
  try { date = Date.now(); } catch (e) { date = 0; }
  saveWordformSession({ id: 'wf-' + date, date, score, total, wrong });

  // Sync word-form activity to the server (best-effort) for the admin view.
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  const screen = document.getElementById('wordformScreen');
  const reviewHtml = wrong.map(w => {
    const q = wordformById(w.qid);
    if (!q) return '';
    return `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${wfEsc(q.q).replace('___', '<b>' + wfEsc(q.answer) + '</b>')}</div>
        <div class="grammar-review-explain">📘 ${wfEsc(q.vi)}<br>💡 ${wfEsc(q.explanation)}</div>
      </div>`;
  }).join('');

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderWordformHome()">‹</button>
        <span class="grammar-quiz-progress">${wfTierEmoji(pct)} ${score}/${total} (${pct}%)</span>
      </div>
      <div class="phrases-section-title">Review${wrong.length ? ` · ${wrong.length} wrong` : ' · perfect! 🎉'}</div>
      ${reviewHtml}
      ${wrong.length ? `<button class="phrases-cta-secondary phrases-review-btn" onclick='startWordformReviewQuiz(${JSON.stringify(wrong.map(w => w.qid))})'>🔁 Re-practice these (${wrong.length})</button>` : ''}
    </div>`;
  _wfQuiz = null;
}

// ---- review a past session (read-only) ----
function openWfSession(idx) {
  const s = wordformHistory()[idx];
  if (!s) return;
  const screen = document.getElementById('wordformScreen');
  const pct = Math.round((s.score / s.total) * 100);
  const wrong = s.wrong || [];
  const items = wrong.map(w => {
    const q = wordformById(w.qid);
    if (!q) return '';
    return `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${wfEsc(q.q).replace('___', '<b>' + wfEsc(q.answer) + '</b>')}</div>
        <div class="grammar-review-explain">📘 ${wfEsc(q.vi)}<br>💡 ${wfEsc(q.explanation)}</div>
      </div>`;
  }).join('') || `<div class="phrases-empty">Perfect session — nothing to review. 🎉</div>`;
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderWordformHome()">‹</button>
        <span class="grammar-quiz-progress">${wfTierEmoji(pct)} ${s.score}/${s.total} (${pct}%)</span>
      </div>
      <div class="phrases-section-title">Review${wrong.length ? ` · ${wrong.length} wrong` : ''}</div>
      ${items}
      ${wrong.length ? `<button class="phrases-cta-secondary phrases-review-btn" onclick='startWordformReviewQuiz(${JSON.stringify(wrong.map(w => w.qid))})'>🔁 Re-practice these (${wrong.length})</button>` : ''}
    </div>`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderWordformHome, startWordformQuiz, startWordformReviewQuiz, answerWfQuestion,
    nextWfQuestion, finishWordformQuiz, isWordformQuizActive, abandonWordformQuiz,
    setWfHistoryFilter, openWfSession, wordformById, wordformBank,
  };
}
