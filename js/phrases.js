// phrases.js — "Phrases" tab: prepositional-phrase MCQ practice.
// Data lives in js/phrases-data.js (global PREPOSITION_QUESTIONS, 500 items).
// Flat combined bank (one pool of 500). Quick practice is the primary CTA;
// history (with score filters) and a wrong-answer review live below it,
// mirroring the Grammar tab's History + "Topics to review" pattern.

const PHRASES_CAT_LABELS = {
  verb: 'Verb + Preposition',
  adj: 'Adjective + Preposition',
  noun: 'Noun + Preposition',
  phrase: 'Prepositional Phrase',
  place: 'Preposition of Place',
};
const PHRASES_CAT_ICON = { verb: '🏃', adj: '🎨', noun: '📦', phrase: '🧩', place: '📍' };
const PHRASES_HISTORY_CAP = 300;
const PHRASES_TIER_LABELS = { all: 'All scores', perfect: '⭐ Perfect', great: '✅ Great', ok: '👍 OK', weak: '📝 Weak' };

let _phrQuiz = null;              // active quiz: { questions:[], idx, answers:[] }
let _phrHistoryFilter = 'all';    // tier filter for the history list
let _phrSubTab = 'practice';      // 'practice' | 'lessons'

function phrEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function phrTier(pct) {
  return pct === 100 ? 'perfect' : pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'weak';
}
function phrTierEmoji(pct) {
  return pct === 100 ? '⭐' : pct >= 80 ? '✅' : pct >= 60 ? '👍' : '📝';
}

