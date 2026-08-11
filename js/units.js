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

// ---- the wrong-word drill ----
// Every word missed in a unit practice is owed back before a new unit can be
// started. Getting a word wrong and moving straight on to a fresh unit is how
// a child collects a long tail of words they never actually learned.
//
// Stored as plain `en` strings on appState (NOT whole word objects): the bank
// stays the single source of the Vietnamese and the emoji, so a wording fix in
// units-data.js reaches an owed word too. It PERSISTS, so closing the app is
// not a way out — and because that could otherwise strand a child on a word
// they cannot spell, the drill always offers the answer (see the 👁 button).
function unitsRetryList() {
  const raw = (typeof appState !== 'undefined' && appState && Array.isArray(appState.unitsRetry))
    ? appState.unitsRetry : [];
  const bank = unitsBank();
  const out = [], seen = Object.create(null);
  for (const en of raw) {
    const key = String(en || '').toLowerCase();
    if (!key || seen[key]) continue;
    // A word deleted from the bank must not wedge the drill shut forever.
    const w = bank.find(x => String(x.en).toLowerCase() === key);
    if (w) { out.push(w); seen[key] = 1; }
  }
  return out;
}
function unitsRetryCount() { return unitsRetryList().length; }

function _unitsRetrySave(words) {
  if (typeof appState === 'undefined' || !appState) return;
  appState.unitsRetry = words.map(w => w.en);
  if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    try { saveUserData(currentUser, appState); } catch (e) {}
  }
}
function _unitsRetryAdd(words) {
  const merged = unitsRetryList().slice();
  const have = Object.create(null);
  merged.forEach(w => { have[String(w.en).toLowerCase()] = 1; });
  (words || []).forEach(w => {
    const k = String(w && w.en || '').toLowerCase();
    if (k && !have[k]) { merged.push(w); have[k] = 1; }
  });
  _unitsRetrySave(merged);
}
function _unitsRetryClear(en) {
  const k = String(en || '').toLowerCase();
  _unitsRetrySave(unitsRetryList().filter(w => String(w.en).toLowerCase() !== k));
}

// ---- Grade 4 view: one card per unit, with word count + best score ----
// ---- mastery ----
// Ten perfect 10/10 runs retires a unit. The point is to stop a child grinding
// the one unit they already know for easy coins: once it is mastered the card
// locks and the remaining units are the only way forward. Mix stays open
// forever, so there is always something to practise.
const UNIT_MASTERY_TARGET = 10;

function unitPerfectCount(unit, history) {
  const hist = history || ((typeof appState !== 'undefined' && appState && appState.unitsHistory) || []);
  let n = 0;
  for (const h of hist) {
    if (!h || String(h.unit) !== String(unit)) continue;
    if (h.total > 0 && h.score === h.total) n++;
  }
  return n;
}

// Mix is deliberately never mastered: it draws from every unit, so retiring it
// would leave a fully-mastered child with nothing to do.
function isUnitMastered(unit, history) {
  if (String(unit) === 'mix') return false;
  return unitPerfectCount(unit, history) >= UNIT_MASTERY_TARGET;
}

