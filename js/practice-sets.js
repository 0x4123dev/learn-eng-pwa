// practice-sets.js — three PTNK-format practice menus on the exam engine.
//
//   📖 Đọc hiểu      readingScreen   js/reading-data.js  (READING_PASSAGES)
//   ✏️ Điền từ        clozeScreen     js/cloze-data.js    (CLOZE_PASSAGES)
//   🔍 Tìm lỗi sai    errorsScreen    js/errors-data.js   (ERROR_ITEMS)
//   🧩 Grammar & Vocabulary  grammarVocabScreen  js/grammar-vocab-data.js (GRAMMAR_VOCAB_ITEMS)
//   🔊 Phonetics & Stress    phoneticsScreen     js/phonetics-data.js + js/phonetics-lessons.js
//
// Why these three exist: a review of the eleven real PTNK papers against the
// practice menus found that reading comprehension (24% of a Không chuyên
// paper, 18% of Chuyên), passage-level cloze / open cloze (10% / 29%) and
// error identification (8% / 4%) were trained by nothing in the app. Every
// other section had a menu. These are the gaps, in size order. The fourth,
// Grammar & Vocabulary, came after the Chuyên tiers: the paper's "Language
// use" section — one sentence, one blank, four options, every focus mixed —
// is the largest section of both papers (23% / 31%), and Grammar, Phrases
// and Collocation each drilled one slice of it, never the mix.
//
// Why they run on js/exam.js rather than on three new quiz engines: the
// engine already draws a passage above a question, grades mcq / tf / text,
// keeps a clock, shows an explanation after each answer, records history and
// lets a child review a past attempt. What a menu adds is a SET — its
// screen, its bank, where its history lives, what it pays — and a home
// screen. js/ptnk.js did the same for the real papers; this file does it
// three times over.
//
// The one idea worth knowing: a "paper" here is built on demand from the
// bank by the set's `lookup(id)`. A reading passage's id IS its paper id. An
// error round's id carries the ids of its ten items ("er-round-kc:er-kc-01-3,
// …"), so the round a child sat last week can be rebuilt for review from
// the bank alone, with nothing else stored.

const PRACTICE_COINS_PER_CORRECT = 5;   // the rate every English practice tab pays
const PRACTICE_HISTORY_CAP = 100;
const ERRORS_ROUND_SIZE = 10;
// Fifteen: a Không chuyên paper sets 11–20 of these, Chuyên 30–50; a round
// should feel like a paper's section without becoming the whole paper.
const GRAMMAR_VOCAB_ROUND_SIZE = 15;
// Five pronunciation + five stress: the Không chuyên paper opens with 2–3 of
// one and 2 of the other; a round is two papers' worth, sound first like the paper.
const PHONETICS_ROUND_SIZE = 10;
// Minutes: enough to read carefully, short enough to stay a practice.
const PRACTICE_MINUTES = { reading: { kc: 10, ch: 15 }, cloze: { kc: 8, ch: 10 }, errors: { kc: 8, ch: 8 }, grammarvocab: { kc: 10, ch: 12 }, phonetics: { kc: 5, ch: 6 } };

