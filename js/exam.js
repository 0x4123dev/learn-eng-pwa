// exam.js — Exam tab: timed mock exams with per-question feedback + history.
// Depends on exam-data.js (EXAMS, getExam) and reuses the grammar quiz styles
// (.grammar-option, .grammar-explanation, .grammar-next-btn) for a consistent
// look with the Unit-12 explanations.

const EXAM_HISTORY_KEY = 'flashlingo_examHistory';

// Live exam session (null when not taking an exam).
// { examId, title, questions, idx, answers[], startTs, endTs, deadlineTs,
//   timerId, finished }
let _examState = null;

// Which sub-tab of the Exam home is showing: 'exams' or 'lessons'.
let _examSubTab = 'exams';

// ---- storage -----------------------------------------------------------------

function loadExamHistory() {
    try {
        return JSON.parse(localStorage.getItem(EXAM_HISTORY_KEY)) || [];
    } catch (e) {
        return [];
    }
}

function saveExamHistory(list) {
    try {
        localStorage.setItem(EXAM_HISTORY_KEY, JSON.stringify(list));
    } catch (e) { /* storage full — ignore */ }
}

// ---- helpers -----------------------------------------------------------------

function isExamActive() {
    return !!(_examState && !_examState.finished);
}

function abandonExam() {
    if (_examState && _examState.timerId) clearInterval(_examState.timerId);
    _examState = null;
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
    const screen = document.getElementById('examScreen');
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

    // Placeholders for exams still to come — only for numbers not yet released.
    const releasedNums = new Set(EXAMS.map(e => parseInt(String(e.id).replace('exam', ''), 10)));
    const comingSoon = [1, 2, 3, 4].filter(n => !releasedNums.has(n)).map(n => `
        <div class="exam-card exam-card-locked">
            <div class="exam-card-icon">🔒</div>
            <div class="exam-card-info">
                <div class="exam-card-title">Exam ${n}</div>
                <div class="exam-card-sub">Coming soon</div>
            </div>
        </div>`).join('');

    return `
        <div class="exam-header">
            <h1 class="exam-title">🎯 Exam</h1>
            <p class="exam-subtitle">Timed practice tests with instant explanations</p>
        </div>
        <div class="exam-list">
            ${examCards}
            ${comingSoon}
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
    const screen = document.getElementById('examScreen');
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

function confirmStartExam(examId) {
    const ex = getExam(examId);
    if (!ex) return;
    const ok = confirm(
        `Start ${ex.title}?\n\n` +
        `• ${ex.questions.length} questions\n` +
        `• ${ex.durationMin}-minute timer (auto-submits at 0:00)\n\n` +
        `You'll see a clear explanation after each answer.`
    );
    if (ok) startExam(examId);
}

function startExam(examId) {
    const ex = getExam(examId);
    if (!ex) return;
    const now = Date.now();
    _examState = {
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
    };
    _examState.timerId = setInterval(_examTick, 1000);
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
    const screen = document.getElementById('examScreen');
    const q = s.questions[s.idx];
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
        feedbackHTML = `
        <div class="grammar-explanation ${isCorrect ? 'correct' : 'wrong'}">
            <div class="grammar-explanation-header">${header}</div>
            <div class="grammar-explanation-body">💡 ${q.explanation}</div>
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
        if (inp) setTimeout(() => inp.focus(), 50);
    }
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
            <input type="text" id="examTextInput" class="exam-text-input"
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
    const screen = document.getElementById('examScreen');
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

    const total = s.questions.length;
    const score = s.answers.filter(a => a && a.isCorrect).length;
    const timeSpentSec = Math.min(
        s.durationMin * 60,
        Math.round((Date.now() - s.startTs) / 1000)
    );

    const attempt = {
        examId: s.examId,
        title: s.title,
        ts: Date.now(),
        score,
        total,
        timeSpentSec,
        autoSubmitted: !!auto,
        answers: s.questions.map((q, i) => ({
            n: q.n,
            q: q.q,
            section: q.section || '',
            type: q.type,
            userValue: s.answers[i] ? s.answers[i].value : null,
            isCorrect: !!(s.answers[i] && s.answers[i].isCorrect),
            correctAnswer: q.type === 'text' ? q.answer : q.options[q.correct].replace(/<\/?u>/g, ''),
            explanation: q.explanation,
        })),
    };

    const history = loadExamHistory();
    history.unshift(attempt);
    saveExamHistory(history);

    _renderExamResults(attempt, auto);
    _examState = null;
}

function _renderExamResults(attempt, auto) {
    const screen = document.getElementById('examScreen');
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
        return `
        <div class="exam-review-item ${a.isCorrect ? 'correct' : 'wrong'}">
            <div class="exam-review-q"><span class="exam-review-num">${a.n}</span> ${escExam(a.q).replace(/\n/g, '<br>')}</div>
            <div class="exam-review-line">
                <span class="exam-review-badge ${a.isCorrect ? 'ok' : 'no'}">${a.isCorrect ? '✓' : '✗'}</span>
                <span>Your answer: <strong>${userStr}</strong></span>
            </div>
            ${a.isCorrect ? '' : `<div class="exam-review-line">✅ Correct: <strong>${escExam(a.correctAnswer)}</strong></div>`}
            <div class="exam-review-explain">💡 ${a.explanation}</div>
        </div>`;
    }).join('');

    screen.innerHTML = `
        <div class="exam-result">
            <div class="exam-result-emoji">${emoji}</div>
            <div class="exam-result-grade">${grade}</div>
            <div class="exam-result-score">${attempt.score}<span>/${attempt.total}</span></div>
            <div class="exam-result-pct">${pct}% · ${escExam(attempt.title)}</div>
            <div class="exam-result-time">⏱️ Time used: ${_fmtClock(attempt.timeSpentSec)}</div>
            ${autoNote}
            <div class="exam-result-actions">
                <button class="exam-btn-primary" onclick="confirmStartExam('${attempt.examId}')">🔁 Retake</button>
                <button class="exam-btn-secondary" onclick="renderExamHome()">← Exam Home</button>
            </div>
            <h2 class="exam-review-title">Review — every question</h2>
            <div class="exam-review-list">${reviewHTML}</div>
        </div>
    `;
    if (screen) screen.scrollTop = 0;
    window.scrollTo(0, 0);
}

function _optionLetterFor(a) {
    // For choice questions in review we only stored the option index in userValue.
    if (typeof a.userValue !== 'number') return String(a.userValue);
    return String.fromCharCode(65 + a.userValue);
}

// ---- history -----------------------------------------------------------------

function renderExamHistory() {
    const screen = document.getElementById('examScreen');
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
    const screen = document.getElementById('examScreen');
    const actions = screen.querySelector('.exam-result-actions');
    if (actions) {
        actions.innerHTML = `
            <button class="exam-btn-primary" onclick="confirmStartExam('${attempt.examId}')">🔁 Retake</button>
            <button class="exam-btn-secondary" onclick="renderExamHistory()">← Back to History</button>`;
    }
}

function clearExamHistory() {
    if (confirm('Delete all saved exam attempts? This cannot be undone.')) {
        saveExamHistory([]);
        renderExamHistory();
    }
}
