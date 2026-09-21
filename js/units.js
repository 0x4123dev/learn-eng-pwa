// units.js — picture-dictionary practice: the Learn → Grade 4 screen and the
// bottom bar's Word tab, one engine.
// A card grid opens a typed gap-fill practice: the app shows the picture
// (emoji) + Vietnamese meaning and a gapped word (st__ent / ch_cken /
// _ _ _ _ _), and the student types the FULL word. The number of missing
// letters is random per question: 4, 5 or the whole word.
//
// Grade 4 is split into four word sets, each with its own units and its own
// Mix:
//   pre — the picture-dictionary units the app started with (12 units)
//   posthk — Global Maths 4 & Science 4 glossaries
//   hk1 — Tiếng Anh 4 Global Success, Tập một: the book's ten units merged
//         two-by-two into five units carrying the whole Wordlist from
//         pages 78-80 (js/units-hk1-data.js)
//   hk2 — Tiếng Anh 4 Global Success, Tập hai: book units 11..20 merged the
//         same way, carrying the whole Wordlist from pages 74-75
// The Word tab carries three more, on its own screen:
//   pr1, pr2, pr3 — Career Paths: Public Relations, Book 1/2/3 (Express
//         Publishing), 15 units each, exactly the Vocabulary column of each
//         book's Scope and Sequence page (js/word-data.js, generated from
//         data/career-paths/ by scripts/build-word-data.js; lazy-loaded)
//
// A unit is addressed by a KEY. 'pre' keeps its bare keys (3, 'mix') so every
// history row, best score and mastery count written before the split still
// counts; the newer sets prefix theirs ('hk1-3', 'hk1-mix', 'pr2-7').
//
// A HOST is a screen that carries the tab's pieces — the set strip, the unit
// cards, the history list and the detail pane a practice draws in. Every set
// names its host, and every DOM id in this file goes through the host of the
// set in play, so one practice engine serves two bottom-bar destinations.

let _unitQuiz = null;   // { unit, questions:[{w, gapped, mode}], idx, answers:[] }

const UNIT_HOSTS = {
  grade4: {
    screen: 'gradeFourScreen', tabs: 'grade4SubTabs', bar: 'unitsBar',
    history: 'grade4History', detail: 'grade4Detail',
    stateKey: 'unitsSet', defaultSet: 'hk1',
    // Owed words and the silent priority list are kept per host, so a Word
    // debt gates the Word tab and a Grade 4 debt gates Grade 4 — never both.
    retryKey: 'units',
    homeFn: 'renderGrade4Home', homeLabel: '📗 Bài học', skillPrefix: 'grade4',
  },
  word: {
    screen: 'wordScreen', tabs: 'wordSubTabs', bar: 'wordUnitsBar',
    history: 'wordHistory', detail: 'wordDetail',
    stateKey: 'wordSet', defaultSet: 'pr1',
    retryKey: 'word',
    homeFn: 'renderWordHome', homeLabel: '🔤 Bài học', skillPrefix: 'word',
  },
};

const UNIT_SETS = [
  { id: 'pre', host: 'grade4', label: '📘 Pre', name: 'Pre', sub: 'Từ điển tranh · 12 Unit' },
  // The two English-medium subject books the class moves on to. Their
  // glossaries are one word bank, split by subject. The id stays 'posthk' even
  // though the tab reads "Post": it is written into every owed word and every
  // history row, and renaming it would strand both.
  { id: 'posthk', host: 'grade4', label: '📙 Post', name: 'Post', sub: 'Global Maths 4 & Science 4 · Glossary' },
  { id: 'hk1', host: 'grade4', label: '📗 HK1', name: 'HK1', sub: 'Global Success Tập 1 · Bài 1-10' },
  { id: 'hk2', host: 'grade4', label: '📕 HK2', name: 'HK2', sub: 'Global Success Tập 2 · Bài 11-20' },
  { id: 'pr1', host: 'word', label: '📘 Book 1', name: 'Book 1', sub: 'Career Paths · Public Relations 1 · 15 Units' },
  { id: 'pr2', host: 'word', label: '📙 Book 2', name: 'Book 2', sub: 'Career Paths · Public Relations 2 · 15 Units' },
  { id: 'pr3', host: 'word', label: '📗 Book 3', name: 'Book 3', sub: 'Career Paths · Public Relations 3 · 15 Units' },
];
const UNIT_SET_RE = /^(hk1|hk2|posthk|pr1|pr2|pr3)-(mix|\d+)$/;