function practiceLevelLabel(level) { return level === 'ch' ? 'Chuyên' : 'Không chuyên'; }
function practiceEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ---- history on appState, one array per menu -------------------------------
// On appState (not in a localStorage key of its own) for the same reason as
// PTNK: js/auth.js uploads what is on appState, and a daily task is matched
// against those uploads.
// Each history is named LITERALLY here (appState.readingHistory, not
// appState[key]): tests/cross-boundary-drift.test.js finds every history the
// app writes by grepping for `appState.<name>History` and then demands that
// js/auth.js uploads each one. Reached through a variable, a history is
// invisible to that guard on both sides — it would neither be listed nor be
// noticed missing, which is precisely the silent failure the guard exists for.
function practiceHistory(key) {
    if (typeof appState === 'undefined' || !appState) return [];
    if (key === 'readingHistory') { if (!Array.isArray(appState.readingHistory)) appState.readingHistory = []; return appState.readingHistory; }
    if (key === 'clozeHistory') { if (!Array.isArray(appState.clozeHistory)) appState.clozeHistory = []; return appState.clozeHistory; }
    if (key === 'errorsHistory') { if (!Array.isArray(appState.errorsHistory)) appState.errorsHistory = []; return appState.errorsHistory; }
    if (key === 'grammarVocabHistory') { if (!Array.isArray(appState.grammarVocabHistory)) appState.grammarVocabHistory = []; return appState.grammarVocabHistory; }
    if (key === 'phoneticsHistory') { if (!Array.isArray(appState.phoneticsHistory)) appState.phoneticsHistory = []; return appState.phoneticsHistory; }
    return [];
}
function practiceSaveHistory(key, list) {
    if (typeof appState === 'undefined' || !appState) return false;
    if (key === 'readingHistory') appState.readingHistory = list;
    else if (key === 'clozeHistory') appState.clozeHistory = list;
    else if (key === 'errorsHistory') appState.errorsHistory = list;
    else if (key === 'grammarVocabHistory') appState.grammarVocabHistory = list;
    else if (key === 'phoneticsHistory') appState.phoneticsHistory = list;
    else return false;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
        try { saveUserData(currentUser, appState); } catch (e) { return false; }
    }
    return true;
}
function practiceBest(key, examId) {
    const runs = practiceHistory(key).filter(h => h && h.examId === examId && h.total);
    if (!runs.length) return null;
    return runs.reduce((b, h) => Math.max(b, Math.round(h.score / h.total * 100)), 0);
}

// ---- banks -------------------------------------------------------------------
function readingBank() { return (typeof READING_PASSAGES !== 'undefined' && Array.isArray(READING_PASSAGES)) ? READING_PASSAGES : []; }
function clozeBank() { return (typeof CLOZE_PASSAGES !== 'undefined' && Array.isArray(CLOZE_PASSAGES)) ? CLOZE_PASSAGES : []; }
function errorsBank() { return (typeof ERROR_ITEMS !== 'undefined' && Array.isArray(ERROR_ITEMS)) ? ERROR_ITEMS : []; }
function phoneticsBank() { return (typeof PHONETICS_ITEMS !== 'undefined' && Array.isArray(PHONETICS_ITEMS)) ? PHONETICS_ITEMS : []; }
function phoneticsLessons() { return (typeof PHONETICS_LESSONS !== 'undefined' && Array.isArray(PHONETICS_LESSONS)) ? PHONETICS_LESSONS : []; }
function grammarVocabBank() { return (typeof GRAMMAR_VOCAB_ITEMS !== 'undefined' && Array.isArray(GRAMMAR_VOCAB_ITEMS)) ? GRAMMAR_VOCAB_ITEMS : []; }

const READING_KIND_LABEL = {
    'main-idea': 'Main idea', detail: 'Detail', inference: 'Inference', vocab: 'Vocabulary',
    reference: 'Reference', purpose: 'Purpose', tfng: 'True / False / Not Given',
    section: 'Which section?', gap: 'Missing sentence',
};

// A passage → the paper the engine runs. Every question carries the passage,
// because the engine draws one question at a time and has no other way to
// show it. `section` on a question is the tag the engine prints above it.
function readingPaper(ps) {
    if (!ps) return null;
    return {
        id: ps.id,
        title: ps.title,
        subtitle: 'Reading · ' + practiceLevelLabel(ps.level) + ' · ' + practiceEsc(ps.topic),
        durationMin: PRACTICE_MINUTES.reading[ps.level] || 10,
        questions: ps.questions.map((q, i) => Object.assign({}, q, {
            n: i + 1, passage: ps.passage, section: READING_KIND_LABEL[q.kind] || 'Đọc hiểu',
        })),
    };
}
function clozePaper(ps) {
    if (!ps) return null;
    return {
        id: ps.id,
        title: ps.title,
        subtitle: (ps.mode === 'open' ? 'Open cloze' : 'Cloze') + ' · ' + practiceLevelLabel(ps.level) + ' · ' + practiceEsc(ps.topic),
        durationMin: PRACTICE_MINUTES.cloze[ps.level] || 8,
        questions: ps.questions.map((q, i) => Object.assign({}, q, {
            n: i + 1, passage: ps.passage, section: ps.mode === 'open' ? 'Open cloze' : 'Cloze',
        })),
    };
}

