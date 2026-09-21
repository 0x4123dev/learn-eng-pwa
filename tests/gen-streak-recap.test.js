// tests/gen-streak-recap.test.js — Streak + weekly recap helpers (generated batch).
// Covers: getWeekStart idempotence, year-boundary week ranges, two-week
// unitsHistory bucketing in generateWeeklyRecap, getRecapMessage tiers vs
// accuracy, and streak-shield field defaults.
// Deliberately different cases from tests/recap.test.js and tests/streak.test.js.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode({ includeHome: true });

// Local timestamp helper — aligns with the local-midnight parsing in home.js
function ts(y, m, d, h) {
    return new Date(y, m, d, h || 0, 0, 0, 0).getTime();
}

// Rebuild a YYYY-MM-DD string as a LOCAL date (mirrors _parseLocalISODate,
// which is not exported) so idempotence checks are timezone-safe.
function isoToLocalDate(iso) {
    const p = iso.split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2]);
}

suite('gen: getWeekStart idempotence', () => {
    // Applying getWeekStart to its own output must be a fixed point.
    const seeds = [
        new Date(2025, 5, 10),  // Tue Jun 10
        new Date(2025, 5, 13),  // Fri Jun 13
        new Date(2025, 5, 16),  // Mon Jun 16
        new Date(2025, 5, 19),  // Thu Jun 19
        new Date(2025, 5, 22),  // Sun Jun 22
        new Date(2025, 5, 28)   // Sat Jun 28
    ];
    seeds.forEach(d => {
        test(`idempotent for ${d.toDateString()}`, () => {
            const once = env.getWeekStart(d);
            const twice = env.getWeekStart(isoToLocalDate(once));
            assert.equal(twice, once, 'getWeekStart(getWeekStart(d)) must equal getWeekStart(d)');
            assert.truthy(/^\d{4}-\d{2}-\d{2}$/.test(once), `bad format: ${once}`);
        });
    });

    // Remaining weekdays not covered by recap.test.js (which does Sun/Wed/Sat):
    // every day of the week of Sun 2025-06-08 collapses to the same Sunday.
    const weekdays = [
        [new Date(2025, 5, 9), 'Monday'],
        [new Date(2025, 5, 10), 'Tuesday'],
        [new Date(2025, 5, 12), 'Thursday'],
        [new Date(2025, 5, 13), 'Friday']
    ];
    weekdays.forEach(([d, label]) => {
        test(`${label} collapses to Sunday 2025-06-08`, () => {
            assert.equal(env.getWeekStart(d), '2025-06-08');
        });
    });
});

suite('gen: getWeekStart year boundaries', () => {
    test('New Year 2025 (Wed) belongs to the 2024 week', () => {
        assert.equal(env.getWeekStart(new Date(2025, 0, 1)), '2024-12-29');
    });

    test('New Year 2026 (Thu) belongs to the 2025 week', () => {
        assert.equal(env.getWeekStart(new Date(2026, 0, 1)), '2025-12-28');
    });

    test('Dec 31 2023 was itself a Sunday — week starts on New Year\'s Eve', () => {
        assert.equal(env.getWeekStart(new Date(2023, 11, 31)), '2023-12-31');
    });

    test('Dec 31 2024 (Tue) maps back into the same year-crossing week', () => {
        assert.equal(env.getWeekStart(new Date(2024, 11, 31)), '2024-12-29');
    });

    test('leap day Feb 29 2024 (Thu) maps to Sunday Feb 25', () => {
        assert.equal(env.getWeekStart(new Date(2024, 1, 29)), '2024-02-25');
    });
});

