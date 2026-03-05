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

    // Render new profile sections
    renderThemePicker();
    renderStickerBook();
    checkStickerUnlocks();
    renderSavedSentences();
}

// ==================== THEME PICKER ====================
function renderThemePicker() {
    const container = document.getElementById('themePicker');
    if (!container) return;
    container.innerHTML = '';
    themeData.forEach(theme => {
        const unlocked = appState.points >= theme.cost;
        const active = appState.theme === theme.id;
        const card = document.createElement('div');
        card.className = `theme-card${active ? ' active' : ''}${!unlocked ? ' locked' : ''}`;
        card.innerHTML = `
            <div class="theme-card-icon">${theme.icon}</div>
            <div class="theme-card-name">${theme.name}</div>
            <div class="theme-card-cost">${theme.cost === 0 ? 'Free' : (!unlocked ? `🔒 ${theme.cost}pts` : '✅')}</div>
        `;
        if (unlocked && !active) {
            card.onclick = () => {
                appState.theme = theme.id;
                applyTheme(theme.id);
                saveUserData(currentUser, appState);
                renderThemePicker();
                showToast(`${theme.icon} ${theme.name} theme applied!`);
            };
        }
        container.appendChild(card);
    });
}

// ==================== STICKER BOOK ====================
const stickerData = [
    { id: 's1', name: 'Star', emoji: '⭐', threshold: 10, rare: false },
    { id: 's2', name: 'Rocket', emoji: '🚀', threshold: 20, rare: false },
    { id: 's3', name: 'Rainbow', emoji: '🌈', threshold: 30, rare: false },
    { id: 's4', name: 'Unicorn', emoji: '🦄', threshold: 40, rare: true },
    { id: 's5', name: 'Trophy', emoji: '🏆', threshold: 50, rare: false },
    { id: 's6', name: 'Diamond', emoji: '💎', threshold: 60, rare: false },
    { id: 's7', name: 'Lightning', emoji: '⚡', threshold: 70, rare: false },
    { id: 's8', name: 'Dragon', emoji: '🐉', threshold: 80, rare: true },
    { id: 's9', name: 'Crown', emoji: '👑', threshold: 90, rare: false },
    { id: 's10', name: 'Crystal', emoji: '🔮', threshold: 100, rare: false },
    { id: 's11', name: 'Phoenix', emoji: '🦅', threshold: 110, rare: false },
    { id: 's12', name: 'Wizard', emoji: '🧙', threshold: 120, rare: true },
    { id: 's13', name: 'Gem', emoji: '💠', threshold: 130, rare: false },
    { id: 's14', name: 'Flame', emoji: '🔥', threshold: 140, rare: false },
    { id: 's15', name: 'Galaxy', emoji: '🌌', threshold: 150, rare: false },
    { id: 's16', name: 'Sparkle', emoji: '✨', threshold: 160, rare: true },
    { id: 's17', name: 'Moon', emoji: '🌙', threshold: 170, rare: false },
    { id: 's18', name: 'Sun', emoji: '☀️', threshold: 180, rare: false },
    { id: 's19', name: 'Comet', emoji: '☄️', threshold: 190, rare: false },
    { id: 's20', name: 'Infinity', emoji: '♾️', threshold: 200, rare: true }
];

function checkStickerUnlocks() {
    if (!appState) return;
    const srsCount = appState.srs ? Object.keys(appState.srs).length : 0;
    if (!appState.stickers) appState.stickers = [];
    let newStickers = false;
    stickerData.forEach(s => {
        if (srsCount >= s.threshold && !appState.stickers.includes(s.id)) {
            appState.stickers.push(s.id);
            showToast(`${s.emoji} New sticker: ${s.name}!`);
            newStickers = true;
        }
    });
    if (newStickers) saveUserData(currentUser, appState);
}

function renderStickerBook() {
    const grid = document.getElementById('stickerGrid');
    const counter = document.getElementById('stickerCounter');
    if (!grid || !counter) return;

    const unlockedCount = (appState.stickers || []).length;
    counter.textContent = `${unlockedCount}/${stickerData.length} collected`;

    grid.innerHTML = '';
    stickerData.forEach(s => {
        const unlocked = (appState.stickers || []).includes(s.id);
        const div = document.createElement('div');
        div.className = `sticker-item${unlocked ? '' : ' locked'}${s.rare && unlocked ? ' rare' : ''}`;
        div.innerHTML = unlocked
            ? `<div class="sticker-emoji">${s.emoji}</div><div class="sticker-name">${s.name}</div>`
            : `<div class="sticker-emoji">?</div><div class="sticker-name">???</div>`;
        grid.appendChild(div);
    });
}

// ==================== SAVED SENTENCES ====================
function renderSavedSentences() {
    const container = document.getElementById('sentencesList');
    if (!container) return;
    const sentences = appState.sentences || [];
    if (sentences.length === 0) {
        container.innerHTML = '<div class="empty-history">Complete lessons with 80%+ accuracy to create sentences!</div>';
        return;
    }
    container.innerHTML = sentences.slice().reverse().map(s => `
        <div class="sentence-card">
            <div class="sentence-card-word">${s.word}</div>
            <div class="sentence-card-text">${s.text}</div>
        </div>
    `).join('');
}

function unlockAchievement(id) {
    if (!appState || appState.achievements.includes(id)) return;
    appState.achievements.push(id);
    saveUserData(currentUser, appState);

    const achievement = achievements.find(a => a.id === id);
    if (achievement) {
        showToast(`${achievement.icon} ${achievement.name} unlocked!`);
    }

    if (typeof checkAccessoryUnlocks === 'function') checkAccessoryUnlocks(appState);
}
