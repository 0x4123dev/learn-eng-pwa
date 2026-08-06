// collocation.js — 🧩 Collocation practice (PTNK chuyên Anh style), a
// sub-tab of the Phrases screen. Five original question formats mirror the
// PTNK paper: double-blank pair MCQ, single-blank MCQ, typed with first
// letter shown, open one-word cloze, and key-word transformation.
// Data lives in js/collocation-data.js (COLLOCATION_QUESTIONS).

let _colQuiz = null;   // { questions:[], idx, answers:[] }

const COLLOC_TYPE_META = {
  pair: { icon: '🧩', label: 'Double blank · chọn cặp từ' },
  mcq: { icon: '🔤', label: 'Collocation · chọn từ đúng' },
  letter: { icon: '✏️', label: 'Gõ từ (cho chữ cái đầu)' },
  open: { icon: '💭', label: 'Gõ 1 từ (open cloze)' },
  transform: { icon: '🔁', label: 'Viết lại câu (key word)' },
};

function collocBank() {
  return (typeof COLLOCATION_QUESTIONS !== 'undefined') ? COLLOCATION_QUESTIONS : [];
}

function colEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Explanations are trusted build-time HTML restricted to <br> and <b>
// (enforced by scripts/build-collocation.js + tests) — rendered raw.

