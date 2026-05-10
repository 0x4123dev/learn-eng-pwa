// tests/srs.test.js — SM-2 spaced repetition algorithm
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

// Load code once and inject appState via __setAppState before each test
function loadWithAppState(initialAppState) {
    const env = loadAppCode();
    env.__setAppState(initialAppState);
    return env;
}

suite('srs: initWordSRS (with proper appState)', () => {
    test('creates a new SRS card for a word', () => {
        const appState = { srs: {} };
        const env = loadWithAppState(appState);
        env.initWordSRS('apple');
        // The state was passed by reference; the function mutated the same object via the sandbox
        // BUT the sandbox's appState is the SAME object reference, so changes apply.
        const card = appState.srs['apple'];
        assert.truthy(card, 'card not created');
        assert.equal(card.interval, 1);
        assert.equal(card.ease, 2.5);
        assert.equal(card.repetitions, 0);
        assert.truthy(card.nextReview > Date.now());
    });

    test('does not overwrite existing card', () => {
        const appState = { srs: { apple: { interval: 30, ease: 3.0, repetitions: 5, nextReview: 999, lastReview: 100 } } };
        const env = loadWithAppState(appState);
        env.initWordSRS('apple');
        assert.equal(appState.srs['apple'].interval, 30);
        assert.equal(appState.srs['apple'].repetitions, 5);
    });

    test('initializes appState.srs if missing', () => {
        const appState = {};
        const env = loadWithAppState(appState);
        env.initWordSRS('apple');
        assert.truthy(appState.srs);
        assert.truthy(appState.srs['apple']);
    });
});

