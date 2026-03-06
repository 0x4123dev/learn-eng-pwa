// rhythm-tap.js - Rhythm Tap syllable clapping game

const TAP_NOTE_FREQS = [523, 587, 659, 698, 784]; // C5-G5 pentatonic

let rhythmTapState = {
    pool: [],
    correctWords: [],
    currentWord: null,
    expectedSyllables: 0,
    tappedSyllables: 0,
    round: 0,
    totalRounds: 10,
    score: 0,
    lives: 3,
    combo: 0,
    bestCombo: 0,
    currentBpm: 80,
    roundPhase: 'waiting',
    isActive: false,
    wordsResults: [],
    roundTimeout: null
};

function getRhythmWordPool() {
    let learned = [];
    if (appState && appState.srs) {
        Object.keys(appState.srs).forEach(function(word) {
            const entry = ieltsVocabulary.find(function(v) { return v.en === word; });
            if (entry && entry.ipa) learned.push(entry);
        });
    }
    if (learned.length >= 20) return shuffleArray(learned);
    return shuffleArray(ieltsVocabulary.filter(w => w.ipa).slice(0, 50));
}

function startRhythmTap() {
    const pool = getRhythmWordPool();
    if (pool.length < 5) {
        showToast('Learn more words first!');
        return;
    }

    const correctWords = pool.slice(0, 10);

    rhythmTapState = {
        pool: pool,
        correctWords: correctWords,
        currentWord: null,
        expectedSyllables: 0,
        tappedSyllables: 0,
        round: 0,
        totalRounds: 10,
        score: 0,
        lives: 3,
        combo: 0,
        bestCombo: 0,
        currentBpm: 80,
        roundPhase: 'waiting',
        isActive: true,
        wordsResults: [],
        roundTimeout: null
    };

    MusicEngine.getContext();

    const overlay = document.getElementById('rhythmTapOverlay');
    overlay.classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';

    renderRhythmTapUI();
    startRhythmTapRound();
}

function renderRhythmTapUI() {
    const overlay = document.getElementById('rhythmTapOverlay');
    overlay.innerHTML = `
        <div class="rt-container">
            <div class="rt-header">
                <button class="rt-exit-btn" onclick="closeRhythmTap()">✕</button>
                <div class="rt-score">⭐ <span id="rtScore">0</span></div>
                <div class="rt-lives" id="rtLives">${'❤️'.repeat(3)}</div>
                <div class="rt-round"><span id="rtRound">0</span>/10</div>
            </div>

            <div class="rt-combo-banner" id="rtComboBanner"></div>

            <div class="rt-word-display" id="rtWordDisplay">
                <div class="rt-word-emoji" id="rtWordEmoji"></div>
                <div class="rt-word-text" id="rtWordText">Get Ready!</div>
                <div class="rt-word-ipa" id="rtWordIpa"></div>
                <div class="rt-dots" id="rtDots"></div>
            </div>

            <div class="rt-count-in" id="rtCountIn" style="display:none"></div>

            <div class="rt-tap-zone" id="rtTapZone">
                <div class="rt-instruction" id="rtInstruction">Tap once per syllable!</div>
                <div class="rt-bpm" id="rtBpm">80 BPM</div>
            </div>
        </div>
    `;
}

