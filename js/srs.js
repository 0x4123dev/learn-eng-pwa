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
    const oldInterval = card.interval;
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

    // Mastery graduation event — celebrate when a word first crosses ≥30d.
    if (typeof _checkGraduation === 'function' &&
        _checkGraduation(wordEn, oldInterval, card.interval)) {
        if (typeof showWordGraduationCelebration === 'function') {
            showWordGraduationCelebration(wordEn);
        }
    }
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

// ==================== TOPIC-AWARE SR HELPERS (v3.26) ====================

// SRS interval thresholds defining the three "stacks" a word can be in:
//   Learning:    just started (interval < 7 days)
//   Reviewing:   getting consolidated (7 ≤ interval < 21 days)
//   Mature:      retained long-term (interval ≥ 21 days, "mastered" at ≥14)
const SRS_LEARNING_MAX = 7;
const SRS_REVIEWING_MAX = 21;
const SRS_MASTERED_INTERVAL = 14; // visible "mastered" threshold
const SRS_GRADUATED_INTERVAL = 30; // celebration threshold

// A word is "struggling" if it has been reset (repetitions=0) but the user has
// touched it at least twice — i.e., they keep getting it wrong.
function isWordStruggling(wordEn) {
    if (!appState || !appState.srs) return false;
    const card = appState.srs[wordEn];
    if (!card) return false;
    return card.repetitions === 0 && card.ease <= 2.0; // ease drops on each fail
}

// Filter a list of word-names down to those due for review now.
function _filterDueByList(words) {
    if (!appState || !appState.srs) return [];
    const now = Date.now();
    return words.filter(w => {
        const c = appState.srs[w];
        return c && c.nextReview <= now;
    });
}

// Returns { en } words from a topic that are tracked AND due now.
// Depends on getWordsForTopic() which returns [{ word, idx }, ...].
function getDueWordsForTopic(topicId) {
    if (typeof getWordsForTopic !== 'function') return [];
    const all = getWordsForTopic(topicId, null).map(x => x.word.en);
    return _filterDueByList(all);
}

function getDueCountForTopic(topicId) {
    return getDueWordsForTopic(topicId).length;
}

// Tracked words = words from this topic that the user has answered at least
// once (so they exist in appState.srs).
function getTrackedWordsForTopic(topicId) {
    if (!appState || !appState.srs) return [];
    if (typeof getWordsForTopic !== 'function') return [];
    return getWordsForTopic(topicId, null)
        .map(x => x.word.en)
        .filter(en => !!appState.srs[en]);
}

// Full breakdown for a topic — used by topic cards and the review hub.
// Returns { total, tracked, due, learning, reviewing, mature, struggling, masteryPct }
function getTopicSRSStats(topicId) {
    const total = (typeof getWordsForTopic === 'function')
        ? getWordsForTopic(topicId, null).length : 0;
    if (!appState || !appState.srs) {
        return { total, tracked: 0, due: 0, learning: 0, reviewing: 0, mature: 0, struggling: 0, masteryPct: 0 };
    }
    const trackedWords = getTrackedWordsForTopic(topicId);
    const now = Date.now();
    let due = 0, learning = 0, reviewing = 0, mature = 0, struggling = 0;
    for (const w of trackedWords) {
        const c = appState.srs[w];
        if (!c) continue;
        if (c.nextReview <= now) due++;
        if (c.interval < SRS_LEARNING_MAX) learning++;
        else if (c.interval < SRS_REVIEWING_MAX) reviewing++;
        else mature++;
        if (isWordStruggling(w)) struggling++;
    }
    // Mastery is share of TOTAL topic words that are mature — long-term goal.
    const masteryPct = total > 0 ? Math.round((mature / total) * 100) : 0;
    return {
        total, tracked: trackedWords.length, due,
        learning, reviewing, mature, struggling, masteryPct
    };
}