// An error round. The id carries the item ids so the round can be rebuilt
// later; drawing is Fisher–Yates over the level's items.
function errorsRoundId(level, ids) { return 'er-round-' + level + ':' + ids.join(','); }
function errorsDraw(level, rand) {
    const r = rand || Math.random;
    const pool = errorsBank().filter(it => it && it.level === level).slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, ERRORS_ROUND_SIZE).map(it => it.id);
}
function errorsPaperFromIds(level, ids) {
    const byId = new Map(errorsBank().map(it => [it.id, it]));
    const items = ids.map(id => byId.get(id)).filter(Boolean);
    if (!items.length) return null;
    return {
        id: errorsRoundId(level, ids),
        title: 'Error Correction · ' + practiceLevelLabel(level),
        subtitle: items.length + ' sentences · one of the four underlined parts is wrong',
        durationMin: PRACTICE_MINUTES.errors[level] || 8,
        questions: items.map((it, i) => ({
            n: i + 1, type: 'mcq', section: 'Error correction',
            q: it.q, options: it.options, correct: it.correct,
            explanation: '<b>Correction:</b> ' + practiceEsc(it.correction) + '<br>' + it.explanation,
        })),
    };
}
function errorsLookup(examId) {
    const m = /^er-round-(kc|ch):(.+)$/.exec(String(examId || ''));
    if (!m) return null;
    return errorsPaperFromIds(m[1], m[2].split(',').filter(Boolean));
}

// A Grammar & Vocabulary round: the same id-carrying shape as an error round.
// The draw is stratified by focus — one item per focus first, then the rest
// at random — so a round mixes tenses, idioms, phrasal verbs and the rest the
// way the paper's section does, rather than landing five tense items in a
// row from a bank where tense is the largest focus.
const GRAMMAR_VOCAB_FOCUS_LABEL = {
    tense: 'Tenses', modal: 'Modal verbs', conditional: 'Conditionals & wishes', passive: 'Passive voice',
    reported: 'Reported speech', relative: 'Relative clauses', 'article-quantifier': 'Articles & quantifiers',
    preposition: 'Prepositions', 'phrasal-verb': 'Phrasal verbs', idiom: 'Idioms', collocation: 'Collocations',
    'word-choice': 'Word choice', linking: 'Linking words', comparison: 'Comparison',
    'gerund-infinitive': 'Gerund or infinitive', inversion: 'Inversion', subjunctive: 'Subjunctive',
    participle: 'Participle clauses', agreement: 'Subject–verb agreement', pronoun: 'Pronouns',
    'question-tag': 'Question tags', 'double-blank': 'Two blanks', other: 'Language use',
};
function grammarVocabRoundId(level, ids) { return 'gv-round-' + level + ':' + ids.join(','); }
function grammarVocabDraw(level, rand) {
    const r = rand || Math.random;
    const pool = grammarVocabBank().filter(it => it && it.level === level).slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    const seenFocus = new Set(), first = [], rest = [];
    for (const it of pool) {
        if (seenFocus.has(it.focus)) rest.push(it); else { seenFocus.add(it.focus); first.push(it); }
    }
    return first.concat(rest).slice(0, GRAMMAR_VOCAB_ROUND_SIZE).map(it => it.id);
}
function grammarVocabPaperFromIds(level, ids) {
    const byId = new Map(grammarVocabBank().map(it => [it.id, it]));
    const items = ids.map(id => byId.get(id)).filter(Boolean);
    if (!items.length) return null;
    return {
        id: grammarVocabRoundId(level, ids),
        title: 'Grammar & Vocabulary · ' + practiceLevelLabel(level),
        subtitle: items.length + ' sentences · choose the option that fits the blank',
        durationMin: PRACTICE_MINUTES.grammarvocab[level] || 10,
        questions: items.map((it, i) => ({
            n: i + 1, type: 'mcq', section: GRAMMAR_VOCAB_FOCUS_LABEL[it.focus] || 'Language use',
            q: it.q, options: it.options, correct: it.correct,
            explanation: it.explanation + (it.vi ? '<br><i>' + practiceEsc(it.vi) + '</i>' : ''),
        })),
    };
}
function grammarVocabLookup(examId) {
    const m = /^gv-round-(kc|ch):(.+)$/.exec(String(examId || ''));
    if (!m) return null;
    return grammarVocabPaperFromIds(m[1], m[2].split(',').filter(Boolean));
}

