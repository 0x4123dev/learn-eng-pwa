// phrases.js — "Phrases" tab: prepositional-phrase MCQ practice.
// Data lives in js/phrases-data.js (global PREPOSITION_QUESTIONS, 500 items).
// Flat combined bank (one pool of 500) with quick/medium/full practice runs.
// Reuses the .grammar-* quiz CSS for option buttons / explanation box.

const PHRASES_CAT_LABELS = {
  verb: 'Verb + Preposition',
  adj: 'Adjective + Preposition',
  noun: 'Noun + Preposition',
  phrase: 'Prepositional Phrase',
};
const PHRASES_CAT_ICON = { verb: '🏃', adj: '🎨', noun: '📦', phrase: '🧩' };
const PHRASES_HISTORY_CAP = 300;

let _phrQuiz = null; // { questions:[], idx, answers:[], answered:bool }

function phrEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function phrShuffle(arr, seed) {
  // deterministic-ish shuffle for the practice selection (seed from time)
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

// ---- entry point (called from nav + switchScreen) ----
function renderPhrasesHome() {
  const screen = document.getElementById('phrasesScreen');
  if (!screen) return;
  if (_phrQuiz) { renderPhrQuestion(); return; }

  const bank = phrasesBank();
  const counts = { verb: 0, adj: 0, noun: 0, phrase: 0 };
  bank.forEach(q => { counts[q.cat] = (counts[q.cat] || 0) + 1; });
  const hist = phrasesHistory();

  const catRows = Object.keys(PHRASES_CAT_LABELS).map(c =>
    `<div class="phrases-cat-row"><span>${PHRASES_CAT_ICON[c]} ${PHRASES_CAT_LABELS[c]}</span><strong>${counts[c] || 0}</strong></div>`
  ).join('');

  const histRows = hist.slice(0, 10).map(h => {
    const pct = h.total ? Math.round((h.score / h.total) * 100) : 0;
    const cls = pct >= 80 ? 'good' : (pct >= 50 ? 'ok' : 'bad');
    return `<div class="phrases-hist-row ${cls}"><span>${h.score}/${h.total}</span><span>${pct}%</span><span>${phrEsc(h.when || '')}</span></div>`;
  }).join('');

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="phrases-hero">
        <div class="phrases-hero-icon">🔗</div>
        <h1>Phrases</h1>
        <p class="phrases-sub">Master English prepositions — verb, adjective &amp; noun collocations plus fixed prepositional phrases. ${bank.length} questions.</p>
      </div>
      <div class="phrases-cats">${catRows}</div>
      <div class="phrases-actions">
        <button class="grammar-quiz-btn" onclick="startPhrasesQuiz(20)">⚡ Quick practice · 20</button>
        <button class="grammar-quiz-btn" onclick="startPhrasesQuiz(50)">📝 Medium practice · 50</button>
        <button class="grammar-quiz-btn" onclick="startPhrasesQuiz('all')">🏆 Full run · ${bank.length}</button>
      </div>
      ${hist.length ? `<div class="phrases-history"><h3>Recent practice</h3>${histRows}</div>` : ''}
    </div>`;
}

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
  _phrQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null), answered: false };
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
  st.questions.forEach((q, i) => { if (st.answers[i] === q.correct) score++; });
  const pct = total ? Math.round((score / total) * 100) : 0;

  let when = '';
  try { when = new Date().toLocaleDateString(); } catch (e) { when = ''; }
  savePhrasesSession({ score, total, when });

  const wrong = [];
  st.questions.forEach((q, i) => { if (st.answers[i] !== q.correct) wrong.push({ q, ua: st.answers[i] }); });

  const reviewHtml = wrong.map(w => `
    <div class="grammar-review-item wrong">
      <div class="grammar-review-q">${phrEsc(w.q.q).replace('___', `[${phrEsc(w.q.options[w.q.correct])}]`)}</div>
      <div class="phrases-vi">📘 ${phrEsc(w.q.vi)}</div>
      <div class="grammar-review-explain">${phrEsc(w.q.explanation)}</div>
    </div>`).join('');

  const screen = document.getElementById('phrasesScreen');
  const emoji = pct >= 80 ? '🏆' : (pct >= 50 ? '👍' : '📚');
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-result-card">
        <div class="grammar-result-emoji">${emoji}</div>
        <h2>${score} / ${total}</h2>
        <div class="grammar-result-pct">${pct}%</div>
        <p>${pct >= 80 ? 'Excellent preposition skills!' : (pct >= 50 ? 'Good work — keep practising.' : 'Keep going — prepositions take practice.')}</p>
        <button class="grammar-quiz-btn" onclick="_phrQuiz=null; renderPhrasesHome()">Done</button>
      </div>
      ${wrong.length ? `<div class="phrases-review"><h3>Review (${wrong.length} to revise)</h3>${reviewHtml}</div>` : ''}
    </div>`;
  _phrQuiz = null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderPhrasesHome, startPhrasesQuiz, answerPhrQuestion, nextPhrQuestion,
    finishPhrasesQuiz, isPhrasesQuizActive, abandonPhrasesQuiz,
  };
}
