// tests/home-streak-panel.test.js — v3.38 homepage redesign.
// The homepage now focuses on TWO goals: grow the pet (above, unchanged)
// and keep the daily streak (this panel). These tests lock in that the
// streak panel renders correctly and surfaces the right CTA based on
// today's study status.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

function setup(state) {
    const env = loadAppCode();
    env.__setAppState(state);
    env.__setCurrentUser('TestUser');
    // The renderer reads from #streakPanel — make sure the element exists
    // by calling getElementById once (the stub auto-creates stable refs).
    env.document.getElementById('streakPanel');
    return env;
}

suite('home: streak panel renders', () => {
    test('renderHomeStreakPanel writes HTML into #streakPanel', () => {
        const env = setup({ streak: 7, bestStreak: 7, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(html && html.length > 0, 'no HTML written to #streakPanel');
    });

    test('streak panel shows the streak number prominently', () => {
        const env = setup({ streak: 42, bestStreak: 64, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        // 42 should appear inside the streak number wrapper
        assert.truthy(/<span>42<\/span>/.test(html),
            `expected streak number 42 in HTML. Got: ${html.slice(0, 200)}`);
    });

    test('streak panel shows best-ever line', () => {
        const env = setup({ streak: 7, bestStreak: 30, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(/Best ever/.test(html) && html.includes('30'),
            'best streak (30) should appear');
    });

    test('streak panel shows next-milestone progress bar', () => {
        const env = setup({ streak: 5, bestStreak: 5, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        // 5 days → next milestone is 7 → "2 days to 7"
        assert.truthy(/home-streak-progress-fill/.test(html), 'progress fill present');
        assert.truthy(/<strong>7<\/strong>/.test(html), 'should mention milestone 7');
    });

    test('streak panel shows "Learn today\'s words" CTA when NOT studied today', () => {
        const env = setup({ streak: 3, bestStreak: 3, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(/Learn today/i.test(html),
            'should show "Learn today\'s words" CTA when not studied today');
        assert.falsy(/Studied today/.test(html),
            'should NOT show "Studied today" when nothing logged');
    });

    test('streak panel shows "Studied today" check when lessonHistory has a today entry', () => {
        const env = setup({
            streak: 5, bestStreak: 5,
            lessonHistory: [{ lessonNum: 0, date: Date.now(), score: 5, mistakes: 0 }]
        });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(/Studied today/.test(html),
            'should show "Studied today" check after today\'s lesson');
    });

    test('streak panel shows 7-day calendar with one "today" tile', () => {
        const env = setup({ streak: 2, bestStreak: 2, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        const dayTiles = (html.match(/home-streak-day\b/g) || []).length;
        // 7 day tiles → one with "today" class. Each day has class once, so
        // the base class shows up 7 times.
        assert.truthy(dayTiles >= 7, `expected ≥7 day tiles, got ${dayTiles}`);
        assert.truthy(/home-streak-day[^"]*today/.test(html),
            'one tile should have "today" class');
    });

    test('streak panel shows tier label that matches streak level', () => {
        const env = setup({ streak: 15, bestStreak: 15, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        // 15 days → "Unstoppable" tier
        assert.truthy(/UNSTOPPABLE/.test(html), 'tier label "UNSTOPPABLE" missing');
    });

    test('streak panel handles zero-streak (new user)', () => {
        const env = setup({ streak: 0, bestStreak: 0, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(/<span>0<\/span>/.test(html), 'should show 0 streak');
        assert.truthy(/GETTING STARTED/.test(html),
            '0-streak should show "Getting Started" tier');
        // Should still show CTA so user can start
        assert.truthy(/Learn today/i.test(html), 'should show learn CTA at 0 streak');
    });

    test('streak panel handles being called with no #streakPanel element', () => {
        // Don\'t call setup() — no DOM element pre-touched. The function
        // should gracefully no-op without throwing.
        const env = loadAppCode();
        env.__setAppState({ streak: 5, bestStreak: 5, lessonHistory: [] });
        // The DOM stub auto-creates elements, so #streakPanel will exist as
        // a stub regardless. Just verify no throw.
        let threw = false;
        try { env.renderHomeStreakPanel(); } catch (e) { threw = true; }
        assert.falsy(threw, 'renderHomeStreakPanel should never throw');
    });
});

suite('home: streak coverage — recordStudy is exported and idempotent', () => {
    test('recordStudy increments streak on first call today', () => {
        const env = loadAppCode();
        env.__setAppState({
            streak: 5, bestStreak: 5, points: 0,
            lessonHistory: [],
            lastStudyDate: new Date(Date.now() - 86400000).toDateString()
        });
        env.recordStudy();
        assert.equal(env.__getAppState().streak, 6,
            'streak should bump from 5 → 6 on first call today');
    });

    test('recordStudy does NOT double-bump within the same day', () => {
        const env = loadAppCode();
        env.__setAppState({
            streak: 5, bestStreak: 5, points: 0,
            lessonHistory: [],
            lastStudyDate: new Date(Date.now() - 86400000).toDateString()
        });
        env.recordStudy();
        env.recordStudy();
        env.recordStudy();
        assert.equal(env.__getAppState().streak, 6,
            'streak should stay at 6 on repeat calls within same day');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
