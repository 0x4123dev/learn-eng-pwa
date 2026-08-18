// units.js — picture-dictionary practice on the Topics → Grade 4 tab.
// A card grid opens a typed gap-fill practice: the app shows the picture
// (emoji) + Vietnamese meaning and a gapped word (st__ent / ch_cken /
// _ _ _ _ _), and the student types the FULL word. The number of missing
// letters is random per question: 4, 5 or the whole word.
//
// Grade 4 is split into three word sets, each with its own units and its own
// Mix:
//   pre — the picture-dictionary units the app started with (12 units)
//   hk1 — Tiếng Anh 4 Global Success, Tập một: the book's ten units merged
//         two-by-two into five units carrying the whole Wordlist from
//         pages 78-80 (js/units-hk1-data.js)
//   hk2 — Tập hai, not written yet ("sắp có")
//
// A unit is addressed by a KEY. 'pre' keeps its bare keys (3, 'mix') so every
// history row, best score and mastery count written before the split still
// counts; the newer sets prefix theirs ('hk1-3', 'hk1-mix').

let _unitQuiz = null;   // { unit, questions:[{w, gapped, mode}], idx, answers:[] }

const UNIT_SETS = [
  { id: 'pre', label: '📘 Pre', name: 'Pre', sub: 'Từ điển tranh · 12 Unit' },
  { id: 'hk1', label: '📗 HK1', name: 'HK1', sub: 'Global Success Tập 1 · Bài 1-10' },
  { id: 'hk2', label: '📕 HK2', name: 'HK2', sub: 'Global Success Tập 2', soon: true },
];

// Which set the cards are showing. Stored per user so the tab reopens where
// the child left it; HK1 is the default because that is the book in use.
let _unitSetFallback = null;
function currentUnitSet() {
  let saved = null;
  if (typeof appState !== 'undefined' && appState && appState.unitsSet) saved = appState.unitsSet;
  else saved = _unitSetFallback;
  return UNIT_SETS.some(s => s.id === saved) ? saved : 'hk1';
}
function switchUnitSet(set) {
  if (!UNIT_SETS.some(s => s.id === set)) return;
  _unitSetFallback = set;
  if (typeof appState !== 'undefined' && appState) {
    appState.unitsSet = set;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      try { saveUserData(currentUser, appState); } catch (e) {}
    }
  }
  if (typeof renderUnitsBar === 'function') renderUnitsBar();
}

function unitsBank(set) {
  const s = set || currentUnitSet();
  if (s === 'hk1') return (typeof UNIT_WORDS_HK1 !== 'undefined') ? UNIT_WORDS_HK1 : [];
  if (s === 'hk2') return [];
  return (typeof UNIT_WORDS !== 'undefined') ? UNIT_WORDS : [];
}
// Every word the tab knows, across all sets. Used where a word arrives with no
// set attached — an owed word from an earlier practice, a history row.
function unitsAllWords() {
  return UNIT_SETS.reduce((all, s) => all.concat(unitsBank(s.id)), []);
}
function unitsList(set) {
  return [...new Set(unitsBank(set).map(w => w.unit))].sort((a, b) => a - b);
}
function unitTitle(set, unit) {
  if (set === 'hk1' && typeof UNIT_HK1_TITLES !== 'undefined') return UNIT_HK1_TITLES[unit] || '';
  return '';
}
// HK1 units are renumbered 1..5, each merging two textbook units. The card
// says which pair it covers ("Bài 1-2") so a child can still find the lesson
// in the book.
function unitBooksLabel(set, unit) {
  if (set !== 'hk1' || typeof UNIT_HK1_BOOKS === 'undefined') return '';
  const b = UNIT_HK1_BOOKS[unit];
  if (!b || !b.length) return '';
  return 'Bài ' + (b.length > 1 ? b[0] + '-' + b[b.length - 1] : b[0]);
}

