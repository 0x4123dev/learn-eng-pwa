// lessons.js - Matching game logic and lesson management

function resetProgress() {
    if (confirm('Are you sure you want to reset all progress? This cannot be undone.')) {
        appState.currentLesson = 0;
        appState.lessonHistory = [];
        appState.points = 0;
        appState.lessonsCompleted = 0;
        appState.achievements = [];
        appState.mistakes = [];
        saveUserData(currentUser, appState);
        renderHome();
        renderProfile();
        showToast('Progress reset!');
    }
}

function startLesson(lessonNum) {
    const startIdx = lessonNum * WORDS_PER_LESSON;
    const lessonWords = ieltsVocabulary.slice(startIdx, startIdx + WORDS_PER_LESSON);

    // If not enough words, wrap around (shouldn't happen with 1000 words)
    if (lessonWords.length < WORDS_PER_LESSON) {
        const remaining = WORDS_PER_LESSON - lessonWords.length;
        lessonWords.push(...ieltsVocabulary.slice(0, remaining));
    }

    lessonState = {
        lessonNumber: lessonNum,
        words: lessonWords,
        currentRound: 0,
        totalRounds: 1,
        roundWords: lessonWords,
        selectedLeft: null,
        selectedRight: null,
        matchedPairs: 0,
        correctInLesson: 0,
        wrongInLesson: 0,
        lessonPoints: 0,
        _startTime: Date.now()
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('lessonScreen').classList.add('active');
    document.getElementById('homeScreen').classList.remove('active');

    renderMatchingRound();
}

function renderMatchingRound() {
    const words = lessonState.roundWords;

    const progress = (lessonState.matchedPairs / words.length) * 100;
    document.getElementById('lessonProgress').style.width = `${progress}%`;
    document.getElementById('lessonPointsDisplay').textContent = lessonState.lessonPoints;

    const leftItems = shuffleArray([...words]);
    const rightItems = shuffleArray([...words]);

    const leftCol = document.getElementById('leftColumn');
    const rightCol = document.getElementById('rightColumn');

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';

    leftItems.forEach((word) => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.dataset.word = word.en;
        card.dataset.side = 'left';
        card.innerHTML = `
            <span class="card-emoji">${word.emoji || '📝'}</span>
            <span class="card-vi">${word.vi}</span>
        `;
        card.onclick = () => selectCard(card, 'left', word.en);
        leftCol.appendChild(card);
    });

    rightItems.forEach((word) => {
        const card = document.createElement('div');
        card.className = 'match-card';
        card.dataset.word = word.en;
        card.dataset.side = 'right';
        card.innerHTML = `
            <span class="card-speaker" onclick="event.stopPropagation(); speakWord('${word.en}')">🔊</span>
            <span class="card-en">${word.en}</span>
            <span class="card-ipa">${word.ipa}</span>
        `;
        card.onclick = () => {
            speakWord(word.en); // Speak word when selecting
            selectCard(card, 'right', word.en);
        };
        rightCol.appendChild(card);
    });

    lessonState.selectedLeft = null;
    lessonState.selectedRight = null;
}

function selectCard(card, side, word) {
    if (card.classList.contains('matched')) return;

    const sameColumn = document.querySelectorAll(`.match-card[data-side="${side}"]`);
    sameColumn.forEach(c => c.classList.remove('selected'));

    card.classList.add('selected');

    if (side === 'left') {
        lessonState.selectedLeft = { card, word };
    } else {
        lessonState.selectedRight = { card, word };
    }

    if (lessonState.selectedLeft && lessonState.selectedRight) {
        checkMatch();
    }
}

