// tests/gen-srs-scheduling.test.js — SRS scheduling deep cases (characterization)
// Complements tests/srs.test.js (basic ladder / ease bounds / due filtering).
// Focus: multi-review interval growth, quality-0 resets, nextReview scheduling,
// due-count semantics, mastered-threshold boundary, exact card shape.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const DAY_MS = 86400000;

function loadWithAppState(initialAppState) {
    const env = loadAppCode();
    env.__setAppState(initialAppState);
    return env;
}

function freshCard(overrides) {
    return Object.assign(
        { interval: 1, ease: 2.5, repetitions: 0, nextReview: 0, lastReview: 0 },
        overrides || {}
    );
}

// ==================== INTERVAL GROWTH (5x quality-2) ====================

// Run the simulation once at load time; emit one test() per step.
const growth = (() => {
    const appState = { srs: { w: freshCard() } };
    const env = loadWithAppState(appState);
    const intervals = [], eases = [], reps = [];
    for (let i = 0; i < 8; i++) {
        env.updateWordSRS('w', 2);
        intervals.push(appState.srs.w.interval);
        eases.push(appState.srs.w.ease);
        reps.push(appState.srs.w.repetitions);
    }
    return { intervals, eases, reps };
})();

suite('gen: srs interval growth (consecutive quality-2)', () => {
    // Characterized SM-2 ladder from a fresh card (interval=1, ease=2.5):
    // rep1→1d, rep2→3d, rep3→round(3*2.6)=8d, rep4→round(8*2.65)=21d, rep5→round(21*2.7)=57d
    const EXPECTED_INTERVALS = [1, 3, 8, 21, 57];
    EXPECTED_INTERVALS.forEach((exp, i) => {
        test(`review ${i + 1}: interval is exactly ${exp} days`, () => {
            assert.equal(growth.intervals[i], exp);
        });
    });

    test('reviews 6-8 keep multiplying with NO upper cap: 157, 440, 1254 days; ease reaches ~2.9', () => {
        // round(57*2.75)=157, round(157*2.8)=440, round(440*2.85)=1254 — intervals and
        // ease both grow unboundedly (only the 1.3 floor exists, no ceiling).
        assert.deepEqual(growth.intervals.slice(5), [157, 440, 1254]);
        assert.inRange(growth.eases[7], 2.899, 2.901);
    });

    test('repetitions climb 1..8 and interval growth is strictly monotonic from review 2 on', () => {
        assert.deepEqual(growth.reps, [1, 2, 3, 4, 5, 6, 7, 8]);
        // Reviews 1→2 onward each strictly increase the interval (review 1
        // stays at 1 day — the restart step — so monotonic-non-decreasing overall).
        for (let i = 1; i < growth.intervals.length; i++) {
            assert.truthy(growth.intervals[i] > growth.intervals[i - 1],
                `interval did not grow at review ${i + 1}: ${growth.intervals.join(',')}`);
        }
    });

    // Ease grows +0.05 per correct: 2.55, 2.60, 2.65, 2.70, 2.75 (float tolerance)
    const EXPECTED_EASES = [2.55, 2.60, 2.65, 2.70, 2.75];
    EXPECTED_EASES.forEach((exp, i) => {
        test(`review ${i + 1}: ease is ~${exp} (+0.05 per correct)`, () => {
            assert.inRange(growth.eases[i], exp - 0.001, exp + 0.001);
        });
    });
});

// ==================== QUALITY-0 RESETS ====================

