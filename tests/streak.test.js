// tests/streak.test.js — Streak, shield, and milestone logic
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

function loadWithAppState(initialAppState) {
    const env = loadAppCode();
    env.__setAppState(initialAppState);
    return env;
}

const today = () => new Date().toDateString();
const yesterday = () => new Date(Date.now() - 86400000).toDateString();
const dayBeforeYesterday = () => new Date(Date.now() - 2 * 86400000).toDateString();

suite('updateStreak: same-day study', () => {
    test('does nothing if already studied today', () => {
        const appState = { streak: 5, lastStudyDate: today(), streakShields: 0 };
        const env = loadWithAppState(appState);
        env.updateStreak();
        assert.equal(appState.streak, 5);
        assert.equal(appState.lastStudyDate, today());
    });
});

suite('updateStreak: yesterday study (streak continues)', () => {
    test('keeps streak intact if last study was yesterday', () => {
        const appState = { streak: 5, lastStudyDate: yesterday(), streakShields: 0 };
        const env = loadWithAppState(appState);
        env.updateStreak();
        assert.equal(appState.streak, 5, 'streak should not change yet (recordStudy increments)');
    });
});

suite('updateStreak: missed day with no shield', () => {
    test('streak resets to 0', () => {
        const appState = { streak: 7, lastStudyDate: dayBeforeYesterday(), streakShields: 0 };
        const env = loadWithAppState(appState);
        env.updateStreak();
        assert.equal(appState.streak, 0);
    });

    test('records broken streak in petMemory if streak >= 3', () => {
        const appState = { streak: 14, lastStudyDate: dayBeforeYesterday(), streakShields: 0 };
        const env = loadWithAppState(appState);
        env.updateStreak();
        assert.truthy(appState.petMemory, 'petMemory should be created');
        assert.equal(appState.petMemory.lastStreakBroken, 14);
    });

    test('does NOT record broken streak in petMemory if streak < 3', () => {
        const appState = { streak: 2, lastStudyDate: dayBeforeYesterday(), streakShields: 0, petMemory: { lessonsTogether: 0 } };
        const env = loadWithAppState(appState);
        env.updateStreak();
        assert.falsy(appState.petMemory.lastStreakBroken,
            `expected no lastStreakBroken, got ${appState.petMemory.lastStreakBroken}`);
    });
});

suite('updateStreak: missed day with shield', () => {
    test('shield is consumed and streak preserved', () => {
        const appState = { streak: 7, lastStudyDate: dayBeforeYesterday(), streakShields: 1 };
        const env = loadWithAppState(appState);
        env.updateStreak();
        assert.equal(appState.streak, 7, 'streak should be preserved');
        assert.equal(appState.streakShields, 0, 'shield should be consumed');
    });

    test('lastStudyDate rolls forward to yesterday', () => {
        const appState = { streak: 7, lastStudyDate: dayBeforeYesterday(), streakShields: 1 };
        const env = loadWithAppState(appState);
        env.updateStreak();
        assert.equal(appState.lastStudyDate, yesterday(),
            'lastStudyDate should become yesterday so streak does not break tomorrow');
    });

    test('pendingShieldCelebration is set', () => {
        const appState = { streak: 14, lastStudyDate: dayBeforeYesterday(), streakShields: 2 };
        const env = loadWithAppState(appState);
        env.updateStreak();
        assert.equal(appState.pendingShieldCelebration, 14);
    });

    test('multiple shields can save multiple missed days', () => {
        // First missed day uses shield 1
        const appState = { streak: 7, lastStudyDate: dayBeforeYesterday(), streakShields: 2 };
        const env = loadWithAppState(appState);
        env.updateStreak();
        assert.equal(appState.streak, 7);
        assert.equal(appState.streakShields, 1);
    });
});

