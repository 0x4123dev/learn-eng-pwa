// verbs.js - Speed challenge / irregular verb game
// Globals: SPEED_TIME_LIMIT, SPEED_PENALTY_TIME, SPEED_QUESTIONS_PER_GAME, speedState (from app.js)

function renderSpeedChallenge() {
    // Update leaderboard from appState
    if (appState.speedChallenge) {
        document.getElementById('bestScore').textContent = appState.speedChallenge.bestScore || 0;
        document.getElementById('bestStreak').textContent = appState.speedChallenge.bestStreak || 0;
        document.getElementById('totalPlayed').textContent = appState.speedChallenge.totalGames || 0;
    }
    renderSpeedHistory();
}

function renderSpeedHistory() {
    const container = document.getElementById('speedHistoryList');
    const history = appState.speedChallenge?.history || [];

    if (history.length === 0) {
        container.innerHTML = '<div class="empty-history">No games played yet</div>';
        return;
    }

    const levelNames = { 0: 'All Verbs', 1: 'Basic', 2: 'Medium', 3: 'Hard', 4: 'Expert' };
    const levelIcons = { 0: '⚡', 1: '🌱', 2: '🌿', 3: '🌳', 4: '🔥' };

    const recent = history.slice(-15).reverse();
    let html = '<div class="speed-history-table">';

    recent.forEach((game, index) => {
        const accuracy = Math.round((game.correct / game.total) * 100);
        const isPerfect = accuracy === 100;
        const levelClass = `level-${game.level}`;

        html += `
        <div class="speed-history-row" onclick="toggleSpeedHistoryDetail(${index})">
            <div class="speed-history-icon ${levelClass}">${levelIcons[game.level] || '📝'}</div>
            <div class="speed-history-info">
                <div class="speed-history-title">${levelNames[game.level] || 'Level ' + game.level}</div>
                <div class="speed-history-date">${formatDate(game.date)} · ${formatTime(game.date)}</div>
            </div>
            <div class="speed-history-stats">
                <div class="speed-history-score">+${game.score}</div>
                <div class="speed-history-accuracy${isPerfect ? ' perfect' : ''}">${game.correct}/${game.total}</div>
            </div>
            <div class="speed-history-expand">▼</div>
        </div>
        <div class="speed-history-detail" id="speedHistoryDetail${index}">
            <div class="verb-result-list">
                ${(game.verbs || []).map(v => {
                    if (v.correct) {
                        return `<div class="verb-result-item correct">
                            <span class="verb-result-icon">✅</span>
                            <div class="verb-result-text">
                                <div class="verb-result-forms">${v.v1} → ${v.v2} → ${v.v3}</div>
                            </div>
                        </div>`;
                    } else {
                        const userAnswer = [v.userV2, v.userV3].filter(a => a).join(' / ') || 'no answer';
                        return `<div class="verb-result-item wrong">
                            <span class="verb-result-icon">❌</span>
                            <div class="verb-result-text">
                                <div class="verb-result-forms">${v.v1} → ${v.v2} → ${v.v3}</div>
                                <div class="verb-result-user">Your answer: <span class="wrong-text">${userAnswer}</span></div>
                            </div>
                        </div>`;
                    }
                }).join('')}
            </div>
        </div>`;
    });

    html += '</div>';
    container.innerHTML = html;
}

