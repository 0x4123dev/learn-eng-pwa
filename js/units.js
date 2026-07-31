// units.js — "Unit 1..12" picture-dictionary practice on the Topics tab.
// A chip row at the top of Topics opens a typed gap-fill practice: the app
// shows the picture (emoji) + Vietnamese meaning and a gapped word
// (st__ent / ch_cken / _ _ _ _ _), and the student types the FULL word.
// The number of missing letters is random per question: 1, 2, 3 or the
// whole word. Data lives in js/units-data.js (UNIT_WORDS).

let _unitQuiz = null;   // { unit, questions:[{w, gapped, mode}], idx, answers:[] }

function unitsBank() {
  return (typeof UNIT_WORDS !== 'undefined') ? UNIT_WORDS : [];
}
function unitsList() {
  return [...new Set(unitsBank().map(w => w.unit))].sort((a, b) => a - b);
}

function unitEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- gap engine (pure; rand injectable for tests) ----
// Returns { display:[{ch, blank}], nBlanks } for a word and a mode (1|2|3|'full').
// Only letters are blanked; the first letter stays visible unless mode==='full'.
function buildUnitGap(en, mode, rand) {
  const rnd = rand || Math.random;
  const chars = en.split('');
  const letterIdx = [];
  chars.forEach((c, i) => { if (/[a-zA-Z]/.test(c)) letterIdx.push(i); });

  let blankSet;
  if (mode === 'full') {
    blankSet = new Set(letterIdx);
  } else {
    const pool = letterIdx.slice(1);              // keep the first letter as a hint
    const n = Math.max(1, Math.min(mode, pool.length ? pool.length : 1));
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    blankSet = new Set(shuffled.slice(0, n));
    if (blankSet.size === 0 && letterIdx.length) blankSet = new Set([letterIdx[letterIdx.length - 1]]);
  }

  return {
    display: chars.map((c, i) => ({ ch: c, blank: blankSet.has(i) })),
    nBlanks: blankSet.size,
  };
}

function pickUnitGapMode(rand) {
  const rnd = rand || Math.random;
  const modes = [1, 1, 2, 2, 3, 'full'];      // 1–2 letters most common, like the book
  return modes[Math.floor(rnd() * modes.length)];
}

// Adaptive difficulty: recognition before production. Each word has a level
// 0..3 stored per user; new words show almost complete (1 blank = learning),
// and every correct answer raises the level next time (1 → 2 → 3 → full word),
// while a mistake drops it back. This turns gap-typing into a scaffolded
// learn-then-recall ladder instead of a random challenge.
function _unitWordLevel(en) {
  if (typeof appState === 'undefined' || !appState) return 0;
  if (!appState.unitWordLevels) appState.unitWordLevels = {};
  const l = appState.unitWordLevels[en.toLowerCase()];
  return (typeof l === 'number') ? Math.max(0, Math.min(3, l)) : 0;
}
function _unitBumpWordLevel(en, correct) {
  if (typeof appState === 'undefined' || !appState) return;
  if (!appState.unitWordLevels) appState.unitWordLevels = {};
  const key = en.toLowerCase();
  const cur = _unitWordLevel(en);
  appState.unitWordLevels[key] = correct ? Math.min(3, cur + 1) : Math.max(0, cur - 1);
}
function modeForUnitLevel(level) {
  return level >= 3 ? 'full' : (level + 1);   // L0→1 blank, L1→2, L2→3, L3→full
}

// Lenient grading: case-insensitive; dots, hyphens and spaces are all optional
// ("PE" ≡ "P.E.", "twenty one" ≡ "twenty-one", "policeofficer" ≡ "police officer").
function _unitNormalize(s) {
  return String(s || '').toLowerCase().normalize('NFC')
    .replace(/[^a-z0-9]/g, '');
}
function _unitAnswerCorrect(input, en) {
  const u = _unitNormalize(input);
  return !!u && u === _unitNormalize(en);
}

