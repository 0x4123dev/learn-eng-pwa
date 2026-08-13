// math.js — Toán 7 formula practice. Two sub-tabs, like the English tabs:
// Practice (10 multiple-choice questions, "which formula is correct?") and
// Lessons (the chapter's formulas written out to revise from).
//
// The poster this is built from is a formula sheet, so the whole tab is about
// RECOGNISING the right formula rather than computing with it: every question
// offers four formulas and exactly one is the real one. The wrong three are
// the mistakes a Grade 7 student actually makes — added exponents where they
// should be multiplied, 90° where it should be 180°, √(a²) = a instead of |a|.
//
// Data: js/math-data.js (MATH_QUESTIONS, MATH_CHAPTERS) and js/math-lessons.js
// (MATH_LESSONS). No audio anywhere in this tab — nothing here is pronounced.

const MATH_QUIZ_SIZE = 10;
const MATH_HISTORY_CAP = 300;
const MATH_TIER_LABELS = { all: 'Tất cả', perfect: '⭐ Hoàn hảo', great: '✅ Tốt', ok: '👍 Khá', weak: '📝 Cần ôn' };

let _mathQuiz = null;          // { chapter, questions:[], idx, answers:[] }
let _mathSubTab = 'practice';  // 'practice' | 'lessons'
let _mathHistoryFilter = 'all';

function mathEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Unicode superscripts (x⁵, xᵐ⁺ⁿ) are drawn as tiny glyphs by the font, and
// nothing but enlarging the whole line can make them bigger — on a phone the
// exponent was simply unreadable. Turning them into real <sup> lets CSS size
// them, which is the only way the child can actually see "x⁻⁵" is negative.
const MATH_SUPERSCRIPTS = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5',
  '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9',
  '⁺': '+', '⁻': '−', '⁼': '=', '⁽': '(', '⁾': ')',
  'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᵏ': 'k',
  'ᵐ': 'm', 'ⁿ': 'n', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't',
  'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z'
};
const MATH_SUP_RE = new RegExp('[' + Object.keys(MATH_SUPERSCRIPTS).join('') + ']+', 'g');

// "√" on its own is only the hook. A căn bậc hai is the hook PLUS the bar
// (vinculum) drawn over what is under it — without it, "√36" reads as a tick
// mark standing next to a number, and "√(a²) = |a|" gives no clue where the
// radicand stops. The bar is a border-top on the radicand.
//
// Stops at "<" so it can never run across a tag and eat the markup: the same
// function is used on explanation HTML.
const MATH_RADICAND_CHAR = /[0-9A-Za-zÀ-ỹ⁰¹²³⁴⁵⁶⁷⁸⁹⁻⁺ᵃᵇᶜᵈᵉᵏᵐⁿᵖʳˢᵗᵘᵛʷˣʸᶻ.,]/;

function mathRadicals(s) {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== '√') { out += s[i]; continue; }
    let j = i + 1;
    let end = j;
    if (s[j] === '(') {
      let depth = 0;
      for (let k = j; k < s.length; k++) {
        const ch = s[k];
        if (ch === '<') { end = j; break; }           // a tag — leave it alone
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth === 0) { end = k + 1; break; } }
      }
    } else {
      while (end < s.length && s[end] !== '<' && MATH_RADICAND_CHAR.test(s[end])) end++;
    }
    if (end <= j) { out += '√'; continue; }           // nothing under the sign
    out += '√<span class="math-radicand">' + s.slice(j, end) + '</span>';
    i = end - 1;
  }
  return out;
}

function mathSuper(s) {
  return s.replace(MATH_SUP_RE, run =>
    '<sup>' + Array.from(run).map(ch => MATH_SUPERSCRIPTS[ch] || ch).join('') + '</sup>');
}

// Escape first, then draw the radicals, then lift the superscripts. The order
// matters: the same string often holds "khi a < 0", and the radicand scan must
// see the Unicode exponents before they become <sup> tags.
function mathFormula(s) {
  return mathSuper(mathRadicals(mathEsc(s)));
}

// Same lift, for strings that are already trusted HTML — explanations and
// lessons carry <br>/<b> that must survive, so these are NOT escaped. The
// build step (scripts/build-math-data.js) has already neutralised every "<"
// that is not one of those tags, which is what makes this safe.
function mathRich(html) {
  return mathSuper(mathRadicals(String(html == null ? '' : html)));
}

function mathTier(pct) { return pct === 100 ? 'perfect' : pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'weak'; }
function mathTierEmoji(pct) { return pct === 100 ? '⭐' : pct >= 80 ? '✅' : pct >= 60 ? '👍' : '📝'; }

