// srs.js - Spaced Repetition System (SM-2 algorithm)
// SRS_WORDS_PER_REVIEW declared in app.js

function initWordSRS(wordEn) {
    if (!appState.srs) appState.srs = {};
    if (appState.srs[wordEn]) return; // Already tracked
    appState.srs[wordEn] = {
        interval: 1,       // Days until next review
        ease: 2.5,         // Ease factor (SM-2)
        repetitions: 0,    // Successful reviews in a row
        nextReview: Date.now() + 86400000, // Tomorrow
        lastReview: Date.now()
    };
}

function updateWordSRS(wordEn, quality) {
    // quality: 0 = wrong, 2 = correct (simplified SM-2)
    if (!appState.srs || !appState.srs[wordEn]) return;
    const card = appState.srs[wordEn];
    card.lastReview = Date.now();

    if (quality === 0) {
        // Wrong: reset interval, decrease ease
        card.repetitions = 0;
        card.interval = 1;
        card.ease = Math.max(1.3, card.ease - 0.2);
    } else {
        // Correct: advance interval
        card.repetitions++;
        if (card.repetitions === 1) {
            card.interval = 1;
        } else if (card.repetitions === 2) {
            card.interval = 3;
        } else {
            card.interval = Math.round(card.interval * card.ease);
        }
        card.ease = Math.max(1.3, card.ease + 0.05);
    }
    card.nextReview = Date.now() + card.interval * 86400000;
}

function getWordsDueForReview() {
    if (!appState || !appState.srs) return [];
    const now = Date.now();
    return Object.keys(appState.srs).filter(word => appState.srs[word].nextReview <= now);
}

function getReviewCount() {
    return getWordsDueForReview().length;
}

function getSRSMasteryPercent() {
    if (!appState || !appState.srs) return 0;
    const words = Object.values(appState.srs);
    if (words.length === 0) return 0;
    // A word is "mastered" if interval >= 14 days
    const mastered = words.filter(w => w.interval >= 14).length;
    return Math.round((mastered / words.length) * 100);
}

function startReviewSession() {
    const dueWords = getWordsDueForReview();
    if (dueWords.length === 0) {
        showToast('No words due for review!');
        return;
    }

    // Pick up to SRS_WORDS_PER_REVIEW words
    const reviewWordNames = shuffleArray([...dueWords]).slice(0, SRS_WORDS_PER_REVIEW);
    const reviewWords = reviewWordNames.map(en => ieltsVocabulary.find(w => w.en === en)).filter(Boolean);

    if (reviewWords.length < 2) {
        showToast('Not enough words for review');
        return;
    }

    lessonState = {
        lessonNumber: -2, // Special marker for review session
        words: reviewWords,
        currentRound: 0,
        totalRounds: 1,
        roundWords: reviewWords,
        selectedLeft: null,
        selectedRight: null,
        matchedPairs: 0,
        correctInLesson: 0,
        wrongInLesson: 0,
        lessonPoints: 0,
        isReviewSession: true,
        reviewWrongWords: new Set()
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('lessonScreen').classList.add('active');
    document.getElementById('homeScreen').classList.remove('active');

    renderMatchingRound();
}