function renderUnitsBar() {
  const bar = document.getElementById('unitsBar');
  if (!bar) return;
  bar.style.display = '';

  // Words owed from an earlier practice lock every unit. A disabled card with
  // no explanation reads as a broken app, so the banner says what is owed and
  // is itself the way to clear it.
  const owed = unitsRetryCount();

  // Best score per unit from practice history
  const best = {};
  ((typeof appState !== 'undefined' && appState && appState.unitsHistory) || []).forEach(h => {
    if (!h.total) return;
    const p = Math.round((h.score / h.total) * 100);
    if (!(h.unit in best) || p > best[h.unit]) best[h.unit] = p;
  });

  const owedBanner = owed ? `
    <div class="unit-owed-banner locked">
      <div class="unit-owed-text">✍️ Bé có <b>${owed} từ sai</b> cần gõ lại trước khi học Unit mới.</div>
      <button class="unit-owed-btn" onclick="startUnitRetry()">Luyện ngay →</button>
    </div>` : '';

  const mixBest = best['mix'];
  const mixCard = `
    <button class="g4-card g4-mix-card ${owed ? 'locked' : ''}" ${owed ? 'disabled aria-disabled="true"' : ''}
            onclick="startUnitPractice('mix')">
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
    const perfect = unitPerfectCount(u);
    const mastered = isUnitMastered(u);
    const locked = mastered || !!owed;
    return `
    <button class="g4-card ${mastered ? 'mastered' : ''} ${owed && !mastered ? 'locked' : ''}"
            ${locked ? 'disabled aria-disabled="true"' : ''}
            onclick="startUnitPractice(${u})">
      <div class="g4-card-top">
        <span class="g4-card-unit">${mastered ? '👑 ' : ''}Unit ${u}</span>
        ${mastered
          ? '<span class="g4-card-best mastered">Thành thạo</span>'
          : (b !== undefined ? `<span class="g4-card-best ${b >= 80 ? 'good' : ''}">${b >= 100 ? '⭐' : ''}${b}%</span>` : '')}
      </div>
      <div class="g4-card-emojis">${pics}</div>
      ${mastered
        ? `<div class="g4-card-meta">Đã đạt ${UNIT_MASTERY_TARGET} lần 10/10 — giỏi lắm! 🎉</div>`
        : `<div class="g4-card-meta">${words.length} từ vựng</div>
           <div class="g4-mastery">
             <i style="width:${Math.round(perfect / UNIT_MASTERY_TARGET * 100)}%"></i>
           </div>
           <div class="g4-mastery-label">⭐ ${perfect}/${UNIT_MASTERY_TARGET} lần 10/10</div>`}
    </button>`;
  }).join('');

  bar.innerHTML = `${owedBanner}<div class="g4-grid">${mixCard}${cards}</div>`;
}

// ---- celebration reward card (shared with collocation.js) ----
// Confetti + popping coins + a cheerful message, to make finishing feel
// like a small party and keep the student motivated.
// The card itself lives in petcheer.js (shared by every tab): congrats +
// coins + the dog's hunger, today's food wish and one-tap feeding.
function rewardCelebrationHTML(score, total, coinsEarned) {
  if (typeof petRewardCardHTML === 'function') return petRewardCardHTML(score, total, coinsEarned);
  return `<div class="unit-reward-card"><div class="unit-reward-coins">+${coinsEarned} 🪙</div></div>`;
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
  // Words missed earlier are owed back BEFORE a new unit. The cards are
  // disabled while anything is owed, but the rule lives here too: a stale DOM
  // node, a queued tap or the "practise again" button on an old results screen
  // must not walk past it.
  if (unitsRetryCount() > 0) {
    if (typeof showToast === 'function') {
      showToast('✍️ Luyện lại ' + unitsRetryCount() + ' từ sai trước đã nhé!');
    }
    startUnitRetry();
    return;
  }
  // The card is disabled, but a stale DOM node or a queued tap must not slip
  // through — the rule lives here, not only in the markup.
  if (isUnitMastered(unit)) {
    if (typeof showToast === 'function') showToast('👑 Unit này bé đã thành thạo rồi!');
    return;
  }
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

// ---- the drill screen ----
// Deliberately harder than the unit practice it follows: no letter gaps, the
// WHOLE word is typed. A word you can only finish from st__ent is not a word
// you know yet, and these are the ones already missed once.
//
// The 👁 button is the safety valve that makes a hard gate fair: it shows the
// word, and shows it again hidden on a second tap, so a child who genuinely
// cannot recall it can look, hide, and type it from memory a moment later.
// Without it a persisted gate could trap them on a single word.
let _unitRetryQuiz = null;   // { queue:[w], idx, revealed, answered, fixed, missed }

function startUnitRetry() {
  const owed = unitsRetryList();
  if (!owed.length) { if (typeof renderTopicsHome === 'function') renderTopicsHome(); return; }
  _unitQuiz = null;                                  // never both at once
  _unitRetryQuiz = { queue: owed.slice(), idx: 0, revealed: false, answered: null, fixed: 0, missed: 0 };
  ['topicsGrid', 'topicsReviewCard', 'topicsSrBanner', 'unitsBar', 'topicsSubTabs', 'topicsHistory'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  renderUnitRetryQuestion();
}
function abandonUnitRetry() { _unitRetryQuiz = null; }
function isUnitRetryActive() { return !!_unitRetryQuiz; }

// Hold to peek, release to hide.
//
// This does NOT re-render, and that is the whole point: a child half-way
// through typing who reaches for the hint would otherwise have the input
// rebuilt underneath them and lose what they had already typed. It touches the
// two nodes that change and nothing else.
function setUnitRetryReveal(on) {
  const st = _unitRetryQuiz;
  if (!st) return;
  st.revealed = !!on;
  const box = document.getElementById('unitRetryReveal');
  const btn = document.getElementById('unitPeekBtn');
  if (box) box.className = 'unit-retry-reveal' + (st.revealed ? '' : ' hidden');
  if (btn) {
    btn.setAttribute('aria-pressed', st.revealed ? 'true' : 'false');
    btn.className = 'unit-peek-btn' + (st.revealed ? ' on' : '');
  }
}

function renderUnitRetryQuestion() {
  const st = _unitRetryQuiz;
  const detail = document.getElementById('topicsDetail');
  if (!st || !detail) return;
  const done = st.answered;
  // While a result is on screen the word it belongs to is the one to show —
  // a correct answer has already been spliced out of the queue.
  const w = done ? done.w : st.queue[st.idx % st.queue.length];
  if (!w) { finishUnitRetry(); return; }

  const left = st.queue.length;
  const isNumberCard = /^[0-9:]+$/.test(w.emoji);
  const more = left > 0;

  const body = done
    // Same shape as the unit practice: your answer, then the right one, then
    // Next. The result belongs to the question that produced it, so it is
    // shown HERE and never carried onto the next word's screen.
    ? `<div class="wf-text-answer ${done.ok ? 'correct' : 'wrong'}">
         <span class="wf-text-answer-label">Bé gõ:</span>
         <span class="wf-text-answer-value">${done.value ? unitEsc(done.value) : '<em>(chưa gõ)</em>'}</span>
       </div>
       <div class="grammar-explanation ${done.ok ? 'correct' : 'wrong'}">
         <div class="phrases-vi">📘 <b>${typeof tapwordsWrap === 'function' ? tapwordsWrap(w.en) : unitEsc(w.en)}</b>
           <button class="unit-say-btn" onclick="_unitSpeak('${_unitSpeakAttr(w.en)}')" title="Nghe phát âm">🔊</button>
           — ${unitEsc(w.vi)}</div>
         <div>${done.ok
            ? '✅ Chính xác!'
            : '❌ Đáp án đúng: <b>' + unitEsc(w.en) + '</b> · bé sẽ gặp lại từ này'}</div>
       </div>
       <button class="grammar-next-btn" onclick="nextUnitRetryQuestion()">${more ? 'Next →' : 'Xong!'}</button>`
    : `<div class="unit-retry-peek">
         <button class="unit-peek-btn" id="unitPeekBtn" type="button" aria-pressed="false"
                 oncontextmenu="return false"
                 onmousedown="setUnitRetryReveal(true)" onmouseup="setUnitRetryReveal(false)"
                 onmouseleave="setUnitRetryReveal(false)"
                 ontouchstart="event.preventDefault(); setUnitRetryReveal(true)"
                 ontouchend="setUnitRetryReveal(false)" ontouchcancel="setUnitRetryReveal(false)"
                 onkeydown="setUnitRetryReveal(true)" onkeyup="setUnitRetryReveal(false)"
                 onblur="setUnitRetryReveal(false)">👁 Giữ để xem từ</button>
         <button class="unit-say-btn" onclick="_unitSpeak('${_unitSpeakAttr(w.en)}')" title="Nghe phát âm">🔊</button>
       </div>
       <div class="unit-retry-reveal hidden" id="unitRetryReveal">${unitEsc(w.en)}</div>
       <div class="wf-text-wrap">
         <input type="text" id="unitRetryInput" class="wf-text-input" enterkeyhint="go"
                placeholder="Gõ cả từ hoàn chỉnh…" autocomplete="off" autocapitalize="off" spellcheck="false"
                onkeydown="if(event.key==='Enter'){event.preventDefault();submitUnitRetryAnswer();}">
         <button class="wf-text-submit" onclick="submitUnitRetryAnswer()">Check</button>
       </div>`;

  detail.style.display = '';
  detail.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="abandonUnitRetry(); renderTopicsHome()">✕</button>
        <span class="grammar-quiz-progress">✍️ Luyện từ sai · còn ${left} từ</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill"
             style="width:${Math.round(st.fixed / Math.max(1, st.fixed + left) * 100)}%"></div></div>
      </div>
      <div class="grammar-question-card unit-q-card">
        <div class="unit-q-emoji ${isNumberCard ? 'unit-q-number' : ''}">${w.emoji}</div>
        <div class="unit-q-vi">${unitEsc(w.vi)}</div>
        ${body}
      </div>
    </div>`;

  if (!done) {
    const inp = document.getElementById('unitRetryInput');
    if (inp) { try { inp.focus(); } catch (e) {} }
  }
}