function toggleSpeedHistoryDetail(index) {
    const detail = document.getElementById(`speedHistoryDetail${index}`);
    const row = detail.previousElementSibling;

    if (detail.classList.contains('show')) {
        detail.classList.remove('show');
        row.classList.remove('expanded');
    } else {
        document.querySelectorAll('.speed-history-detail.show').forEach(d => {
            d.classList.remove('show');
            d.previousElementSibling.classList.remove('expanded');
        });
        detail.classList.add('show');
        row.classList.add('expanded');
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

// Set up Check button to not steal focus from input on mobile
(function() {
    const btn = document.getElementById('speedSubmitBtn');
    // touchstart: submit immediately and prevent keyboard from closing
    btn.addEventListener('touchstart', function(e) {
        e.preventDefault();
        submitSpeedAnswer();
    }, { passive: false });
    // mousedown: prevent focus steal on desktop
    btn.addEventListener('mousedown', function(e) {
        e.preventDefault();
    });
    // click: desktop fallback (won't fire on mobile due to touchstart preventDefault)
    btn.addEventListener('click', function() {
        submitSpeedAnswer();
    });
})();

function startSpeedChallenge(level) {
    speedState.level = level;
    speedState.currentIndex = 0;
    speedState.score = 0;
    speedState.streak = 0;
    speedState.bestStreakInGame = 0;
    speedState.correctCount = 0;
    speedState.verbResults = [];

    // Filter verbs by level (0 = all)
    let verbs = level === 0
        ? [...irregularVerbs]
        : irregularVerbs.filter(v => v.level === level);

    // Shuffle and pick questions
    speedState.currentVerbs = shuffleArray(verbs).slice(0, SPEED_QUESTIONS_PER_GAME);

    // Show game overlay
    document.getElementById('speedGameOverlay').classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';

    // Start first question
    showSpeedQuestion();
}

function showSpeedQuestion() {
    const verb = speedState.currentVerbs[speedState.currentIndex];

    // Update UI
    document.getElementById('verbV1').textContent = verb.v1;
    document.getElementById('verbMeaning').textContent = verb.vi;
    document.getElementById('speedProgress').textContent =
        `${speedState.currentIndex + 1}/${speedState.currentVerbs.length}`;
    document.getElementById('speedScore').textContent = speedState.score;
    document.getElementById('speedStreak').textContent = speedState.streak;

    // Clear inputs
    const inputV2 = document.getElementById('inputV2');
    const inputV3 = document.getElementById('inputV3');
    inputV2.value = '';
    inputV3.value = '';
    inputV2.className = '';
    inputV3.className = '';
    inputV2.focus();

    // Clear feedback
    document.getElementById('speedFeedback').innerHTML = '';
    document.getElementById('speedFeedback').className = 'speed-feedback';

    // Enable submit button
    document.getElementById('speedSubmitBtn').disabled = false;

    // Start timer
    speedState.timeLeft = SPEED_TIME_LIMIT;
    speedState.isAnswering = true;
    updateTimerBar();

    if (speedState.timer) clearInterval(speedState.timer);
    speedState.timer = setInterval(() => {
        speedState.timeLeft -= 100;
        updateTimerBar();

        if (speedState.timeLeft <= 0) {
            handleTimeUp();
        }
    }, 100);
}

function updateTimerBar() {
    const percent = (speedState.timeLeft / SPEED_TIME_LIMIT) * 100;
    const seconds = Math.ceil(speedState.timeLeft / 1000);

    document.getElementById('speedTimerFill').style.width = `${percent}%`;

    const clockEl = document.getElementById('speedTimerClock');
    clockEl.textContent = seconds;

    // Change color based on time remaining
    clockEl.classList.remove('warning', 'danger');
    if (seconds <= 10) {
        clockEl.classList.add('danger');
    } else if (seconds <= 20) {
        clockEl.classList.add('warning');
    }
}

function handleTimeUp() {
    if (!speedState.isAnswering) return;
    speedState.isAnswering = false;
    clearInterval(speedState.timer);

    const verb = speedState.currentVerbs[speedState.currentIndex];

    // Show correct answer
    document.getElementById('inputV2').classList.add('wrong');
    document.getElementById('inputV3').classList.add('wrong');
    document.getElementById('speedSubmitBtn').disabled = true;

    const feedback = document.getElementById('speedFeedback');
    feedback.className = 'speed-feedback wrong';
    feedback.innerHTML = `
        ⏰ Time's up!
        <div class="correct-answer">
            ${verb.v1} → ${verb.v2} → ${verb.v3}
        </div>
    `;

    const inputV2Val = document.getElementById('inputV2').value.trim().toLowerCase();
    const inputV3Val = document.getElementById('inputV3').value.trim().toLowerCase();
    speedState.verbResults.push({
        v1: verb.v1, v2: verb.v2, v3: verb.v3,
        userV2: inputV2Val, userV3: inputV3Val, correct: false, timeUsed: null
    });

    speedState.streak = 0;
    document.getElementById('speedStreak').textContent = speedState.streak;

    // Add penalty delay then next question
    setTimeout(() => {
        nextSpeedQuestion();
    }, SPEED_PENALTY_TIME);
}

function submitSpeedAnswer() {
    if (!speedState.isAnswering) return;
    speedState.isAnswering = false;
    clearInterval(speedState.timer);

    const verb = speedState.currentVerbs[speedState.currentIndex];
    const inputV2 = document.getElementById('inputV2');
    const inputV3 = document.getElementById('inputV3');
    const userV2 = inputV2.value.trim().toLowerCase();
    const userV3 = inputV3.value.trim().toLowerCase();

    // Check answers (handle multiple correct forms like "was/were")
    const correctV2 = verb.v2.toLowerCase().split('/');
    const correctV3 = verb.v3.toLowerCase().split('/');

    const isV2Correct = correctV2.some(v => v.trim() === userV2);
    const isV3Correct = correctV3.some(v => v.trim() === userV3);

    document.getElementById('speedSubmitBtn').disabled = true;

    // Keep inputV2 focused and editable to keep mobile keyboard open
    // isAnswering=false already prevents double submission
    inputV2.focus();

    const feedback = document.getElementById('speedFeedback');

    if (isV2Correct && isV3Correct) {
        // Calculate points with speed bonus
        const timeUsed = SPEED_TIME_LIMIT - speedState.timeLeft;
        const speedBonus = Math.floor((speedState.timeLeft / SPEED_TIME_LIMIT) * 50);
        const basePoints = 100;
        const totalPoints = basePoints + speedBonus;

        speedState.score += totalPoints;
        speedState.streak++;
        speedState.correctCount++;
        if (speedState.streak > speedState.bestStreakInGame) {
            speedState.bestStreakInGame = speedState.streak;
        }

        speedState.verbResults.push({
            v1: verb.v1, v2: verb.v2, v3: verb.v3,
            userV2, userV3, correct: true, timeUsed
        });

        inputV2.classList.add('correct');
        inputV3.classList.add('correct');

        feedback.className = 'speed-feedback correct';
        feedback.innerHTML = `
            ✅ Correct! +${totalPoints}
            <div class="correct-answer">Speed bonus: +${speedBonus}</div>
        `;

        document.getElementById('speedScore').textContent = speedState.score;
        document.getElementById('speedStreak').textContent = speedState.streak;

        setTimeout(() => {
            nextSpeedQuestion();
        }, 1000);
    } else {
        inputV2.classList.add(isV2Correct ? 'correct' : 'wrong');
        inputV3.classList.add(isV3Correct ? 'correct' : 'wrong');

        feedback.className = 'speed-feedback wrong';
        feedback.innerHTML = `
            ❌ Wrong!
            <div class="correct-answer">
                ${verb.v1} → ${verb.v2} → ${verb.v3}
            </div>
        `;

        speedState.verbResults.push({
            v1: verb.v1, v2: verb.v2, v3: verb.v3,
            userV2, userV3, correct: false, timeUsed: null
        });

        speedState.streak = 0;
        document.getElementById('speedStreak').textContent = speedState.streak;

        setTimeout(() => {
            nextSpeedQuestion();
        }, SPEED_PENALTY_TIME);
    }
}

function nextSpeedQuestion() {
    speedState.currentIndex++;

    if (speedState.currentIndex >= speedState.currentVerbs.length) {
        completeSpeedChallenge();
    } else {
        showSpeedQuestion();
    }
}

function completeSpeedChallenge() {
    clearInterval(speedState.timer);

    // Update stats
    document.getElementById('finalScore').textContent = speedState.score;
    document.getElementById('finalCorrect').textContent =
        `${speedState.correctCount}/${speedState.currentVerbs.length}`;
    document.getElementById('finalBestStreak').textContent = speedState.bestStreakInGame;

    // Check for new record
    if (!appState.speedChallenge) {
        appState.speedChallenge = {
            bestScore: 0,
            bestStreak: 0,
            totalGames: 0
        };
    }

    const isNewRecord = speedState.score > appState.speedChallenge.bestScore;

    if (isNewRecord) {
        appState.speedChallenge.bestScore = speedState.score;
        document.getElementById('newRecordBadge').style.display = 'block';
    } else {
        document.getElementById('newRecordBadge').style.display = 'none';
    }

    if (speedState.bestStreakInGame > appState.speedChallenge.bestStreak) {
        appState.speedChallenge.bestStreak = speedState.bestStreakInGame;
    }

    appState.speedChallenge.totalGames++;
    appState.points += speedState.score;

    // Save game to verb history
    if (!appState.speedChallenge.history) appState.speedChallenge.history = [];
    appState.speedChallenge.history.push({
        date: Date.now(),
        level: speedState.level,
        score: speedState.score,
        correct: speedState.correctCount,
        total: speedState.currentVerbs.length,
        bestStreak: speedState.bestStreakInGame,
        verbs: speedState.verbResults
    });
    // Keep last 50 games
    if (appState.speedChallenge.history.length > 50) {
        appState.speedChallenge.history = appState.speedChallenge.history.slice(-50);
    }

    saveUserData(currentUser, appState);

    // Show complete overlay
    document.getElementById('speedGameOverlay').classList.remove('active');
    document.getElementById('speedCompleteOverlay').classList.add('active');
}

function closeSpeedComplete() {
    document.getElementById('speedCompleteOverlay').classList.remove('active');
    document.getElementById('bottomNav').style.display = 'flex';
    renderSpeedChallenge();
}

function exitSpeedGame() {
    clearInterval(speedState.timer);
    document.getElementById('speedGameOverlay').classList.remove('active');
    document.getElementById('bottomNav').style.display = 'flex';
}

// Handle Enter key in inputs
document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && speedState.isAnswering) {
        submitSpeedAnswer();
    }
});
