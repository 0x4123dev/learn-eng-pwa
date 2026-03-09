// home.js - Home screen rendering, history, mistakes, and difficulty filtering

const APP_VERSION = 'v2.7.0';

function renderHome() {
    if (!appState) return;

    document.getElementById('homeAvatar').textContent = appState.avatar || '😊';
    document.getElementById('homeUsername').textContent = appState.username;
    document.getElementById('homePoints').textContent = appState.points;
    document.getElementById('homeStreak').textContent = appState.streak;
    document.getElementById('homeLessons').textContent = `${appState.currentLesson || 0}/${TOTAL_LESSONS}`;

    var verEl = document.getElementById('appVersion');
    if (verEl) verEl.textContent = APP_VERSION;

    // Render streak shields
    renderShields();

    // Calculate lessons completed today
    const today = new Date().toDateString();
    const todayLessons = (appState.lessonHistory || []).filter(h => {
        return new Date(h.date).toDateString() === today;
    }).length;
    document.getElementById('homeToday').textContent = todayLessons;

    // Update difficulty tab counts
    updateDifficultyCounts();

    // Get lesson based on filter
    const displayLesson = getNextLessonForDifficulty(selectedDifficultyFilter);
    const lessonStartCard = document.getElementById('lessonStartCard');

    // Check if all lessons in selected difficulty are complete
    const range = getLessonRangeForDifficulty(selectedDifficultyFilter);
    const completedInRange = (appState.lessonHistory || []).filter(h =>
        h.lessonNum >= range.start && h.lessonNum < range.end
    ).length;
    const totalInRange = range.end - range.start;
    const allCompleteInRange = completedInRange >= totalInRange;

    if (allCompleteInRange) {
        // All lessons in this difficulty completed
        const diff = getDifficultyLevel(range.start);
        lessonStartCard.innerHTML = `
            <div class="all-complete-icon">✅</div>
            <div class="all-complete-title">${diff.name} Complete!</div>
            <div class="all-complete-subtitle">All ${totalInRange} lessons done. Practice again?</div>
            <button class="primary-btn start-lesson-btn" onclick="startLesson(${range.start})" style="margin-top: 16px; background: white; color: ${diff.color};">
                🔄 Practice Again
            </button>
        `;
        lessonStartCard.style.background = `linear-gradient(135deg, ${diff.color}, ${diff.color}dd)`;
    } else {
        // Get difficulty level
        const difficulty = getDifficultyLevel(displayLesson);
        const difficultyColors = {
            'Beginning': 'linear-gradient(135deg, #FF8A65, #F4511E)',
            'Basic': 'linear-gradient(135deg, #58cc02, #4CAF50)',
            'Intermediate': 'linear-gradient(135deg, #1cb0f6, #0984e3)',
            'Upper-Intermediate': 'linear-gradient(135deg, #ff9600, #f39c12)',
            'Advanced': 'linear-gradient(135deg, #ce82ff, #9b59b6)'
        };

        lessonStartCard.style.background = difficultyColors[difficulty.name];

        // Show preview of words in this lesson
        const startIdx = displayLesson * WORDS_PER_LESSON;
        const lessonWords = ieltsVocabulary.slice(startIdx, startIdx + WORDS_PER_LESSON);
        const previewWords = lessonWords.map(w => w.en).slice(0, 3).join(', ');

        // Show progress within this difficulty level
        const rangeTotal = range.end - range.start;
        const lessonInRange = displayLesson - range.start + 1;

        lessonStartCard.innerHTML = `
            <div class="lesson-difficulty">
                <span class="difficulty-badge">${difficulty.icon} ${difficulty.name}</span>
                <span class="difficulty-band">${difficulty.band === 'House' ? 'Household' : 'IELTS Band ' + difficulty.band}</span>
            </div>
            <div class="lesson-info">
                <div class="lesson-number">Lesson ${lessonInRange} of ${rangeTotal}</div>
                <div class="lesson-words-preview">${previewWords}...</div>
            </div>
            <button class="primary-btn start-lesson-btn" onclick="startLesson(${displayLesson})">
                🚀 START LESSON
            </button>
        `;
    }

    // Render fun features
    renderWordPet();
    if (typeof renderDailyChallenge === 'function') renderDailyChallenge();

    // Render lesson history
    renderLessonHistory();

    // Update SRS review card
    updateReviewCard();
}

