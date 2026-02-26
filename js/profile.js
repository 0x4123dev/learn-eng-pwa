// profile.js - Profile screen and achievements

function renderProfile() {
    if (!appState) return;

    document.getElementById('profileAvatar').textContent = appState.avatar || '😊';
    document.getElementById('profileName').textContent = appState.username;
    document.getElementById('profilePoints').textContent = appState.points;
    document.getElementById('profileStreak').textContent = appState.streak;
    document.getElementById('profileLessons').textContent = appState.lessonsCompleted;

    const accuracy = appState.totalAnswers > 0
        ? Math.round((appState.totalCorrect / appState.totalAnswers) * 100)
        : 0;
    document.getElementById('profileAccuracy').textContent = `${accuracy}%`;

    let rank = 'Beginner';
    if (appState.points >= 5000) rank = 'Master';
    else if (appState.points >= 2000) rank = 'Advanced';
    else if (appState.points >= 1000) rank = 'Intermediate';
    else if (appState.points >= 500) rank = 'Elementary';
    document.getElementById('profileRank').textContent = rank;

    const grid = document.getElementById('achievementsGrid');
    grid.innerHTML = '';
    achievements.forEach(a => {
        const unlocked = appState.achievements.includes(a.id);
        const div = document.createElement('div');
        div.className = `achievement ${unlocked ? '' : 'locked'}`;
        div.innerHTML = `
            <div class="achievement-icon">${unlocked ? a.icon : '🔒'}</div>
            <div class="achievement-name">${a.name}</div>
        `;
        grid.appendChild(div);
    });
}

function unlockAchievement(id) {
    if (!appState || appState.achievements.includes(id)) return;
    appState.achievements.push(id);
    saveUserData(currentUser, appState);

    const achievement = achievements.find(a => a.id === id);
    if (achievement) {
        showToast(`${achievement.icon} ${achievement.name} unlocked!`);
    }
}