// ---- chips bar on the Topics home ----
function renderUnitsBar() {
  const bar = document.getElementById('unitsBar');
  if (!bar) return;
  bar.style.display = '';
  const chips = unitsList().map(u =>
    `<button class="unit-chip" onclick="startUnitPractice(${u})">Unit ${u}</button>`
  ).join('');
  bar.innerHTML = `
    <div class="units-bar-title">📕 Picture dictionary — luyện từ vựng theo Unit</div>
    <div class="units-bar-chips">${chips}</div>`;
}

// ---- practice flow (renders inside #topicsDetail) ----
function startUnitPractice(unit) {
  const pool = unitsBank().filter(w => w.unit === unit);
  if (!pool.length) return;
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const words = shuffled.slice(0, Math.min(10, shuffled.length));
  const questions = words.map(w => {
    // Random gap count per question (1, 2, 3 letters or the whole word),
    // like the textbook's st__ent / ch_cken style. Per-word levels are still
    // tracked (see _unitBumpWordLevel) for possible future use.
    const mode = pickUnitGapMode();
    return { w, mode, gap: buildUnitGap(w.en, mode) };
  });
  _unitQuiz = { unit, questions, idx: 0, answers: new Array(questions.length).fill(null) };

  // Hide the normal Topics home pieces while practicing
  ['topicsGrid', 'topicsReviewCard', 'topicsSrBanner', 'unitsBar'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  renderUnitQuestion();
}

function abandonUnitPractice() { _unitQuiz = null; }
function isUnitPracticeActive() { return !!_unitQuiz; }

function _unitGapHTML(gap, revealed) {
  return '<div class="unit-gap">' + gap.display.map(d => {
    if (d.ch === ' ') return '<span class="unit-gap-space"></span>';
    if (!/[a-zA-Z]/.test(d.ch)) return `<span class="unit-gap-ch fixed">${unitEsc(d.ch)}</span>`;
    if (d.blank && !revealed) return '<span class="unit-gap-ch blank">_</span>';
    return `<span class="unit-gap-ch ${d.blank ? 'was-blank' : ''}">${unitEsc(d.ch)}</span>`;
  }).join('') + '</div>';
}

function renderUnitQuestion() {
  const st = _unitQuiz;
  const detail = document.getElementById('topicsDetail');
  if (!st || !detail) return;
  const q = st.questions[st.idx];
  const ans = st.answers[st.idx];
  const answered = ans !== null;
  const total = st.questions.length;
  const isNumberCard = /^[0-9:]+$/.test(q.w.emoji);

  let body;
  if (answered) {
    body = `<div class="wf-text-answer ${ans.isCorrect ? 'correct' : 'wrong'}">
        <span class="wf-text-answer-label">Your answer:</span>
        <span class="wf-text-answer-value">${ans.value ? unitEsc(ans.value) : '<em>(blank)</em>'}</span>
      </div>
      <div class="grammar-explanation ${ans.isCorrect ? 'correct' : 'wrong'}">
        <div class="phrases-vi">📘 <b>${unitEsc(q.w.en)}</b> — ${unitEsc(q.w.vi)}</div>
        <div>${ans.isCorrect ? '✅ Chính xác!' : '❌ Đáp án đúng: <b>' + unitEsc(q.w.en) + '</b>'}</div>
      </div>
      <button class="grammar-next-btn" onclick="nextUnitQuestion()">${st.idx + 1 < total ? 'Next →' : 'See results'}</button>`;
  } else {
    body = `<div class="wf-text-wrap">
        <input type="text" id="unitTextInput" class="wf-text-input" autofocus enterkeyhint="go" placeholder="Gõ cả từ hoàn chỉnh…"
               autocomplete="off" autocapitalize="off" spellcheck="false"
               onkeydown="if(event.key==='Enter'){event.preventDefault();submitUnitAnswer();}">
        <button class="wf-text-submit" onclick="submitUnitAnswer()">Check</button>
      </div>`;
  }

  detail.style.display = '';
  detail.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonUnitPractice(); renderTopicsHome()">✕</button>
        <span class="grammar-quiz-progress">Unit ${st.unit} · ${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round((st.idx / total) * 100)}%"></div></div>
      </div>
      <div class="grammar-question-card unit-q-card">
        <div class="unit-q-emoji ${isNumberCard ? 'unit-q-number' : ''}">${q.w.emoji}</div>
        <div class="unit-q-vi">${unitEsc(q.w.vi)}</div>
        ${_unitGapHTML(q.gap, answered)}
        ${body}
      </div>
    </div>`;

  if (!answered) {
    const inp = document.getElementById('unitTextInput');
    if (inp) { try { inp.focus(); } catch (e) {} }  // synchronous: keeps the tap gesture so the mobile keyboard opens
  }
}

function submitUnitAnswer() {
  const st = _unitQuiz;
  if (!st || st.answers[st.idx] !== null) return;
  const q = st.questions[st.idx];
  const inp = document.getElementById('unitTextInput');
  const raw = inp ? inp.value : '';
  const ok = _unitAnswerCorrect(raw, q.w.en);
  st.answers[st.idx] = { value: raw.trim(), isCorrect: ok };
  _unitBumpWordLevel(q.w.en, ok);
  renderUnitQuestion();
}

function nextUnitQuestion() {
  const st = _unitQuiz;
  if (!st) return;
  if (st.idx + 1 < st.questions.length) { st.idx++; renderUnitQuestion(); }
  else finishUnitPractice();
}

function finishUnitPractice() {
  const st = _unitQuiz;
  if (!st) return;
  const total = st.questions.length;
  let score = 0;
  const wrong = [];
  st.questions.forEach((q, i) => {
    const a = st.answers[i];
    if (a && a.isCorrect) score++;
    else wrong.push(q.w);
  });
  const pct = total ? Math.round((score / total) * 100) : 0;

  // Coins: +5 per correct answer (matches every other practice type).
  const coinsEarned = score * 5;
  if (typeof appState !== 'undefined' && appState) {
    appState.coins = (appState.coins || 0) + coinsEarned;
    if (!Array.isArray(appState.unitsHistory)) appState.unitsHistory = [];
    let date = 0;
    try { date = Date.now(); } catch (e) {}
    appState.unitsHistory.unshift({ unit: st.unit, score, total, date });
    if (appState.unitsHistory.length > 300) appState.unitsHistory.length = 300;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      try { saveUserData(currentUser, appState); } catch (e) {}
    }
  }
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  const detail = document.getElementById('topicsDetail');
  const reviewHtml = wrong.map(w => `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${w.emoji} <b>${unitEsc(w.en)}</b> — ${unitEsc(w.vi)}</div>
      </div>`).join('');

  detail.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderTopicsHome()">‹</button>
        <span class="grammar-quiz-progress">${pct === 100 ? '⭐' : pct >= 60 ? '✅' : '📝'} Unit ${st.unit} · ${score}/${total} (${pct}%)</span>
      </div>
      ${coinsEarned ? `<div class="grammar-result-coins" style="text-align:center;margin:6px 0 2px;">+${coinsEarned} 🪙 earned</div>` : ''}
      <div class="phrases-section-title">${wrong.length ? 'Từ cần học lại · ' + wrong.length : 'Perfect! 🎉'}</div>
      ${reviewHtml}
      <button class="phrases-cta-secondary phrases-review-btn" onclick="startUnitPractice(${st.unit})">🔁 Practice Unit ${st.unit} again</button>
    </div>`;
  _unitQuiz = null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    unitsBank, unitsList, buildUnitGap, pickUnitGapMode, _unitNormalize, _unitAnswerCorrect,
    startUnitPractice, submitUnitAnswer, nextUnitQuestion, finishUnitPractice,
    isUnitPracticeActive, abandonUnitPractice, renderUnitsBar,
    modeForUnitLevel, _unitWordLevel, _unitBumpWordLevel,
  };
}