function updateReviewCard() {
    const reviewCard = document.getElementById('reviewCard');
    if (!appState || !appState.srs || Object.keys(appState.srs).length === 0) {
        reviewCard.style.display = 'none';
        return;
    }
    reviewCard.style.display = 'block';

    const dueCount = getReviewCount();
    const mastery = getSRSMasteryPercent();

    document.getElementById('reviewProgressFill').style.width = `${mastery}%`;
    document.getElementById('reviewProgressLabel').textContent = `${mastery}% mastered`;

    if (dueCount === 0) {
        reviewCard.classList.add('all-caught-up');
        document.getElementById('reviewTitle').textContent = 'All caught up!';
        document.getElementById('reviewSubtitle').textContent = 'No words due for review right now';
        document.getElementById('reviewStartBtn').style.display = 'none';
    } else {
        reviewCard.classList.remove('all-caught-up');
        document.getElementById('reviewTitle').textContent = `${dueCount} word${dueCount !== 1 ? 's' : ''} due today`;
        document.getElementById('reviewSubtitle').textContent = 'Keep your memory strong!';
        const btn = document.getElementById('reviewStartBtn');
        btn.style.display = 'block';
        btn.textContent = 'REVIEW';
    }
}

// currentHistoryTab declared in app.js

function switchHistoryTab(tab) {
    currentHistoryTab = tab;
    document.querySelectorAll('.history-tab').forEach(t => t.classList.remove('active'));
    event.target.closest('.history-tab').classList.add('active');

    const historyContainer = document.getElementById('lessonHistory');
    const mistakesContainer = document.getElementById('mistakesContainer');

    if (tab === 'history') {
        historyContainer.style.display = 'flex';
        mistakesContainer.classList.remove('show');
    } else {
        historyContainer.style.display = 'none';
        mistakesContainer.classList.add('show');
        renderMistakes();
    }
}

const HISTORY_PAGE_SIZE = 10;

function renderLessonHistory() {
    const historyContainer = document.getElementById('lessonHistory');
    let history = appState.lessonHistory || [];

    // Filter by selected difficulty
    const range = getLessonRangeForDifficulty(selectedDifficultyFilter);
    history = history.filter(h => h.lessonNum >= range.start && h.lessonNum < range.end);

    // Update tab counts
    document.getElementById('historyCount').textContent = history.length;
    const mistakes = appState.mistakes || [];
    document.getElementById('mistakesCount').textContent = mistakes.length;

    if (history.length === 0) {
        historyPage = 0;
        const filterName = selectedDifficultyFilter.charAt(0).toUpperCase() + selectedDifficultyFilter.slice(1);
        historyContainer.innerHTML = `<div class="empty-history">No ${filterName} lessons completed yet</div>`;
        return;
    }

    // Most recent first
    const sorted = history.slice().reverse();
    const totalPages = Math.ceil(sorted.length / HISTORY_PAGE_SIZE);

    // Clamp page
    if (historyPage >= totalPages) historyPage = totalPages - 1;
    if (historyPage < 0) historyPage = 0;

    const start = historyPage * HISTORY_PAGE_SIZE;
    const pageItems = sorted.slice(start, start + HISTORY_PAGE_SIZE);

    let html = '<div class="history-table">';
    pageItems.forEach((item, index) => {
        const startIdx = item.lessonNum * WORDS_PER_LESSON;
        const lessonWords = ieltsVocabulary.slice(startIdx, startIdx + WORDS_PER_LESSON);
        const wordTags = lessonWords.map(w => `<span class="history-word-tag" onclick="event.stopPropagation(); speakWord('${w.en.replace(/'/g, "\\'")}')">${w.en} 🔊</span>`).join('');
        const isPerfect = item.accuracy === 100;

        html += `
        <div class="history-row" onclick="toggleHistoryDetail(${index})">
            <div class="history-lesson-num">${item.lessonNum + 1}</div>
            <div class="history-info">
                <div class="history-title">Lesson ${item.lessonNum + 1}</div>
                <div class="history-date">${formatDate(item.date)}</div>
            </div>
            <div class="history-stats">
                <div class="history-points">+${item.points}</div>
                <div class="history-accuracy${isPerfect ? ' perfect' : ''}">${item.accuracy}%</div>
            </div>
            <div class="history-expand-icon">▼</div>
        </div>
        <div class="history-detail" id="historyDetail${index}">
            <div class="history-words-label">Words in this lesson:</div>
            <div class="history-words-list">${wordTags}</div>
            <button class="relearn-btn" onclick="event.stopPropagation(); relearnLesson(${item.lessonNum})">
                📖 Learn Again
            </button>
        </div>
        `;
    });
    html += '</div>';

    // Pagination controls
    if (totalPages > 1) {
        html += `
        <div class="history-pagination">
            <button class="history-page-btn" onclick="changeHistoryPage(-1)" ${historyPage === 0 ? 'disabled' : ''}>← Prev</button>
            <span class="history-page-info">${historyPage + 1} / ${totalPages}</span>
            <button class="history-page-btn" onclick="changeHistoryPage(1)" ${historyPage >= totalPages - 1 ? 'disabled' : ''}>Next →</button>
        </div>`;
    }

    historyContainer.innerHTML = html;
}

