// tests/review.test.js — Review (mistake) grouping logic
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

function load(appState) {
    const env = loadAppCode();
    env.__setAppState(appState);
    return env;
}

suite('getReviewLessonGroups', () => {
    test('returns empty array when no mistakes', () => {
        const env = load({ mistakes: [] });
        assert.equal(env.getReviewLessonGroups().length, 0);
    });

    test('chunks mistakes into groups of 5', () => {
        const env = load({
            mistakes: Array.from({ length: 12 }, (_, i) => ({
                word: `word${i}`, count: 1, firstMistake: 0, lastMistake: 0
            }))
        });
        const groups = env.getReviewLessonGroups();
        assert.equal(groups.length, 3); // 5 + 5 + 2
        assert.equal(groups[0].length, 5);
        assert.equal(groups[1].length, 5);
        assert.equal(groups[2].length, 2);
    });

    test('mistakes are sorted by count desc (most-wrong first)', () => {
        const env = load({
            mistakes: [
                { word: 'low',  count: 1, firstMistake: 0, lastMistake: 0 },
                { word: 'high', count: 5, firstMistake: 0, lastMistake: 0 },
                { word: 'mid',  count: 3, firstMistake: 0, lastMistake: 0 }
            ]
        });
        const groups = env.getReviewLessonGroups();
        assert.equal(groups[0][0].word, 'high');
        assert.equal(groups[0][1].word, 'mid');
        assert.equal(groups[0][2].word, 'low');
    });

    test('handles single mistake correctly', () => {
        const env = load({
            mistakes: [{ word: 'only', count: 1, firstMistake: 0, lastMistake: 0 }]
        });
        const groups = env.getReviewLessonGroups();
        assert.equal(groups.length, 1);
        assert.equal(groups[0].length, 1);
    });
});

suite('getNextPracticeLesson: cycle through lessons', () => {
    test('returns first lesson if none practiced', () => {
        const env = load({ lessonHistory: [] });
        const range = { start: 0, end: 23 };
        const next = env.getNextPracticeLesson(range);
        assert.equal(next, 0);
    });

    test('returns oldest practiced lesson', () => {
        const env = load({
            lessonHistory: [
                { lessonNum: 0, date: 1000 }, // very old
                { lessonNum: 1, date: 5000 },
                { lessonNum: 2, date: 4000 },
                { lessonNum: 3, date: 3000 }
            ]
        });
        const range = { start: 0, end: 4 };
        const next = env.getNextPracticeLesson(range);
        assert.equal(next, 0); // oldest = lesson 0
    });

    test('returns lesson never practiced before practiced ones', () => {
        const env = load({
            lessonHistory: [
                { lessonNum: 0, date: 5000 },
                { lessonNum: 1, date: 5000 }
            ]
        });
        const range = { start: 0, end: 5 };
        const next = env.getNextPracticeLesson(range);
        // Lessons 2, 3, 4 never practiced → date 0 → oldest
        // Implementation should prefer one of them
        assert.truthy(next === 2 || next === 3 || next === 4);
    });

    test('respects range bounds', () => {
        const env = load({ lessonHistory: [] });
        const range = { start: 10, end: 15 };
        const next = env.getNextPracticeLesson(range);
        assert.inRange(next, 10, 14);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
