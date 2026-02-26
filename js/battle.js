// battle.js - Two-Player Battle Mode

let battleState = {
    opponent: null,
    words: [],
    player1: { correct: 0, wrong: 0, time: 0, startTime: 0 },
    player2: { correct: 0, wrong: 0, time: 0, startTime: 0 },
    currentPlayer: 1,
    selectedLeft: null,
    selectedRight: null,
    matchedPairs: 0,
    totalPairs: 0
};

function renderBattleCard() {
    const card = document.getElementById('battleCard');
    if (!card) return;
    const bh = appState.battleHistory || { wins: 0, losses: 0, draws: 0 };
    card.innerHTML = `
        <div class="battle-card-header">
            <span class="battle-card-icon">⚔️</span>
            <span class="battle-card-title">Two-Player Battle</span>
        </div>
        <div class="battle-record">W:${bh.wins} L:${bh.losses} D:${bh.draws}</div>
        <button class="primary-btn battle-start-btn" onclick="openBattleSetup()">Find Opponent</button>
    `;
}

function openBattleSetup() {
    const users = getUsers().filter(u => u !== currentUser);
    const overlay = document.getElementById('battleSetupOverlay');
    if (!overlay) return;

    if (users.length === 0) {
        overlay.innerHTML = `
            <div class="battle-setup-content">
                <h2>⚔️ Battle Mode</h2>
                <p class="battle-no-opponents">No other players found. Create another profile to battle!</p>
                <button class="primary-btn" onclick="closeBattleSetup()">Back</button>
            </div>
        `;
    } else {
        overlay.innerHTML = `
            <div class="battle-setup-content">
                <h2>⚔️ Choose Opponent</h2>
                <div class="battle-user-list">
                    ${users.map(u => {
                        const ud = getUserData(u);
                        return `<div class="battle-user-item" onclick="startBattle('${u.replace(/'/g, "\\'")}')">
                            <span class="battle-user-avatar">${ud ? ud.avatar : '😊'}</span>
                            <span class="battle-user-name">${u}</span>
                            <span class="battle-user-points">⭐${ud ? ud.points : 0}</span>
                        </div>`;
                    }).join('')}
                </div>
                <button class="secondary-btn" onclick="closeBattleSetup()">Cancel</button>
            </div>
        `;
    }
    overlay.classList.add('active');
}

function closeBattleSetup() {
    document.getElementById('battleSetupOverlay').classList.remove('active');
}

function startBattle(opponentUsername) {
    closeBattleSetup();

    // Pick 5 random words
    const indices = [];
    while (indices.length < 5) {
        const idx = Math.floor(Math.random() * ieltsVocabulary.length);
        if (!indices.includes(idx)) indices.push(idx);
    }
    const words = indices.map(i => ieltsVocabulary[i]);

    battleState = {
        opponent: opponentUsername,
        words: words,
        player1: { correct: 0, wrong: 0, time: 0, startTime: 0 },
        player2: { correct: 0, wrong: 0, time: 0, startTime: 0 },
        currentPlayer: 1,
        selectedLeft: null,
        selectedRight: null,
        matchedPairs: 0,
        totalPairs: words.length
    };

    showPlayerReady(1);
}

function showPlayerReady(playerNum) {
    const overlay = document.getElementById('battleGameOverlay');
    if (!overlay) return;

    const name = playerNum === 1 ? appState.username : battleState.opponent;
    overlay.innerHTML = `
        <div class="battle-ready-content">
            <div class="battle-player-num">Player ${playerNum}</div>
            <div class="battle-player-name">${name}</div>
            <button class="primary-btn battle-go-btn" onclick="startPlayerRound(${playerNum})">Ready? GO!</button>
        </div>
    `;
    overlay.classList.add('active');
}

function startPlayerRound(playerNum) {
    battleState.currentPlayer = playerNum;
    battleState.matchedPairs = 0;
    battleState.selectedLeft = null;
    battleState.selectedRight = null;

    const playerData = playerNum === 1 ? battleState.player1 : battleState.player2;
    playerData.startTime = Date.now();
    playerData.correct = 0;
    playerData.wrong = 0;

    renderBattleRound(playerNum);
}

function renderBattleRound(playerNum) {
    const overlay = document.getElementById('battleGameOverlay');
    if (!overlay) return;

    const words = battleState.words;
    const leftItems = shuffleArray([...words]);
    const rightItems = shuffleArray([...words]);
    const name = playerNum === 1 ? appState.username : battleState.opponent;

    overlay.innerHTML = `
        <div class="battle-game-content">
            <div class="battle-game-header">
                <span class="battle-player-tag">Player ${playerNum}: ${name}</span>
                <span class="battle-timer" id="battleTimer">0.0s</span>
            </div>
            <div class="battle-matching-grid">
                <div class="matching-column" id="battleLeftColumn"></div>
                <div class="matching-column" id="battleRightColumn"></div>
            </div>
        </div>
    `;

    const leftCol = document.getElementById('battleLeftColumn');
    const rightCol = document.getElementById('battleRightColumn');

    leftItems.forEach(word => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.dataset.word = word.en;
        card.dataset.side = 'left';
        card.innerHTML = `<span class="card-emoji">${word.emoji || '📝'}</span><span class="card-vi">${word.vi}</span>`;
        card.onclick = () => battleSelectCard(card, 'left', word.en);
        leftCol.appendChild(card);
    });

    rightItems.forEach(word => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.dataset.word = word.en;
        card.dataset.side = 'right';
        card.innerHTML = `<span class="card-en">${word.en}</span><span class="card-ipa">${word.ipa}</span>`;
        card.onclick = () => battleSelectCard(card, 'right', word.en);
        rightCol.appendChild(card);
    });

    // Start timer
    battleState._timerInterval = setInterval(() => {
        const elapsed = ((Date.now() - (playerNum === 1 ? battleState.player1 : battleState.player2).startTime) / 1000).toFixed(1);
        const timerEl = document.getElementById('battleTimer');
        if (timerEl) timerEl.textContent = elapsed + 's';
    }, 100);
}

