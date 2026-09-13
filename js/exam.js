// exam.js — Exam tab: timed mock exams with per-question feedback + history.
// Depends on exam-data.js (EXAMS, getExam) and reuses the grammar quiz styles
// (.grammar-option, .grammar-explanation, .grammar-next-btn) for a consistent
// look with the Unit-12 explanations.

const EXAM_HISTORY_KEY = 'flashlingo_examHistory';

// Same cap the other practice tabs use (WF_HISTORY_CAP, RW_HISTORY_CAP,
// PHRASES_HISTORY_CAP, MATH_HISTORY_CAP, GRAMMAR_HISTORY_CAP are all 300).
// It has teeth here in a way it does not there: an exam attempt used to carry
// every question's text AND its explanation HTML — 17k–49k chars each — so an
// uncapped list ate a 5 MB origin quota in ~106 attempts, setItem started
// throwing, and the newest attempt was dropped on the floor in silence while
// "Best:" and the History list froze at whatever was last written. Attempts
// are now stored stripped (see finishExam) at ~4.7 kB, so a full 300 is
// ~1.4 MB.
const EXAM_HISTORY_CAP = 300;

// ---- sets ------------------------------------------------------------------
// The engine below — clock, one question at a time, grading, results, review —
// is shared by more than one bank of papers. What is NOT shared is everything
// around it: which screen it draws on, where attempts are kept, what a correct
// answer pays, whether a clean sheet earns a bonus, and how the finished
// attempt reaches the server. A "set" is that bundle.
//
//   hcmc — the original Exam tab: 33 HCMC grade-10 papers, history in its own
//          localStorage key, 5 xu a question, no bonus.
//   ptnk — registered by js/ptnk.js: the real Phổ thông Năng khiếu papers,
//          history on appState (so js/auth.js uploads it and a daily task can
//          see it), 5 xu a question and 50 xu for 100%.
//
// Keeping them apart is the point. A child's PTNK best score must not appear
// in the HCMC list, a PTNK bonus must not leak onto the HCMC papers, and the
// engine must never look a PTNK id up in the HCMC bank (getExam) and draw
// nothing. Every hard-coded 'examScreen', EXAMS and history key in this file
// went through _examSetCfg() when the second set arrived.
const EXAM_SETS = {
    hcmc: {
        screen: 'examScreen',
        bank: () => (typeof EXAMS !== 'undefined' && Array.isArray(EXAMS)) ? EXAMS : [],
        loadHistory: () => {
            // ALWAYS an array — see the comment on loadExamHistory.
            try {
                const parsed = JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY));
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) { return []; }
        },
        saveHistory: (list) => {
            try { localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(list)); return true; }
            catch (e) {
                const kept = list.slice(0, Math.max(1, Math.floor(list.length / 2)));
                try { localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(kept)); return true; }
                catch (e2) { return false; }
            }
        },
        historyCap: EXAM_HISTORY_CAP,
        coinsPerCorrect: 5,
        perfectBonus: 0,
        syncActivity: false,
        home: null,                       // null = this file's own renderExamHome body
        homeLabel: '← Exam Home',
    },
};
let _examSet = 'hcmc';
function _examSetCfg() { return EXAM_SETS[_examSet] || EXAM_SETS.hcmc; }
function _examScreen() {
    return (typeof document !== 'undefined') ? document.getElementById(_examSetCfg().screen) : null;
}
// The current set's bank, by id. getExam() in js/exam-data.js only knows the
// HCMC papers; a PTNK id asked of it comes back null and the paper never opens.
function examLookup(examId) {
    const cfg = _examSetCfg();
    // A set may resolve a paper on demand instead of holding a flat bank of
    // papers: the practice sets (js/practice-sets.js) turn a reading passage
    // into a paper when it is tapped, and rebuild an error-identification
    // round from the item ids carried in its own id — so a round sat last week
    // can still be reviewed after a reload, with the bank as the only store.
    if (typeof cfg.lookup === 'function') {
        try { const found = cfg.lookup(examId); if (found) return found; } catch (e) {}
    }
    const bank = typeof cfg.bank === 'function' ? cfg.bank() : [];
    return bank.find(e => e && e.id === examId) || null;
}
function examCurrentSet() { return _examSet; }
// For the study checkpoint (js/app.js): a paper saved mid-way must come back
// in the set it was started in, or a PTNK paper is drawn on the HCMC screen
// and scored under the HCMC history.
function examSelectSet(setId) { if (setId && EXAM_SETS[setId]) _examSet = setId; }

// Live exam session (null when not taking an exam).
// { examId, title, questions, idx, answers[], startTs, endTs, deadlineTs,
//   timerId, finished }
let _examState = null;

