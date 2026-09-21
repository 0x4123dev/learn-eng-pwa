// tests/recap.test.js — Weekly recap math and snapshot generation
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

suite('getWeekStart: returns Sunday ISO date', () => {
    test('Wednesday returns previous Sunday', () => {
        // 2025-01-15 was a Wednesday
        const wed = new Date('2025-01-15T12:00:00');
        const start = env.getWeekStart(wed);
        // The previous Sunday was 2025-01-12
        assert.equal(start, '2025-01-12');
    });

    test('Sunday returns same day', () => {
        const sun = new Date('2025-01-12T12:00:00');
        assert.equal(env.getWeekStart(sun), '2025-01-12');
    });

    test('Saturday returns previous Sunday', () => {
        const sat = new Date('2025-01-18T12:00:00');
        assert.equal(env.getWeekStart(sat), '2025-01-12');
    });

    test('result is always YYYY-MM-DD format', () => {
        for (let i = 0; i < 30; i++) {
            const d = new Date(2025, 0, i + 1);
            const start = env.getWeekStart(d);
            assert.truthy(/^\d{4}-\d{2}-\d{2}$/.test(start), `bad format: ${start}`);
        }
    });
});

suite('formatWeekRange: human-readable range', () => {
    test('returns string with both dates', () => {
        const r = env.formatWeekRange('2025-01-12');
        assert.truthy(r.includes('Jan'), `missing Jan: ${r}`);
        assert.truthy(r.includes('12'), `missing 12: ${r}`);
        assert.truthy(r.includes('18'), `missing 18: ${r}`);
    });

    test('handles month transitions', () => {
        const r = env.formatWeekRange('2025-01-26'); // Sun Jan 26 - Sat Feb 1
        assert.truthy(r.includes('Jan'));
        assert.truthy(r.includes('Feb'));
    });
});

suite('generateWeeklyRecap: snapshot content', () => {
    test('returns expected fields', () => {
        env.__setAppState({ unitsHistory: [], streak: 0 });
        const recap = env.generateWeeklyRecap('2025-01-12');
        assert.truthy('weekStart' in recap);
        assert.truthy('weekEnd' in recap);
        assert.truthy('xpEarned' in recap);
        assert.truthy('lessonsCompleted' in recap);
        assert.truthy('perfectLessons' in recap);
        assert.truthy('wordsLearned' in recap);
        assert.truthy('daysActive' in recap);
        assert.truthy('dayMap' in recap);
        assert.truthy(Array.isArray(recap.dayMap));
        assert.equal(recap.dayMap.length, 7);
    });

    test('counts lessons within the week range', () => {
        // 2025-01-12 (Sun) → 2025-01-19 (start of next week)
        const sun = new Date('2025-01-12T12:00:00').getTime();
        const tue = new Date('2025-01-14T12:00:00').getTime();
        const sat = new Date('2025-01-18T12:00:00').getTime();
        const beforeWeek = new Date('2025-01-11T12:00:00').getTime();
        const afterWeek = new Date('2025-01-20T12:00:00').getTime();

        env.__setAppState({
            unitsHistory: [
                { unit: 'pr1-1', date: sun, score: 20, total: 20, wrong: [] },
                { unit: 'pr1-2', date: tue, score: 10, total: 12, wrong: ['a', 'b'] },
                { unit: 'pr2-mix', date: sat, score: 15, total: 15, wrong: [] },
                { unit: 'pr1-3', date: beforeWeek, score: 99, total: 99, wrong: [] },
                { unit: 'pr1-4', date: afterWeek,  score: 99, total: 99, wrong: [] }
            ],
            streak: 0
        });
        const recap = env.generateWeeklyRecap('2025-01-12');
        assert.equal(recap.lessonsCompleted, 3);
        assert.equal(recap.xpEarned, 225); // (20+10+15) × 5
        assert.equal(recap.perfectLessons, 2); // score === total only
    });

    test('marks correct days active', () => {
        const sun = new Date('2025-01-12T12:00:00').getTime();
        const wed = new Date('2025-01-15T12:00:00').getTime();
        env.__setAppState({
            unitsHistory: [
                { unit: 'pr1-1', date: sun, score: 2, total: 2, wrong: [] },
                { unit: 'pr1-2', date: wed, score: 2, total: 2, wrong: [] }
            ],
            streak: 0
        });
        const recap = env.generateWeeklyRecap('2025-01-12');
        // dayMap is [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
        assert.equal(recap.dayMap[0], true,  'Sunday should be active');
        assert.equal(recap.dayMap[3], true,  'Wednesday should be active');
        assert.equal(recap.dayMap[1], false, 'Monday should be inactive');
        assert.equal(recap.daysActive, 2);
    });

    test('words learned = words answered right this week', () => {
        const tue = new Date('2025-01-14T12:00:00').getTime();
        env.__setAppState({
            unitsHistory: [
                { unit: 'pr1-1', date: tue, score: 5, total: 5, wrong: [] },
                { unit: 'pr1-2', date: tue, score: 3, total: 5, wrong: ['x', 'y'] },
                { unit: 'pr1-3', date: tue, score: 0, total: 2, wrong: ['p', 'q'] }
            ],
            streak: 0
        });
        const recap = env.generateWeeklyRecap('2025-01-12');
        // (5-0) + (5-2) + (2-2) = 8
        assert.equal(recap.wordsLearned, 8);
    });

    test('empty week returns zero counts', () => {
        env.__setAppState({ unitsHistory: [], streak: 0 });
        const recap = env.generateWeeklyRecap('2025-01-12');
        assert.equal(recap.lessonsCompleted, 0);
        assert.equal(recap.xpEarned, 0);
        assert.equal(recap.daysActive, 0);
    });
});

suite('getRecapMessage: motivational tier', () => {
    test('7/7 days returns Perfect Week message', () => {
        const msg = env.getRecapMessage({ daysActive: 7 });
        assert.truthy(msg.includes('PERFECT'));
    });

    test('5-6 days returns Strong week', () => {
        const msg = env.getRecapMessage({ daysActive: 5 });
        assert.truthy(msg.toLowerCase().includes('strong'));
    });

    test('3-4 days returns Solid effort', () => {
        const msg = env.getRecapMessage({ daysActive: 3 });
        assert.truthy(msg.toLowerCase().includes('solid'));
    });

    test('low days returns gentle encouragement', () => {
        const msg = env.getRecapMessage({ daysActive: 1 });
        assert.truthy(msg.length > 0);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