function battleSelectCard(card, side, word) {
    if (card.classList.contains('matched')) return;

    const container = card.closest('.battle-matching-grid');
    container.querySelectorAll(`.match-card[data-side="${side}"]`).forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');

    if (side === 'left') {
        battleState.selectedLeft = { card, word };
    } else {
        battleState.selectedRight = { card, word };
    }

    if (battleState.selectedLeft && battleState.selectedRight) {
        battleCheckMatch();
    }
}

function battleCheckMatch() {
    const left = battleState.selectedLeft;
    const right = battleState.selectedRight;
    const playerData = battleState.currentPlayer === 1 ? battleState.player1 : battleState.player2;

    if (left.word === right.word) {
        left.card.classList.remove('selected');
        right.card.classList.remove('selected');
        left.card.classList.add('matched');
        right.card.classList.add('matched');
        battleState.matchedPairs++;
        playerData.correct++;

        if (battleState.matchedPairs >= battleState.totalPairs) {
            clearInterval(battleState._timerInterval);
            playerData.time = Date.now() - playerData.startTime;
            setTimeout(() => completePlayerRound(), 500);
        }
    } else {
        left.card.classList.add('wrong');
        right.card.classList.add('wrong');
        playerData.wrong++;
        setTimeout(() => {
            left.card.classList.remove('wrong', 'selected');
            right.card.classList.remove('wrong', 'selected');
        }, 600);
    }

    battleState.selectedLeft = null;
    battleState.selectedRight = null;
}

function completePlayerRound() {
    if (battleState.currentPlayer === 1) {
        showPlayerReady(2);
    } else {
        showBattleResults();
    }
}

function showBattleResults() {
    const overlay = document.getElementById('battleGameOverlay');
    if (!overlay) return;

    const p1 = battleState.player1;
    const p2 = battleState.player2;
    const p1Accuracy = Math.round((p1.correct / (p1.correct + p1.wrong)) * 100);
    const p2Accuracy = Math.round((p2.correct / (p2.correct + p2.wrong)) * 100);

    let winner;
    if (p1Accuracy > p2Accuracy) winner = 1;
    else if (p2Accuracy > p1Accuracy) winner = 2;
    else if (p1.time < p2.time) winner = 1;
    else if (p2.time < p1.time) winner = 2;
    else winner = 0; // draw

    // Update battle history
    if (!appState.battleHistory) appState.battleHistory = { wins: 0, losses: 0, draws: 0 };
    if (winner === 1) appState.battleHistory.wins++;
    else if (winner === 2) appState.battleHistory.losses++;
    else appState.battleHistory.draws++;

    // Award points
    const battlePoints = winner === 1 ? 30 : winner === 0 ? 15 : 10;
    appState.points += battlePoints;

    // Achievements
    const totalBattles = appState.battleHistory.wins + appState.battleHistory.losses + appState.battleHistory.draws;
    if (totalBattles >= 1) unlockAchievement('first-battle');
    if (totalBattles >= 5) unlockAchievement('battle-5');

    saveUserData(currentUser, appState);

    const winnerName = winner === 1 ? appState.username : winner === 2 ? battleState.opponent : 'Tie!';

    overlay.innerHTML = `
        <div class="battle-results-content">
            <h2 class="battle-results-title">${winner === 0 ? "It's a Draw!" : '🏆 Winner!'}</h2>
            ${winner !== 0 ? `<div class="battle-winner-name">${winnerName}</div>` : ''}
            <div class="battle-scores">
                <div class="battle-score-card${winner === 1 ? ' winner' : ''}">
                    <div class="battle-score-name">${appState.username}</div>
                    <div class="battle-score-accuracy">${p1Accuracy}%</div>
                    <div class="battle-score-time">${(p1.time / 1000).toFixed(1)}s</div>
                </div>
                <div class="battle-vs">VS</div>
                <div class="battle-score-card${winner === 2 ? ' winner' : ''}">
                    <div class="battle-score-name">${battleState.opponent}</div>
                    <div class="battle-score-accuracy">${p2Accuracy}%</div>
                    <div class="battle-score-time">${(p2.time / 1000).toFixed(1)}s</div>
                </div>
            </div>
            <div class="battle-reward">+${battlePoints} points</div>
            <button class="primary-btn" onclick="closeBattleResults()">Done</button>
        </div>
    `;

    if (winner === 1) createConfetti();
}

function closeBattleResults() {
    document.getElementById('battleGameOverlay').classList.remove('active');
    renderHome();
}
