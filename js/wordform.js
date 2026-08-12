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
let _wfSubTab = 'practice';    // 'practice' | 'lessons'

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

  const bar = `
    <div class="grammar-subtabs">
      <button class="grammar-subtab ${_wfSubTab === 'practice' ? 'active' : ''}" onclick="switchWfSubTab('practice')">⚡ Practice</button>
      <button class="grammar-subtab ${_wfSubTab === 'lessons' ? 'active' : ''}" onclick="switchWfSubTab('lessons')">📖 Lessons</button>
    </div>`;
  const body = _wfSubTab === 'lessons' ? renderWordformLessons() : renderWordformPractice();
  screen.innerHTML = `<div class="phrases-wrap">${bar}${body}</div>`;
}

function switchWfSubTab(tab) {
  _wfSubTab = tab;
  renderWordformHome();
}

// Lessons sub-tab: study cards → tap to open the full lesson.
function renderWordformLessons() {
  const lessons = (typeof WORDFORM_LESSONS !== 'undefined') ? WORDFORM_LESSONS : [];
  if (!lessons.length) {
    return `<div class="phrases-empty">Lessons are being prepared — check back soon.</div>`;
  }
  const cards = lessons.map(l => `
    <button class="exam-lesson-card" onclick="openWordformLesson('${l.key}')">
      <div class="exam-lesson-icon">${l.icon}</div>
      <div class="exam-lesson-info">
        <div class="exam-lesson-title">${wfEsc(l.title)}</div>
      </div>
      <div class="exam-card-go">›</div>
    </button>`).join('');
  return `
    <div class="phrases-hero">
      <div class="phrases-hero-icon">📖</div>
      <h1>Word form — Lessons</h1>
      <p class="phrases-sub">Học quy tắc chia dạng từ trước khi luyện tập — ${lessons.length} bài học.</p>
    </div>
    <div class="exam-lesson-list">${cards}</div>`;
}

function openWordformLesson(key) {
  const lessons = (typeof WORDFORM_LESSONS !== 'undefined') ? WORDFORM_LESSONS : [];
  const l = lessons.find(x => x.key === key);
  if (!l) return;
  const screen = document.getElementById('wordformScreen');
  screen.innerHTML = `
    <div class="exam-lesson-detail">
      <button class="exam-back-btn" onclick="renderWordformHome()">←</button>
      <h1 class="exam-lesson-detail-title">${l.icon} ${wfEsc(l.title)}</h1>
      <div class="exam-lesson-content">${l.content}</div>
      <button class="exam-btn-secondary exam-lesson-back-bottom" onclick="renderWordformHome()">← Danh sách bài học</button>
    </div>`;
  screen.scrollTop = 0;
  if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
}