function startRhythmTapRound() {
    if (!rhythmTapState.isActive) return;

    rhythmTapState.round++;

    if (rhythmTapState.round > rhythmTapState.totalRounds || rhythmTapState.lives <= 0) {
        onRhythmTapEnd();
        return;
    }

    const word = rhythmTapState.correctWords[rhythmTapState.round - 1];
    rhythmTapState.currentWord = word;
    rhythmTapState.expectedSyllables = MusicEngine.getSyllableCount(word);
    rhythmTapState.tappedSyllables = 0;
    rhythmTapState.roundPhase = 'counting-in';

    // BPM ramp: +5 every 2 rounds, cap 120
    rhythmTapState.currentBpm = Math.min(120, 80 + Math.floor((rhythmTapState.round - 1) / 2) * 5);

    // Update UI
    const scoreEl = document.getElementById('rtScore');
    const roundEl = document.getElementById('rtRound');
    const livesEl = document.getElementById('rtLives');
    if (scoreEl) scoreEl.textContent = rhythmTapState.score;
    if (roundEl) roundEl.textContent = rhythmTapState.round;
    if (livesEl) livesEl.innerHTML = '❤️'.repeat(rhythmTapState.lives) + '🖤'.repeat(3 - rhythmTapState.lives);

    // Word display
    const emojiEl = document.getElementById('rtWordEmoji');
    const wordEl = document.getElementById('rtWordText');
    const ipaEl = document.getElementById('rtWordIpa');
    const bpmEl = document.getElementById('rtBpm');
    if (emojiEl) emojiEl.textContent = word.emoji || '';
    if (wordEl) wordEl.textContent = word.en;
    if (ipaEl) ipaEl.textContent = word.ipa || '';
    if (bpmEl) bpmEl.textContent = rhythmTapState.currentBpm + ' BPM';

    // Syllable dots
    const dotsEl = document.getElementById('rtDots');
    if (dotsEl) {
        dotsEl.innerHTML = Array.from({length: rhythmTapState.expectedSyllables}, () =>
            '<span class="rt-dot"></span>'
        ).join('');
    }

    // Clear instruction
    const instrEl = document.getElementById('rtInstruction');
    if (instrEl) instrEl.textContent = `Tap ${rhythmTapState.expectedSyllables} time${rhythmTapState.expectedSyllables > 1 ? 's' : ''}!`;

    // Speak the word
    if (typeof speakWord === 'function') speakWord(word.en);

    // Count-in
    const countInEl = document.getElementById('rtCountIn');
    if (countInEl) {
        countInEl.style.display = 'flex';
        countInEl.textContent = '4';
    }

    const ctx = MusicEngine.getContext();
    const interval = 60000 / rhythmTapState.currentBpm;
    let beat = 0;

    function countInTick() {
        if (beat >= 4) {
            if (countInEl) countInEl.style.display = 'none';
            beginTappingPhase();
            return;
        }
        MusicEngine.playKick(ctx, ctx.currentTime);
        if (countInEl) {
            countInEl.textContent = 4 - beat;
            countInEl.style.animation = 'none';
            countInEl.offsetHeight;
            countInEl.style.animation = 'countPulse 0.3s ease';
        }
        beat++;
        setTimeout(countInTick, interval);
    }
    countInTick();
}

function beginTappingPhase() {
    rhythmTapState.roundPhase = 'tapping';

    MusicEngine.startBeat(rhythmTapState.currentBpm, ['kick', 'hihat', 'kick', 'hihat'], function(i) {
        const tapZone = document.getElementById('rtTapZone');
        if (tapZone) {
            tapZone.classList.add('pulse');
            setTimeout(() => tapZone.classList.remove('pulse'), 80);
        }
    });

    // Attach tap listener
    const tapZone = document.getElementById('rtTapZone');
    if (tapZone) {
        tapZone.ontouchstart = function(e) { e.preventDefault(); onRhythmTapTap(e); };
        tapZone.onmousedown = function(e) { onRhythmTapTap(e); };
    }

    // Timeout: if not done in time
    const maxTime = (rhythmTapState.expectedSyllables + 3) * (60000 / rhythmTapState.currentBpm);
    rhythmTapState.roundTimeout = setTimeout(() => {
        if (rhythmTapState.roundPhase === 'tapping') {
            onRhythmTapRoundFail('timeout');
        }
    }, maxTime);
}

function onRhythmTapTap(event) {
    if (rhythmTapState.roundPhase !== 'tapping') return;

    rhythmTapState.tappedSyllables++;

    // Light up dot
    const dots = document.querySelectorAll('.rt-dot');
    const dotIdx = rhythmTapState.tappedSyllables - 1;
    if (dots[dotIdx]) dots[dotIdx].classList.add('active');

    // Play note
    const ctx = MusicEngine.getContext();
    MusicEngine.playNote(ctx, TAP_NOTE_FREQS[dotIdx % TAP_NOTE_FREQS.length], 0.12);

    // Ripple effect
    const tapZone = document.getElementById('rtTapZone');
    if (tapZone) {
        const ripple = document.createElement('div');
        ripple.className = 'rt-ripple';
        const rect = tapZone.getBoundingClientRect();
        const x = (event.touches ? event.touches[0].clientX : event.clientX) - rect.left;
        const y = (event.touches ? event.touches[0].clientY : event.clientY) - rect.top;
        ripple.style.left = x + 'px';
        ripple.style.top = y + 'px';
        tapZone.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
    }

    // Check if done
    if (rhythmTapState.tappedSyllables >= rhythmTapState.expectedSyllables) {
        onRhythmTapRoundComplete();
    }
}

