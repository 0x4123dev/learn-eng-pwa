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
        _startTime: Date.now(),
        comboChain: 0,
        maxCombo: 0
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById('lessonScreen').classList.add('active');

    // Preload pronunciation audio for all lesson words
    preloadLessonAudio(lessonWords);

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
    // The screen and the checkpoint change together (js/app.js).
    if (typeof saveStudyCheckpoint === 'function') saveStudyCheckpoint();
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

        // Reduce mistake count only during review sessions
        if (lessonState.isPracticeSession) {
            reduceMistake(left.word);
        }

        // Combo chain
        lessonState.comboChain = Math.min((lessonState.comboChain || 0) + 1, 5);
        if (lessonState.comboChain > (lessonState.maxCombo || 0)) {
            lessonState.maxCombo = lessonState.comboChain;
        }
        if (lessonState.comboChain >= 2) {
            showComboIndicator(lessonState.comboChain);
        }
        if (lessonState.comboChain >= 5) {
            unlockAchievement('combo-5');
        }

        // Points based on difficulty level
        const difficulty = getDifficultyLevel(lessonState.lessonNumber);
        const pointMultipliers = {
            'Beginning': 1,
            'Basic': 1,
            'Intermediate': 1.5,
            'Upper-Intermediate': 2,
            'Advanced': 2.5
        };
        const basePoints = 10;
        const comboMultiplier = lessonState.comboChain >= 2 ? lessonState.comboChain : 1;
        const points = Math.round(basePoints * (pointMultipliers[difficulty.name] || 1) * comboMultiplier);
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

        // Combo break
        if (lessonState.comboChain >= 2) {
            showComboBreak();
        }
        lessonState.comboChain = 0;

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
    // The lesson is over from here on: the × must stop asking whether to throw
    // away work that has just been scored and paid for.
    if (lessonState) lessonState.finished = true;
    // And the bottom bar comes back with the result: a finished lesson must
    // never keep the child locked in. Every road out from here (Continue,
    // Collect!, a nav tab) is silent — switchScreen sees lessonLeaveQuestion()
    // answer null and just clears the overlay through abandonLesson().
    const _nav = document.getElementById('bottomNav');
    if (_nav) _nav.style.display = 'flex';

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
        const _prevPointsR = appState.points;
        appState.points += lessonState.lessonPoints;
        saveUserData(currentUser, appState);

        // Pet hooks
        if (typeof feedPet === 'function') feedPet(20);
        if (typeof checkQuestCompletion === 'function') checkQuestCompletion('srs');

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

    // This is the ONLY place the hidden gem is ever mentioned. Nothing marks the
