// wordform.js — "Word form" tab: word-formation practice.
// Data lives in js/wordform-data.js (global WORDFORM_QUESTIONS, 600 items —
// half multiple choice, half typed since 2026-08-25).
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
    // HIGH bits, not `s % (i + 1)`. An LCG's low bits barely vary, and with
    // that modulo one question was drawn into 12.5% of practices while another
    // was drawn essentially never — against a fair 1.67% each. Dividing by the
    // modulus uses the whole state instead. Measured after: every question
    // lands between 1.34% and 1.83%, none stranded.
    const j = Math.floor((s / 0x80000000) * (i + 1));
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

// ---- follow-up: proving the answer was understood, not guessed ----
// Picking "dangerous" out of four options can be luck, or a half-remembered
// "-ous looks right". So every word-form question is followed by ONE screen
// carrying TWO questions about the answer just given:
//
//   1. what the English word MEANS in Vietnamese, and
//   2. WHY the blank needs that word class — four real grammar reasons, only
//      one of which describes this sentence.
//
// A child who guessed cannot answer either. Options live in
// js/wordform-followups.js, keyed by the base question's id.
//
// A third question appears ONLY where the answer is built with a negative
// prefix (RELY → unreliable). Position in the sentence can explain why the
// blank needs an adjective; it can never explain why it needs *un*reliable
// rather than reliable — only the meaning of the sentence does. Answers
// without a prefix have nothing to ask, so they get two questions, not three.
const WF_FOLLOW_PARTS = ['m', 'r', 'neg'];
const WF_FOLLOW_TITLES = {
  m: 'Nghĩa của từ',
  r: 'Vì sao chọn dạng từ này?',
  neg: 'Vì sao dùng dạng phủ định?',
};

// The parts THIS follow-up actually has, in order.
function wfFollowParts(q) {
  return WF_FOLLOW_PARTS.filter(k => q && q[k]);
}

function wfFollowupQuestion(base) {
  if (!base || typeof WORDFORM_FOLLOWUPS === 'undefined') return null;
  const f = WORDFORM_FOLLOWUPS[base.id];
  if (!f) return null;
  const ok = (b) => b && Array.isArray(b.o) && b.o.length === 4 &&
                    typeof b.c === 'number' && b.c >= 0 && b.c < 4;
  if (!ok(f.m) || !ok(f.r)) return null;
  const out = {
    id: 'wfu-' + base.id,
    baseId: base.id,
    followup: true,
    cat: base.cat,
    base: base.base,
    answer: base.answer,
    stem: base.q,             // shown again on the check — see renderWfFollowup
    vi: base.vi,
    explanation: base.explanation,
    m: { q: 'What is the meaning of "' + base.answer + '"?', options: f.m.o, correct: f.m.c },
    r: { q: 'Vì sao chỗ trống phải là "' + base.answer + '"?', options: f.r.o, correct: f.r.c },
  };
  // The negative-prefix question, where there is one. `w` is the positive form
  // the child might have written instead, and the prefix is whatever the answer
  // carries in front of it.
  if (ok(f.neg) && f.neg.w && base.answer.toLowerCase().endsWith(String(f.neg.w).toLowerCase())) {
    out.neg = {
      q: 'Vì sao là "' + base.answer + '" chứ không phải "' + f.neg.w + '"?',
      options: f.neg.o,
      correct: f.neg.c,
      positive: f.neg.w,
      prefix: base.answer.slice(0, base.answer.length - String(f.neg.w).length),
    };
  }
  return out;
}

// Expand picked questions into [base, follow-up, base, follow-up, …].
// A question with no follow-up data is simply left on its own rather than
// dropped, so a gap in the data costs the understanding check, not the question.
function wfExpandFollowups(qs) {
  const out = [];
  qs.forEach(q => {
    out.push(q);
    const f = wfFollowupQuestion(q);
    if (f) out.push(f);
  });
  return out;
}