function onRhythmTapRoundComplete() {
    MusicEngine.stopBeat();
    if (rhythmTapState.roundTimeout) clearTimeout(rhythmTapState.roundTimeout);
    rhythmTapState.roundPhase = 'feedback';

    // Score
    const base = 10 + Math.floor(rhythmTapState.round * 1.5);
    const comboBonus = rhythmTapState.combo * 5;
    const earned = base + comboBonus;
    rhythmTapState.score += earned;
    rhythmTapState.combo++;
    if (rhythmTapState.combo > rhythmTapState.bestCombo) {
        rhythmTapState.bestCombo = rhythmTapState.combo;
    }

    rhythmTapState.wordsResults.push({
        word: rhythmTapState.currentWord,
        expected: rhythmTapState.expectedSyllables,
        tapped: rhythmTapState.tappedSyllables,
        correct: true
    });

    // Feedback
    const ctx = MusicEngine.getContext();
    MusicEngine.playSuccess(ctx);

    const wordEl = document.getElementById('rtWordDisplay');
    if (wordEl) wordEl.classList.add('rt-correct');
    setTimeout(() => { if (wordEl) wordEl.classList.remove('rt-correct'); }, 800);

    const scoreEl = document.getElementById('rtScore');
    if (scoreEl) scoreEl.textContent = rhythmTapState.score;

    const instrEl = document.getElementById('rtInstruction');
    if (instrEl) instrEl.textContent = `+${earned} pts! ${rhythmTapState.expectedSyllables} syllables`;

    // Combo banner
    if (rhythmTapState.combo >= 2) {
        const banner = document.getElementById('rtComboBanner');
        if (banner) {
            const labels = { 2: 'Nice!', 3: 'TRIPLE!', 5: 'Amazing!', 8: 'ON FIRE!' };
            let label = 'x' + rhythmTapState.combo;
            for (const [threshold, text] of Object.entries(labels).reverse()) {
                if (rhythmTapState.combo >= Number(threshold)) { label = text; break; }
            }
            banner.className = 'rt-combo-banner active';
            banner.innerHTML = `<span>${label}</span> <span>🔥 ${rhythmTapState.combo}x</span>`;
        }
    }

    setTimeout(() => {
        if (rhythmTapState.isActive) startRhythmTapRound();
    }, 1200);
}

function onRhythmTapRoundFail(reason) {
    MusicEngine.stopBeat();
    if (rhythmTapState.roundTimeout) clearTimeout(rhythmTapState.roundTimeout);
    rhythmTapState.roundPhase = 'feedback';
    rhythmTapState.combo = 0;
    rhythmTapState.lives--;

    rhythmTapState.wordsResults.push({
        word: rhythmTapState.currentWord,
        expected: rhythmTapState.expectedSyllables,
        tapped: rhythmTapState.tappedSyllables,
        correct: false
    });

    const ctx = MusicEngine.getContext();
    MusicEngine.playFail(ctx);

    const livesEl = document.getElementById('rtLives');
    if (livesEl) {
        livesEl.innerHTML = '❤️'.repeat(Math.max(0, rhythmTapState.lives)) + '🖤'.repeat(3 - Math.max(0, rhythmTapState.lives));
        livesEl.classList.remove('shake');
        livesEl.offsetHeight;
        livesEl.classList.add('shake');
    }

    const wordEl = document.getElementById('rtWordDisplay');
    if (wordEl) wordEl.classList.add('rt-wrong');
    setTimeout(() => { if (wordEl) wordEl.classList.remove('rt-wrong'); }, 800);

    const instrEl = document.getElementById('rtInstruction');
    if (instrEl) instrEl.textContent = `${rhythmTapState.expectedSyllables} syllables needed!`;

    // Hide combo banner
    const banner = document.getElementById('rtComboBanner');
    if (banner) { banner.className = 'rt-combo-banner'; banner.innerHTML = ''; }

    setTimeout(() => {
        if (!rhythmTapState.isActive) return;
        if (rhythmTapState.lives <= 0) {
            onRhythmTapEnd();
        } else {
            startRhythmTapRound();
        }
    }, 1500);
}

