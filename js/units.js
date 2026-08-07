// units.js — "Unit 1..12" picture-dictionary practice on the Topics tab.
// A chip row at the top of Topics opens a typed gap-fill practice: the app
// shows the picture (emoji) + Vietnamese meaning and a gapped word
// (st__ent / ch_cken / _ _ _ _ _), and the student types the FULL word.
// The number of missing letters is random per question: 4, 5 or the
// whole word. Data lives in js/units-data.js (UNIT_WORDS).

let _unitQuiz = null;   // { unit, questions:[{w, gapped, mode}], idx, answers:[] }

function unitsBank() {
  return (typeof UNIT_WORDS !== 'undefined') ? UNIT_WORDS : [];
}
function unitsList() {
  return [...new Set(unitsBank().map(w => w.unit))].sort((a, b) => a - b);
}

// 'mix' draws from every unit at once; numbers filter to one unit.
function _unitPool(unit) {
  const bank = unitsBank();
  return unit === 'mix' ? bank.slice() : bank.filter(w => w.unit === unit);
}
function _unitLabel(unit) {
  return unit === 'mix' ? '🎲 Mix' : 'Unit ' + unit;
}

// English pronunciation via the Web Speech API. Called from the Check
// button (a user gesture, so iOS allows it). Safe no-op where unsupported.
// Chrome/Android quirks handled here, or the voice goes mute after the
// first word: (1) an utterance with no live reference can be GC'd
// mid-speech, leaving the engine stuck "speaking" so later calls queue
// forever; (2) cancel() followed by speak() in the same tick swallows
// the new utterance; (3) the engine can wedge in a paused state.
let _unitUtt = null;                                   // GC guard (quirk 1)
function _unitSpeak(text) {
  try {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    const say = () => {
      const utt = new SpeechSynthesisUtterance(String(text));
      utt.lang = 'en-US';
      utt.rate = 0.85;                                 // a little slow for learners
      const voices = speechSynthesis.getVoices() || [];
      const v = voices.find(x => /^en[-_]/i.test(x.lang) && /Google|Samantha|Daniel|Karen/i.test(x.name))
        || voices.find(x => /^en[-_]/i.test(x.lang));
      if (v) utt.voice = v;
      utt.onend = utt.onerror = () => { if (_unitUtt === utt) _unitUtt = null; };
      _unitUtt = utt;
      try { speechSynthesis.resume(); } catch (e) {}   // un-wedge paused engine (quirk 3)
      speechSynthesis.speak(utt);
    };
    if (speechSynthesis.speaking || speechSynthesis.pending) {
      speechSynthesis.cancel();
      setTimeout(say, 80);                             // let cancel() flush first (quirk 2)
    } else {
      say();                                           // synchronous: keeps the iOS gesture unlock
    }
  } catch (e) {}
}
function _unitSpeakAttr(text) {
  return String(text).replace(/'/g, "\\'").replace(/"/g, '&quot;');
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
  // At least 4 missing letters (2-3 became too easy once the student knew
  // the words). Short words cap at all-but-first-letter automatically.
  const modes = [4, 4, 5, 5, 'full'];
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

// ---- Grade 4 view: one card per unit, with word count + best score ----
function renderUnitsBar() {
  const bar = document.getElementById('unitsBar');
  if (!bar) return;
  bar.style.display = '';

  // Best score per unit from practice history
  const best = {};
  ((typeof appState !== 'undefined' && appState && appState.unitsHistory) || []).forEach(h => {
    if (!h.total) return;
    const p = Math.round((h.score / h.total) * 100);
    if (!(h.unit in best) || p > best[h.unit]) best[h.unit] = p;
  });

  const mixBest = best['mix'];
  const mixCard = `
    <button class="g4-card g4-mix-card" onclick="startUnitPractice('mix')">
      <div class="g4-card-top">
        <span class="g4-card-unit">🎲 Mix · 12 Units</span>
        ${mixBest !== undefined ? `<span class="g4-card-best ${mixBest >= 80 ? 'good' : ''}">${mixBest >= 100 ? '⭐' : ''}${mixBest}%</span>` : ''}
      </div>
      <div class="g4-card-meta">10 từ ngẫu nhiên từ tất cả các Unit</div>
    </button>`;

  const cards = unitsList().map(u => {
    const words = _unitPool(u);
    // Prefer real emoji for the preview (skip digit "pictures")
    const pics = words.map(w => w.emoji).filter(e => !/^[0-9:]+$/.test(e)).slice(0, 3).join(' ');
    const b = best[u];
    return `
    <button class="g4-card" onclick="startUnitPractice(${u})">
      <div class="g4-card-top">
        <span class="g4-card-unit">Unit ${u}</span>
        ${b !== undefined ? `<span class="g4-card-best ${b >= 80 ? 'good' : ''}">${b >= 100 ? '⭐' : ''}${b}%</span>` : ''}
      </div>
      <div class="g4-card-emojis">${pics}</div>
      <div class="g4-card-meta">${words.length} từ vựng</div>
    </button>`;
  }).join('');

  bar.innerHTML = `<div class="g4-grid">${mixCard}${cards}</div>`;
}

// ---- celebration reward card (shared with collocation.js) ----
// Confetti + popping coins + a cheerful message, to make finishing feel
// like a small party and keep the student motivated.
function rewardCelebrationHTML(score, total, coinsEarned) {
  const pct = total ? Math.round((score / total) * 100) : 0;
  const msg = pct === 100 ? 'PERFECT! Xuất sắc! 🏆'
    : pct >= 80 ? 'Tuyệt vời! 🌟'
    : pct >= 60 ? 'Làm tốt lắm! 👍'
    : 'Cố lên, luyện thêm nhé! 💪';
  const burst = ['🪙', '🎉', '⭐', '🪙', '🎊', '🪙'].map((e, i) =>
    `<span class="reward-burst-item" style="left:${8 + i * 15}%; animation-delay:${(i * 0.12).toFixed(2)}s">${e}</span>`).join('');
  return `
      <div class="unit-reward-card reward-pop">
        <div class="reward-burst">${burst}</div>
        <div class="reward-congrats">🎉 ${msg}</div>
        <div class="unit-reward-coins reward-coins-pop">${coinsEarned ? `+${coinsEarned} 🪙` : '0 🪙'}</div>
        <div class="unit-reward-total">Bạn có ${(typeof appState !== 'undefined' && appState && appState.coins) || 0} 🪙</div>
        ${typeof showPetShop === 'function' ? `<button class="unit-reward-shop" onclick="showPetShop()">🛒 Mua đồ ăn cho cún 🐶</button>` : ''}
      </div>`;
}
function fireRewardCelebration(coinsEarned, pct) {
  if (!coinsEarned || typeof createConfetti !== 'function') return;
  try {
    createConfetti();
    if (pct === 100 && typeof setTimeout === 'function') setTimeout(() => { try { createConfetti(); } catch (e) {} }, 900);
  } catch (e) {}
}

// ---- History view: recent unit-practice sessions + streak ----
// Everything here is already uploaded to the admin dashboard by
// EngAuth.syncNow() (type 'lesson'), which runs on every finish.
function renderUnitsHistory() {
  const el = document.getElementById('topicsHistory');
  if (!el) return;
  el.style.display = '';
  const state = (typeof appState !== 'undefined' && appState) ? appState : {};
  const hist = state.unitsHistory || [];
  const streak = state.streak || 0;

  if (!hist.length) {
    el.innerHTML = `
      <div class="uh-streak">🔥 Chuỗi học: <b>${streak}</b> ngày</div>
      <div class="uh-empty">Chưa có lịch sử. Hãy luyện tập một Unit nhé! 📗</div>`;
    return;
  }

  const rows = hist.slice(0, 50).map(h => {
    const pct = h.total ? Math.round((h.score / h.total) * 100) : 0;
    const icon = pct === 100 ? '⭐' : pct >= 60 ? '✅' : '📝';
    let when = '';
    try {
      when = new Date(h.date).toLocaleString([], { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch (e) {}
    return `
    <div class="uh-item">
      <span class="uh-icon">${icon}</span>
      <span class="uh-name">${_unitLabel(h.unit)}</span>
      <span class="uh-score ${pct >= 80 ? 'good' : ''}">${h.score}/${h.total} · ${pct}%</span>
      <span class="uh-date">${when}</span>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="uh-streak">🔥 Chuỗi học: <b>${streak}</b> ngày</div>
    <div class="uh-list">${rows}</div>
    <div class="uh-sync-note">☁️ Lịch sử tự động đồng bộ với admin</div>`;
}

// ---- practice flow (renders inside #topicsDetail) ----
function startUnitPractice(unit) {
  const pool = _unitPool(unit);
  if (!pool.length) return;
  const shuffled = pool.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const words = shuffled.slice(0, Math.min(10, shuffled.length));
  const questions = words.map(w => {
    // Random gap count per question (4, 5 letters or the whole word),
    // like the textbook's st__ent / ch_cken style. Per-word levels are still
    // tracked (see _unitBumpWordLevel) for possible future use.
    const mode = pickUnitGapMode();
    return { w, mode, gap: buildUnitGap(w.en, mode) };
  });
  _unitQuiz = { unit, questions, idx: 0, answers: new Array(questions.length).fill(null) };

  // Hide the normal Topics home pieces while practicing
  ['topicsGrid', 'topicsReviewCard', 'topicsSrBanner', 'unitsBar', 'topicsSubTabs', 'topicsHistory'].forEach(id => {
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
        <div class="phrases-vi">📘 <b>${typeof tapwordsWrap === 'function' ? tapwordsWrap(q.w.en) : unitEsc(q.w.en)}</b>
          <button class="unit-say-btn" onclick="_unitSpeak('${_unitSpeakAttr(q.w.en)}')" title="Nghe phát âm">🔊</button>
          — ${unitEsc(q.w.vi)}</div>
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
        <span class="grammar-quiz-progress">${_unitLabel(st.unit)} · ${st.idx + 1}/${total}</span>
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
  _unitSpeak(q.w.en);          // pronounce the word so the student hears it
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
    // Count today toward the daily streak, like lessons and grammar do.
    if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      try { saveUserData(currentUser, appState); } catch (e) {}
    }
  }
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  const detail = document.getElementById('topicsDetail');
  const reviewHtml = wrong.map(w => `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${w.emoji} <b>${typeof tapwordsWrap === 'function' ? tapwordsWrap(w.en) : unitEsc(w.en)}</b>
          <button class="unit-say-btn" onclick="_unitSpeak('${_unitSpeakAttr(w.en)}')" title="Nghe phát âm">🔊</button>
          — ${unitEsc(w.vi)}</div>
      </div>`).join('');

  detail.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderTopicsHome()">‹</button>
        <span class="grammar-quiz-progress">${pct === 100 ? '⭐' : pct >= 60 ? '✅' : '📝'} ${_unitLabel(st.unit)} · ${score}/${total} (${pct}%)</span>
      </div>
      ${rewardCelebrationHTML(score, total, coinsEarned)}
      <div class="phrases-section-title">${wrong.length ? 'Từ cần học lại · ' + wrong.length : 'Perfect! 🎉'}</div>
      ${reviewHtml}
      <button class="phrases-cta-secondary phrases-review-btn" onclick="startUnitPractice(${typeof st.unit === 'number' ? st.unit : "'" + st.unit + "'"})">🔁 Practice ${_unitLabel(st.unit)} again</button>
    </div>`;
  fireRewardCelebration(coinsEarned, pct);
  _unitQuiz = null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    unitsBank, unitsList, buildUnitGap, pickUnitGapMode, _unitNormalize, _unitAnswerCorrect,
    startUnitPractice, submitUnitAnswer, nextUnitQuestion, finishUnitPractice,
    isUnitPracticeActive, abandonUnitPractice, renderUnitsBar, renderUnitsHistory,
    modeForUnitLevel, _unitWordLevel, _unitBumpWordLevel,
    _unitPool, _unitLabel, _unitSpeak, _unitSpeakAttr,
  };
}
