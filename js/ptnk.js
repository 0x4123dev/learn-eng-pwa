// ptnk.js — 🏫 PTNK: the real Phổ thông Năng khiếu grade-10 entrance papers.
//
// Eleven papers, 2021–2026, Không chuyên and Chuyên, transcribed page by page
// from the scanned originals in data/ptnk/ and built into js/ptnk-data.js
// (PTNK_EXAMS). Nothing here is modelled or invented: these are the papers.
//
// This file owns almost nothing. The clock, the one-question-at-a-time
// rendering, grading, the results card and the review screen all belong to
// js/exam.js, which draws for whichever SET is current. What this file
// contributes is the set — where PTNK keeps its history, what it pays, which
// screen it uses — and a home screen that lists papers by year, because a
// child looking for "đề 2024" should not have to scan a flat list.
//
// Why history lives on appState rather than in the Exam tab's localStorage
// key: appState is what js/auth.js uploads, and the daily-task matcher reads
// those uploads. An admin who assigns "làm đề PTNK 2022 Chuyên" for today
// needs the finished paper to be visible to the server, and the Exam tab's
// /api/attempts table is not.

const PTNK_COINS_PER_CORRECT = 5;    // the Exam tab's rate — one rate for one engine
// A real entrance paper answered perfectly is not the same achievement as a
// practice set answered perfectly, and the number says so.
const PTNK_PERFECT_BONUS = 50;
// Stripped attempts are ~5 kB each and this rides inside the per-profile
// appState blob, which saveUserData sheds when it grows. 100 is a year of
// papers for an ambitious child and a tenth of the Exam tab's cap.
const PTNK_HISTORY_CAP = 100;

function ptnkBank() {
    return (typeof PTNK_EXAMS !== 'undefined' && Array.isArray(PTNK_EXAMS)) ? PTNK_EXAMS : [];
}

// The built bank stores each paper's passages once (`passages`) and points a
// question at its passage by `passageId` — the source JSON repeats the passage
// on every question, and shipping that was 1.2 MB of the same text over and
// over (scripts/build-ptnk-data.js). The engine, the review screen and the
// study checkpoint all read `question.passage`, exactly as js/practice-sets.js
// readingPaper() puts the passage on every question of a practice paper. So
// this is the one place a PTNK paper is turned back into that shape: `passage`
// restored in the key position `passageId` held, `passages` dropped. Memoised
// per source object — examLookup() runs on every review row, and the engine
// keeps a reference to `questions` for the length of a paper, so the same
// paper must come back as the same object each time. A paper that already
// carries inline passages (a stub bank in a test, a bank built before this
// change) is returned as it is.
const _ptnkHydrated = (typeof WeakMap === 'function') ? new WeakMap() : null;
function ptnkHydrate(ex) {
    if (!ex || !Array.isArray(ex.passages) || !Array.isArray(ex.questions)) return ex;
    const hit = _ptnkHydrated && _ptnkHydrated.get(ex);
    if (hit) return hit;
    const passages = ex.passages;
    const paper = {};
    Object.keys(ex).forEach(k => {
        if (k === 'passages') return;
        if (k !== 'questions') { paper[k] = ex[k]; return; }
        paper.questions = ex.questions.map(q => {
            if (!q || typeof q.passageId !== 'number') return q;
            const out = {};
            Object.keys(q).forEach(kk => {
                if (kk === 'passageId') out.passage = passages[q.passageId];
                else out[kk] = q[kk];
            });
            return out;
        });
    });
    if (_ptnkHydrated) _ptnkHydrated.set(ex, paper);
    return paper;
}
// Every paper in the bank in the shape js/exam.js expects: what EXAM_SETS.ptnk
// hands the engine, and what startPtnkExam / the review screen open.
function ptnkPapers() { return ptnkBank().map(ptnkHydrate); }
function ptnkPaper(examId) {
    const ex = ptnkBank().find(e => e && e.id === examId);
    return ex ? ptnkHydrate(ex) : null;
}
function ptnkHistory() {
    if (typeof appState === 'undefined' || !appState) return [];
    if (!Array.isArray(appState.ptnkHistory)) appState.ptnkHistory = [];
    return appState.ptnkHistory;
}
function ptnkSaveHistory(list) {
    if (typeof appState === 'undefined' || !appState) return false;
    appState.ptnkHistory = list;
    if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
        // saveUserData sheds old history itself, bounded. A quota error must
        // not escape: the coins are already in the wallet by the time this runs.
        try { saveUserData(currentUser, appState); } catch (e) { return false; }
    }
    return true;
}

// Registered onto the engine's table at load. js/ptnk.js is loaded after
// js/exam.js (index.html), so EXAM_SETS exists; the guard is for tests that
// load this file alone.
if (typeof EXAM_SETS !== 'undefined') {
    EXAM_SETS.ptnk = {
        screen: 'ptnkScreen',
        bank: ptnkPapers,
        lookup: ptnkPaper,
        loadHistory: () => ptnkHistory().slice(),
        saveHistory: ptnkSaveHistory,
        historyCap: PTNK_HISTORY_CAP,
        coinsPerCorrect: PTNK_COINS_PER_CORRECT,
        perfectBonus: PTNK_PERFECT_BONUS,
        syncActivity: true,
        home: () => renderPtnkHome(),
        homeLabel: '← PTNK Exams',
    };
}

function ptnkEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function ptnkBest(examId) {
    const runs = ptnkHistory().filter(h => h && h.examId === examId && h.total);
    if (!runs.length) return null;
    return runs.reduce((b, h) => Math.max(b, h.score), 0);
}

function ptnkTrackLabel(track) { return track === 'chuyen' ? 'Chuyên' : 'Không chuyên'; }

function ptnkCardHTML(ex) {
    const best = ptnkBest(ex.id);
    const solved = ex.keySource === 'solved';
    return `
        <button class="exam-card ptnk-card ptnk-${ptnkEsc(ex.track)}" onclick="startPtnkExam('${ptnkEsc(ex.id)}')">
            <div class="exam-card-icon">${ex.track === 'chuyen' ? '🎓' : '📘'}</div>
            <div class="exam-card-info">
                <div class="exam-card-title">${ptnkEsc(ex.title)}</div>
                <div class="exam-card-sub">${ptnkEsc(ex.subtitle)}</div>
                <div class="exam-card-meta">⏱️ ${ex.durationMin} min · ${ex.questions.length} questions · <span class="ptnk-track">${ptnkTrackLabel(ex.track)}</span>${solved ? ' · <span class="ptnk-key-note" title="No official key was published for this paper; the answers were solved and cross-checked.">Unofficial key</span>' : ''}</div>
                ${Array.isArray(ex.omitted) && ex.omitted.length ? `<div class="ptnk-omitted">⚠️ Omitted: ${ptnkEsc(ex.omitted.join('; '))}</div>` : ''}
                ${best !== null ? `<div class="exam-card-best">Best: ${best}/${ex.questions.length}${best === ex.questions.length ? ' 🌟' : ''}</div>` : ''}
            </div>
            <div class="exam-card-go">›</div>
        </button>`;
}

// Papers grouped by year, newest first; Không chuyên before Chuyên within a
// year because that is the order a child sits them.
function renderPtnkHomeHTML() {
    const bank = ptnkBank();
    if (!bank.length) {
        return '<div class="lazy-loading" role="status" style="text-align:center">'
            + '<p>The PTNK papers did not load. Check the connection and try again.</p>'
            + '<button class="grammar-units-bulk-btn" type="button" onclick="location.reload()">Try again</button>'
            + '</div>';
    }
    const years = {};
    bank.forEach(ex => { (years[ex.year] = years[ex.year] || []).push(ex); });
    const groups = Object.keys(years).map(Number).sort((a, b) => b - a).map(y => {
        const papers = years[y].slice().sort((a, b) => (a.track === 'kc' ? 0 : 1) - (b.track === 'kc' ? 0 : 1));
        return `<h3 class="topic-detail-list-title ptnk-year">${y}</h3>${papers.map(ptnkCardHTML).join('')}`;
    }).join('');
    const history = ptnkHistory();
    const done = new Set(history.filter(h => h && h.total && h.score === h.total).map(h => h.examId)).size;
    return `
        <div class="exam-header">
            <h1 class="exam-title">🏫 PTNK Exams</h1>
            <p class="exam-subtitle">${bank.length} real grade-10 entrance papers · ${PTNK_COINS_PER_CORRECT} coins per correct answer · +${PTNK_PERFECT_BONUS} for a perfect paper${done ? ` · ${done} paper${done === 1 ? '' : 's'} at 100%` : ''}</p>
        </div>
        <div class="exam-list">${groups}</div>
        <button class="exam-history-btn" onclick="examSelectSet('ptnk'); renderExamHistory()">
            📜 History ${history.length ? `(${history.length})` : ''}
        </button>`;
}

function renderPtnkHome() {
    if (typeof examSelectSet === 'function') examSelectSet('ptnk');
    // A paper still running on this screen keeps its question (js/exam.js).
    if (typeof examHomeYieldsToLivePaper === 'function' && examHomeYieldsToLivePaper('ptnkScreen')) return;
    const screen = (typeof document !== 'undefined') ? document.getElementById('ptnkScreen') : null;
    if (!screen) return;
    screen.innerHTML = `<div class="exam-home">${renderPtnkHomeHTML()}</div>`;
    screen.scrollTop = 0;
}

// The engine's confirm-then-start, pinned to the PTNK set. Also the entry point
// a daily-task deep link uses (js/daily-task-catalog.js), so it must work with
// nothing else having chosen the set first.
function startPtnkExam(examId) {
    if (typeof confirmStartExam === 'function') confirmStartExam(examId, 'ptnk');
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        PTNK_COINS_PER_CORRECT, PTNK_PERFECT_BONUS, PTNK_HISTORY_CAP,
        ptnkBank, ptnkHydrate, ptnkPapers, ptnkPaper, ptnkHistory, ptnkSaveHistory, ptnkBest, ptnkTrackLabel,
        ptnkCardHTML, renderPtnkHomeHTML, renderPtnkHome, startPtnkExam, ptnkEsc,
    };
}