function checkMatch() {
    const left = lessonState.selectedLeft;
    const right = lessonState.selectedRight;

    appState.totalAnswers++;

    if (left.word === right.word) {
        left.card.classList.remove('selected');
        right.card.classList.remove('selected');
        left.card.classList.add('matched');
        right.card.classList.add('matched');

        lessonState.matchedPairs++;
        lessonState.correctInLesson++;
        appState.totalCorrect++;

        // Reduce mistake count when correctly matched
        reduceMistake(left.word);

        // Points based on difficulty level
        const difficulty = getDifficultyLevel(lessonState.lessonNumber);
        const pointMultipliers = {
            'Basic': 1,
            'Intermediate': 1.5,
            'Upper-Intermediate': 2,
            'Advanced': 2.5
        };
        const basePoints = 10;
        const points = Math.round(basePoints * (pointMultipliers[difficulty.name] || 1));
        lessonState.lessonPoints += points;
        document.getElementById('lessonPointsDisplay').textContent = lessonState.lessonPoints;

        const progress = (lessonState.matchedPairs / lessonState.roundWords.length) * 100;
        document.getElementById('lessonProgress').style.width = `${progress}%`;

        if (lessonState.matchedPairs >= lessonState.roundWords.length) {
            setTimeout(() => {
                completeLesson();
            }, 500);
        }
    } else {
        left.card.classList.add('wrong');
        right.card.classList.add('wrong');
        lessonState.wrongInLesson++;

        // Track both words as mistakes
        trackMistake(left.word);
        trackMistake(right.word);

        // Track wrong words during SRS review
        if (lessonState.isReviewSession && lessonState.reviewWrongWords) {
            lessonState.reviewWrongWords.add(left.word);
            lessonState.reviewWrongWords.add(right.word);
        }

        setTimeout(() => {
            left.card.classList.remove('wrong', 'selected');
            right.card.classList.remove('wrong', 'selected');
        }, 600);
    }

    lessonState.selectedLeft = null;
    lessonState.selectedRight = null;
    saveUserData(currentUser, appState);
}

function trackMistake(word) {
    if (!appState.mistakes) appState.mistakes = [];

    const existing = appState.mistakes.find(m => m.word === word);
    if (existing) {
        existing.count++;
        existing.lastMistake = Date.now();
    } else {
        appState.mistakes.push({
            word: word,
            count: 1,
            firstMistake: Date.now(),
            lastMistake: Date.now()
        });
    }
}

function reduceMistake(word) {
    if (!appState.mistakes) return;

    const index = appState.mistakes.findIndex(m => m.word === word);
    if (index !== -1) {
        appState.mistakes[index].count--;
        if (appState.mistakes[index].count <= 0) {
            appState.mistakes.splice(index, 1);
        }
    }
}