// A Phonetics & Stress round: five "odd one out" pronunciation items, then
// five word-stress items, drawn from the level's pools. The paper's own
// instruction is the question stem; `hear` lists the four words with their
// IPA so the engine can offer a 🔊 for each once the item is answered — in a
// pronunciation drill, hearing the words IS the lesson.
const PHONETICS_STEM = {
    sound: 'Choose the word whose underlined part is pronounced differently from the others.',
    stress: 'Choose the word whose primary stress is placed differently from the others.',
};
function phoneticsRoundId(level, ids) { return 'ph-round-' + level + ':' + ids.join(','); }
function phoneticsDraw(level, rand) {
    const r = rand || Math.random;
    const shuffled = (pool) => {
        const a = pool.slice();
        for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; }
        return a;
    };
    const half = PHONETICS_ROUND_SIZE / 2;
    const bank = phoneticsBank().filter(it => it && it.level === level);
    const sound = shuffled(bank.filter(it => it.kind === 'sound')).slice(0, half);
    const stress = shuffled(bank.filter(it => it.kind === 'stress')).slice(0, half);
    return sound.concat(stress).map(it => it.id);
}
function phoneticsPaperFromIds(level, ids) {
    const byId = new Map(phoneticsBank().map(it => [it.id, it]));
    const items = ids.map(id => byId.get(id)).filter(Boolean);
    if (!items.length) return null;
    return {
        id: phoneticsRoundId(level, ids),
        title: 'Phonetics & Stress · ' + practiceLevelLabel(level),
        subtitle: items.length + ' words to compare · pronunciation first, then stress',
        durationMin: PRACTICE_MINUTES.phonetics[level] || 5,
        questions: items.map((it, i) => ({
            n: i + 1, type: 'mcq', section: it.kind === 'stress' ? 'Stress' : 'Phonetics',
            q: PHONETICS_STEM[it.kind] || PHONETICS_STEM.sound,
            options: it.options, correct: it.correct,
            explanation: it.explanation,
            hear: (it.words || []).map((w, k) => ({ word: w, ipa: (it.ipa || [])[k] || '' })),
        })),
    };
}
function phoneticsLookup(examId) {
    const m = /^ph-round-(kc|ch):(.+)$/.exec(String(examId || ''));
    if (!m) return null;
    return phoneticsPaperFromIds(m[1], m[2].split(',').filter(Boolean));
}

// ---- the three sets ------------------------------------------------------------
function practiceSet(key, screen, lookup, home) {
    return {
        screen: screen,
        bank: () => [],                          // papers come from lookup()
        lookup: lookup,
        loadHistory: () => practiceHistory(key).slice(),
        saveHistory: (list) => practiceSaveHistory(key, list),
        historyCap: PRACTICE_HISTORY_CAP,
        coinsPerCorrect: PRACTICE_COINS_PER_CORRECT,
        perfectBonus: 0,                         // the English practice tabs pay per answer only
        syncActivity: true,                      // a daily task depends on the upload
        home: home,
        homeLabel: '← Back to list',
    };
}
if (typeof EXAM_SETS !== 'undefined') {
    EXAM_SETS.reading = practiceSet('readingHistory', 'readingScreen',
        (id) => readingPaper(readingBank().find(p => p && p.id === id)), () => renderReadingHome());
    EXAM_SETS.cloze = practiceSet('clozeHistory', 'clozeScreen',
        (id) => clozePaper(clozeBank().find(p => p && p.id === id)), () => renderClozeHome());
    EXAM_SETS.errors = practiceSet('errorsHistory', 'errorsScreen', errorsLookup, () => renderErrorsHome());
    EXAM_SETS.grammarvocab = practiceSet('grammarVocabHistory', 'grammarVocabScreen', grammarVocabLookup, () => renderGrammarVocabHome());
    EXAM_SETS.phonetics = practiceSet('phoneticsHistory', 'phoneticsScreen', phoneticsLookup, () => renderPhoneticsHome());
}

