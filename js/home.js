// home.js - Home screen rendering, history, mistakes, and difficulty filtering

function renderHome() {
    if (!appState) return;

    document.getElementById('homeAvatar').textContent = appState.avatar || '😊';
    document.getElementById('homeUsername').textContent = appState.username;
    document.getElementById('homePoints').textContent = appState.points;
    document.getElementById('homeStreak').textContent = appState.streak;
    document.getElementById('homeLessons').textContent = `${appState.currentLesson || 0}/${TOTAL_LESSONS}`;

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
                <span class="difficulty-band">IELTS Band ${difficulty.band}</span>
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
    renderWordOfDay();
    if (typeof renderDailyChallenge === 'function') renderDailyChallenge();
    if (typeof renderBattleCard === 'function') renderBattleCard();
    if (typeof renderWordHuntCard === 'function') renderWordHuntCard();

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
        const filterName = selectedDifficultyFilter.charAt(0).toUpperCase() + selectedDifficultyFilter.slice(1);
        historyContainer.innerHTML = `<div class="empty-history">No ${filterName} lessons completed yet</div>`;
        return;
    }

    // Show last 15 lessons, most recent first
    const recentHistory = history.slice(-15).reverse();

    let html = '<div class="history-table">';
    recentHistory.forEach((item, index) => {
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

    historyContainer.innerHTML = html;
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

function getDifficultyLevel(lessonNum) {
    // Dynamic calculation based on total lessons
    // Split into 4 equal parts
    const lessonsPerLevel = Math.ceil(TOTAL_LESSONS / 4);

    if (lessonNum < lessonsPerLevel) {
        return { name: 'Basic', key: 'basic', icon: '🌱', band: '5-6', color: '#58cc02' };
    } else if (lessonNum < lessonsPerLevel * 2) {
        return { name: 'Intermediate', key: 'intermediate', icon: '🌿', band: '6-7', color: '#1cb0f6' };
    } else if (lessonNum < lessonsPerLevel * 3) {
        return { name: 'Upper-Intermediate', key: 'upper', icon: '🌳', band: '7-8', color: '#ff9600' };
    } else {
        return { name: 'Advanced', key: 'advanced', icon: '⭐', band: '8-9', color: '#ce82ff' };
    }
}

function getLessonRangeForDifficulty(difficultyKey) {
    const lessonsPerLevel = Math.ceil(TOTAL_LESSONS / 4);
    switch (difficultyKey) {
        case 'basic': return { start: 0, end: lessonsPerLevel };
        case 'intermediate': return { start: lessonsPerLevel, end: lessonsPerLevel * 2 };
        case 'upper': return { start: lessonsPerLevel * 2, end: lessonsPerLevel * 3 };
        case 'advanced': return { start: lessonsPerLevel * 3, end: TOTAL_LESSONS };
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

    // Update tab active states
    document.querySelectorAll('.difficulty-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`.difficulty-tab[data-level="${level}"]`).classList.add('active');

    // Re-render home with filtered content
    renderHome();
}

function updateDifficultyCounts() {
    const lessonsPerLevel = Math.ceil(TOTAL_LESSONS / 4);

    document.getElementById('countBasic').textContent = lessonsPerLevel;
    document.getElementById('countIntermediate').textContent = lessonsPerLevel;
    document.getElementById('countUpper').textContent = lessonsPerLevel;
    document.getElementById('countAdvanced').textContent = TOTAL_LESSONS - (lessonsPerLevel * 3);
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
function getPetStage(points) {
    if (points >= 5000) return { emoji: '🐉', name: 'Dragon' };
    if (points >= 2000) return { emoji: '🦅', name: 'Phoenix' };
    if (points >= 500) return { emoji: '🐦', name: 'Bird' };
    if (points >= 100) return { emoji: '🐣', name: 'Chick' };
    return { emoji: '🥚', name: 'Egg' };
}

function getPetMood() {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (appState.lastStudyDate === today) return 'happy';
    if (appState.lastStudyDate === yesterday) return 'neutral';
    return 'sleepy';
}

function renderWordPet() {
    const container = document.getElementById('petContainer');
    if (!container) return;
    const pet = getPetStage(appState.points);
    const mood = getPetMood();
    container.innerHTML = `
        <div class="pet-creature ${mood}" onclick="onPetTap()">${pet.emoji}</div>
        <div class="pet-name">${pet.name}</div>
    `;
}

function onPetTap() {
    const creature = document.querySelector('.pet-creature');
    if (!creature) return;
    creature.classList.add('wiggle');
    setTimeout(() => creature.classList.remove('wiggle'), 600);

    // Show a random learned word
    const srsWords = appState.srs ? Object.keys(appState.srs) : [];
    if (srsWords.length > 0) {
        const randomWord = srsWords[Math.floor(Math.random() * srsWords.length)];
        const wordData = ieltsVocabulary.find(w => w.en === randomWord);
        if (wordData) {
            showPetSpeechBubble(`${wordData.emoji} ${wordData.en}`);
            speakWord(wordData.en);
        }
    }
}

function showPetSpeechBubble(text) {
    const existing = document.querySelector('.pet-bubble');
    if (existing) existing.remove();
    const bubble = document.createElement('div');
    bubble.className = 'pet-bubble';
    bubble.textContent = text;
    document.getElementById('petContainer').appendChild(bubble);
    setTimeout(() => bubble.remove(), 2000);
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
            renderWordOfDay();
        } else {
            renderPanel();
        }
    };

    renderPanel();
    overlay.classList.add('active');
    speakWord(word.en);
}
