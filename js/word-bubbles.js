// word-bubbles.js - Word Bubbles vocabulary game with ranks, stars, difficulties, collection

// ==================== RANK SYSTEM ====================
const BUBBLE_RANKS = [
    { minScore: 0,    name: 'Bubble Newbie',    emoji: '\uD83E\uDEE7', color: '#90A4AE' },
    { minScore: 100,  name: 'Bubble Popper',    emoji: '\uD83D\uDCA7', color: '#45B7D1' },
    { minScore: 300,  name: 'Bubble Hunter',    emoji: '\uD83C\uDFAF', color: '#82E0AA' },
    { minScore: 600,  name: 'Bubble Champion',  emoji: '\uD83C\uDFC5', color: '#F7DC6F' },
    { minScore: 1000, name: 'Bubble Master',    emoji: '\uD83D\uDC51', color: '#FF8A65' },
    { minScore: 2000, name: 'Bubble Legend',     emoji: '\u2B50', color: '#BB8FCE' },
    { minScore: 5000, name: 'Bubble God',        emoji: '\uD83D\uDC09', color: '#FF6B9D' }
];

function getBubbleRank(totalScore) {
    for (let i = BUBBLE_RANKS.length - 1; i >= 0; i--) {
        if (totalScore >= BUBBLE_RANKS[i].minScore) return BUBBLE_RANKS[i];
    }
    return BUBBLE_RANKS[0];
}

function getNextBubbleRank(totalScore) {
    for (let i = 0; i < BUBBLE_RANKS.length; i++) {
        if (totalScore < BUBBLE_RANKS[i].minScore) return BUBBLE_RANKS[i];
    }
    return null;
}

// ==================== DIFFICULTY MODES ====================
const BUBBLE_DIFFICULTIES = {
    easy:   { label: 'Easy',   emoji: '\uD83D\uDFE2', bubbles: 4, baseDuration: 7,   rounds: 10, lives: 3 },
    medium: { label: 'Medium', emoji: '\uD83D\uDFE1', bubbles: 5, baseDuration: 5.5, rounds: 12, lives: 3 },
    hard:   { label: 'Hard',   emoji: '\uD83D\uDD34', bubbles: 6, baseDuration: 4,   rounds: 15, lives: 3 }
};

// ==================== STAR RATING ====================
function getStarRating(won, lives, maxLives) {
    if (!won) return 0;
    if (lives === maxLives) return 3;
    if (lives >= maxLives - 1) return 2;
    return 1;
}

// ==================== WORD POOL ====================
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

// ==================== GAME STATE ====================
let bubblesState = {
    pool: [],
    currentWord: null,
    round: 0,
    totalRounds: 10,
    score: 0,
    lives: 3,
    maxLives: 3,
    combo: 0,
    bestCombo: 0,
    animationDuration: 6,
    bubbleTimers: [],
    isActive: false,
    difficulty: 'easy',
    correctWords: [],
    poppedWords: []
};

// ==================== BUBBLES HOME SCREEN ====================
function showBubblesHome() {
    const overlay = document.getElementById('bubblesOverlay');
    overlay.classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';
    renderBubblesHome();
}