function changeHistoryPage(delta) {
    historyPage += delta;
    renderLessonHistory();
}

function toggleHistoryDetail(index) {
    const detail = document.getElementById(`historyDetail${index}`);
    const row = detail.previousElementSibling;

    if (detail.classList.contains('show')) {
        detail.classList.remove('show');
        row.classList.remove('expanded');
    } else {
        // Close all other details
        document.querySelectorAll('.history-detail.show').forEach(d => {
            d.classList.remove('show');
            d.previousElementSibling.classList.remove('expanded');
        });
        detail.classList.add('show');
        row.classList.add('expanded');
    }
}

function renderMistakes() {
    const container = document.getElementById('mistakesContainer');
    const mistakes = appState.mistakes || [];

    if (mistakes.length === 0) {
        container.innerHTML = '<div class="empty-history">Great job! No mistakes to review 🎉</div>';
        return;
    }

    // Sort by count (most mistakes first)
    const sortedMistakes = [...mistakes].sort((a, b) => b.count - a.count);

    let html = sortedMistakes.map(m => {
        const word = ieltsVocabulary.find(w => w.en === m.word);
        if (!word) return '';
        return `
        <div class="mistake-word-card" onclick="speakWord('${word.en.replace(/'/g, "\\'")}')">
            <div class="mistake-word-header">
                <span class="mistake-word-en">${word.emoji || ''} ${word.en} <span class="speak-icon">🔊</span></span>
                <span class="mistake-count">${m.count}x wrong</span>
            </div>
            <div class="mistake-word-vi">${word.vi}</div>
            <div class="mistake-word-ipa">${word.ipa}</div>
        </div>
        `;
    }).join('');

    if (sortedMistakes.length >= 5) {
        html += `<button class="practice-mistakes-btn" onclick="practiceMistakes()">🔄 Practice These Words</button>`;
    }
    html += `<button class="clear-mistakes-btn" onclick="clearMistakes()">Clear All Mistakes</button>`;

    container.innerHTML = html;
}

