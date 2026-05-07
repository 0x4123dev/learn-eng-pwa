// grammar-ui.js — Grammar tab UI: home, sub-tabs (units / history), quiz, review
// Depends on grammar-units.js for question data and helpers.

let _grammarSubTab = 'units';      // 'units' | 'history'
let _grammarQuizState = null;       // active quiz session

// ==================== GRAMMAR HOME (entry point) ====================
function renderGrammarHome() {
    // Reset transient state if user navigated away
    _grammarQuizState = null;
    const screen = document.getElementById('grammarScreen');
    if (!screen) return;

    const tabs = `
        <div class="grammar-subtabs">
            <button class="grammar-subtab ${_grammarSubTab === 'units' ? 'active' : ''}" onclick="switchGrammarSubTab('units')">📖 Units</button>
            <button class="grammar-subtab ${_grammarSubTab === 'history' ? 'active' : ''}" onclick="switchGrammarSubTab('history')">📜 History</button>
        </div>
    `;

    const body = _grammarSubTab === 'history' ? renderGrammarHistory() : renderGrammarUnitsList();

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
    renderGrammarHome();
}

// ==================== UNITS LIST ====================
function renderGrammarUnitsList() {
    return GRAMMAR_UNITS.map(unit => {
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
}

// ==================== HISTORY LIST ====================
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
    const sessions = appState.grammarHistory;
    return `<div class="grammar-history-list">` + sessions.map((s, idx) => {
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

// ==================== OPEN A PAST SESSION (REVIEW) ====================
function openGrammarSession(historyIdx) {
    const session = appState.grammarHistory[historyIdx];
    if (!session) return;
    const unit = getGrammarUnit(session.unitId);
    const screen = document.getElementById('grammarScreen');

    const items = session.questions.map((q, i) => {
        const userAns = q.userAnswer;
        const isCorrect = userAns === q.correct;
        const userAnsText = userAns !== null && userAns !== undefined ? q.options[userAns] : '— skipped —';
        return `
            <div class="grammar-review-item ${isCorrect ? 'correct' : 'wrong'}">
                <div class="grammar-review-header">
                    <span class="grammar-review-num">${i + 1}.</span>
                    <span class="grammar-review-status">${isCorrect ? '✓ Correct' : '✗ Wrong'}</span>
                    <span class="grammar-review-tag">${q.type} · ${q.topic}</span>
                </div>
                <div class="grammar-review-q">${q.q}</div>
                <div class="grammar-review-answers">
                    <div class="grammar-review-line ${isCorrect ? 'line-correct' : 'line-wrong'}">
                        <strong>Your answer:</strong> ${userAnsText}
                    </div>
                    ${!isCorrect ? `
                        <div class="grammar-review-line line-correct">
                            <strong>Correct answer:</strong> ${q.options[q.correct]}
                        </div>
                    ` : ''}
                </div>
                <div class="grammar-review-explain">💡 ${q.explanation}</div>
            </div>
        `;
    }).join('');

    screen.innerHTML = `
        <button class="grammar-back-btn" onclick="renderGrammarHome()">‹ Back</button>
        <div class="grammar-result-header">
            <h2>${unit ? unit.icon + ' ' + unit.name : session.unitId}</h2>
            <div class="grammar-result-score">${session.score} / ${session.total}</div>
            <div class="grammar-result-pct">${Math.round((session.score / session.total) * 100)}%</div>
            <div class="grammar-result-date">${new Date(session.date).toLocaleString()}</div>
        </div>
        <div class="grammar-review-list">${items}</div>
        <button class="grammar-back-btn-bottom" onclick="renderGrammarHome()">‹ Back to Grammar</button>
    `;
    screen.scrollTop = 0;
}

// ==================== START QUIZ ====================
function startGrammarQuiz(unitId, n) {
    const questions = generateGrammarQuiz(unitId, n);
    if (questions.length === 0) {
        showToast('No questions available');
        return;
    }
    _grammarQuizState = {
        unitId,
        questions,
        answers: new Array(questions.length).fill(null),
        currentIdx: 0,
        showingResult: false
    };
    renderGrammarQuestion();
}

// ==================== QUIZ QUESTION SCREEN ====================
function renderGrammarQuestion() {
    const state = _grammarQuizState;
    if (!state) return;
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
        const letter = String.fromCharCode(65 + i); // A, B, C, D
        return `<button class="${cls}" ${onclick} ${showingResult ? 'disabled' : ''}>
                    <span class="grammar-option-letter">${letter}</span>
                    <span class="grammar-option-text">${opt}</span>
                </button>`;
    }).join('');

    const scoreSoFar = state.answers.slice(0, state.currentIdx).reduce((sum, a, i) =>
        sum + (a === state.questions[i].correct ? 1 : 0), 0);

    const explanationBox = showingResult ? `
        <div class="grammar-explanation ${isCorrect ? 'correct' : 'wrong'}">
            <div class="grammar-explanation-header">
                ${isCorrect ? '✓ Correct!' : '✗ Not quite. The correct answer is <strong>' + q.options[correct] + '</strong>.'}
            </div>
            <div class="grammar-explanation-body">💡 ${q.explanation}</div>
        </div>
        <button class="grammar-next-btn" onclick="nextGrammarQuestion()">
            ${state.currentIdx + 1 >= total ? '🏁 See Results' : 'Next Question →'}
        </button>
    ` : '';

    document.getElementById('grammarScreen').innerHTML = `
        <button class="grammar-back-btn" onclick="confirmExitGrammarQuiz()">✕ Exit Quiz</button>
        <div class="grammar-quiz-header">
            <div class="grammar-quiz-unit">${unit.icon} ${unit.name}</div>
            <div class="grammar-quiz-progress">Question ${state.currentIdx + 1} of ${total} · Score: ${scoreSoFar}</div>
            <div class="grammar-progress-bar"><div class="grammar-progress-fill" style="width:${Math.round((state.currentIdx / total) * 100)}%"></div></div>
        </div>
        <div class="grammar-question-card">
            <div class="grammar-question-tag">${q.type} · ${q.topic}</div>
            <div class="grammar-question-text">${q.q}</div>
            <div class="grammar-options">${optionsHtml}</div>
        </div>
        ${explanationBox}
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