// ---- retake ------------------------------------------------------------------
// A daily task is completed only by a FRESH attempt started from the menu
// (the Practice button, a paper list, a daily-task deep link). Re-doing the
// SAME paper through the results screen's "Làm lại" — the child has just seen
// every answer and every explanation — must not count, even at 100%. So
// retakeExam() arms a one-shot flag, startExam() consumes it into
// _examState.retake, and finishExam() writes `retake: true` on the attempt;
// js/auth.js carries that as detail.retake and the server's task counter
// (functions/api/_daily-task.js progress()) leaves such rows out. A "Practice
// again" that draws a NEW round is not a retake and never comes through here.
//
// The flag is one-shot on purpose: it is cleared the moment startExam() reads
// it, and by abandonExam() / examForgetProfile() as well, so a retake the
// child cancelled at the confirm(), or walked out of, can never mark the next
// fresh paper as a retake.
let _examRetake = false;
function retakeExam(examId, setId) {
    _examRetake = true;
    try { confirmStartExam(examId, setId); }
    finally { _examRetake = false; }   // consumed by startExam, or dropped on Cancel
}

// Which sub-tab of the Exam home is showing: 'exams' or 'lessons'.
let _examSubTab = 'exams';

// ---- storage -----------------------------------------------------------------

function loadExamHistory() {
    // ALWAYS an array. `JSON.parse(...) || []` only covers null and invalid
    // JSON — a stored value that parses to an object, a number or a string
    // came straight back, and js/home.js `_homeSkillSessions` then called
    // .map() on it while drawing the home screen. That is on the boot path, so
    // one junk value under this key stopped the app opening at all, for good.
    // The HCMC set's loader (EXAM_SETS.hcmc) is where that rule now lives;
    // this wrapper only picks the set.
    const list = _examSetCfg().loadHistory();
    return Array.isArray(list) ? list : [];
}

// Returns true when the list reached disk. The newest attempt is the one the
// child just sat an exam for, so a full quota must never be answered by
// dropping it: shed the oldest half and try once more. Only if that also
// fails do we give up (and say so to the caller) — the alternative is the old
// silent no-op, where coins were paid, the results screen appeared, and
// nothing was ever written again.
function saveExamHistory(list) {
    return !!_examSetCfg().saveHistory(list);
}

// Look one stored answer row back up in the live bank. Attempts written before
// v4.17 carried `q` and `explanation` inline; newer ones do not, because both
// are re-derivable from EXAMS by exam id + question number and the explanation
// HTML alone was most of the ~29 kB each attempt used to cost. Both shapes
// render: the stored copy wins when it is there, the bank fills in when it is
// not, and an exam that has left the bank entirely degrades to a review with
// the answers and the marks but no question text — never to a crash.
function _examBankQuestion(attempt, a) {
    if (!attempt || !a || typeof getExam !== 'function') return null;
    let ex = null;
    try { ex = examLookup(attempt.examId); } catch (e) { return null; }
    if (!ex || !Array.isArray(ex.questions)) return null;
    return ex.questions.find(q => q.n === a.n) || null;
}

function _examReviewQuestionText(attempt, a) {
    if (a && a.q) return a.q;
    const q = _examBankQuestion(attempt, a);
    return q ? q.q : '';
}

function _examReviewExplanation(attempt, a) {
    if (a && a.explanation) return a.explanation;
    const q = _examBankQuestion(attempt, a);
    return q ? q.explanation : '';
}

// ---- helpers -----------------------------------------------------------------

function isExamActive() {
    return !!(_examState && !_examState.finished);
}

function abandonExam() {
    if (_examState && _examState.timerId) clearInterval(_examState.timerId);
    _examState = null;
    _examRetake = false;
    examLockScreen(false);
    // The last renderExamQuestion() wrote this paper into the study checkpoint
    // (js/app.js). Leaving through the bottom bar relies on the document's
    // click listener to clear it a tick later; a leave that reaches here any
    // other way (a deep link, switchUser, a test) would otherwise be offered
    // the abandoned paper back on the next open. Clear it here, the way
    // finishExam does.
    if (typeof saveStudyCheckpoint === 'function') { try { saveStudyCheckpoint(); } catch (e) {} }
}

// A set's home must never be drawn over a paper that is still running on
// that same screen. switchScreen(ownScreen) does not ask (there is nothing to
// leave), but it repaints the tab's home — and with the clock still ticking
// underneath, the list would sit there until _examTick auto-submitted a paper
// nobody could see. Every home renderer on the engine asks this first; when
// the live paper belongs to this screen, the question is redrawn instead.
function examHomeYieldsToLivePaper(screenId) {
    if (!isExamActive()) return false;
    // The paper's OWN set, not the selected one: a set's home selects itself
    // on the way in, and the question must be redrawn where it started.
    const live = EXAM_SETS[_examState.set] || _examSetCfg();
    if (live.screen !== screenId) return false;
    examSelectSet(_examState.set);
    renderExamQuestion();
    return true;
}