// ---- lenient grading (shared idea with Rewrite: case/space/punct-insensitive,
// apostrophes optional so "she's" ≡ "shes" ≡ "she is" via accept variants) ----
function _colNorm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/'/g, '')
    .replace(/[.,!?;:"]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function _colAnswerCorrect(input, q) {
  const u = _colNorm(input);
  if (!u) return false;
  const targets = [q.answer].concat(q.accept || []);
  return targets.some(t => _colNorm(t) === u);
}

// First-letter hint for "letter" questions: "c_______" style.
function _colLetterHint(answer) {
  const w = String(answer || '');
  if (!w) return '';
  return w[0] + ' _'.repeat(Math.max(0, w.length - 1));
}

function collocHistoryList() {
  return ((typeof appState !== 'undefined' && appState && appState.collocHistory) || []);
}

// ---- home view (returned as HTML string; phrases.js injects it) ----
function renderCollocHome() {
  const bank = collocBank();
  const counts = {};
  bank.forEach(q => { counts[q.type] = (counts[q.type] || 0) + 1; });
  const typeRows = Object.keys(COLLOC_TYPE_META).map(t =>
    `<div class="phrases-cat-row"><span>${COLLOC_TYPE_META[t].icon} ${COLLOC_TYPE_META[t].label}</span><strong>${counts[t] || 0}</strong></div>`
  ).join('');

  const hist = collocHistoryList();
  let best = 0;
  hist.forEach(h => { if (h.total) best = Math.max(best, Math.round(h.score / h.total * 100)); });
  const histRows = hist.slice(0, 8).map(h => {
    const pct = h.total ? Math.round(h.score / h.total * 100) : 0;
    let when = '';
    try { when = new Date(h.date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) {}
    return `<div class="phrases-cat-row"><span>${pct === 100 ? '⭐' : pct >= 60 ? '✅' : '📝'} ${h.score}/${h.total} · ${pct}%</span><strong>${when}</strong></div>`;
  }).join('');

  return `
      <div class="phrases-hero">
        <div class="phrases-hero-icon">🧩</div>
        <h1>Collocation</h1>
        <p class="phrases-sub">Luyện collocation kiểu đề chuyên Anh PTNK — ${bank.length} câu gồm 5 dạng: cặp từ đôi, trắc nghiệm, gõ từ, open cloze và viết lại câu.${best ? ` Best: <b>${best}%</b>` : ''}</p>
      </div>

      <button class="phrases-cta" onclick="startCollocPractice(20)">
        <span class="phrases-cta-icon">🧩</span>
        <span class="phrases-cta-text"><strong>Practice</strong><small>20 câu ngẫu nhiên, trộn 5 dạng</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <button class="phrases-cta" onclick="startCollocPractice(10)">
        <span class="phrases-cta-icon">⚡</span>
        <span class="phrases-cta-text"><strong>Quick</strong><small>10 câu ngẫu nhiên</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <details class="phrases-cats-wrap">
        <summary>📖 Lý thuyết: 5 loại collocation trong đề chuyên</summary>
        <div class="colloc-lesson">${collocLessonHTML()}</div>
      </details>

      <details class="phrases-cats-wrap">
        <summary>Question types</summary>
        <div class="phrases-cats">${typeRows}</div>
      </details>

      ${histRows ? `<details class="phrases-cats-wrap" open><summary>Recent results</summary><div class="phrases-cats">${histRows}</div></details>` : ''}`;
}

function collocLessonHTML() {
  return `
    <div class="colloc-lesson-item"><b>1. Verb + Noun</b> — động từ "bắt cặp" cố định với danh từ: <b>make</b> a decision (KHÔNG dùng do), <b>draw</b> a conclusion, <b>keep</b> a low profile, <b>raise</b> awareness. Mẹo: học theo động từ gốc (make/do/take/have/pay/catch…).</div>
    <div class="colloc-lesson-item"><b>2. Adjective + Noun</b> — tính từ đi riêng với danh từ: <b>heavy</b> rain (không dùng strong), <b>conclusive</b> proof, <b>sheer</b> luck, <b>vivid</b> imagination. Đề PTNK hay cho dạng 2 chỗ trống: cả cặp phải cùng đúng.</div>
    <div class="colloc-lesson-item"><b>3. Phrasal verbs</b> — động từ + tiểu từ đổi nghĩa hoàn toàn: come up with (nghĩ ra), put up with (chịu đựng), turn down (từ chối), fall through (đổ bể). Học theo NGHĨA, không dịch từng từ.</div>
    <div class="colloc-lesson-item"><b>4. Verb/Adj + Preposition</b> — giới từ cố định: rely <b>on</b>, accuse sb <b>of</b>, capable <b>of</b>, fed up <b>with</b>, immune <b>to</b>. Dạng open cloze (gõ 1 từ) trong đề thi gần như luôn có vài câu giới từ.</div>
    <div class="colloc-lesson-item"><b>5. Fixed phrases &amp; idioms</b> — cụm cố định không đổi được từ nào: make ends meet, out of the question, taken aback, come to terms with, part and parcel. Dạng viết lại câu (key word transformation) lấy điểm ở đây.</div>
    <div class="colloc-lesson-item">🎯 <b>Chiến thuật PTNK:</b> với câu 2 chỗ trống, thử từng đáp án vào CẢ HAI chỗ — chỉ cần 1 chỗ sai là loại cả cặp. Với viết lại câu: giữ nguyên key word, đếm 3–8 từ.</div>`;
}

// ---- practice flow ----
function startCollocPractice(n) {
  const bank = collocBank();
  if (!bank.length) return;
  const shuffled = bank.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const questions = shuffled.slice(0, Math.min(n || 20, shuffled.length));
  _colQuiz = { questions, idx: 0, answers: new Array(questions.length).fill(null) };
  renderCollocQuestion();
}

function abandonCollocPractice() { _colQuiz = null; }
function isCollocActive() { return !!_colQuiz; }

function renderCollocQuestion() {
  const screen = document.getElementById('phrasesScreen');
  const st = _colQuiz;
  if (!screen || !st) return;
  const q = st.questions[st.idx];
  const ans = st.answers[st.idx];
  const answered = ans !== null;
  const total = st.questions.length;
  const meta = COLLOC_TYPE_META[q.type] || COLLOC_TYPE_META.mcq;
  const isMcq = q.type === 'pair' || q.type === 'mcq';

  // After answering, every English word becomes tappable (voice + nghĩa).
  const wrap = (s) => (answered && typeof tapwordsWrap === 'function') ? tapwordsWrap(s) : colEsc(s);

  let qHtml = wrap(q.q).replace(/___/g, '<span class="phrases-blank">_____</span>');
  let body = '';

  if (isMcq) {
    const opts = q.options.map((opt, i) => {
      let cls = 'grammar-option';
      if (answered) {
        if (i === q.correct) cls += ' correct';
        else if (i === ans.choice) cls += ' wrong';
      }
      // No disabled attr: it would swallow taps on the words inside;
      // answerCollocChoice ignores repeat answers itself.
      return `<button class="${cls}" onclick="answerCollocChoice(${i})">
        <span class="grammar-option-letter">${String.fromCharCode(65 + i)}</span>
        <span class="grammar-option-text">${wrap(opt)}</span>
      </button>`;
    }).join('');
    body = `<div class="grammar-options">${opts}</div>`;
  } else {
    if (q.type === 'letter') {
      qHtml += `<div class="colloc-hint">Gợi ý: <b>${colEsc(_colLetterHint(q.answer))}</b></div>`;
    }
    if (q.type === 'transform') {
      qHtml = `<div class="colloc-transform-src">${wrap(q.q)}</div>
        <div class="colloc-keyword">Key word: <b>${colEsc(q.keyword || '')}</b> (giữ nguyên, 3–8 từ)</div>
        <div class="colloc-frame">${wrap(q.frame || '').replace(/___/g, '<span class="phrases-blank">_____</span>')}</div>`;
    }
    if (!answered) {
      body = `<div class="wf-text-wrap">
        <input type="text" id="colTextInput" class="wf-text-input" autofocus enterkeyhint="go"
               placeholder="${q.type === 'transform' ? 'Gõ phần còn thiếu…' : 'Gõ 1 từ…'}"
               autocomplete="off" autocapitalize="off" spellcheck="false"
               onkeydown="if(event.key==='Enter'){event.preventDefault();submitCollocText();}">
        <button class="wf-text-submit" onclick="submitCollocText()">Check</button>
      </div>`;
    } else {
      body = `<div class="wf-text-answer ${ans.isCorrect ? 'correct' : 'wrong'}">
        <span class="wf-text-answer-label">Your answer:</span>
        <span class="wf-text-answer-value">${ans.value ? colEsc(ans.value) : '<em>(blank)</em>'}</span>
      </div>`;
    }
  }

  let explain = '';
  if (answered) {
    explain = `<div class="grammar-explanation ${ans.isCorrect ? 'correct' : 'wrong'}">
      <div class="phrases-vi">📘 ${colEsc(q.vi)}</div>
      ${ans.isCorrect ? '' : `<div class="colloc-correct-answer">❌ Đáp án đúng: <b>${wrap(q.answer)}</b></div>`}
      <div>${q.explanation}</div>
    </div>
    <button class="grammar-next-btn" onclick="nextCollocQuestion()">${st.idx + 1 < total ? 'Next →' : 'See results'}</button>`;
  }

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonCollocPractice(); renderPhrasesHome()">✕</button>
        <span class="grammar-quiz-progress">🧩 ${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round(st.idx / total * 100)}%"></div></div>
      </div>
      <div class="grammar-question-card">
        <div class="grammar-question-tag">${meta.icon} ${meta.label}</div>
        <div class="grammar-question-text">${qHtml}</div>
        ${body}
        ${explain}
      </div>
    </div>`;

  if (!answered && !isMcq) {
    const inp = document.getElementById('colTextInput');
    if (inp) { try { inp.focus(); } catch (e) {} }  // synchronous: keeps the tap gesture so the mobile keyboard opens
  }
}

function answerCollocChoice(i) {
  const st = _colQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  st.answers[st.idx] = { choice: i, value: q.options[i], isCorrect: i === q.correct };
  renderCollocQuestion();
}

function submitCollocText() {
  const st = _colQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  const inp = document.getElementById('colTextInput');
  const raw = inp ? inp.value : '';
  st.answers[st.idx] = { value: raw.trim(), isCorrect: _colAnswerCorrect(raw, q) };
  renderCollocQuestion();
}

function nextCollocQuestion() {
  const st = _colQuiz;
  if (!st) return;
  if (st.idx + 1 < st.questions.length) { st.idx++; renderCollocQuestion(); }
  else finishCollocPractice();
}

function finishCollocPractice() {
  const st = _colQuiz;
  if (!st) return;
  const total = st.questions.length;
  let score = 0;
  const wrong = [];
  st.questions.forEach((q, i) => {
    const a = st.answers[i];
    if (a && a.isCorrect) score++;
    else wrong.push(q);
  });
  const pct = total ? Math.round(score / total * 100) : 0;

  // Shared systems: coins, streak, history, server sync (see feature-sync tests).
  const coinsEarned = score * 5;
  if (typeof appState !== 'undefined' && appState) {
    appState.coins = (appState.coins || 0) + coinsEarned;
    if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }
    if (!Array.isArray(appState.collocHistory)) appState.collocHistory = [];
    let date = 0;
    try { date = Date.now(); } catch (e) {}
    appState.collocHistory.unshift({ score, total, date });
    if (appState.collocHistory.length > 300) appState.collocHistory.length = 300;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      try { saveUserData(currentUser, appState); } catch (e) {}
    }
  }
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  const twrap = (s) => (typeof tapwordsWrap === 'function') ? tapwordsWrap(s) : colEsc(s);
  const reviewHtml = wrong.map(q => `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${twrap(q.q)}</div>
        <div class="grammar-review-a">✅ <b>${twrap(q.answer)}</b> — ${colEsc(q.vi)}</div>
      </div>`).join('');

  const screen = document.getElementById('phrasesScreen');
  if (screen) {
    screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderPhrasesHome()">‹</button>
        <span class="grammar-quiz-progress">${pct === 100 ? '⭐' : pct >= 60 ? '✅' : '📝'} Collocation · ${score}/${total} (${pct}%)</span>
      </div>
      <div class="unit-reward-card">
        <div class="unit-reward-coins">${coinsEarned ? `+${coinsEarned} 🪙` : '0 🪙'}</div>
        <div class="unit-reward-total">Bạn có ${(typeof appState !== 'undefined' && appState && appState.coins) || 0} 🪙</div>
        ${typeof showPetShop === 'function' ? `<button class="unit-reward-shop" onclick="showPetShop()">🛒 Mua đồ ăn cho cún 🐶</button>` : ''}
      </div>
      <div class="phrases-section-title">${wrong.length ? 'Câu cần xem lại · ' + wrong.length : 'Perfect! 🎉'}</div>
      ${reviewHtml}
      <button class="phrases-cta-secondary phrases-review-btn" onclick="startCollocPractice(${total})">🔁 Practice again</button>
    </div>`;
  }
  _colQuiz = null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    collocBank, renderCollocHome, collocLessonHTML, startCollocPractice,
    answerCollocChoice, submitCollocText, nextCollocQuestion, finishCollocPractice,
    isCollocActive, abandonCollocPractice,
    _colNorm, _colAnswerCorrect, _colLetterHint,
  };
}