// ---- which item next --------------------------------------------------------------
// One button, "Practice", and the app chooses. The rule, as the parent set it:
// serve Không chuyên until the child has scored 100% on at least one Không
// chuyên item, then serve Chuyên. Within a level, prefer items the child has
// not yet aced — a bank of thirty passages must not hand back the same one
// twice while others sit untouched. When every item at the chosen level is
// aced, fall through to the other level's unaced items; when everything is
// aced, anything goes.
function practiceAcedIds(key) {
    return new Set(practiceHistory(key).filter(h => h && h.total && h.score === h.total).map(h => h.examId));
}
function practiceLevelFor(key, aced) {
    const set = aced || practiceAcedIds(key);
    for (const id of set) if (/^(rd|cl)-kc-|^(er|gv|ph)-round-kc/.test(id)) return 'ch';
    return 'kc';
}
function practicePick(items, key, rand) {
    const r = rand || Math.random;
    if (!items.length) return null;
    const aced = practiceAcedIds(key);
    const level = practiceLevelFor(key, aced);
    const other = level === 'kc' ? 'ch' : 'kc';
    const pools = [
        items.filter(it => it.level === level && !aced.has(it.id)),
        items.filter(it => it.level === other && !aced.has(it.id)),
        items.filter(it => it.level === level),
        items,
    ];
    const pool = pools.find(p => p.length) || items;
    return pool[Math.floor(r() * pool.length)];
}
// Straight in, no confirm(): "Practice" was the tap. The confirm exists on
// the real PTNK papers because a 120-minute paper deserves a second look;
// a ten-minute passage the app chose for the child does not.
function startReadingPractice() {
    const ps = practicePick(readingBank(), 'readingHistory');
    if (ps && typeof startExam === 'function') startExam(ps.id, 'reading');
}
function startClozePractice() {
    const ps = practicePick(clozeBank(), 'clozeHistory');
    if (ps && typeof startExam === 'function') startExam(ps.id, 'cloze');
}
function startErrorsPractice() {
    // Rounds are drawn fresh each time, so only the level needs choosing; a
    // 10/10 Không chuyên round in the history moves the child up.
    startErrorsRound(practiceLevelFor('errorsHistory'));
}
function startGrammarVocabPractice() {
    startGrammarVocabRound(practiceLevelFor('grammarVocabHistory'));
}
function startPhoneticsPractice() {
    startPhoneticsRound(practiceLevelFor('phoneticsHistory'));
}

// ---- starting ----------------------------------------------------------------------
// Each pins its set first: a daily-task deep link lands here cold.
function startReadingPassage(id) { if (typeof confirmStartExam === 'function') confirmStartExam(id, 'reading'); }
function startClozePassage(id) { if (typeof confirmStartExam === 'function') confirmStartExam(id, 'cloze'); }
function startErrorsRound(level) {
    const lv = level === 'ch' ? 'ch' : 'kc';
    const ids = errorsDraw(lv);
    if (!ids.length) return;
    // No confirm: a ten-item round is short, and "Bắt đầu" was the tap.
    if (typeof startExam === 'function') startExam(errorsRoundId(lv, ids), 'errors');
}
function startGrammarVocabRound(level) {
    const lv = level === 'ch' ? 'ch' : 'kc';
    const ids = grammarVocabDraw(lv);
    if (!ids.length) return;
    if (typeof startExam === 'function') startExam(grammarVocabRoundId(lv, ids), 'grammarvocab');
}
function startPhoneticsRound(level) {
    const lv = level === 'ch' ? 'ch' : 'kc';
    const ids = phoneticsDraw(lv);
    if (!ids.length) return;
    if (typeof startExam === 'function') startExam(phoneticsRoundId(lv, ids), 'phonetics');
}