// SILENT teardown for a profile change. abandonExam() is exactly the right
// thing to do — it stops the clock and puts the bottom bar back — but it is
// only reached through switchScreen's confirm(), and switchUser() does not go
// through switchScreen. So A's forty-minute paper kept ticking under B: the
// clock ran, _examTick could auto-submit it, switchScreen answered B's every
// tab tap with "You are in the middle of a timed exam", and the once-a-second
// study checkpoint wrote A's half-finished paper into localStorage under B's
// name — to be offered back to B on their next open.
function examForgetProfile() {
    abandonExam();
    _examSubTab = 'exams';
    _examSet = 'hcmc';
}

// A timed paper is forty to ninety minutes with a clock running, and walking
// out saves nothing at all — quitExam says so in as many words. The bottom bar
// had no business sitting under the thumb for that whole hour, so it goes away
// while the paper is open, the way Đấu Toán and the Toán 7 đề thi already do.
// Both exits (abandonExam, finishExam) put it back, so it can never be left
// hidden with nothing to come back to.
function examLockScreen(locked) {
    if (typeof document === 'undefined') return;
    const nav = document.getElementById('bottomNav');
    if (nav) nav.style.display = locked ? 'none' : '';
}

function _fmtClock(totalSec) {
    totalSec = Math.max(0, Math.round(totalSec));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}