function renderWordformPractice() {
  const bank = wordformBank();
  // Questions owed from an earlier practice lock the practice buttons. A
  // disabled CTA with no reason reads as a broken app, so the banner states
  // the debt and is itself the way to clear it.
  const owed = wfRetryCount();
  const owedBanner = (typeof retryOwedBannerHTML === 'function' ? retryOwedBannerHTML('wf') : '');
  const counts = { noun: 0, adj: 0, adv: 0, verb: 0 };
  bank.forEach(q => { counts[q.cat] = (counts[q.cat] || 0) + 1; });
  const catRows = Object.keys(WF_CAT_LABELS).map(c =>
    `<div class="phrases-cat-row"><span>${WF_CAT_ICON[c]} ${WF_CAT_LABELS[c]}</span><strong>${counts[c] || 0}</strong></div>`
  ).join('');

  const body = `
      <div class="phrases-hero">
        <div class="phrases-hero-icon">🔤</div>
        <h1>Word form</h1>
        <p class="phrases-sub">Chia dạng từ (danh/động/tính/trạng từ) — ${bank.length} câu, gồm cả chọn đáp án và tự gõ, có giải thích rõ ràng.</p>
      </div>

      ${owedBanner}

      <button class="phrases-cta ${owed ? 'locked' : ''}" ${owed ? 'disabled aria-disabled="true"' : ''} onclick="startWordformQuiz(20)">
        <span class="phrases-cta-icon">⚡</span>
        <span class="phrases-cta-text"><strong>Quick practice</strong><small>20 random questions</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <button class="phrases-cta ${owed ? 'locked' : ''}" ${owed ? 'disabled aria-disabled="true"' : ''} onclick="startWordformQuiz(10)">
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

  return body;
}

// ---- owed questions: every question missed must be typed back ----
// The rule, the queue, the gate, the 👁 hint and the verdict screen all live in
// js/retrydrill.js — six tabs share one implementation. This file only says
// what a Word form question looks like inside it.
//
// The drill is harder than the quiz it follows, on purpose: a multiple-choice
// question guessed wrong comes back as typing, so the form has to be produced
// rather than recognised.
if (typeof defineRetryDrill === 'function') defineRetryDrill({
  key: 'wf',
  screenId: 'wordformScreen',
  noun: 'câu',
  resolve: (id) => wordformById(id),
  idOf: (q) => q.id,
  answerText: (q) => q.answer,
  grade: (v, q) => _wfTextCorrect(v, q),
  promptHTML: (q) => `
    <div class="wf-retry-base">${WF_CAT_ICON[q.cat] || '🔤'} <b>${wfEsc(q.base)}</b></div>
    <div class="grammar-question-text">${wfEsc(q.q).replace('___', '<b class="wf-retry-gap">___</b>')}</div>`,
  explainHTML: (q) => `<div class="grammar-review-explain">📘 ${wfEsc(q.vi)}<br>💡 ${wfEsc(q.explanation)}</div>`,
  home: () => renderWordformHome(),
});

// Kept as named wrappers so the tab reads in its own vocabulary.
function wfRetryCount() { return (typeof retryCount === 'function' ? retryCount('wf') : 0); }
function wfRetryList() { return (typeof retryList === 'function' ? retryList('wf') : []); }
function startWfRetry() { return (typeof startRetryDrill === 'function' ? startRetryDrill('wf') : undefined); }

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
  // Hidden while questions are owed: two "practise your mistakes" buttons that
  // do different things, one of which does not clear the gate, is a way to
  // leave a child going round in circles.
  if (wfRetryCount() > 0) return '';
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
  // Questions missed earlier are owed back BEFORE a new practice. The buttons
  // are disabled while anything is owed, but the rule lives here too: a stale
  // DOM node or a queued tap must not walk past it.
  if (typeof retryGate === 'function' && retryGate('wf')) return;
  const bank = wordformBank();
  if (!bank.length) return;
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
  const qs = (n === 'all') ? bank.slice() : wfShuffle(bank, seed).slice(0, Math.min(n, bank.length));
  _wfQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderWfQuestion();
}
function startWordformReviewQuiz(qids) {
  // The all-time review panel is a different, optional thing — it must not be
  // a side door around the owed-questions gate.
  if (typeof retryGate === 'function' && retryGate('wf')) return;
  const ids = Array.isArray(qids) ? qids : [];
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
  const qs = wfShuffle(ids.map(wordformById).filter(Boolean), seed);
  if (!qs.length) return;
  _wfQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderWfQuestion();
}
function isWordformQuizActive() { return !!_wfQuiz; }
function abandonWordformQuiz() { _wfQuiz = null; }

// Answers are stored as { value, isCorrect } for BOTH mcq (value=index) and
// text (value=typed string), so scoring is uniform.
function _wfNormalize(s) {
  return String(s || '').toLowerCase().normalize('NFC')
    .replace(/[.,!?;:"'’`]/g, '').replace(/\s+/g, ' ').trim();
}
function _wfTextCorrect(text, q) {
  const u = _wfNormalize(text);
  if (!u) return false;
  const list = (q.accept && q.accept.length) ? q.accept : [q.answer];
  return list.some(a => _wfNormalize(a) === u);
}

