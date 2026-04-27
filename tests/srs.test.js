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

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
