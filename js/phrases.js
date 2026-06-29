// phrases.js — "Phrases" tab: prepositional-phrase MCQ practice.
// Data lives in js/phrases-data.js (global PREPOSITION_QUESTIONS, 500 items).
// Flat combined bank (one pool of 500). Quick practice is the primary CTA;
// history (with score filters) and a wrong-answer review live below it,
// mirroring the Grammar tab's History + "Topics to review" pattern.

const PHRASES_CAT_LABELS = {
  verb: 'Verb + Preposition',
  adj: 'Adjective + Preposition',
  noun: 'Noun + Preposition',
  phrase: 'Prepositional Phrase',
};
const PHRASES_CAT_ICON = { verb: '🏃', adj: '🎨', noun: '📦', phrase: '🧩' };
const PHRASES_HISTORY_CAP = 300;
const PHRASES_TIER_LABELS = { all: 'All scores', perfect: '⭐ Perfect', great: '✅ Great', ok: '👍 OK', weak: '📝 Weak' };

let _phrQuiz = null;              // active quiz: { questions:[], idx, answers:[] }
let _phrHistoryFilter = 'all';    // tier filter for the history list

function phrEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function phrTier(pct) {
  return pct === 100 ? 'perfect' : pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'weak';
}
function phrTierEmoji(pct) {
  return pct === 100 ? '⭐' : pct >= 80 ? '✅' : pct >= 60 ? '👍' : '📝';
}