function phrShuffle(arr, seed) {
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

function phrasesBank() {
  return (typeof PREPOSITION_QUESTIONS !== 'undefined') ? PREPOSITION_QUESTIONS : [];
}
function phrasesById(id) {
  // Meaning questions carry the id 'pm-<baseId>' — resolve via their base question.
  if (typeof id === 'string' && id.indexOf('pm-') === 0) {
    const base = phrasesBank().find(q => q.id === id.slice(3)) || null;
    return base ? phrMeaningQuestion(base) : null;
  }
  // Typed variants carry 'pt-<baseId>' and resolve the same way.
  if (typeof id === 'string' && id.indexOf('pt-') === 0) {
    const base = phrasesBank().find(q => q.id === id.slice(3)) || null;
    return base ? phrTypedQuestion(base) : null;
  }
  return phrasesBank().find(q => q.id === id) || null;
}

// Build the follow-up "What is the meaning of …?" question for a base question.
// Returns null when no meaning entry exists (data missing) so callers can skip.
function phrMeaningQuestion(base) {
  if (!base || typeof PHRASE_MEANINGS === 'undefined') return null;
  const m = PHRASE_MEANINGS[base.id];
  if (!m || !Array.isArray(m.options) || m.options.length !== 4) return null;
  return {
    id: 'pm-' + base.id,
    cat: base.cat,
    meaning: true,
    q: 'What is the meaning of "' + base.phrase + '"?',
    options: m.options,
    correct: m.correct,
    phrase: base.phrase,
    vi: base.vi,
    explanation: '"' + base.phrase + '" có nghĩa là "' + m.options[m.correct] + '".',
  };
}

// Build the TYPED variant of a base question: the same sentence, but the
// preposition is produced rather than chosen.
//
// Derived, not authored as 913 more records — exactly how the meaning
// questions work. The bank stays the single source of the sentence, the
// translation and the explanation, so a data fix reaches the typed form too.
//
// Choosing "on" from four options is recognition; typing it is recall, and
// recall is what a child needs when they write the sentence themselves.
function phrTypedQuestion(base) {
  if (!base || !Array.isArray(base.options)) return null;
  const answer = base.options[base.correct];
  if (!answer) return null;
  return {
    id: 'pt-' + base.id,
    baseId: base.id,          // the meaning follow-up is looked up by THIS
    cat: base.cat,
    typed: true,
    q: base.q,
    answer,
    accept: [answer],
    phrase: base.phrase,
    vi: base.vi,
    explanation: base.explanation,
  };
}

// Case / punctuation / spacing-insensitive, like every other typed tab.
function _phrNormalize(s) {
  return String(s || '').toLowerCase().normalize('NFC')
    .replace(/[.,!?;:"\u2019'`]/g, '').replace(/\s+/g, ' ').trim();
}
function _phrTextCorrect(text, q) {
  const u = _phrNormalize(text);
  if (!u) return false;
  const list = (q.accept && q.accept.length) ? q.accept : [q.answer];
  return list.some(a => _phrNormalize(a) === u);
}

// Typed questions are the ones that teach, but they are slower to answer, so
// a practice gets a measured dose rather than a random one: 1 in 10, 2 in 20.
// The count is of BASE questions — the number on the practice button — and a
// typed variant REPLACES its multiple-choice form, so the practice does not
// get longer.
const PHR_TYPED_SHARE = 0.1;
function phrTypedTarget(n, available) {
  const want = Math.round(n * PHR_TYPED_SHARE);
  // The floor must respect availability, or an empty pool still demands one,
  // the conversion finds nothing, and the practice quietly comes up short.
  const floor = (n >= 2 && available > 0) ? 1 : 0;
  return Math.max(floor, Math.min(want, available, n));
}

// Expand picked base questions into [base, meaning, base, meaning, …] pairs.
function phrExpandPairs(qs) {
  const out = [];
  qs.forEach(q => {
    out.push(q);
    // A typed variant's own id is 'pt-<baseId>', which no meaning is filed
    // under — looking up by it silently dropped the follow-up and left the
    // practice one question shorter than the button promised.
    const base = q.baseId ? (phrasesBank().find(b => b.id === q.baseId) || q) : q;
    const mq = phrMeaningQuestion(base);
    if (mq) out.push(mq);
  });
  return out;
}

function phrasesHistory() {
  if (typeof appState !== 'undefined' && appState) {
    if (!Array.isArray(appState.phrasesHistory)) appState.phrasesHistory = [];
    return appState.phrasesHistory;
  }
  return [];
}

function savePhrasesSession(session) {
  const hist = phrasesHistory();
  if (session && session.sec == null && typeof ActivityClock !== 'undefined') session.sec = ActivityClock.take();
  hist.unshift(session);
  if (hist.length > PHRASES_HISTORY_CAP) hist.length = PHRASES_HISTORY_CAP;
  if (typeof appState !== 'undefined' && typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
    // saveUserData sheds old history itself now (halving, bounded — see
    // js/app.js). The old pop-one-line-and-retry loop here did hundreds of
    // full re-stringifies and froze the app right at "see result".
    try { saveUserData(currentUser, appState); }
    catch (e) {
      // Even shedding could not fit it: the disk is truly full. Say so.
      if (typeof showToast === 'function') showToast('⚠️ Bộ nhớ máy đầy — kết quả chưa được lưu');
    }
  }
}

// Aggregate every wrong question across all sessions → most-missed first.
function phrasesWrongAggregate() {
  const counts = new Map(); // qid -> misses
  phrasesHistory().forEach(s => (s.wrong || []).forEach(w => {
    counts.set(w.qid, (counts.get(w.qid) || 0) + 1);
  }));
  const out = [];
  counts.forEach((misses, qid) => {
    const q = phrasesById(qid);
    if (q) out.push({ q, misses });
  });
  out.sort((a, b) => b.misses - a.misses);
  return out;
}

// ---- entry point (called from nav + switchScreen) ----
function renderPhrasesHome() {
  const screen = document.getElementById('phrasesScreen');
  if (!screen) return;
  if (_phrQuiz) { renderPhrQuestion(); return; }
  if (typeof isCollocActive === 'function' && isCollocActive()) { renderCollocQuestion(); return; }

  const bar = `
    <div class="grammar-subtabs">
      <button class="grammar-subtab ${_phrSubTab === 'practice' ? 'active' : ''}" onclick="switchPhrSubTab('practice')">⚡ Practice</button>
      <button class="grammar-subtab ${_phrSubTab === 'colloc' ? 'active' : ''}" onclick="switchPhrSubTab('colloc')">🧩 Collocation</button>
      <button class="grammar-subtab ${_phrSubTab === 'lessons' ? 'active' : ''}" onclick="switchPhrSubTab('lessons')">📖 Lessons</button>
    </div>`;
  const body = _phrSubTab === 'lessons' ? renderPhrasesLessons()
    : (_phrSubTab === 'colloc' && typeof renderCollocHome === 'function') ? renderCollocHome()
    : renderPhrasesPractice();
  screen.innerHTML = `<div class="phrases-wrap">${bar}${body}</div>`;
}

function switchPhrSubTab(tab) {
  _phrSubTab = tab;
  renderPhrasesHome();
}

function renderPhrasesPractice() {
  const bank = phrasesBank();
  const counts = { verb: 0, adj: 0, noun: 0, phrase: 0 };
  bank.forEach(q => { counts[q.cat] = (counts[q.cat] || 0) + 1; });
  const catRows = Object.keys(PHRASES_CAT_LABELS).map(c =>
    `<div class="phrases-cat-row"><span>${PHRASES_CAT_ICON[c]} ${PHRASES_CAT_LABELS[c]}</span><strong>${counts[c] || 0}</strong></div>`
  ).join('');

  return `
      <div class="phrases-hero">
        <div class="phrases-hero-icon">🔗</div>
        <h1>Phrases</h1>
        <p class="phrases-sub">Master English prepositions — ${bank.length} questions across verb, adjective &amp; noun collocations and fixed phrases.</p>
      </div>

      <button class="phrases-cta" onclick="startPhrasesQuiz(20)">
        <span class="phrases-cta-icon">⚡</span>
        <span class="phrases-cta-text"><strong>Quick practice</strong><small>20 random questions</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <button class="phrases-cta" onclick="startPhrasesQuiz(10)">
        <span class="phrases-cta-icon">⏱️</span>
        <span class="phrases-cta-text"><strong>Short practice</strong><small>10 random questions</small></span>
        <span class="phrases-cta-arrow">›</span>
      </button>

      <details class="phrases-cats-wrap">
        <summary>Categories</summary>
        <div class="phrases-cats">${catRows}</div>
      </details>

      ${renderPhrasesReviewPanel()}
      ${renderPhrasesHistory()}`;
}

// Derive the study list from the verified question bank: every distinct
// collocation with its Vietnamese meaning and a complete example sentence
// (the quiz sentence with the blank filled by the correct preposition).
function phrasesLessonEntries() {
  const seen = new Set();
  const out = [];
  phrasesBank().forEach(q => {
    if (!q.phrase) return;
    const key = q.cat + '|' + q.phrase.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ cat: q.cat, phrase: q.phrase, vi: q.vi, example: q.q.replace('___', q.options[q.correct]) });
  });
  return out;
}

function renderPhrasesLessons() {
  const entries = phrasesLessonEntries();
  const groups = { verb: [], adj: [], noun: [], phrase: [] };
  entries.forEach(e => { (groups[e.cat] || (groups[e.cat] = [])).push(e); });
  Object.values(groups).forEach(a => a.sort((x, y) => x.phrase.localeCompare(y.phrase)));

  const sections = Object.keys(PHRASES_CAT_LABELS).map(cat => {
    const items = groups[cat].map(e => {
      const hay = (e.phrase + ' ' + e.vi).toLowerCase().replace(/["<>&]/g, ' ');
      return `
      <div class="phrases-lesson" data-search="${hay}">
        <div class="phrases-lesson-term">${phrEsc(e.phrase)}</div>
        <div class="phrases-lesson-vi">${phrEsc(e.vi)}</div>
        <div class="phrases-lesson-ex">“${phrEsc(e.example)}”</div>
      </div>`;
    }).join('');
    return `<div class="phrases-lesson-group" data-cat="${cat}">
        <div class="phrases-section-title">${PHRASES_CAT_ICON[cat]} ${PHRASES_CAT_LABELS[cat]} <span class="phrases-count">${groups[cat].length}</span></div>
        ${items}
      </div>`;
  }).join('');

  return `
      <div class="phrases-search-wrap">
        <input type="text" class="phrases-search" placeholder="🔍 Search a phrase or meaning…" oninput="filterPhrLessons(this.value)" autocomplete="off">
        <div class="phrases-search-count" id="phrLessonCount">${entries.length} phrases</div>
      </div>
      <div id="phrLessonList">${sections}</div>`;
}

// Live filter the lesson list in-place (keeps the search box focused).
function filterPhrLessons(query) {
  const q = (query || '').trim().toLowerCase();
  const list = document.getElementById('phrLessonList');
  if (!list) return;
  let shown = 0;
  list.querySelectorAll('.phrases-lesson-group').forEach(group => {
    let groupShown = 0;
    group.querySelectorAll('.phrases-lesson').forEach(el => {
      const match = !q || (el.getAttribute('data-search') || '').indexOf(q) !== -1;
      el.style.display = match ? '' : 'none';
      if (match) { groupShown++; shown++; }
    });
    group.style.display = groupShown ? '' : 'none';
  });
  const cnt = document.getElementById('phrLessonCount');
  if (cnt) cnt.textContent = shown + (shown === 1 ? ' phrase' : ' phrases');
}

// "Words to review" — collocations the user has gotten wrong, with a CTA to drill them.
function renderPhrasesReviewPanel() {
  const wrong = phrasesWrongAggregate();
  if (!wrong.length) return '';
  const chips = wrong.slice(0, 10).map(w =>
    `<span class="phrases-word-chip">${phrEsc(w.q.phrase || w.q.options[w.q.correct])}<i>${w.misses}×</i></span>`
  ).join('');
  const qids = wrong.map(w => w.q.id);
  return `
    <div class="phrases-review-words">
      <div class="phrases-section-title">📉 Words to review <span class="phrases-count">${wrong.length}</span></div>
      <div class="phrases-word-chips">${chips}</div>
      <button class="phrases-cta-secondary phrases-review-btn" onclick='startPhrasesReviewQuiz(${JSON.stringify(qids)})'>
        🔁 Practice wrong answers (${qids.length})
      </button>
    </div>`;
}

// History list with score-tier filter chips (mirrors the Grammar tab).
function renderPhrasesHistory() {
  const hist = phrasesHistory();
  if (!hist.length) {
    return `<div class="phrases-section-title">📜 History</div>
      <div class="phrases-empty">No practice yet — tap <strong>Quick practice</strong> to start.</div>`;
  }

  const tierChips = ['all', 'perfect', 'great', 'ok', 'weak'].map(t =>
    `<button class="filter-chip ${_phrHistoryFilter === t ? 'active' : ''}" onclick="setPhrHistoryFilter('${t}')">${PHRASES_TIER_LABELS[t]}</button>`
  ).join('');

  let sessions = hist.map((s, idx) => ({ s, idx }));
  if (_phrHistoryFilter !== 'all') {
    sessions = sessions.filter(({ s }) => phrTier(Math.round((s.score / s.total) * 100)) === _phrHistoryFilter);
  }

  const list = sessions.length === 0
    ? `<div class="phrases-empty">No sessions match this filter.</div>`
    : sessions.map(({ s, idx }) => {
        const pct = Math.round((s.score / s.total) * 100);
        const tier = phrTier(pct);
        const wrongN = (s.wrong || []).length;
        const when = s.date ? new Date(s.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : (s.when || '');
        return `
          <div class="grammar-history-item history-tier-${tier}" onclick="openPhrSession(${idx})">
            <div class="grammar-history-emoji">${phrTierEmoji(pct)}</div>
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

function setPhrHistoryFilter(tier) {
  _phrHistoryFilter = tier;
  renderPhrasesHome();
}

// ---- review a past session: show the wrong questions read-only ----
function openPhrSession(idx) {
  const screen = document.getElementById('phrasesScreen');
  const s = phrasesHistory()[idx];
  if (!screen || !s) return;
  const pct = Math.round((s.score / s.total) * 100);
  const wrong = (s.wrong || []).map(w => ({ q: phrasesById(w.qid), ua: w.ua })).filter(x => x.q);

  const items = wrong.length
    ? wrong.map(({ q, ua }) => `
        <div class="grammar-review-item wrong">
          <div class="grammar-review-q">${phrEsc(q.q).replace('___', `[${phrEsc(phrRightText(q))}]`)}</div>
          <div class="phrases-review-line">Your answer: <s>${phrEsc(phrGivenText(q, ua))}</s> · Correct: <b>${phrEsc(phrRightText(q))}</b></div>
          <div class="phrases-vi">📘 ${phrEsc(q.vi)}</div>
          <div class="grammar-review-explain">${phrEsc(q.explanation)}</div>
        </div>`).join('')
    : `<div class="phrases-empty">🎉 No mistakes in this session — perfect score!</div>`;

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="renderPhrasesHome()">‹</button>
        <span class="grammar-quiz-progress">${phrTierEmoji(pct)} ${s.score}/${s.total} (${pct}%)</span>
      </div>
      <div class="phrases-section-title">Review${wrong.length ? ` · ${wrong.length} wrong` : ''}</div>
      ${items}
      ${wrong.length ? `<button class="phrases-cta-secondary phrases-review-btn" onclick='startPhrasesReviewQuiz(${JSON.stringify(wrong.map(w => w.q.id))})'>🔁 Re-practice these (${wrong.length})</button>` : ''}
    </div>`;
}

// ---- quiz lifecycle ----
function startPhrasesQuiz(n) {
  if (typeof retryGate === 'function' && retryGate('phr')) return;
  const bank = phrasesBank();
  if (!bank.length) return;
  let qs;
  if (n === 'all') {
    qs = bank.slice();
  } else {
    const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
    const size = Math.min(n, bank.length);
    // Phrases this child has missed before come first, up to half the
    // practice, until each is answered right five times running
    // (js/wrong-priority.js); the rest is the usual seeded draw.
    const picked = (typeof prioPick === 'function')
      ? prioPick('phr', bank, size)
      : phrShuffle(bank, seed).slice(0, size);
    // Turn a fixed number of the picks into TYPED variants — 1 in 10, 2 in 20.
    // A variant replaces its multiple-choice form rather than being added, so
    // the practice stays the length the button promised. The conversion runs
    // on a re-shuffle so it is not always the first questions that are typed.
    const order = phrShuffle(picked.map((_, i) => i), seed ^ 0x5bf03635);
    const wantTyped = phrTypedTarget(size, picked.length);
    const typedAt = new Set(order.slice(0, wantTyped));
    qs = picked.map((q, i) => (typedAt.has(i) && phrTypedQuestion(q)) || q);
  }
  // Every base question is followed by its Vietnamese meaning question.
  qs = phrExpandPairs(qs);
  _phrQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null), qs: (n === 'all' ? 'all' : Number(n)) };
  renderPhrQuestion();
}

// Re-practice a specific set of questions (by id) — used by the review CTAs.
function startPhrasesReviewQuiz(qids) {
  if (typeof retryGate === 'function' && retryGate('phr')) return;
  const ids = Array.isArray(qids) ? qids : [];
  const seed = (typeof Date !== 'undefined') ? (Date.now() & 0x7fffffff) : 1;
  const qs = phrShuffle(ids.map(phrasesById).filter(Boolean), seed);
  if (!qs.length) return;
  _phrQuiz = { questions: qs, idx: 0, answers: new Array(qs.length).fill(null) };
  renderPhrQuestion();
}

function isPhrasesQuizActive() { return !!_phrQuiz; }
function abandonPhrasesQuiz() { _phrQuiz = null; }

// SILENT teardown for a profile change. The quiz is A's work — see
// js/units.js unitsForgetProfile for why nothing else clears it — and the
// sub-tab and tier filter are where A left the tab standing.
function phrasesForgetProfile() {
  abandonPhrasesQuiz();
  _phrHistoryFilter = 'all';
  _phrSubTab = 'practice';
}

// The ✕ sits exactly where a thumb rests while tapping answers, and it used to
// bin the whole round on a single touch with nothing said. Ask first — but only
// when there is work to lose, so starting and changing your mind stays free.
function phrAnsweredCount() {
  return _phrQuiz ? _phrQuiz.answers.filter(a => a !== null).length : 0;
}
function quitPhrasesQuiz() {
  const st = _phrQuiz;
  if (st) {
    const done = phrAnsweredCount();
    if (done && typeof confirm === 'function'
      && !confirm(`You are ${done}/${st.questions.length} through this Phrases practice.\n`
        + 'If you leave now, your progress will be lost.\n\nLeave anyway?')) return;
  }
  abandonPhrasesQuiz();
  renderPhrasesHome();
}

// What sits under a revealed answer: the listen gate, or a plain Next.
//
// A meaning follow-up ("What is the meaning of …?") is answered in Vietnamese.
// There is no English to pronounce there, so requiring a listen would block the
// student behind a step that teaches nothing. Every other question hides Next
// until the collocation has been heard.
function phrFooterHTML(q, nextLabel) {
  if (q.meaning) {
    return '<button class="grammar-next-btn" onclick="nextPhrQuestion()">' + nextLabel + '</button>';
  }
  // q.phrase is the collocation being learned ("rise in"); q.answer is only
  // its preposition, which says nothing on its own.
  return answerGateHTML(q.phrase || q.answer || (q.options && q.options[q.correct]),
                        'nextPhrQuestion()', nextLabel);
}

function renderPhrQuestion() {
  const screen = document.getElementById('phrasesScreen');
  if (!screen || !_phrQuiz) return;
  const st = _phrQuiz;
  const q = st.questions[st.idx];
  // Warm this question's words now: they become tappable once answered.
  if (typeof twPrefetch === 'function') twPrefetch(q.q, q.options || [], q.explanation);
  const userAns = st.answers[st.idx];
  const answered = userAns !== null;
  const total = st.questions.length;
  // Speak the whole collocation, once, the moment it is revealed — "rise in",
  // not the bare "in" the student typed. The preposition alone teaches nothing;
  // the phrase is the thing being learned.
  //
  // A meaning follow-up ("What is the meaning of …?") is answered in
  // Vietnamese, so there is no English to pronounce and nothing to gate.
  if (answered && !q.meaning && st._spokenIdx !== st.idx) {
    st._spokenIdx = st.idx;
    if (typeof speakAnswer === 'function') speakAnswer(q.phrase || q.answer || (q.options && q.options[q.correct]), { auto: true });
  }

  // After answering, every English word becomes tappable (voice + nghĩa).
  const wrap = (s) => (answered && typeof tapwordsWrap === 'function') ? tapwordsWrap(s) : phrEsc(s);
  const qHtml = wrap(q.q).replace('___', '<span class="phrases-blank">_____</span>');

  // A typed variant has no options to render — it gets an input instead.
  // Answers are stored as the raw string for typed questions and as the chosen
  // INDEX for multiple-choice, so `phrIsCorrect` below is the one place that
  // knows the difference.
  const opts = q.typed ? '' : q.options.map((opt, i) => {
    let cls = 'grammar-option';
    if (answered) {
      if (i === q.correct) cls += ' correct';
      else if (i === userAns) cls += ' wrong';
    }
    const letter = String.fromCharCode(65 + i);
    // No disabled attr — it would swallow taps on the words inside;
    // answerPhrQuestion ignores repeat answers itself.
    return `<button class="${cls}" onclick="answerPhrQuestion(${i})">
      <span class="grammar-option-letter">${letter}</span>
      <span class="grammar-option-text">${wrap(opt)}</span>
    </button>`;
  }).join('');

  const typedBox = !q.typed ? '' : (answered
    ? `<div class="wf-text-answer ${phrIsCorrect(userAns, q) ? 'correct' : 'wrong'}">
         <span class="wf-text-answer-label">Bé gõ:</span>
         <span class="wf-text-answer-value">${userAns ? phrEsc(userAns) : '<em>(chưa gõ)</em>'}</span>
       </div>`
    : `<div class="wf-text-wrap">
         <input type="text" id="phrTextInput" class="wf-text-input" enterkeyhint="go"
                placeholder="Gõ từ còn thiếu…" autocomplete="off" autocapitalize="off" spellcheck="false"
                onkeydown="if(event.key==='Enter'){event.preventDefault();submitPhrTextAnswer();}">
         <button class="wf-text-submit" onclick="submitPhrTextAnswer()">Check</button>
       </div>`);

  let explain = '';
  if (answered) {
    const ok = phrIsCorrect(userAns, q);
    explain = `<div class="grammar-explanation ${ok ? 'correct' : 'wrong'}">
      <div class="phrases-vi">📘 ${phrEsc(q.vi)}</div>
      ${!ok && q.typed ? `<div>❌ Đáp án đúng: <b>${phrEsc(q.answer)}</b></div>` : ''}
      <div>${ok ? '✅ ' : (q.typed ? '' : '❌ ')}${phrEsc(q.explanation)}</div>
    </div>
    ${phrFooterHTML(q, st.idx + 1 < total ? 'Next →' : 'See results')}`;
  }

  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-quiz-header phrases-quiz-header">
        <button class="grammar-back-btn" onclick="quitPhrasesQuiz()">✕</button>
        <span class="grammar-quiz-progress">${st.idx + 1}/${total}</span>
        <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round(((st.idx) / total) * 100)}%"></div></div>
      </div>
      <div class="grammar-question-card">
        <div class="grammar-question-tag">${q.meaning ? '💡 Meaning · Nghĩa của cụm từ' : `${PHRASES_CAT_ICON[q.cat]} ${PHRASES_CAT_LABELS[q.cat]}`}</div>
        <div class="grammar-question-text">${qHtml}</div>
        ${q.typed ? typedBox : `<div class="grammar-options">${opts}</div>`}
        ${explain}
      </div>
    </div>`;
  // The screen and the checkpoint change together (js/app.js).
  if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
}

// Multiple-choice answers are stored as the chosen index; typed answers as the
// string the child typed. Everything else asks HERE rather than comparing to
// q.correct directly — a typed question has no `correct` index at all, so a
// bare `answers[i] === q.correct` would mark every one of them wrong.
function phrIsCorrect(ans, q) {
  if (!q) return false;
  if (q.typed) return typeof ans === 'string' && _phrTextCorrect(ans, q);
  return ans === q.correct;
}

// A wrong answer arrives in one of two shapes: an option INDEX from a
// multiple-choice question, or the TEXT a child typed. A typed question has
// `answer` and NO `options`, so the review markup's `q.options[q.correct]`
// threw a TypeError on it — and because that happened while building the
// result screen, the practice could never finish: the screen froze, the child
// tapped "see result" again, and every tap re-paid the coins and appended
// another identical session. Read both shapes through here.
function phrRightText(q) {
  if (!q) return '—';
  if (q.typed) return String(q.answer || '—');
  const list = q.options || [];
  return String(list[q.correct] != null ? list[q.correct] : (q.answer || '—'));
}
function phrGivenText(q, ua) {
  if (ua == null || ua === '') return '—';
  if (q && q.typed) return String(ua).trim() || '—';
  const list = (q && q.options) || [];
  return String(list[ua] != null ? list[ua] : ua);
}

function phrasesSkillSummaries(st) {
  const rows = {};
  const add = (key, label, ok, ref) => {
    const row = rows[key] || (rows[key] = { skillKey:key, skillLabel:label, attempts:0, correct:0, wrong:0, skipped:0, wrongRefs:[] });
    row.attempts++;
    if (ok === null) row.skipped++;
    else if (ok) row.correct++;
    else { row.wrong++; if (row.wrongRefs.length < 20) row.wrongRefs.push(String(ref || '')); }
  };
  st.questions.forEach((q, i) => {
    const mode = q.meaning ? 'meaning' : (q.typed ? 'typed' : 'choice');
    const modeLabel = q.meaning ? 'Hiểu nghĩa' : (q.typed ? 'Tự gõ giới từ' : 'Chọn giới từ');
    const cat = q.cat || 'phrase';
    const ans = st.answers[i];
    add('phrases.' + cat + '.' + mode,
      (PHRASES_CAT_LABELS[cat] || 'Phrases') + ' · ' + modeLabel,
      ans === null || ans === undefined || ans === '' ? null : phrIsCorrect(ans, q), q.id);
  });
  return Object.keys(rows).map(k => rows[k]);
}

function submitPhrTextAnswer() {
  const st = _phrQuiz;
  if (!st) return;
  const q = st.questions[st.idx];
  if (!q || !q.typed || st.answers[st.idx] !== null) return;
  const inp = document.getElementById('phrTextInput');
  st.answers[st.idx] = inp ? String(inp.value).trim() : '';
  if (typeof petCheerAnswer === 'function') petCheerAnswer(phrIsCorrect(st.answers[st.idx], q));
  renderPhrQuestion();
}

function answerPhrQuestion(i) {
  const st = _phrQuiz;
  if (!st) return;
  if (st.answers[st.idx] !== null) return;
  if (st.questions[st.idx] && st.questions[st.idx].typed) return;   // typed: use submitPhrTextAnswer
  st.answers[st.idx] = i;
  if (typeof petCheerAnswer === 'function') petCheerAnswer(phrIsCorrect(i, st.questions[st.idx]));
  renderPhrQuestion();
}

function nextPhrQuestion() {
  const st = _phrQuiz;
  if (!st) return;
  if (st.idx + 1 < st.questions.length) { st.idx++; renderPhrQuestion(); }
  else finishPhrasesQuiz();
}

function finishPhrasesQuiz() {
  const st = _phrQuiz;
  if (!st) return;
  // Claim the practice BEFORE paying or rendering. This used to be the LAST
  // line of the function, so anything that threw in between (a typed question
  // in the review list, a full disk, a missing screen) left the quiz "active":
  // the child saw no result, tapped again, and was paid AND recorded again —
  // the duplicate rows and inflated balance in the admin timeline.
  _phrQuiz = null;
  // No round left → the checkpoint is cleared at once (js/app.js), so a
  // finished one is never offered back after a reload and paid for twice.
  if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
  const total = st.questions.length;
  let score = 0;
  const wrong = [];
  st.questions.forEach((q, i) => {
    if (phrIsCorrect(st.answers[i], q)) score++;
    else wrong.push({ qid: q.id, ua: st.answers[i] });
  });
  const pct = total ? Math.round((score / total) * 100) : 0;

  // Reward coins for the pet shop: 5 per correct answer (matches Grammar).
  const coinsEarned = score * 5 + (typeof petComboBonus === 'function' ? petComboBonus() : 0);
  if (typeof appState !== 'undefined' && appState) appState.coins = (appState.coins || 0) + coinsEarned;
  // Streak: any completed practice counts as a study event for the day.
  if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }

  let date = 0;
  try { date = Date.now(); } catch (e) { date = 0; }
  savePhrasesSession({ id: 'phr-' + date, date, score, total, wrong, qs: st.qs, skills: phrasesSkillSummaries(st) });

  // Owe every missed PHRASE question back — never a meaning check (pm-…).
  // The drill types the English preposition; a meaning question's answer is
  // Vietnamese, and the drill renders it as one text box, so a missed pm-…
  // used to lock every Phrases practice behind a question nobody could type.
  // After the coins, so a mistake never feels like it took away what was
  // just earned.
  if (typeof retryAdd === 'function') retryAdd('phr', wrong.map(w => phrasesById(w.qid)).filter(q => q && !q.meaning));
  // The silent priority list (js/wrong-priority.js): phrase questions only —
  // a typed variant (pt-…) counts for its base phrase, a meaning check (pm-…)
  // is not tracked, like the owed drill.
  // Placed AFTER retryAdd on purpose: a test in tests/retry-drill.test.js
  // searches a fixed 3000-character window from the start of this function
  // for the retryAdd call, so nothing new may be inserted ahead of it.
  if (typeof prioRecord === 'function') {
    const baseId = q => q.baseId || q.id;
    prioRecord('phr',
      st.questions.filter((q, i) => !q.meaning && phrIsCorrect(st.answers[i], q)).map(baseId),
      st.questions.filter((q, i) => !q.meaning && !phrIsCorrect(st.answers[i], q)).map(baseId));
  }

  // Sync phrases-practice activity to the server (best-effort) for the admin view.
  if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

  const reviewHtml = wrong.map(w => {
    const q = phrasesById(w.qid);
    if (!q) return '';
    return `
    <div class="grammar-review-item wrong">
      <div class="grammar-review-q">${phrEsc(q.q).replace('___', `[${phrEsc(phrRightText(q))}]`)}</div>
      <div class="phrases-review-line">Your answer: <s>${phrEsc(phrGivenText(q, w.ua))}</s> · Correct: <b>${phrEsc(phrRightText(q))}</b></div>
      <div class="phrases-vi">📘 ${phrEsc(q.vi)}</div>
      <div class="grammar-review-explain">${phrEsc(q.explanation)}</div>
    </div>`;
  }).join('');

  const screen = document.getElementById('phrasesScreen');
  const emoji = phrTierEmoji(pct);
  screen.innerHTML = `
    <div class="phrases-wrap">
      <div class="grammar-result-card">
        <div class="grammar-result-emoji">${emoji}</div>
        <h2>${score} / ${total}</h2>
        <div class="grammar-result-pct">${pct}%</div>
        <p>${pct >= 80 ? 'Excellent preposition skills!' : (pct >= 50 ? 'Good work — keep practising.' : 'Keep going — prepositions take practice.')}</p>
        <button class="phrases-cta-secondary" onclick="_phrQuiz=null; renderPhrasesHome()">Done</button>
      </div>
      ${typeof petRewardCardHTML === 'function' ? petRewardCardHTML(score, total, coinsEarned) : (coinsEarned ? `<div class="grammar-result-coins">+${coinsEarned} 🪙 earned</div>` : '')}
      ${wrong.length ? `<div class="phrases-section-title">Review · ${wrong.length} wrong</div>${reviewHtml}
        <button class="phrases-cta-secondary phrases-review-btn" onclick='startPhrasesReviewQuiz(${JSON.stringify(wrong.map(w => w.qid))})'>🔁 Re-practice these (${wrong.length})</button>` : ''}
    </div>`;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderPhrasesHome, startPhrasesQuiz, startPhrasesReviewQuiz, answerPhrQuestion,
    // A practice mixes CHOSEN and TYPED questions, so a caller that can meet
    // either needs both ways in. Exported for the tests; the page calls the
    // global directly.
    submitPhrTextAnswer,
    nextPhrQuestion, finishPhrasesQuiz, isPhrasesQuizActive, abandonPhrasesQuiz, phrasesForgetProfile, quitPhrasesQuiz, phrAnsweredCount,
    setPhrHistoryFilter, openPhrSession,
    switchPhrSubTab, renderPhrasesLessons, phrasesLessonEntries, filterPhrLessons,
    phrMeaningQuestion, phrExpandPairs, phrasesById, savePhrasesSession,
  };
}

// ---- owed questions: every question missed must be typed back ----
// Shared engine in js/retrydrill.js; this only describes a phrases question.
// The drill is harder than the quiz: the preposition is TYPED, not chosen.
if (typeof defineRetryDrill === 'function') defineRetryDrill({
  key: 'phr',
  screenId: 'phrasesScreen',
  noun: 'câu',
  // Meaning checks (pm-…) are never owed — and any that a previous build
  // already persisted resolve to null here, so the engine drops them from the
  // queue instead of wedging the gate shut on an unanswerable question.
  resolve: (id) => {
    const q = phrasesById(id);
    return (q && q.meaning) ? null : q;
  },
  idOf: (q) => q.id,
  answerText: (q) => (q.options && q.options[q.correct] != null) ? q.options[q.correct] : String(q.answer || ''),
  grade: (v, q) => {
    // Diacritic-insensitive on BOTH sides. The old normaliser stripped
    // anything outside [a-z0-9 ] AFTER an NFC compose, so "tăng lên" became
    // the stub "tng ln": typing it back with every accent in place still
    // matched (both sides collapsed alike), but "tang len" — what a child
    // types on a keyboard with no Vietnamese input — never could. Decomposing
    // first keeps the base letters, so both spellings pass.
    const norm = (x) => String(x || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd')
      .replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    const want = (q.options && q.options[q.correct] != null) ? q.options[q.correct] : q.answer;
    const got = norm(v);
    return !!got && got === norm(want);
  },
  promptHTML: (q) => `<div class="grammar-question-text">${phrEsc(q.q).replace('___', '<b class="wf-retry-gap">___</b>')}</div>`,
  explainHTML: (q) => `<div class="grammar-review-explain">📘 ${phrEsc(q.vi || '')}<br>💡 ${phrEsc(q.explanation || '')}</div>`,
  home: () => renderPhrasesHome(),
});
function phrRetryCount() { return (typeof retryCount === 'function' ? retryCount('phr') : 0); }