// lesson beforehand, so the whole reward is this moment — it has to land.
//
// It deliberately does NOT say "replay it for more". The gem still pays every
// time, but a child told that farms one lesson and skips the other 42, which
// is exactly what hiding it was meant to prevent.
function _showTopicBonusReward(bonus, levelBefore) {
    const after = (typeof appState !== 'undefined' && appState) ? (appState.dogLevel || 1) : 1;
    const grew = after > (levelBefore || 1);

    const sub = document.getElementById('completeSubtitle');
    if (sub) {
        sub.innerHTML = `💎 <b>HIDDEN GEM FOUND!</b><br><b>+${bonus.coins}</b> 🪙 and <b>+${bonus.xp}</b> XP`
            + (grew ? `<br>🎉 Your dog reached <b>level ${after}</b>!` : '')
            + `<br><span class="topic-bonus-again">Lucky you! Keep exploring — who knows what else is out there.</span>`;
    }
    if (typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
    // The celebration owns the screen, so let the completion card land first.
    if (grew && typeof showLevelUpCelebration === 'function') {
        setTimeout(() => { try { showLevelUpCelebration(after, levelBefore); } catch (e) {} }, 1200);
    }
}

// Handle practice session differently
    if (lessonState.isPracticeSession) {
        const _prevPointsP = appState.points;
        appState.points += lessonState.lessonPoints;

        // ── Save topic-lesson progress ──
        if (lessonState.isTopicLesson && lessonState.topicId && lessonState.topicChunkIdx !== undefined) {
            if (!appState.topicProgress) appState.topicProgress = {};
            if (!appState.topicProgress[lessonState.topicId]) appState.topicProgress[lessonState.topicId] = {};
            const prevBest = appState.topicProgress[lessonState.topicId][lessonState.topicChunkIdx];
            const newRecord = { mistakes: lessonState.wrongInLesson, accuracy, date: Date.now() };
            // Only overwrite if this attempt was better (fewer mistakes) or first time
            if (!prevBest || newRecord.mistakes <= prevBest.mistakes) {
                appState.topicProgress[lessonState.topicId][lessonState.topicChunkIdx] = newRecord;
            }
        }
        // ── The hidden gem ──
        // One unmarked lesson pays a jackpot (see TOPIC_BONUS_LESSON in
        // js/topics.js). Nothing advertises it: a child finds it by working
        // through the topic and getting lucky. Awarded before saveUserData so
        // a child who closes the app the instant the screen appears keeps it.
        let _bonus = null;
        if (typeof isBonusTopicLesson === 'function' && lessonState.isTopicLesson
            && isBonusTopicLesson(lessonState.topicId, lessonState.topicChunkIdx)) {
            _bonus = TOPIC_BONUS_LESSON;
            const _lvlBefore = appState.dogLevel || 1;
            appState.coins = (appState.coins || 0) + _bonus.coins;
            appState.dogGrowthXP = (appState.dogGrowthXP || 0) + _bonus.xp;
            if (typeof getDogLevel === 'function') appState.dogLevel = getDogLevel(appState.dogGrowthXP);
            lessonState._bonusLevelBefore = _lvlBefore;
        }

        saveUserData(currentUser, appState);

        // Pet hooks
        if (typeof feedPet === 'function') feedPet(40);

        document.getElementById('completePoints').textContent = `+${lessonState.lessonPoints}`;
        document.getElementById('completeAccuracy').textContent = `${accuracy}%`;

        if (accuracy === 100) {
            document.getElementById('completeSubtitle').textContent = lessonState.isTopicLesson ? 'Topic lesson complete! 🎉' : 'Perfect review!';
            createConfetti();
        } else {
            document.getElementById('completeSubtitle').textContent = lessonState.isTopicLesson
                ? `${lessonState.wrongInLesson} mistake${lessonState.wrongInLesson !== 1 ? 's' : ''} this round`
                : 'Mistakes reviewed!';
        }

        // LAST, on purpose: both branches above write completeSubtitle, so a
        // reward announced before them is overwritten a line later and the
        // child sees "2 mistakes this round" instead of their 1000 coins.
        if (_bonus) _showTopicBonusReward(_bonus, lessonState._bonusLevelBefore);

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
        sec: typeof ActivityClock !== 'undefined' ? ActivityClock.take() : undefined,
        points: lessonState.lessonPoints,
        accuracy: accuracy
    });

    // Sync activity to the server (best-effort) so the admin sees it.
    if (typeof EngAuth !== 'undefined') EngAuth.syncNow();

    // Advance currentLesson only if this is the next sequential lesson
    if (lessonState.lessonNumber === (appState.currentLesson || 0)) {
        appState.currentLesson = lessonState.lessonNumber + 1;
    }

    const _prevPointsL = appState.points;
    appState.points += lessonState.lessonPoints;

    // Coin earning for dog pet
    const _coinDifficulty = getDifficultyLevel(lessonState.lessonNumber);
    const _coinMultipliers = { 'Beginning': 1, 'Basic': 1, 'Intermediate': 1.5, 'Upper-Intermediate': 2, 'Advanced': 2.5 };
    let _coinsEarned = 10; // Base coins
    if (accuracy >= 80) _coinsEarned += 5; // Accuracy bonus
    if (accuracy === 100) _coinsEarned += 10; // Perfect bonus (total +15 for 100%)
    if ((appState.streak || 0) >= 7) _coinsEarned += 10; // Big streak bonus
    else if ((appState.streak || 0) >= 3) _coinsEarned += 5; // Small streak bonus
    _coinsEarned = Math.round(_coinsEarned * (_coinMultipliers[_coinDifficulty.name] || 1));
    appState.coins = (appState.coins || 0) + _coinsEarned;
    lessonState._coinsEarned = _coinsEarned; // Store for display

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

    // Pet memory: track lessons together with pet
    if (!appState.petMemory) appState.petMemory = { lessonsTogether: 0, milestonesSeen: [] };
    appState.petMemory.lessonsTogether = (appState.petMemory.lessonsTogether || 0) + 1;
    // Trigger pet milestone speech for round numbers (10, 25, 50, 100, ...)
    const _petMilestones = [10, 25, 50, 100, 200, 500, 1000];
    const _hitMilestone = _petMilestones.find(m =>
        appState.petMemory.lessonsTogether === m &&
        !(appState.petMemory.milestonesSeen || []).includes(m)
    );
    if (_hitMilestone) {
        if (!appState.petMemory.milestonesSeen) appState.petMemory.milestonesSeen = [];
        appState.petMemory.milestonesSeen.push(_hitMilestone);
        if (typeof showPetSpeechBubble === 'function') {
            setTimeout(() => showPetSpeechBubble(`${_hitMilestone} lessons together! I'm so proud of you! 🎉`), 1800);
        }
    }

    saveUserData(currentUser, appState);

    // Pet hooks
    if (typeof feedPet === 'function') feedPet(40);
    if (typeof checkQuestCompletion === 'function') checkQuestCompletion('lesson', { accuracy });

    // Check sticker unlocks
    if (typeof checkStickerUnlocks === 'function') checkStickerUnlocks();

    // Daily challenge completion
    if (lessonState.isDailyChallenge && typeof completeDailyChallenge === 'function') {
        completeDailyChallenge();
        return;
    }

    // Show difficulty bonus info
    const difficulty = getDifficultyLevel(lessonState.lessonNumber);
    const multipliers = { 'Beginning': '1x', 'Basic': '1x', 'Intermediate': '1.5x', 'Upper-Intermediate': '2x', 'Advanced': '2.5x' };
    const bonusText = (difficulty.name !== 'Basic' && difficulty.name !== 'Beginning') ? ` (${multipliers[difficulty.name]} ${difficulty.name})` : '';

    // Offer sentence builder for good performance on regular lessons
    if (!lessonState.isPracticeSession && !lessonState.isReviewSession &&
        (accuracy >= 80 || accuracy === 100) &&
        typeof offerSentenceBuilder === 'function') {
        offerSentenceBuilder(lessonState.words, lessonState.lessonPoints, accuracy, bonusText);
        return;
    }

    showLessonCompleteUI(lessonState.lessonPoints, accuracy, bonusText);
}

