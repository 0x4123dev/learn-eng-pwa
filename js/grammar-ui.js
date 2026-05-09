// grammar-ui.js — Grammar tab UI: home, sub-tabs (units / history), quiz, review
// Depends on grammar-units.js for question data and helpers.

let _grammarSubTab = 'units';      // 'units' | 'lessons' | 'history'
let _grammarQuizState = null;       // active quiz session
let _grammarOpenLesson = null;      // { unitId, lessonId } when viewing lesson detail

// ==================== ARRANGEMENT CHIP DISPLAY ====================
// We lowercase the first letter of the FIRST part when shown as a draggable
// chip — that way the user can't spot the start of the sentence just by
// looking for a capital letter. Proper nouns and "I" are preserved.
const _PROPER_NOUN_FIRSTS = new Set([
    // Names that appear at the start of arrangement parts in the dataset.
    // Add to this set when introducing new arrangement questions whose first
    // word is a proper noun.
    'Adrian','Hans','Hiroshige','London','Nelson','Phelps','Rajo','Tim','Van',
    // Common future-proofing: months, days, common country/place/people names
    'January','February','March','April','May','June','July','August','September','October','November','December',
    'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday',
    'Paris','Tokyo','Italy','Asia','Brazil','America','Europe','China','Japan',
    'Korea','India','Mexico','Canada','Spain','France','Germany','Russia',
    'Australia','Egypt','Greece','Vietnam','Thailand','Singapore','Indonesia',
    'Malaysia','Philippines','English','Spanish','Mandarin','Arabic',
    'Sarah','Tom','Mary','John','Jane','David','Anna','Maria','Carlos','Ana','Pedro'
]);

