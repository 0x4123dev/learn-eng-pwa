// hangman.js - Hangman word guessing game

let hangmanState = {
    word: null,       // vocabulary entry {en, vi, emoji, ...}
    guessed: [],      // letters guessed
    wrongCount: 0,
    maxWrong: 6,
    won: false,
    lost: false,
    currentStreak: 0
};

function startHangman() {
    const pool = getGameWordPool(20);
    // Pick a word with at least 3 letters
    const candidates = pool.filter(w => w.en.length >= 3);
    const word = candidates[Math.floor(Math.random() * candidates.length)];

    hangmanState = {
        word: word,
        guessed: [],
        wrongCount: 0,
        maxWrong: 6,
        won: false,
        lost: false,
        currentStreak: (appState && appState.hangmanStats) ? (appState.hangmanStats._currentStreak || 0) : 0
    };

    const overlay = document.getElementById('hangmanOverlay');
    overlay.classList.add('active');
    document.getElementById('bottomNav').style.display = 'none';
    renderHangmanUI();
}

function renderHangmanUI() {
    const overlay = document.getElementById('hangmanOverlay');
    const word = hangmanState.word;
    const letters = word.en.toUpperCase().split('');
    const wrongCount = hangmanState.wrongCount;

    // Word blanks
    const blanks = letters.map(l => {
        if (l === '-' || l === ' ') return `<span class="hangman-blank hangman-space">${l}</span>`;
        const revealed = hangmanState.guessed.includes(l) || hangmanState.won || hangmanState.lost;
        return `<span class="hangman-blank ${revealed ? 'revealed' : ''} ${hangmanState.lost && !hangmanState.guessed.includes(l) ? 'missed' : ''}">${revealed ? l : '_'}</span>`;
    }).join('');

    // Keyboard
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const keys = alphabet.split('').map(l => {
        const used = hangmanState.guessed.includes(l);
        const isCorrect = used && letters.includes(l);
        const isWrong = used && !letters.includes(l);
        const disabled = used || hangmanState.won || hangmanState.lost;
        return `<button class="hangman-key ${isCorrect ? 'correct' : ''} ${isWrong ? 'wrong' : ''}" ${disabled ? 'disabled' : ''} onclick="guessLetter('${l}')">${l}</button>`;
    }).join('');

    // Stats bar
    const stats = (appState && appState.hangmanStats) || { gamesPlayed: 0, wins: 0, bestStreak: 0 };

    let resultHTML = '';
    if (hangmanState.won) {
        const bonus = Math.max(0, hangmanState.maxWrong - hangmanState.wrongCount) * 10;
        const points = 50 + bonus;
        resultHTML = `
            <div class="hangman-result hangman-win">
                <div class="hangman-result-icon">🎉</div>
                <div class="hangman-result-title">You got it!</div>
                <div class="hangman-result-word">${word.emoji} ${word.en} — ${word.vi}</div>
                <div class="hangman-result-points">+${points} points</div>
                <button class="hangman-action-btn" onclick="startHangman()">Play Again</button>
                <button class="hangman-close-btn" onclick="closeHangman()">Back to Games</button>
            </div>`;
    } else if (hangmanState.lost) {
        resultHTML = `
            <div class="hangman-result hangman-lose">
                <div class="hangman-result-icon">😔</div>
                <div class="hangman-result-title">Oh no!</div>
                <div class="hangman-result-word">${word.emoji} ${word.en} — ${word.vi}</div>
                <div class="hangman-result-hint">"${word.ex}"</div>
                <button class="hangman-action-btn" onclick="startHangman()">Try Again</button>
                <button class="hangman-close-btn" onclick="closeHangman()">Back to Games</button>
            </div>`;
    }

    overlay.innerHTML = `
        <div class="hangman-container">
            <div class="hangman-header">
                <button class="hangman-exit-btn" onclick="closeHangman()">✕</button>
                <div class="hangman-title">🎯 Hangman</div>
                <div class="hangman-streak-badge">🔥 ${hangmanState.currentStreak}</div>
            </div>

            <div class="hangman-clue">
                <span class="hangman-clue-emoji">${word.emoji}</span>
                <span class="hangman-clue-text">${word.vi}</span>
            </div>

            <div class="hangman-svg-area">
                ${renderHangmanSVG(wrongCount)}
            </div>

            <div class="hangman-mistakes">
                ${'❤️'.repeat(hangmanState.maxWrong - wrongCount)}${'🖤'.repeat(wrongCount)}
            </div>

            <div class="hangman-blanks">${blanks}</div>

            ${resultHTML || `<div class="hangman-keyboard">${keys}</div>`}
        </div>
    `;
}