// ---- unit keys ----
// 'hk1-4' → { set:'hk1', unit:4 }; a bare 4 or 'mix' is the original 'pre' set.
function _unitKey(set, unit) {
  return (set && set !== 'pre') ? set + '-' + unit : unit;
}
function _unitParse(key) {
  const s = String(key);
  const m = s.match(/^(hk1|hk2)-(mix|\d+)$/);
  if (m) return { set: m[1], unit: m[2] === 'mix' ? 'mix' : Number(m[2]) };
  return { set: 'pre', unit: s === 'mix' ? 'mix' : Number(s) };
}
// The key as a JavaScript literal, for inline onclick handlers.
function _unitKeyArg(key) {
  return typeof key === 'number' ? String(key) : "'" + String(key).replace(/'/g, "\\'") + "'";
}

// 'mix' draws from every unit in its set at once; numbers filter to one unit.
function _unitPool(key) {
  const { set, unit } = _unitParse(key);
  const bank = unitsBank(set);
  return unit === 'mix' ? bank.slice() : bank.filter(w => w.unit === unit);
}
function _unitLabel(key) {
  const { set, unit } = _unitParse(key);
  const prefix = set === 'pre' ? '' : (UNIT_SETS.find(s => s.id === set) || {}).name + ' · ';
  return prefix + (unit === 'mix' ? '🎲 Mix' : 'Unit ' + unit);
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
  // Prefer the app-wide speakWord() — pre-generated ElevenLabs recordings
  // with a TTS fallback — so unit practice sounds like every other tab.
  // The speechSynthesis path below only runs standalone (tests, no app.js).
  try {
    if (typeof speakWord === 'function') { speakWord(String(text)); return; }
  } catch (e) {}
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

// ---- owed words: every word missed must be typed back ----
// The rule, the queue, the gate, the 👁 hint and the verdict screen live in
// js/retrydrill.js — six tabs share one implementation. This file only says
// what a Grade 4 word looks like inside it.
if (typeof defineRetryDrill === 'function') defineRetryDrill({
  key: 'units',
  screenId: 'topicsDetail',
  noun: 'từ',
  // Owed words carry no set, and a word can sit in more than one of them
  // ("art" is Pre Unit 4 and HK1 Unit 7) — any match spells and means the same.
  resolve: (en) => unitsAllWords().find(w => String(w.en).toLowerCase() === String(en).toLowerCase()) || null,
  idOf: (w) => w.en,
  answerText: (w) => w.en,
  grade: (v, w) => _unitAnswerCorrect(v, w.en),
  promptHTML: (w) => `
    <div class="unit-q-emoji ${/^[0-9:]+$/.test(w.emoji) ? 'unit-q-number' : ''}">${w.emoji}</div>
    <div class="unit-q-vi">${unitEsc(w.vi)}</div>`,
  sayHTML: (w) => `<button class="unit-say-btn" onclick="_unitSpeak('${_unitSpeakAttr(w.en)}')" title="Nghe phát âm">🔊</button>`,
  onAnswer: (w, ok) => { _unitSpeak(w.en); if (ok) _unitBumpWordLevel(w.en, true); },
  // The drill takes over the Topics detail pane, so the home pieces step aside.
  onOpen: () => {
    _unitQuiz = null;
    ['topicsGrid', 'topicsReviewCard', 'topicsSrBanner', 'unitsBar', 'topicsSubTabs', 'topicsHistory']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const d = document.getElementById('topicsDetail');
    if (d) d.style.display = '';
  },
  home: () => { if (typeof renderTopicsHome === 'function') renderTopicsHome(); },
});

// Named wrappers so this tab reads in its own vocabulary.
function unitsRetryList() { return (typeof retryList === 'function' ? retryList('units') : []); }
function unitsRetryCount() { return (typeof retryCount === 'function' ? retryCount('units') : 0); }
function startUnitRetry() { return (typeof startRetryDrill === 'function' ? startRetryDrill('units') : undefined); }

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
// would leave a fully-mastered child with nothing to do. Matched by suffix so
// every set's Mix key ('mix', 'hk1-mix') is covered.
function isUnitMastered(unit, history) {
  if (/(^|-)mix$/.test(String(unit))) return false;
  return unitPerfectCount(unit, history) >= UNIT_MASTERY_TARGET;
}

// ---- words to review: which ones, and how often ----
// A score of 6/10 tells a child nothing they can act on. Counting how many
// times each word has been missed across every past practice does: the list is
// exactly what to look at again, hardest first. Same idea as the Word form tab.
function unitsWrongAggregate() {
  const hist = (typeof appState !== 'undefined' && appState && appState.unitsHistory) || [];
  const counts = new Map();
  hist.forEach(s => (s.wrong || []).forEach(en => {
    counts.set(en, (counts.get(en) || 0) + 1);
  }));
  const bank = unitsAllWords();
  const out = [];
  counts.forEach((misses, en) => {
    const w = bank.find(x => x.en === en);
    if (w) out.push({ w, misses });
  });
  // Most-missed first; ties alphabetical so the order does not jitter.
  out.sort((a, b) => b.misses - a.misses || a.w.en.localeCompare(b.w.en));
  return out;
}

function renderUnitsWrongPanelHTML() {
  // Hidden while words are owed: the drill IS the way to clear them, and two
  // competing "practise your mistakes" routes leave a child going in circles.
  if (unitsRetryCount() > 0) return '';
  const wrong = unitsWrongAggregate();
  if (!wrong.length) return '';
  const chips = wrong.slice(0, 12).map(({ w, misses }) => `
    <button class="g4-wrong-chip" onclick="_unitSpeak('${_unitSpeakAttr(w.en)}')" title="Nghe phát âm">
      <span class="g4-wrong-emoji">${w.emoji}</span>
      <span class="g4-wrong-en">${unitEsc(w.en)}</span>
      <span class="g4-wrong-vi">${unitEsc(w.vi)}</span>
      <i class="g4-wrong-count">${misses}×</i>
    </button>`).join('');
  const more = wrong.length > 12 ? `<div class="g4-wrong-more">… và ${wrong.length - 12} từ nữa</div>` : '';
  return `
    <div class="g4-wrong-panel">
      <div class="phrases-section-title">📉 Từ hay sai <span class="phrases-count">${wrong.length}</span></div>
      <div class="g4-wrong-list">${chips}</div>
      ${more}
    </div>`;
}

function renderUnitSetTabsHTML() {
  const active = currentUnitSet();
  return `<div class="grammar-subtabs g4-set-tabs">` + UNIT_SETS.map(s => `
    <button class="grammar-subtab ${s.id === active ? 'active' : ''}"
            onclick="switchUnitSet('${s.id}')">${s.label}</button>`).join('') + `</div>`;
}

function renderUnitsBar() {
  if (typeof document === 'undefined') return;   // headless (tests)
  const bar = document.getElementById('unitsBar');
  if (!bar) return;
  bar.style.display = '';

  const set = currentUnitSet();
  const setMeta = UNIT_SETS.find(s => s.id === set) || UNIT_SETS[0];
  const tabs = renderUnitSetTabsHTML();

  // A set with no words yet says so plainly, instead of showing an empty grid
  // that reads as a bug.
  if (setMeta.soon || !unitsBank(set).length) {
    bar.innerHTML = `${tabs}
      <div class="g4-soon">
        <div class="g4-soon-icon">🚧</div>
        <div class="g4-soon-title">${setMeta.name} — sắp có</div>
        <div class="g4-soon-sub">${setMeta.sub} đang được soạn. Trong lúc chờ, học ${setMeta.id === 'hk2' ? 'HK1' : 'Pre'} nhé! 📗</div>
      </div>`;
    return;
  }

  // Words owed from an earlier practice lock every unit. A disabled card with
  // no explanation reads as a broken app, so the banner says what is owed and
  // is itself the way to clear it.
  const owed = unitsRetryCount();

  // Best score per unit key from practice history
  const best = {};
  ((typeof appState !== 'undefined' && appState && appState.unitsHistory) || []).forEach(h => {
    if (!h || !h.total) return;
    const p = Math.round((h.score / h.total) * 100);
    if (!(h.unit in best) || p > best[h.unit]) best[h.unit] = p;
  });

  const owedBanner = (typeof retryOwedBannerHTML === 'function' ? retryOwedBannerHTML('units') : '');

  const list = unitsList(set);
  const mixKey = _unitKey(set, 'mix');
  const mixBest = best[mixKey];
  const mixCard = `
    <button class="g4-card g4-mix-card ${owed ? 'locked' : ''}" ${owed ? 'disabled aria-disabled="true"' : ''}
            onclick="startUnitPractice(${_unitKeyArg(mixKey)})">
      <div class="g4-card-top">
        <span class="g4-card-unit">🎲 Mix · ${list.length} Units</span>
        ${mixBest !== undefined ? `<span class="g4-card-best ${mixBest >= 80 ? 'good' : ''}">${mixBest >= 100 ? '⭐' : ''}${mixBest}%</span>` : ''}
      </div>
      <div class="g4-card-meta">10 từ ngẫu nhiên từ tất cả các Unit</div>
    </button>`;

  const cards = list.map(u => {
    const key = _unitKey(set, u);
    const words = _unitPool(key);
    // Prefer real emoji for the preview (skip digit "pictures")
    const pics = words.map(w => w.emoji).filter(e => !/^[0-9:]+$/.test(e)).slice(0, 3).join(' ');
    const b = best[key];
    const perfect = unitPerfectCount(key);
    const mastered = isUnitMastered(key);
    const locked = mastered || !!owed;
    const title = unitTitle(set, u);
    const books = unitBooksLabel(set, u);
    return `
    <button class="g4-card ${mastered ? 'mastered' : ''} ${owed && !mastered ? 'locked' : ''}"
            ${locked ? 'disabled aria-disabled="true"' : ''}
            onclick="startUnitPractice(${_unitKeyArg(key)})">
      <div class="g4-card-top">
        <span class="g4-card-unit">${mastered ? '👑 ' : ''}Unit ${u}</span>
        ${mastered
          ? '<span class="g4-card-best mastered">Thành thạo</span>'
          : (b !== undefined ? `<span class="g4-card-best ${b >= 80 ? 'good' : ''}">${b >= 100 ? '⭐' : ''}${b}%</span>` : '')}
      </div>
      ${title ? `<div class="g4-card-title">${unitEsc(title)}</div>` : ''}
      <div class="g4-card-emojis">${pics}</div>
      ${mastered
        ? `<div class="g4-card-meta">Đã đạt ${UNIT_MASTERY_TARGET} lần 10/10 — giỏi lắm! 🎉</div>`
        : `<div class="g4-card-meta">${words.length} từ vựng${books ? ' · ' + books : ''}</div>
           <div class="g4-mastery">
             <i style="width:${Math.round(perfect / UNIT_MASTERY_TARGET * 100)}%"></i>
           </div>
           <div class="g4-mastery-label">⭐ ${perfect}/${UNIT_MASTERY_TARGET} lần 10/10</div>`}
    </button>`;
  }).join('');

  bar.innerHTML = `${tabs}${owedBanner}<div class="g4-grid">${mixCard}${cards}</div>${renderUnitsWrongPanelHTML()}`;
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
  if (typeof retryGate === 'function' && retryGate('units')) return;
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
  // Warm this word's recording (and the next) so the auto-speak on answer
  // and the 🔊 tap play instantly instead of waiting on the network.
  try {
    if (typeof prefetchAudio === 'function') {
      prefetchAudio(q.w.en);
      if (st.questions[st.idx + 1]) prefetchAudio(st.questions[st.idx + 1].w.en);
    }
  } catch (e) {}
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
          — ${unitEsc(q.w.vi)}</div>
        <div>${ans.isCorrect ? '✅ Chính xác!' : '❌ Đáp án đúng: <b>' + unitEsc(q.w.en) + '</b>'}</div>
      </div>
      ${answerGateHTML(q.w.en, 'nextUnitQuestion()', st.idx + 1 < total ? 'Next →' : 'See results')}`;
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
  // Speak the word the moment it is revealed. Submitting is a real tap, so the
  // browser permits it; the 🔊 gate below still has to be tapped before Next.
  if (typeof speakAnswer === 'function') speakAnswer(q.w.en);
  else _unitSpeak(q.w.en);
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
    // The missed words themselves, not just the count: without them the
    // history can say "6/10" forever and never say WHICH six.
    appState.unitsHistory.unshift({ unit: st.unit, score, total, date, wrong: wrong.map(w => w.en) });
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
  if (wrong.length && typeof retryAdd === 'function') retryAdd('units', wrong);
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
      ${(typeof retryResultBannerHTML === 'function' ? retryResultBannerHTML('units', wrong.length) : '')}
      <div class="phrases-section-title">${wrong.length ? 'Từ cần học lại · ' + wrong.length : 'Perfect! 🎉'}</div>
      ${reviewHtml}
      ${owed
        ? (typeof retryResultCtaHTML === 'function' ? retryResultCtaHTML('units') : '')
        : `<button class="phrases-cta-secondary phrases-review-btn" onclick="startUnitPractice(${_unitKeyArg(st.unit)})">🔁 Practice ${_unitLabel(st.unit)} again</button>`}
    </div>`;
  fireRewardCelebration(coinsEarned, pct);
  _unitQuiz = null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    unitsBank, unitsAllWords, unitsList, unitTitle, unitBooksLabel,
    UNIT_SETS, currentUnitSet, switchUnitSet, renderUnitSetTabsHTML,
    _unitKey, _unitParse, _unitKeyArg,
    buildUnitGap, pickUnitGapMode, _unitNormalize, _unitAnswerCorrect,
    UNIT_MASTERY_TARGET, unitPerfectCount, isUnitMastered,
    startUnitPractice, submitUnitAnswer, nextUnitQuestion, finishUnitPractice,
    isUnitPracticeActive, abandonUnitPractice, renderUnitsBar, renderUnitsHistory,
    unitsRetryList, unitsRetryCount, startUnitRetry,
    modeForUnitLevel, _unitWordLevel, _unitBumpWordLevel,
    _unitPool, _unitLabel, _unitSpeak, _unitSpeakAttr,
    unitsWrongAggregate, renderUnitsWrongPanelHTML,
  };
}