function onRhythmTapEnd() {
    rhythmTapState.isActive = false;
    MusicEngine.stopBeat();
    MusicEngine.suspend();

    if (!appState) return;

    // Save stats
    if (!appState.musicStats) {
        appState.musicStats = { rhythmTap: { gamesPlayed: 0, highScore: 0, bestCombo: 0, correctRounds: 0 }, wordChant: { gamesPlayed: 0, correctQuizAnswers: 0 } };
    }
    const rt = appState.musicStats.rhythmTap;
    rt.gamesPlayed++;
    if (rhythmTapState.score > rt.highScore) rt.highScore = rhythmTapState.score;
    if (rhythmTapState.bestCombo > rt.bestCombo) rt.bestCombo = rhythmTapState.bestCombo;
    const correctCount = rhythmTapState.wordsResults.filter(r => r.correct).length;
    rt.correctRounds = (rt.correctRounds || 0) + correctCount;

    appState.points += rhythmTapState.score;
    saveUserData(currentUser, appState);

    // Achievements
    if (rt.gamesPlayed === 1) unlockAchievement('rhythm-first');
    if (rt.gamesPlayed >= 10) unlockAchievement('rhythm-10');
    if (rhythmTapState.lives === 3 && rhythmTapState.round > rhythmTapState.totalRounds) unlockAchievement('rhythm-perfect');
    if (rt.correctRounds >= 50) unlockAchievement('syllable-sage');

    // Pet hooks
    if (typeof feedPet === 'function') feedPet(30);
    if (typeof checkQuestCompletion === 'function') checkQuestCompletion('rhythm');
    if (typeof checkAccessoryUnlocks === 'function') checkAccessoryUnlocks(appState);

    // Render end screen
    const overlay = document.getElementById('rhythmTapOverlay');
    const won = rhythmTapState.lives > 0;

    const wordListHTML = rhythmTapState.wordsResults.map(r => `
        <div class="rt-word-result-item">
            <span>${r.word.emoji || ''} ${r.word.en}</span>
            <span>${r.expected} syl</span>
            <span>${r.correct ? '✅' : '❌'}</span>
        </div>
    `).join('');

    overlay.innerHTML = `
        <div class="rt-container">
            <div class="rt-end-screen">
                <div class="rt-end-icon">${won ? '🎉' : '😔'}</div>
                <h2>${won ? 'Great Rhythm!' : 'Game Over'}</h2>
                <div class="rt-end-stats">
                    <div class="rt-end-stat">
                        <div class="rt-end-stat-value">${rhythmTapState.score}</div>
                        <div class="rt-end-stat-label">Score</div>
                    </div>
                    <div class="rt-end-stat">
                        <div class="rt-end-stat-value">${correctCount}/${rhythmTapState.totalRounds}</div>
                        <div class="rt-end-stat-label">Correct</div>
                    </div>
                    <div class="rt-end-stat">
                        <div class="rt-end-stat-value">${rhythmTapState.bestCombo > 1 ? '🔥' + rhythmTapState.bestCombo : rhythmTapState.lives}</div>
                        <div class="rt-end-stat-label">${rhythmTapState.bestCombo > 1 ? 'Best Combo' : 'Lives'}</div>
                    </div>
                </div>
                <div class="rt-word-result-list">${wordListHTML}</div>
                <div class="rt-end-points">+${rhythmTapState.score} points</div>
                <button class="rt-action-btn" onclick="startRhythmTap()">Play Again</button>
                <button class="rt-close-btn" onclick="closeRhythmTap()">Close</button>
            </div>
        </div>
    `;
}

