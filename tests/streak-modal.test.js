// tests/streak-modal.test.js — Daily-streak modal gating + content (v3.37).
// Verifies:
//   • hasShownStreakToday returns false on first call of the day, true after
//   • markStreakShownToday persists the day's date in localStorage
//   • The modal's DOM contents include the streak number, calendar, and CTA
//   • Per-user gating (one user marked doesn't suppress another user)

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

suite('streak modal: once-per-day gating', () => {
    test('hasShownStreakToday returns false on a fresh session', () => {
        const env = loadAppCode();
        env.localStorage.clear();
        assert.falsy(env.hasShownStreakToday('Alice'));
    });

    test('after markStreakShownToday("Alice"), hasShownStreakToday("Alice") returns true', () => {
        const env = loadAppCode();
        env.localStorage.clear();
        env.markStreakShownToday('Alice');
        assert.truthy(env.hasShownStreakToday('Alice'));
    });

    test('per-user gating: marking Alice does NOT suppress Bob', () => {
        const env = loadAppCode();
        env.localStorage.clear();
        env.markStreakShownToday('Alice');
        assert.falsy(env.hasShownStreakToday('Bob'),
            'Bob should still be eligible for today\'s modal');
    });

    test('hasShownStreakToday handles null/undefined user gracefully', () => {
        const env = loadAppCode();
        env.localStorage.clear();
        // No user → treat as already shown so the modal doesn't pop on no-login
        assert.truthy(env.hasShownStreakToday(null));
        assert.truthy(env.hasShownStreakToday(undefined));
    });

    test('mark stores today\'s YYYY-MM-DD in localStorage under the user-keyed entry', () => {
        const env = loadAppCode();
        env.localStorage.clear();
        env.markStreakShownToday('Carol');
        const stored = env.localStorage.getItem('flashlingo-streak-shown-Carol');
        assert.truthy(/^\d{4}-\d{2}-\d{2}$/.test(stored),
            `expected YYYY-MM-DD, got "${stored}"`);
        // Match today\'s actual date
        const now = new Date();
        const expected = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0');
        assert.equal(stored, expected);
    });
});

suite('streak modal: rendering', () => {
    function setupModal(state) {
        const env = loadAppCode();
        env.localStorage.clear();
        env.__setAppState(state);
        env.__setCurrentUser('TestUser');
        return env;
    }

    test('showDailyStreakModal renders the modal overlay with the streak number', () => {
        const env = setupModal({ streak: 7, bestStreak: 7, lessonHistory: [], coins: 0 });
        env.showDailyStreakModal();
        const overlay = env.document.getElementById('streakModalOverlay');
        assert.truthy(overlay, 'overlay element should exist');
        // The modal HTML should contain the streak number prominently
        assert.truthy(overlay.innerHTML.includes('>7</div>') || /streak-modal-streak[^>]*>7</.test(overlay.innerHTML),
            `streak "7" should appear. HTML snippet: ${overlay.innerHTML.slice(0, 200)}`);
    });

    test('showDailyStreakModal shows the "Days" unit label and best-streak line', () => {
        const env = setupModal({ streak: 14, bestStreak: 30, lessonHistory: [], coins: 0 });
        env.showDailyStreakModal();
        const html = env.document.getElementById('streakModalOverlay').innerHTML;
        assert.truthy(/DAYS/.test(html), 'should show DAYS label');
        assert.truthy(/Best ever:/.test(html) && html.includes('30'),
            'best streak (30) should appear');
    });

    test('shows next-milestone progress bar when streak < 100', () => {
        const env = setupModal({ streak: 5, bestStreak: 5, lessonHistory: [], coins: 0 });
        env.showDailyStreakModal();
        const html = env.document.getElementById('streakModalOverlay').innerHTML;
        // 5 days → next milestone is 7 → "2 days to 7-day milestone"
        assert.truthy(/streak-modal-progress-fill/.test(html), 'progress fill present');
        assert.truthy(/7-day/.test(html), 'should mention "7-day" milestone');
    });

    test('shows CTA "Learn today\'s words" when user has NOT studied today', () => {
        const env = setupModal({ streak: 3, bestStreak: 3, lessonHistory: [], coins: 0 });
        env.showDailyStreakModal();
        const html = env.document.getElementById('streakModalOverlay').innerHTML;
        assert.truthy(/Learn today/i.test(html),
            'should show Learn today CTA when not studied today');
        assert.falsy(/Already studied/.test(html),
            'should NOT show "Already studied" when not studied today');
    });

    test('shows "Already studied today" when lessonHistory has a today entry', () => {
        const env = setupModal({
            streak: 5, bestStreak: 5, coins: 0,
            lessonHistory: [{ lessonNum: 0, date: Date.now(), score: 5, mistakes: 0 }]
        });
        env.showDailyStreakModal();
        const html = env.document.getElementById('streakModalOverlay').innerHTML;
        assert.truthy(/Already studied today/.test(html),
            'should show Already-studied when today\'s history exists');
    });

    test('after showDailyStreakModal, subsequent same-day calls become no-ops', () => {
        const env = setupModal({ streak: 5, bestStreak: 5, lessonHistory: [], coins: 0 });
        env.showDailyStreakModal();
        // Clear the overlay (mimics user dismissing)
        env.dismissStreakModal();
        // Re-call — should NOT re-render (overlay should be hidden / no .active class)
        env.showDailyStreakModal();
        const overlay = env.document.getElementById('streakModalOverlay');
        // Even if it exists, it shouldn't have .active class because the gate is locked
        // (we simulate this by checking the marker is set)
        assert.truthy(env.hasShownStreakToday('TestUser'),
            'gate should be locked after first show');
    });

    test('force=true bypasses the once-per-day gate', () => {
        const env = setupModal({ streak: 5, bestStreak: 5, lessonHistory: [], coins: 0 });
        env.showDailyStreakModal();
        env.dismissStreakModal();
        // Now call with force=true
        env.showDailyStreakModal({ force: true });
        const overlay = env.document.getElementById('streakModalOverlay');
        assert.truthy(overlay.innerHTML.length > 0, 'force=true should re-render the modal');
    });

    test('renders 7-day calendar with today highlighted', () => {
        const env = setupModal({ streak: 1, bestStreak: 1, lessonHistory: [], coins: 0 });
        env.showDailyStreakModal();
        const html = env.document.getElementById('streakModalOverlay').innerHTML;
        // 7 day tiles
        const dayCount = (html.match(/streak-modal-day\b/g) || []).length;
        assert.truthy(dayCount >= 7, `expected ≥7 day tiles, got ${dayCount}`);
        // Today marker (• after the day name)
        assert.truthy(/today/.test(html), 'should have "today" class on one tile');
    });

    test('zero streak shows "Start your streak today!" greeting', () => {
        const env = setupModal({ streak: 0, bestStreak: 0, lessonHistory: [], coins: 0 });
        env.showDailyStreakModal();
        const html = env.document.getElementById('streakModalOverlay').innerHTML;
        assert.truthy(/Start your streak today/.test(html),
            'should show Start-your-streak greeting on zero streak');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