function submitUnitRetryAnswer() {
  const st = _unitRetryQuiz;
  if (!st || st.answered || !st.queue.length) return;   // one answer per word
  const pos = st.idx % st.queue.length;
  const w = st.queue[pos];
  const inp = document.getElementById('unitRetryInput');
  const raw = inp ? inp.value : '';
  const ok = _unitAnswerCorrect(raw, w.en);

  st.answered = { w, ok, value: String(raw).trim() };
  _unitSpeak(w.en);
  if (typeof petCheerAnswer === 'function') petCheerAnswer(ok);

  if (ok) {
    st.queue.splice(pos, 1);          // owed no more
    st.fixed++;
    _unitsRetryClear(w.en);           // persist immediately: progress survives a reload
    _unitBumpWordLevel(w.en, true);
  } else {
    st.missed++;
    // Send it to the back rather than pinning the child on one word — they
    // meet it again this session, just not immediately.
    st.queue.push(st.queue.splice(pos, 1)[0]);
  }
  if (st.idx >= st.queue.length) st.idx = 0;
  renderUnitRetryQuestion();          // shows the result for the word just answered
}

// Clearing the result is what moves on — so a result is never still on screen
// when the next word appears.
function nextUnitRetryQuestion() {
  const st = _unitRetryQuiz;
  if (!st) return;
  st.answered = null;
  st.revealed = false;                // the next word starts hidden again
  if (!st.queue.length) { finishUnitRetry(); return; }
  renderUnitRetryQuestion();
}