// Words that are likely "leeches" — repeatedly got wrong. Sorted by struggle severity.
function getStrugglingWordsForTopic(topicId) {
    if (typeof getWordsForTopic !== 'function') return [];
    if (!appState || !appState.srs) return [];
    const all = getWordsForTopic(topicId, null).map(x => x.word.en);
    return all
        .filter(w => isWordStruggling(w))
        .sort((a, b) => (appState.srs[a].ease || 2.5) - (appState.srs[b].ease || 2.5));
}

// Pick a "topic of the day" — the topic with the most due words today.
// Falls back to the topic with the most struggling words, then a daily-rotated
// topic if nothing is due.
function getTopicOfTheDay() {
    if (typeof TOPICS === 'undefined') return null;
    let bestDue = null, bestDueCount = 0;
    let bestStruggle = null, bestStruggleCount = 0;
    for (const t of TOPICS) {
        const stats = getTopicSRSStats(t.id);
        if (stats.due > bestDueCount) { bestDue = t; bestDueCount = stats.due; }
        if (stats.struggling > bestStruggleCount) { bestStruggle = t; bestStruggleCount = stats.struggling; }
    }
    if (bestDue) return { topic: bestDue, reason: 'due', count: bestDueCount };
    if (bestStruggle) return { topic: bestStruggle, reason: 'struggling', count: bestStruggleCount };
    // Fallback: rotate by day-of-year
    const day = Math.floor(Date.now() / 86400000);
    const t = TOPICS[day % TOPICS.length];
    return { topic: t, reason: 'rotation', count: 0 };
}

// Start a review session of words due in a SPECIFIC topic.
// Reuses the existing review-session UI by overriding lessonState.
function startTopicReviewSession(topicId, mode) {
    let pool = [];
    if (mode === 'struggling') {
        pool = getStrugglingWordsForTopic(topicId);
    } else if (mode === 'learning') {
        pool = getTrackedWordsForTopic(topicId).filter(w =>
            appState.srs[w].interval < SRS_LEARNING_MAX);
    } else if (mode === 'reviewing') {
        pool = getTrackedWordsForTopic(topicId).filter(w => {
            const i = appState.srs[w].interval;
            return i >= SRS_LEARNING_MAX && i < SRS_REVIEWING_MAX;
        });
    } else if (mode === 'mature') {
        pool = getTrackedWordsForTopic(topicId).filter(w =>
            appState.srs[w].interval >= SRS_REVIEWING_MAX);
    } else {
        // default: all due in this topic
        pool = getDueWordsForTopic(topicId);
    }
    if (pool.length < 2) {
        if (typeof showToast === 'function') showToast('Not enough words for this review yet');
        return;
    }
    const reviewWordNames = shuffleArray([...pool]).slice(0, SRS_WORDS_PER_REVIEW);
    const reviewWords = reviewWordNames.map(en => ieltsVocabulary.find(w => w.en === en)).filter(Boolean);
    if (reviewWords.length < 2) return;

    lessonState = {
        lessonNumber: -2,
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
        reviewWrongWords: new Set(),
        comboChain: 0,
        maxCombo: 0,
        topicReviewMeta: { topicId, mode: mode || 'due' }
    };
    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('lessonScreen').classList.add('active');
    document.getElementById('topicsScreen').classList.remove('active');
    document.getElementById('homeScreen').classList.remove('active');
    if (typeof preloadLessonAudio === 'function') preloadLessonAudio(reviewWords);
    if (typeof renderMatchingRound === 'function') renderMatchingRound();
}

// Detect a graduation event — called from the SRS update wrapper.
// Returns true if the word just transitioned across the graduation threshold.
function _checkGraduation(wordEn, oldInterval, newInterval) {
    return oldInterval < SRS_GRADUATED_INTERVAL && newInterval >= SRS_GRADUATED_INTERVAL;
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
        reviewWrongWords: new Set(),
        comboChain: 0,
        maxCombo: 0
    };

    document.getElementById('bottomNav').style.display = 'none';
    document.getElementById('lessonScreen').classList.add('active');
    document.getElementById('homeScreen').classList.remove('active');

    preloadLessonAudio(reviewWords);
    renderMatchingRound();
}
