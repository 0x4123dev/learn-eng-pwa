// word-bubbles.js - Word Bubbles vocabulary game

function getGameWordPool(min) {
    min = min || 20;
    var learned = [];
    if (appState && appState.srs) {
        Object.keys(appState.srs).forEach(function(word) {
            var entry = ieltsVocabulary.find(function(v) { return v.en === word; });
            if (entry) learned.push(entry);
        });
    }
    if (learned.length >= min) return shuffleArray(learned);
    return shuffleArray(ieltsVocabulary.slice(0, Math.max(min, 50)));
}

let bubblesState = {
    pool: [],
    currentWord: null,
    round: 0,
    totalRounds: 10,
    score: 0,
    lives: 3,
    combo: 0,
    bestCombo: 0,
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
        combo: 0,
        bestCombo: 0,
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
                <div class="bubbles-round"><span id="bubblesRound">${bubblesState.round}</span>/${bubblesState.totalRounds}</div>
            </div>

            <div class="bubbles-combo-banner" id="bubblesCombo"></div>

            <div class="bubbles-clue" id="bubblesClue">
                <div class="bubbles-clue-label">Tap the correct English word</div>
                <div class="bubbles-clue-emoji" id="bubblesClueEmoji"></div>
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
    const emojiEl = document.getElementById('bubblesClueEmoji');
    const clueEl = document.getElementById('bubblesClueWord');

    if (scoreEl) scoreEl.textContent = bubblesState.score;
    if (roundEl) roundEl.textContent = bubblesState.round;
    if (livesEl) livesEl.innerHTML = '❤️'.repeat(bubblesState.lives) + '🖤'.repeat(3 - bubblesState.lives);
    if (emojiEl) emojiEl.textContent = correct.emoji;
    if (clueEl) {
        clueEl.textContent = correct.vi;
        // Re-trigger clue animation
        clueEl.style.animation = 'none';
        clueEl.offsetHeight;
        clueEl.style.animation = '';
    }

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
        const riseDur = bubblesState.animationDuration + (Math.random() * 1.5);
        bubble.style.animationDuration = `${riseDur}s, 2.5s`;
        bubble.style.animationDelay = `${i * 0.3}s, ${Math.random() * 0.5}s`;

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
            bubblesState.combo = 0;
            hideComboBanner();
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

        // Combo system
        bubblesState.combo++;
        if (bubblesState.combo > bubblesState.bestCombo) {
            bubblesState.bestCombo = bubblesState.combo;
        }

        // Score with combo multiplier
        const baseScore = 10 + Math.floor(bubblesState.round * 1.5);
        const multiplier = getComboMultiplier(bubblesState.combo);
        const earned = Math.floor(baseScore * multiplier);
        bubblesState.score += earned;

        // Show combo banner
        showComboBanner(bubblesState.combo, multiplier);

        // Show floating score
        const arena = document.getElementById('bubblesArena');
        const floater = document.createElement('div');
        floater.className = 'bubble-score-float';
        floater.textContent = multiplier > 1 ? `+${earned} (x${multiplier})` : `+${earned}`;
        if (bubblesState.combo >= 3) floater.classList.add('combo-bonus');
        const rect = el.getBoundingClientRect();
        const arenaRect = arena.getBoundingClientRect();
        floater.style.left = `${rect.left - arenaRect.left + rect.width / 2 - 20}px`;
        floater.style.top = `${rect.top - arenaRect.top}px`;
        arena.appendChild(floater);
        setTimeout(() => floater.remove(), 900);

        // Update score display
        const scoreEl = document.getElementById('bubblesScore');
        if (scoreEl) scoreEl.textContent = bubblesState.score;

        // Pop all remaining bubbles
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
        bubblesState.combo = 0;
        hideComboBanner();
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
        // Trigger shake animation
        livesEl.classList.remove('shake');
        livesEl.offsetHeight;
        livesEl.classList.add('shake');
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
    const isNewHigh = bubblesState.score === appState.bubblesStats.highScore && bubblesState.score > 0;
    const won = bubblesState.lives > 0;

    if (won || isNewHigh) {
        try { createConfetti(); } catch(e) {}
    }

    overlay.innerHTML = `
        <div class="bubbles-container">
            <div class="bubbles-complete">
                <div class="bubbles-complete-icon">${won ? '🎉' : '😔'}</div>
                <h2>${won ? 'Great job!' : 'Game Over'}</h2>
                <div class="bubbles-complete-stats">
                    <div class="bubbles-stat-card">
                        <div class="bubbles-stat-value">${bubblesState.score}</div>
                        <div class="bubbles-stat-label">Score</div>
                    </div>
                    <div class="bubbles-stat-card">
                        <div class="bubbles-stat-value">${completedRounds}/${bubblesState.totalRounds}</div>
                        <div class="bubbles-stat-label">Rounds</div>
                    </div>
                    <div class="bubbles-stat-card">
                        <div class="bubbles-stat-value">${bubblesState.bestCombo > 1 ? '🔥 ' + bubblesState.bestCombo : bubblesState.lives}</div>
                        <div class="bubbles-stat-label">${bubblesState.bestCombo > 1 ? 'Best Combo' : 'Lives'}</div>
                    </div>
                </div>
                ${isNewHigh ? '<div class="bubbles-new-record">🏆 New High Score!</div>' : ''}
                <div class="bubbles-complete-points">+${bubblesState.score} points</div>
                <button class="bubbles-action-btn" onclick="startWordBubbles()">Play Again</button>
                <button class="bubbles-close-btn" onclick="closeBubbles()">Close</button>
            </div>
        </div>
    `;
}

function getComboMultiplier(combo) {
    if (combo >= 8) return 3;
    if (combo >= 5) return 2;
    if (combo >= 3) return 1.5;
    return 1;
}

function getComboLabel(combo) {
    if (combo >= 10) return { text: 'UNSTOPPABLE!', tier: 'legendary' };
    if (combo >= 8) return { text: 'ON FIRE!', tier: 'fire' };
    if (combo >= 5) return { text: 'Amazing!', tier: 'amazing' };
    if (combo >= 3) return { text: 'TRIPLE!', tier: 'triple' };
    if (combo >= 2) return { text: 'Nice!', tier: 'nice' };
    return null;
}

function showComboBanner(combo, multiplier) {
    const banner = document.getElementById('bubblesCombo');
    if (!banner) return;

    const label = getComboLabel(combo);
    if (!label) {
        banner.className = 'bubbles-combo-banner';
        banner.innerHTML = '';
        return;
    }

    banner.className = `bubbles-combo-banner active combo-${label.tier}`;
    banner.innerHTML = `
        <span class="combo-label">${label.text}</span>
        <span class="combo-count">🔥 ${combo}x combo</span>
        ${multiplier > 1 ? `<span class="combo-mult">x${multiplier} score</span>` : ''}
    `;
    // Re-trigger animation
    banner.style.animation = 'none';
    banner.offsetHeight;
    banner.style.animation = '';
}

function hideComboBanner() {
    const banner = document.getElementById('bubblesCombo');
    if (banner) {
        banner.className = 'bubbles-combo-banner';
        banner.innerHTML = '';
    }
}

function closeBubbles() {
    bubblesState.isActive = false;
    bubblesState.bubbleTimers.forEach(t => clearTimeout(t));
    bubblesState.bubbleTimers = [];

    const overlay = document.getElementById('bubblesOverlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
    document.getElementById('bottomNav').style.display = 'flex';
}