suite('gen: srs quality-0 resets to the minimum', () => {
    // From any starting interval, a wrong answer collapses to interval=1, reps=0
    [3, 21, 57, 100].forEach((startInterval) => {
        test(`wrong answer at interval=${startInterval} resets interval to 1 and reps to 0`, () => {
            const appState = { srs: { w: freshCard({ interval: startInterval, repetitions: 4 }) } };
            const env = loadWithAppState(appState);
            env.updateWordSRS('w', 0);
            assert.equal(appState.srs.w.interval, 1);
            assert.equal(appState.srs.w.repetitions, 0);
        });
    });

    test('wrong answer drops ease by exactly 0.2 (2.5 → ~2.3)', () => {
        const appState = { srs: { w: freshCard() } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('w', 0);
        assert.inRange(appState.srs.w.ease, 2.299, 2.301);
    });

    test('ease already at the 1.3 floor stays exactly 1.3 on wrong', () => {
        const appState = { srs: { w: freshCard({ ease: 1.3 }) } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('w', 0);
        assert.equal(appState.srs.w.ease, 1.3);
    });

    test('wrong then correct restarts the ladder at rep=1, interval=1', () => {
        const appState = { srs: { w: freshCard({ interval: 21, repetitions: 4 }) } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('w', 0);
        env.updateWordSRS('w', 2);
        assert.equal(appState.srs.w.repetitions, 1);
        assert.equal(appState.srs.w.interval, 1);
    });

    test('quality-0 knocks a mastered word out of mastery (100% → 0%)', () => {
        const appState = { srs: { w: freshCard({ interval: 57, repetitions: 5 }) } };
        const env = loadWithAppState(appState);
        assert.equal(env.getSRSMasteryPercent(), 100);
        env.updateWordSRS('w', 0);
        assert.equal(env.getSRSMasteryPercent(), 0);
    });

    test('any non-zero quality (e.g. 1) is treated as fully correct', () => {
        const appState = { srs: { w: freshCard() } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('w', 1);
        // Identical outcome to quality 2: rep 1, interval 1, ease +0.05.
        assert.equal(appState.srs.w.repetitions, 1);
        assert.equal(appState.srs.w.interval, 1);
        assert.inRange(appState.srs.w.ease, 2.549, 2.551);
    });

    test('correct answer at the 1.3 ease floor still grows ease to exactly 1.35', () => {
        const appState = { srs: { w: freshCard({ ease: 1.3 }) } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('w', 2);
        assert.equal(appState.srs.w.ease, 1.35);
        assert.equal(appState.srs.w.interval, 1); // rep 1 always restarts at 1 day
    });
});

// ==================== NEXTREVIEW SCHEDULING ====================

suite('gen: srs nextReview always > now after update', () => {
    const combos = [
        { label: 'quality 0, fresh card', quality: 0, card: freshCard() },
        { label: 'quality 0, mature card', quality: 0, card: freshCard({ interval: 57, repetitions: 5 }) },
        { label: 'quality 2, fresh card', quality: 2, card: freshCard() },
        { label: 'quality 2, mature card', quality: 2, card: freshCard({ interval: 57, ease: 2.8, repetitions: 5 }) }
    ];
    combos.forEach(({ label, quality, card }) => {
        test(`nextReview > now after update (${label})`, () => {
            const appState = { srs: { w: card } };
            const env = loadWithAppState(appState);
            const before = Date.now();
            env.updateWordSRS('w', quality);
            assert.truthy(appState.srs.w.nextReview > before,
                `nextReview ${appState.srs.w.nextReview} not after ${before}`);
        });
    });

    test('quality-0 schedules the next review ~1 day out', () => {
        const appState = { srs: { w: freshCard({ interval: 57, repetitions: 5 }) } };
        const env = loadWithAppState(appState);
        const before = Date.now();
        env.updateWordSRS('w', 0);
        const diff = appState.srs.w.nextReview - before;
        assert.inRange(diff, DAY_MS, DAY_MS + 5000);
    });

    test('after 5 corrects nextReview is ~57 days out', () => {
        const appState = { srs: { w: freshCard() } };
        const env = loadWithAppState(appState);
        for (let i = 0; i < 5; i++) env.updateWordSRS('w', 2);
        const diff = appState.srs.w.nextReview - Date.now();
        assert.inRange(diff, 57 * DAY_MS - 5000, 57 * DAY_MS);
    });

    test('long-overdue card (1 year past due) still gets a future nextReview', () => {
        const appState = { srs: { w: freshCard({ nextReview: Date.now() - 365 * DAY_MS }) } };
        const env = loadWithAppState(appState);
        const before = Date.now();
        env.updateWordSRS('w', 0);
        // Overdueness is ignored entirely — reschedule is now + interval,
        // so a quality-0 lands exactly ~1 day out regardless of lateness.
        assert.inRange(appState.srs.w.nextReview - before, DAY_MS, DAY_MS + 5000);
    });
});

// ==================== GETREVIEWCOUNT (DUE-ONLY) ====================

suite('gen: getReviewCount counts only due cards', () => {
    test('returns 0 for an empty srs map', () => {
        const env = loadWithAppState({ srs: {} });
        assert.equal(env.getReviewCount(), 0);
    });

    test('counts past-due cards and skips future ones (3 due + 2 future → 3)', () => {
        const past = Date.now() - DAY_MS;
        const future = Date.now() + DAY_MS;
        const env = loadWithAppState({
            srs: {
                a: freshCard({ nextReview: past }),
                b: freshCard({ nextReview: past }),
                c: freshCard({ nextReview: past }),
                d: freshCard({ nextReview: future }),
                e: freshCard({ nextReview: future })
            }
        });
        assert.equal(env.getReviewCount(), 3);
    });

    test('a card 1ms past due is counted; a far-future card is never counted', () => {
        const env = loadWithAppState({
            srs: {
                justDue: freshCard({ nextReview: Date.now() - 1 }),
                farOut: freshCard({ nextReview: Date.now() + 365 * DAY_MS })
            }
        });
        assert.equal(env.getReviewCount(), 1);
        assert.deepEqual(env.getWordsDueForReview(), ['justDue']);
    });

    test('reviewing a due card removes it from the count (1 → 0)', () => {
        const appState = { srs: { w: freshCard({ nextReview: Date.now() - DAY_MS }) } };
        const env = loadWithAppState(appState);
        assert.equal(env.getReviewCount(), 1);
        env.updateWordSRS('w', 2);
        assert.equal(env.getReviewCount(), 0);
    });

    test('a freshly initWordSRS-ed card is not yet due (scheduled for tomorrow)', () => {
        const appState = { srs: {} };
        const env = loadWithAppState(appState);
        env.initWordSRS('brand-new');
        assert.equal(env.getReviewCount(), 0);
    });

    test('dueness is purely nextReview-based — low interval/reps alone do not make a card due', () => {
        const env = loadWithAppState({
            srs: { w: freshCard({ interval: 1, repetitions: 0, nextReview: Date.now() + DAY_MS }) }
        });
        assert.equal(env.getReviewCount(), 0);
    });

    test('a card with nextReview exactly at now counts as due (<= boundary)', () => {
        // nextReview is stamped before the check runs; Date.now() only moves
        // forward, so `nextReview <= now` must hold at check time.
        const env = loadWithAppState({ srs: { w: freshCard({ nextReview: Date.now() }) } });
        assert.equal(env.getReviewCount(), 1);
    });

    test('getWordsDueForReview returns exactly the due word keys', () => {
        const past = Date.now() - DAY_MS;
        const future = Date.now() + DAY_MS;
        const env = loadWithAppState({
            srs: {
                apple: freshCard({ nextReview: past }),
                banana: freshCard({ nextReview: future }),
                cherry: freshCard({ nextReview: past })
            }
        });
        assert.deepEqual(env.getWordsDueForReview().sort(), ['apple', 'cherry']);
    });
});

// ==================== MASTERED THRESHOLD ====================

suite('gen: SRS_MASTERED_INTERVAL & mastered detection (>=)', () => {
    test('SRS_MASTERED_INTERVAL is exactly 14 and agrees with the hardcoded filter', () => {
        const env = loadAppCode();
        // NOTE: getSRSMasteryPercent hardcodes `interval >= 14` rather than
        // referencing this constant — if 14 here ever changes, that filter
        // silently drifts. Pin the constant AND prove the filter follows it today.
        assert.equal(env.SRS_MASTERED_INTERVAL, 14);
        env.__setAppState({ srs: { w: freshCard({ interval: 14 }) } });
        assert.equal(env.getSRSMasteryPercent(), 100,
            'filter must treat interval 14 as mastered, matching the constant');
    });

    test('stack thresholds are exactly LEARNING=7, REVIEWING=21, MASTERED=14, GRADUATED=30', () => {
        const env = loadAppCode();
        assert.deepEqual(
            [env.SRS_LEARNING_MAX, env.SRS_REVIEWING_MAX, env.SRS_MASTERED_INTERVAL, env.SRS_GRADUATED_INTERVAL],
            [7, 21, 14, 30]);
    });

    test('mastery percent uses Math.round: 1 of 3 → 33, 2 of 3 → 67', () => {
        const env = loadAppCode();
        const state = {
            srs: {
                a: freshCard({ interval: 14, repetitions: 5 }),
                b: freshCard({ interval: 1 }),
                c: freshCard({ interval: 1 })
            }
        };
        env.__setAppState(state);
        assert.equal(env.getSRSMasteryPercent(), 33);
        state.srs.b.interval = 14;
        assert.equal(env.getSRSMasteryPercent(), 67);
    });

    test('interval exactly at SRS_MASTERED_INTERVAL counts as mastered (>= boundary)', () => {
        const env = loadAppCode();
        env.__setAppState({
            srs: { w: freshCard({ interval: env.SRS_MASTERED_INTERVAL, repetitions: 5 }) }
        });
        assert.equal(env.getSRSMasteryPercent(), 100);
    });

    test('intervals just below the threshold (13, 13.999) are NOT mastered', () => {
        const env = loadAppCode();
        env.__setAppState({
            srs: {
                a: freshCard({ interval: 13, repetitions: 5 }),
                b: freshCard({ interval: 13.999, repetitions: 5 })
            }
        });
        assert.equal(env.getSRSMasteryPercent(), 0);
    });
});

// ==================== CARD CREATION SHAPE ====================

suite('gen: card creation initializes the exact expected shape', () => {
    test('new card has exactly these keys in insertion order', () => {
        const appState = { srs: {} };
        const env = loadWithAppState(appState);
        env.initWordSRS('shape');
        assert.deepEqual(Object.keys(appState.srs.shape),
            ['interval', 'ease', 'repetitions', 'nextReview', 'lastReview']);
    });

    test('new card starts at interval=1, ease=2.5, repetitions=0', () => {
        const appState = { srs: {} };
        const env = loadWithAppState(appState);
        env.initWordSRS('shape');
        const card = appState.srs.shape;
        assert.equal(card.interval, 1);
        assert.equal(card.ease, 2.5);
        assert.equal(card.repetitions, 0);
    });

    test('new card schedules nextReview exactly one day after lastReview', () => {
        const appState = { srs: {} };
        const env = loadWithAppState(appState);
        env.initWordSRS('shape');
        const card = appState.srs.shape;
        // nextReview uses Date.now() a hair before lastReview's Date.now()
        assert.inRange(card.nextReview - card.lastReview, DAY_MS - 1000, DAY_MS);
    });

    test('new card lastReview is stamped at creation time', () => {
        const appState = { srs: {} };
        const env = loadWithAppState(appState);
        const before = Date.now();
        env.initWordSRS('shape');
        assert.inRange(appState.srs.shape.lastReview, before, before + 5000);
    });

    test('updateWordSRS mutates in place without adding new fields', () => {
        const appState = { srs: { w: freshCard() } };
        const env = loadWithAppState(appState);
        env.updateWordSRS('w', 2);
        env.updateWordSRS('w', 0);
        assert.deepEqual(Object.keys(appState.srs.w).sort(),
            ['ease', 'interval', 'lastReview', 'nextReview', 'repetitions']);
    });

    test('updateWordSRS on an untracked word is a silent no-op', () => {
        const appState = { srs: {} };
        const env = loadWithAppState(appState);
        env.updateWordSRS('never-seen', 2);
        assert.falsy(appState.srs['never-seen'], 'no card should be created');
        assert.equal(Object.keys(appState.srs).length, 0);
    });

    test('updateWordSRS with no srs map at all is a silent no-op (does not create the map)', () => {
        const appState = {};
        const env = loadWithAppState(appState);
        env.updateWordSRS('anything', 2); // must not throw
        assert.equal(appState.srs, undefined, 'srs map should not be created');
    });

    test('initWordSRS on an already-tracked word is a no-op (existing card preserved)', () => {
        const original = freshCard({ interval: 57, ease: 2.8, repetitions: 5, nextReview: 12345, lastReview: 999 });
        const appState = { srs: { w: original } };
        const env = loadWithAppState(appState);
        env.initWordSRS('w');
        assert.equal(appState.srs.w, original, 'same object reference — not replaced');
        assert.deepEqual(appState.srs.w,
            { interval: 57, ease: 2.8, repetitions: 5, nextReview: 12345, lastReview: 999 });
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