// ---- home screens --------------------------------------------------------------------
function practiceEmptyHTML(what) {
    return '<div class="lazy-loading" role="status" style="text-align:center">'
        + '<p>The ' + practiceEsc(what) + ' did not load. Check the connection and try again.</p>'
        + '<button class="grammar-units-bulk-btn" type="button" onclick="location.reload()">Try again</button>'
        + '</div>';
}
function practiceHistoryButton(setId, key) {
    const n = practiceHistory(key).length;
    return `<button class="exam-history-btn" onclick="examSelectSet('${setId}'); renderExamHistory()">📜 History ${n ? `(${n})` : ''}</button>`;
}
// The home of each menu: what the exercise is, one Practice button that says
// which level it will draw from and why, and History underneath. The child
// never picks a passage; the app does, by the rule in practicePick().
function practiceHomeHTML(o) {
    const level = practiceLevelFor(o.key);
    const aced = practiceAcedIds(o.key);
    const acedCount = o.items.filter(it => aced.has(it.id)).length;
    const pool = o.items.filter(it => it.level === level && !aced.has(it.id)).length
        || o.items.filter(it => it.level === (level === 'kc' ? 'ch' : 'kc') && !aced.has(it.id)).length
        || o.items.filter(it => it.level === level).length;
    const why = level === 'kc'
        ? 'Score 100% on one Không chuyên item to unlock Chuyên.'
        : 'Chuyên unlocked — you aced a Không chuyên item.';
    return `
        <div class="exam-header">
            <h1 class="exam-title">${o.icon} ${o.title}</h1>
            <p class="exam-subtitle">${o.blurb} · ${PRACTICE_COINS_PER_CORRECT} coins per correct answer</p>
        </div>
        <div class="phrases-wrap">
            <button class="phrases-cta" onclick="${o.start}()">
                <span class="phrases-cta-icon">${level === 'ch' ? '🎓' : '📘'}</span>
                <span class="phrases-cta-text"><strong>Practice</strong><small>${o.unit(pool, level)} · ${practiceLevelLabel(level)}${acedCount ? ` · ${acedCount} aced` : ''}</small></span>
                <span class="phrases-cta-arrow">›</span>
            </button>
            <p class="practice-rule">${why}</p>
        </div>
        ${practiceHistoryButton(o.set, o.key)}`;
}
function renderReadingHomeHTML() {
    const bank = readingBank();
    if (!bank.length) return practiceEmptyHTML('reading passages');
    return practiceHomeHTML({
        set: 'reading', key: 'readingHistory', items: bank, icon: '📖', title: 'Reading', start: 'startReadingPractice',
        blurb: bank.length + ' passages — main idea, detail, inference, True/False/Not Given, matching sections and missing sentences',
        unit: (n, lv) => `A random passage from ${n} · ${PRACTICE_MINUTES.reading[lv]} min`,
    });
}
function renderClozeHomeHTML() {
    const bank = clozeBank();
    if (!bank.length) return practiceEmptyHTML('cloze texts');
    return practiceHomeHTML({
        set: 'cloze', key: 'clozeHistory', items: bank, icon: '✏️', title: 'Cloze', start: 'startClozePractice',
        blurb: bank.length + ' texts with ten blanks each — choose the best option, or type the one missing word',
        unit: (n, lv) => `A random text from ${n} · 10 blanks · ${PRACTICE_MINUTES.cloze[lv]} min`,
    });
}
function renderErrorsHomeHTML() {
    const bank = errorsBank();
    if (!bank.length) return practiceEmptyHTML('error-correction items');
    const level = practiceLevelFor('errorsHistory');
    const n = bank.filter(it => it.level === level).length;
    return practiceHomeHTML({
        set: 'errors', key: 'errorsHistory', items: bank, icon: '🔍', title: 'Error Correction', start: 'startErrorsPractice',
        blurb: 'One sentence, four underlined parts, one of them wrong — find it, then see the correction',
        unit: (_, lv) => `${ERRORS_ROUND_SIZE} random sentences from ${n} · ${PRACTICE_MINUTES.errors[lv]} min`,
    });
}

