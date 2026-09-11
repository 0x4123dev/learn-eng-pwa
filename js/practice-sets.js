// practice-sets.js — three PTNK-format practice menus on the exam engine.
//
//   📖 Đọc hiểu      readingScreen   js/reading-data.js  (READING_PASSAGES)
//   ✏️ Điền từ        clozeScreen     js/cloze-data.js    (CLOZE_PASSAGES)
//   🔍 Tìm lỗi sai    errorsScreen    js/errors-data.js   (ERROR_ITEMS)
//
// Why these three exist: a review of the eleven real PTNK papers against the
// practice menus found that reading comprehension (24% of a Không chuyên
// paper, 18% of Chuyên), passage-level cloze / open cloze (10% / 29%) and
// error identification (8% / 4%) were trained by nothing in the app. Every
// other section had a menu. These are the gaps, in size order.
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
// Minutes: enough to read carefully, short enough to stay a practice.
const PRACTICE_MINUTES = { reading: { kc: 10, ch: 15 }, cloze: { kc: 8, ch: 10 }, errors: { kc: 8, ch: 8 } };

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
    return [];
}
function practiceSaveHistory(key, list) {
    if (typeof appState === 'undefined' || !appState) return false;
    if (key === 'readingHistory') appState.readingHistory = list;
    else if (key === 'clozeHistory') appState.clozeHistory = list;
    else if (key === 'errorsHistory') appState.errorsHistory = list;
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
    for (const id of set) if (/^(rd|cl)-kc-|^er-round-kc/.test(id)) return 'ch';
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
function startReadingPractice() {
    const ps = practicePick(readingBank(), 'readingHistory');
    if (ps) startReadingPassage(ps.id);
}
function startClozePractice() {
    const ps = practicePick(clozeBank(), 'clozeHistory');
    if (ps) startClozePassage(ps.id);
}
function startErrorsPractice() {
    // Rounds are drawn fresh each time, so only the level needs choosing; a
    // 10/10 Không chuyên round in the history moves the child up.
    startErrorsRound(practiceLevelFor('errorsHistory'));
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

function practiceRenderHome(setId, screenId, html) {
    if (typeof examSelectSet === 'function') examSelectSet(setId);
    const screen = (typeof document !== 'undefined') ? document.getElementById(screenId) : null;
    if (!screen) return;
    screen.innerHTML = `<div class="exam-home">${html}</div>`;
    screen.scrollTop = 0;
}
function renderReadingHome() { practiceRenderHome('reading', 'readingScreen', renderReadingHomeHTML()); }
function renderClozeHome() { practiceRenderHome('cloze', 'clozeScreen', renderClozeHomeHTML()); }
function renderErrorsHome() { practiceRenderHome('errors', 'errorsScreen', renderErrorsHomeHTML()); }

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PRACTICE_COINS_PER_CORRECT, PRACTICE_HISTORY_CAP, ERRORS_ROUND_SIZE, PRACTICE_MINUTES, READING_KIND_LABEL,
        readingBank, clozeBank, errorsBank, readingPaper, clozePaper,
        errorsRoundId, errorsDraw, errorsPaperFromIds, errorsLookup,
        practiceHistory, practiceSaveHistory, practiceBest,
        startReadingPassage, startClozePassage, startErrorsRound,
        practiceAcedIds, practiceLevelFor, practicePick, startReadingPractice, startClozePractice, startErrorsPractice,
        practiceHomeHTML,
        renderReadingHomeHTML, renderClozeHomeHTML, renderErrorsHomeHTML,
        renderReadingHome, renderClozeHome, renderErrorsHome, practiceLevelLabel, practiceEsc,
    };
}