function finishUnitRetry() {
  const st = _unitRetryQuiz;
  const fixed = st ? st.fixed : 0;
  _unitRetryQuiz = null;
  const detail = document.getElementById('topicsDetail');
  if (!detail) return;
  detail.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderTopicsHome()">‹</button>
        <span class="grammar-quiz-progress">✅ Đã luyện xong ${fixed} từ</span>
      </div>
      <div class="unit-retry-done">
        <div class="unit-retry-done-emoji">🎉</div>
        <div class="unit-retry-done-title">Hết từ sai rồi!</div>
        <div class="unit-retry-done-sub">Bé có thể học Unit mới ngay bây giờ.</div>
      </div>
      <button class="phrases-cta-secondary phrases-review-btn" onclick="renderTopicsHome()">🏠 Chọn Unit mới</button>
    </div>`;
  if (typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
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
  if (typeof petCheerAnswer === 'function') petCheerAnswer(ok);
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

  // Coins: +5 per correct answer, plus any 5-in-a-row combo treats.
  const coinsEarned = score * 5 + (typeof petComboBonus === 'function' ? petComboBonus() : 0);
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

  // Owe every missed word back. Recorded here, after the score is banked, so a
  // child never loses coins they earned by also being told to practise.
  if (wrong.length) _unitsRetryAdd(wrong);
  const owed = unitsRetryCount();

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
      ${owed ? `<div class="unit-owed-banner">
          <b>❌ ${wrong.length} từ sai</b> trong bài này.
          Bé cần gõ lại <b>${owed} từ</b> trước khi học Unit mới.
        </div>` : ''}
      <div class="phrases-section-title">${wrong.length ? 'Từ cần học lại · ' + wrong.length : 'Perfect! 🎉'}</div>
      ${reviewHtml}
      ${owed
        ? `<button class="phrases-cta-secondary phrases-review-btn unit-retry-cta" onclick="startUnitRetry()">✍️ Luyện lại ${owed} từ sai</button>`
        : `<button class="phrases-cta-secondary phrases-review-btn" onclick="startUnitPractice(${typeof st.unit === 'number' ? st.unit : "'" + st.unit + "'"})">🔁 Practice ${_unitLabel(st.unit)} again</button>`}
    </div>`;
  fireRewardCelebration(coinsEarned, pct);
  _unitQuiz = null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    unitsBank, unitsList, buildUnitGap, pickUnitGapMode, _unitNormalize, _unitAnswerCorrect,
    UNIT_MASTERY_TARGET, unitPerfectCount, isUnitMastered,
    startUnitPractice, submitUnitAnswer, nextUnitQuestion, finishUnitPractice,
    isUnitPracticeActive, abandonUnitPractice, renderUnitsBar, renderUnitsHistory,
    unitsRetryList, unitsRetryCount, _unitsRetryAdd, _unitsRetryClear,
    startUnitRetry, submitUnitRetryAnswer, nextUnitRetryQuestion, finishUnitRetry,
    setUnitRetryReveal, isUnitRetryActive, abandonUnitRetry,
    modeForUnitLevel, _unitWordLevel, _unitBumpWordLevel,
    _unitPool, _unitLabel, _unitSpeak, _unitSpeakAttr,
  };
}