function completeLesson() {
    recordStudy();

    const accuracy = Math.round((lessonState.correctInLesson / (lessonState.correctInLesson + lessonState.wrongInLesson)) * 100);

    // Handle SRS review session
    if (lessonState.isReviewSession) {
        // Update SRS data for each reviewed word
        lessonState.words.forEach(w => {
            const quality = lessonState.reviewWrongWords && lessonState.reviewWrongWords.has(w.en) ? 0 : 2;
            updateWordSRS(w.en, quality);
        });

        // Track review count
        if (!appState.reviewsCompleted) appState.reviewsCompleted = 0;
        appState.reviewsCompleted += lessonState.words.length;
        appState.points += lessonState.lessonPoints;
        saveUserData(currentUser, appState);

        // Check SRS achievements
        unlockAchievement('srs-first');
        if (appState.reviewsCompleted >= 50) unlockAchievement('srs-reviewer');
        if (appState.reviewsCompleted >= 200) unlockAchievement('srs-master');

        // Mastery achievements
        const mastery = getSRSMasteryPercent();
        if (mastery >= 50) unlockAchievement('srs-mastery-50');
        if (mastery >= 100) unlockAchievement('srs-mastery-100');

        document.getElementById('completePoints').textContent = `+${lessonState.lessonPoints}`;
        document.getElementById('completeAccuracy').textContent = `${accuracy}%`;

        const remaining = getReviewCount();
        if (accuracy === 100) {
            document.getElementById('completeSubtitle').textContent = remaining > 0
                ? `Perfect! ${remaining} more word${remaining !== 1 ? 's' : ''} to review`
                : 'Perfect! All caught up!';
            createConfetti();
        } else {
            document.getElementById('completeSubtitle').textContent = remaining > 0
                ? `${remaining} more word${remaining !== 1 ? 's' : ''} to review`
                : 'All caught up!';
        }

        document.getElementById('lessonComplete').classList.add('active');
        return;
    }

    // Handle practice session differently
    if (lessonState.isPracticeSession) {
        appState.points += lessonState.lessonPoints;
        saveUserData(currentUser, appState);

        document.getElementById('completePoints').textContent = `+${lessonState.lessonPoints}`;
        document.getElementById('completeAccuracy').textContent = `${accuracy}%`;

        if (accuracy === 100) {
            document.getElementById('completeSubtitle').textContent = 'Perfect review!';
            createConfetti();
        } else {
            document.getElementById('completeSubtitle').textContent = 'Mistakes reviewed!';
        }

        document.getElementById('lessonComplete').classList.add('active');
        return;
    }

    // Check if this lesson was already completed before
    if (!appState.lessonHistory) appState.lessonHistory = [];
    const alreadyCompleted = appState.lessonHistory.some(h => h.lessonNum === lessonState.lessonNumber);

    // Add to lesson history
    appState.lessonHistory.push({
        lessonNum: lessonState.lessonNumber,
        date: Date.now(),
        points: lessonState.lessonPoints,
        accuracy: accuracy
    });

    // Advance currentLesson only if this is the next sequential lesson
    if (lessonState.lessonNumber === (appState.currentLesson || 0)) {
        appState.currentLesson = lessonState.lessonNumber + 1;
    }

    appState.points += lessonState.lessonPoints;

    // Only increment lessonsCompleted if this was a new lesson (not a re-learn)
    if (!alreadyCompleted) {
        appState.lessonsCompleted++;
    }

    // Check achievements - Lessons
    if (appState.lessonsCompleted >= 1) unlockAchievement('first-lesson');
    if (appState.lessonsCompleted >= 5) unlockAchievement('lessons-5');
    if (appState.lessonsCompleted >= 10) unlockAchievement('lessons-10');
    if (appState.lessonsCompleted >= 25) unlockAchievement('lessons-25');
    if (appState.lessonsCompleted >= 50) unlockAchievement('lessons-50');
    if (appState.lessonsCompleted >= 100) unlockAchievement('lessons-100');
    if (appState.currentLesson >= TOTAL_LESSONS) unlockAchievement('all-lessons');

    // Points
    if (appState.points >= 100) unlockAchievement('points-100');
    if (appState.points >= 500) unlockAchievement('points-500');
    if (appState.points >= 1000) unlockAchievement('points-1000');
    if (appState.points >= 5000) unlockAchievement('points-5000');

    // Accuracy
    if (lessonState.wrongInLesson === 0) {
        unlockAchievement('perfect');
        // Track consecutive perfect lessons
        if (!appState.perfectCount) appState.perfectCount = 0;
        appState.perfectCount++;
        if (appState.perfectCount >= 3) unlockAchievement('perfect-3');
        if (appState.perfectCount >= 10) unlockAchievement('perfect-10');
    }

    // Total correct answers
    if (appState.totalCorrect >= 100) unlockAchievement('correct-100');
    if (appState.totalCorrect >= 500) unlockAchievement('correct-500');

    // Word collection (unique words learned via SRS)
    const srsWordCount = appState.srs ? Object.keys(appState.srs).length : 0;
    if (srsWordCount >= 50) unlockAchievement('word-collector-50');
    if (srsWordCount >= 200) unlockAchievement('word-collector-200');
    if (srsWordCount >= 500) unlockAchievement('word-collector-500');

    // Speed demon - completed lesson in under 30 seconds
    if (lessonState._startTime && (Date.now() - lessonState._startTime) < 30000) {
        unlockAchievement('speed-demon');
    }

    // Initialize SRS tracking for all words in this lesson
    lessonState.words.forEach(w => initWordSRS(w.en));

    saveUserData(currentUser, appState);

    // Show difficulty bonus info
    const difficulty = getDifficultyLevel(lessonState.lessonNumber);
    const multipliers = { 'Basic': '1x', 'Intermediate': '1.5x', 'Upper-Intermediate': '2x', 'Advanced': '2.5x' };
    const bonusText = difficulty.name !== 'Basic' ? ` (${multipliers[difficulty.name]} ${difficulty.name})` : '';

    document.getElementById('completePoints').textContent = `+${lessonState.lessonPoints}`;
    document.getElementById('completeAccuracy').textContent = `${accuracy}%`;

    if (accuracy === 100) {
        document.getElementById('completeSubtitle').textContent = `Perfect score!${bonusText}`;
        createConfetti();
    } else if (accuracy >= 80) {
        document.getElementById('completeSubtitle').textContent = `Great job!${bonusText}`;
    } else {
        document.getElementById('completeSubtitle').textContent = `Keep practicing!${bonusText}`;
    }

    document.getElementById('lessonComplete').classList.add('active');
}

function exitLesson() {
    document.getElementById('bottomNav').style.display = 'flex';
    document.getElementById('lessonScreen').classList.remove('active');
    document.getElementById('homeScreen').classList.add('active');
    renderHome();
}

function closeLessonComplete() {
    document.getElementById('lessonComplete').classList.remove('active');
    exitLesson();
}