// A follow-up screen holds two questions — three on a negative prefix — so its
// answer is a set, and it is worth one point per question: understanding the
// word and understanding the rule are separate things to get right.
function wfFollowScore(q, ans) {
  let score = 0;
  wfFollowParts(q).forEach(k => { if (ans && ans[k] === q[k].correct) score++; });
  return score;
}
function wfFollowDone(q, ans) {
  return !!ans && wfFollowParts(q).every(k => ans[k] !== null && ans[k] !== undefined);
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
        <p class="phrases-sub">Chia dạng từ (danh/động/tính/trạng từ) — ${bank.length} câu, gồm cả chọn đáp án và tự gõ. Mỗi câu có thêm một màn hỏi lại: <b>nghĩa của từ</b> và <b>vì sao chọn dạng đó</b>.</p>
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
// Typed questions are the ones that teach: choosing "education" from four
// options is recognition, producing it is recall. They are only 100 of the 600
// in the bank, so a plain random draw left a 10-question practice with ZERO
// typing 23% of the time — a child could use the tab for a week and barely
// type at all.
//
// Every practice is therefore BUILT to a fixed ratio rather than sampled and
// hoped over. Raised from 0.3 to a straight half (2026-08-23): at 3-in-10 a
// practice was still mostly recognition, and producing the form is the skill
// the tab exists to train. Now: 5 typed in 10, 10 in 20.
const WF_TYPED_SHARE = 0.5;

// How many of an n-question practice must be typed. Never more than the bank
// holds, and never zero once there is room for one.
function wfTypedTarget(n, availableTyped) {
  const want = Math.round(n * WF_TYPED_SHARE);
  // The "at least one" floor must itself respect what exists. Without the
  // availableTyped > 0 guard, an empty typed pool still demanded one, the
  // slice returned nothing, and the practice came up a question SHORT — a
  // 10-question practice with 9 questions in it, silently.
  const floor = (n >= 2 && availableTyped > 0) ? 1 : 0;
  return Math.max(floor, Math.min(want, availableTyped, n));
}

function startWordformQuiz(n) {
  // Questions missed earlier are owed back BEFORE a new practice. The buttons
  // are disabled while anything is owed, but the rule lives here too: a stale
  // DOM node or a queued tap must not walk past it.
  if (typeof retryGate === 'function' && retryGate('wf')) return;
  const bank = wordformBank();
  if (!bank.length) return;
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;

  let qs;
  if (n === 'all') {
    qs = bank.slice();                       // the whole bank keeps its own mix
  } else {
    const size = Math.min(n, bank.length);
    const typed = bank.filter(q => q.type === 'text');
    const mcq = bank.filter(q => q.type !== 'text');
    const wantTyped = wfTypedTarget(size, typed.length);
    // Drawn from each pool separately — that is what makes the count exact —
    // then shuffled together so the typing is not all bunched at the end.
    const picked = wfShuffle(typed, seed).slice(0, wantTyped)
      .concat(wfShuffle(mcq, seed ^ 0x5bf03635).slice(0, size - wantTyped));
    qs = wfShuffle(picked, seed ^ 0x2545f491);
  }
  // Each question drags its understanding check along right behind it. The
  // practice buttons still promise the number of WORD-FORM questions — that is
  // what a child counts — so the count above is left alone and the screens
  // roughly double.
  qs = wfExpandFollowups(qs);
  _wfQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderWfQuestion();
}
function startWordformReviewQuiz(qids) {
  // The all-time review panel is a different, optional thing — it must not be
  // a side door around the owed-questions gate.
  if (typeof retryGate === 'function' && retryGate('wf')) return;
  const ids = Array.isArray(qids) ? qids : [];
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
  const qs = wfExpandFollowups(wfShuffle(ids.map(wordformById).filter(Boolean), seed));
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

// The quiz header is identical on both kinds of screen, so it is written once.
function wfQuizHeaderHTML(st) {
  const total = st.questions.length;
  return `
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonWordformQuiz(); renderWordformHome()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round(((st.idx) / total) * 100)}%"></div></div>
      </div>`;
}

// The check asks about a sentence that has already scrolled away. "Vì sao chỗ
// trống phải là 'dangerous'?" is unanswerable — guessable at best — without the
// sentence in front of you, so the question comes back, this time with the
// blank filled in, together with what the child actually put there.
function wfFollowRecapHTML(st, q) {
  if (!q.stem) return '';
  const wrap = (s) => (typeof tapwordsWrap === 'function') ? tapwordsWrap(s) : wfEsc(s);
  const sentence = wrap(q.stem).replace('___', `<b class="wf-recap-answer">${wfEsc(q.answer)}</b>`);

  // The word-form question sits immediately before its own check.
  const prev = st.questions[st.idx - 1];
  const prevAns = st.answers[st.idx - 1];
  let line = '';
  if (prev && prev.id === q.baseId && prevAns) {
    const given = (prev.type === 'text')
      ? String(prevAns.value || '')
      : ((prev.options && prev.options[prevAns.value]) || '');
    line = prevAns.isCorrect
      ? `<div class="wf-recap-you ok">✅&nbsp;Bé trả lời đúng: <b>${wfEsc(q.answer)}</b></div>`
      : `<div class="wf-recap-you bad">❌&nbsp;Bé trả lời: <s>${given ? wfEsc(given) : '(bỏ trống)'}</s> · Đúng: <b>${wfEsc(q.answer)}</b></div>`;
  }
  return `
      <div class="wf-follow-recap">
        <div class="wf-recap-label">Câu vừa rồi</div>
        <div class="wf-recap-q">${sentence}</div>
        ${line}
      </div>`;
}

// One screen, two questions. The second one is withheld until the first is
// answered: eight options at once is a wall to a nine-year-old, and asking
// "why is it an adjective?" beside "what does it mean?" lets each answer hint
// at the other.
function renderWfFollowup() {
  const screen = document.getElementById('wordformScreen');
  if (!screen || !_wfQuiz) return;
  const st = _wfQuiz;
  const q = st.questions[st.idx];
  const ans = st.answers[st.idx] || { m: null, r: null };
  const total = st.questions.length;
  if (typeof twPrefetch === 'function') twPrefetch(q.stem || q.answer, [], q.explanation, q.answer);

  const done = wfFollowDone(q, ans);
  const catLabel = (WF_CAT_LABELS[q.cat] || '').replace(/^[A-Za-z]+ /, '');   // "(tính từ)"

  const block = (key, stepNo) => {
    const part = q[key];
    const title = WF_FOLLOW_TITLES[key];
    const picked = ans[key];
    const shown = picked !== null && picked !== undefined;
    const opts = part.options.map((opt, i) => {
      let cls = 'grammar-option';
      if (shown) {
        if (i === part.correct) cls += ' correct';
        else if (i === picked) cls += ' wrong';
      }
      return `<button class="${cls}" onclick="answerWfFollowup('${key}',${i})">
        <span class="grammar-option-letter">${String.fromCharCode(65 + i)}</span>
        <span class="grammar-option-text">${wfEsc(opt)}</span>
      </button>`;
    }).join('');

    let note = '';
    if (shown) {
      const ok = picked === part.correct;
      let body;
      if (key === 'm') {
        body = `<b>${wfEsc(q.answer)}</b> = ${wfEsc(part.options[part.correct])}. ${wfEsc(q.vi)}`;
      } else if (key === 'neg') {
        // The reason is the option itself, so repeating it when the child got
        // it right is noise; what is worth adding is the mechanic.
        const rule = `Tiền tố <b>${wfEsc(part.prefix)}-</b> đảo ngược nghĩa của <b>${wfEsc(part.positive)}</b>.`;
        body = ok ? rule : `${wfEsc(part.options[part.correct])}. ${rule}`;
      } else {
        body = wfEsc(q.explanation);
      }
      note = `<div class="grammar-explanation ${ok ? 'correct' : 'wrong'}">
        <div>${ok ? '✅&nbsp;' : `❌ Đáp án đúng: <b>${String.fromCharCode(65 + part.correct)}</b>. `}${body}</div>
      </div>`;
    }
    return `
      <div class="wf-follow-block${shown ? ' answered' : ''}">
        <div class="wf-follow-step"><span class="wf-follow-step-no">${stepNo}</span>${title}</div>
        <div class="wf-follow-q">${wfEsc(part.q)}</div>
        <div class="grammar-options">${opts}</div>
        ${note}
      </div>`;
  };

  // Each step waits for the one before it; a line saying so beats a blank gap.
  // Only ONE lock line: everything past the first unanswered step is hidden
  // behind it, not stacked up as a column of padlocks.
  const parts = wfFollowParts(q);
  const stepHtml = [];
  for (let i = 0; i < parts.length; i++) {
    const prev = parts[i - 1];
    if (prev && (ans[prev] === null || ans[prev] === undefined)) {
      stepHtml.push(`<div class="wf-follow-locked">🔒 Trả lời câu ${i} để mở câu ${i + 1}</div>`);
      break;
    }
    stepHtml.push(block(parts[i], String(i + 1)));
  }
  const steps = stepHtml.join('');

  screen.innerHTML = `
    <div class="phrases-wrap">
      ${wfQuizHeaderHTML(st)}
      <div class="grammar-question-card wf-follow-card">
        <div class="grammar-question-tag wf-follow-tag">🧠 Hiểu đáp án · ${wfEsc(q.answer)} ${wfEsc(catLabel)}</div>
        ${wfFollowRecapHTML(st, q)}
        ${steps}
        ${done ? `<button class="grammar-next-btn" onclick="nextWfQuestion()">${st.idx + 1 < total ? 'Next →' : 'See results'}</button>` : ''}
      </div>
    </div>`;
}

function answerWfFollowup(key, i) {
  const st = _wfQuiz;
  if (!st) return;
  const q = st.questions[st.idx];
  if (!q || !q.followup || !q[key]) return;
  const parts = wfFollowParts(q);
  if (parts.indexOf(key) === -1) return;
  if (st.answers[st.idx] === null) st.answers[st.idx] = { m: null, r: null, neg: null };
  const ans = st.answers[st.idx];
  if (ans[key] !== null && ans[key] !== undefined) return;     // first answer stands
  // A later step is not on screen until the one before it is answered; a queued
  // tap must not walk past that either.
  const prev = parts[parts.indexOf(key) - 1];
  if (prev && (ans[prev] === null || ans[prev] === undefined)) return;
  ans[key] = i;
  if (typeof petCheerAnswer === 'function') petCheerAnswer(i === q[key].correct);
  renderWfFollowup();
}

function renderWfQuestion() {
  const screen = document.getElementById('wordformScreen');
  if (!screen || !_wfQuiz) return;
  const st = _wfQuiz;
  const q = st.questions[st.idx];
  if (q && q.followup) { renderWfFollowup(); return; }
  // Warm this question's words now: they become tappable once answered.
  if (typeof twPrefetch === 'function') twPrefetch(q.q, q.options || [], q.explanation, q.answer);
  const userAns = st.answers[st.idx];         // null | { value, isCorrect }
  const answered = userAns !== null;
  const isCorrect = answered && userAns.isCorrect;
  // Speak the correct answer the moment it is revealed — once per question,
  // so re-rendering (or tapping 🔊) never starts it over on its own.
  if (answered && st._spokenIdx !== st.idx) {
    st._spokenIdx = st.idx;
    if (typeof speakAnswer === 'function') speakAnswer(q.answer, { auto: true });
  }
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
    ${answerGateHTML(q.answer, 'nextWfQuestion()', st.idx + 1 < total ? 'Next →' : 'See results')}`;
  }

  screen.innerHTML = `
    <div class="phrases-wrap">
      ${wfQuizHeaderHTML(st)}
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
  // A check screen answers through answerWfFollowup; letting a stale node or a
  // queued tap through here would write a single-value answer over the check's
  // two-part one and lock it unanswerable.
  if (!q || q.followup) return;
  st.answers[st.idx] = { value: i, isCorrect: i === q.correct };
  if (typeof petCheerAnswer === 'function') petCheerAnswer(i === q.correct);
  renderWfQuestion();
}
function submitWfText() {
  const st = _wfQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  if (!q || q.followup) return;                 // see answerWfQuestion
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

// The score alone cannot separate a child who knows the rules from one whose
// guesses landed, so the result screen reports the two understanding checks in
// their own right.
function wfUnderstandCardHTML(fu) {
  const seen = fu && (fu.count || fu.n);          // `n` — sessions saved before v4.11.3
  if (!seen) return '';
  const row = (icon, label, got, of) => {
    const pct = Math.round((got / of) * 100);
    return `<div class="wf-understand-row">
      <span class="wf-understand-label">${icon} ${label}</span>
      <span class="wf-understand-bar"><i style="width:${pct}%"></i></span>
      <b class="wf-understand-num">${got}/${of}</b>
    </div>`;
  };
  // The prefix row appears only when the practice actually contained a
  // negative-prefix answer — a 0/0 bar would read as a failure.
  const negRow = fu.negCount ? row('🚫', 'Lý do dùng dạng phủ định', fu.neg, fu.negCount) : '';
  return `
    <div class="wf-understand-card">
      <div class="wf-understand-title">🧠 Hiểu bài</div>
      ${row('💡', 'Nghĩa của từ', fu.m, seen)}
      ${row('📐', 'Lý do chọn dạng từ', fu.r, seen)}
      ${negRow}
    </div>`;
}

function wfSkillSummaries(st) {
  const skillMap = {};
  const add = (key, label, ok, ref) => {
    const row = skillMap[key] || (skillMap[key] = {
      skillKey: key, skillLabel: label, attempts: 0, correct: 0,
      wrong: 0, skipped: 0, wrongRefs: []
    });
    row.attempts++;
    if (ok === null) row.skipped++;
    else if (ok) row.correct++;
    else {
      row.wrong++;
      if (ref && row.wrongRefs.length < 20) row.wrongRefs.push(String(ref));
    }
  };
  st.questions.forEach((q, i) => {
    const answer = st.answers[i];
    if (q.followup) {
      const labels = { m: 'Hiểu nghĩa của từ', r: 'Chọn đúng loại từ', neg: 'Tiền tố phủ định' };
      const keys = { m: 'meaning', r: 'grammar.reason', neg: 'negative.prefix' };
      wfFollowParts(q).forEach(part => add('wordform.' + keys[part], labels[part],
        answer ? answer[part] === q[part].correct : null, q.baseId));
      return;
    }
    const cat = String(q.cat || 'general').normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').toLowerCase()
      .replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'general';
    add('wordform.form.' + cat, q.cat ? ('Biến đổi · ' + q.cat) : 'Chọn dạng từ',
      answer ? !!answer.isCorrect : null, q.id);
  });
  return Object.keys(skillMap).map(k => skillMap[k]);
}

function finishWordformQuiz() {
  const st = _wfQuiz;
  if (!st) return;
  // A follow-up screen is worth TWO points, so the denominator counts points,
  // not screens: 20 word-form questions plus their two checks each is 60.
  // Reporting 20/40 for a practice a child answered 60 things in would read as
  // a bug, and would make the percentage — which the history tiers use — wrong.
  let total = 0;
  let score = 0;
  const wrong = [];
  // count/m/r: follow-ups seen, meanings right, reasons right. negCount/neg
  // count only the ones that ASKED about a negative prefix — most practices
  // contain none, and 0/0 is not a score.
  const fu = { count: 0, m: 0, r: 0, negCount: 0, neg: 0 };
  let checksAsked = 0;
  st.questions.forEach((q, i) => {
    const a = st.answers[i];
    if (q.followup) {
      const parts = wfFollowParts(q);
      total += parts.length;
      checksAsked += parts.length;
      score += wfFollowScore(q, a);
      fu.count++;
      if (q.neg) fu.negCount++;
      parts.forEach(k => { if (a && a[k] === q[k].correct) fu[k]++; });
      return;
    }
    total++;
    if (a && a.isCorrect) score++;
    else wrong.push({ qid: q.id, ua: a ? a.value : null });
  });
  const pct = total ? Math.round((score / total) * 100) : 0;
  // "perfect! 🎉" over a missed understanding check would be a lie the child can
  // see: the card right above it says 0/1.
  const checksMissed = checksAsked - fu.m - fu.r - fu.neg;

  // Reward coins for the pet shop: 5 per correct answer (matches Grammar).
  const coinsEarned = score * 5 + (typeof petComboBonus === 'function' ? petComboBonus() : 0);
  if (typeof appState !== 'undefined' && appState) appState.coins = (appState.coins || 0) + coinsEarned;
  // Streak: any completed practice counts as a study event for the day.
  if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }

  let date = 0;
  try { date = Date.now(); } catch (e) { date = 0; }
  saveWordformSession({
    id: 'wf-' + date, date, score, total, wrong, fu,
    skills: wfSkillSummaries(st)
  });

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
      ${wfUnderstandCardHTML(fu)}
      ${(typeof retryResultBannerHTML === 'function' ? retryResultBannerHTML('wf', wrong.length) : '')}
      <div class="phrases-section-title">Review${wrong.length ? ` · ${wrong.length} wrong`
        : (checksMissed ? ' · các câu chia dạng từ đều đúng 👍' : ' · perfect! 🎉')}</div>
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
    wfFollowupQuestion, wfExpandFollowups, wfFollowScore, wfFollowDone, wfFollowParts,
    answerWfFollowup, renderWfFollowup, wfUnderstandCardHTML,
  };
}
