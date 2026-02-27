// games.js - Games lobby and shared utilities

// ==================== SHARED WORD POOL ====================
function getGameWordPool(min) {
    min = min || 20;
    // Gather words the user has learned via SRS
    const learned = [];
    if (appState && appState.srs) {
        Object.keys(appState.srs).forEach(word => {
            const entry = ieltsVocabulary.find(v => v.en === word);
            if (entry) learned.push(entry);
        });
    }
    if (learned.length >= min) return shuffleArray(learned);
    // Fallback: use first N words from vocabulary
    return shuffleArray(ieltsVocabulary.slice(0, Math.max(min, 50)));
}

// ==================== GAMES LOBBY ====================
function renderGamesLobby() {
    const container = document.getElementById('gamesLobby');
    if (!container) return;

    const speedStats = appState ? {
        games: (appState.lessonHistory || []).length,
        best: appState.points || 0
    } : { games: 0, best: 0 };

    const hangmanStats = (appState && appState.hangmanStats) || { gamesPlayed: 0, wins: 0, bestStreak: 0 };
    const bubblesStats = (appState && appState.bubblesStats) || { gamesPlayed: 0, highScore: 0, bestRound: 0 };

    container.innerHTML = `
        <div class="game-card" onclick="switchScreen('speedChallengeScreen')">
            <div class="game-card-icon">📝</div>
            <div class="game-card-info">
                <div class="game-card-title">Irregular Verbs</div>
                <div class="game-card-desc">Practice V1, V2, V3 verb forms</div>
                <div class="game-card-stat">${hangmanStats.gamesPlayed > 0 || bubblesStats.gamesPlayed > 0 ? 'Keep practicing!' : 'Speed challenge'}</div>
            </div>
            <div class="game-card-arrow">›</div>
        </div>

        <div class="game-card" onclick="startHangman()">
            <div class="game-card-icon">🎯</div>
            <div class="game-card-info">
                <div class="game-card-title">Hangman</div>
                <div class="game-card-desc">Guess the word letter by letter</div>
                <div class="game-card-stat">${hangmanStats.gamesPlayed > 0 ? `${hangmanStats.wins} wins · best streak ${hangmanStats.bestStreak}` : 'New!'}</div>
            </div>
            <div class="game-card-arrow">›</div>
        </div>

        <div class="game-card" onclick="startWordBubbles()">
            <div class="game-card-icon">🫧</div>
            <div class="game-card-info">
                <div class="game-card-title">Word Bubbles</div>
                <div class="game-card-desc">Pop the correct bubble before it floats away</div>
                <div class="game-card-stat">${bubblesStats.gamesPlayed > 0 ? `High score ${bubblesStats.highScore} · best round ${bubblesStats.bestRound}` : 'New!'}</div>
            </div>
            <div class="game-card-arrow">›</div>
        </div>
    `;
}