function unitHostOfSet(set) {
  const meta = UNIT_SETS.find(s => s.id === set);
  return (meta && meta.host) || 'grade4';
}
function unitHostSets(hostId) {
  return UNIT_SETS.filter(s => s.host === hostId);
}
// The host the child is standing in: the last home drawn, or the host of the
// practice under way. Grade 4 until anything says otherwise, which is what
// every caller written before the Word tab expects.
let _unitHostId = 'grade4';
function _unitHost() { return UNIT_HOSTS[_unitHostId] || UNIT_HOSTS.grade4; }
function unitCurrentHost() { return _unitHostId; }
// For a restored study checkpoint (js/app.js): the practice's host before its
// question is redrawn, or it lands on the other host's screen.
function unitSelectHost(hostId) { if (UNIT_HOSTS[hostId]) _unitHostId = hostId; }
function _unitHostEl(piece) {
  if (typeof document === 'undefined') return null;
  return document.getElementById(_unitHost()[piece]);
}
// The screen a live practice belongs to, for the leave guard in js/app.js.
function unitPracticeScreen() { return _unitHost().screen; }

// Which set the cards are showing, per host. Stored per user so each tab
// reopens where the child left it; HK1 is Grade 4's default because that is
// the book in use, Book 1 is the Word tab's.
const _unitSetFallback = {};
function currentUnitSet(hostId) {
  const host = UNIT_HOSTS[hostId] || _unitHost();
  let saved = null;
  if (typeof appState !== 'undefined' && appState && appState[host.stateKey]) saved = appState[host.stateKey];
  else saved = _unitSetFallback[host.stateKey] || null;
  return unitHostSets(hostId || _unitHostId).some(s => s.id === saved) ? saved : host.defaultSet;
}
function switchUnitSet(set) {
  if (!UNIT_SETS.some(s => s.id === set)) return;
  _unitHostId = unitHostOfSet(set);
  const host = _unitHost();
  _unitSetFallback[host.stateKey] = set;
  if (typeof appState !== 'undefined' && appState) {
    appState[host.stateKey] = set;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
      try { saveUserData(currentUser, appState); } catch (e) {}
    }
  }
  if (typeof renderUnitsBar === 'function') renderUnitsBar();
}