function renderBubblesHome() {
    const overlay = document.getElementById('bubblesOverlay');
    const stats = (appState && appState.bubblesStats) || { gamesPlayed: 0, highScore: 0, bestRound: 0, totalScore: 0, totalStars: 0, wordsCollected: [], bestCombo: 0, wins: 0 };

    const totalScore = stats.totalScore || 0;
    const rank = getBubbleRank(totalScore);
    const nextRank = getNextBubbleRank(totalScore);
    const wordsCollected = (stats.wordsCollected || []).length;
    const totalWords = ieltsVocabulary.length;
    const totalStars = stats.totalStars || 0;
    const winRate = stats.gamesPlayed > 0 ? Math.round((stats.wins || 0) / stats.gamesPlayed * 100) : 0;

    // Progress to next rank
    let rankProgressHTML = '';
    if (nextRank) {
        const prevMin = rank.minScore;
        const nextMin = nextRank.minScore;
        const progress = Math.min(100, Math.round((totalScore - prevMin) / (nextMin - prevMin) * 100));
        rankProgressHTML = `
            <div class="bh-rank-progress">
                <div class="bh-rank-bar"><div class="bh-rank-bar-fill" style="width:${progress}%"></div></div>
                <div class="bh-rank-next">${nextRank.emoji} ${nextRank.name} in ${nextMin - totalScore} pts</div>
            </div>
        `;
    }

    // Difficulty high scores
    const easyHS = (stats.difficultyStats && stats.difficultyStats.easy) || {};
    const medHS = (stats.difficultyStats && stats.difficultyStats.medium) || {};
    const hardHS = (stats.difficultyStats && stats.difficultyStats.hard) || {};

    overlay.innerHTML = `
        <div class="bh-container">
            <div class="bh-header">
                <button class="bh-exit-btn" onclick="closeBubbles()">✕</button>
                <div class="bh-title">Word Bubbles</div>
                <div style="width:36px"></div>
            </div>

            <div class="bh-rank-card" style="border-color:${rank.color}40">
                <div class="bh-rank-emoji">${rank.emoji}</div>
                <div class="bh-rank-name" style="color:${rank.color}">${rank.name}</div>
                <div class="bh-rank-score">${totalScore} total points</div>
                ${rankProgressHTML}
            </div>

            <div class="bh-stats-grid">
                <div class="bh-stat"><div class="bh-stat-val">${stats.gamesPlayed || 0}</div><div class="bh-stat-lbl">Games</div></div>
                <div class="bh-stat"><div class="bh-stat-val">${totalStars}</div><div class="bh-stat-lbl">Stars</div></div>
                <div class="bh-stat"><div class="bh-stat-val">${winRate}%</div><div class="bh-stat-lbl">Win Rate</div></div>
                <div class="bh-stat"><div class="bh-stat-val">${stats.bestCombo || 0}</div><div class="bh-stat-lbl">Best Combo</div></div>
            </div>

            <div class="bh-collection">
                <div class="bh-collection-label">Words Collected</div>
                <div class="bh-collection-bar"><div class="bh-collection-fill" style="width:${Math.round(wordsCollected / totalWords * 100)}%"></div></div>
                <div class="bh-collection-count">${wordsCollected} / ${totalWords}</div>
            </div>

            <div class="bh-difficulty-title">Choose Difficulty</div>
            <div class="bh-difficulties">
                <div class="bh-diff-card" onclick="startWordBubbles('easy')">
                    <div class="bh-diff-emoji">${BUBBLE_DIFFICULTIES.easy.emoji}</div>
                    <div class="bh-diff-name">Easy</div>
                    <div class="bh-diff-info">${BUBBLE_DIFFICULTIES.easy.rounds} rounds &middot; 4 bubbles</div>
                    <div class="bh-diff-stars">${renderMiniStars(easyHS.bestStars || 0)} Best: ${easyHS.highScore || 0}</div>
                </div>
                <div class="bh-diff-card" onclick="startWordBubbles('medium')">
                    <div class="bh-diff-emoji">${BUBBLE_DIFFICULTIES.medium.emoji}</div>
                    <div class="bh-diff-name">Medium</div>
                    <div class="bh-diff-info">${BUBBLE_DIFFICULTIES.medium.rounds} rounds &middot; 5 bubbles</div>
                    <div class="bh-diff-stars">${renderMiniStars(medHS.bestStars || 0)} Best: ${medHS.highScore || 0}</div>
                </div>
                <div class="bh-diff-card" onclick="startWordBubbles('hard')">
                    <div class="bh-diff-emoji">${BUBBLE_DIFFICULTIES.hard.emoji}</div>
                    <div class="bh-diff-name">Hard</div>
                    <div class="bh-diff-info">${BUBBLE_DIFFICULTIES.hard.rounds} rounds &middot; 6 bubbles</div>
                    <div class="bh-diff-stars">${renderMiniStars(hardHS.bestStars || 0)} Best: ${hardHS.highScore || 0}</div>
                </div>
            </div>
        </div>
    `;
}

function renderMiniStars(count) {
    return '\u2B50'.repeat(count) + '\u2606'.repeat(3 - count);
}

