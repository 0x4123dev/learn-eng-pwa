// home.js - Home screen rendering, history, mistakes, and difficulty filtering

const APP_VERSION = 'v3.6.1';

function renderHome() {
    if (!appState) return;

    const avatarEl = document.getElementById('homeAvatar');
    if (avatarEl) avatarEl.textContent = appState.avatar || '😊';
    const usernameEl = document.getElementById('homeUsername');
    if (usernameEl) usernameEl.textContent = appState.username;
    const pointsEl = document.getElementById('homePoints');
    if (pointsEl) pointsEl.textContent = appState.points;
    const streakEl = document.getElementById('homeStreak');
    if (streakEl) streakEl.textContent = appState.streak;
    const lessonsEl = document.getElementById('homeLessons');
    if (lessonsEl) lessonsEl.textContent = `${appState.currentLesson || 0}/${TOTAL_LESSONS}`;

    var verEl = document.getElementById('appVersion');
    if (verEl) verEl.textContent = APP_VERSION;

    // Render streak shields
    renderShields();

    // Calculate lessons completed today
    const today = new Date().toDateString();
    const todayLessons = (appState.lessonHistory || []).filter(h => {
        return new Date(h.date).toDateString() === today;
    }).length;
    const todayEl = document.getElementById('homeToday');
    if (todayEl) todayEl.textContent = todayLessons;

    // Update difficulty tab counts
    updateDifficultyCounts();

    // Get lesson based on filter
    const displayLesson = getNextLessonForDifficulty(selectedDifficultyFilter);
    const lessonStartCard = document.getElementById('lessonStartCard');

    // Check if all lessons in selected difficulty are complete
    const range = getLessonRangeForDifficulty(selectedDifficultyFilter);
    const uniqueCompletedInRange = new Set(
        (appState.lessonHistory || [])
            .filter(h => h.lessonNum >= range.start && h.lessonNum < range.end)
            .map(h => h.lessonNum)
    ).size;
    const totalInRange = range.end - range.start;
    const allCompleteInRange = uniqueCompletedInRange >= totalInRange;

    if (allCompleteInRange) {
        // All lessons in this difficulty completed — show sequential practice
        const diff = getDifficultyLevel(range.start);
        const difficultyColors = {
            'Beginning': 'linear-gradient(135deg, #FF8A65, #F4511E)',
            'Basic': 'linear-gradient(135deg, #58cc02, #4CAF50)',
            'Intermediate': 'linear-gradient(135deg, #1cb0f6, #0984e3)',
            'Upper-Intermediate': 'linear-gradient(135deg, #ff9600, #f39c12)',
            'Advanced': 'linear-gradient(135deg, #ce82ff, #9b59b6)'
        };
        lessonStartCard.style.background = difficultyColors[diff.name];

        // Find the next lesson to practice: the one practiced longest ago
        const nextPractice = getNextPracticeLesson(range);
        const practiceInRange = nextPractice - range.start + 1;

        // Preview words for this lesson
        const practiceStartIdx = nextPractice * WORDS_PER_LESSON;
        const practiceWords = ieltsVocabulary.slice(practiceStartIdx, practiceStartIdx + WORDS_PER_LESSON);
        const practicePreview = practiceWords.map(w => w.en).slice(0, 3).join(', ');

        lessonStartCard.innerHTML = `
            <div class="lesson-difficulty">
                <span class="difficulty-badge">✅ ${diff.name} Complete!</span>
                <span class="difficulty-band">Review mode</span>
            </div>
            <div class="lesson-info">
                <div class="lesson-number">Lesson ${practiceInRange} of ${totalInRange}</div>
                <div class="lesson-words-preview">${practicePreview}...</div>
            </div>
            <button class="primary-btn start-lesson-btn" onclick="startLesson(${nextPractice})">
                🔄 PRACTICE AGAIN
            </button>
        `;
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

    // Render lesson history
    renderLessonHistory();
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

    // Show ALL history regardless of selected difficulty tab
    document.getElementById('historyCount').textContent = history.length;
    const mistakes = appState.mistakes || [];
    document.getElementById('mistakesCount').textContent = mistakes.length;

    if (history.length === 0) {
        historyPage = 0;
        historyContainer.innerHTML = `<div class="empty-history">No lessons completed yet</div>`;
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

function getNextPracticeLesson(range) {
    // Find the lesson practiced longest ago (least recently) in this range
    // This cycles through lessons sequentially: after completing lesson 1,
    // lesson 1 becomes the most recent → next time lesson 2 is offered, etc.
    const history = appState.lessonHistory || [];
    let oldestTime = Infinity;
    let oldestLesson = range.start;

    for (let i = range.start; i < range.end; i++) {
        // Find the most recent time this lesson was practiced
        let lastPracticed = 0;
        for (let j = history.length - 1; j >= 0; j--) {
            if (history[j].lessonNum === i) {
                lastPracticed = history[j].date || 0;
                break;
            }
        }
        if (lastPracticed < oldestTime) {
            oldestTime = lastPracticed;
            oldestLesson = i;
        }
    }

    return oldestLesson;
}

function filterByDifficulty(level) {
    selectedDifficultyFilter = level;
    historyPage = 0;

    // Update chip/tab active states
    document.querySelectorAll('.difficulty-chip, .difficulty-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    const activeEl = document.querySelector(`.difficulty-chip[data-level="${level}"]`) || document.querySelector(`.difficulty-tab[data-level="${level}"]`);
    if (activeEl) activeEl.classList.add('active');

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

const DOG_STAGES = [
    { minLevel: 1,  img: 'img/pets/chihuahua.png', fallback: '🐶', name: 'Chihuahua',     size: 72,  habitat: ['🌿','🌱','🌼','🌿','🍀','🌼'],  stageCss: 'chihuahua' },
    { minLevel: 11, img: 'img/pets/beagle.png',    fallback: '🐕', name: 'Beagle',        size: 84,  habitat: ['🌻','🌿','🦋','🌻','🌿','🦋'],  stageCss: 'beagle' },
    { minLevel: 21, img: 'img/pets/poodle.png',    fallback: '🐩', name: 'Poodle',        size: 92,  habitat: ['🌳','🍃','🌸','🌺','🌸','🍃'],  stageCss: 'poodle' },
    { minLevel: 31, img: 'img/pets/retriever.png',  fallback: '🦮', name: 'Retriever',     size: 100, habitat: ['🌲','🍂','🐿️','🌲','🍁','🍂'], stageCss: 'retriever' },
    { minLevel: 41, img: 'img/pets/dalmatian.png',  fallback: '🐕‍🦺', name: 'Dalmatian',     size: 108, habitat: ['🏠','🌻','🌳','🌺','🌻','🏡'],  stageCss: 'dalmatian' },
    { minLevel: 51, img: 'img/pets/husky.png',      fallback: '🐺', name: 'Husky',         size: 116, habitat: ['🏔️','❄️','🌲','❄️','🏔️','🌨️'], stageCss: 'husky' },
    { minLevel: 61, img: 'img/pets/shepherd.png',    fallback: '🐕', name: 'Shepherd',      size: 124, habitat: ['🌊','🏖️','🐚','🌊','🐚','🏖️'], stageCss: 'shepherd' },
    { minLevel: 71, img: 'img/pets/akita.png',      fallback: '🐕‍🦺', name: 'Akita',         size: 132, habitat: ['🏰','🌹','⚔️','🌹','🏰','⚔️'], stageCss: 'akita' },
    { minLevel: 81, img: 'img/pets/royal.png',      fallback: '👑🐶', name: 'Royal Hound',   size: 144, habitat: ['⭐','🌙','🔮','⭐','🌙','✨'], stageCss: 'royal' },
    { minLevel: 91, img: 'img/pets/diamond.png',    fallback: '💎🐶', name: 'Diamond Dog',   size: 156, habitat: ['👑','✨','🏆','💎','✨','👑'], stageCss: 'diamond' }
];

const DOG_FOOD = [
    { id: 'bone',    emoji: '🦴', name: 'Bone',        price: 5,  growth: 5 },
    { id: 'steak',   emoji: '🍖', name: 'Steak',       price: 15, growth: 15 },
    { id: 'chicken', emoji: '🍗', name: 'Chicken',     price: 25, growth: 30 },
    { id: 'cake',    emoji: '🧁', name: 'Cake',        price: 40, growth: 50 },
    { id: 'feast',   emoji: '👑', name: 'Royal Feast', price: 80, growth: 120 }
];

const DOG_ACCESSORIES = [
    // Hats (10)
    { id: 'bow',        emoji: '🎀', name: 'Bow',            price: 300,   slot: 'head' },
    { id: 'cap',        emoji: '🧢', name: 'Cap',            price: 400,   slot: 'head' },
    { id: 'partyhat',   emoji: '🥳', name: 'Party Hat',      price: 500,   slot: 'head' },
    { id: 'beret',      emoji: '🫐', name: 'Beret',          price: 700,   slot: 'head' },
    { id: 'hat',        emoji: '🎩', name: 'Top Hat',        price: 800,   slot: 'head' },
    { id: 'cowboy',     emoji: '🤠', name: 'Cowboy Hat',     price: 1200,  slot: 'head' },
    { id: 'crown',      emoji: '👑', name: 'Crown',          price: 1500,  slot: 'head' },
    { id: 'santa',      emoji: '🎅', name: 'Santa Hat',      price: 1800,  slot: 'head' },
    { id: 'wizard',     emoji: '🧙', name: 'Wizard Hat',     price: 2000,  slot: 'head' },
    { id: 'viking',     emoji: '⚔️', name: 'Viking Helmet',  price: 3000,  slot: 'head' },
    // Eyewear (7)
    { id: 'nerd',       emoji: '🤓', name: 'Nerd Glasses',   price: 400,   slot: 'eyes' },
    { id: 'glasses',    emoji: '🕶️', name: 'Sunglasses',     price: 500,   slot: 'eyes' },
    { id: 'monocle',    emoji: '🧐', name: 'Monocle',        price: 600,   slot: 'eyes' },
    { id: 'heartglass', emoji: '😍', name: 'Heart Glasses',  price: 800,   slot: 'eyes' },
    { id: 'goggles',    emoji: '🥽', name: 'Goggles',        price: 900,   slot: 'eyes' },
    { id: 'starglass',  emoji: '🤩', name: 'Star Glasses',   price: 1000,  slot: 'eyes' },
    { id: 'pixel',      emoji: '😎', name: 'Pixel Shades',   price: 1500,  slot: 'eyes' },
    // Neckwear (8)
    { id: 'collar',     emoji: '⭕', name: 'Collar',         price: 300,   slot: 'neck' },
    { id: 'bandana',    emoji: '🔴', name: 'Bandana',        price: 400,   slot: 'neck' },
    { id: 'bowtie',     emoji: '🎀', name: 'Bow Tie',        price: 500,   slot: 'neck' },
    { id: 'scarf',      emoji: '🧣', name: 'Scarf',          price: 600,   slot: 'neck' },
    { id: 'bellcollar', emoji: '🔔', name: 'Bell Collar',    price: 700,   slot: 'neck' },
    { id: 'tie',        emoji: '👔', name: 'Tie',            price: 800,   slot: 'neck' },
    { id: 'necklace',   emoji: '📿', name: 'Necklace',       price: 1000,  slot: 'neck' },
    { id: 'goldchain',  emoji: '⛓️', name: 'Gold Chain',     price: 2000,  slot: 'neck' },
    // Back/Body (8)
    { id: 'lifejacket', emoji: '🦺', name: 'Life Jacket',    price: 600,   slot: 'body' },
    { id: 'backpack',   emoji: '🎒', name: 'Backpack',       price: 800,   slot: 'body' },
    { id: 'sweater',    emoji: '🧥', name: 'Sweater',        price: 1000,  slot: 'body' },
    { id: 'saddle',     emoji: '🐴', name: 'Saddle',         price: 1200,  slot: 'body' },
    { id: 'cape',       emoji: '🦸', name: 'Cape',           price: 1500,  slot: 'body' },
    { id: 'tuxedo',     emoji: '🤵', name: 'Tuxedo',         price: 2500,  slot: 'body' },
    { id: 'wings',      emoji: '🪽', name: 'Wings',          price: 3000,  slot: 'body' },
    { id: 'armor',      emoji: '🛡️', name: 'Armor',          price: 5000,  slot: 'body' },
    // Effects (9)
    { id: 'flowercrown',emoji: '🌺', name: 'Flower Crown',   price: 800,   slot: 'effect' },
    { id: 'bubblering', emoji: '🫧', name: 'Bubble Ring',     price: 1000,  slot: 'effect' },
    { id: 'musicnotes', emoji: '🎵', name: 'Music Notes',     price: 1200,  slot: 'effect' },
    { id: 'sparkles',   emoji: '✨', name: 'Sparkles',        price: 1500,  slot: 'effect' },
    { id: 'rainbow',    emoji: '🌈', name: 'Rainbow Aura',    price: 2000,  slot: 'effect' },
    { id: 'snowflurry', emoji: '❄️', name: 'Snow Flurry',     price: 2000,  slot: 'effect' },
    { id: 'lightning',  emoji: '⚡', name: 'Lightning',       price: 2500,  slot: 'effect' },
    { id: 'flame',      emoji: '🔥', name: 'Flame Collar',    price: 3000,  slot: 'effect' },
    { id: 'diamond',    emoji: '💎', name: 'Diamond Collar',  price: 5000,  slot: 'effect' },
    // Toys (8)
    { id: 'stick',      emoji: '🪵', name: 'Stick',           price: 100,   slot: 'toy' },
    { id: 'ball',       emoji: '🎾', name: 'Ball',            price: 200,   slot: 'toy' },
    { id: 'bonetoy',    emoji: '🦴', name: 'Bone Toy',        price: 300,   slot: 'toy' },
    { id: 'kong',       emoji: '🟠', name: 'Kong',            price: 350,   slot: 'toy' },
    { id: 'ropetoy',    emoji: '🪢', name: 'Rope Toy',        price: 400,   slot: 'toy' },
    { id: 'frisbee',    emoji: '🥏', name: 'Frisbee',         price: 500,   slot: 'toy' },
    { id: 'squeakduck', emoji: '🦆', name: 'Squeaky Duck',    price: 600,   slot: 'toy' },
    { id: 'teddybear',  emoji: '🧸', name: 'Teddy Bear',      price: 700,   slot: 'toy' }
];

// Per-breed anchor points for anatomical accessory slots (head, eyes, neck).
// Values are CSS percentages relative to the pet-wrapper bounding box.
// sizeMul: multiplier applied to stage.size to get the accessory font-size.
const BREED_ANCHORS = {
    // Frontal face breeds (head is centered and large)
    chihuahua: {
        head: { top: '-20%', left: '50%', sizeMul: 0.44 },
        eyes: { top:  '22%', left: '50%', sizeMul: 0.28 },
        neck: { top:  '65%', left: '50%', sizeMul: 0.26 }
    },
    husky: {
        head: { top: '-18%', left: '50%', sizeMul: 0.44 },
        eyes: { top:  '24%', left: '50%', sizeMul: 0.28 },
        neck: { top:  '66%', left: '50%', sizeMul: 0.26 }
    },
    akita: {
        head: { top: '-22%', left: '52%', sizeMul: 0.44 },
        eyes: { top:  '22%', left: '52%', sizeMul: 0.28 },
        neck: { top:  '66%', left: '52%', sizeMul: 0.26 }
    },
    royal: {
        head: { top: '-24%', left: '50%', sizeMul: 0.48 },
        eyes: { top:  '18%', left: '50%', sizeMul: 0.30 },
        neck: { top:  '64%', left: '50%', sizeMul: 0.28 }
    },
    // Side-profile full-body breeds (head is top-left quadrant)
    beagle: {
        head: { top:   '4%', left: '22%', sizeMul: 0.38 },
        eyes: { top:  '20%', left: '24%', sizeMul: 0.24 },
        neck: { top:  '36%', left: '30%', sizeMul: 0.22 }
    },
    poodle: {
        head: { top:  '-2%', left: '18%', sizeMul: 0.40 },
        eyes: { top:  '20%', left: '20%', sizeMul: 0.24 },
        neck: { top:  '40%', left: '26%', sizeMul: 0.20 }
    },
    retriever: {
        head: { top:   '4%', left: '24%', sizeMul: 0.38 },
        eyes: { top:  '20%', left: '26%', sizeMul: 0.24 },
        neck: { top:  '36%', left: '32%', sizeMul: 0.22 }
    },
    shepherd: {
        head: { top:   '2%', left: '20%', sizeMul: 0.38 },
        eyes: { top:  '18%', left: '22%', sizeMul: 0.24 },
        neck: { top:  '38%', left: '28%', sizeMul: 0.20 }
    },
    // Abstract/non-dog breeds (creative aesthetic placement)
    dalmatian: {
        head: { top: '-22%', left: '50%', sizeMul: 0.42 },
        eyes: { top:  '10%', left: '35%', sizeMul: 0.26 },
        neck: { top:  '62%', left: '50%', sizeMul: 0.26 }
    },
    diamond: {
        head: { top:  '-8%', left: '68%', sizeMul: 0.40 },
        eyes: { top:  '10%', left: '65%', sizeMul: 0.24 },
        neck: { top:  '30%', left: '58%', sizeMul: 0.22 }
    }
};

// Slot size multipliers for ambient (non-anatomical) slots — same for all breeds
const AMBIENT_SLOT_SIZES = {
    body:   0.52,
    effect: 0.38,
    toy:    0.32
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

const PET_QUESTS = [
    { id: 'lesson',    text: 'Complete 1 lesson today',          coins: 5, hunger: 30,
      eligible: () => true },
    { id: 'perfect',   text: 'Get 100% accuracy in a lesson',   coins: 10, hunger: 40,
      eligible: () => true },
    { id: 'srs',       text: 'Complete an SRS review session',   coins: 5, hunger: 30,
      eligible: s => s.srs && Object.keys(s.srs).length >= 3 },
    { id: 'wotd',      text: 'Open the Word of the Day',        coins: 3, hunger: 20,
      eligible: () => true },
    { id: 'bubbles',   text: 'Play Word Bubbles',               coins: 5, hunger: 30,
      eligible: () => true },
    { id: 'streak3',   text: 'Study 3 days in a row',           coins: 15, hunger: 50,
      eligible: () => true },
    { id: 'rhythm',    text: 'Play a music game',               coins: 5, hunger: 30,
      eligible: () => true }
];

function getPointsForLevel(level) {
    if (level <= 1) return 0;
    return Math.floor(2.5 * Math.pow(level - 1, 2) + 10 * (level - 1));
}

function getDogLevel(growthXP) {
    let level = 1;
    for (let l = 100; l >= 1; l--) {
        if (growthXP >= getPointsForLevel(l)) { level = l; break; }
    }
    return level;
}

function getDogStage(level) {
    for (let i = DOG_STAGES.length - 1; i >= 0; i--) {
        if (level >= DOG_STAGES[i].minLevel) return DOG_STAGES[i];
    }
    return DOG_STAGES[0];
}

function getDogTitle(level) {
    if (level >= 100) return 'Ultimate Champion';
    if (level >= 91)  return 'Diamond Legend';
    if (level >= 81)  return 'Royal Hound';
    if (level >= 71)  return 'Noble Akita';
    if (level >= 61)  return 'Brave Shepherd';
    if (level >= 51)  return 'Arctic Husky';
    if (level >= 41)  return 'Cool Dalmatian';
    if (level >= 31)  return 'Golden Retriever';
    if (level >= 21)  return 'Fancy Poodle';
    if (level >= 11)  return 'Happy Beagle';
    return 'Little Chihuahua';
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

    const poopCount = (appState.petPoops || []).length;
    const today     = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    // 3+ poops drops mood one tier
    if (poopCount >= POOP_MOOD_THRESHOLD) {
        if (appState.lastStudyDate === today)      return 'neutral';
        if (appState.lastStudyDate === yesterday)  return 'sleepy';
        return 'hungry';
    }

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

function applyGrowthDecay() {
    if (!appState || !appState.lastStudyDate) return;
    const today = new Date().toDateString();
    if (appState.lastDecayDate === today) return; // Already applied today
    if (appState.lastStudyDate === today) { appState.lastDecayDate = today; return; } // Studied today, no decay

    const lastStudy = new Date(appState.lastStudyDate);
    const now = new Date();
    const daysMissed = Math.floor((now - lastStudy) / 86400000) - 1; // -1 because day after study is OK
    if (daysMissed <= 0) { appState.lastDecayDate = today; return; }

    const daysToApply = Math.min(daysMissed, 7); // Max 7 days of decay
    const decayPercent = daysToApply * 0.02; // 2% per day
    const oldLevel = appState.dogLevel || 1;
    const decayAmount = Math.floor((appState.dogGrowthXP || 0) * decayPercent);

    if (decayAmount > 0) {
        appState.dogGrowthXP = Math.max(0, (appState.dogGrowthXP || 0) - decayAmount);
        appState.dogLevel = getDogLevel(appState.dogGrowthXP);

        if (appState.dogLevel < oldLevel) {
            const stage = getDogStage(appState.dogLevel);
            setTimeout(() => showPetSpeechBubble(`Oh no! I shrunk to ${stage.name}… Buy me food! 😢`), 800);
        } else {
            setTimeout(() => showPetSpeechBubble("I'm getting hungry… please feed me! 🥺"), 800);
        }
        saveUserData(currentUser, appState);
    }
    appState.lastDecayDate = today;
}

function renderWordPet() {
    const heroZone  = document.getElementById('petHeroZone');
    const habEmojis = document.getElementById('habitatEmojis');
    const topbar    = document.getElementById('petHeroTopbar');
    const stage_el  = document.getElementById('petHeroStage');
    const xpbar_el  = document.getElementById('petHeroXpbar');
    if (!heroZone || !stage_el) return;

    var level, stage, mood, coins;
    try {
        try { applyGrowthDecay(); } catch(e) {}
        level = appState.dogLevel || 1;
        stage = getDogStage(level) || DOG_STAGES[0];
        mood  = getPetMood() || 'happy';
        coins = appState.coins || 0;
    } catch(e) {
        level = 1; stage = DOG_STAGES[0]; mood = 'happy'; coins = 0;
    }

    // Hero zone stage gradient + time of day
    try {
        heroZone.className = 'pet-hero-zone ' + (typeof getTimeOfDayClass === 'function' ? getTimeOfDayClass() : '');
        heroZone.dataset.stage = stage.stageCss;
    } catch(e) {}

    // Floating habitat emojis
    try {
        if (habEmojis && stage.habitat) {
            const positions = [
                { left: '8%',  bottom: '15%' },
                { left: '22%', bottom: '45%' },
                { left: '42%', bottom: '8%' },
                { left: '62%', bottom: '55%' },
                { left: '80%', bottom: '25%' },
                { left: '92%', bottom: '60%' }
            ];
            habEmojis.innerHTML = stage.habitat.map((e, i) => {
                const p = positions[i] || positions[0];
                const dur = 7 + (i * 1.7) % 5;
                const delay = (i * 1.3) % 4;
                return `<span style="left:${p.left};bottom:${p.bottom};--drift-duration:${dur}s;--drift-delay:-${delay}s">${e}</span>`;
            }).join('');
        }
    } catch(e) {}

    // ALWAYS render pet creature first — even if later code crashes, the dog is visible
    stage_el.innerHTML = `
        <div class="pet-creature ${mood}" onclick="onPetTap()" data-stage="${stage.stageCss}">
            <span style="font-size:${stage.size}px;line-height:1">${stage.fallback}</span>
        </div>
    `;

    // Naming prompt (first time)
    if (!appState.petName) {
        if (topbar) topbar.innerHTML = '';
        if (xpbar_el) xpbar_el.innerHTML = '';
        stage_el.innerHTML += `
            <div class="pet-name-form" style="margin-top:12px">
                <div style="font-size:13px;font-weight:700;color:rgba(255,255,255,0.9);text-shadow:0 1px 4px rgba(0,0,0,0.3)">Name your dog!</div>
                <input class="pet-name-input" id="petNameInput" type="text"
                       maxlength="12" placeholder="Enter a name…"
                       onkeydown="if(event.key==='Enter')savePetName()">
                <button class="pet-name-btn" onclick="savePetName()">Name it! 🐾</button>
            </div>
        `;
        return;
    }

    // Everything below is wrapped in try-catch — pet is already visible above
    try {

    // XP progress bar
    const currentXP = appState.dogGrowthXP || 0;
    const currentLevelXP = getPointsForLevel(level);
    const nextLevelXP = level < 100 ? getPointsForLevel(level + 1) : currentLevelXP;
    const xpInLevel = currentXP - currentLevelXP;
    const xpNeeded = nextLevelXP - currentLevelXP;
    const xpPercent = level >= 100 ? 100 : (xpNeeded > 0 ? Math.min(100, Math.floor(xpInLevel / xpNeeded * 100)) : 0);

    // Active accessories — per-breed anchor points for anatomical slots
    const active = appState.activeAccessories || [];
    const anchors = BREED_ANCHORS[stage.stageCss] || BREED_ANCHORS.chihuahua;

    const accPositions = appState.accPositions || {};

    const accSpans = active.map(id => {
        const acc = DOG_ACCESSORIES.find(a => a.id === id);
        if (!acc) return '';

        let styleStr;
        const customPos = accPositions[id];

        if (customPos) {
            const sz = anchors[acc.slot]
                ? Math.max(18, Math.round(stage.size * anchors[acc.slot].sizeMul))
                : Math.max(18, Math.round(stage.size * (AMBIENT_SLOT_SIZES[acc.slot] || 0.35)));
            styleStr = `font-size:${sz}px;top:${customPos.top};left:${customPos.left};transform:translate(-50%,-50%)`;
        } else if (anchors[acc.slot]) {
            const a = anchors[acc.slot];
            const sz = Math.max(18, Math.round(stage.size * a.sizeMul));
            styleStr = `font-size:${sz}px;top:${a.top};left:${a.left};transform:translateX(-50%)`;
        } else {
            const sz = Math.max(18, Math.round(stage.size * (AMBIENT_SLOT_SIZES[acc.slot] || 0.35)));
            styleStr = `font-size:${sz}px`;
        }
        return `<span class="pet-accessory acc-${acc.slot} draggable-pet-acc" data-acc-id="${id}" style="${styleStr}">${acc.emoji}</span>`;
    }).join('');

    // Daily quest tracking
    const today = new Date().toDateString();
    if (!appState.petQuest || appState.petQuest.lastDate !== today) {
        try {
            const quest = getDailyQuest(appState);
            if (!appState.petQuest) appState.petQuest = { lastDate: null, questId: null, completed: false };
            appState.petQuest.lastDate = today;
            appState.petQuest.questId  = quest.id;
            appState.petQuest.completed = false;
        } catch(e) {}
    }

    // Poop lifecycle — evaluate spawn
    try { evaluatePoopSpawn(); } catch(e) {}

    // Build poop HTML for stage
    const poopsHTML = (appState.petPoops || []).map(p => {
        const age = (Date.now() - p.born) / 3600000;
        const isStinky = age >= POOP_STINK_HOURS;
        return `<div class="pet-poop ${isStinky ? 'stinky' : ''}" data-poop-id="${p.id}" style="left:${p.x}%;top:${p.y}%">💩${isStinky ? '<span class="poop-stink">💨</span>' : ''}</div>`;
    }).join('');

    // Hero topbar — avatar, level, coins, streak, info
    if (topbar) {
        const ud = getUserData(currentUser) || appState || {};
        const avatar = ud.avatar || appState.avatar || '😊';
        const streak = ud.streak || appState.streak || 0;
        topbar.innerHTML = `
            <div class="pet-hero-left">
                <div class="pet-hero-avatar" onclick="navigateToProfile()">${avatar}</div>
                <div class="pet-hero-level">Lv.${level}</div>
                <div class="pet-hero-version">${APP_VERSION}</div>
            </div>
            <div class="pet-hero-right">
                <div class="pet-hero-coins" onclick="showPetShop()">🪙 ${coins}</div>
                <div class="pet-hero-streak">🔥 ${streak}</div>
                <button class="pet-hero-info" onclick="showPetInfo()" title="Pet info">ℹ️</button>
            </div>
        `;
    }

    // Pet creature + accessories + poops
    stage_el.innerHTML = `
        <div class="pet-wrapper">
            <div class="pet-creature ${mood}" onclick="onPetTap()" data-stage="${stage.stageCss}">
                <span style="font-size:${stage.size}px;line-height:1">${stage.fallback}</span>
            </div>
            ${accSpans}
        </div>
        ${poopsHTML}
    `;

    // Make equipped accessories draggable on the pet
    setTimeout(() => { try { initAccDrag(); } catch(e) {} }, 50);

    // Make poops draggable to trash
    setTimeout(() => { try { initPoopDrag(); } catch(e) {} }, 60);

    // XP bar + hunger hearts at bottom of habitat
    const hunger = computeCurrentHunger(appState);
    const fullHearts = Math.round(hunger / 20);
    const heartsHTML = Array.from({length: 5}, (_, i) =>
        `<span class="hunger-heart ${i < fullHearts ? 'full' : 'empty'}">${i < fullHearts ? '❤️' : '🖤'}</span>`
    ).join('');
    const hungerLabel = hunger === 0 ? 'Starving!' : hunger <= 25 ? 'Hungry' : hunger >= 75 ? 'Full' : 'Ok';

    const hasPoops = (appState.petPoops || []).length > 0;
    const trashBtnHTML = hasPoops ? '<button class="pet-trash-btn" id="petTrashBtn">🗑️</button>' : '';

    if (xpbar_el) {
        xpbar_el.innerHTML = `
            <div class="pet-bottom-strip">
                <div class="pet-bottom-left">
                    <div class="hunger-hearts-row">
                        ${heartsHTML}
                        <span class="hunger-label ${hunger <= 25 ? 'hunger-warning' : ''}">${hungerLabel}</span>
                    </div>
                </div>
                ${trashBtnHTML}
                <button class="pet-shop-btn-hero" onclick="showPetShop()">🛒 Shop</button>
            </div>
            <div class="pet-hero-xp-track">
                <div class="pet-hero-xp-fill" style="width:${xpPercent}%"></div>
            </div>
            <span class="pet-hero-xp-label">${level >= 100 ? 'MAX LEVEL' : `${xpInLevel}/${xpNeeded} XP`}</span>
        `;
    }

    // Auto-show starving bubble
    if (hunger === 0) {
        setTimeout(() => showPetSpeechBubble("I'm so hungry… buy me food! 😢"), 500);
    } else if ((appState.petPoops || []).some(p => (Date.now() - p.born) / 3600000 >= POOP_STINK_HOURS)) {
        setTimeout(() => showPetSpeechBubble("It's so stinky! Please clean up! 🤢"), 600);
    }

    } catch(petErr) {
        console.error('renderWordPet error:', petErr);
        // Pet creature is already rendered above — just show basic topbar
        if (topbar) topbar.innerHTML = `<div class="pet-hero-right"><div class="pet-hero-coins" onclick="showPetShop()">🪙 ${coins}</div></div>`;
    }
}

function showPetInfo() {
    const existing = document.getElementById('petInfoModal');
    if (existing) existing.remove();

    const level = appState.dogLevel || 1;
    const currentXP = appState.dogGrowthXP || 0;

    // Build stages list (10 stages, 2 columns)
    const stagesHTML = DOG_STAGES.map(s => {
        const unlocked = level >= s.minLevel;
        const isCurrent = getDogStage(level) === s;
        return `<div class="pet-info-stage ${unlocked ? '' : 'locked'} ${isCurrent ? 'current' : ''}">
            <img class="pet-info-emoji" src="${s.img}" alt="${s.name}" style="width:${Math.min(s.size/3, 24)}px;height:${Math.min(s.size/3, 24)}px">
            <span class="pet-info-label">${s.name}</span>
            <span class="pet-info-pts">Lv.${s.minLevel}${isCurrent ? ' 🐾' : unlocked ? ' ✅' : ' 🔒'}</span>
        </div>`;
    }).join('');

    // Food catalog
    const foodHTML = DOG_FOOD.map(f =>
        `<div class="pet-info-stage"><span class="pet-info-emoji">${f.emoji}</span><span class="pet-info-label">${f.name}</span><span class="pet-info-pts">${f.price} 🪙 → +${f.growth} XP</span></div>`
    ).join('');

    const overlay = document.createElement('div');
    overlay.id = 'petInfoModal';
    overlay.className = 'pet-info-modal-overlay';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
        <div class="pet-info-modal" style="max-height:80vh;overflow-y:auto">
            <button class="pet-info-close" onclick="document.getElementById('petInfoModal').remove()">✕</button>
            <h3 style="margin:0 0 8px;font-size:18px">🐶 My Dog · Lv.${level}</h3>
            <p style="margin:0 0 12px;font-size:13px;color:var(--text-secondary)">Earn coins from lessons → buy food → grow your dog!</p>

            <div style="font-weight:700;font-size:13px;margin-bottom:6px">🐾 Growth Stages</div>
            <div class="pet-info-stages">${stagesHTML}</div>

            <div style="font-weight:700;font-size:13px;margin:12px 0 6px">🍖 Food Shop</div>
            <div class="pet-info-stages">${foodHTML}</div>

            <div class="pet-info-tips" style="margin-top:12px">
                <div class="pet-info-tip">🪙 <strong>Coins</strong> = earned from completing lessons</div>
                <div class="pet-info-tip">🛒 <strong>Shop</strong> = buy food to grow, accessories to dress up</div>
                <div class="pet-info-tip">📉 <strong>Warning</strong> = dog loses 2% growth per missed day!</div>
                <div class="pet-info-tip">👆 <strong>Tap</strong> your dog for encouragement!</div>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

let _shopTab = 'food';
let _accCategory = 'all';

const ACC_CATEGORIES = [
    { id: 'all',    label: 'All',     emoji: '🛍️' },
    { id: 'head',   label: 'Hats',    emoji: '🎩' },
    { id: 'eyes',   label: 'Eyes',    emoji: '🕶️' },
    { id: 'neck',   label: 'Neck',    emoji: '🧣' },
    { id: 'body',   label: 'Body',    emoji: '🧥' },
    { id: 'effect', label: 'Effects', emoji: '✨' },
    { id: 'toy',    label: 'Toys',    emoji: '🎾' }
];

function showPetShop() {
    const existing = document.getElementById('petShopModal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'petShopModal';

    if (_shopTab === 'food') {
        // Bottom drawer — dog stays visible at top for drag-to-feed
        overlay.className = 'pet-shop-drawer-overlay';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = renderShopContent();
        document.body.appendChild(overlay);
        // Slide-up animation
        requestAnimationFrame(() => {
            requestAnimationFrame(() => overlay.classList.add('open'));
        });
        // Initialize drag-to-feed after rendering
        setTimeout(() => initDragToFeed(), 50);
    } else {
        // Full modal for accessories (no dragging needed)
        overlay.className = 'pet-info-modal-overlay';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = renderShopContent();
        document.body.appendChild(overlay);
    }
}

function renderShopContent() {
    const coins = appState.coins || 0;

    const studiedToday = appState.lastStudyDate === new Date().toDateString();
    const foodItems = DOG_FOOD.map(f => {
        const canAfford = coins >= f.price;
        const feastBonus = f.id === 'feast' && studiedToday;
        const dragHint = canAfford ? '<span class="drag-hint">⬆ drag to feed</span>' : '';
        return `<div class="shop-item ${canAfford ? 'draggable-food' : 'disabled'}"
                     data-food-id="${f.id}" data-food-emoji="${f.emoji}">
            <span class="shop-item-emoji">${f.emoji}</span>
            <div class="shop-item-info">
                <div class="shop-item-name">${f.name}</div>
                <div class="shop-item-desc">+${f.growth} growth XP${feastBonus ? ' <span class="feast-bonus-hint">(+30 study bonus!)</span>' : ''}</div>
                ${dragHint}
            </div>
            <button class="shop-buy-btn ${canAfford ? '' : 'disabled'}" onclick="${canAfford ? `buyFood('${f.id}', this)` : ''}">${f.price} 🪙</button>
        </div>`;
    }).join('');

    // Filter accessories by category
    const filteredAcc = _accCategory === 'all' ? DOG_ACCESSORIES : DOG_ACCESSORIES.filter(a => a.slot === _accCategory);

    const accItems = filteredAcc.map(a => {
        const owned = (appState.petAccessories || []).includes(a.id);
        const equipped = (appState.activeAccessories || []).includes(a.id);
        const canAfford = coins >= a.price;
        let btnHTML;
        if (owned) {
            btnHTML = `<button class="shop-buy-btn ${equipped ? 'equipped' : 'owned'}" onclick="toggleAccessory('${a.id}')">${equipped ? '✅ On' : 'Wear'}</button>`;
        } else {
            btnHTML = `<button class="shop-buy-btn ${canAfford ? '' : 'disabled'}" onclick="${canAfford ? `buyAccessory('${a.id}')` : ''}">${a.price} 🪙</button>`;
        }
        return `<div class="shop-item ${!owned && !canAfford ? 'disabled' : ''}">
            <span class="shop-item-emoji">${a.emoji}</span>
            <div class="shop-item-info">
                <div class="shop-item-name">${a.name}</div>
                <div class="shop-item-desc">${owned ? (equipped ? 'Equipped' : 'Owned') : a.slot}</div>
            </div>
            ${btnHTML}
        </div>`;
    }).join('');

    // Category filter pills for accessories tab
    const catPills = ACC_CATEGORIES.map(c =>
        `<button class="shop-cat-pill ${_accCategory === c.id ? 'active' : ''}" onclick="_accCategory='${c.id}';refreshShop()">${c.emoji} ${c.label}</button>`
    ).join('');

    const isDrawer = _shopTab === 'food';
    return `
        <div class="pet-shop-modal">
            <button class="pet-info-close" onclick="document.getElementById('petShopModal').remove()">✕</button>
            ${isDrawer ? `
                <div class="shop-drawer-header">
                    <span class="shop-drawer-title">🍖 Food Shop</span>
                    <span class="shop-coins-inline">🪙 ${coins}</span>
                    <button class="shop-tab-switch" onclick="_shopTab='acc';refreshShop()">👗 Accessories →</button>
                </div>
            ` : `
                <h3 style="margin:0 0 4px;font-size:18px">🛒 Pet Shop</h3>
                <div class="shop-coins">🪙 ${coins} coins</div>
                <div class="shop-tabs">
                    <button class="shop-tab ${_shopTab === 'food' ? 'active' : ''}" onclick="_shopTab='food';refreshShop()">🍖 Food</button>
                    <button class="shop-tab ${_shopTab === 'acc' ? 'active' : ''}" onclick="_shopTab='acc';refreshShop()">👗 Accessories</button>
                </div>
            `}
            ${_shopTab === 'acc' ? `<div class="shop-categories">${catPills}</div>` : ''}
            <div class="shop-items">
                ${_shopTab === 'food' ? foodItems : accItems}
            </div>
        </div>
    `;
}

function refreshShop() {
    const modal = document.getElementById('petShopModal');
    if (!modal) return;

    // If switching tabs, we need to recreate with proper overlay type
    const isDrawer = modal.classList.contains('pet-shop-drawer-overlay');
    const needsDrawer = _shopTab === 'food';

    if (isDrawer !== needsDrawer) {
        // Tab changed — rebuild entire shop with correct overlay
        modal.remove();
        showPetShop();
        return;
    }

    modal.innerHTML = renderShopContent();
    if (_shopTab === 'food') {
        setTimeout(() => initDragToFeed(), 50);
    }
}

function buyFood(foodId, sourceEl) {
    const food = DOG_FOOD.find(f => f.id === foodId);
    if (!food || (appState.coins || 0) < food.price) return;

    const oldLevel = appState.dogLevel || 1;
    appState.coins -= food.price;

    let totalGrowth = food.growth;
    let bonusMsg = '';

    // Option B: Royal Feast study bonus (+30 XP if studied today)
    if (foodId === 'feast' && appState.lastStudyDate === new Date().toDateString()) {
        totalGrowth += 30;
        bonusMsg = ' (+30 study bonus!)';
    }

    appState.dogGrowthXP = (appState.dogGrowthXP || 0) + totalGrowth;
    appState.dogLevel = getDogLevel(appState.dogGrowthXP);
    appState.petLastFed = Date.now(); // Feeding resets hunger

    saveUserData(currentUser, appState);

    // Animate feeding arc + chomp
    animateFeeding(food.emoji, sourceEl);

    // Show result after animation completes
    setTimeout(() => {
        if (appState.dogLevel > oldLevel) {
            showLevelUpCelebration(appState.dogLevel, oldLevel);
        } else {
            showToast(`${food.emoji} +${totalGrowth} growth XP!${bonusMsg}`);
        }
        refreshShop();
        renderWordPet();
    }, 700);
}

function buyAccessory(accId) {
    const acc = DOG_ACCESSORIES.find(a => a.id === accId);
    if (!acc || (appState.coins || 0) < acc.price) return;
    if ((appState.petAccessories || []).includes(accId)) return; // Already owned

    appState.coins -= acc.price;
    if (!appState.petAccessories) appState.petAccessories = [];
    appState.petAccessories.push(accId);

    // Auto-equip if less than 3 active
    if (!appState.activeAccessories) appState.activeAccessories = [];
    if (appState.activeAccessories.length < 3) {
        appState.activeAccessories.push(accId);
    }

    saveUserData(currentUser, appState);
    showToast(`${acc.emoji} ${acc.name} acquired!`);
    refreshShop();
    renderWordPet();
}

function showLevelUpCelebration(newLevel, oldLevel) {
    const existing = document.getElementById('levelUpOverlay');
    if (existing) existing.remove();

    const stage = getDogStage(newLevel);
    const oldStage = getDogStage(oldLevel);
    const stageChanged = stage.minLevel !== oldStage.minLevel;
    const isMilestone = newLevel % 10 === 0;

    const overlay = document.createElement('div');
    overlay.id = 'levelUpOverlay';
    overlay.className = 'level-up-overlay';
    overlay.onclick = function() { overlay.remove(); renderWordPet(); };

    let content = `
        <div class="level-up-confetti">${'🎉'.repeat(6)}${'✨'.repeat(4)}${'⭐'.repeat(3)}</div>
        <div class="level-up-text">${isMilestone ? '🏆 MILESTONE!' : '🎉 LEVEL UP!'}</div>
        <div class="level-up-level">Level ${newLevel}</div>
    `;

    if (stageChanged) {
        content += `
            <div class="level-up-evolution">
                <img src="${oldStage.img}" alt="${oldStage.name}" style="width:${Math.min(oldStage.size, 64)}px;height:${Math.min(oldStage.size, 64)}px">
                <span style="font-size:24px">→</span>
                <img src="${stage.img}" alt="${stage.name}" style="width:${Math.min(stage.size, 80)}px;height:${Math.min(stage.size, 80)}px">
            </div>
            <div class="level-up-stage-name">Your dog evolved to ${stage.name}!</div>
        `;
    }

    content += `<div class="level-up-title">${getDogTitle(newLevel)}</div>`;
    content += `<div style="margin-top:20px;font-size:13px;opacity:0.7">Tap to continue</div>`;

    overlay.innerHTML = content;
    document.body.appendChild(overlay);
}

function savePetName() {
    const input = document.getElementById('petNameInput');
    if (!input) return;
    const name = input.value.trim();
    if (!name) return;
    appState.petName = name;
    saveUserData(currentUser, appState);
    renderWordPet();
}

function toggleAccessory(id) {
    const active = appState.activeAccessories || [];
    if (active.includes(id)) {
        appState.activeAccessories = active.filter(a => a !== id);
        // Clear custom drag position
        if (appState.accPositions) delete appState.accPositions[id];
    } else if (active.length < 3) {
        if (!appState.activeAccessories) appState.activeAccessories = [];
        appState.activeAccessories.push(id);
    } else {
        showToast('Only 3 accessories at once!');
        return;
    }
    saveUserData(currentUser, appState);
    refreshShop();
    renderWordPet();
}

function checkAccessoryUnlocks() { /* Now handled via shop */ }

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
    appState.coins = (appState.coins || 0) + (quest.coins || 0);
    feedPet(quest.hunger);
    saveUserData(currentUser, appState);
    showToast(`🐾 Quest complete! +${quest.coins} 🪙`);
    const creature = document.querySelector('.pet-creature');
    if (creature) {
        creature.classList.add('wiggle');
        setTimeout(() => creature.classList.remove('wiggle'), 600);
    }
    renderWordPet();
}

// Backward compatibility shim — now uses showLevelUpCelebration
function showEvolutionCelebration(stage) {
    const level = appState.dogLevel || 1;
    showLevelUpCelebration(level, Math.max(1, level - 1));
}

const PET_PHRASES_EXTENDED = PET_PHRASES;

function fireHeartBurst() {
    const stage = document.querySelector('.pet-hero-stage');
    if (!stage) return;
    const old = stage.querySelector('.heart-burst');
    if (old) old.remove();
    const burst = document.createElement('div');
    burst.className = 'heart-burst';
    const particles = ['❤️','💛','💚','💙','💜','🩷'];
    const offsets = [
        { x: '-30px', y: '-50px', delay: '0s',    dur: '0.7s' },
        { x: '30px',  y: '-55px', delay: '0.05s', dur: '0.75s' },
        { x: '-50px', y: '-30px', delay: '0.1s',  dur: '0.8s' },
        { x: '50px',  y: '-25px', delay: '0.05s', dur: '0.7s' },
        { x: '0px',   y: '-65px', delay: '0.15s', dur: '0.9s' }
    ];
    offsets.forEach((o, i) => {
        const s = document.createElement('span');
        s.textContent = particles[i % particles.length];
        s.style.setProperty('--fly-x', o.x);
        s.style.setProperty('--fly-y', o.y);
        s.style.setProperty('--fly-delay', o.delay);
        s.style.setProperty('--fly-dur', o.dur);
        burst.appendChild(s);
    });
    stage.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
}

// ==================== ANIMATED FEEDING ====================

function animateFeeding(foodEmoji, sourceEl) {
    const creature = document.querySelector('.pet-creature');
    if (!creature) return;

    const creatureRect = creature.getBoundingClientRect();
    const sourceRect = sourceEl ? sourceEl.getBoundingClientRect()
        : { left: window.innerWidth / 2, top: window.innerHeight - 100, width: 0, height: 0 };

    // Create flying food element
    const flyFood = document.createElement('div');
    flyFood.className = 'flying-food';
    flyFood.textContent = foodEmoji;
    flyFood.style.position = 'fixed';
    flyFood.style.left = (sourceRect.left + sourceRect.width / 2) + 'px';
    flyFood.style.top = (sourceRect.top + sourceRect.height / 2) + 'px';
    document.body.appendChild(flyFood);

    // Target: dog mouth area (60% down from top of creature)
    const targetX = creatureRect.left + creatureRect.width / 2;
    const targetY = creatureRect.top + creatureRect.height * 0.6;
    const startX = sourceRect.left + sourceRect.width / 2;
    const startY = sourceRect.top + sourceRect.height / 2;
    const midX = (startX + targetX) / 2;
    const midY = Math.min(startY, targetY) - 80; // Arc peak

    flyFood.animate([
        { left: startX + 'px', top: startY + 'px', transform: 'scale(1) rotate(0deg)', opacity: 1 },
        { left: midX + 'px',   top: midY + 'px',   transform: 'scale(1.4) rotate(-15deg)', opacity: 1, offset: 0.45 },
        { left: targetX + 'px', top: targetY + 'px', transform: 'scale(0.3) rotate(25deg)', opacity: 0 }
    ], { duration: 600, easing: 'ease-in', fill: 'forwards' });

    // Dog chomp on arrival
    setTimeout(() => {
        flyFood.remove();
        creature.classList.remove('pet-chomp');
        void creature.offsetWidth;
        creature.classList.add('pet-chomp');
        fireFeedBurst();
        setTimeout(() => creature.classList.remove('pet-chomp'), 500);
    }, 560);
}

function fireFeedBurst() {
    const stage = document.querySelector('.pet-hero-stage');
    if (!stage) return;
    const old = stage.querySelector('.feed-burst');
    if (old) old.remove();
    const burst = document.createElement('div');
    burst.className = 'feed-burst';
    const particles = ['🍖','✨','⭐','🌟','💫','😋'];
    const offsets = [
        { x: '-35px', y: '-45px', delay: '0s',    dur: '0.7s' },
        { x: '35px',  y: '-50px', delay: '0.05s', dur: '0.75s' },
        { x: '-55px', y: '-25px', delay: '0.1s',  dur: '0.8s' },
        { x: '55px',  y: '-20px', delay: '0.05s', dur: '0.7s' },
        { x: '0px',   y: '-60px', delay: '0.12s', dur: '0.85s' },
        { x: '-20px', y: '-55px', delay: '0.08s', dur: '0.9s' }
    ];
    offsets.forEach((o, i) => {
        const s = document.createElement('span');
        s.textContent = particles[i % particles.length];
        s.style.setProperty('--fly-x', o.x);
        s.style.setProperty('--fly-y', o.y);
        s.style.setProperty('--fly-delay', o.delay);
        s.style.setProperty('--fly-dur', o.dur);
        burst.appendChild(s);
    });
    stage.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
}

// ==================== PET POOP SYSTEM ====================

const POOP_DELAY_HOURS = 2;
const POOP_MAX = 3;
const POOP_STINK_HOURS = 12;
const POOP_CLEAN_COINS = 3;
const POOP_CLEAN_XP = 10;
const POOP_MOOD_THRESHOLD = 3;

const POOP_CLEAN_PHRASES = [
    "Thanks for cleaning up! You're the best! 🧹",
    "Ahhh, much better! Sparkling clean! ✨",
    "My hero! No more stinky! 🦸",
    "Woohoo! That feels so good! 🎉"
];

function evaluatePoopSpawn() {
    if (!appState || !appState.petName || !appState.petLastFed) return;
    if (!appState.petPoops) appState.petPoops = [];

    const now = Date.now();
    const hoursSinceFed = (now - appState.petLastFed) / 3600000;
    if (hoursSinceFed < POOP_DELAY_HOURS) return;
    if (appState.petPoops.length >= POOP_MAX) return;

    const windowSize = 2; // hours
    const firstWindow = Math.floor(POOP_DELAY_HOURS / windowSize);
    const currentWindow = Math.floor(hoursSinceFed / windowSize);

    let changed = false;
    for (let w = firstWindow; w <= currentWindow && appState.petPoops.length < POOP_MAX; w++) {
        const windowId = 'poop-' + appState.petLastFed + '-' + w;
        if (appState.petPoops.some(p => p.id === windowId)) continue;

        const rng = seededRandom(windowId);
        if (rng() < 0.6) {
            appState.petPoops.push({
                id: windowId,
                x: 15 + rng() * 70,
                y: 70 + rng() * 25,
                born: appState.petLastFed + (w * windowSize * 3600000)
            });
            changed = true;
        }
    }

    if (changed) {
        saveUserData(currentUser, appState);
        setTimeout(() => showPetSpeechBubble("Oops… I had an accident! 💩"), 400);
    }
}

// ==================== DRAG-TO-FEED SYSTEM ====================

let _dragState = null;

function initDragToFeed() {
    const foodItems = document.querySelectorAll('.draggable-food');
    foodItems.forEach(item => {
        item.addEventListener('touchstart', onFoodTouchStart, { passive: false });
        item.addEventListener('touchmove', onFoodTouchMove, { passive: false });
        item.addEventListener('touchend', onFoodTouchEnd);
        // Mouse fallback for desktop testing
        item.addEventListener('mousedown', onFoodMouseDown);
    });
}

function onFoodTouchStart(e) {
    const touch = e.touches[0];
    const item = e.currentTarget;
    startFoodDrag(item, touch.clientX, touch.clientY);
    e.preventDefault();
}

function onFoodTouchMove(e) {
    if (!_dragState) return;
    const touch = e.touches[0];
    moveFoodDrag(touch.clientX, touch.clientY);
    e.preventDefault();
}

function onFoodTouchEnd(e) {
    if (!_dragState) return;
    endFoodDrag();
}

function onFoodMouseDown(e) {
    const item = e.currentTarget;
    startFoodDrag(item, e.clientX, e.clientY);
    e.preventDefault();

    const onMove = (ev) => { if (_dragState) moveFoodDrag(ev.clientX, ev.clientY); };
    const onUp = () => { endFoodDrag(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function startFoodDrag(item, x, y) {
    const emoji = item.dataset.foodEmoji;
    const foodId = item.dataset.foodId;

    // Create floating drag ghost
    const ghost = document.createElement('div');
    ghost.className = 'drag-food-ghost';
    ghost.textContent = emoji;
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
    document.body.appendChild(ghost);

    _dragState = { ghost, foodId, emoji, startX: x, startY: y, item };

    // Show drop target hint on pet
    const creature = document.querySelector('.pet-creature');
    if (creature) creature.classList.add('drop-target-hint');

    // Haptic feedback (if available)
    if (navigator.vibrate) navigator.vibrate(30);
}

function moveFoodDrag(x, y) {
    if (!_dragState) return;
    _dragState.ghost.style.left = x + 'px';
    _dragState.ghost.style.top = y + 'px';

    // Check proximity to dog — highlight if close
    const creature = document.querySelector('.pet-creature');
    if (creature) {
        const rect = creature.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        const isNear = dist < Math.max(80, rect.width * 0.8);
        creature.classList.toggle('drop-target-near', isNear);
    }
}

function endFoodDrag() {
    if (!_dragState) return;
    const { ghost, foodId, item } = _dragState;

    // Check if dropped on dog
    const creature = document.querySelector('.pet-creature');
    if (creature) {
        const rect = creature.getBoundingClientRect();
        const ghostRect = ghost.getBoundingClientRect();
        const gx = ghostRect.left + ghostRect.width / 2;
        const gy = ghostRect.top + ghostRect.height / 2;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(gx - cx, gy - cy);

        creature.classList.remove('drop-target-hint', 'drop-target-near');

        if (dist < Math.max(80, rect.width * 0.8)) {
            // SUCCESS — feed the dog!
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            ghost.remove();
            buyFood(foodId, item);
        } else {
            // MISS — snap back
            ghost.classList.add('snap-back');
            setTimeout(() => ghost.remove(), 300);
        }
    } else {
        ghost.remove();
    }

    _dragState = null;
}

// ─── Drag-to-Reposition Accessories on Pet ───
let _accDragState = null;

function initAccDrag() {
    const accEls = document.querySelectorAll('.draggable-pet-acc');
    accEls.forEach(el => {
        el.addEventListener('touchstart', onAccPetTouchStart, { passive: false });
        el.addEventListener('mousedown', onAccPetMouseDown);
    });
}

function onAccPetTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    startAccPetDrag(e.currentTarget, touch.clientX, touch.clientY);

    const onMove = (ev) => {
        ev.preventDefault();
        moveAccPetDrag(ev.touches[0].clientX, ev.touches[0].clientY);
    };
    const onEnd = () => {
        endAccPetDrag();
        document.removeEventListener('touchmove', onMove);
        document.removeEventListener('touchend', onEnd);
    };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
}

function onAccPetMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    startAccPetDrag(e.currentTarget, e.clientX, e.clientY);

    const onMove = (ev) => moveAccPetDrag(ev.clientX, ev.clientY);
    const onUp = () => {
        endAccPetDrag();
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function startAccPetDrag(el, x, y) {
    const wrapper = el.closest('.pet-wrapper');
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();

    _accDragState = {
        el,
        accId: el.dataset.accId,
        wrapperRect
    };

    el.classList.add('acc-dragging');
    if (navigator.vibrate) navigator.vibrate(20);
}

function moveAccPetDrag(x, y) {
    if (!_accDragState) return;
    const { el, wrapperRect } = _accDragState;

    // Convert screen coords to percentage within wrapper, clamped to bounds
    const pctLeft = Math.max(0, Math.min(100, (x - wrapperRect.left) / wrapperRect.width * 100));
    const pctTop = Math.max(-10, Math.min(110, (y - wrapperRect.top) / wrapperRect.height * 100));

    el.style.left = pctLeft + '%';
    el.style.top = pctTop + '%';
    el.style.transform = 'translate(-50%, -50%)';
}

function endAccPetDrag() {
    if (!_accDragState) return;
    const { el, accId } = _accDragState;

    el.classList.remove('acc-dragging');

    // Save position as percentages
    const finalLeft = parseFloat(el.style.left);
    const finalTop = parseFloat(el.style.top);

    if (!appState.accPositions) appState.accPositions = {};
    appState.accPositions[accId] = {
        top: finalTop + '%',
        left: finalLeft + '%'
    };
    saveUserData(currentUser, appState);

    _accDragState = null;
}

// ==================== DRAG-TO-TRASH POOP SYSTEM ====================

let _poopDragState = null;

function initPoopDrag() {
    const poopEls = document.querySelectorAll('.pet-poop');
    poopEls.forEach(el => {
        el.addEventListener('touchstart', onPoopTouchStart, { passive: false });
        el.addEventListener('mousedown', onPoopMouseDown);
    });
}

function onPoopTouchStart(e) {
    e.preventDefault();
    e.stopPropagation();
    const touch = e.touches[0];
    startPoopDrag(e.currentTarget, touch.clientX, touch.clientY);

    const onMove = (ev) => { ev.preventDefault(); movePoopDrag(ev.touches[0].clientX, ev.touches[0].clientY); };
    const onEnd = () => { endPoopDrag(); document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onEnd); };
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
}

function onPoopMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    startPoopDrag(e.currentTarget, e.clientX, e.clientY);

    const onMove = (ev) => movePoopDrag(ev.clientX, ev.clientY);
    const onUp = () => { endPoopDrag(); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function startPoopDrag(el, x, y) {
    const poopId = el.dataset.poopId;
    const ghost = document.createElement('div');
    ghost.className = 'drag-poop-ghost';
    ghost.textContent = '💩';
    ghost.style.left = x + 'px';
    ghost.style.top = y + 'px';
    document.body.appendChild(ghost);

    _poopDragState = { ghost, poopId, el, startX: x, startY: y };
    el.style.opacity = '0.3';

    const trash = document.getElementById('petTrashBtn');
    if (trash) trash.classList.add('trash-drop-hint');

    if (navigator.vibrate) navigator.vibrate(30);
}

function movePoopDrag(x, y) {
    if (!_poopDragState) return;
    _poopDragState.ghost.style.left = x + 'px';
    _poopDragState.ghost.style.top = y + 'px';

    const trash = document.getElementById('petTrashBtn');
    if (trash) {
        const rect = trash.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(x - cx, y - cy);
        trash.classList.toggle('trash-drop-near', dist < 60);
    }
}

function endPoopDrag() {
    if (!_poopDragState) return;
    const { ghost, poopId, el } = _poopDragState;

    const trash = document.getElementById('petTrashBtn');
    if (trash) {
        const rect = trash.getBoundingClientRect();
        const ghostRect = ghost.getBoundingClientRect();
        const gx = ghostRect.left + ghostRect.width / 2;
        const gy = ghostRect.top + ghostRect.height / 2;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(gx - cx, gy - cy);

        trash.classList.remove('trash-drop-hint', 'trash-drop-near');

        if (dist < 60) {
            if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
            ghost.remove();
            cleanPoop(poopId, el);
        } else {
            el.style.opacity = '1';
            ghost.classList.add('snap-back');
            setTimeout(() => ghost.remove(), 300);
        }
    } else {
        el.style.opacity = '1';
        ghost.remove();
    }

    _poopDragState = null;
}

function cleanPoop(poopId, poopEl) {
    appState.petPoops = (appState.petPoops || []).filter(p => p.id !== poopId);

    appState.coins = (appState.coins || 0) + POOP_CLEAN_COINS;
    const oldLevel = appState.dogLevel || 1;
    appState.dogGrowthXP = (appState.dogGrowthXP || 0) + POOP_CLEAN_XP;
    appState.dogLevel = getDogLevel(appState.dogGrowthXP);
    saveUserData(currentUser, appState);

    if (navigator.vibrate) navigator.vibrate(30);

    if (poopEl) {
        poopEl.classList.add('poop-cleaning');
        setTimeout(() => poopEl.remove(), 400);
    }
    fireCleanBurst();

    const phrase = POOP_CLEAN_PHRASES[Math.floor(Math.random() * POOP_CLEAN_PHRASES.length)];
    setTimeout(() => showPetSpeechBubble(phrase), 300);
    showToast('✨ +' + POOP_CLEAN_COINS + ' 🪙 +' + POOP_CLEAN_XP + ' XP!');

    if (appState.dogLevel > oldLevel) {
        setTimeout(() => { try { showLevelUpCelebration(appState.dogLevel, oldLevel); } catch(e) {} }, 800);
    }

    setTimeout(() => renderWordPet(), 500);
}

function fireCleanBurst() {
    const stage = document.querySelector('.pet-hero-stage');
    if (!stage) return;
    const old = stage.querySelector('.clean-burst');
    if (old) old.remove();
    const burst = document.createElement('div');
    burst.className = 'clean-burst';
    const particles = ['✨','🌟','⭐','💫','🧹','🫧'];
    const offsets = [
        { x: '-35px', y: '-45px', delay: '0s',    dur: '0.7s' },
        { x: '35px',  y: '-50px', delay: '0.05s', dur: '0.75s' },
        { x: '-55px', y: '-25px', delay: '0.1s',  dur: '0.8s' },
        { x: '55px',  y: '-20px', delay: '0.05s', dur: '0.7s' },
        { x: '0px',   y: '-60px', delay: '0.12s', dur: '0.85s' },
        { x: '-20px', y: '-55px', delay: '0.08s', dur: '0.9s' }
    ];
    offsets.forEach((o, i) => {
        const s = document.createElement('span');
        s.textContent = particles[i % particles.length];
        s.style.setProperty('--fly-x', o.x);
        s.style.setProperty('--fly-y', o.y);
        s.style.setProperty('--fly-delay', o.delay);
        s.style.setProperty('--fly-dur', o.dur);
        burst.appendChild(s);
    });
    stage.appendChild(burst);
    setTimeout(() => burst.remove(), 1200);
}

function onPetTap() {
    const creature = document.querySelector('.pet-creature');
    if (!creature) return;
    // Squish animation
    creature.classList.remove('pet-tapped');
    void creature.offsetWidth;
    creature.classList.add('pet-tapped');
    setTimeout(() => creature.classList.remove('pet-tapped'), 500);
    // Heart burst particles
    fireHeartBurst();

    const mood = getPetMood();
    const srsWords = appState.srs ? Object.keys(appState.srs) : [];

    // Poop cleanup nudge (40% chance when poops exist)
    const poopCount = (appState.petPoops || []).length;
    if (poopCount > 0 && Math.random() < 0.4) {
        const nudges = [
            "It's a bit messy… drag the 💩 to the 🗑️!",
            "Eww, stinky! Help me clean! 😅",
            "My home needs cleaning! 🧹",
            poopCount >= 3 ? "So much poop! I can barely breathe! 😫" : "Drag the 💩 to the 🗑️!"
        ];
        showPetSpeechBubble(nudges[Math.floor(Math.random() * nudges.length)]);
        return;
    }

    // Near level-up check
    const level = appState.dogLevel || 1;
    if (level < 100) {
        const currentXP = appState.dogGrowthXP || 0;
        const nextLevelXP = getPointsForLevel(level + 1);
        const currentLevelXP = getPointsForLevel(level);
        const progress = (currentXP - currentLevelXP) / (nextLevelXP - currentLevelXP);
        if (progress >= 0.8) {
            showPetSpeechBubble("I can feel myself growing! Almost there! 🌟");
            return;
        }
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
    const target = document.getElementById('petHeroStage') || document.getElementById('petContainer');
    if (target) target.appendChild(bubble);
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
