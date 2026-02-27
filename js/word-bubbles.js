// word-bubbles.js - Word Bubbles vocabulary game

let bubblesState = {
    pool: [],
    currentWord: null,
    round: 0,
    totalRounds: 10,
    score: 0,
    lives: 3,
    animationDuration: 6, // seconds, decreases over rounds
    bubbleTimers: [],
    isActive: false
};

function startWordBubbles() {
    const pool = getGameWordPool(30);
    if (pool.length < 4) {
        showToast('Learn more words first!');
        return;
    }

    bubblesState = {
        pool: pool,
        currentWord: null,
        round: 0,
        totalRounds: 10,
        score: 0,
        lives: 3,
        animationDuration: 6,
        bubbleTimers: [],
        isActive: true
    };

    const overlay = document.getElementById('bubblesOverlay');
    overlay.classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';
    renderBubblesUI();
    startBubblesRound();
}

function renderBubblesUI() {
    const overlay = document.getElementById('bubblesOverlay');

    overlay.innerHTML = `
        <div class="bubbles-container">
            <div class="bubbles-header">
                <button class="bubbles-exit-btn" onclick="closeBubbles()">✕</button>
                <div class="bubbles-score">⭐ <span id="bubblesScore">${bubblesState.score}</span></div>
                <div class="bubbles-lives" id="bubblesLives">
                    ${'❤️'.repeat(bubblesState.lives)}${'🖤'.repeat(3 - bubblesState.lives)}
                </div>
                <div class="bubbles-round">Round <span id="bubblesRound">${bubblesState.round}</span>/${bubblesState.totalRounds}</div>
            </div>

            <div class="bubbles-clue" id="bubblesClue">
                <div class="bubbles-clue-label">Tap the correct English word:</div>
                <div class="bubbles-clue-word" id="bubblesClueWord">...</div>
            </div>

            <div class="bubbles-arena" id="bubblesArena"></div>
        </div>
    `;
}

function startBubblesRound() {
    if (!bubblesState.isActive) return;

    bubblesState.round++;

    if (bubblesState.round > bubblesState.totalRounds || bubblesState.lives <= 0) {
        onBubblesEnd();
        return;
    }

    // Speed ramp: decrease duration every 3 rounds
    bubblesState.animationDuration = Math.max(3, 6 - Math.floor((bubblesState.round - 1) / 3) * 0.8);

    // Pick correct word + 3 distractors
    const shuffledPool = shuffleArray(bubblesState.pool);
    const correct = shuffledPool[0];
    bubblesState.currentWord = correct;

    // Pick 3 distractors different from correct
    const distractors = shuffledPool.filter(w => w.en !== correct.en).slice(0, 3);
    const options = shuffleArray([correct, ...distractors]);

    // Update UI
    const scoreEl = document.getElementById('bubblesScore');
    const roundEl = document.getElementById('bubblesRound');
    const livesEl = document.getElementById('bubblesLives');
    const clueEl = document.getElementById('bubblesClueWord');

    if (scoreEl) scoreEl.textContent = bubblesState.score;
    if (roundEl) roundEl.textContent = bubblesState.round;
    if (livesEl) livesEl.innerHTML = '❤️'.repeat(bubblesState.lives) + '🖤'.repeat(3 - bubblesState.lives);
    if (clueEl) clueEl.textContent = `${correct.emoji} ${correct.vi}`;

    spawnBubbles(options, correct);
}

function spawnBubbles(options, correct) {
    const arena = document.getElementById('bubblesArena');
    if (!arena) return;
    arena.innerHTML = '';

    // Clear previous timers
    bubblesState.bubbleTimers.forEach(t => clearTimeout(t));
    bubblesState.bubbleTimers = [];

    // Random horizontal positions
    const positions = shuffleArray([10, 30, 55, 78]);

    options.forEach((word, i) => {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const isCorrect = word.en === correct.en;
        bubble.dataset.correct = isCorrect ? '1' : '0';
        bubble.style.left = `${positions[i]}%`;
        bubble.style.animationDuration = `${bubblesState.animationDuration + (Math.random() * 1.5)}s`;
        bubble.style.animationDelay = `${i * 0.3}s`;

        bubble.innerHTML = `<span class="bubble-text">${word.en}</span>`;
        bubble.onclick = function() { tapBubble(this, isCorrect); };

        arena.appendChild(bubble);
    });

    // Auto-miss if all bubbles float away
    const timeout = setTimeout(() => {
        if (!bubblesState.isActive) return;
        // Check if round was already handled
        const remaining = arena.querySelectorAll('.bubble:not(.popped)');
        if (remaining.length > 0) {
            bubblesState.lives--;
            updateBubblesLives();
            if (bubblesState.lives <= 0) {
                onBubblesEnd();
            } else {
                startBubblesRound();
            }
        }
    }, (bubblesState.animationDuration + 2) * 1000);

    bubblesState.bubbleTimers.push(timeout);
}