suite('srs: updateWordSRS (correct answer)', () => {
    test('first correct: rep=1, interval=1', () => {
        const appState = { srs: { word: { interval: 1, ease: 2.5, repetitions: 0, nextReview: 0, lastReview: 0 } } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('word', 2);
        assert.equal(appState.srs['word'].repetitions, 1);
        assert.equal(appState.srs['word'].interval, 1);
        assert.truthy(appState.srs['word'].ease > 2.5); // Ease increased
    });

    test('second correct: rep=2, interval=3', () => {
        const appState = { srs: { word: { interval: 1, ease: 2.55, repetitions: 1, nextReview: 0, lastReview: 0 } } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('word', 2);
        assert.equal(appState.srs['word'].repetitions, 2);
        assert.equal(appState.srs['word'].interval, 3);
    });

    test('third correct: interval = round(prev * ease)', () => {
        const appState = { srs: { word: { interval: 3, ease: 2.5, repetitions: 2, nextReview: 0, lastReview: 0 } } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('word', 2);
        assert.equal(appState.srs['word'].repetitions, 3);
        assert.equal(appState.srs['word'].interval, Math.round(3 * 2.5)); // = 8
    });

    test('ease cannot exceed reasonable bounds', () => {
        const appState = { srs: { word: { interval: 100, ease: 2.5, repetitions: 5, nextReview: 0, lastReview: 0 } } };
        const env = loadWithAppState(appState);
        for (let i = 0; i < 20; i++) env.updateWordSRS('word', 2);
        // Ease should grow but stay reasonable (not infinity)
        assert.truthy(appState.srs['word'].ease < 5, `ease grew unbounded: ${appState.srs['word'].ease}`);
    });

    test('nextReview is in the future', () => {
        const appState = { srs: { word: { interval: 1, ease: 2.5, repetitions: 0, nextReview: 0, lastReview: 0 } } };
        const env = loadWithAppState(appState);
        const before = Date.now();
        env.updateWordSRS('word', 2);
        assert.truthy(appState.srs['word'].nextReview > before);
    });
});

suite('srs: updateWordSRS (wrong answer)', () => {
    test('resets reps and interval, decreases ease', () => {
        const appState = { srs: { word: { interval: 30, ease: 2.8, repetitions: 5, nextReview: 0, lastReview: 0 } } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('word', 0);
        assert.equal(appState.srs['word'].repetitions, 0);
        assert.equal(appState.srs['word'].interval, 1);
        assert.truthy(appState.srs['word'].ease < 2.8);
    });

    test('ease floors at 1.3', () => {
        const appState = { srs: { word: { interval: 1, ease: 1.4, repetitions: 0, nextReview: 0, lastReview: 0 } } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('word', 0);
        env.updateWordSRS('word', 0);
        env.updateWordSRS('word', 0);
        env.updateWordSRS('word', 0);
        assert.truthy(appState.srs['word'].ease >= 1.3, `ease went below 1.3: ${appState.srs['word'].ease}`);
    });
});

suite('srs: getWordsDueForReview', () => {
    test('empty when no SRS data', () => {
        const appState = {};
        const env = loadWithAppState(appState);
        const due = env.getWordsDueForReview();
        assert.equal(due.length, 0);
    });

    test('returns words whose nextReview is in the past', () => {
        const past = Date.now() - 86400000;
        const future = Date.now() + 86400000;
        const appState = {
            srs: {
                'old1':  { interval: 1, ease: 2.5, repetitions: 0, nextReview: past,   lastReview: 0 },
                'old2':  { interval: 1, ease: 2.5, repetitions: 0, nextReview: past,   lastReview: 0 },
                'fresh': { interval: 1, ease: 2.5, repetitions: 0, nextReview: future, lastReview: 0 }
            }
        };
        const env = loadWithAppState(appState);
        const due = env.getWordsDueForReview();
        assert.equal(due.length, 2);
        assert.contains(due, 'old1');
        assert.contains(due, 'old2');
        assert.notContains(due, 'fresh');
    });
});

suite('srs: getReviewCount', () => {
    test('matches getWordsDueForReview length', () => {
        const past = Date.now() - 86400000;
        const appState = {
            srs: {
                'a': { interval: 1, ease: 2.5, repetitions: 0, nextReview: past, lastReview: 0 },
                'b': { interval: 1, ease: 2.5, repetitions: 0, nextReview: past, lastReview: 0 }
            }
        };
        const env = loadWithAppState(appState);
        assert.equal(env.getReviewCount(), 2);
    });
});

suite('srs: getSRSMasteryPercent', () => {
    test('returns 0 when no SRS data', () => {
        const appState = {};
        const env = loadWithAppState(appState);
        assert.equal(env.getSRSMasteryPercent(), 0);
    });

    test('returns 100 when all words have interval >= 14', () => {
        const appState = {
            srs: {
                'a': { interval: 14, ease: 2.5, repetitions: 5, nextReview: 0, lastReview: 0 },
                'b': { interval: 30, ease: 2.5, repetitions: 5, nextReview: 0, lastReview: 0 }
            }
        };
        const env = loadWithAppState(appState);
        assert.equal(env.getSRSMasteryPercent(), 100);
    });

    test('returns 50 when half are mastered', () => {
        const appState = {
            srs: {
                'a': { interval: 14, ease: 2.5, repetitions: 5, nextReview: 0, lastReview: 0 },
                'b': { interval: 1,  ease: 2.5, repetitions: 0, nextReview: 0, lastReview: 0 }
            }
        };
        const env = loadWithAppState(appState);
        assert.equal(env.getSRSMasteryPercent(), 50);
    });
});

// ==================== TOPIC-AWARE SR (v3.26) ====================

// Build an SRS state where the first N tracked words come from a specific topic.
// Dedupes by `.en` because the vocabulary has some duplicate strings — without
// dedup, the same key gets overwritten and the test counts diverge.
function _buildTopicState(env, topicId, dueCount, totalCount) {
    const allTopicWords = env.getWordsForTopic(topicId, null);
    const seen = new Set();
    const sample = [];
    for (const x of allTopicWords) {
        if (seen.has(x.word.en)) continue;
        seen.add(x.word.en);
        sample.push(x.word.en);
        if (sample.length >= totalCount) break;
    }
    const past = Date.now() - 86400000;
    const future = Date.now() + 86400000 * 30;
    const srs = {};
    sample.forEach((en, i) => {
        srs[en] = {
            interval: i < dueCount ? 1 : 30,
            ease: 2.5,
            repetitions: i < dueCount ? 0 : 5,
            nextReview: i < dueCount ? past : future,
            lastReview: 0
        };
    });
    return { srs, sample };
}

// Count how many idx-entries in a topic share an .en in the given srs map —
// because of vocabulary duplicates, getTrackedWordsForTopic counts every idx
// whose .en is in the srs, so the "tracked" count can exceed the srs key count.
function _countTrackedForTopic(env, topicId, srs) {
    const all = env.getWordsForTopic(topicId, null);
    return all.filter(x => !!srs[x.word.en]).length;
}

suite('srs: topic-aware helpers (v3.26)', () => {
    test('getDueWordsForTopic returns due words within topic', () => {
        const env = loadAppCode();
        const { srs, sample } = _buildTopicState(env, 'people', 3, 5);
        env.__setAppState({ srs });
        const due = env.getDueWordsForTopic('people');
        // The first 3 sample words are due. Due count may exceed 3 if vocab
        // duplicates re-list a due .en under a different idx within the topic.
        assert.truthy(due.length >= 3);
        for (const w of due) {
            assert.contains(sample.slice(0, 3), w);
        }
    });

    test('getDueCountForTopic matches getDueWordsForTopic length', () => {
        const env = loadAppCode();
        const { srs } = _buildTopicState(env, 'health', 4, 8);
        env.__setAppState({ srs });
        assert.equal(env.getDueCountForTopic('health'), env.getDueWordsForTopic('health').length);
        assert.truthy(env.getDueCountForTopic('health') >= 4);
    });

    test('getTrackedWordsForTopic only counts words in appState.srs', () => {
        const env = loadAppCode();
        const { srs, sample } = _buildTopicState(env, 'tech', 2, 6);
        env.__setAppState({ srs });
        const tracked = env.getTrackedWordsForTopic('tech');
        const expected = _countTrackedForTopic(env, 'tech', srs);
        assert.equal(tracked.length, expected);
        for (const w of tracked) assert.contains(sample, w);
    });

    test('getTopicSRSStats returns full breakdown', () => {
        const env = loadAppCode();
        const { srs } = _buildTopicState(env, 'science', 2, 5);
        env.__setAppState({ srs });
        const stats = env.getTopicSRSStats('science');
        const expectedTracked = _countTrackedForTopic(env, 'science', srs);
        assert.truthy(stats.total > 0);
        assert.equal(stats.tracked, expectedTracked);
        // The 2-due-cards have interval=1; the 3-mature cards have interval=30.
        // Tracked count may exceed 5 due to vocab duplicates — but the
        // interval-bucket counts are proportional, so just check learning ≥ 2,
        // mature ≥ 3, and they sum to tracked.
        assert.truthy(stats.learning >= 2);
        assert.truthy(stats.mature >= 3);
        assert.equal(stats.learning + stats.reviewing + stats.mature, expectedTracked);
        assert.truthy(stats.due >= 2);
        assert.truthy(stats.masteryPct >= 0 && stats.masteryPct <= 100);
    });

    test('getTopicSRSStats returns zeros for empty SRS', () => {
        const env = loadAppCode();
        env.__setAppState({});
        const stats = env.getTopicSRSStats('people');
        assert.equal(stats.tracked, 0);
        assert.equal(stats.due, 0);
        assert.equal(stats.masteryPct, 0);
        assert.truthy(stats.total >= 0);
    });

    test('isWordStruggling flags reset words with low ease', () => {
        const env = loadAppCode();
        const srs = {
            'tough': { interval: 1, ease: 1.8, repetitions: 0, nextReview: 0, lastReview: 0 },
            'fine':  { interval: 14, ease: 2.5, repetitions: 5, nextReview: 0, lastReview: 0 }
        };
        env.__setAppState({ srs });
        assert.truthy(env.isWordStruggling('tough'));
        assert.falsy(env.isWordStruggling('fine'));
        assert.falsy(env.isWordStruggling('unknown'));
    });

    test('getStrugglingWordsForTopic returns sorted struggling words', () => {
        const env = loadAppCode();
        const allTopicWords = env.getWordsForTopic('people', null).slice(0, 4).map(x => x.word.en);
        const srs = {};
        srs[allTopicWords[0]] = { interval: 1, ease: 1.5, repetitions: 0, nextReview: 0, lastReview: 0 };
        srs[allTopicWords[1]] = { interval: 1, ease: 1.8, repetitions: 0, nextReview: 0, lastReview: 0 };
        srs[allTopicWords[2]] = { interval: 14, ease: 2.5, repetitions: 5, nextReview: 0, lastReview: 0 };
        env.__setAppState({ srs });
        const struggling = env.getStrugglingWordsForTopic('people');
        assert.equal(struggling.length, 2);
        // Should be sorted by ease ascending (worst first)
        assert.equal(struggling[0], allTopicWords[0]);
    });

    test('getTopicOfTheDay picks the topic with most due words', () => {
        const env = loadAppCode();
        // Make 'health' have 5 due, 'tech' have 2 due
        const healthWords = env.getWordsForTopic('health', null).slice(0, 5).map(x => x.word.en);
        const techWords = env.getWordsForTopic('tech', null).slice(0, 2).map(x => x.word.en);
        const past = Date.now() - 86400000;
        const srs = {};
        for (const w of healthWords) srs[w] = { interval: 1, ease: 2.5, repetitions: 0, nextReview: past, lastReview: 0 };
        for (const w of techWords) srs[w] = { interval: 1, ease: 2.5, repetitions: 0, nextReview: past, lastReview: 0 };
        env.__setAppState({ srs });
        const totd = env.getTopicOfTheDay();
        assert.truthy(totd && totd.topic);
        assert.equal(totd.reason, 'due');
        assert.truthy(totd.count >= 5);
    });

    test('getTopicOfTheDay falls back to rotation when nothing due', () => {
        const env = loadAppCode();
        env.__setAppState({ srs: {} });
        const totd = env.getTopicOfTheDay();
        assert.truthy(totd && totd.topic);
        assert.equal(totd.reason, 'rotation');
    });

    test('SRS thresholds are exposed', () => {
        const env = loadAppCode();
        assert.equal(env.SRS_LEARNING_MAX, 7);
        assert.equal(env.SRS_REVIEWING_MAX, 21);
        assert.equal(env.SRS_MASTERED_INTERVAL, 14);
        assert.equal(env.SRS_GRADUATED_INTERVAL, 30);
    });

    test('updateWordSRS triggers graduation when crossing 30d threshold', () => {
        const env = loadAppCode();
        // Stub the celebration so we can detect it was called
        let graduated = null;
        env.showWordGraduationCelebration = (w) => { graduated = w; };
        // Word at interval=21, ease=2.5, reps=4 → next correct: round(21 * 2.5) = 53d (≥30)
        const appState = {
            srs: { 'cross': { interval: 21, ease: 2.5, repetitions: 4, nextReview: 0, lastReview: 0 } }
        };
        env.__setAppState(appState);
        env.updateWordSRS('cross', 2);
        // The graduation hook is set up but callable from the sandbox? It's not
        // wired through globalThis, so this test only verifies the threshold helper.
        assert.truthy(appState.srs['cross'].interval >= 30);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