function _displayChipText(part, isFirstPart) {
    if (!isFirstPart || !part) return part;
    // Always-capitalized word "I" (or "I'm", "I've", "I am ...") — keep
    if (part === 'I' || /^I([\s'’]|$)/.test(part)) return part;
    const firstWord = part.split(/\s+/)[0];
    if (!firstWord || !/^[A-Z]/.test(firstWord)) return part;
    // Proper-noun heuristics: internal capital (Rags2Riches, McDonald's),
    // contains digit, or appears in our explicit list
    if (/[A-Z]/.test(firstWord.slice(1)) || /\d/.test(firstWord)) return part;
    if (_PROPER_NOUN_FIRSTS.has(firstWord)) return part;
    return part.charAt(0).toLowerCase() + part.slice(1);
}

// ==================== GRAMMAR HOME (entry point) ====================
function renderGrammarHome() {
    // Reset transient state if user navigated away
    _grammarQuizState = null;
    const screen = document.getElementById('grammarScreen');
    if (!screen) return;

    const tabs = `
        <div class="grammar-subtabs">
            <button class="grammar-subtab ${_grammarSubTab === 'units' ? 'active' : ''}" onclick="switchGrammarSubTab('units')">📖 Units</button>
            <button class="grammar-subtab ${_grammarSubTab === 'lessons' ? 'active' : ''}" onclick="switchGrammarSubTab('lessons')">📚 Lessons</button>
            <button class="grammar-subtab ${_grammarSubTab === 'history' ? 'active' : ''}" onclick="switchGrammarSubTab('history')">📜 History</button>
        </div>
    `;

    let body;
    if (_grammarSubTab === 'history') body = renderGrammarHistory();
    else if (_grammarSubTab === 'lessons') body = renderGrammarLessons();
    else body = renderGrammarUnitsList();

    screen.innerHTML = `
        <div class="grammar-header">
            <h1 class="grammar-title">🎓 Grammar Practice</h1>
            <p class="grammar-subtitle">Learn vocabulary, grammar & pronunciation</p>
        </div>
        ${tabs}
        <div class="grammar-body">${body}</div>
    `;
}

function switchGrammarSubTab(tab) {
    _grammarSubTab = tab;
    _grammarOpenLesson = null; // reset any open lesson detail when switching tabs
    renderGrammarHome();
}

// ==================== UNITS LIST ====================
function renderGrammarUnitsList() {
    // Mistake bank card (only shown if user has mistakes or bookmarks)
    const mistakes = (typeof getActiveMistakes === 'function') ? getActiveMistakes() : [];
    const bookmarks = (typeof getBookmarkedMistakes === 'function') ? getBookmarkedMistakes() : [];
    let mistakesCard = '';
    if (mistakes.length > 0 || bookmarks.length > 0) {
        const total = mistakes.length + bookmarks.filter(b => !mistakes.find(m => m.qId === b.qId)).length;
        const bookmarkLine = bookmarks.length > 0
            ? `<span class="grammar-mistakes-bookmark">★ ${bookmarks.length} bookmarked</span>`
            : '';
        mistakesCard = `
            <div class="grammar-mistakes-card">
                <div class="grammar-mistakes-icon">🎯</div>
                <div class="grammar-mistakes-text">
                    <div class="grammar-mistakes-title">Practice My Mistakes</div>
                    <div class="grammar-mistakes-sub">${mistakes.length} question${mistakes.length !== 1 ? 's' : ''} to review · ${bookmarkLine || 'graduated when answered correctly'}</div>
                </div>
                <div class="grammar-mistakes-actions">
                    ${mistakes.length >= 2 ? `<button class="grammar-quiz-btn grammar-btn-primary" onclick="startMistakesQuiz(10)">🎯 Quick (10)</button>` : ''}
                    ${mistakes.length >= 2 ? `<button class="grammar-quiz-btn grammar-btn-secondary" onclick="startMistakesQuiz(${Math.min(mistakes.length, 25)})">📚 All</button>` : ''}
                    ${mistakes.length < 2 ? '<div class="grammar-mistakes-empty-cta">Take quizzes to build your review bank.</div>' : ''}
                </div>
            </div>
        `;
    }

    const unitCards = GRAMMAR_UNITS.map(unit => {
        const stats = getGrammarStats(unit.id);
        const bestLine = stats.best
            ? `★ Best: <strong>${stats.best.score}/${stats.best.total}</strong> · ${stats.attempts} quiz${stats.attempts !== 1 ? 'zes' : ''}`
            : 'Not attempted yet';
        return `
            <div class="grammar-unit-card" style="--unit-color:${unit.color}">
                <div class="grammar-unit-header">
                    <span class="grammar-unit-icon">${unit.icon}</span>
                    <div class="grammar-unit-text">
                        <div class="grammar-unit-name">${unit.name}</div>
                        <div class="grammar-unit-desc">${unit.description}</div>
                    </div>
                </div>
                <div class="grammar-unit-stats">${bestLine}</div>
                <div class="grammar-unit-actions">
                    <button class="grammar-quiz-btn grammar-btn-primary" onclick="startGrammarQuiz('${unit.id}', 10)">🚀 Quick Quiz (10)</button>
                    <button class="grammar-quiz-btn grammar-btn-secondary" onclick="startGrammarQuiz('${unit.id}', 25)">📚 Long (25)</button>
                </div>
                <div class="grammar-unit-meta">${unit.questions.length} questions total · Vocabulary, Grammar, Pronunciation</div>
            </div>
        `;
    }).join('');

    return mistakesCard + unitCards;
}

// ==================== LESSONS LIST (theory notes) ====================
function renderGrammarLessons() {
    if (typeof GRAMMAR_LESSONS === 'undefined' || !GRAMMAR_LESSONS) {
        return '<div class="grammar-empty"><div class="grammar-empty-icon">📚</div><div class="grammar-empty-title">Lessons unavailable</div></div>';
    }

    // If a lesson is open, show its detail page
    if (_grammarOpenLesson) {
        return renderGrammarLessonDetail(_grammarOpenLesson.unitId, _grammarOpenLesson.lessonId);
    }

    const intro = `
        <div class="grammar-lessons-intro">
            <div class="grammar-lessons-intro-icon">📚</div>
            <div class="grammar-lessons-intro-text">
                <strong>Theory notes from the textbook.</strong>
                Tap a lesson to review vocabulary, pronunciation, and grammar — then practise.
            </div>
        </div>
    `;

    const unitsHTML = GRAMMAR_LESSONS.map(unit => {
        const lessonItemsHTML = unit.lessons.map(l => {
            const tagsHTML = (l.topicTags || []).slice(0, 4).map(t =>
                `<span class="lesson-item-tag">${t}</span>`
            ).join('');
            return `
                <button class="lesson-item" onclick="openGrammarLesson('${unit.unitId}', '${l.id}')">
                    <div class="lesson-item-head">
                        <span class="lesson-item-id">${l.id}</span>
                        <span class="lesson-item-title">${l.title}</span>
                        <span class="lesson-item-page">p${l.page}</span>
                    </div>
                    <div class="lesson-item-tags">${tagsHTML}</div>
                </button>
            `;
        }).join('');

        return `
            <div class="lesson-unit-group" style="border-left-color:${unit.color}">
                <div class="lesson-unit-header">
                    <span class="lesson-unit-icon">${unit.icon}</span>
                    <span class="lesson-unit-title">Unit ${unit.unitId.replace('unit', '')} — ${unit.title}</span>
                </div>
                <div class="lesson-unit-intro">${unit.intro}</div>
                <div class="lesson-unit-list">${lessonItemsHTML}</div>
            </div>
        `;
    }).join('');

    return intro + unitsHTML;
}

function openGrammarLesson(unitId, lessonId) {
    _grammarOpenLesson = { unitId, lessonId };
    renderGrammarHome();
    // Scroll to top of grammar screen
    const screen = document.getElementById('grammarScreen');
    if (screen && screen.scrollTo) screen.scrollTo({ top: 0, behavior: 'smooth' });
}

function closeGrammarLesson() {
    _grammarOpenLesson = null;
    renderGrammarHome();
}

function renderGrammarLessonDetail(unitId, lessonId) {
    const lesson = (typeof getGrammarLesson === 'function') ? getGrammarLesson(unitId, lessonId) : null;
    if (!lesson) {
        return '<div class="grammar-empty"><div class="grammar-empty-title">Lesson not found</div><button class="grammar-action-btn" onclick="closeGrammarLesson()">← Back</button></div>';
    }
    const unit = GRAMMAR_LESSONS.find(u => u.unitId === unitId);
    const unitName = unit ? unit.title : '';

    // ── Vocabulary ──
    let vocabHTML = '';
    if (lesson.vocabulary) {
        const v = lesson.vocabulary;
        const wordChips = (v.words || []).map(w => `<span class="lesson-word-chip">${w}</span>`).join('');
        vocabHTML = `
            <div class="lesson-section lesson-section-vocab">
                <div class="lesson-section-head">
                    <span class="lesson-section-icon">📖</span>
                    <span class="lesson-section-title">Vocabulary — ${v.title}</span>
                </div>
                <div class="lesson-word-grid">${wordChips}</div>
                ${v.note ? `<div class="lesson-section-note">💡 ${v.note}</div>` : ''}
            </div>
        `;
    }

    // ── Pronunciation ──
    let pronHTML = '';
    if (lesson.pronunciation) {
        const p = lesson.pronunciation;
        const examplesHTML = (p.examples || []).map(e => `<li>${e}</li>`).join('');
        pronHTML = `
            <div class="lesson-section lesson-section-pron">
                <div class="lesson-section-head">
                    <span class="lesson-section-icon">🔊</span>
                    <span class="lesson-section-title">Pronunciation — ${p.title}</span>
                </div>
                <div class="lesson-section-rule">${p.rule}</div>
                <ul class="lesson-example-list">${examplesHTML}</ul>
            </div>
        `;
    }

    // ── Grammar (can have multiple blocks) ──
    let grammarHTML = '';
    if (Array.isArray(lesson.grammar)) {
        grammarHTML = lesson.grammar.map(g => {
            const formHTML = Array.isArray(g.form) ? `
                <div class="lesson-form-table">
                    ${g.form.map(f => `
                        <div class="lesson-form-row">
                            <span class="lesson-form-label">${f.label}</span>
                            <span class="lesson-form-text">${f.text}</span>
                        </div>
                    `).join('')}
                </div>
            ` : '';
            const examplesHTML = (g.examples || []).map(e => `<li>${e}</li>`).join('');
            return `
                <div class="lesson-section lesson-section-grammar">
                    <div class="lesson-section-head">
                        <span class="lesson-section-icon">✍️</span>
                        <span class="lesson-section-title">Grammar — ${g.title}</span>
                    </div>
                    <div class="lesson-section-rule">${g.rule}</div>
                    ${formHTML}
                    ${examplesHTML ? `<ul class="lesson-example-list">${examplesHTML}</ul>` : ''}
                </div>
            `;
        }).join('');
    }

    // ── Practice button (if matching questions exist) ──
    const practiceQs = (typeof getLessonPracticeQuestions === 'function')
        ? getLessonPracticeQuestions(unitId, lessonId, 10) : [];
    const practiceHTML = practiceQs.length > 0 ? `
        <button class="lesson-practice-btn" onclick="practiceGrammarLesson('${unitId}', '${lessonId}')">
            📝 Practise this lesson (${practiceQs.length} Q)
        </button>
    ` : `
        <div class="lesson-practice-none">No practice questions for this lesson yet.</div>
    `;

    return `
        <div class="lesson-detail">
            <button class="lesson-back-btn" onclick="closeGrammarLesson()">← All lessons</button>
            <div class="lesson-detail-header">
                <div class="lesson-detail-id">${lesson.id}</div>
                <div class="lesson-detail-title">${lesson.title}</div>
                <div class="lesson-detail-meta">Unit ${unitId.replace('unit', '')} ${unitName} · 📕 p${lesson.page}</div>
            </div>
            ${vocabHTML}
            ${pronHTML}
            ${grammarHTML}
            ${practiceHTML}
        </div>
    `;
}

function practiceGrammarLesson(unitId, lessonId) {
    const qs = (typeof getLessonPracticeQuestions === 'function')
        ? getLessonPracticeQuestions(unitId, lessonId, 10) : [];
    if (!qs || qs.length === 0) {
        if (typeof showToast === 'function') showToast('No practice questions for this lesson yet.');
        return;
    }
    if (typeof startCustomQuiz === 'function') {
        // Pass the unitId as the quiz "label" so PDF page refs and history
        // resolve correctly. The quiz mode 'lesson' flags it as a lesson drill.
        startCustomQuiz(qs, unitId, 'lesson:' + lessonId);
    }
}

// ==================== HISTORY LIST ====================
// History filter state (in-memory)
let _grammarHistoryFilters = { unit: 'all', tier: 'all' };

function setGrammarHistoryFilter(kind, value) {
    _grammarHistoryFilters[kind] = value;
    renderGrammarHome();
}

function renderGrammarHistory() {
    if (!appState || !appState.grammarHistory || appState.grammarHistory.length === 0) {
        return `
            <div class="grammar-empty">
                <div class="grammar-empty-icon">📭</div>
                <div class="grammar-empty-title">No quizzes yet</div>
                <div class="grammar-empty-sub">Complete a quiz from the Units tab to see your history here.</div>
            </div>
        `;
    }

    // ── Aggregate stats banner (T2.6) ──
    const stats = (typeof getGrammarAggregateStats === 'function') ? getGrammarAggregateStats() : null;
    const banner = stats ? `
        <div class="grammar-stats-banner">
            <div class="stats-cell"><div class="stats-num">${stats.totalSessions}</div><div class="stats-lbl">Quizzes</div></div>
            <div class="stats-cell"><div class="stats-num">${stats.avgPct}%</div><div class="stats-lbl">Avg Score</div></div>
            <div class="stats-cell"><div class="stats-num">${stats.bestPct}%</div><div class="stats-lbl">Best</div></div>
            <div class="stats-cell"><div class="stats-num">${stats.totalQuestions}</div><div class="stats-lbl">Questions</div></div>
            <div class="stats-cell weak-cell"><div class="stats-num">${stats.mistakesCount}</div><div class="stats-lbl">To Review</div></div>
        </div>
    ` : '';

    // ── Weak topics (T1.3) ──
    const weakTopics = (typeof getWeakTopics === 'function') ? getWeakTopics().slice(0, 5) : [];
    const weakTopicsHTML = weakTopics.length > 0 ? `
        <div class="grammar-weak-topics">
            <div class="grammar-weak-topics-title">📉 Topics to review</div>
            ${weakTopics.map(wt => {
                const unit = getGrammarUnit(wt.unitId);
                const unitIcon = unit ? unit.icon : '';
                return `<div class="grammar-weak-topic" onclick="practiceWeakTopic('${escapeAttr(wt.topic)}', '${wt.unitId}')">
                    <span class="weak-topic-icon">${unitIcon}</span>
                    <span class="weak-topic-name">${wt.topic}</span>
                    <span class="weak-topic-misses">${wt.misses}× wrong</span>
                    <span class="weak-topic-arrow">▶</span>
                </div>`;
            }).join('')}
        </div>
    ` : '';

    // ── Filter chips (T2.7-8) ──
    const unitChips = ['all', 'unit8', 'unit9', 'unit10', 'unit11'].map(u => {
        const label = u === 'all' ? 'All units' : (getGrammarUnit(u) ? getGrammarUnit(u).icon + ' Unit ' + u.replace('unit', '') : u);
        const active = _grammarHistoryFilters.unit === u ? 'active' : '';
        return `<button class="filter-chip ${active}" onclick="setGrammarHistoryFilter('unit', '${u}')">${label}</button>`;
    }).join('');
    const tierChips = ['all', 'perfect', 'great', 'ok', 'weak'].map(t => {
        const labels = { all: 'All scores', perfect: '⭐ Perfect', great: '✅ Great', ok: '👍 OK', weak: '📝 Weak' };
        const active = _grammarHistoryFilters.tier === t ? 'active' : '';
        return `<button class="filter-chip ${active}" onclick="setGrammarHistoryFilter('tier', '${t}')">${labels[t]}</button>`;
    }).join('');
    const filtersHTML = `
        <div class="grammar-filters">
            <div class="grammar-filter-row">${unitChips}</div>
            <div class="grammar-filter-row">${tierChips}</div>
        </div>
    `;

    // ── Filter sessions ──
    let sessions = appState.grammarHistory;
    if (_grammarHistoryFilters.unit !== 'all') {
        sessions = sessions.filter(s => s.unitId === _grammarHistoryFilters.unit);
    }
    if (_grammarHistoryFilters.tier !== 'all') {
        const tierFilter = _grammarHistoryFilters.tier;
        sessions = sessions.filter(s => {
            const pct = (s.score / s.total) * 100;
            const t = pct === 100 ? 'perfect' : pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'weak';
            return t === tierFilter;
        });
    }

    // ── Time-bucket grouping (T2.9) ──
    const now = Date.now();
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = todayStart.getTime() - 86400000;
    const thisWeekStart = todayStart.getTime() - 7 * 86400000;
    const lastWeekStart = thisWeekStart - 7 * 86400000;
    const buckets = { Today: [], Yesterday: [], 'This week': [], 'Last week': [], 'Older': [] };
    for (const s of sessions) {
        if (s.date >= todayStart.getTime()) buckets['Today'].push(s);
        else if (s.date >= yesterdayStart) buckets['Yesterday'].push(s);
        else if (s.date >= thisWeekStart) buckets['This week'].push(s);
        else if (s.date >= lastWeekStart) buckets['Last week'].push(s);
        else buckets['Older'].push(s);
    }

    const idxMap = new Map();
    appState.grammarHistory.forEach((s, idx) => idxMap.set(s.id, idx));

    let listHTML = '';
    if (sessions.length === 0) {
        listHTML = `<div class="grammar-empty"><div class="grammar-empty-icon">🔍</div><div class="grammar-empty-title">No matches</div><div class="grammar-empty-sub">Try a different filter.</div></div>`;
    } else {
        for (const [bucketName, bucketSessions] of Object.entries(buckets)) {
            if (bucketSessions.length === 0) continue;
            listHTML += `<div class="grammar-bucket-label">${bucketName} <span class="bucket-count">${bucketSessions.length}</span></div>`;
            listHTML += `<div class="grammar-history-list">` + bucketSessions.map(s => {
                const idx = idxMap.get(s.id);
                const unit = getGrammarUnit(s.unitId);
                const date = new Date(s.date);
                const dateStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                const pct = Math.round((s.score / s.total) * 100);
                const tier = pct === 100 ? 'perfect' : pct >= 80 ? 'great' : pct >= 60 ? 'ok' : 'weak';
                const emoji = pct === 100 ? '⭐' : pct >= 80 ? '✅' : pct >= 60 ? '👍' : '📝';
                return `
                    <div class="grammar-history-item history-tier-${tier}" onclick="openGrammarSession(${idx})">
                        <div class="grammar-history-emoji">${emoji}</div>
                        <div class="grammar-history-text">
                            <div class="grammar-history-unit">${unit ? unit.icon + ' ' + unit.name : s.unitId}</div>
                            <div class="grammar-history-meta">${dateStr} · ${s.score}/${s.total} (${pct}%)</div>
                        </div>
                        <div class="grammar-history-arrow">›</div>
                    </div>
                `;
            }).join('') + `</div>`;
        }
    }

    return banner + weakTopicsHTML + filtersHTML + listHTML;
}

function escapeAttr(s) {
    return String(s || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// Practice a specific weak topic — quiz from mistake bank in that topic
function practiceWeakTopic(topic, unitId) {
    if (typeof getActiveMistakes !== 'function') return;
    const mistakes = getActiveMistakes().filter(m => m.topic === topic && m.unitId === unitId);
    const questions = [];
    for (const m of mistakes) {
        const q = resolveMistakeQuestion(m);
        if (q) questions.push(q);
    }
    if (questions.length < 2) {
        showToast('Need at least 2 questions for a quiz');
        return;
    }
    startCustomQuiz(questions, unitId, 'mistakes');
}

// Toggle bookmark on a session-question and re-render
function toggleSessionBookmark(qId, sessionIdx) {
    const session = appState.grammarHistory[sessionIdx];
    if (!session) return;
    const q = session.questions.find(x => x.id === qId);
    if (!q) return;
    const unitId = session.unitId === 'mixed' ? _unitIdFromQuestionId(qId) || session.unitId : session.unitId;
    if (typeof toggleMistakeBookmark === 'function') {
        toggleMistakeBookmark(qId, unitId, q.topic, q.type);
    }
    openGrammarSession(sessionIdx);
}

// Build a list of question objects (looked up from current GRAMMAR_UNITS) from
// a session's wrong answers, then start a quiz.
function rePracticeWrongFromSession(sessionIdx) {
    const session = appState.grammarHistory[sessionIdx];
    if (!session) return;
    const wrong = session.questions.filter(q => {
        if (q.type === 'arrangement') {
            return !(Array.isArray(q.userAnswer) && q.userAnswer.length === q.parts.length &&
                     q.userAnswer.every((idx, pos) => idx === pos));
        }
        return q.userAnswer !== q.correct;
    });
    if (wrong.length === 0) {
        showToast('Nothing wrong in this session — well done!');
        return;
    }
    // Re-resolve fresh question objects from the unit
    const fresh = [];
    for (const w of wrong) {
        const unitId = _unitIdFromQuestionId(w.id) || session.unitId;
        const u = getGrammarUnit(unitId);
        if (!u) continue;
        const f = u.questions.find(x => x.id === w.id);
        if (f) fresh.push(f);
    }
    if (fresh.length < 2) {
        showToast('Not enough wrong questions to re-quiz');
        return;
    }
    startCustomQuiz(fresh, session.unitId, 'wrong-only');
}

// ==================== OPEN A PAST SESSION (REVIEW) ====================
function openGrammarSession(historyIdx) {
    const session = appState.grammarHistory[historyIdx];
    if (!session) return;
    const unit = getGrammarUnit(session.unitId);
    const screen = document.getElementById('grammarScreen');

    const items = session.questions.map((q, i) => {
        const userAns = q.userAnswer;
        let isCorrect, userAnsText, correctAnsText, qText;

        if (q.type === 'arrangement') {
            isCorrect = Array.isArray(userAns) && userAns.length === q.parts.length &&
                        userAns.every((idx, pos) => idx === pos);
            userAnsText = Array.isArray(userAns) && userAns.length > 0
                ? userAns.map(idx => q.parts[idx]).join(' ')
                : '— skipped —';
            correctAnsText = q.parts.join(' ');
            qText = '📝 Arrange these into a sentence: <em>' + q.parts.map((p, i) => _displayChipText(p, i === 0)).join(' / ') + '</em>';
        } else {
            isCorrect = userAns === q.correct;
            userAnsText = userAns !== null && userAns !== undefined ? q.options[userAns] : '— skipped —';
            correctAnsText = q.options[q.correct];
            qText = q.q;
        }

        const isBookmarked = (typeof isQuestionBookmarked === 'function') && isQuestionBookmarked(q.id);
        const refUnitId = session.unitId === 'mixed' ? (_unitIdFromQuestionId(q.id) || session.unitId) : session.unitId;
        const pageRef = (typeof formatPdfPageRef === 'function') ? formatPdfPageRef(refUnitId, q) : '';

        return `
            <div class="grammar-review-item ${isCorrect ? 'correct' : 'wrong'}">
                <div class="grammar-review-header">
                    <span class="grammar-review-num">${i + 1}.</span>
                    <span class="grammar-review-status">${isCorrect ? '✓ Correct' : '✗ Wrong'}</span>
                    <span class="grammar-review-tag">${q.type} · ${q.topic}</span>
                    <button class="grammar-bookmark-btn ${isBookmarked ? 'bookmarked' : ''}"
                            onclick="event.stopPropagation(); toggleSessionBookmark('${q.id}', ${historyIdx})"
                            title="${isBookmarked ? 'Remove bookmark' : 'Bookmark this question'}">
                        ${isBookmarked ? '★' : '☆'}
                    </button>
                </div>
                <div class="grammar-review-q">${qText}</div>
                <div class="grammar-review-answers">
                    <div class="grammar-review-line ${isCorrect ? 'line-correct' : 'line-wrong'}">
                        <strong>Your answer:</strong> ${userAnsText}
                    </div>
                    ${!isCorrect ? `
                        <div class="grammar-review-line line-correct">
                            <strong>Correct answer:</strong> ${correctAnsText}
                        </div>
                    ` : ''}
                </div>
                <div class="grammar-review-explain">💡 ${q.explanation}</div>
                ${pageRef ? `<div class="grammar-page-ref">${pageRef}</div>` : ''}
            </div>
        `;
    }).join('');

    // Count wrong for the re-quiz button
    const wrongCount = session.questions.filter(q => {
        if (q.type === 'arrangement') {
            return !(Array.isArray(q.userAnswer) && q.userAnswer.length === q.parts.length &&
                     q.userAnswer.every((idx, pos) => idx === pos));
        }
        return q.userAnswer !== q.correct;
    }).length;

    const rePracticeBtn = wrongCount >= 2
        ? `<button class="grammar-quiz-btn grammar-btn-primary" onclick="rePracticeWrongFromSession(${historyIdx})">🎯 Practice the ${wrongCount} you got wrong</button>`
        : '';

    screen.innerHTML = `
        <button class="grammar-back-btn" onclick="renderGrammarHome()">‹ Back</button>
        <div class="grammar-result-header">
            <h2>${unit ? unit.icon + ' ' + unit.name : session.unitId}</h2>
            <div class="grammar-result-score">${session.score} / ${session.total}</div>
            <div class="grammar-result-pct">${Math.round((session.score / session.total) * 100)}%</div>
            <div class="grammar-result-date">${new Date(session.date).toLocaleString()}</div>
        </div>
        ${rePracticeBtn ? `<div class="grammar-result-actions">${rePracticeBtn}</div>` : ''}
        <div class="grammar-review-list">${items}</div>
        <button class="grammar-back-btn-bottom" onclick="renderGrammarHome()">‹ Back to Grammar</button>
    `;
    screen.scrollTop = 0;
}

// ==================== START QUIZ ====================
// Resolve the source unit for a question by parsing its ID prefix (u8/u9/u10/u11).
function _unitIdFromQuestionId(qId) {
    if (!qId) return null;
    const m = String(qId).match(/^(u\d+)-/);
    return m ? 'unit' + m[1].slice(1) : null;
}

// Helper that builds quiz state from a list of question objects (used by all quiz starters)
function _buildQuizStateFromQuestions(questions, unitId, mode) {
    return {
        unitId: unitId || 'mixed',
        mode: mode || 'standard',     // 'standard' | 'mistakes' | 'wrong-only'
        questions,
        answers: new Array(questions.length).fill(null),
        currentIdx: 0,
        showingResult: false,
        arrangements: questions.map(q => {
            if (q.type !== 'arrangement') return null;
            const indices = q.parts.map((_, i) => i);
            for (let i = indices.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [indices[i], indices[j]] = [indices[j], indices[i]];
            }
            return { shuffled: indices, ordered: [] };
        })
    };
}

function startGrammarQuiz(unitId, n) {
    const questions = generateGrammarQuiz(unitId, n);
    if (questions.length === 0) {
        showToast('No questions available');
        return;
    }
    _grammarQuizState = _buildQuizStateFromQuestions(questions, unitId, 'standard');
    renderGrammarQuestion();
}

// Start a quiz from a specific list of question objects (used by mistake bank,
// "re-quiz the wrong ones" in session detail, and weak-topic mini-quiz).
function startCustomQuiz(questionObjects, label, mode) {
    if (!questionObjects || questionObjects.length === 0) {
        showToast('No questions available');
        return;
    }
    // Shuffle for variety
    const pool = [...questionObjects];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    _grammarQuizState = _buildQuizStateFromQuestions(pool, label || 'mixed', mode || 'custom');
    renderGrammarQuestion();
}

// Start a "Practice My Mistakes" quiz drawing from the active mistake bank.
function startMistakesQuiz(n) {
    if (typeof getActiveMistakes !== 'function') {
        showToast('Mistake bank unavailable');
        return;
    }
    const mistakes = getActiveMistakes();
    if (mistakes.length < 2) {
        showToast('Take more quizzes to build your review bank!');
        return;
    }
    // Resolve each mistake to its question object
    const questions = [];
    for (const m of mistakes) {
        const q = resolveMistakeQuestion(m);
        if (q) questions.push(q);
        if (questions.length >= n) break;
    }
    if (questions.length < 2) {
        showToast('Not enough mistakes to quiz yet');
        return;
    }
    startCustomQuiz(questions, 'mixed', 'mistakes');
}

// ==================== QUIZ QUESTION SCREEN ====================
function renderGrammarQuestion() {
    const state = _grammarQuizState;
    if (!state) return;
    const q = state.questions[state.currentIdx];
    if (q.type === 'arrangement') return renderArrangementQuestion();
    return renderMCQuestion();
}

function renderMCQuestion() {
    const state = _grammarQuizState;
    const unit = getGrammarUnit(state.unitId);
    const q = state.questions[state.currentIdx];
    const total = state.questions.length;
    const userAns = state.answers[state.currentIdx];
    const showingResult = userAns !== null;
    const correct = q.correct;
    const isCorrect = userAns === correct;

    const optionsHtml = q.options.map((opt, i) => {
        let cls = 'grammar-option';
        if (showingResult) {
            if (i === correct) cls += ' correct';
            else if (i === userAns) cls += ' wrong';
        }
        const onclick = showingResult ? '' : `onclick="answerGrammarQuestion(${i})"`;
        const letter = String.fromCharCode(65 + i);
        return `<button class="${cls}" ${onclick} ${showingResult ? 'disabled' : ''}>
                    <span class="grammar-option-letter">${letter}</span>
                    <span class="grammar-option-text">${opt}</span>
                </button>`;
    }).join('');

    const scoreSoFar = scoreSoFar_();

    const pageRefStr = (typeof formatPdfPageRef === 'function') ? formatPdfPageRef(state.unitId === 'mixed' ? (_unitIdFromQuestionId(q.id) || state.unitId) : state.unitId, q) : '';
    const explanationBox = showingResult ? `
        <div class="grammar-explanation ${isCorrect ? 'correct' : 'wrong'}">
            <div class="grammar-explanation-header">
                ${isCorrect ? '✓ Correct!' : '✗ Not quite. The correct answer is <strong>' + q.options[correct] + '</strong>.'}
            </div>
            <div class="grammar-explanation-body">💡 ${q.explanation}</div>
            ${pageRefStr ? `<div class="grammar-page-ref">${pageRefStr}</div>` : ''}
        </div>
        <button class="grammar-next-btn" onclick="nextGrammarQuestion()">
            ${state.currentIdx + 1 >= total ? '🏁 See Results' : 'Next Question →'}
        </button>
    ` : '';

    document.getElementById('grammarScreen').innerHTML = `
        ${quizHeaderHTML()}
        <div class="grammar-question-card">
            <div class="grammar-question-tag">${q.type} · ${q.topic}</div>
            <div class="grammar-question-text">${q.q}</div>
            <div class="grammar-options">${optionsHtml}</div>
        </div>
        ${explanationBox}
    `;
}

function renderArrangementQuestion() {
    const state = _grammarQuizState;
    const unit = getGrammarUnit(state.unitId);
    const q = state.questions[state.currentIdx];
    const total = state.questions.length;
    const arr = state.arrangements[state.currentIdx];
    const userAns = state.answers[state.currentIdx];           // null OR array of indices
    const showingResult = userAns !== null;
    const isCorrect = showingResult && _arrangementIsCorrect(userAns, q.parts.length);

    // Pool: shuffled indices not yet placed in answer (when not submitted)
    // Answer: user's chosen order
    const placed = new Set(arr.ordered);
    const poolHTML = arr.shuffled.filter(i => !placed.has(i)).map(i =>
        `<button class="arr-tile arr-tile-pool" onclick="placeArrangementTile(${i})" ${showingResult ? 'disabled' : ''}>${_displayChipText(q.parts[i], i === 0)}</button>`
    ).join('');

    const answerHTML = arr.ordered.map((i, pos) => {
        let cls = 'arr-tile arr-tile-answer';
        if (showingResult) {
            // The correct order is just [0,1,2,...]; check if user's tile at this position matches
            cls += (i === pos) ? ' correct' : ' wrong';
        }
        const onclick = showingResult ? '' : `onclick="unplaceArrangementTile(${pos})"`;
        return `<button class="${cls}" ${onclick} ${showingResult ? 'disabled' : ''}>${_displayChipText(q.parts[i], i === 0)}</button>`;
    }).join('') || '<span class="arr-placeholder">Tap tiles below to build the sentence…</span>';

    const allPlaced = arr.ordered.length === q.parts.length;

    let actionsHTML = '';
    if (showingResult) {
        const correctSentence = q.parts.join(' ').replace(/ \./g, '.').replace(/ \?/g, '?').replace(/ !/g, '!');
        const pageRefStr = (typeof formatPdfPageRef === 'function') ? formatPdfPageRef(state.unitId === 'mixed' ? (_unitIdFromQuestionId(q.id) || state.unitId) : state.unitId, q) : '';
        actionsHTML = `
            <div class="grammar-explanation ${isCorrect ? 'correct' : 'wrong'}">
                <div class="grammar-explanation-header">
                    ${isCorrect ? '✓ Correct!' : '✗ Not quite. The correct order is:'}
                </div>
                ${!isCorrect ? `<div class="arr-correct-sentence">"${correctSentence}"</div>` : ''}
                <div class="grammar-explanation-body">💡 ${q.explanation}</div>
                ${pageRefStr ? `<div class="grammar-page-ref">${pageRefStr}</div>` : ''}
            </div>
            <button class="grammar-next-btn" onclick="nextGrammarQuestion()">
                ${state.currentIdx + 1 >= total ? '🏁 See Results' : 'Next Question →'}
            </button>
        `;
    } else {
        actionsHTML = `
            <div class="arr-controls">
                <button class="arr-clear-btn" onclick="clearArrangement()" ${arr.ordered.length === 0 ? 'disabled' : ''}>Clear</button>
                <button class="arr-submit-btn" onclick="submitArrangement()" ${!allPlaced ? 'disabled' : ''}>${allPlaced ? '✓ Submit' : 'Place all tiles to submit'}</button>
            </div>
        `;
    }

    document.getElementById('grammarScreen').innerHTML = `
        ${quizHeaderHTML()}
        <div class="grammar-question-card">
            <div class="grammar-question-tag">arrangement · ${q.topic}</div>
            <div class="grammar-question-text">📝 Arrange the words to make a correct sentence:</div>
            <div class="arr-answer-zone">${answerHTML}</div>
            <div class="arr-pool-label">Tap tiles below to add them in order:</div>
            <div class="arr-pool-zone">${poolHTML || '<span class="arr-placeholder">All tiles placed!</span>'}</div>
        </div>
        ${actionsHTML}
    `;
}

function placeArrangementTile(idx) {
    const state = _grammarQuizState;
    if (!state) return;
    if (state.answers[state.currentIdx] !== null) return; // already submitted
    const arr = state.arrangements[state.currentIdx];
    if (arr.ordered.includes(idx)) return;
    arr.ordered.push(idx);
    renderArrangementQuestion();
}

function unplaceArrangementTile(pos) {
    const state = _grammarQuizState;
    if (!state) return;
    if (state.answers[state.currentIdx] !== null) return;
    const arr = state.arrangements[state.currentIdx];
    arr.ordered.splice(pos, 1);
    renderArrangementQuestion();
}

function clearArrangement() {
    const state = _grammarQuizState;
    if (!state) return;
    if (state.answers[state.currentIdx] !== null) return;
    state.arrangements[state.currentIdx].ordered = [];
    renderArrangementQuestion();
}

function submitArrangement() {
    const state = _grammarQuizState;
    if (!state) return;
    const arr = state.arrangements[state.currentIdx];
    const q = state.questions[state.currentIdx];
    if (arr.ordered.length !== q.parts.length) return;
    state.answers[state.currentIdx] = [...arr.ordered]; // store as array of indices
    renderArrangementQuestion();
}

function _arrangementIsCorrect(userOrder, expectedLength) {
    if (!Array.isArray(userOrder)) return false;
    if (userOrder.length !== expectedLength) return false;
    return userOrder.every((idx, pos) => idx === pos);
}

// Helpers for header/score (used by both renderers)
function scoreSoFar_() {
    const state = _grammarQuizState;
    return state.answers.slice(0, state.currentIdx).reduce((sum, ans, i) => {
        const q = state.questions[i];
        if (ans === null) return sum;
        if (q.type === 'arrangement') {
            return sum + (_arrangementIsCorrect(ans, q.parts.length) ? 1 : 0);
        }
        return sum + (ans === q.correct ? 1 : 0);
    }, 0);
}

function quizHeaderHTML() {
    const state = _grammarQuizState;
    const unit = getGrammarUnit(state.unitId);
    const total = state.questions.length;
    const score = scoreSoFar_();
    return `
        <button class="grammar-back-btn" onclick="confirmExitGrammarQuiz()">✕ Exit Quiz</button>
        <div class="grammar-quiz-header">
            <div class="grammar-quiz-unit">${unit.icon} ${unit.name}</div>
            <div class="grammar-quiz-progress">Question ${state.currentIdx + 1} of ${total} · Score: ${score}</div>
            <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round((state.currentIdx / total) * 100)}%"></div></div>
        </div>
    `;
}

function answerGrammarQuestion(optionIdx) {
    const state = _grammarQuizState;
    if (!state) return;
    if (state.answers[state.currentIdx] !== null) return; // Already answered
    state.answers[state.currentIdx] = optionIdx;
    renderGrammarQuestion();
}

function nextGrammarQuestion() {
    const state = _grammarQuizState;
    if (!state) return;
    state.currentIdx++;
    if (state.currentIdx >= state.questions.length) {
        finishGrammarQuiz();
    } else {
        renderGrammarQuestion();
    }
}

function confirmExitGrammarQuiz() {
    if (confirm('Exit quiz? Your progress will be lost.')) {
        _grammarQuizState = null;
        renderGrammarHome();
    }
}

// ==================== FINISH QUIZ — RESULT ====================
function finishGrammarQuiz() {
    const state = _grammarQuizState;
    if (!state) return;
    const session = saveGrammarSession(state.unitId, state.questions, state.answers);
    const unit = getGrammarUnit(state.unitId);
    const pct = Math.round((session.score / session.total) * 100);
    const isPerfect = pct === 100;
    const tierEmoji = isPerfect ? '🏆' : pct >= 80 ? '⭐' : pct >= 60 ? '👍' : '💪';
    const tierMsg = isPerfect ? 'Perfect score!' : pct >= 80 ? 'Great job!' : pct >= 60 ? 'Good effort!' : 'Keep practising!';

    // Award coins as a small reward
    const coinsEarned = session.score * 5;
    if (appState && typeof appState.coins === 'number') {
        appState.coins += coinsEarned;
        if (typeof saveUserData === 'function') saveUserData(currentUser, appState);
    }
    if (isPerfect && typeof createConfetti === 'function') createConfetti();

    document.getElementById('grammarScreen').innerHTML = `
        <div class="grammar-result-card">
            <div class="grammar-result-emoji">${tierEmoji}</div>
            <h2 class="grammar-result-title">${tierMsg}</h2>
            <div class="grammar-result-score">${session.score} / ${session.total}</div>
            <div class="grammar-result-pct">${pct}%</div>
            <div class="grammar-result-unit">${unit.icon} ${unit.name}</div>
            <div class="grammar-result-coins">+${coinsEarned} 🪙 earned</div>
            <div class="grammar-result-actions">
                <button class="grammar-quiz-btn grammar-btn-secondary" onclick="reviewLastGrammarSession()">📖 Review Answers</button>
                <button class="grammar-quiz-btn grammar-btn-primary" onclick="startGrammarQuiz('${state.unitId}', ${state.questions.length})">🔄 Try Again</button>
                <button class="grammar-quiz-btn grammar-btn-secondary" onclick="renderGrammarHome()">🏠 Done</button>
            </div>
        </div>
    `;
    _grammarQuizState = null;
}

function reviewLastGrammarSession() {
    // The session we just saved is at index 0 (newest first)
    openGrammarSession(0);
}