suite('gen: formatWeekRange year/leap boundaries', () => {
    test('2024→2025 crossing week renders both months', () => {
        assert.equal(env.formatWeekRange('2024-12-29'), 'Dec 29 – Jan 4');
    });

    test('2025→2026 crossing week renders both months', () => {
        assert.equal(env.formatWeekRange('2025-12-28'), 'Dec 28 – Jan 3');
    });

    test('week starting on New Year\'s Eve 2023', () => {
        assert.equal(env.formatWeekRange('2023-12-31'), 'Dec 31 – Jan 6');
    });

    test('leap-year week spans Feb 25 – Mar 2 (includes Feb 29)', () => {
        assert.equal(env.formatWeekRange('2024-02-25'), 'Feb 25 – Mar 2');
    });

    test('mid-month week repeats the month on both sides', () => {
        assert.equal(env.formatWeekRange('2025-06-08'), 'Jun 8 – Jun 14');
    });

    test('composes with getWeekStart: mid-August date renders its week', () => {
        const week = env.getWeekStart(new Date(2025, 7, 20)); // Wed Aug 20
        assert.equal(week, '2025-08-17');
        assert.equal(env.formatWeekRange(week), 'Aug 17 – Aug 23');
    });
});

suite('gen: generateWeeklyRecap two-week bucketing', () => {
    // Week A: Sun 2025-03-02 … Sat 2025-03-08
    // Week B: Sun 2025-03-09 … Sat 2025-03-15
    const WEEK_A = '2025-03-02';
    const WEEK_B = '2025-03-09';
    // Book practice rows (js/units.js): xp = score × 5, perfect = score === total,
    // wordsLearned = right answers (total − wrong.length).
    const historyTwoWeeks = () => ([
        // Week A: Mon + Wed
        { unit: 'pr1-10', date: ts(2025, 2, 3, 9), score: 8, total: 8, wrong: [] },
        { unit: 'pr1-11', date: ts(2025, 2, 5, 18), score: 12, total: 15, wrong: ['a', 'b', 'c'] },
        // Week B: Sun + Wed + Fri
        { unit: 'pr1-11', date: ts(2025, 2, 9, 8), score: 2, total: 2, wrong: [] },
        { unit: 'pr2-12', date: ts(2025, 2, 12, 12), score: 4, total: 4, wrong: [] },
        { unit: 'pr2-12', date: ts(2025, 2, 14, 20), score: 6, total: 10, wrong: ['p', 'q', 'r', 's'] }
    ]);
    function setState() {
        env.__setAppState({ unitsHistory: historyTwoWeeks(), streak: 9 });
    }

    test('week A counts only its own 2 lessons', () => {
        setState();
        assert.equal(env.generateWeeklyRecap(WEEK_A).lessonsCompleted, 2);
    });

    test('week A XP sums only week-A points', () => {
        setState();
        assert.equal(env.generateWeeklyRecap(WEEK_A).xpEarned, 100); // (8+12)×5
    });

    test('week A has exactly 1 perfect lesson', () => {
        setState();
        assert.equal(env.generateWeeklyRecap(WEEK_A).perfectLessons, 1);
    });

    test('week A dayMap marks Mon+Wed only', () => {
        setState();
        const recap = env.generateWeeklyRecap(WEEK_A);
        assert.deepEqual(recap.dayMap, [false, true, false, true, false, false, false]);
        assert.equal(recap.daysActive, 2);
    });

    test('lesson rows missing score/total add 0 XP and are not perfect', () => {
        env.__setAppState({
            unitsHistory: [{ unit: 'pr1-3', date: ts(2025, 2, 4, 10) }], // no score/total/wrong keys
            streak: 0
        });
        const r = env.generateWeeklyRecap(WEEK_A);
        assert.equal(r.lessonsCompleted, 1);
        assert.equal(r.xpEarned, 0, 'score||0 treats a missing score field as 0');
        assert.equal(r.perfectLessons, 0, 'a row with no total is not perfect');
        assert.equal(r.wordsLearned, 0, 'no total → no words answered right');
    });

    test('weekEnd is the Saturday of each week', () => {
        setState();
        assert.equal(env.generateWeeklyRecap(WEEK_A).weekEnd, '2025-03-08');
        assert.equal(env.generateWeeklyRecap(WEEK_B).weekEnd, '2025-03-15');
    });

    test('week B counts only its own 3 lessons', () => {
        setState();
        assert.equal(env.generateWeeklyRecap(WEEK_B).lessonsCompleted, 3);
    });

    test('week B XP sums only week-B points', () => {
        setState();
        assert.equal(env.generateWeeklyRecap(WEEK_B).xpEarned, 60); // (2+4+6)×5
    });

    test('week B has 2 perfect lessons', () => {
        setState();
        assert.equal(env.generateWeeklyRecap(WEEK_B).perfectLessons, 2);
    });

    test('week B wordsLearned counts the right answers of each practice', () => {
        setState();
        // (2−0) + (4−0) + (10−4) = 12
        assert.equal(env.generateWeeklyRecap(WEEK_B).wordsLearned, 12);
    });

    test('week B dayMap marks Sun+Wed+Fri only', () => {
        setState();
        const recap = env.generateWeeklyRecap(WEEK_B);
        assert.deepEqual(recap.dayMap, [true, false, false, true, false, true, false]);
        assert.equal(recap.daysActive, 3);
    });

    test('no lesson is double-counted or lost across the two weeks', () => {
        setState();
        const a = env.generateWeeklyRecap(WEEK_A);
        const b = env.generateWeeklyRecap(WEEK_B);
        assert.equal(a.lessonsCompleted + b.lessonsCompleted, historyTwoWeeks().length);
        assert.equal(a.xpEarned + b.xpEarned, 160);
    });

    test('streakAtEnd snapshots current appState.streak in both recaps', () => {
        setState();
        assert.equal(env.generateWeeklyRecap(WEEK_A).streakAtEnd, 9);
        assert.equal(env.generateWeeklyRecap(WEEK_B).streakAtEnd, 9);
    });

    test('lesson at exact week-B start midnight belongs to week B, not week A', () => {
        env.__setAppState({
            unitsHistory: [
                { unit: 'pr1-1', date: ts(2025, 2, 9, 0), score: 5, total: 5, wrong: [] }
            ],
            streak: 0
        });
        assert.equal(env.generateWeeklyRecap(WEEK_A).lessonsCompleted, 0);
        assert.equal(env.generateWeeklyRecap(WEEK_B).lessonsCompleted, 1);
    });

    test('lesson at exact next-week midnight is excluded (half-open interval)', () => {
        env.__setAppState({
            unitsHistory: [
                { unit: 'pr1-1', date: ts(2025, 2, 16, 0), score: 5, total: 5, wrong: [] }
            ],
            streak: 0
        });
        assert.equal(env.generateWeeklyRecap(WEEK_B).lessonsCompleted, 0);
        assert.equal(env.generateWeeklyRecap(WEEK_B).xpEarned, 0);
    });
});

