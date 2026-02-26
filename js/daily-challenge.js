// daily-challenge.js - Daily Challenge + Treasure Chest

function getDailyWords() {
    const dateStr = new Date().toDateString();
    const rng = seededRandom('daily-' + dateStr);
    const indices = [];
    while (indices.length < 5) {
        const idx = Math.floor(rng() * ieltsVocabulary.length);
        if (!indices.includes(idx)) indices.push(idx);
    }
    return indices.map(i => ieltsVocabulary[i]);
}

function renderDailyChallenge() {
    const card = document.getElementById('dailyChallengeCard');
    if (!card) return;

    const today = new Date().toDateString();
    const dc = appState.dailyChallenge || { lastDate: null, streak: 0, bestStreak: 0 };
    const completedToday = dc.lastDate === today;

    card.innerHTML = `
        <div class="dc-header">
            <span class="dc-icon">🎁</span>
            <span class="dc-title">Daily Challenge</span>
        </div>
        <div class="dc-streak">🔥 ${dc.streak} day streak (best: ${dc.bestStreak})</div>
        ${completedToday
            ? '<div class="dc-done">✅ Completed today!</div>'
            : '<button class="primary-btn dc-start-btn" onclick="startDailyChallenge()">Open Challenge</button>'}
    `;
}

function startDailyChallenge() {
    const today = new Date().toDateString();
    const dc = appState.dailyChallenge || { lastDate: null, streak: 0, bestStreak: 0 };
    if (dc.lastDate === today) {
        showToast('Already completed today!');
        return;
    }

    const words = getDailyWords();
    lessonState = {
        lessonNumber: -3,
        words: words,
        currentRound: 0,
        totalRounds: 1,
        roundWords: words,
        selectedLeft: null,
        selectedRight: null,
        matchedPairs: 0,
        correctInLesson: 0,
        wrongInLesson: 0,
        lessonPoints: 0,
        _startTime: Date.now(),
        comboChain: 0,
        maxCombo: 0,
        isDailyChallenge: true
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('lessonScreen').classList.add('active');
    document.getElementById('homeScreen').classList.remove('active');
    renderMatchingRound();
}

function completeDailyChallenge() {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (!appState.dailyChallenge) appState.dailyChallenge = { lastDate: null, streak: 0, bestStreak: 0 };

    const dc = appState.dailyChallenge;
    if (dc.lastDate === yesterday) {
        dc.streak++;
    } else if (dc.lastDate !== today) {
        dc.streak = 1;
    }
    dc.lastDate = today;
    if (dc.streak > dc.bestStreak) dc.bestStreak = dc.streak;

    // Bonus points
    const bonusPoints = 50;
    appState.points += bonusPoints;

    // Achievements
    if (dc.streak >= 5) unlockAchievement('daily-5');
    if (dc.streak >= 15) unlockAchievement('daily-15');

    // Init SRS for daily challenge words
    lessonState.words.forEach(w => initWordSRS(w.en));

    saveUserData(currentUser, appState);

    // Show treasure chest
    showTreasureChest(lessonState.lessonPoints + bonusPoints);
}

function showTreasureChest(totalPoints) {
    const overlay = document.getElementById('treasureOverlay');
    if (!overlay) return;

    overlay.innerHTML = `
        <div class="treasure-content">
            <div class="treasure-chest">
                <div class="chest-lid">🎁</div>
                <div class="chest-body">📦</div>
            </div>
            <div class="treasure-coins">
                ${Array(8).fill(0).map(() => `<span class="chest-coin" style="--dx:${(Math.random()-0.5)*200}px;--dy:${-50-Math.random()*100}px">🪙</span>`).join('')}
            </div>
            <div class="treasure-points">+${totalPoints} points!</div>
            <div class="treasure-bonus">🎁 Daily Bonus: +50</div>
            <button class="primary-btn" onclick="closeTreasureChest()">Collect!</button>
        </div>
    `;
    overlay.classList.add('active');
    createConfetti();
}

function closeTreasureChest() {
    document.getElementById('treasureOverlay').classList.remove('active');
    exitLesson();
}