function _normalizeAnswer(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/^→\s*/, '')
        .replace(/[.,!?;:"'’`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function _textIsCorrect(userText, q) {
    const u = _normalizeAnswer(userText);
    if (!u) return false;
    return (q.accept || []).some(a => _normalizeAnswer(a) === u);
}

function escExam(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// ---- home / landing ----------------------------------------------------------

function renderExamHome() {
    // The Exam tab's body is the HCMC set's. Visiting Reading (or PTNK, or any
    // practice menu) leaves THAT set selected, and the bottom bar's Exam
    // button then asked this function to draw — which delegated to the
    // Reading home, drew it on readingScreen, and left the Exam tab on its
    // "Đang tải bài…" placeholder for good. When the Exam tab is the screen
    // showing, the HCMC list is what is wanted; a set's own results screen
    // ("← PTNK Exams", "← Back to list") sits on that set's screen, so it
    // still goes home to its set.
    if (typeof document !== 'undefined' && !isExamActive()) {
        const examTab = document.getElementById('examScreen');
        if (examTab && examTab.classList.contains('active')) _examSet = 'hcmc';
    }
    // A set that brought its own home (PTNK lists papers by year, not as one
    // flat list with lessons) draws it here; the HCMC body follows.
    const cfg = _examSetCfg();
    if (typeof cfg.home === 'function') { cfg.home(); return; }
    if (examHomeYieldsToLivePaper(cfg.screen)) return;
    const screen = _examScreen();
    if (!screen) return;
    const bar = `
        <div class="grammar-subtabs">
          <button class="grammar-subtab ${_examSubTab === 'exams' ? 'active' : ''}" onclick="switchExamSubTab('exams')">📝 Exams</button>
          <button class="grammar-subtab ${_examSubTab === 'lessons' ? 'active' : ''}" onclick="switchExamSubTab('lessons')">📖 Lessons</button>
        </div>`;
    const body = _examSubTab === 'lessons' ? renderExamLessonsBody() : renderExamsBody();
    screen.innerHTML = `<div class="exam-home">${bar}${body}</div>`;
    screen.scrollTop = 0;
}

function switchExamSubTab(tab) {
    _examSubTab = tab;
    renderExamHome();
}

function renderExamsBody() {
    // js/exam-data.js is lazy-loaded (js/lazy-data.js SCREEN_FILES). It
    // resolves even when the download failed, so this can run before EXAMS
    // exists — and reading an undeclared const throws, leaving the tab stuck
    // on its loading placeholder for the rest of the session.
    if (typeof EXAMS === 'undefined' || !Array.isArray(EXAMS)) {
        return '<div class="lazy-loading" role="status" style="text-align:center">'
            + '<p>Chưa tải được bộ đề. Con kiểm tra mạng rồi thử lại nhé.</p>'
            + '<button class="grammar-units-bulk-btn" type="button" onclick="location.reload()">Thử lại</button>'
            + '</div>';
    }
    const history = loadExamHistory();

    const examCards = EXAMS.map(ex => {
        const attempts = history.filter(h => h.examId === ex.id);
        const best = attempts.length ? Math.max(...attempts.map(a => a.score)) : null;
        const bestStr = best === null ? '' :
            `<div class="exam-card-best">Best: ${best}/${ex.questions.length}</div>`;
        return `
        <button class="exam-card" onclick="confirmStartExam('${ex.id}')">
            <div class="exam-card-icon">📝</div>
            <div class="exam-card-info">
                <div class="exam-card-title">${escExam(ex.title)}</div>
                <div class="exam-card-sub">${escExam(ex.subtitle)}</div>
                <div class="exam-card-meta">⏱️ ${ex.durationMin} min · ${ex.questions.length} questions</div>
                ${bestStr}
            </div>
            <div class="exam-card-go">›</div>
        </button>`;
    }).join('');

    return `
        <div class="exam-header">
            <h1 class="exam-title">🎯 Exam</h1>
            <p class="exam-subtitle">Timed practice tests with instant explanations</p>
        </div>
        <div class="exam-list">
            ${examCards}
        </div>
        <button class="exam-history-btn" onclick="renderExamHistory()">
            📜 History ${history.length ? `(${history.length})` : ''}
        </button>
    `;
}

// ---- lessons (Vietnamese grammar notes derived from Exam 1) -------------------

function renderExamLessonsBody() {
    if (typeof EXAM1_LESSONS === 'undefined' || !EXAM1_LESSONS.length) {
        return `
        <div class="exam-header">
            <h1 class="exam-title">📖 Bài học</h1>
            <p class="exam-subtitle">Đang cập nhật…</p>
        </div>`;
    }
    const cards = EXAM1_LESSONS.map(l => `
        <button class="exam-lesson-card" onclick="openExamLesson('${l.id}')">
            <div class="exam-lesson-icon">${l.icon}</div>
            <div class="exam-lesson-info">
                <div class="exam-lesson-title">${escExam(l.title)}</div>
                <div class="exam-lesson-meta">Đề 1 · câu ${l.qRefs.join(', ')}</div>
            </div>
            <div class="exam-card-go">›</div>
        </button>`).join('');
    return `
        <div class="exam-header">
            <h1 class="exam-title">📖 Bài học ngữ pháp</h1>
            <p class="exam-subtitle">Tổng hợp &amp; giải thích mọi điểm ngữ pháp trong Đề 1 (bằng tiếng Việt)</p>
        </div>
        <div class="exam-lesson-list">${cards}</div>`;
}

function openExamLesson(id) {
    const l = (typeof EXAM1_LESSONS !== 'undefined') ? EXAM1_LESSONS.find(x => x.id === id) : null;
    if (!l) return;
    const screen = _examScreen();
    if (!screen) return;
    screen.innerHTML = `
        <div class="exam-lesson-detail">
            <button class="exam-back-btn" onclick="closeExamLesson()">←</button>
            <h1 class="exam-lesson-detail-title">${l.icon} ${escExam(l.title)}</h1>
            <div class="exam-lesson-detail-meta">📝 Liên hệ Đề 1: câu ${l.qRefs.join(', ')}</div>
            <div class="exam-lesson-content">${l.content}</div>
            <button class="exam-btn-secondary exam-lesson-back-bottom" onclick="closeExamLesson()">← Danh sách bài học</button>
        </div>`;
    screen.scrollTop = 0;
    window.scrollTo(0, 0);
}

function closeExamLesson() {
    _examSubTab = 'lessons';
    renderExamHome();
    window.scrollTo(0, 0);
}

// ---- start / timer -----------------------------------------------------------

function confirmStartExam(examId, setId) {
    if (setId && EXAM_SETS[setId]) _examSet = setId;
    const ex = examLookup(examId);
    if (!ex) return;
    const ok = confirm(
        `Start ${ex.title}?\n\n` +
        `• ${ex.questions.length} questions\n` +
        `• ${ex.durationMin}-minute timer (auto-submits at 0:00)\n\n` +
        `You'll see a clear explanation after each answer.`
    );
    if (ok) startExam(examId, _examSet);
}

// setId names the set the paper belongs to. A daily-task deep link arrives
// here with nothing else having chosen a set, so it must be explicit — the
// engine must not open a PTNK paper on the HCMC screen.
function startExam(examId, setId) {
    if (setId && EXAM_SETS[setId]) _examSet = setId;
    const ex = examLookup(examId);
    if (!ex) return;
    const now = Date.now();
    // Consume the one-shot NOW, before anything else can read it: a retake of
    // this paper is a retake; the next paper started from the menu is not.
    const retake = _examRetake === true;
    _examRetake = false;
    _examState = {
        set: _examSet,
        examId: ex.id,
        title: ex.title,
        durationMin: ex.durationMin,
        questions: ex.questions,
        idx: 0,
        answers: ex.questions.map(() => null),   // per q: {value, isCorrect} once answered
        startTs: now,
        deadlineTs: now + ex.durationMin * 60 * 1000,
        timerId: null,
        finished: false,
        retake,
    };
    _examState.timerId = setInterval(_examTick, 1000);
    examLockScreen(true);
    renderExamQuestion();
}

function _examTick() {
    if (!_examState || _examState.finished) return;
    const remain = (_examState.deadlineTs - Date.now()) / 1000;
    const el = document.getElementById('examTimer');
    if (el) {
        el.textContent = '⏱️ ' + _fmtClock(remain);
        el.classList.toggle('exam-timer-warning', remain <= 300);   // last 5 min
    }
    if (remain <= 0) finishExam(true);
    // The remaining time is in the checkpoint; keep it near true (js/app.js).
    else if (typeof saveStudyCheckpointOnClock === 'function') saveStudyCheckpointOnClock();
}

// ---- question rendering ------------------------------------------------------

function _examHeaderHTML() {
    const s = _examState;
    const answered = s.answers.filter(a => a !== null).length;
    const remain = (s.deadlineTs - Date.now()) / 1000;
    const pct = Math.round((s.idx) / s.questions.length * 100);
    return `
    <div class="exam-quiz-header">
        <div class="exam-quiz-top">
            <button class="exam-quit-btn" onclick="quitExam()">✕</button>
            <div class="exam-quiz-count">Q ${s.idx + 1}/${s.questions.length}</div>
            <div id="examTimer" class="exam-timer ${remain <= 300 ? 'exam-timer-warning' : ''}">⏱️ ${_fmtClock(remain)}</div>
        </div>
        <div class="exam-progress"><div class="exam-progress-bar" style="width:${pct}%"></div></div>
    </div>`;
}

function renderExamQuestion() {
    const s = _examState;
    if (!s) return;
    const screen = _examScreen();
    const q = s.questions[s.idx];
    // Warm this question's words now: they become tappable once answered.
    if (typeof twPrefetch === 'function') twPrefetch(q.q, q.options || [], q.explanation, q.passage, (q.hear || []).map(h => h.word));
    const ans = s.answers[s.idx];
    const showing = ans !== null;
    const total = s.questions.length;

    const passageHTML = q.passage
        ? `<div class="exam-passage">${q.passage}</div>` : '';

    const bankHTML = q.bank
        ? `<div class="exam-wordbank"><span class="exam-wordbank-label">Word bank:</span> ${q.bank.map(w => `<span class="exam-wordbank-item">${escExam(w)}</span>`).join('')}</div>`
        : '';

    const sectionHTML = q.section
        ? `<div class="exam-section-tag">${escExam(q.section)}</div>` : '';

    let bodyHTML;
    if (q.type === 'text') {
        bodyHTML = _renderExamTextBody(q, ans, showing);
    } else {
        bodyHTML = _renderExamChoiceBody(q, ans, showing);
    }

    let feedbackHTML = '';
    if (showing) {
        const isCorrect = ans.isCorrect;
        const header = isCorrect
            ? '✓ Correct!'
            : `✗ Not quite. The correct answer is <strong>${q.type === 'text' ? escExam(q.answer) : q.options[q.correct].replace(/<\/?u>/g, '')}</strong>.`;
        // A question may name words to listen to (Phonetics & Stress: the four
        // compared words with their IPA). Offered only once answered, like
        // tap-to-hear, so the recording never gives the answer away.
        const hearHTML = Array.isArray(q.hear) && q.hear.length
            ? `<div class="exam-hear">${q.hear.map(h => `<button class="exam-hear-btn" type="button" onclick="if (typeof _unitSpeak === 'function') _unitSpeak('${escExam(h.word).replace(/'/g, '&#39;')}')">🔊 ${escExam(h.word)}${h.ipa ? ` <span class="exam-hear-ipa">${escExam(h.ipa)}</span>` : ''}</button>`).join('')}</div>`
            : '';
        feedbackHTML = `
        <div class="grammar-explanation ${isCorrect ? 'correct' : 'wrong'}">
            <div class="grammar-explanation-header">${header}</div>
            <div class="grammar-explanation-body">💡 ${q.explanation}</div>
            ${hearHTML}
        </div>
        <button class="grammar-next-btn" onclick="nextExamQuestion()">
            ${s.idx + 1 >= total ? '🏁 See Results' : 'Next Question →'}
        </button>`;
    }

    screen.innerHTML = `
        ${_examHeaderHTML()}
        <div class="grammar-question-card exam-question-card">
            ${sectionHTML}
            ${passageHTML}
            ${bankHTML}
            <div class="grammar-question-text exam-question-text">${escExam(q.q).replace(/\n/g, '<br>')}</div>
            ${bodyHTML}
        </div>
        ${feedbackHTML}
    `;

    // Autofocus the text input when unanswered.
    if (q.type === 'text' && !showing) {
        const inp = document.getElementById('examTextInput');
        if (inp) { try { inp.focus(); } catch (e) {} }  // synchronous: keeps the tap gesture so the mobile keyboard opens
    }
    // The screen and the checkpoint change together (js/app.js).
    if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
}

function _renderExamChoiceBody(q, ans, showing) {
    const opts = q.options.map((opt, i) => {
        let cls = 'grammar-option';
        if (showing) {
            if (i === q.correct) cls += ' correct';
            else if (i === ans.value) cls += ' wrong';
        }
        const onclick = showing ? '' : `onclick="answerExamChoice(${i})"`;
        const letter = String.fromCharCode(65 + i);
        return `<button class="${cls}" ${onclick} ${showing ? 'disabled' : ''}>
                    <span class="grammar-option-letter">${letter}</span>
                    <span class="grammar-option-text">${opt}</span>
                </button>`;
    }).join('');
    return `<div class="grammar-options">${opts}</div>`;
}

function _renderExamTextBody(q, ans, showing) {
    if (showing) {
        const val = ans.value || '';
        const cls = ans.isCorrect ? 'correct' : 'wrong';
        return `<div class="exam-text-answer ${cls}">
                    <span class="exam-text-answer-label">Your answer:</span>
                    <span class="exam-text-answer-value">${escExam(val) || '<em>(blank)</em>'}</span>
                </div>`;
    }
    return `
        <div class="exam-text-wrap">
            <input type="text" id="examTextInput" class="exam-text-input" autofocus enterkeyhint="go"
                   placeholder="Type your answer…" autocomplete="off"
                   autocapitalize="off" spellcheck="false"
                   onkeydown="if(event.key==='Enter'){event.preventDefault();submitExamText();}">
            <button class="exam-text-submit" onclick="submitExamText()">Check</button>
        </div>`;
}

// ---- answering ---------------------------------------------------------------

function answerExamChoice(i) {
    const s = _examState;
    if (!s || s.answers[s.idx] !== null) return;
    const q = s.questions[s.idx];
    s.answers[s.idx] = { value: i, isCorrect: i === q.correct };
    renderExamQuestion();
}

function submitExamText() {
    const s = _examState;
    if (!s || s.answers[s.idx] !== null) return;
    const inp = document.getElementById('examTextInput');
    const raw = inp ? inp.value : '';
    const q = s.questions[s.idx];
    s.answers[s.idx] = { value: raw.trim(), isCorrect: _textIsCorrect(raw, q) };
    renderExamQuestion();
}

function nextExamQuestion() {
    const s = _examState;
    if (!s) return;
    if (s.idx + 1 >= s.questions.length) {
        finishExam(false);
        return;
    }
    s.idx++;
    renderExamQuestion();
    const screen = _examScreen();
    if (screen) screen.scrollTop = 0;
    window.scrollTo(0, 0);
}

function quitExam() {
    if (!isExamActive()) return;
    if (confirm('Quit the exam?\nYour progress will be lost and it will NOT be saved to history.')) {
        abandonExam();
        renderExamHome();
    }
}

// ---- finish / results --------------------------------------------------------

function finishExam(auto) {
    const s = _examState;
    if (!s || s.finished) return;
    s.finished = true;
    if (s.timerId) clearInterval(s.timerId);
    // A finished paper is not checkpointed (buildStudyCheckpoint): clear it
    // now, so a reload never offers it back to be scored and paid twice.
    if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
    examLockScreen(false);   // the paper is scored: the child may move again

    const total = s.questions.length;
    const score = s.answers.filter(a => a && a.isCorrect).length;
    const timeSpentSec = Math.min(
        s.durationMin * 60,
        Math.round((Date.now() - s.startTs) / 1000)
    );

    // Reward coins for the pet shop. 5 per correct answer (matches Grammar) on
    // both sets; a set may also pay a bonus for a clean sheet — PTNK does,
    // because a real entrance paper at 100% is a different achievement from a
    // practice set at 100%. The combo bonus the dog promised on screen is
    // banked here too, or it rides unpaid into the next practice.
    const cfg = _examSetCfg();
    const perfectBonus = (total > 0 && score === total) ? (cfg.perfectBonus || 0) : 0;
    const comboBonus = typeof petComboBonus === 'function' ? petComboBonus() : 0;
    const coinsEarned = score * (cfg.coinsPerCorrect || 5) + perfectBonus + comboBonus;
    if (typeof appState !== 'undefined' && appState) {
        appState.coins = (appState.coins || 0) + coinsEarned;
        // Streak: a finished exam counts as a study event for the day.
        if (typeof recordStudy === 'function') { try { recordStudy(); } catch (e) {} }
        if (typeof currentUser !== 'undefined' && typeof saveUserData === 'function') {
            try { saveUserData(currentUser, appState); } catch (e) {}
        }
    }

    const attempt = {
        set: s.set || _examSet,
        examId: s.examId,
        title: s.title,
        ts: Date.now(),
        score,
        total,
        timeSpentSec,
        coinsEarned,
        perfectBonus,
        autoSubmitted: !!auto,
        // Set only on a "Làm lại" of the same paper from a results card (see
        // retakeExam). Absent, not false, on a fresh attempt: the uploader and
        // the server treat a missing key as "counts", and a history written
        // before this flag existed must keep counting too.
        ...(s.retake ? { retake: true } : {}),
        // Only what cannot be looked back up. `q` and `explanation` used to
        // live here too and were 80% of the weight; the review screen now
        // reads them out of EXAMS by examId + n. `correctAnswer` stays even
        // though it is derivable: it is short, and it is the one thing that
        // still has to be true if this exam ever leaves the bank.
        answers: s.questions.map((q, i) => ({
            n: q.n,
            section: q.section || '',
            type: q.type,
            userValue: s.answers[i] ? s.answers[i].value : null,
            isCorrect: !!(s.answers[i] && s.answers[i].isCorrect),
            correctAnswer: q.type === 'text' ? q.answer : q.options[q.correct].replace(/<\/?u>/g, ''),
        })),
    };

    const history = loadExamHistory();
    history.unshift(attempt);
    const cap = cfg.historyCap || EXAM_HISTORY_CAP;
    if (history.length > cap) history.length = cap;
    saveExamHistory(history);
    // A set whose history lives on appState (PTNK) is uploaded by js/auth.js
    // as an activity — the thing a daily task is matched against. Push it now,
    // like every other tab, or the paper sits in localStorage until some
    // OTHER tab finishes a practice and flushes the queue.
    if (cfg.syncActivity && typeof EngAuth !== 'undefined' && EngAuth && typeof EngAuth.syncNow === 'function') {
        try { EngAuth.syncNow(); } catch (e) {}
    }

    // Best-effort: sync this attempt to the server so the admin can see it.
    // Offline-safe — the attempt is already saved locally above.
    if (typeof EngAuth !== 'undefined') {
        EngAuth.postAttempt({
            examId: attempt.examId,
            examTitle: attempt.title,
            score: attempt.score,
            total: attempt.total,
            timeSpentSec: attempt.timeSpentSec,
            autoSubmitted: attempt.autoSubmitted,
            answers: attempt.answers.map(a => ({
                n: a.n, section: a.section, isCorrect: a.isCorrect,
            })),
        });
    }

    _renderExamResults(attempt, auto);
    _examState = null;
}

function _renderExamResults(attempt, auto) {
    const screen = _examScreen();
    const pct = Math.round(attempt.score / attempt.total * 100);
    let grade, emoji;
    if (pct >= 90) { grade = 'Excellent!'; emoji = '🏆'; }
    else if (pct >= 75) { grade = 'Great job!'; emoji = '🎉'; }
    else if (pct >= 50) { grade = 'Good effort!'; emoji = '👍'; }
    else { grade = 'Keep practising!'; emoji = '💪'; }

    const autoNote = auto
        ? `<div class="exam-result-auto">⏰ Time's up — the exam was auto-submitted.</div>` : '';

    const reviewHTML = attempt.answers.map(a => {
        const userStr = a.type === 'text'
            ? (a.userValue ? escExam(a.userValue) : '<em>(blank)</em>')
            : (a.userValue === null ? '<em>(blank)</em>' : escExam(_optionLetterFor(a)));
        const qText = _examReviewQuestionText(attempt, a);
        const explain = _examReviewExplanation(attempt, a);
        return `
        <div class="exam-review-item ${a.isCorrect ? 'correct' : 'wrong'}">
            <div class="exam-review-q"><span class="exam-review-num">${a.n}</span> ${(typeof tapwordsWrap === 'function' ? tapwordsWrap(qText) : escExam(qText)).replace(/\n/g, '<br>')}</div>
            <div class="exam-review-line">
                <span class="exam-review-badge ${a.isCorrect ? 'ok' : 'no'}">${a.isCorrect ? '✓' : '✗'}</span>
                <span>Your answer: <strong>${userStr}</strong></span>
            </div>
            ${a.isCorrect ? '' : `<div class="exam-review-line">✅ Correct: <strong>${typeof tapwordsWrap === 'function' ? tapwordsWrap(a.correctAnswer) : escExam(a.correctAnswer)}</strong></div>`}
            ${explain ? `<div class="exam-review-explain">💡 ${explain}</div>` : ''}
        </div>`;
    }).join('');

    screen.innerHTML = `
        <div class="exam-result">
            <div class="exam-result-emoji">${emoji}</div>
            <div class="exam-result-grade">${grade}</div>
            <div class="exam-result-score">${attempt.score}<span>/${attempt.total}</span></div>
            <div class="exam-result-pct">${pct}% · ${escExam(attempt.title)}</div>
            <div class="exam-result-time">⏱️ Time used: ${_fmtClock(attempt.timeSpentSec)}</div>
            ${attempt.coinsEarned ? `<div class="exam-result-coins">+${attempt.coinsEarned} 🪙 earned</div>` : ''}
            ${attempt.perfectBonus ? `
            <div class="math-perfect-bonus" role="status">
              <span class="math-perfect-bonus__title">Thưởng đúng 100%</span>
              <strong>+${attempt.perfectBonus} xu</strong>
              <span>${escExam(attempt.title)}</span>
            </div>` : ''}
            ${autoNote}
            <div class="exam-result-actions">
                <button class="exam-btn-primary" onclick="retakeExam('${attempt.examId}')">🔁 Làm lại</button>
                <button class="exam-btn-secondary" onclick="renderExamHome()">${escExam(_examSetCfg().homeLabel || '← Exam Home')}</button>
            </div>
            ${_examRetakeNoteHTML()}
            <h2 class="exam-review-title">Review — every question</h2>
            <div class="exam-review-list">${reviewHTML}</div>
        </div>
    `;
    if (screen) screen.scrollTop = 0;
    window.scrollTo(0, 0);
}

// The one line under "Làm lại" that says why the retake will not move the
// daily-task counter. Drawn on every results card (fresh or retaken): the
// child reads it BEFORE tapping, which is when it matters.
function _examRetakeNoteHTML() {
    return '<div class="exam-retake-note" role="note">🔁 Làm lại không tính vào nhiệm vụ ngày — muốn tính, hãy bắt đầu bài mới từ menu.</div>';
}

function _optionLetterFor(a) {
    // For choice questions in review we only stored the option index in userValue.
    if (typeof a.userValue !== 'number') return String(a.userValue);
    return String.fromCharCode(65 + a.userValue);
}

// ---- history -----------------------------------------------------------------

function renderExamHistory() {
    const screen = _examScreen();
    const history = loadExamHistory();

    const body = history.length === 0
        ? `<div class="exam-history-empty">No attempts yet.<br>Take Exam 1 to see your results here.</div>`
        : history.map((h, idx) => {
            const d = new Date(h.ts);
            const dateStr = d.toLocaleString([], {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit'
            });
            const pct = Math.round(h.score / h.total * 100);
            return `
            <button class="exam-history-item" onclick="reviewExamAttempt(${idx})">
                <div class="exam-history-left">
                    <div class="exam-history-title">${escExam(h.title)}</div>
                    <div class="exam-history-date">${dateStr}${h.autoSubmitted ? ' · ⏰ auto' : ''}</div>
                </div>
                <div class="exam-history-right">
                    <div class="exam-history-score">${h.score}/${h.total}</div>
                    <div class="exam-history-pct ${pct >= 50 ? 'pass' : 'fail'}">${pct}%</div>
                </div>
            </button>`;
        }).join('');

    const clearBtn = history.length
        ? `<button class="exam-history-clear" onclick="clearExamHistory()">🗑️ Clear history</button>` : '';

    screen.innerHTML = `
        <div class="exam-home">
            <div class="exam-header exam-header-row">
                <button class="exam-back-btn" onclick="renderExamHome()">←</button>
                <h1 class="exam-title">📜 Exam History</h1>
            </div>
            <div class="exam-history-list">${body}</div>
            ${clearBtn}
        </div>
    `;
    if (screen) screen.scrollTop = 0;
}

function reviewExamAttempt(idx) {
    const history = loadExamHistory();
    const attempt = history[idx];
    if (!attempt) return;
    // Reuse the results renderer, then override its buttons to return to history.
    _renderExamResults(attempt, attempt.autoSubmitted);
    const screen = _examScreen();
    const actions = screen.querySelector('.exam-result-actions');
    if (actions) {
        actions.innerHTML = `
            <button class="exam-btn-primary" onclick="retakeExam('${attempt.examId}')">🔁 Làm lại</button>
            <button class="exam-btn-secondary" onclick="renderExamHistory()">← Back to History</button>`;
    }
}

function clearExamHistory() {
    if (confirm('Delete all saved exam attempts? This cannot be undone.')) {
        saveExamHistory([]);
        renderExamHistory();
    }
}