suite('gen: getRecapMessage tiers and accuracy independence', () => {
    test('0 active days falls into the gentle tier', () => {
        const msg = env.getRecapMessage({ daysActive: 0 });
        assert.truthy(msg.includes('Every step counts'), `got: ${msg}`);
    });

    test('2 active days is still the gentle tier (below Solid threshold)', () => {
        const msg = env.getRecapMessage({ daysActive: 2 });
        assert.equal(msg, env.getRecapMessage({ daysActive: 0 }),
            'daysActive 0-2 share the same gentle message');
    });

    test('4 active days is the Solid tier and echoes 4/7', () => {
        const msg = env.getRecapMessage({ daysActive: 4 });
        assert.truthy(msg.includes('Solid'), `got: ${msg}`);
        assert.truthy(msg.includes('4/7'), `got: ${msg}`);
    });

    test('6 active days is the Strong tier and echoes 6/7', () => {
        const msg = env.getRecapMessage({ daysActive: 6 });
        assert.truthy(msg.includes('Strong'), `got: ${msg}`);
        assert.truthy(msg.includes('6/7'), `got: ${msg}`);
    });

    test('0% accuracy week and 100% accuracy week get the same message', () => {
        // getRecapMessage keys ONLY on daysActive — accuracy has no effect.
        const zeroPct = { daysActive: 5, lessonsCompleted: 4, perfectLessons: 0, xpEarned: 0 };
        const hundredPct = { daysActive: 5, lessonsCompleted: 4, perfectLessons: 4, xpEarned: 400 };
        assert.equal(env.getRecapMessage(zeroPct), env.getRecapMessage(hundredPct));
    });

    test('50% accuracy week matches 100% accuracy week too', () => {
        const halfPct = { daysActive: 3, lessonsCompleted: 4, perfectLessons: 2 };
        const hundredPct = { daysActive: 3, lessonsCompleted: 4, perfectLessons: 4 };
        assert.equal(env.getRecapMessage(halfPct), env.getRecapMessage(hundredPct));
    });

    test('exact tier boundaries: 3→Solid, 5→Strong, 7→PERFECT WEEK', () => {
        assert.truthy(env.getRecapMessage({ daysActive: 3 }).includes('Solid'),
            '3 is the first Solid day');
        assert.truthy(env.getRecapMessage({ daysActive: 5 }).includes('Strong'),
            '5 is the first Strong day');
        const perfect = env.getRecapMessage({ daysActive: 7 });
        assert.truthy(perfect.includes('PERFECT WEEK'), `got: ${perfect}`);
        assert.falsy(perfect.includes('7/7'), 'perfect tier does not echo an x/7 count');
    });

    test('recap generated from an empty week feeds the gentle tier', () => {
        env.__setAppState({ unitsHistory: [], streak: 0 });
        const recap = env.generateWeeklyRecap('2025-03-02');
        const msg = env.getRecapMessage(recap);
        assert.truthy(msg.includes('Every step counts'), `got: ${msg}`);
    });
});