// Each word remembers which set it came from. An owed word is stored by id and
// looked up again later, and the id used to be the English alone — which is
// wrong wherever two sets spell a word the same and mean different things:
// "ring" is a piece of jewellery in Pre and a bell ringing in Post-HK, "right"
// is a direction in HK2 and "suitable" in Post-HK. Twenty such pairs exist
// across the four sets, and a child who missed one of them was handed the other
// word's meaning to type back.
//
// Tagged in place, once: the arrays are module constants and the objects are
// shared with every draw, so copying them here would break nothing visibly and
// cost something on every practice.
function _unitsTagSet(bank, set) {
  if (bank.length && bank[0].set === set) return bank;
  for (const w of bank) w.set = set;
  return bank;
}
function unitsBank(set) {
  const s = set || currentUnitSet();
  if (s === 'hk1') return (typeof UNIT_WORDS_HK1 !== 'undefined') ? _unitsTagSet(UNIT_WORDS_HK1, 'hk1') : [];
  if (s === 'hk2') return (typeof UNIT_WORDS_HK2 !== 'undefined') ? _unitsTagSet(UNIT_WORDS_HK2, 'hk2') : [];
  if (s === 'posthk') return (typeof UNIT_WORDS_POSTHK !== 'undefined') ? _unitsTagSet(UNIT_WORDS_POSTHK, 'posthk') : [];
  // js/word-data.js is lazy (js/lazy-data.js SCREEN_FILES.wordScreen): until
  // the Word tab is opened these are empty, and every caller copes with [].
  if (s === 'pr1') return (typeof UNIT_WORDS_PR1 !== 'undefined') ? _unitsTagSet(UNIT_WORDS_PR1, 'pr1') : [];
  if (s === 'pr2') return (typeof UNIT_WORDS_PR2 !== 'undefined') ? _unitsTagSet(UNIT_WORDS_PR2, 'pr2') : [];
  if (s === 'pr3') return (typeof UNIT_WORDS_PR3 !== 'undefined') ? _unitsTagSet(UNIT_WORDS_PR3, 'pr3') : [];
  return (typeof UNIT_WORDS !== 'undefined') ? _unitsTagSet(UNIT_WORDS, 'pre') : [];
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
  if (set === 'hk2' && typeof UNIT_HK2_TITLES !== 'undefined') return UNIT_HK2_TITLES[unit] || '';
  if (set === 'posthk' && typeof UNIT_POSTHK_TITLES !== 'undefined') return UNIT_POSTHK_TITLES[unit] || '';
  if (/^pr[123]$/.test(set) && typeof UNIT_PR_TITLES !== 'undefined') return (UNIT_PR_TITLES[set] || {})[unit] || '';
  return '';
}
// The textbook units a practice unit merges. HK1 and HK2 both renumber theirs
// 1..5, so the card says which pair it covers ("Bài 1-2", "Bài 11-12") — the
// number alone would not point anywhere in the book.
function unitBooks(set, unit) {
  const map = set === 'hk1' ? (typeof UNIT_HK1_BOOKS !== 'undefined' ? UNIT_HK1_BOOKS : null)
            : set === 'hk2' ? (typeof UNIT_HK2_BOOKS !== 'undefined' ? UNIT_HK2_BOOKS : null)
            : null;
  return (map && map[unit]) || null;
}
function unitBooksLabel(set, unit) {
  // Post-HK words come from a glossary at the BACK of a book rather than from
  // any one unit of it, so "Bài 3-4" would point nowhere. The card names the
  // book instead — two subjects share this tab and the child needs to know
  // which one a unit belongs to.
  if (set === 'posthk') {
    return (typeof UNIT_POSTHK_SOURCE !== 'undefined' && UNIT_POSTHK_SOURCE[unit]) || '';
  }
  const b = unitBooks(set, unit);
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
  const m = s.match(UNIT_SET_RE);
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
// Only letters are blanked. Individual Units keep the first letter as a hint;
// the harder HK1 Mix passes hideFirst=true.
function buildUnitGap(en, mode, rand, hideFirst) {
  const rnd = rand || Math.random;
  const chars = en.split('');
  const letterIdx = [];
  chars.forEach((c, i) => { if (/[a-zA-Z]/.test(c)) letterIdx.push(i); });

  let blankSet;
  if (mode === 'full') {
    blankSet = new Set(letterIdx);
  } else {
    const pool = letterIdx.slice(1);
    const n = Math.max(1, Math.min(mode, pool.length ? pool.length : 1));
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    if (hideFirst && letterIdx.length) {
      // Mix HK1 is recall, not recognition: its first letter is always one of
      // the hidden letters. Individual Units keep that letter as a learning hint.
      blankSet = new Set([letterIdx[0], ...shuffled.slice(0, Math.max(0, n - 1))]);
    } else {
      blankSet = new Set(shuffled.slice(0, n));
    }
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

// Mix HK1 is the challenge route: individual Units still teach with 4/5/full,
// while Mix recalls substantially more of each word. Full appears twice so a
// child cannot pass the mixed review mostly from its first letter.
function pickUnitGapModeForKey(key, rand, word) {
  if (String(key) !== 'hk1-mix') return pickUnitGapMode(rand);
  const rnd = rand || Math.random;
  const modes = [6, 7, 8, 'full', 'full'];
  const mode = modes[Math.floor(rnd() * modes.length)];
  // Numeric gap modes normally preserve the first letter. On a short Mix
  // word that would make 6/7/8 indistinguishable from the old 5-letter mode,
  // so short words become full recall instead of pretending to be harder.
  const letters = String(word || '').replace(/[^A-Za-z]/g, '').length;
  return typeof mode === 'number' && letters && letters <= mode + 1 ? 'full' : mode;
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
// Named and exported rather than passed straight in, so the two functions that
// decide what an owed word IS can be tested without standing up the whole drill.
const UNITS_RETRY_CONFIG = {
  key: 'units',
  screenId: 'grade4Detail',
  noun: 'từ',
  // An owed word is stored as "set|word" so it comes back meaning what it meant
  // when it was missed. Debts written before this carry the bare word; those
  // still resolve, to the first set that spells it — the old behaviour, kept
  // deliberately rather than dropping a child's outstanding work on the floor.
  resolve: (id) => {
    const raw = String(id);
    const cut = raw.indexOf('|');
    const set = cut > 0 ? raw.slice(0, cut) : null;
    const en = (cut > 0 ? raw.slice(cut + 1) : raw).toLowerCase();
    const match = w => String(w.en).toLowerCase() === en;
    if (set) {
      const found = unitsBank(set).find(match);
      if (found) return found;
    }
    return unitsAllWords().find(match) || null;
  },
  idOf: (w) => (w.set ? w.set + '|' : '') + w.en,
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
    _unitHostId = 'grade4';
    ['unitsBar', 'grade4SubTabs', 'grade4History']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const d = document.getElementById('grade4Detail');
    if (d) d.style.display = '';
  },
  home: () => { if (typeof renderGrade4Home === 'function') renderGrade4Home(); },
};
if (typeof defineRetryDrill === 'function') defineRetryDrill(UNITS_RETRY_CONFIG);

// The Word tab owes its words on its own screen. Same rules, same word
// shape; only where it draws and which queue it keeps differ.
const WORD_RETRY_CONFIG = Object.assign({}, UNITS_RETRY_CONFIG, {
  key: 'word',
  screenId: 'wordDetail',
  onOpen: () => {
    _unitQuiz = null;
    _unitHostId = 'word';
    ['wordUnitsBar', 'wordSubTabs', 'wordHistory']
      .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
    const d = document.getElementById('wordDetail');
    if (d) d.style.display = '';
  },
  home: () => { if (typeof renderWordHome === 'function') renderWordHome(); },
});
if (typeof defineRetryDrill === 'function') defineRetryDrill(WORD_RETRY_CONFIG);

// Named wrappers so this tab reads in its own vocabulary. They answer for the
// host in play; an argument names a host ('grade4', 'word') or its retry key
// ('units', 'word') explicitly.
function unitsRetryKey(which) {
  if (which && UNIT_HOSTS[which]) return UNIT_HOSTS[which].retryKey;
  const byKey = which && Object.values(UNIT_HOSTS).find(h => h.retryKey === which);
  return (byKey || _unitHost()).retryKey;
}
function unitsRetryList(hostId) { return (typeof retryList === 'function' ? retryList(unitsRetryKey(hostId)) : []); }
function unitsRetryCount(hostId) { return (typeof retryCount === 'function' ? retryCount(unitsRetryKey(hostId)) : 0); }
function startUnitRetry(hostId) { return (typeof startRetryDrill === 'function' ? startRetryDrill(unitsRetryKey(hostId)) : undefined); }

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
  const hist = unitsHostHistory();
  const counts = new Map();
  hist.forEach(s => (s.wrong || []).forEach(en => {
    counts.set(en, (counts.get(en) || 0) + 1);
  }));
  const bank = unitHostSets(_unitHostId).reduce((all, s) => all.concat(unitsBank(s.id)), []);
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

// The history rows that belong to the host in play (js/home.js splits the
// same list the same way for its skill cards).
function unitsHostHistory(hostId) {
  const hist = (typeof appState !== 'undefined' && appState && Array.isArray(appState.unitsHistory)) ? appState.unitsHistory : [];
  const id = hostId || _unitHostId;
  return hist.filter(h => h && unitHostOfSet(_unitParse(h.unit).set) === id);
}

function renderUnitSetTabsHTML() {
  const active = currentUnitSet();
  return `<div class="grammar-subtabs g4-set-tabs">` + unitHostSets(_unitHostId).map(s => `
    <button class="grammar-subtab ${s.id === active ? 'active' : ''}"
            onclick="switchUnitSet('${s.id}')">${s.label}</button>`).join('') + `</div>`;
}

function renderUnitsBar() {
  if (typeof document === 'undefined') return;   // headless (tests)
  const bar = _unitHostEl('bar');
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
        <div class="g4-soon-sub">${setMeta.sub} chưa tải được. Kiểm tra mạng rồi mở lại nhé! 📗</div>
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

  const owedBanner = (typeof retryOwedBannerHTML === 'function' ? retryOwedBannerHTML(unitsRetryKey()) : '');

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
  const el = _unitHostEl('history');
  if (!el) return;
  el.style.display = '';
  const state = (typeof appState !== 'undefined' && appState) ? appState : {};
  const hist = unitsHostHistory();
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

// Which sub-tab (Bài học / Lịch sử) each host is showing.
const _unitView = { grade4: 'practice', word: 'practice' };
function _renderUnitsHome(hostId, view) {
  _unitHostId = hostId;
  const host = _unitHost();
  if (view === 'history' || view === 'practice') _unitView[hostId] = view;
  const cur = _unitView[hostId] || 'practice';
  const detail = _unitHostEl('detail');
  if (detail) { detail.innerHTML = ''; detail.style.display = ''; }
  const tabs = _unitHostEl('tabs');
  if (tabs) {
    tabs.style.display = '';
    tabs.innerHTML = `<button class="grammar-subtab ${cur === 'practice' ? 'active' : ''}" onclick="${host.homeFn}('practice')">${host.homeLabel}</button>
      <button class="grammar-subtab ${cur === 'history' ? 'active' : ''}" onclick="${host.homeFn}('history')">🕐 Lịch sử</button>`;
  }
  const bar = _unitHostEl('bar');
  const history = _unitHostEl('history');
  if (bar) bar.style.display = cur === 'practice' ? '' : 'none';
  if (history) history.style.display = cur === 'history' ? '' : 'none';
  if (cur === 'history') renderUnitsHistory(); else renderUnitsBar();
}
function renderGrade4Home(view) { _renderUnitsHome('grade4', view); }
function renderWordHome(view) { _renderUnitsHome('word', view); }
function openGrade4(view) {
  _unitView.grade4 = view === 'history' ? 'history' : 'practice';
  if (typeof switchScreen === 'function' && switchScreen('gradeFourScreen') === false) return false;
  renderGrade4Home();
  return true;
}
function openWord(view) {
  _unitView.word = view === 'history' ? 'history' : 'practice';
  if (typeof switchScreen === 'function' && switchScreen('wordScreen') === false) return false;
  renderWordHome();
  return true;
}

// ---- practice flow (renders inside #topicsDetail) ----
function startUnitPractice(unit) {
  // Words missed earlier are owed back BEFORE a new unit. The cards are
  // disabled while anything is owed, but the rule lives here too: a stale DOM
  // node, a queued tap or the "practise again" button on an old results screen
  // must not walk past it.
  // The practice belongs to the host of its set, whichever screen drew the
  // card: a daily-task deep link starts it before any home has been drawn.
  _unitHostId = unitHostOfSet(_unitParse(unit).set);
  if (typeof retryGate === 'function' && retryGate(unitsRetryKey())) return;
  // The card is disabled, but a stale DOM node or a queued tap must not slip
  // through — the rule lives here, not only in the markup.
  if (isUnitMastered(unit)) {
    if (typeof showToast === 'function') showToast('👑 Unit này bạn đã thành thạo rồi!');
    return;
  }
  const pool = _unitPool(unit);
  if (!pool.length) return;
  // Words this child has missed before come first, up to half the practice,
  // until each has been typed right five times running (js/wrong-priority.js).
  // The child is not told; the practice simply contains what they need.
  // Falls back to a plain shuffle when the engine is not loaded, which is the
  // case in the test files that load this tab on its own.
  let words;
  if (typeof prioPick === 'function') {
    words = prioPick(unitsRetryKey(), pool, 10, { idOf: UNITS_RETRY_CONFIG.idOf });
  } else {
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    words = shuffled.slice(0, Math.min(10, shuffled.length));
  }
  const questions = words.map(w => {
    // Random gap count per question (4, 5 letters or the whole word),
    // like the textbook's st__ent / ch_cken style. Per-word levels are still
    // tracked (see _unitBumpWordLevel) for possible future use.
    const mode = pickUnitGapModeForKey(unit, undefined, w.en);
    return { w, mode, gap: buildUnitGap(w.en, mode, undefined, String(unit) === 'hk1-mix') };
  });
  _unitQuiz = { unit, questions, idx: 0, answers: new Array(questions.length).fill(null) };

  // Hide the host's menu pieces while practising.
  ['bar', 'tabs', 'history'].forEach(piece => {
    const el = _unitHostEl(piece);
    if (el) el.style.display = 'none';
  });
  renderUnitQuestion();
}

function abandonUnitPractice() { _unitQuiz = null; }

// SILENT teardown for a profile change.
//
// abandonUnitPractice() is the right clear, but the only roads to it are
// quitUnitPractice()'s ✕ and switchScreen's confirm — and switchUser() goes
// through neither. So A's half-answered round survived: isUnitPracticeActive()
// answered B's every tab tap with "You are 6/10 through this practice", and the
// study checkpoint (js/app.js buildStudyCheckpoint) wrote A's
// questions and A's answers into localStorage under B's NAME, to be handed back
// to B — "↩️ Đã mở lại bài đang làm dở" — on their next open.
//
// The hidden home pieces (topicsGrid and friends) are NOT touched: entering the
// tab always runs renderTopicsHome(), which restores every one of them.
// _unitUtt is left alone too — it is a GC guard for an utterance that may still
// be speaking, not the child's data.
function unitsForgetProfile() {
  abandonUnitPractice();
  for (const k of Object.keys(_unitSetFallback)) delete _unitSetFallback[k];
}

// The ✕ sits exactly where a thumb rests while tapping answers, and it used to
// bin the whole round on a single touch with nothing said. Ask first — but only
// when there is work to lose, so starting and changing your mind stays free.
function unitAnsweredCount() {
  return _unitQuiz ? _unitQuiz.answers.filter(a => a !== null).length : 0;
}
function quitUnitPractice() {
  const st = _unitQuiz;
  if (st) {
    const done = unitAnsweredCount();
    if (done && typeof confirm === 'function'
      && !confirm(`You are ${done}/${st.questions.length} through this practice.\n`
        + 'If you leave now, your progress will be lost.\n\nLeave anyway?')) return;
  }
  abandonUnitPractice();
  _renderUnitsHome(_unitHostId);
}
function isUnitPracticeActive() { return !!_unitQuiz; }

// The Post set is a maths/science glossary, and the child meets these CONCEPTS
// in the app before school teaches them — a two-word gloss ("hiệu", "thể")
// cannot carry a concept on its own. So each term comes with a sentence that
// DEFINES it by showing it, and the Vietnamese translation of that sentence is
// what actually delivers the idea.
//
// While answering, the term is a blank: the sentence is context and cue at
// once, so the child has something to think from instead of a bare gloss. The
// translation is withheld until the answer is in, or the card would give
// itself away.
//
// Brackets in a lemma mean two things — `greater (than)` is an attached part
// ("9 is greater than 4"), `DIY (Do It Yourself)` is an expansion — so both the
// literal and the bracket-stripped spelling are tried.
function _unitExampleParts(w) {
  if (!w || !w.ex) return null;
  const literal = String(w.en).trim();
  const stripped = literal.replace(/[()]/g, '').replace(/\s+/g, ' ').trim();
  for (const target of (literal === stripped ? [literal] : [literal, stripped])) {
    const re = new RegExp('(^|[^A-Za-z-])(' + target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z-])', 'i');
    const m = w.ex.match(re);
    if (!m) continue;
    const at = m.index + m[1].length;
    return { before: w.ex.slice(0, at), term: w.ex.substr(at, m[2].length), after: w.ex.slice(at + m[2].length) };
  }
  return null;
}

function _unitExampleHTML(w, revealed) {
  const parts = _unitExampleParts(w);
  if (!parts) return '';
  const filled = revealed
    ? `<b class="unit-ex-word">${unitEsc(parts.term)}</b>`
    : '<span class="unit-ex-blank">______</span>';
  const vi = revealed && w.exVi ? `<div class="unit-q-exvi">${unitEsc(w.exVi)}</div>` : '';
  return `<div class="unit-q-ex">${unitEsc(parts.before)}${filled}${unitEsc(parts.after)}</div>${vi}`;
}

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
  const detail = _unitHostEl('detail') || document.getElementById('topicsDetail');
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
        <button class="grammar-back-btn" onclick="quitUnitPractice()">✕</button>
        <span class="grammar-quiz-progress">${_unitLabel(st.unit)} · ${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round((st.idx / total) * 100)}%"></div></div>
      </div>
      <div class="grammar-question-card unit-q-card">
        <div class="unit-q-emoji ${isNumberCard ? 'unit-q-number' : ''}">${q.w.emoji}</div>
        <div class="unit-q-vi">${unitEsc(q.w.vi)}</div>
        ${_unitExampleHTML(q.w, answered)}
        ${_unitGapHTML(q.gap, answered)}
        ${body}
      </div>
    </div>`;

  if (!answered) {
    const inp = document.getElementById('unitTextInput');
    if (inp) { try { inp.focus(); } catch (e) {} }  // synchronous: keeps the tap gesture so the mobile keyboard opens
  }
  // The screen and the checkpoint change together (js/app.js).
  if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
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
  if (typeof speakAnswer === 'function') speakAnswer(q.w.en, { auto: true });
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
    const modeLabels = { 4: 'Điền 4 chữ', 5: 'Điền 5 chữ', full: 'Viết cả từ' };
    const skillMap = {};
    st.questions.forEach((q, i) => {
      const mode = String(q.mode || 'full');
      const unitKey = String(st.unit).toLowerCase().replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.|\.$/g, '') || 'mix';
      const key = _unitHost().skillPrefix + '.unit.' + unitKey.toLowerCase() + '.spelling.' + mode;
      const row = skillMap[key] || (skillMap[key] = {
        skillKey: key,
        skillLabel: _unitLabel(st.unit) + ' · ' + (modeLabels[mode] || 'Chính tả'),
        attempts: 0, correct: 0, wrong: 0, skipped: 0, wrongRefs: []
      });
      row.attempts++;
      const answer = st.answers[i];
      if (!answer) row.skipped++;
      else if (answer.isCorrect) row.correct++;
      else {
        row.wrong++;
        if (row.wrongRefs.length < 20) row.wrongRefs.push(q.w.en);
      }
    });
    appState.unitsHistory.unshift({
      unit: st.unit, score, total, date, wrong: wrong.map(w => w.en),
      sec: typeof ActivityClock !== 'undefined' ? ActivityClock.take() : undefined,
      skills: Object.keys(skillMap).map(k => skillMap[k])
    });
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
  if (wrong.length && typeof retryAdd === 'function') retryAdd(unitsRetryKey(), wrong);
  // The silent priority list (js/wrong-priority.js): every word answered in a
  // real practice moves its streak. Same right/wrong line as the owed drill.
  if (typeof prioRecord === 'function') {
    const idOf = UNITS_RETRY_CONFIG.idOf;
    prioRecord(unitsRetryKey(),
      st.questions.filter((q, i) => st.answers[i] && st.answers[i].isCorrect).map(q => idOf(q.w)),
      wrong.map(idOf));
  }
  const owed = unitsRetryCount();
  const host = _unitHost();

  const detail = _unitHostEl('detail') || document.getElementById('topicsDetail');
  const reviewHtml = wrong.map(w => `
      <div class="grammar-review-item wrong">
        <div class="grammar-review-q">${w.emoji} <b>${typeof tapwordsWrap === 'function' ? tapwordsWrap(w.en) : unitEsc(w.en)}</b>
          <button class="unit-say-btn" onclick="_unitSpeak('${_unitSpeakAttr(w.en)}')" title="Nghe phát âm">🔊</button>
          — ${unitEsc(w.vi)}</div>
      </div>`).join('');

  detail.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="${host.homeFn}()">‹</button>
        <span class="grammar-quiz-progress">${pct === 100 ? '⭐' : pct >= 60 ? '✅' : '📝'} ${_unitLabel(st.unit)} · ${score}/${total} (${pct}%)</span>
      </div>
      ${rewardCelebrationHTML(score, total, coinsEarned)}
      ${(typeof retryResultBannerHTML === 'function' ? retryResultBannerHTML(host.retryKey, wrong.length) : '')}
      <div class="phrases-section-title">${wrong.length ? 'Từ cần học lại · ' + wrong.length : 'Perfect! 🎉'}</div>
      ${reviewHtml}
      ${owed
        ? (typeof retryResultCtaHTML === 'function' ? retryResultCtaHTML(host.retryKey) : '')
        : `<button class="phrases-cta-secondary phrases-review-btn" onclick="startUnitPractice(${_unitKeyArg(st.unit)})">🔁 Practice ${_unitLabel(st.unit)} again</button>`}
    </div>`;
  fireRewardCelebration(coinsEarned, pct);
  _unitQuiz = null;
  // No round left → the checkpoint is cleared at once (js/app.js), so a
  // finished one is never offered back after a reload and paid for twice.
  if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    unitsBank, unitsAllWords, unitsList, unitTitle, unitBooks, unitBooksLabel,
    UNITS_RETRY_CONFIG, _unitPool,
    UNIT_SETS, UNIT_HOSTS, UNIT_SET_RE, unitHostOfSet, unitHostSets, unitCurrentHost, unitSelectHost, unitPracticeScreen,
    unitsHostHistory, unitsRetryKey, WORD_RETRY_CONFIG, renderWordHome, openWord,
    currentUnitSet, switchUnitSet, renderUnitSetTabsHTML,
    _unitKey, _unitParse, _unitKeyArg,
    buildUnitGap, pickUnitGapMode, pickUnitGapModeForKey, _unitNormalize, _unitAnswerCorrect,
    UNIT_MASTERY_TARGET, unitPerfectCount, isUnitMastered,
    _unitExampleParts, _unitExampleHTML,
    startUnitPractice, submitUnitAnswer, nextUnitQuestion, finishUnitPractice,
    isUnitPracticeActive, abandonUnitPractice, unitsForgetProfile, quitUnitPractice, unitAnsweredCount, renderUnitsBar, renderUnitsHistory,
    unitsRetryList, unitsRetryCount, startUnitRetry,
    modeForUnitLevel, _unitWordLevel, _unitBumpWordLevel, renderGrade4Home, openGrade4,
    _unitLabel, _unitSpeak, _unitSpeakAttr,
    unitsWrongAggregate, renderUnitsWrongPanelHTML,
  };
}
