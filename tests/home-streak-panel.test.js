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
        assert.truthy(/<strong>42<\/strong>/.test(html),
            `expected streak number 42 in HTML. Got: ${html.slice(0, 200)}`);
    });

    test('streak panel stays focused and omits the old best-ever line', () => {
        const env = setup({ streak: 7, bestStreak: 30, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.falsy(/Best ever/.test(html), 'the compact reference has no best-ever line');
    });

    test('streak panel names the next milestone without an extra progress bar', () => {
        const env = setup({ streak: 5, bestStreak: 5, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        // 5 days → next milestone is 7 → "2 days to 7"
        assert.truthy(/Thêm <strong>2 ngày<\/strong>/.test(html), 'remaining days are explicit');
        assert.falsy(/home-streak-progress-fill/.test(html), 'the compact reference has no progress bar');
        assert.truthy(/<strong>7<\/strong>/.test(html), 'should mention milestone 7');
    });

    test('streak panel shows the Vietnamese learning CTA when NOT studied today', () => {
        const env = setup({ streak: 3, bestStreak: 3, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(/Học ngay hôm nay/.test(html), 'should show the learning CTA when not studied today');
        assert.falsy(/Đã học hôm nay/.test(html), 'should NOT show completion copy when nothing logged');
    });

    test('streak panel shows "Đã học hôm nay" when lessonHistory has a today entry', () => {
        const env = setup({
            streak: 5, bestStreak: 5,
            lessonHistory: [{ lessonNum: 0, date: Date.now(), score: 5, mistakes: 0 }]
        });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(/Đã học hôm nay/.test(html), 'should show completion copy after today\'s lesson');
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

    test('streak panel uses Vietnamese day labels', () => {
        const env = setup({ streak: 15, bestStreak: 15, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(/>CN<|>T2<|>T3<|>T4<|>T5<|>T6<|>T7</.test(html), 'Vietnamese day labels missing');
    });

    test('streak panel handles zero-streak (new user)', () => {
        const env = setup({ streak: 0, bestStreak: 0, lessonHistory: [] });
        env.renderHomeStreakPanel();
        const html = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(/<strong>0<\/strong>/.test(html), 'should show 0 streak');
        assert.truthy(/ngày liên tiếp/.test(html), 'streak unit should be Vietnamese');
        // Should still show CTA so user can start
        assert.truthy(/Học ngay hôm nay/.test(html), 'should show learn CTA at 0 streak');
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

// ============================================================================
// HOMEPAGE STILL RENDERS THE PET (v3.38.2 regression — pet went missing)
// ============================================================================
// In v3.38.0 the homepage redesign accidentally placed renderWordPet() AFTER
// an early-return guard added during the redesign, so the dog disappeared.
// These tests lock in that calling renderHome() actually paints the pet.
suite('home: renderHome() draws the pet hero zone', () => {
    function setupHome(state) {
        const env = loadAppCode();
        env.localStorage.clear();
        // The DOM stub auto-creates stable refs on first getElementById call.
        // Pre-touch the elements that renderWordPet expects so we can
        // observe their innerHTML.
        env.document.getElementById('petHeroZone');
        env.document.getElementById('petHeroStage');
        env.document.getElementById('petHeroTopbar');
        env.document.getElementById('petHeroXpbar');
        env.document.getElementById('habitatEmojis');
        env.document.getElementById('streakPanel');
        env.__setAppState(Object.assign({
            avatar: '🐶', username: 'Tester',
            streak: 0, bestStreak: 0, points: 0, coins: 0,
            dogLevel: 1, dogGrowthXP: 0,
            lessonHistory: [], srs: {}, mistakes: [],
            currentLesson: 0
        }, state || {}));
        env.__setCurrentUser('Tester');
        return env;
    }

    test('renderHome() writes HTML into #petHeroStage', () => {
        const env = setupHome();
        // Just verify it doesn't throw + something got rendered.
        let threw = false;
        try { env.renderHome(); } catch (e) { threw = true; console.error(e); }
        assert.falsy(threw, 'renderHome() should not throw on the new homepage');
        const petHTML = env.document.__getLastInnerHTML('petHeroStage');
        assert.truthy(petHTML && petHTML.length > 0,
            `#petHeroStage should have HTML painted into it. Got: "${petHTML}"`);
    });

    test('renderHome() also paints the streak panel (both goals visible)', () => {
        const env = setupHome({ streak: 5 });
        env.renderHome();
        const petHTML = env.document.__getLastInnerHTML('petHeroStage');
        const streakHTML = env.document.__getLastInnerHTML('streakPanel');
        assert.truthy(petHTML && petHTML.length > 0, 'pet not rendered');
        assert.truthy(streakHTML && streakHTML.length > 0, 'streak panel not rendered');
    });

    test('renderHome() renders pet AT EVERY pet level (1, 5, 10)', () => {
        for (const dogLevel of [1, 5, 10]) {
            const env = setupHome({ dogLevel });
            env.renderHome();
            const petHTML = env.document.__getLastInnerHTML('petHeroStage');
            assert.truthy(petHTML && petHTML.length > 0,
                `pet missing at dogLevel=${dogLevel}`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