function closeRhythmTap() {
    rhythmTapState.isActive = false;
    MusicEngine.stopBeat();
    MusicEngine.suspend();

    const overlay = document.getElementById('rhythmTapOverlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
    document.getElementById('bottomNav').style.display = 'flex';
    if (typeof renderHome === 'function') renderHome();
}

// Music menu overlay
function showMusicMenu() {
    const overlay = document.getElementById('musicMenuOverlay');
    overlay.classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';
    renderMusicMenu();
}

function renderMusicMenu() {
    const overlay = document.getElementById('musicMenuOverlay');
    const rtStats = (appState && appState.musicStats && appState.musicStats.rhythmTap) || {};
    const wcStats = (appState && appState.musicStats && appState.musicStats.wordChant) || {};

    overlay.innerHTML = `
        <div class="mm-container">
            <div class="mm-header">
                <button class="mm-exit-btn" onclick="closeMusicMenu()">✕</button>
                <div class="mm-title">🎵 Music Games</div>
                <div style="width:36px"></div>
            </div>

            <div class="mm-games">
                <div class="mm-game-card">
                    <div class="mm-game-icon">🥁</div>
                    <div class="mm-game-name">Rhythm Tap</div>
                    <div class="mm-game-desc">Clap the syllables to the beat!</div>
                    <div class="mm-how-to-play">
                        <div class="mm-how-title">How to Play</div>
                        <div class="mm-step"><span class="mm-step-num">1</span> A word appears on screen</div>
                        <div class="mm-step"><span class="mm-step-num">2</span> Listen to the beat count-in (4 beats)</div>
                        <div class="mm-step"><span class="mm-step-num">3</span> Tap the screen once per syllable</div>
                        <div class="mm-step"><span class="mm-step-num">4</span> Match the syllable count to score points</div>
                        <div class="mm-tip">💡 Build combos by getting consecutive words correct!</div>
                    </div>
                    <div class="mm-game-stats">
                        <span>🎮 ${rtStats.gamesPlayed || 0} played</span>
                        <span>⭐ ${rtStats.highScore || 0} best</span>
                        <span>🔥 ${rtStats.bestCombo || 0} combo</span>
                    </div>
                    <button class="mm-play-btn" onclick="closeMusicMenu(); startRhythmTap();">▶ Play Rhythm Tap</button>
                </div>

                <div class="mm-game-card">
                    <div class="mm-game-icon">🎤</div>
                    <div class="mm-game-name">Word Chant</div>
                    <div class="mm-game-desc">Learn words through rap & rhyme!</div>
                    <div class="mm-how-to-play">
                        <div class="mm-how-title">How to Play</div>
                        <div class="mm-step"><span class="mm-step-num">1</span> Listen to the beat and chant lines</div>
                        <div class="mm-step"><span class="mm-step-num">2</span> Words are spoken in fun rap patterns</div>
                        <div class="mm-step"><span class="mm-step-num">3</span> Pay attention to the meanings!</div>
                        <div class="mm-step"><span class="mm-step-num">4</span> Answer the quiz at the end</div>
                        <div class="mm-tip">💡 Also available after finishing a lesson!</div>
                    </div>
                    <div class="mm-game-stats">
                        <span>🎮 ${wcStats.gamesPlayed || 0} played</span>
                        <span>✅ ${wcStats.correctQuizAnswers || 0} correct</span>
                    </div>
                    <button class="mm-play-btn" onclick="closeMusicMenu(); startWordChant();">▶ Play Word Chant</button>
                </div>
            </div>
        </div>
    `;
}

function closeMusicMenu() {
    const overlay = document.getElementById('musicMenuOverlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
    document.getElementById('bottomNav').style.display = 'flex';
}

// Home screen card
function renderMusicGamesCard() {
    const container = document.getElementById('musicGamesCard');
    if (!container) return;
    const rtGames = (appState.musicStats && appState.musicStats.rhythmTap && appState.musicStats.rhythmTap.gamesPlayed) || 0;
    const wcGames = (appState.musicStats && appState.musicStats.wordChant && appState.musicStats.wordChant.gamesPlayed) || 0;
    container.style.display = 'block';
    container.innerHTML = `
        <div class="music-card-title">🎵 Music Games</div>
        <div class="music-card-games">
            <div class="music-game-btn" onclick="startRhythmTap()">
                <div class="music-game-icon">🥁</div>
                <div class="music-game-name">Rhythm Tap</div>
                <div class="music-game-stat">${rtGames} played</div>
            </div>
            <div class="music-game-btn" onclick="startWordChant()">
                <div class="music-game-icon">🎤</div>
                <div class="music-game-name">Word Chant</div>
                <div class="music-game-stat">${wcGames} played</div>
            </div>
        </div>
    `;
}