function mathBank() {
  return (typeof MATH_QUESTIONS !== 'undefined') ? MATH_QUESTIONS : [];
}
function mathChapters() {
  return (typeof MATH_CHAPTERS !== 'undefined') ? MATH_CHAPTERS : [];
}
function mathLessons() {
  return (typeof MATH_LESSONS !== 'undefined') ? MATH_LESSONS : [];
}
function mathById(id) {
  return mathBank().find(q => q.id === id) || null;
}
function mathChapterQuestions(ch) {
  return ch ? mathBank().filter(q => q.ch === ch) : mathBank();
}

function mathShuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---- history ----
function mathHistory() {
  if (typeof appState === 'undefined' || !appState) return [];
  if (!Array.isArray(appState.mathHistory)) appState.mathHistory = [];
  return appState.mathHistory;
}

function saveMathSession(session) {
  if (typeof appState === 'undefined' || !appState) return;
  const list = mathHistory();
  list.unshift(session);
  if (list.length > MATH_HISTORY_CAP) list.length = MATH_HISTORY_CAP;
  if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    saveUserData(currentUser, appState);
  }
}

// ---- home ----
function renderMathHome() {
  const screen = document.getElementById('mathHubScreen');
  if (!screen) return;
  const body = _mathSubTab === 'lessons' ? renderMathLessonsHTML() : renderMathPracticeHTML();

  screen.innerHTML = `
    <header class="nav-hub-header math">
      <span class="nav-hub-kicker">TOÁN 7 · TẬP 1</span>
      <h1>Ôn công thức Toán 7</h1>
      <p>5 chương trọng tâm — chọn đúng công thức, nhớ lâu hơn học vẹt.</p>
    </header>
    <div class="grammar-subtabs" role="tablist">
      <button class="grammar-subtab ${_mathSubTab === 'practice' ? 'active' : ''}" role="tab"
              onclick="switchMathSubTab('practice')">🧮 Luyện tập</button>
      <button class="grammar-subtab ${_mathSubTab === 'lessons' ? 'active' : ''}" role="tab"
              onclick="switchMathSubTab('lessons')">📘 Lý thuyết</button>
    </div>
    <div class="phrases-wrap">${body}</div>`;
}

function switchMathSubTab(tab) {
  _mathSubTab = (tab === 'lessons') ? 'lessons' : 'practice';
  renderMathHome();
}

// ---- practice view ----
function renderMathPracticeHTML() {
  const bank = mathBank();
  const owed = (typeof retryOwedBannerHTML === 'function') ? retryOwedBannerHTML('math') : '';

  const chapterCards = mathChapters().map(c => {
    const n = mathChapterQuestions(c.num).length;
    const best = mathBestFor(c.num);
    return `
      <button class="phrases-cta" onclick="startMathQuiz(${c.num})">
        <span class="phrases-cta-icon">${c.icon}</span>
        <span class="phrases-cta-text">
          <strong>Chương ${c.num} · ${mathEsc(c.title)}</strong>
          <small>${n} câu công thức${best !== null ? ` · Tốt nhất: ${best}%` : ''}</small>
        </span>
        <span class="phrases-cta-arrow">›</span>
      </button>`;
  }).join('');

  return `
    ${owed}
    <div class="phrases-hero">
      <div class="phrases-hero-icon">🧮</div>
      <h1>Luyện công thức</h1>
      <p class="phrases-sub">Mỗi lượt <b>${MATH_QUIZ_SIZE} câu</b> trắc nghiệm: chọn công thức ĐÚNG trong 4 lựa chọn. ${bank.length} câu trên tất cả 5 chương.</p>
    </div>
    <button class="phrases-cta" onclick="startMathQuiz(0)">
      <span class="phrases-cta-icon">🎲</span>
      <span class="phrases-cta-text"><strong>Ôn tổng hợp</strong><small>${MATH_QUIZ_SIZE} câu trộn cả 5 chương</small></span>
      <span class="phrases-cta-arrow">›</span>
    </button>
    ${chapterCards}
    ${renderMathHistoryHTML()}`;
}

function mathBestFor(ch) {
  const runs = mathHistory().filter(h => h.chapter === ch && h.total);
  if (!runs.length) return null;
  return Math.max(...runs.map(h => Math.round(h.score / h.total * 100)));
}