suite('gen: streak shield field defaults', () => {
    const fresh = env.createDefaultUserData('Tester', '🐶', '0000');

    test('new user starts with 0 shields and no pending celebration', () => {
        assert.equal(fresh.streakShields, 0);
        assert.equal(fresh.pendingShieldCelebration, null);
    });

    test('new user starts with 0 bestStreak', () => {
        assert.equal(fresh.bestStreak, 0);
    });

    test('new user starts at streak milestone 0', () => {
        assert.equal(fresh.lastStreakMilestone, 0);
    });

    test('new user has empty weeklyRecaps and no recap shown yet', () => {
        assert.deepEqual(fresh.weeklyRecaps, []);
        assert.equal(fresh.lastWeeklyRecapShown, null);
    });

    test('updateStreak tolerates a missing streakShields field (resets streak)', () => {
        const dayBefore = new Date(Date.now() - 2 * 86400000).toDateString();
        const appState = { streak: 6, lastStudyDate: dayBefore }; // no streakShields at all
        const e2 = loadAppCode({ includeHome: true });
        e2.__setAppState(appState);
        e2.updateStreak();
        assert.equal(appState.streak, 0, 'no shield → streak resets');
        assert.equal(appState.streakShields, undefined, 'field stays absent — not decremented below 0');
    });

    test('recordStudy coerces missing streakShields to 0 before awarding', () => {
        const yesterday = new Date(Date.now() - 86400000).toDateString();
        const appState = {
            streak: 1, lastStudyDate: yesterday, achievements: [], // no streakShields field
            unitsHistory: [
                { unit: 'pr1-1', date: Date.now(), score: 5, total: 5 },
                { unit: 'pr1-2', date: Date.now(), score: 5, total: 5 },
                { unit: 'pr1-3', date: Date.now(), score: 5, total: 5 }
            ]
        };
        const e2 = loadAppCode({ includeHome: true });
        e2.__setAppState(appState);
        e2.recordStudy();
        assert.equal(appState.streakShields, 1, '(undefined || 0) + 1 → first shield earned');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
