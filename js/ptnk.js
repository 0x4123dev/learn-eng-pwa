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
        bank: ptnkBank,
        loadHistory: () => ptnkHistory().slice(),
        saveHistory: ptnkSaveHistory,
        historyCap: PTNK_HISTORY_CAP,
        coinsPerCorrect: PTNK_COINS_PER_CORRECT,
        perfectBonus: PTNK_PERFECT_BONUS,
        syncActivity: true,
        home: () => renderPtnkHome(),
        homeLabel: '← PTNK',
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
                <div class="exam-card-meta">⏱️ ${ex.durationMin} phút · ${ex.questions.length} câu · <span class="ptnk-track">${ptnkTrackLabel(ex.track)}</span>${solved ? ' · <span class="ptnk-key-note" title="Đề này không có đáp án chính thức; đáp án do hệ thống giải và kiểm tra chéo.">Đáp án tham khảo</span>' : ''}</div>
                ${Array.isArray(ex.omitted) && ex.omitted.length ? `<div class="ptnk-omitted">⚠️ Lược bỏ: ${ptnkEsc(ex.omitted.join('; '))}</div>` : ''}
                ${best !== null ? `<div class="exam-card-best">Tốt nhất: ${best}/${ex.questions.length}${best === ex.questions.length ? ' 🌟' : ''}</div>` : ''}
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
            + '<p>Chưa tải được bộ đề PTNK. Con kiểm tra mạng rồi thử lại nhé.</p>'
            + '<button class="grammar-units-bulk-btn" type="button" onclick="location.reload()">Thử lại</button>'
            + '</div>';
    }
    const years = {};
    bank.forEach(ex => { (years[ex.year] = years[ex.year] || []).push(ex); });
    const groups = Object.keys(years).map(Number).sort((a, b) => b - a).map(y => {
        const papers = years[y].slice().sort((a, b) => (a.track === 'kc' ? 0 : 1) - (b.track === 'kc' ? 0 : 1));
        return `<h3 class="topic-detail-list-title ptnk-year">Năm ${y}</h3>${papers.map(ptnkCardHTML).join('')}`;
    }).join('');
    const history = ptnkHistory();
    const done = new Set(history.filter(h => h && h.total && h.score === h.total).map(h => h.examId)).size;
    return `
        <div class="exam-header">
            <h1 class="exam-title">🏫 PTNK</h1>
            <p class="exam-subtitle">${bank.length} đề thi thật vào lớp 10 Phổ thông Năng khiếu · ${PTNK_COINS_PER_CORRECT} xu mỗi câu đúng · thưởng ${PTNK_PERFECT_BONUS} xu khi đúng 100%${done ? ` · đã đúng 100% ${done} đề` : ''}</p>
        </div>
        <div class="exam-list">${groups}</div>
        <button class="exam-history-btn" onclick="examSelectSet('ptnk'); renderExamHistory()">
            📜 Lịch sử ${history.length ? `(${history.length})` : ''}
        </button>`;
}

function renderPtnkHome() {
    if (typeof examSelectSet === 'function') examSelectSet('ptnk');
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
        ptnkBank, ptnkHistory, ptnkSaveHistory, ptnkBest, ptnkTrackLabel,
        ptnkCardHTML, renderPtnkHomeHTML, renderPtnkHome, startPtnkExam, ptnkEsc,
    };
}