function renderMathHistoryHTML() {
  const all = mathHistory();
  if (!all.length) return '';
  const list = all.filter(h => {
    if (_mathHistoryFilter === 'all') return true;
    return mathTier(Math.round(h.score / h.total * 100)) === _mathHistoryFilter;
  });
  const tabs = Object.keys(MATH_TIER_LABELS).map(t =>
    `<button class="grammar-subtab ${_mathHistoryFilter === t ? 'active' : ''}"
             onclick="setMathHistoryFilter('${t}')">${MATH_TIER_LABELS[t]}</button>`).join('');
  const rows = list.slice(0, 12).map(h => {
    const pct = h.total ? Math.round(h.score / h.total * 100) : 0;
    let when = '';
    try { when = new Date(h.date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    return `<div class="phrases-cat-row"><span>${mathTierEmoji(pct)} ${h.label} — ${h.score}/${h.total} · ${pct}%</span><strong>${when}</strong></div>`;
  }).join('');
  return `
    <details class="phrases-cats-wrap" open>
      <summary>Kết quả gần đây</summary>
      <div class="grammar-subtabs math-hist-tabs">${tabs}</div>
      <div class="phrases-cats">${rows || '<div class="phrases-cat-row"><span>Chưa có lượt nào ở mức này</span></div>'}</div>
    </details>`;
}

function setMathHistoryFilter(tier) { _mathHistoryFilter = tier; renderMathHome(); }

// ---- lessons view ----
function renderMathLessonsHTML() {
  const rows = mathLessons().map(l => `
    <button class="phrases-cta" onclick="openMathLesson('${mathEsc(l.key)}')">
      <span class="phrases-cta-icon">${l.icon}</span>
      <span class="phrases-cta-text"><strong>${mathEsc(l.title)}</strong><small>Công thức cần nhớ</small></span>
      <span class="phrases-cta-arrow">›</span>
    </button>`).join('');
  return `
    <div class="phrases-hero">
      <div class="phrases-hero-icon">📘</div>
      <h1>Lý thuyết</h1>
      <p class="phrases-sub">Công thức của từng chương, viết đầy đủ để ôn trước khi luyện tập.</p>
    </div>
    ${rows}`;
}

function openMathLesson(key) {
  const l = mathLessons().find(x => x.key === key);
  const screen = document.getElementById('mathHubScreen');
  if (!l || !screen) return;
  // Same markup as the Word form / Exam lesson views. Inventing class names
  // here is how this shipped unreadable the first time: "grammar-lesson-card"
  // looked plausible and had no styles at all.
  screen.innerHTML = `
    <div class="exam-lesson-detail">
      <button class="exam-back-btn" onclick="renderMathHome()">←</button>
      <h1 class="exam-lesson-detail-title">${l.icon} ${mathEsc(l.title)}</h1>
      <div class="exam-lesson-content math-lesson-body">${mathRich(l.content)}</div>
      <button class="grammar-next-btn" onclick="startMathQuizForLesson('${mathEsc(l.key)}')">Luyện chương này →</button>
    </div>`;
  screen.scrollTop = 0;
  if (typeof window !== 'undefined' && window.scrollTo) window.scrollTo(0, 0);
}

function startMathQuizForLesson(key) {
  const l = mathLessons().find(x => x.key === key);
  startMathQuiz(l ? l.chapter : 0);
}

// ---- quiz ----
// chapter 0 = mixed revision across all five chapters.
function startMathQuiz(chapter) {
  if (typeof retryGate === 'function' && retryGate('math')) return;
  const pool = mathChapterQuestions(chapter);
  if (!pool.length) return;
  const picked = mathShuffle(pool).slice(0, Math.min(MATH_QUIZ_SIZE, pool.length));
  _mathQuiz = {
    chapter: chapter,
    questions: picked,
    idx: 0,
    answers: picked.map(() => null)
  };
  renderMathQuestion();
}

function mathQuizLabel(chapter) {
  if (!chapter) return 'Ôn tổng hợp';
  const c = mathChapters().find(x => x.num === chapter);
  return c ? `Chương ${c.num} · ${c.title}` : `Chương ${chapter}`;
}

function renderMathQuestion() {
  const screen = document.getElementById('mathHubScreen');
  const st = _mathQuiz;
  if (!screen || !st) return;
  const q = st.questions[st.idx];
  const ans = st.answers[st.idx];
  const answered = ans !== null;
  const total = st.questions.length;

  const options = q.options.map((opt, i) => {
    let cls = 'grammar-option';
    if (answered) {
      if (i === q.correct) cls += ' correct';
      else if (i === ans) cls += ' wrong';
    }
    return `
      <button class="${cls}" ${answered ? '' : `onclick="answerMathQuestion(${i})"`}>
        <span class="grammar-option-letter">${'ABCD'[i]}</span>
        <span class="grammar-option-text math-formula">${mathFormula(opt)}</span>
      </button>`;
  }).join('');

  const explain = answered ? `
    <div class="grammar-explanation ${ans === q.correct ? 'correct' : 'wrong'}">
      <div>${mathRich(q.explanation)}</div>
    </div>
    <button class="grammar-next-btn" onclick="nextMathQuestion()">${st.idx + 1 < total ? 'Câu tiếp →' : 'Xem kết quả'}</button>` : '';

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonMathQuiz(); renderMathHome()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${(st.idx) / total * 100}%"></div></div>
      </div>
      <div class="phrases-cat-row math-topic-badge">${mathEsc(q.topic || mathQuizLabel(st.chapter))}</div>
      <div class="grammar-question-text">${mathFormula(q.q)}</div>
      <div class="grammar-options">${options}</div>
      ${explain}
    </div>`;
  screen.scrollTop = 0;
}

function answerMathQuestion(i) {
  const st = _mathQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  st.answers[st.idx] = i;
  const ok = i === q.correct;
  // The debt is filed once, at the end — retryAdd() takes the whole set of
  // missed questions, the same way every other tab feeds the drill.
  if (typeof petCheerAnswer === 'function') petCheerAnswer(ok);
  renderMathQuestion();
}

function nextMathQuestion() {
  const st = _mathQuiz;
  if (!st) return;
  if (st.idx + 1 < st.questions.length) { st.idx++; renderMathQuestion(); }
  else finishMathQuiz();
}

function finishMathQuiz() {
  const st = _mathQuiz;
  const screen = document.getElementById('mathHubScreen');
  if (!st || !screen) return;
  const total = st.questions.length;
  const score = st.answers.reduce((s, a, i) => s + (a === st.questions[i].correct ? 1 : 0), 0);
  const pct = Math.round(score / total * 100);

  saveMathSession({
    date: Date.now(), chapter: st.chapter, label: mathQuizLabel(st.chapter),
    score: score, total: total
  });
  if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }

  const wrong = st.questions
    .map((q, i) => ({ q, a: st.answers[i] }))
    .filter(x => x.a !== x.q.correct);
  // Owe back everything missed before a new practice opens (js/retrydrill.js).
  if (wrong.length && typeof retryAdd === 'function') retryAdd('math', wrong.map(x => x.q));
  const wrongHTML = wrong.map(x => `
    <div class="grammar-review-item">
      <div class="grammar-review-q">${mathEsc(x.q.q)}</div>
      <div class="grammar-review-a">✅ <b class="math-formula">${mathFormula(x.q.answer)}</b></div>
      <div class="grammar-review-explain">${mathRich(x.q.explanation)}</div>
    </div>`).join('');

  _mathQuiz = null;
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-result-card">
        <div class="grammar-result-emoji">${mathTierEmoji(pct)}</div>
        <h2>${score}/${total} · ${pct}%</h2>
        <p>${mathQuizLabel(st.chapter)}</p>
      </div>
      ${wrong.length ? `<h3 class="topic-detail-list-title">Cần xem lại (${wrong.length})</h3>${wrongHTML}` : ''}
      <button class="grammar-next-btn" onclick="renderMathHome()">Xong</button>
    </div>`;
  screen.scrollTop = 0;
}

function isMathQuizActive() { return !!_mathQuiz; }
function abandonMathQuiz() { _mathQuiz = null; }

// js/retrydrill.js — six tabs share one implementation. This says only what a
// Toán 7 question looks like inside it. A formula picked wrong comes back as
// the same multiple choice: the point is recognising the right one, and there
// is nothing to type.
if (typeof defineRetryDrill === 'function') defineRetryDrill({
  key: 'math',
  screenId: 'mathHubScreen',
  noun: 'câu',
  resolve: (id) => mathById(id),
  idOf: (q) => q.id,
  answerText: (q) => q.answer,
  grade: (v, q) => String(v || '').trim() === String(q.answer).trim(),
  promptHTML: (q) => `<div class="grammar-question-text">${mathFormula(q.q)}</div>`,
  explainHTML: (q) => `<div class="grammar-review-explain">${mathRich(q.explanation)}</div>`,
  home: () => renderMathHome(),
});

function mathRetryCount() { return (typeof retryCount === 'function' ? retryCount('math') : 0); }
function startMathRetry() { return (typeof startRetryDrill === 'function' ? startRetryDrill('math') : undefined); }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    mathBank, mathChapters, mathLessons, mathById, mathChapterQuestions,
    renderMathHome, switchMathSubTab, openMathLesson,
    startMathQuiz, answerMathQuestion, nextMathQuestion, finishMathQuiz,
    isMathQuizActive, abandonMathQuiz, mathQuizLabel, mathTier, mathEsc, mathFormula, mathRich,
    MATH_QUIZ_SIZE,
  };
}
