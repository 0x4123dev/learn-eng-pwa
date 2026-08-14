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

// ---- typed answers ----
// Some questions ask the child to COMPUTE, not just recognise — and there the
// phone keyboard is the wrong tool twice over: it cannot type √, an exponent
// or a fraction bar, and it slides up over the very question being asked.
//
// So the tab draws its own pad and never focuses an input. The answer is a
// plain string in JS, painted through mathFormula() — the same renderer that
// draws the question — so "2⁷" in the answer box looks like "2⁷" in the sum.
// Nothing on screen is focusable, so iOS has no reason to raise a keyboard.
const MATH_TYPED_PER_ROUND = 3;
const MATH_KEYPAD_ROWS = [
  ['7', '8', '9', '⌫'],
  ['4', '5', '6', '/'],
  ['1', '2', '3', '−'],
  [',', '0', '(', ')']
];
// Plain character → superscript, for the ^ key. Inverted from the table the
// renderer already uses rather than written out again: anything mathSuper can
// draw, the keypad can type, and the two cannot drift apart. Letters matter as
// much as digits here — Toán 7 is full of xⁿ and aᵐ⁺ⁿ.
const MATH_TO_SUP = {};
for (const sup in MATH_SUPERSCRIPTS) MATH_TO_SUP[MATH_SUPERSCRIPTS[sup]] = sup;

let _mathTyped = { raw: '', sup: false };

function mathTypedReset() { _mathTyped = { raw: '', sup: false }; }
function mathTypedRaw() { return _mathTyped.raw; }
function mathTypedSup() { return _mathTyped.sup; }
function mathIsTyped(q) { return !!q && q.type === 'calc'; }

// "^" is a mode, not a character: press it and the digits that follow land as
// real superscripts. That keeps backspace honest — one tap removes one glyph
// the child can see — and stores the same characters the rest of the tab
// already knows how to draw.
function mathKeyPress(k) {
  const st = _mathTyped;
  if (k === '⌫') {
    st.raw = st.raw.slice(0, -1);
    // Leaving the exponent behind would make the next digit a superscript of
    // nothing, which the child cannot see coming.
    if (st.sup && !MATH_SUPERSCRIPTS[st.raw.slice(-1)]) st.sup = false;
    return;
  }
  if (k === '^') { st.sup = !st.sup; return; }
  if (st.sup && MATH_TO_SUP[k]) { st.raw += MATH_TO_SUP[k]; return; }
  if (st.sup) st.sup = false;      // a symbol the exponent cannot hold
  st.raw += k;
}

// Compare on meaning, not on keystrokes: school writes 0,75 where JS writes
// 0.75, and a maths key prints U+2212 where a keyboard prints a hyphen.
function mathNormalize(s) {
  let t = String(s == null ? '' : s);
  t = t.replace(MATH_SUP_RE, run =>
    '^' + Array.from(run).map(ch => MATH_SUPERSCRIPTS[ch] || ch).join(''));
  return t.replace(/\s+/g, '')
    .replace(/,/g, '.')
    .replace(/[−–—]/g, '-')
    .replace(/[×·⋅]/g, '*')
    .toLowerCase();
}

// Deliberately NOT clever about fractions: -6/8 is wrong for -3/4 because rút
// gọn is the skill being tested. Whatever else counts is listed in accept[] by
// the author, who knows what the question is for.
function mathGrade(q, val) {
  const got = mathNormalize(val);
  if (!got) return false;
  const want = [q.answer].concat(q.accept || []).map(mathNormalize);
  if (want.indexOf(got) !== -1) return true;
  const n = Number(got);
  if (got !== '' && !isNaN(n)) {
    return want.some(w => w !== '' && !isNaN(Number(w)) && Number(w) === n);
  }
  return false;
}

function mathIsCorrect(q, ans) {
  return mathIsTyped(q) ? mathGrade(q, ans) : ans === q.correct;
}

function mathTypedBoxHTML(value, state) {
  const raw = value == null ? _mathTyped.raw : value;
  return `<div class="math-answer-box ${state || ''}">` +
    (raw ? `<span class="math-formula">${mathFormula(raw)}</span>`
         : `<span class="math-answer-placeholder">Đáp án của con…</span>`) +
    (state ? '' : `<span class="math-caret"></span>`) + `</div>`;
}