function showComboIndicator(combo) {
    const existing = document.querySelector('.combo-indicator');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'combo-indicator';
    el.textContent = `${combo}x COMBO!`;
    el.style.setProperty('--combo-scale', 1 + combo * 0.15);
    document.querySelector('.lesson-content').appendChild(el);
    setTimeout(() => el.remove(), 1200);
}

function showComboBreak() {
    const existing = document.querySelector('.combo-break');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'combo-break';
    el.textContent = 'SNAP!';
    document.querySelector('.lesson-content').appendChild(el);
    setTimeout(() => el.remove(), 800);
}

function showLessonCompleteUI(points, accuracy, bonusText) {
    document.getElementById('completePoints').textContent = `+${points}`;
    document.getElementById('completeAccuracy').textContent = `${accuracy}%`;

    if (accuracy === 100) {
        document.getElementById('completeSubtitle').textContent = `Perfect score!${bonusText}`;
        createConfetti();
    } else if (accuracy >= 80) {
        document.getElementById('completeSubtitle').textContent = `Great job!${bonusText}`;
    } else {
        document.getElementById('completeSubtitle').textContent = `Keep practicing!${bonusText}`;
    }

    // Show coins earned
    const coinsEarned = lessonState._coinsEarned || 0;
    if (coinsEarned > 0) {
        const coinEl = document.getElementById('completeCoins');
        if (coinEl) {
            coinEl.textContent = `+${coinsEarned} 🪙`;
            coinEl.style.display = 'block';
        }
    }

    // Show streak bonus label
    const _streakBonus = (appState.streak || 0) >= 7 ? 10 : (appState.streak || 0) >= 3 ? 5 : 0;
    const streakEl = document.getElementById('completeStreakBonus');
    if (streakEl) {
        if (_streakBonus > 0) {
            streakEl.textContent = `🔥 Streak bonus: +${_streakBonus} 🪙`;
            streakEl.style.display = 'block';
        } else {
            streakEl.style.display = 'none';
        }
    }

    document.getElementById('lessonComplete').classList.add('active');

    // Offer Word Chant for qualifying lessons
    if (!lessonState.isPracticeSession && !lessonState.isReviewSession &&
        accuracy >= 60 && typeof addChantButtonToLessonComplete === 'function') {
        addChantButtonToLessonComplete(lessonState.words);
    }
}

// The × in the lesson header used to call exitLesson() straight out: half a
// lesson gone on one tap, nothing saved and nothing said. It asks now — but
// only when there is work to lose, and never once the lesson is over, because
// exitLesson() is ALSO how a finished lesson closes (the Continue button below
// and js/daily-challenge.js both call it) and the coins are already banked.
function quitLesson() {
    const q = lessonLeaveQuestion();
    if (q && typeof confirm === 'function' && !confirm(q)) return;
    exitLesson();
}