suite('recordStudy: streak increment', () => {
    test('first study sets streak to 1', () => {
        const appState = { streak: 0, lastStudyDate: null, lessonHistory: [] };
        const env = loadWithAppState(appState);
        env.recordStudy();
        assert.equal(appState.streak, 1);
        assert.equal(appState.lastStudyDate, today());
    });

    test('second consecutive day increments streak', () => {
        const appState = { streak: 1, lastStudyDate: yesterday(), lessonHistory: [] };
        const env = loadWithAppState(appState);
        env.recordStudy();
        assert.equal(appState.streak, 2);
    });

    test('does not increment if already studied today', () => {
        const appState = { streak: 5, lastStudyDate: today(), lessonHistory: [] };
        const env = loadWithAppState(appState);
        env.recordStudy();
        assert.equal(appState.streak, 5);
    });

    test('updates bestStreak if new record', () => {
        const appState = { streak: 4, lastStudyDate: yesterday(), bestStreak: 4, lessonHistory: [] };
        const env = loadWithAppState(appState);
        env.recordStudy();
        assert.equal(appState.bestStreak, 5);
    });

    test('does NOT decrement bestStreak when current streak is lower', () => {
        const appState = { streak: 3, lastStudyDate: yesterday(), bestStreak: 14, lessonHistory: [] };
        const env = loadWithAppState(appState);
        env.recordStudy();
        assert.equal(appState.bestStreak, 14);
    });

    test('awards shield after 3+ lessons in a day', () => {
        const date = today();
        const appState = {
            streak: 1,
            lastStudyDate: yesterday(), // yesterday — streak will become 2 today
            streakShields: 0,
            lessonHistory: [
                { lessonNum: 1, date: Date.now() },
                { lessonNum: 2, date: Date.now() },
                { lessonNum: 3, date: Date.now() }
            ]
        };
        const env = loadWithAppState(appState);
        env.recordStudy();
        assert.equal(appState.streakShields, 1, 'should earn shield with 3+ lessons today');
    });

    test('shield count caps at 3', () => {
        const appState = {
            streak: 1, lastStudyDate: yesterday(),
            streakShields: 3,
            lessonHistory: [
                { lessonNum: 1, date: Date.now() }, { lessonNum: 2, date: Date.now() },
                { lessonNum: 3, date: Date.now() }, { lessonNum: 4, date: Date.now() }
            ]
        };
        const env = loadWithAppState(appState);
        env.recordStudy();
        assert.equal(appState.streakShields, 3, 'shield should cap at 3');
    });
});

suite('STREAK_MILESTONES', () => {
    test('contains expected milestone days', () => {
        const env = loadAppCode();
        const expected = [3, 7, 14, 30, 60, 100];
        assert.deepEqual(env.STREAK_MILESTONES, expected);
    });
});

suite('getStreakTier', () => {
    test('tier 0 for streak < 3', () => {
        const env = loadAppCode();
        assert.equal(env.getStreakTier(0), 0);
        assert.equal(env.getStreakTier(2), 0);
    });

    test('tier 1 for streak 3-6', () => {
        const env = loadAppCode();
        assert.equal(env.getStreakTier(3), 1);
        assert.equal(env.getStreakTier(6), 1);
    });

    test('tier 2 for streak 7-13', () => {
        const env = loadAppCode();
        assert.equal(env.getStreakTier(7), 2);
        assert.equal(env.getStreakTier(13), 2);
    });

    test('tier 3 for streak 14-29', () => {
        const env = loadAppCode();
        assert.equal(env.getStreakTier(14), 3);
        assert.equal(env.getStreakTier(29), 3);
    });

    test('tier 4 for streak >= 30', () => {
        const env = loadAppCode();
        assert.equal(env.getStreakTier(30), 4);
        assert.equal(env.getStreakTier(100), 4);
    });
});

suite('getNextMilestone', () => {
    test('returns first milestone above current streak', () => {
        const env = loadAppCode();
        assert.equal(env.getNextMilestone(0), 3);
        assert.equal(env.getNextMilestone(3), 7);
        assert.equal(env.getNextMilestone(15), 30);
        assert.equal(env.getNextMilestone(30), 60);
    });

    test('returns null when past last milestone', () => {
        const env = loadAppCode();
        assert.equal(env.getNextMilestone(100), null);
        assert.equal(env.getNextMilestone(150), null);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