function practiceMistakes() {
    const mistakes = appState.mistakes || [];
    if (mistakes.length < 5) {
        showToast('Need at least 5 mistakes to practice');
        return;
    }

    // Get words for practice (max 5)
    const practiceWords = mistakes.slice(0, 5).map(m => {
        return ieltsVocabulary.find(w => w.en === m.word);
    }).filter(w => w);

    if (practiceWords.length < 5) {
        showToast('Not enough valid words to practice');
        return;
    }

    // Start a special practice session
    lessonState = {
        lessonNumber: -1, // Special marker for practice session
        words: practiceWords,
        currentRound: 0,
        totalRounds: 1,
        roundWords: practiceWords,
        selectedLeft: null,
        selectedRight: null,
        matchedPairs: 0,
        correctInLesson: 0,
        wrongInLesson: 0,
        lessonPoints: 0,
        isPracticeSession: true,
        comboChain: 0,
        maxCombo: 0
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('lessonScreen').classList.add('active');
    document.getElementById('homeScreen').classList.remove('active');

    preloadLessonAudio(practiceWords);
    renderMatchingRound();
}

function clearMistakes() {
    if (confirm('Clear all mistakes from review list?')) {
        appState.mistakes = [];
        saveUserData(currentUser, appState);
        renderMistakes();
        document.getElementById('mistakesCount').textContent = '0';
        showToast('Mistakes cleared!');
    }
}

function relearnLesson(lessonNum) {
    startLesson(lessonNum);
}

// Beginning level has a fixed number of lessons (112 house words)
const BEGINNING_LESSONS = Math.ceil(112 / WORDS_PER_LESSON); // 23 lessons
const IELTS_LESSONS = TOTAL_LESSONS - BEGINNING_LESSONS; // remaining IELTS lessons
const IELTS_PER_LEVEL = Math.ceil(IELTS_LESSONS / 4); // split IELTS into 4 levels

function getDifficultyLevel(lessonNum) {
    if (lessonNum < BEGINNING_LESSONS) {
        return { name: 'Beginning', key: 'beginning', icon: '🏠', band: 'House', color: '#FF7043' };
    } else if (lessonNum < BEGINNING_LESSONS + IELTS_PER_LEVEL) {
        return { name: 'Basic', key: 'basic', icon: '🌱', band: '5-6', color: '#58cc02' };
    } else if (lessonNum < BEGINNING_LESSONS + IELTS_PER_LEVEL * 2) {
        return { name: 'Intermediate', key: 'intermediate', icon: '🌿', band: '6-7', color: '#1cb0f6' };
    } else if (lessonNum < BEGINNING_LESSONS + IELTS_PER_LEVEL * 3) {
        return { name: 'Upper-Intermediate', key: 'upper', icon: '🌳', band: '7-8', color: '#ff9600' };
    } else {
        return { name: 'Advanced', key: 'advanced', icon: '⭐', band: '8-9', color: '#ce82ff' };
    }
}

function getLessonRangeForDifficulty(difficultyKey) {
    switch (difficultyKey) {
        case 'beginning': return { start: 0, end: BEGINNING_LESSONS };
        case 'basic': return { start: BEGINNING_LESSONS, end: BEGINNING_LESSONS + IELTS_PER_LEVEL };
        case 'intermediate': return { start: BEGINNING_LESSONS + IELTS_PER_LEVEL, end: BEGINNING_LESSONS + IELTS_PER_LEVEL * 2 };
        case 'upper': return { start: BEGINNING_LESSONS + IELTS_PER_LEVEL * 2, end: BEGINNING_LESSONS + IELTS_PER_LEVEL * 3 };
        case 'advanced': return { start: BEGINNING_LESSONS + IELTS_PER_LEVEL * 3, end: TOTAL_LESSONS };
        default: return { start: 0, end: TOTAL_LESSONS };
    }
}

function getNextLessonForDifficulty(difficultyKey) {
    const range = getLessonRangeForDifficulty(difficultyKey);

    // Find the first incomplete lesson in this range
    for (let i = range.start; i < range.end; i++) {
        const completed = appState.lessonHistory?.some(h => h.lessonNum === i);
        if (!completed) {
            return i;
        }
    }

    // All lessons in this range completed, return first lesson of range
    return range.start;
}

function filterByDifficulty(level) {
    selectedDifficultyFilter = level;
    historyPage = 0;

    // Update tab active states
    document.querySelectorAll('.difficulty-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.difficulty-tab[data-level="${level}"]`).classList.add('active');

    // Re-render home with filtered content
    renderHome();
}

function updateDifficultyCounts() {
    const beginEl = document.getElementById('countBeginning');
    if (beginEl) beginEl.textContent = BEGINNING_LESSONS;
    document.getElementById('countBasic').textContent = IELTS_PER_LEVEL;
    document.getElementById('countIntermediate').textContent = IELTS_PER_LEVEL;
    document.getElementById('countUpper').textContent = IELTS_PER_LEVEL;
    document.getElementById('countAdvanced').textContent = TOTAL_LESSONS - BEGINNING_LESSONS - (IELTS_PER_LEVEL * 3);
}

function startNextLesson() {
    const lessonToStart = getNextLessonForDifficulty(selectedDifficultyFilter);
    startLesson(lessonToStart);
}

// ==================== STREAK SHIELDS ====================
function renderShields() {
    const container = document.getElementById('homeShields');
    if (!container) return;
    const count = appState.streakShields || 0;
    if (count > 0) {
        container.innerHTML = '🛡️'.repeat(count);
        container.classList.add('has-shields');
    } else {
        container.innerHTML = '';
        container.classList.remove('has-shields');
    }
}

// ==================== WORD PET ====================

const PET_HABITATS = {
    egg:     { decorations: ['🌿','🌿','🌱'] },
    chick:   { decorations: ['🌸','🌿','🌼','🌸'] },
    bird:    { decorations: ['🌳','🍃','🌿'] },
    phoenix: { decorations: ['🌋','🔥','✨'] },
    dragon:  { decorations: ['🏔️','☁️','⛰️'] }
};

const HUNGER_DECAY_SCHEDULE = [
    { hoursWithout: 96, level: 0  },
    { hoursWithout: 72, level: 25 },
    { hoursWithout: 48, level: 50 },
    { hoursWithout: 24, level: 75 },
    { hoursWithout:  0, level: 100 }
];

const PET_PHRASES = {
    happy: [
        "I feel so smart today! 🌟",
        "You're amazing! Teach me more!",
        "Let's learn another word! 🎉",
        "I love studying with you! ❤️",
        "We're unstoppable! 💪"
    ],
    neutral: [
        "I missed you… will you study today? 🥺",
        "My tummy is rumbling…",
        "One lesson? Please? 🥺",
        "Come on, just one round! 🌱",
        "I'm waiting for you! ⏳"
    ],
    sleepy: [
        "Zzz… I'm so hungry… 💤",
        "Where have you been? I've been waiting…",
        "Please come back! I need you! 💤",
        "I'm fading away… study with me? 😢",
        "I miss learning new words… 😴"
    ],
    starving: [
        "I'm so weak… please feed me! 😢",
        "I can barely keep my eyes open… 💀",
        "A lesson would save me right now…",
        "Don't let me fade away! 😭",
        "I need words to survive! 🆘"
    ],
    hungry: [
        "My stomach is growling… 🥺",
        "Just one little lesson? Please?",
        "I could really use some brain food…",
        "Feed me knowledge! 📚",
        "A quick review would be delicious! 🍽️"
    ]
};

const PET_ACCESSORIES = [
    { id: 'hat',      emoji: '🎩', label: 'Top Hat',      cssClass: 'hat',
      condition: s => (s.streak || 0) >= 5 },
    { id: 'glasses',  emoji: '🕶️', label: 'Sunglasses',   cssClass: 'glasses',
      condition: s => (s.lessonsCompleted || 0) >= 10 },
    { id: 'bow',      emoji: '🎀', label: 'Bow',           cssClass: 'bow',
      condition: s => (s.lessonsCompleted || 0) >= 25 },
    { id: 'crown',    emoji: '⭐', label: 'Star Crown',    cssClass: 'crown',
      condition: s => (s.streak || 0) >= 7 },
    { id: 'scarf',    emoji: '🧣', label: 'Scarf',         cssClass: 'scarf',
      condition: s => (s.lessonsCompleted || 0) >= 50 },
    { id: 'rainbow',  emoji: '🌈', label: 'Rainbow Aura',  cssClass: 'rainbow',
      condition: s => (s.lessonsCompleted || 0) >= 100 },
    { id: 'flame',    emoji: '🔥', label: 'Flame Halo',    cssClass: 'flame',
      condition: s => (s.streak || 0) >= 30 },
    { id: 'diamond',  emoji: '💎', label: 'Diamond',       cssClass: 'diamond',
      condition: s => (s.points || 0) >= 5000 }
];

const PET_QUESTS = [
    { id: 'lesson',    text: 'Complete 1 lesson today',          pts: 20, hunger: 30,
      eligible: () => true },
    { id: 'perfect',   text: 'Get 100% accuracy in a lesson',   pts: 30, hunger: 40,
      eligible: () => true },
    { id: 'srs',       text: 'Complete an SRS review session',   pts: 20, hunger: 30,
      eligible: s => s.srs && Object.keys(s.srs).length >= 3 },
    { id: 'wotd',      text: 'Open the Word of the Day',        pts: 10, hunger: 20,
      eligible: () => true },
    { id: 'bubbles',   text: 'Play Word Bubbles',               pts: 20, hunger: 30,
      eligible: () => true },
    { id: 'challenge', text: 'Complete the Daily Challenge',     pts: 25, hunger: 35,
      eligible: () => true },
    { id: 'streak3',   text: 'Study 3 days in a row',           pts: 40, hunger: 50,
      eligible: () => true },
    { id: 'rhythm',   text: 'Play a music game',              pts: 20, hunger: 30,
      eligible: () => true }
];

let _accTrayOpen = false;

function getPetStage(points) {
    if (points >= 5000) return { emoji: '🐉', name: 'Dragon',  key: 'dragon'  };
    if (points >= 2000) return { emoji: '🦅', name: 'Phoenix', key: 'phoenix' };
    if (points >= 500)  return { emoji: '🐦', name: 'Bird',    key: 'bird'    };
    if (points >= 100)  return { emoji: '🐣', name: 'Chick',   key: 'chick'   };
    return                     { emoji: '🥚', name: 'Egg',     key: 'egg'     };
}

function computeCurrentHunger(state) {
    if (!state.petLastFed) return 50;
    const hoursSince = (Date.now() - state.petLastFed) / 3600000;
    for (const step of HUNGER_DECAY_SCHEDULE) {
        if (hoursSince >= step.hoursWithout) return step.level;
    }
    return 100;
}

function feedPet(amount) {
    if (!appState) return;
    appState.petHunger = Math.min(100, (appState.petHunger || 0) + amount);
    appState.petLastFed = Date.now();
    saveUserData(currentUser, appState);
}

function getPetMood() {
    const hunger = computeCurrentHunger(appState);
    if (hunger === 0)  return 'starving';
    if (hunger <= 25)  return 'hungry';
    const today     = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (appState.lastStudyDate === today)      return 'happy';
    if (appState.lastStudyDate === yesterday)  return 'neutral';
    return 'sleepy';
}

function getTimeOfDayClass() {
    const h = new Date().getHours();
    if (h >= 5  && h < 12) return 'time-morning';
    if (h >= 12 && h < 18) return 'time-afternoon';
    if (h >= 18 && h < 22) return 'time-evening';
    return 'time-night';
}

function renderWordPet() {
    const container = document.getElementById('petContainer');
    const scene     = document.getElementById('petScene');
    const bg        = document.getElementById('petBg');
    if (!container || !scene) return;

    const pet  = getPetStage(appState.points);
    const mood = getPetMood();

    // Habitat
    scene.dataset.stage = pet.key;
    scene.className = 'pet-scene ' + getTimeOfDayClass();
    if (bg) {
        const habitat = PET_HABITATS[pet.key];
        bg.innerHTML = habitat.decorations.map(e => `<span>${e}</span>`).join('');
    }

    // Naming prompt (first time)
    if (!appState.petName) {
        container.innerHTML = `
            <div class="pet-creature ${mood}">${pet.emoji}</div>
            <div class="pet-name-form">
                <div style="font-size:12px;font-weight:700;color:var(--text-secondary)">Name your pet!</div>
                <input class="pet-name-input" id="petNameInput" type="text"
                       maxlength="12" placeholder="Enter a name…"
                       onkeydown="if(event.key==='Enter')savePetName()">
                <button class="pet-name-btn" onclick="savePetName()">Name it! 🐾</button>
            </div>
        `;
        return;
    }

    // Hunger hearts
    const hunger = computeCurrentHunger(appState);
    const filledHearts = Math.round(hunger / 20);
    const heartsHTML = '❤️'.repeat(filledHearts) + '🖤'.repeat(5 - filledHearts);

    // Active accessories
    const active = appState.activeAccessories || [];
    const accSpans = active.map(id => {
        const acc = PET_ACCESSORIES.find(a => a.id === id);
        if (!acc) return '';
        return `<span class="pet-accessory ${acc.cssClass}">${acc.emoji}</span>`;
    }).join('');

    // Accessories tray toggle
    const owned = appState.petAccessories || [];
    const trayToggleHTML = owned.length > 0
        ? `<button class="pet-acc-toggle" onclick="toggleAccTray()">👗 ${owned.length} <span style="font-size:10px">${_accTrayOpen ? '▲' : '▼'}</span></button>`
        : '';
    const trayHTML = _accTrayOpen ? renderAccTray() : '';

    // Daily quest
    const today = new Date().toDateString();
    if (!appState.petQuest || appState.petQuest.lastDate !== today) {
        const quest = getDailyQuest(appState);
        if (!appState.petQuest) appState.petQuest = { lastDate: null, questId: null, completed: false };
        appState.petQuest.lastDate = today;
        appState.petQuest.questId  = quest.id;
        appState.petQuest.completed = false;
    }
    const questData = PET_QUESTS.find(q => q.id === appState.petQuest.questId) || PET_QUESTS[0];
    const questDone = appState.petQuest.completed;
    const questHTML = `<div class="pet-quest ${questDone ? 'completed' : ''}">${questDone ? '✅' : '🐾'} ${questData.text}</div>`;

    container.innerHTML = `
        <div class="pet-wrapper">
            <div class="pet-creature ${mood}" onclick="onPetTap()">${pet.emoji}</div>
            ${accSpans}
        </div>
        <div class="pet-name">${appState.petName} <span style="font-weight:400;opacity:0.7">· ${pet.name}</span></div>
        <div class="pet-hunger">${heartsHTML}</div>
        ${trayToggleHTML}
        ${trayHTML}
        ${questHTML}
    `;

    // Auto-show starving bubble
    if (hunger === 0) {
        setTimeout(() => showPetSpeechBubble("Please feed me! 😢"), 500);
    }
}

function savePetName() {
    const input = document.getElementById('petNameInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    appState.petName = name;
    saveUserData(currentUser, appState);
    // Check for retroactive accessories now that pet is named
    checkAccessoryUnlocks(appState);
    renderWordPet();
}

function renderAccTray() {
    const owned  = appState.petAccessories  || [];
    const active = appState.activeAccessories || [];
    const slots  = owned.map(id => {
        const acc   = PET_ACCESSORIES.find(a => a.id === id);
        if (!acc) return '';
        const equipped = active.includes(id);
        return `<span class="acc-slot ${equipped ? 'equipped' : ''}"
                      onclick="toggleAccessory('${id}')"
                      title="${acc.label}">${acc.emoji}</span>`;
    }).join('');
    return `<div class="pet-acc-tray">${slots}</div>`;
}

function toggleAccTray() {
    _accTrayOpen = !_accTrayOpen;
    renderWordPet();
}

function toggleAccessory(id) {
    const active = appState.activeAccessories || [];
    if (active.includes(id)) {
        appState.activeAccessories = active.filter(a => a !== id);
    } else if (active.length < 3) {
        appState.activeAccessories.push(id);
    } else {
        showToast('Only 3 accessories at once!');
        return;
    }
    saveUserData(currentUser, appState);
    renderWordPet();
}

function checkAccessoryUnlocks(state) {
    if (!state || !state.petName) return;
    if (!state.petAccessories) state.petAccessories = [];
    if (!state.activeAccessories) state.activeAccessories = [];
    const owned = state.petAccessories;
    PET_ACCESSORIES.forEach(acc => {
        if (!owned.includes(acc.id) && acc.condition(state)) {
            state.petAccessories.push(acc.id);
            if (state.activeAccessories.length < 3) {
                state.activeAccessories.push(acc.id);
            }
            saveUserData(currentUser, state);
            showToast(`${acc.emoji} New accessory: ${acc.label}!`);
        }
    });
}

function getDailyQuest(state) {
    const dateStr = new Date().toDateString();
    const eligible = PET_QUESTS.filter(q => q.eligible(state));
    if (eligible.length === 0) return PET_QUESTS[0];
    const rng   = seededRandom('pet-quest-' + dateStr);
    const index = Math.floor(rng() * eligible.length);
    return eligible[index] || PET_QUESTS[0];
}

function checkQuestCompletion(triggerQuestId, extraContext) {
    if (!appState || !appState.petName) return;
    const today = new Date().toDateString();
    if (!appState.petQuest) appState.petQuest = { lastDate: null, questId: null, completed: false };
    const q = appState.petQuest;

    if (q.lastDate !== today) {
        const quest = getDailyQuest(appState);
        q.lastDate  = today;
        q.questId   = quest.id;
        q.completed = false;
    }
    if (q.completed) return;

    const quest = PET_QUESTS.find(p => p.id === q.questId);
    if (!quest) return;

    if (quest.id === 'streak3' && triggerQuestId === 'lesson' && (appState.streak || 0) >= 3) {
        _completeQuest(quest);
        return;
    }
    if (quest.id === 'perfect' && triggerQuestId === 'lesson' && extraContext && extraContext.accuracy === 100) {
        _completeQuest(quest);
        return;
    }
    if (quest.id === triggerQuestId) {
        _completeQuest(quest);
    }
}

function _completeQuest(quest) {
    appState.petQuest.completed = true;
    appState.points += quest.pts;
    feedPet(quest.hunger);
    saveUserData(currentUser, appState);
    showToast(`🐾 Quest complete! +${quest.pts} pts, pet fed!`);
    const creature = document.querySelector('.pet-creature');
    if (creature) {
        creature.classList.add('wiggle');
        setTimeout(() => creature.classList.remove('wiggle'), 600);
    }
    renderWordPet();
}

function showEvolutionCelebration(stage) {
    const overlay = document.getElementById('evolutionOverlay');
    if (!overlay) return;

    const confettiEmojis = ['🎉','🌟','⭐','✨','🎊','💫'];
    const confettiHTML = Array.from({length: 20}, () => {
        const emoji = confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)];
        const left  = Math.random() * 100;
        const delay = Math.random() * 1.5;
        const dur   = 2 + Math.random() * 1.5;
        return `<span class="evolution-confetti" style="left:${left}%;top:0;animation-duration:${dur}s;animation-delay:${delay}s">${emoji}</span>`;
    }).join('');

    overlay.innerHTML = `
        ${confettiHTML}
        <div class="evolution-pet-emoji">${stage.emoji}</div>
        <div class="evolution-title">Your pet evolved into a ${stage.name}! ${stage.emoji}</div>
        <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:12px">Tap to continue</div>
    `;
    overlay.style.display = 'flex';
    overlay.onclick = () => { overlay.style.display = 'none'; };

    if (typeof speakWord === 'function') speakWord(stage.name);
}

const PET_PHRASES_EXTENDED = PET_PHRASES;

function onPetTap() {
    const creature = document.querySelector('.pet-creature');
    if (!creature) return;
    creature.classList.add('wiggle');
    setTimeout(() => creature.classList.remove('wiggle'), 600);

    const mood = getPetMood();
    const srsWords = appState.srs ? Object.keys(appState.srs) : [];

    // Milestone proximity phrase (within 50 pts of next stage)
    const thresholds = [100, 500, 2000, 5000];
    const nextThreshold = thresholds.find(t => t > appState.points);
    if (nextThreshold && (nextThreshold - appState.points) <= 50) {
        showPetSpeechBubble("I feel something changing inside me! 🌟");
        return;
    }

    // Streak celebration (7+ days)
    if (appState.streak >= 7 && mood === 'happy' && Math.random() < 0.3) {
        showPetSpeechBubble(`${appState.streak} days together! I love you! 🎉`);
        return;
    }

    // Word recall — 20% of taps
    if (srsWords.length > 0 && Math.random() < 0.2) {
        const word = srsWords[Math.floor(Math.random() * srsWords.length)];
        const wordData = ieltsVocabulary.find(w => w.en === word);
        if (wordData) {
            showPetSpeechBubble(`${wordData.emoji} Remember "${wordData.en}"?`);
            speakWord(wordData.en);
            return;
        }
    }

    // Mood-based phrase
    const phrases = PET_PHRASES[mood] || PET_PHRASES.neutral;
    showPetSpeechBubble(phrases[Math.floor(Math.random() * phrases.length)]);
}

function showPetSpeechBubble(text) {
    const existing = document.querySelector('.pet-bubble');
    if (existing) existing.remove();
    const bubble = document.createElement('div');
    bubble.className = 'pet-bubble';
    bubble.textContent = text;
    document.getElementById('petContainer').appendChild(bubble);
    setTimeout(() => bubble.remove(), 2500);
}

// ==================== WORD OF THE DAY ====================
function seededRandom(seed) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
    }
    return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        return ((h ^= h >>> 16) >>> 0) / 4294967296;
    };
}