function mathKeypadHTML(q) {
  const extra = (q && q.keys || []).map(k =>
    `<button class="math-key math-key-sym${k === '^' ? ' math-key-pow' : ''}${k === '^' && _mathTyped.sup ? ' active' : ''}" onclick="mathKey('${k}')">` +
    (k === '^' ? 'x<sup>n</sup>' : mathEsc(k)) + `</button>`).join('');
  const rows = MATH_KEYPAD_ROWS.map(row =>
    `<div class="math-key-row">` + row.map(k =>
      `<button class="math-key${k === '⌫' ? ' math-key-del' : ''}" onclick="mathKey('${k}')">${mathEsc(k)}</button>`
    ).join('') + `</div>`).join('');
  return `<div class="math-keypad">` +
    (extra ? `<div class="math-key-row math-key-context">${extra}</div>` : '') +
    rows + `</div>`;
}

// Repaint just the answer box and the ^ key rather than the whole screen: a
// full re-render on every keystroke throws away the button's :active flash,
// which is the only feedback a child gets that the tap landed.
function mathKey(k) {
  mathKeyPress(k);
  const slot = document.getElementById('mathAnswerSlot');
  if (slot) slot.innerHTML = mathTypedBoxHTML();
  const pow = document.querySelector('.math-key-pow');
  if (pow) pow.className = 'math-key math-key-sym math-key-pow' + (_mathTyped.sup ? ' active' : '');
  const btn = document.getElementById('mathSubmitBtn');
  if (btn) btn.disabled = !_mathTyped.raw;
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
  // Draw the typed questions on purpose. Left to a plain shuffle they are a
  // handful among fifty, so most rounds would never ask the child to compute
  // anything — recognising the formula would go on being the whole tab.
  const size = Math.min(MATH_QUIZ_SIZE, pool.length);
  const typed = mathShuffle(pool.filter(mathIsTyped)).slice(0, Math.min(MATH_TYPED_PER_ROUND, size));
  const mcq = mathShuffle(pool.filter(q => !mathIsTyped(q))).slice(0, size - typed.length);
  const picked = mathShuffle(typed.concat(mcq));
  mathTypedReset();
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

// The board's pinned strip shows the question the student is actually on, so
// they never have to memorize it while writing rough work.
function mathCurrentQuestion() {
  return _mathQuiz ? _mathQuiz.questions[_mathQuiz.idx] : null;
}

function renderMathQuestion() {
  const screen = document.getElementById('mathHubScreen');
  const st = _mathQuiz;
  if (!screen || !st) return;
  const q = st.questions[st.idx];
  const ans = st.answers[st.idx];
  const answered = ans !== null;
  const total = st.questions.length;

  const ok = mathIsCorrect(q, ans);

  let body;
  if (mathIsTyped(q)) {
    body = answered
      // What the child typed, then the right answer if it differed — the same
      // shape every other tab uses to close a question.
      ? mathTypedBoxHTML(ans, ok ? 'correct' : 'wrong') +
        (ok ? '' : `<div class="math-answer-right">✅ <b class="math-formula">${mathFormula(q.answer)}</b></div>`)
      : `<div id="mathAnswerSlot">${mathTypedBoxHTML()}</div>
         ${mathKeypadHTML(q)}
         <button class="grammar-next-btn" id="mathSubmitBtn" ${_mathTyped.raw ? '' : 'disabled'}
                 onclick="submitMathTyped()">Kiểm tra</button>`;
  } else {
    body = `<div class="grammar-options">` + q.options.map((opt, i) => {
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
    }).join('') + `</div>`;
  }

  const explain = answered ? `
    <div class="grammar-explanation ${ok ? 'correct' : 'wrong'}">
      <div>${mathRich(q.explanation)}</div>
    </div>
    <button class="grammar-next-btn" onclick="nextMathQuestion()">${st.idx + 1 < total ? 'Câu tiếp →' : 'Xem kết quả'}</button>` : '';

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonMathQuiz(); renderMathHome()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${(st.idx) / total * 100}%"></div></div>
        <button class="math-board-fab" type="button" title="Bảng nháp" onclick="openMathBoard()">✏️</button>
      </div>
      <div class="phrases-cat-row math-topic-badge">${mathEsc(q.topic || mathQuizLabel(st.chapter))}</div>
      <div class="grammar-question-text">${mathFormula(q.q)}</div>
      ${body}
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

function submitMathTyped() {
  const st = _mathQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const raw = mathTypedRaw();
  if (!raw) return;                       // an empty box is not an answer
  st.answers[st.idx] = raw;
  if (typeof petCheerAnswer === 'function') petCheerAnswer(mathGrade(st.questions[st.idx], raw));
  renderMathQuestion();
}

function nextMathQuestion() {
  const st = _mathQuiz;
  if (!st) return;
  mathTypedReset();
  if (st.idx + 1 < st.questions.length) { st.idx++; renderMathQuestion(); }
  else finishMathQuiz();
}

function finishMathQuiz() {
  if (typeof mathBoardCloseForSession === 'function') mathBoardCloseForSession();
  if (typeof mathBoardReset === 'function') mathBoardReset();
  const st = _mathQuiz;
  const screen = document.getElementById('mathHubScreen');
  if (!st || !screen) return;
  const total = st.questions.length;
  const score = st.answers.reduce((s, a, i) => s + (mathIsCorrect(st.questions[i], a) ? 1 : 0), 0);
  const pct = Math.round(score / total * 100);

  saveMathSession({
    date: Date.now(), chapter: st.chapter, label: mathQuizLabel(st.chapter),
    score: score, total: total
  });
  if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }

  const wrong = st.questions
    .map((q, i) => ({ q, a: st.answers[i] }))
    .filter(x => !mathIsCorrect(x.q, x.a));
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

function mathQuizQuestions() { return _mathQuiz ? _mathQuiz.questions : []; }
function isMathQuizActive() { return !!_mathQuiz; }
function abandonMathQuiz() {
  if (typeof mathBoardCloseForSession === 'function') mathBoardCloseForSession();
  if (typeof mathBoardReset === 'function') mathBoardReset();
  _mathQuiz = null;
}

// js/retrydrill.js — six tabs share one implementation, and it defaults to a
// text box because for Word form that IS the lesson: a word guessed right by
// elimination comes back as typing, so the form has to be produced.
//
// A formula is the opposite. Nobody types "xᵐ · xⁿ = xᵐ⁺ⁿ", and the skill
// being drilled is telling the real formula from three plausible fakes. So
// the maths drill re-asks the question exactly as it was first shown: same
// options, same order, chosen not typed.
let _mathRetryOptions = [];
let _mathRetryPicked = null;
let _mathRetryTyped = false;

function mathRetryInputHTML(q) {
  // A typed question comes back typed — re-asking it as a choice would hand
  // the child the answer they failed to produce.
  if (mathIsTyped(q)) {
    mathTypedReset();
    _mathRetryTyped = true;
    return `<div id="mathAnswerSlot">${mathTypedBoxHTML()}</div>
      ${mathKeypadHTML(q)}
      <button class="grammar-next-btn" id="mathSubmitBtn" disabled
              onclick="submitRetryAnswer()">Kiểm tra</button>`;
  }
  _mathRetryTyped = false;
  _mathRetryOptions = q.options || [];
  _mathRetryPicked = null;
  return `<div class="grammar-options">` + _mathRetryOptions.map((opt, i) => `
      <button class="grammar-option" onclick="mathRetryPick(${i})">
        <span class="grammar-option-letter">${'ABCD'[i]}</span>
        <span class="grammar-option-text math-formula">${mathFormula(opt)}</span>
      </button>`).join('') + `</div>`;
}

function mathRetryPick(i) {
  _mathRetryPicked = _mathRetryOptions[i];
  if (typeof submitRetryAnswer === 'function') submitRetryAnswer();
}

if (typeof defineRetryDrill === 'function') defineRetryDrill({
  key: 'math',
  screenId: 'mathHubScreen',
  noun: 'câu',
  resolve: (id) => mathById(id),
  idOf: (q) => q.id,
  answerText: (q) => q.answer,
  inputHTML: (q) => mathRetryInputHTML(q),
  readAnswer: () => _mathRetryTyped ? mathTypedRaw() : _mathRetryPicked,
  valueText: (v) => String(v == null ? '' : v),
  grade: (v, q) => mathIsTyped(q)
    ? mathGrade(q, v)
    : String(v == null ? '' : v).trim() === String(q.answer).trim(),
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
    isMathQuizActive, abandonMathQuiz, mathQuizLabel, mathCurrentQuestion, mathTier, mathEsc, mathFormula, mathRich,
    mathTypedReset, mathTypedRaw, mathTypedSup, mathKeyPress, mathKey, mathIsTyped,
    mathNormalize, mathGrade, mathIsCorrect, mathKeypadHTML, mathTypedBoxHTML,
    submitMathTyped, mathQuizQuestions,
    MATH_QUIZ_SIZE, MATH_TYPED_PER_ROUND,
  };
}