function tapBubble(el, isCorrect) {
    if (!bubblesState.isActive) return;
    if (el.classList.contains('popped')) return;

    el.classList.add('popped');

    if (isCorrect) {
        el.classList.add('pop-correct');
        bubblesState.score += 10 + Math.floor(bubblesState.round * 1.5);

        // Pop all remaining bubbles
        const arena = document.getElementById('bubblesArena');
        arena.querySelectorAll('.bubble:not(.popped)').forEach(b => {
            b.classList.add('popped', 'pop-fade');
        });

        // Clear timers and go to next round
        bubblesState.bubbleTimers.forEach(t => clearTimeout(t));
        bubblesState.bubbleTimers = [];

        setTimeout(() => {
            if (bubblesState.isActive) startBubblesRound();
        }, 600);
    } else {
        el.classList.add('pop-wrong');
        bubblesState.lives--;
        updateBubblesLives();

        if (bubblesState.lives <= 0) {
            bubblesState.bubbleTimers.forEach(t => clearTimeout(t));
            bubblesState.bubbleTimers = [];
            setTimeout(() => onBubblesEnd(), 600);
        }
    }
}

function updateBubblesLives() {
    const livesEl = document.getElementById('bubblesLives');
    if (livesEl) {
        livesEl.innerHTML = '❤️'.repeat(Math.max(0, bubblesState.lives)) + '🖤'.repeat(3 - Math.max(0, bubblesState.lives));
    }
}

function onBubblesEnd() {
    bubblesState.isActive = false;
    bubblesState.bubbleTimers.forEach(t => clearTimeout(t));
    bubblesState.bubbleTimers = [];

    if (!appState) return;

    if (!appState.bubblesStats) {
        appState.bubblesStats = { gamesPlayed: 0, highScore: 0, bestRound: 0 };
    }

    appState.bubblesStats.gamesPlayed++;
    const completedRounds = bubblesState.round - 1;
    if (bubblesState.score > appState.bubblesStats.highScore) {
        appState.bubblesStats.highScore = bubblesState.score;
    }
    if (completedRounds > appState.bubblesStats.bestRound) {
        appState.bubblesStats.bestRound = completedRounds;
    }

    // Award points
    appState.points += bubblesState.score;

    // Achievements
    unlockAchievement('bubbles-first');
    if (appState.bubblesStats.gamesPlayed >= 10) unlockAchievement('bubbles-10');
    if (completedRounds >= bubblesState.totalRounds && bubblesState.lives === 3) {
        unlockAchievement('bubbles-perfect');
    }

    saveUserData(currentUser, appState);

    // Show results
    const overlay = document.getElementById('bubblesOverlay');
    const isNewHigh = bubblesState.score === appState.bubblesStats.highScore;

    overlay.innerHTML = `
        <div class="bubbles-container">
            <div class="bubbles-complete">
                <div class="bubbles-complete-icon">${bubblesState.lives > 0 ? '🎉' : '😔'}</div>
                <h2>${bubblesState.lives > 0 ? 'Great job!' : 'Game Over'}</h2>
                <div class="bubbles-complete-score">Score: ${bubblesState.score}</div>
                <div class="bubbles-complete-rounds">Rounds: ${completedRounds}/${bubblesState.totalRounds}</div>
                ${isNewHigh ? '<div class="bubbles-new-record">🏆 New High Score!</div>' : ''}
                <div class="bubbles-complete-points">+${bubblesState.score} points</div>
                <button class="bubbles-action-btn" onclick="startWordBubbles()">Play Again</button>
                <button class="bubbles-close-btn" onclick="closeBubbles()">Back to Games</button>
            </div>
        </div>
    `;
}

function closeBubbles() {
    bubblesState.isActive = false;
    bubblesState.bubbleTimers.forEach(t => clearTimeout(t));
    bubblesState.bubbleTimers = [];

    const overlay = document.getElementById('bubblesOverlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
    document.getElementById('bottomNav').style.display = 'flex';
    renderGamesLobby();
}