function renderHangmanSVG(wrongCount) {
    // Progressive drawing: gallows always shown, body parts added per wrong guess
    const parts = [
        // 1: head
        `<circle cx="150" cy="65" r="18" fill="none" stroke="white" stroke-width="3"/>`,
        // 2: body
        `<line x1="150" y1="83" x2="150" y2="130" stroke="white" stroke-width="3"/>`,
        // 3: left arm
        `<line x1="150" y1="95" x2="125" y2="115" stroke="white" stroke-width="3"/>`,
        // 4: right arm
        `<line x1="150" y1="95" x2="175" y2="115" stroke="white" stroke-width="3"/>`,
        // 5: left leg
        `<line x1="150" y1="130" x2="125" y2="160" stroke="white" stroke-width="3"/>`,
        // 6: right leg
        `<line x1="150" y1="130" x2="175" y2="160" stroke="white" stroke-width="3"/>`
    ];

    const drawnParts = parts.slice(0, wrongCount).join('');

    return `
        <svg viewBox="0 0 300 180" class="hangman-svg">
            <!-- Gallows -->
            <line x1="60" y1="170" x2="240" y2="170" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
            <line x1="100" y1="170" x2="100" y2="20" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
            <line x1="100" y1="20" x2="150" y2="20" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
            <line x1="150" y1="20" x2="150" y2="47" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>
            <!-- Body parts -->
            ${drawnParts}
        </svg>
    `;
}

function guessLetter(letter) {
    if (hangmanState.won || hangmanState.lost) return;
    if (hangmanState.guessed.includes(letter)) return;

    hangmanState.guessed.push(letter);

    const wordLetters = hangmanState.word.en.toUpperCase().split('').filter(l => l !== '-' && l !== ' ');

    if (!wordLetters.includes(letter)) {
        hangmanState.wrongCount++;
        if (hangmanState.wrongCount >= hangmanState.maxWrong) {
            hangmanState.lost = true;
            hangmanState.currentStreak = 0;
            onHangmanEnd(false);
        }
    } else {
        // Check win: all unique letters guessed
        const unique = [...new Set(wordLetters)];
        const allGuessed = unique.every(l => hangmanState.guessed.includes(l));
        if (allGuessed) {
            hangmanState.won = true;
            hangmanState.currentStreak++;
            onHangmanEnd(true);
        }
    }

    renderHangmanUI();
}

function onHangmanEnd(won) {
    if (!appState) return;

    if (!appState.hangmanStats) {
        appState.hangmanStats = { gamesPlayed: 0, wins: 0, bestStreak: 0, _currentStreak: 0 };
    }

    appState.hangmanStats.gamesPlayed++;

    if (won) {
        appState.hangmanStats.wins++;
        appState.hangmanStats._currentStreak = hangmanState.currentStreak;
        if (hangmanState.currentStreak > appState.hangmanStats.bestStreak) {
            appState.hangmanStats.bestStreak = hangmanState.currentStreak;
        }

        // Award points
        const bonus = Math.max(0, hangmanState.maxWrong - hangmanState.wrongCount) * 10;
        const points = 50 + bonus;
        appState.points += points;

        // Achievements
        unlockAchievement('hangman-first');
        if (appState.hangmanStats.wins >= 10) unlockAchievement('hangman-10');
        if (hangmanState.currentStreak >= 5) unlockAchievement('hangman-streak');
    } else {
        appState.hangmanStats._currentStreak = 0;
    }

    saveUserData(currentUser, appState);
}

function closeHangman() {
    const overlay = document.getElementById('hangmanOverlay');
    overlay.classList.remove('active');
    overlay.innerHTML = '';
    document.getElementById('bottomNav').style.display = 'flex';
    renderGamesLobby();
}