function renderGrammarVocabHomeHTML() {
    const bank = grammarVocabBank();
    if (!bank.length) return practiceEmptyHTML('grammar and vocabulary items');
    const level = practiceLevelFor('grammarVocabHistory');
    const n = bank.filter(it => it.level === level).length;
    return practiceHomeHTML({
        set: 'grammarvocab', key: 'grammarVocabHistory', items: bank, icon: '🧩', title: 'Grammar & Vocabulary', start: 'startGrammarVocabPractice',
        blurb: 'One sentence, one blank, four options — tenses, modals, idioms, phrasal verbs, collocations and word choice, mixed the way an exam mixes them',
        unit: (_, lv) => `${GRAMMAR_VOCAB_ROUND_SIZE} random sentences from ${n} · ${PRACTICE_MINUTES.grammarvocab[lv]} min`,
    });
}

// Phonetics & Stress has two sub-tabs, like the Grammar tab: the lessons —
// the rules with IPA a child must know before the drill means anything —
// and the practice. Lessons open in place; the back button returns here.
let _phSubTab = 'lessons';
function switchPhoneticsSubTab(tab) { _phSubTab = tab === 'practice' ? 'practice' : 'lessons'; renderPhoneticsHome(); }
function renderPhoneticsPracticeHTML() {
    const bank = phoneticsBank();
    if (!bank.length) return practiceEmptyHTML('pronunciation items');
    const level = practiceLevelFor('phoneticsHistory');
    const n = bank.filter(it => it.level === level).length;
    return practiceHomeHTML({
        set: 'phonetics', key: 'phoneticsHistory', items: bank, icon: '🔊', title: 'Phonetics & Stress', start: 'startPhoneticsPractice',
        blurb: 'Four words — which one sounds different? Which one is stressed differently? Tap 🔊 to hear every word after you answer',
        unit: (_, lv) => `${PHONETICS_ROUND_SIZE / 2} pronunciation + ${PHONETICS_ROUND_SIZE / 2} stress from ${n} · ${PRACTICE_MINUTES.phonetics[lv]} min`,
    });
}
function renderPhoneticsLessonsHTML() {
    const lessons = phoneticsLessons();
    if (!lessons.length) return practiceEmptyHTML('lessons');
    const bank = phoneticsBank();
    const cards = lessons.map(l => {
        const n = bank.filter(q => q.rule === l.key).length;
        return `
        <button class="exam-lesson-card" onclick="openPhoneticsLesson('${practiceEsc(l.key)}')">
            <div class="exam-lesson-icon">${l.icon}</div>
            <div class="exam-lesson-info">
                <div class="exam-lesson-title">${practiceEsc(l.title)}</div>
                ${n ? `<div class="exam-lesson-meta">${n} câu luyện tập</div>` : ''}
            </div>
            <div class="exam-card-go">›</div>
        </button>`;
    }).join('');
    return `
        <div class="phrases-hero">
            <div class="phrases-hero-icon">📖</div>
            <h1>Phonetics & Stress — Lessons</h1>
            <p class="phrases-sub">Quy tắc phát âm và trọng âm kèm IPA — học trước, luyện sau. ${lessons.length} bài.</p>
        </div>
        <div class="exam-lesson-list">${cards}</div>`;
}
function renderPhoneticsHomeHTML() {
    return `
        <div class="grammar-subtabs">
            <button class="grammar-subtab ${_phSubTab === 'lessons' ? 'active' : ''}" onclick="switchPhoneticsSubTab('lessons')">📖 Lessons</button>
            <button class="grammar-subtab ${_phSubTab === 'practice' ? 'active' : ''}" onclick="switchPhoneticsSubTab('practice')">✏️ Practice</button>
        </div>
        ${_phSubTab === 'practice' ? renderPhoneticsPracticeHTML() : renderPhoneticsLessonsHTML()}`;
}
function openPhoneticsLesson(key) {
    const l = phoneticsLessons().find(x => x.key === key);
    const screen = (typeof document !== 'undefined') ? document.getElementById('phoneticsScreen') : null;
    if (!l || !screen) return;
    screen.innerHTML = `
        <div class="exam-lesson-detail">
            <button class="exam-back-btn" onclick="renderPhoneticsHome()">←</button>
            <h1 class="exam-lesson-detail-title">${l.icon} ${practiceEsc(l.title)}</h1>
            <div class="exam-lesson-content">${l.content}</div>
            <button class="exam-btn-secondary exam-lesson-back-bottom" onclick="renderPhoneticsHome()">← Danh sách bài học</button>
        </div>`;
    screen.scrollTop = 0;
    if (typeof window !== 'undefined' && window.scrollTo) try { window.scrollTo(0, 0); } catch (e) {}
}