function renderWfQuestion() {
  const screen = document.getElementById('wordformScreen');
  if (!screen || !_wfQuiz) return;
  const st = _wfQuiz;
  const q = st.questions[st.idx];
  const userAns = st.answers[st.idx];         // null | { value, isCorrect }
  const answered = userAns !== null;
  const isCorrect = answered && userAns.isCorrect;
  const total = st.questions.length;

  // After answering, every English word becomes tappable (voice + nghĩa);
  // the (BASE) hint styling is traded for tappability of the base word.
  const wrap = (s) => (answered && typeof tapwordsWrap === 'function') ? tapwordsWrap(s) : wfEsc(s);
  const qHtml = (answered
    ? wrap(q.q)
    : wfEsc(q.q).replace(/\(([A-Z][A-Z\- ]*)\)/, '<span class="wf-base">($1)</span>'))
    .replace('___', '<span class="phrases-blank">_____</span>');

  let bodyHtml;
  if (q.type === 'text') {
    if (answered) {
      bodyHtml = `<div class="wf-text-answer ${isCorrect ? 'correct' : 'wrong'}">
        <span class="wf-text-answer-label">Your answer:</span>
        <span class="wf-text-answer-value">${userAns.value ? wfEsc(userAns.value) : '<em>(blank)</em>'}</span>
      </div>`;
    } else {
      bodyHtml = `<div class="wf-text-wrap">
        <input type="text" id="wfTextInput" class="wf-text-input" autofocus enterkeyhint="go" placeholder="Gõ dạng đúng của từ…"
               autocomplete="off" autocapitalize="off" spellcheck="false"
               onkeydown="if(event.key==='Enter'){event.preventDefault();submitWfText();}">
        <button class="wf-text-submit" onclick="submitWfText()">Check</button>
      </div>`;
    }
  } else {
    bodyHtml = '<div class="grammar-options">' + q.options.map((opt, i) => {
      let cls = 'grammar-option';
      if (answered) {
        if (i === q.correct) cls += ' correct';
        else if (userAns && i === userAns.value) cls += ' wrong';
      }
      const letter = String.fromCharCode(65 + i);
      // No disabled attr — it would swallow taps on the words inside;
      // answerWfQuestion ignores repeat answers itself.
      return `<button class="${cls}" onclick="answerWfQuestion(${i})">
        <span class="grammar-option-letter">${letter}</span>
        <span class="grammar-option-text">${wrap(opt)}</span>
      </button>`;
    }).join('') + '</div>';
  }

  let explain = '';
  if (answered) {
    const header = isCorrect ? '✅ ' : `❌ Đáp án đúng: <b>${wfEsc(q.answer)}</b>. `;
    explain = `<div class="grammar-explanation ${isCorrect ? 'correct' : 'wrong'}">
      <div class="phrases-vi">📘 ${wfEsc(q.vi)}</div>
      <div>${header}${wfEsc(q.explanation)}</div>
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
        <div class="grammar-question-text">${qHtml}</div>
        ${bodyHtml}
        ${explain}
      </div>
    </div>`;

  if (q.type === 'text' && !answered) {
    const inp = document.getElementById('wfTextInput');
    if (inp) { try { inp.focus(); } catch (e) {} }  // synchronous: keeps the tap gesture so the mobile keyboard opens
  }
}

function answerWfQuestion(i) {
  const st = _wfQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  st.answers[st.idx] = { value: i, isCorrect: i === q.correct };
  if (typeof petCheerAnswer === 'function') petCheerAnswer(i === q.correct);
  renderWfQuestion();
}
function submitWfText() {
  const st = _wfQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  const inp = document.getElementById('wfTextInput');
  const raw = inp ? inp.value : '';
  st.answers[st.idx] = { value: raw.trim(), isCorrect: _wfTextCorrect(raw, q) };
  if (typeof petCheerAnswer === 'function') petCheerAnswer(st.answers[st.idx].isCorrect);
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
    const a = st.answers[i];
    if (a && a.isCorrect) score++;
    else wrong.push({ qid: q.id, ua: a ? a.value : null });
  });
  const pct = total ? Math.round((score / total) * 100) : 0;

  // Reward coins for the pet shop: 5 per correct answer (matches Grammar).
  const coinsEarned = score * 5 + (typeof petComboBonus === 'function' ? petComboBonus() : 0);
  if (typeof appState !== 'undefined' && appState) appState.coins = (appState.coins || 0) + coinsEarned;
  // Streak: any completed practice counts as a study event for the day.
  if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }

  let date = 0;
  try { date = Date.now(); } catch (e) { date = 0; }
  saveWordformSession({ id: 'wf-' + date, date, score, total, wrong });

  // Owe every missed question back. Recorded after the coins are banked, so
  // getting something wrong never feels like it took away what was just
  // earned.
  const wrongQs = wrong.map(w => wordformById(w.qid)).filter(Boolean);
  if (wrongQs.length && typeof retryAdd === 'function') retryAdd('wf', wrongQs);
  const owed = wfRetryCount();

  // Sync word-form activity to the server (best-effort) for the admin view.
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  const screen = document.getElementById('wordformScreen');
  const reviewHtml = wrong.map(w => {
    const q = wordformById(w.qid);
    if (!q) return '';
    return `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${(typeof tapwordsWrap === 'function' ? tapwordsWrap(q.q) : wfEsc(q.q)).replace('___', '<b>' + (typeof tapwordsWrap === 'function' ? tapwordsWrap(q.answer) : wfEsc(q.answer)) + '</b>')}</div>
        <div class="grammar-review-explain">📘 ${wfEsc(q.vi)}<br>💡 ${wfEsc(q.explanation)}</div>
      </div>`;
  }).join('');

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderWordformHome()">‹</button>
        <span class="grammar-quiz-progress">${wfTierEmoji(pct)} ${score}/${total} (${pct}%)</span>
      </div>
      ${typeof petRewardCardHTML === 'function' ? petRewardCardHTML(score, total, coinsEarned) : (coinsEarned ? `<div class="grammar-result-coins">+${coinsEarned} 🪙 earned</div>` : '')}
      ${(typeof retryResultBannerHTML === 'function' ? retryResultBannerHTML('wf', wrong.length) : '')}
      <div class="phrases-section-title">Review${wrong.length ? ` · ${wrong.length} wrong` : ' · perfect! 🎉'}</div>
      ${reviewHtml}
      ${(typeof retryResultCtaHTML === 'function' ? retryResultCtaHTML('wf') : '')}
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
        <div class="grammar-review-q">${(typeof tapwordsWrap === 'function' ? tapwordsWrap(q.q) : wfEsc(q.q)).replace('___', '<b>' + (typeof tapwordsWrap === 'function' ? tapwordsWrap(q.answer) : wfEsc(q.answer)) + '</b>')}</div>
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
    submitWfText, nextWfQuestion, finishWordformQuiz, isWordformQuizActive, abandonWordformQuiz,
    setWfHistoryFilter, openWfSession, wordformById, wordformBank, _wfTextCorrect,
    switchWfSubTab, renderWordformLessons, openWordformLesson,
  };
}