function getDailyWord() {
    const dateStr = new Date().toDateString();
    const rng = seededRandom(dateStr);
    const index = Math.floor(rng() * ieltsVocabulary.length);
    return ieltsVocabulary[index];
}

function renderWordOfDay() {
    const card = document.getElementById('wotdCard');
    if (!card) return;
    const word = getDailyWord();
    const today = new Date().toDateString();
    const viewed = appState.wordOfDayViewed === today;
    card.innerHTML = `
        <div class="wotd-label">Word of the Day ${viewed ? '✅' : ''}</div>
        <div class="wotd-emoji">${word.emoji}</div>
        <div class="wotd-word">${word.en}</div>
    `;
    card.onclick = () => openWordOfDayStory(word);
}

function openWordOfDayStory(word) {
    const overlay = document.getElementById('wotdOverlay');
    if (!overlay) return;
    let panelIndex = 0;
    const panels = [
        `<div class="wotd-panel-emoji">${word.emoji}</div>
         <div class="wotd-panel-word">${word.en}</div>
         <div class="wotd-panel-ipa">${word.ipa}</div>
         <button class="wotd-speak-btn" onclick="event.stopPropagation(); speakWord('${word.en.replace(/'/g, "\\'")}')">🔊 Listen</button>`,
        `<div class="wotd-panel-vi">${word.vi}</div>
         <div class="wotd-panel-example">"${word.ex || ''}"</div>`,
        `<div class="wotd-panel-prompt">Use it today!</div>
         <div class="wotd-panel-challenge">Try saying:<br><strong>"${word.ex || word.en}"</strong></div>`
    ];

    function renderPanel() {
        overlay.innerHTML = `
            <div class="wotd-panel">${panels[panelIndex]}</div>
            <div class="wotd-dots">${panels.map((_, i) =>
                `<span class="wotd-dot${i === panelIndex ? ' active' : ''}"></span>`
            ).join('')}</div>
            <div class="wotd-tap-hint">Tap to continue</div>
        `;
    }

    overlay.onclick = (e) => {
        // Don't advance panel when tapping the Listen button
        if (e.target.closest('.wotd-speak-btn')) return;
        panelIndex++;
        if (panelIndex >= panels.length) {
            overlay.classList.remove('active');
            appState.wordOfDayViewed = new Date().toDateString();
            saveUserData(currentUser, appState);
            if (typeof checkQuestCompletion === 'function') checkQuestCompletion('wotd');
            renderWordOfDay();
        } else {
            renderPanel();
        }
    };

    renderPanel();
    overlay.classList.add('active');
    speakWord(word.en);
}