// ==================== START GAME ====================
function startWordBubbles(difficulty) {
    difficulty = difficulty || 'easy';
    const diff = BUBBLE_DIFFICULTIES[difficulty];

    const pool = getGameWordPool(diff.bubbles * diff.rounds);
    if (pool.length < diff.bubbles) {
        showToast('Learn more words first!');
        return;
    }

    const correctWords = pool.slice(0, diff.rounds);
    const distractorPool = pool.slice();

    bubblesState = {
        pool: distractorPool,
        correctWords: correctWords,
        currentWord: null,
        round: 0,
        totalRounds: diff.rounds,
        score: 0,
        lives: diff.lives,
        maxLives: diff.lives,
        combo: 0,
        bestCombo: 0,
        animationDuration: diff.baseDuration,
        bubbleTimers: [],
        isActive: true,
        difficulty: difficulty,
        numBubbles: diff.bubbles,
        poppedWords: []
    };

    const overlay = document.getElementById('bubblesOverlay');
    overlay.classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';
    renderBubblesUI();
    startBubblesRound();
}

function renderBubblesUI() {
    const overlay = document.getElementById('bubblesOverlay');
    const diff = BUBBLE_DIFFICULTIES[bubblesState.difficulty];

    // Background floating decorations
    const decoEmojis = ['\u2B50', '\uD83C\uDF1F', '\u2728', '\uD83D\uDCAB', '\uD83E\uDEE7', '\uD83C\uDF08', '\uD83C\uDF88', '\uD83E\uDD8B', '\uD83C\uDF38', '\u2601\uFE0F'];
    let decoHTML = '';
    for (let i = 0; i < 8; i++) {
        const emoji = decoEmojis[i % decoEmojis.length];
        const left = 5 + Math.random() * 85;
        const top = 5 + Math.random() * 85;
        const delay = Math.random() * 4;
        const size = 20 + Math.random() * 18;
        decoHTML += `<div class="bubbles-bg-deco" style="left:${left}%;top:${top}%;font-size:${size}px;animation-delay:${delay}s">${emoji}</div>`;
    }

    overlay.innerHTML = `
        <div class="bubbles-container">
            ${decoHTML}
            <div class="bubbles-header">
                <button class="bubbles-exit-btn" onclick="closeBubbles()">✕</button>
                <div class="bubbles-score" id="bubblesScoreWrap">\u2B50 <span id="bubblesScore">${bubblesState.score}</span></div>
                <div class="bubbles-diff-badge">${diff.emoji} ${diff.label}</div>
                <div class="bubbles-lives" id="bubblesLives">
                    ${'\u2764\uFE0F'.repeat(bubblesState.lives)}${'\uD83D\uDDA4'.repeat(bubblesState.maxLives - bubblesState.lives)}
                </div>
                <div class="bubbles-round"><span id="bubblesRound">${bubblesState.round}</span>/${bubblesState.totalRounds}</div>
            </div>

            <div class="bubbles-progress"><div class="bubbles-progress-fill" id="bubblesProgress" style="width:0%"></div></div>

            <div class="bubbles-combo-banner" id="bubblesCombo"></div>

            <div class="bubbles-clue" id="bubblesClue">
                <div class="bubbles-clue-label">Tap the correct English word!</div>
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

    // Speed ramp
    const diff = BUBBLE_DIFFICULTIES[bubblesState.difficulty];
    bubblesState.animationDuration = Math.max(diff.baseDuration * 0.5, diff.baseDuration - Math.floor((bubblesState.round - 1) / 3) * 0.6);

    const correct = bubblesState.correctWords[bubblesState.round - 1];
    bubblesState.currentWord = correct;

    // Pick distractors
    const numDistractors = bubblesState.numBubbles - 1;
    const distractors = shuffleArray(
        bubblesState.pool.filter(w => w.en !== correct.en)
    ).slice(0, numDistractors);
    const options = shuffleArray([correct, ...distractors]);

    // Update UI
    const scoreEl = document.getElementById('bubblesScore');
    const roundEl = document.getElementById('bubblesRound');
    const livesEl = document.getElementById('bubblesLives');
    const emojiEl = document.getElementById('bubblesClueEmoji');
    const clueEl = document.getElementById('bubblesClueWord');

    if (scoreEl) scoreEl.textContent = bubblesState.score;
    if (roundEl) roundEl.textContent = bubblesState.round;
    if (livesEl) livesEl.innerHTML = '\u2764\uFE0F'.repeat(bubblesState.lives) + '\uD83D\uDDA4'.repeat(bubblesState.maxLives - bubblesState.lives);
    if (emojiEl) emojiEl.textContent = correct.emoji;
    if (clueEl) {
        clueEl.textContent = correct.vi;
        clueEl.style.animation = 'none';
        clueEl.offsetHeight;
        clueEl.style.animation = '';
    }

    const progressEl = document.getElementById('bubblesProgress');
    if (progressEl) {
        progressEl.style.width = ((bubblesState.round - 1) / bubblesState.totalRounds * 100) + '%';
    }

    spawnBubbles(options, correct);
}

function spawnBubbles(options, correct) {
    const arena = document.getElementById('bubblesArena');
    if (!arena) return;
    arena.innerHTML = '';

    bubblesState.bubbleTimers.forEach(t => clearTimeout(t));
    bubblesState.bubbleTimers = [];

    // Generate horizontal positions spread evenly
    const count = options.length;
    const positions = shuffleArray(Array.from({length: count}, (_, i) => 8 + (84 / (count - 1 || 1)) * i));

    options.forEach((word, i) => {
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        const isCorrect = word.en === correct.en;
        bubble.dataset.correct = isCorrect ? '1' : '0';
        bubble.style.left = `${positions[i]}%`;
        const riseDur = bubblesState.animationDuration + (Math.random() * 1.5);
        bubble.style.animationDuration = `${riseDur}s, 2.5s`;
        bubble.style.animationDelay = `${i * 0.25}s, ${Math.random() * 0.5}s`;

        bubble.innerHTML = `<span class="bubble-text">${word.en}</span>`;
        bubble.onclick = function() { tapBubble(this, isCorrect, word.en); };

        arena.appendChild(bubble);
    });

    const timeout = setTimeout(() => {
        if (!bubblesState.isActive) return;
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

function tapBubble(el, isCorrect, word) {
    if (!bubblesState.isActive) return;
    if (el.classList.contains('popped')) return;

    el.classList.add('popped');

    if (typeof speakWord === 'function') speakWord(word);

    if (isCorrect) {
        el.classList.add('pop-correct');

        // Track collected word
        if (!bubblesState.poppedWords.includes(word)) {
            bubblesState.poppedWords.push(word);
        }

        bubblesState.combo++;
        if (bubblesState.combo > bubblesState.bestCombo) {
            bubblesState.bestCombo = bubblesState.combo;
        }

        const baseScore = 10 + Math.floor(bubblesState.round * 1.5);
        const multiplier = getComboMultiplier(bubblesState.combo);
        const earned = Math.floor(baseScore * multiplier);
        bubblesState.score += earned;

        showComboBanner(bubblesState.combo, multiplier);

        const arena = document.getElementById('bubblesArena');
        arena.classList.remove('flash-correct');
        arena.offsetHeight;
        arena.classList.add('flash-correct');

        spawnSparkleBurst(el, arena);

        const floater = document.createElement('div');
        floater.className = 'bubble-score-float';
        floater.textContent = multiplier > 1 ? `+${earned} (x${multiplier})` : `+${earned}`;
        if (bubblesState.combo >= 3) floater.classList.add('combo-bonus');
        const rect = el.getBoundingClientRect();
        const arenaRect = arena.getBoundingClientRect();
        floater.style.left = `${rect.left - arenaRect.left + rect.width / 2 - 20}px`;
        floater.style.top = `${rect.top - arenaRect.top}px`;
        arena.appendChild(floater);
        setTimeout(() => floater.remove(), 1000);

        const scoreEl = document.getElementById('bubblesScore');
        if (scoreEl) scoreEl.textContent = bubblesState.score;
        const scoreWrap = document.getElementById('bubblesScoreWrap');
        if (scoreWrap) {
            scoreWrap.classList.remove('bump');
            scoreWrap.offsetHeight;
            scoreWrap.classList.add('bump');
        }

        const progressEl = document.getElementById('bubblesProgress');
        if (progressEl) {
            progressEl.style.width = (bubblesState.round / bubblesState.totalRounds * 100) + '%';
        }

        arena.querySelectorAll('.bubble:not(.popped)').forEach(b => {
            b.classList.add('popped', 'pop-fade');
        });

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
        livesEl.innerHTML = '\u2764\uFE0F'.repeat(Math.max(0, bubblesState.lives)) + '\uD83D\uDDA4'.repeat(bubblesState.maxLives - Math.max(0, bubblesState.lives));
        livesEl.classList.remove('shake');
        livesEl.offsetHeight;
        livesEl.classList.add('shake');
    }
}

// ==================== GAME END ====================
function onBubblesEnd() {
    bubblesState.isActive = false;
    bubblesState.bubbleTimers.forEach(t => clearTimeout(t));
    bubblesState.bubbleTimers = [];

    if (!appState) return;

    // Ensure stats structure
    if (!appState.bubblesStats) {
        appState.bubblesStats = { gamesPlayed: 0, highScore: 0, bestRound: 0, totalScore: 0, totalStars: 0, wordsCollected: [], bestCombo: 0, wins: 0, difficultyStats: {} };
    }
    const s = appState.bubblesStats;
    if (!s.totalScore) s.totalScore = 0;
    if (!s.totalStars) s.totalStars = 0;
    if (!s.wordsCollected) s.wordsCollected = [];
    if (!s.bestCombo) s.bestCombo = 0;
    if (!s.wins) s.wins = 0;
    if (!s.difficultyStats) s.difficultyStats = {};

    s.gamesPlayed++;
    const completedRounds = bubblesState.round - 1;
    const won = bubblesState.lives > 0;
    const stars = getStarRating(won, bubblesState.lives, bubblesState.maxLives);

    if (won) s.wins++;
    if (bubblesState.score > s.highScore) s.highScore = bubblesState.score;
    if (completedRounds > s.bestRound) s.bestRound = completedRounds;
    if (bubblesState.bestCombo > s.bestCombo) s.bestCombo = bubblesState.bestCombo;
    s.totalScore += bubblesState.score;
    s.totalStars += stars;

    // Word collection
    bubblesState.poppedWords.forEach(w => {
        if (!s.wordsCollected.includes(w)) {
            s.wordsCollected.push(w);
        }
    });

    // Per-difficulty stats
    const diff = bubblesState.difficulty;
    if (!s.difficultyStats[diff]) s.difficultyStats[diff] = { highScore: 0, bestStars: 0, gamesPlayed: 0 };
    const ds = s.difficultyStats[diff];
    ds.gamesPlayed++;
    if (bubblesState.score > ds.highScore) ds.highScore = bubblesState.score;
    if (stars > ds.bestStars) ds.bestStars = stars;

    // Award points
    appState.points += bubblesState.score;

    // Achievements
    unlockAchievement('bubbles-first');
    if (s.gamesPlayed >= 10) unlockAchievement('bubbles-10');
    if (won && bubblesState.lives === bubblesState.maxLives) {
        unlockAchievement('bubbles-perfect');
    }

    saveUserData(currentUser, appState);

    // Pet hooks
    if (typeof feedPet === 'function') feedPet(20);
    if (typeof checkQuestCompletion === 'function') checkQuestCompletion('bubbles');
    if (typeof checkAccessoryUnlocks === 'function') checkAccessoryUnlocks(appState);

    // Rank check
    const rank = getBubbleRank(s.totalScore);
    const isNewHigh = bubblesState.score === s.highScore && bubblesState.score > 0;

    if (won || isNewHigh) {
        try { createConfetti(); } catch(e) {}
    }

    // Star display
    const starHTML = Array.from({length: 3}, (_, i) =>
        `<span class="bh-end-star ${i < stars ? 'earned' : ''}" style="animation-delay:${0.2 + i * 0.15}s">${i < stars ? '\u2B50' : '\u2606'}</span>`
    ).join('');

    const winMessages = ['Amazing!', 'Fantastic!', 'Super Star!', 'You Rock!', 'Brilliant!'];
    const loseMessages = ['Nice Try!', 'Almost!', 'Keep Going!'];
    const msg = won ? winMessages[Math.floor(Math.random() * winMessages.length)] : loseMessages[Math.floor(Math.random() * loseMessages.length)];

    // New words collected this game
    const newWords = bubblesState.poppedWords.length;

    const overlay = document.getElementById('bubblesOverlay');
    overlay.innerHTML = `
        <div class="bubbles-container">
            <div class="bubbles-complete">
                <div class="bubbles-complete-icon">${won ? '\uD83C\uDF89' : '\uD83D\uDCAA'}</div>
                <h2>${msg}</h2>
                <div class="bh-end-stars">${starHTML}</div>
                <div class="bubbles-complete-stats">
                    <div class="bubbles-stat-card">
                        <div class="bubbles-stat-value">\u2B50 ${bubblesState.score}</div>
                        <div class="bubbles-stat-label">Score</div>
                    </div>
                    <div class="bubbles-stat-card">
                        <div class="bubbles-stat-value">${completedRounds}/${bubblesState.totalRounds}</div>
                        <div class="bubbles-stat-label">Rounds</div>
                    </div>
                    <div class="bubbles-stat-card">
                        <div class="bubbles-stat-value">${bubblesState.bestCombo > 1 ? '\uD83D\uDD25 ' + bubblesState.bestCombo : bubblesState.lives}</div>
                        <div class="bubbles-stat-label">${bubblesState.bestCombo > 1 ? 'Best Combo' : 'Lives'}</div>
                    </div>
                </div>
                <div class="bh-end-rank">${rank.emoji} ${rank.name}</div>
                ${newWords > 0 ? `<div class="bh-end-collected">\uD83D\uDCDA +${newWords} word${newWords > 1 ? 's' : ''} collected</div>` : ''}
                ${isNewHigh ? '<div class="bubbles-new-record">\uD83C\uDFC6 New High Score!</div>' : ''}
                <div class="bubbles-complete-points">+${bubblesState.score} points</div>
                <button class="bubbles-action-btn" onclick="startWordBubbles('${bubblesState.difficulty}')">\uD83C\uDFAE Play Again</button>
                <button class="bubbles-close-btn" onclick="renderBubblesHome()">Back to Menu</button>
            </div>
        </div>
    `;
}

// ==================== COMBO SYSTEM ====================
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
        <span class="combo-count">\uD83D\uDD25 ${combo}x combo</span>
        ${multiplier > 1 ? `<span class="combo-mult">x${multiplier} score</span>` : ''}
    `;
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

// ==================== SPARKLE EFFECT ====================
function spawnSparkleBurst(bubbleEl, arena) {
    const rect = bubbleEl.getBoundingClientRect();
    const arenaRect = arena.getBoundingClientRect();
    const cx = rect.left - arenaRect.left + rect.width / 2;
    const cy = rect.top - arenaRect.top + rect.height / 2;

    const container = document.createElement('div');
    container.className = 'bubble-sparkle';
    container.style.left = cx + 'px';
    container.style.top = cy + 'px';

    const colors = ['#FF6B9D', '#45B7D1', '#F7DC6F', '#82E0AA', '#BB8FCE', '#FF8A65', '#fff'];
    const stars = ['\u2B50', '\u2728', '\uD83D\uDCAB', '\uD83C\uDF1F'];

    for (let i = 0; i < 10; i++) {
        const p = document.createElement('div');
        p.className = 'bubble-sparkle-particle';
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.5;
        const dist = 40 + Math.random() * 50;
        p.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
        p.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
        p.style.width = (5 + Math.random() * 6) + 'px';
        p.style.height = p.style.width;
        container.appendChild(p);
    }

    for (let i = 0; i < 4; i++) {
        const s = document.createElement('div');
        s.className = 'bubble-sparkle-star';
        s.textContent = stars[i];
        const angle = (Math.PI * 2 * i) / 4 + Math.random() * 0.8;
        const dist = 30 + Math.random() * 40;
        s.style.setProperty('--sx', Math.cos(angle) * dist + 'px');
        s.style.setProperty('--sy', Math.sin(angle) * dist + 'px');
        container.appendChild(s);
    }

    arena.appendChild(container);
    setTimeout(() => container.remove(), 800);
}

// ==================== CLOSE ====================
function closeBubbles() {
    bubblesState.isActive = false;
    bubblesState.bubbleTimers.forEach(t => clearTimeout(t));
    bubblesState.bubbleTimers = [];

    const overlay = document.getElementById('bubblesOverlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
    document.getElementById('bottomNav').style.display = 'flex';
}