function phrShuffle(arr, seed) {
  const a = arr.slice();
  let s = seed || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function phrasesBank() {
  return (typeof PREPOSITION_QUESTIONS !== 'undefined') ? PREPOSITION_QUESTIONS : [];
}
function phrasesById(id) {
  return phrasesBank().find(q => q.id === id) || null;
}

function phrasesHistory() {
  if (typeof appState !== 'undefined' && appState) {
    if (!Array.isArray(appState.phrasesHistory)) appState.phrasesHistory = [];
    return appState.phrasesHistory;
  }
  return [];
}

function savePhrasesSession(session) {
  const hist = phrasesHistory();
  hist.unshift(session);
  if (hist.length > PHRASES_HISTORY_CAP) hist.length = PHRASES_HISTORY_CAP;
  if (typeof appState !== 'undefined' && typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    while (true) {
      try { saveUserData(currentUser, appState); break; }
      catch (e) { if (hist.length > 1) hist.pop(); else break; }
    }
  }
}

// Aggregate every wrong question across all sessions → most-missed first.
function phrasesWrongAggregate() {
  const counts = new Map(); // qid -> misses
  phrasesHistory().forEach(s => (s.wrong || []).forEach(w => {
    counts.set(w.qid, (counts.get(w.qid) || 0) + 1);
  }));
  const out = [];
  counts.forEach((misses, qid) => {
    const q = phrasesById(qid);
    if (q) out.push({ q, misses });
  });
  out.sort((a, b) => b.misses - a.misses);
  return out;
}

// ---- entry point (called from nav + switchScreen) ----
function renderPhrasesHome() {
  const screen = document.getElementById('phrasesScreen');
  if (!screen) return;
  if (_phrQuiz) { renderPhrQuestion(); return; }

  const bank = phrasesBank();
  const counts = { verb: 0, adj: 0, noun: 0, phrase: 0 };
  bank.forEach(q => { counts[q.cat] = (counts[q.cat] || 0) + 1; });

  const catRows = Object.keys(PHRASES_CAT_LABELS).map(c =>
    `<div class="phrases-cat-row"><span>${PHRASES_CAT_ICON[c]} ${PHRASES_CAT_LABELS[c]}</span><strong>${counts[c] || 0}</strong></div>`
  ).join('');

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="phrases-hero">
        <div class="phrases-hero-icon">🔗</div>
        <h1>Phrases</h1>
        <p class="phrases-sub">Master English prepositions — ${bank.length} questions across verb, adjective &amp; noun collocations and fixed phrases.</p>
      </div>

      <button class="phrases-cta" onclick="startPhrasesQuiz(20)">
        <span class="phrases-cta-icon">⚡</span>
        <span class="phrases-cta-text"><strong>Quick practice</strong><small>20 random questions</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>
      <div class="phrases-cta-row">
        <button class="phrases-cta-secondary" onclick="startPhrasesQuiz(50)">📝 Medium · 50</button>
        <button class="phrases-cta-secondary" onclick="startPhrasesQuiz('all')">🏆 Full run · ${bank.length}</button>
      </div>

      <details class="phrases-cats-wrap">
        <summary>Categories</summary>
        <div class="phrases-cats">${catRows}</div>
      </details>

      ${renderPhrasesReviewPanel()}
      ${renderPhrasesHistory()}
    </div>`;
}

// "Words to review" — collocations the user has gotten wrong, with a CTA to drill them.
function renderPhrasesReviewPanel() {
  const wrong = phrasesWrongAggregate();
  if (!wrong.length) return '';
  const chips = wrong.slice(0, 10).map(w =>
    `<span class="phrases-word-chip">${phrEsc(w.q.phrase || w.q.options[w.q.correct])}<i>${w.misses}×</i></span>`
  ).join('');
  const qids = wrong.map(w => w.q.id);
  return `
    <div class="phrases-review-words">
      <div class="phrases-section-title">📉 Words to review <span class="phrases-count">${wrong.length}</span></div>
      <div class="phrases-word-chips">${chips}</div>
      <button class="phrases-cta-secondary phrases-review-btn" onclick='startPhrasesReviewQuiz(${JSON.stringify(qids)})'>
        🔁 Practice wrong answers (${qids.length})
      </button>
    </div>`;
}

// History list with score-tier filter chips (mirrors the Grammar tab).
function renderPhrasesHistory() {
  const hist = phrasesHistory();
  if (!hist.length) {
    return `<div class="phrases-section-title">📜 History</div>
      <div class="phrases-empty">No practice yet — tap <strong>Quick practice</strong> to start.</div>`;
  }

  const tierChips = ['all', 'perfect', 'great', 'ok', 'weak'].map(t =>
    `<button class="filter-chip ${_phrHistoryFilter === t ? 'active' : ''}" onclick="setPhrHistoryFilter('${t}')">${PHRASES_TIER_LABELS[t]}</button>`
  ).join('');

  let sessions = hist.map((s, idx) => ({ s, idx }));
  if (_phrHistoryFilter !== 'all') {
    sessions = sessions.filter(({ s }) => phrTier(Math.round((s.score / s.total) * 100)) === _phrHistoryFilter);
  }

  const list = sessions.length === 0
    ? `<div class="phrases-empty">No sessions match this filter.</div>`
    : sessions.map(({ s, idx }) => {
        const pct = Math.round((s.score / s.total) * 100);
        const tier = phrTier(pct);
        const wrongN = (s.wrong || []).length;
        const when = s.date ? new Date(s.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (s.when || '');
        return `
          <div class="grammar-history-item history-tier-${tier}" onclick="openPhrSession(${idx})">
            <div class="grammar-history-emoji">${phrTierEmoji(pct)}</div>
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

function setPhrHistoryFilter(tier) {
  _phrHistoryFilter = tier;
  renderPhrasesHome();
}

// ---- review a past session: show the wrong questions read-only ----
function openPhrSession(idx) {
  const screen = document.getElementById('phrasesScreen');
  const s = phrasesHistory()[idx];
  if (!screen || !s) return;
  const pct = Math.round((s.score / s.total) * 100);
  const wrong = (s.wrong || []).map(w => ({ q: phrasesById(w.qid), ua: w.ua })).filter(x => x.q);

  const items = wrong.length
    ? wrong.map(({ q, ua }) => `
        <div class="grammar-review-item wrong">
          <div class="grammar-review-q">${phrEsc(q.q).replace('___', `[${phrEsc(q.options[q.correct])}]`)}</div>
          <div class="phrases-review-line">Your answer: <s>${ua != null ? phrEsc(q.options[ua]) : '—'}</s> · Correct: <b>${phrEsc(q.options[q.correct])}</b></div>
          <div class="phrases-vi">📘 ${phrEsc(q.vi)}</div>
          <div class="grammar-review-explain">${phrEsc(q.explanation)}</div>
        </div>`).join('')
    : `<div class="phrases-empty">🎉 No mistakes in this session — perfect score!</div>`;

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderPhrasesHome()">‹</button>
        <span class="grammar-quiz-progress">${phrTierEmoji(pct)} ${s.score}/${s.total} (${pct}%)</span>
      </div>
      <div class="phrases-section-title">Review${wrong.length ? ` · ${wrong.length} wrong` : ''}</div>
      ${items}
      ${wrong.length ? `<button class="phrases-cta-secondary phrases-review-btn" onclick='startPhrasesReviewQuiz(${JSON.stringify(wrong.map(w => w.q.id))})'>🔁 Re-practice these (${wrong.length})</button>` : ''}
    </div>`;
}

// ---- quiz lifecycle ----
function startPhrasesQuiz(n) {
  const bank = phrasesBank();
  if (!bank.length) return;
  let qs;
  if (n === 'all') {
    qs = bank.slice();
  } else {
    const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
    qs = phrShuffle(bank, seed).slice(0, Math.min(n, bank.length));
  }
  _phrQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderPhrQuestion();
}

// Re-practice a specific set of questions (by id) — used by the review CTAs.
function startPhrasesReviewQuiz(qids) {
  const ids = Array.isArray(qids) ? qids : [];
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
  const qs = phrShuffle(ids.map(phrasesById).filter(Boolean), seed);
  if (!qs.length) return;
  _phrQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderPhrQuestion();
}

function isPhrasesQuizActive() { return !!_phrQuiz; }
function abandonPhrasesQuiz() { _phrQuiz = null; }

function renderPhrQuestion() {
  const screen = document.getElementById('phrasesScreen');
  if (!screen || !_phrQuiz) return;
  const st = _phrQuiz;
  const q = st.questions[st.idx];
  const userAns = st.answers[st.idx];
  const answered = userAns !== null;
  const total = st.questions.length;

  const qHtml = phrEsc(q.q).replace('___', '<span class="phrases-blank">_____</span>');

  const opts = q.options.map((opt, i) => {
    let cls = 'grammar-option';
    if (answered) {
      if (i === q.correct) cls += ' correct';
      else if (i === userAns) cls += ' wrong';
    }
    const letter = String.fromCharCode(65 + i);
    return `<button class="${cls}" ${answered ? 'disabled' : ''} onclick="answerPhrQuestion(${i})">
      <span class="grammar-option-letter">${letter}</span>
      <span class="grammar-option-text">${phrEsc(opt)}</span>
    </button>`;
  }).join('');

  let explain = '';
  if (answered) {
    const ok = userAns === q.correct;
    explain = `<div class="grammar-explanation ${ok ? 'correct' : 'wrong'}">
      <div class="phrases-vi">📘 ${phrEsc(q.vi)}</div>
      <div>${ok ? '✅ ' : '❌ '}${phrEsc(q.explanation)}</div>
    </div>
    <button class="grammar-next-btn" onclick="nextPhrQuestion()">${st.idx + 1 < total ? 'Next →' : 'See results'}</button>`;
  }

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonPhrasesQuiz(); renderPhrasesHome()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round(((st.idx) / total) * 100)}%"></div></div>
      </div>
      <div class="grammar-question-card">
        <div class="grammar-question-tag">${PHRASES_CAT_ICON[q.cat]} ${PHRASES_CAT_LABELS[q.cat]}</div>
        <div class="grammar-question-text">${qHtml}</div>
        <div class="grammar-options">${opts}</div>
        ${explain}
      </div>
    </div>`;
}

function answerPhrQuestion(i) {
  const st = _phrQuiz;
  if (!st) return;
  if (st.answers[st.idx] !== null) return;
  st.answers[st.idx] = i;
  renderPhrQuestion();
}

function nextPhrQuestion() {
  const st = _phrQuiz;
  if (!st) return;
  if (st.idx + 1 < st.questions.length) { st.idx++; renderPhrQuestion(); }
  else finishPhrasesQuiz();
}

function finishPhrasesQuiz() {
  const st = _phrQuiz;
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
  savePhrasesSession({ id: 'phr-' + date, date, score, total, wrong });

  const reviewHtml = wrong.map(w => {
    const q = phrasesById(w.qid);
    if (!q) return '';
    return `
    <div class="grammar-review-item wrong">
      <div class="grammar-review-q">${phrEsc(q.q).replace('___', `[${phrEsc(q.options[q.correct])}]`)}</div>
      <div class="phrases-review-line">Your answer: <s>${w.ua != null ? phrEsc(q.options[w.ua]) : '—'}</s> · Correct: <b>${phrEsc(q.options[q.correct])}</b></div>
      <div class="phrases-vi">📘 ${phrEsc(q.vi)}</div>
      <div class="grammar-review-explain">${phrEsc(q.explanation)}</div>
    </div>`;
  }).join('');

  const screen = document.getElementById('phrasesScreen');
  const emoji = phrTierEmoji(pct);
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-result-card">
        <div class="grammar-result-emoji">${emoji}</div>
        <h2>${score} / ${total}</h2>
        <div class="grammar-result-pct">${pct}%</div>
        <p>${pct >= 80 ? 'Excellent preposition skills!' : (pct >= 50 ? 'Good work — keep practising.' : 'Keep going — prepositions take practice.')}</p>
        <button class="phrases-cta-secondary" onclick="_phrQuiz=null; renderPhrasesHome()">Done</button>
      </div>
      ${wrong.length ? `<div class="phrases-section-title">Review · ${wrong.length} wrong</div>${reviewHtml}
        <button class="phrases-cta-secondary phrases-review-btn" onclick='startPhrasesReviewQuiz(${JSON.stringify(wrong.map(w => w.qid))})'>🔁 Re-practice these (${wrong.length})</button>` : ''}
    </div>`;
  _phrQuiz = null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderPhrasesHome, startPhrasesQuiz, startPhrasesReviewQuiz, answerPhrQuestion,
    nextPhrQuestion, finishPhrasesQuiz, isPhrasesQuizActive, abandonPhrasesQuiz,
    setPhrHistoryFilter, openPhrSession,
  };
}