function practiceRenderHome(setId, screenId, html) {
    if (typeof examSelectSet === 'function') examSelectSet(setId);
    // A round still running on this screen keeps its question (js/exam.js).
    if (typeof examHomeYieldsToLivePaper === 'function' && examHomeYieldsToLivePaper(screenId)) return;
    const screen = (typeof document !== 'undefined') ? document.getElementById(screenId) : null;
    if (!screen) return;
    screen.innerHTML = `<div class="exam-home">${html}</div>`;
    screen.scrollTop = 0;
}
function renderReadingHome() { practiceRenderHome('reading', 'readingScreen', renderReadingHomeHTML()); }
function renderClozeHome() { practiceRenderHome('cloze', 'clozeScreen', renderClozeHomeHTML()); }
function renderErrorsHome() { practiceRenderHome('errors', 'errorsScreen', renderErrorsHomeHTML()); }
function renderGrammarVocabHome() { practiceRenderHome('grammarvocab', 'grammarVocabScreen', renderGrammarVocabHomeHTML()); }
function renderPhoneticsHome() { practiceRenderHome('phonetics', 'phoneticsScreen', renderPhoneticsHomeHTML()); }

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PRACTICE_COINS_PER_CORRECT, PRACTICE_HISTORY_CAP, ERRORS_ROUND_SIZE, GRAMMAR_VOCAB_ROUND_SIZE, PHONETICS_ROUND_SIZE, PRACTICE_MINUTES, READING_KIND_LABEL,
        GRAMMAR_VOCAB_FOCUS_LABEL, PHONETICS_STEM,
        readingBank, clozeBank, errorsBank, grammarVocabBank, phoneticsBank, phoneticsLessons, readingPaper, clozePaper,
        phoneticsRoundId, phoneticsDraw, phoneticsPaperFromIds, phoneticsLookup, startPhoneticsRound, startPhoneticsPractice,
        switchPhoneticsSubTab, renderPhoneticsPracticeHTML, renderPhoneticsLessonsHTML, renderPhoneticsHomeHTML, openPhoneticsLesson, renderPhoneticsHome,
        errorsRoundId, errorsDraw, errorsPaperFromIds, errorsLookup,
        grammarVocabRoundId, grammarVocabDraw, grammarVocabPaperFromIds, grammarVocabLookup,
        practiceHistory, practiceSaveHistory, practiceBest,
        startReadingPassage, startClozePassage, startErrorsRound, startGrammarVocabRound,
        practiceAcedIds, practiceLevelFor, practicePick, startReadingPractice, startClozePractice, startErrorsPractice, startGrammarVocabPractice,
        practiceHomeHTML,
        renderReadingHomeHTML, renderClozeHomeHTML, renderErrorsHomeHTML, renderGrammarVocabHomeHTML,
        renderReadingHome, renderClozeHome, renderErrorsHome, renderGrammarVocabHome, practiceLevelLabel, practiceEsc,
    };
}