// The question the × and js/app.js switchScreen both ask, or null when there
// is nothing to ask: nothing answered yet, or the lesson already scored. One
// place, so the two exits can never disagree.
function lessonLeaveQuestion() {
    const st = (typeof lessonState !== 'undefined') ? lessonState : null;
    if (!st || st.finished) return null;
    const done = (st.correctInLesson || 0) + (st.wrongInLesson || 0);
    if (!done) return null;
    return 'You are ' + done + ' questions into this lesson.\n'
        + 'If you leave now, this lesson will not be saved.\n\nLeave anyway?';
}

// A matching round of any flavour (Home lesson, SRS review, mistakes review,
// daily challenge, topic lesson) is showing — scored or not. The result
// overlays (lessonComplete, the sentence builder, the treasure chest) sit on
// the lesson screen too, so this stays true until the child has actually left.
function isLessonOnScreen() {
    const screen = (typeof document !== 'undefined') ? document.getElementById('lessonScreen') : null;
    if (!screen || !screen.classList.contains('active')) return false;
    const st = (typeof lessonState !== 'undefined') ? lessonState : null;
    return !!(st && Array.isArray(st.roundWords) && st.roundWords.length);
}

// …and not yet scored. The same shape as isGrammarQuizActive / isExamActive,
// for js/app.js's list of things a child would lose.
function isLessonActive() {
    return isLessonOnScreen() && !lessonState.finished;
}

// Tear the lesson down WITHOUT navigating — switchScreen has already decided
// where the child is going and only needs the lesson out of the way: every
// result overlay off, the bottom bar back, the state emptied so no checkpoint
// can offer this round again and nothing scores it twice.
function abandonLesson() {
    _dropLessonOverlays();
    const nav = document.getElementById('bottomNav');
    if (nav) nav.style.display = 'flex';
    _forgetLessonState();
}

function _dropLessonOverlays() {
    ['lessonComplete', 'sentenceBuilderOverlay', 'treasureOverlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    _resetLessonCompleteUI();
}

function _resetLessonCompleteUI() {
    const coinEl = document.getElementById('completeCoins');
    if (coinEl) { coinEl.style.display = 'none'; coinEl.textContent = '+0 🪙'; }
    const streakBonusEl = document.getElementById('completeStreakBonus');
    if (streakBonusEl) { streakBonusEl.style.display = 'none'; }
}

// The same empty shape js/app.js forgetProfileState() leaves behind:
// roundWords is empty, so buildStudyCheckpoint() sees nothing to save.
function _forgetLessonState() {
    lessonState = {
        categoryId: null, lessonNumber: 0, words: [], currentRound: 0, totalRounds: 0,
        roundWords: [], selectedLeft: null, selectedRight: null, matchedPairs: 0,
        correctInLesson: 0, wrongInLesson: 0, lessonPoints: 0,
    };
    if (typeof clearStudyCheckpoint === 'function') { try { clearStudyCheckpoint(); } catch (e) {} }
}

function exitLesson() {
    document.getElementById('bottomNav').style.display = 'flex';
    document.getElementById('lessonScreen').classList.remove('active');
    // Whatever result card was up leaves with the lesson — Continue and
    // Collect! remove their own first, but the × does not, and a fixed
    // overlay that outlives its screen is a locked app.
    _dropLessonOverlays();
    // Topic lessons return to that topic's detail (so user can quickly start next lesson)
    if (lessonState && lessonState.isTopicLesson) {
        document.getElementById('topicsScreen').classList.add('active');
        const topicId = lessonState.topicId;
        _forgetLessonState();
        // Re-open the topic detail OR fall back to topics home
        if (topicId && topicId !== '__review__' && typeof openTopicDetail === 'function') {
            openTopicDetail(topicId);
        } else if (topicId === '__review__' && typeof openReviewDetail === 'function') {
            openReviewDetail();
        } else if (typeof renderTopicsHome === 'function') {
            renderTopicsHome();
        }
        return;
    }
    _forgetLessonState();
    document.getElementById('homeScreen').classList.add('active');
    renderHome();
}

function closeLessonComplete() {
    document.getElementById('lessonComplete').classList.remove('active');
    _resetLessonCompleteUI();

    // Continue → go straight to the NEXT unfinished lesson in the same topic
    // (never repeat the lesson just finished). Falls through when the topic is
    // fully done, or for review / shuffle lessons.
    if (lessonState && lessonState.isTopicLesson && lessonState.topicId &&
        lessonState.topicId !== '__review__' && lessonState.topicChunkIdx !== undefined &&
        typeof _nextUnfinishedChunk === 'function' && typeof startTopicLessonChunk === 'function') {
        const topicId = lessonState.topicId;
        const nextIdx = _nextUnfinishedChunk(topicId, lessonState.topicChunkIdx);
        if (nextIdx >= 0) { startTopicLessonChunk(topicId, nextIdx); return; }
    }
    exitLesson();
}
