// feature-sync.test.js — cross-feature consistency: every practice type's
// completion path must participate in the shared systems (daily streak via
// recordStudy, admin sync via EngAuth.syncNow, +5-coins-per-correct reward).
// Source-level pins: if a new tab is added or a handler is refactored and
// one of these calls is dropped, this suite fails.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

// Every module with a practice-completion handler.
const PRACTICE_MODULES = [
    'lessons.js', 'units.js', 'grammar-ui.js', 'phrases.js',
    'wordform.js', 'rewrite.js', 'verbs.js', 'exam.js',
];

suite('feature sync: shared systems coverage', () => {
    test('every practice module records the daily streak (recordStudy)', () => {
        for (const f of [...PRACTICE_MODULES, 'daily-challenge.js']) {
            assert.truthy(read(f).includes('recordStudy()'), `${f} never calls recordStudy()`);
        }
    });

    test('every practice module triggers a server sync on completion', () => {
        // exam.js posts through the dedicated attempts endpoint; the rest
        // upload their history via the generic syncNow backfill.
        for (const f of PRACTICE_MODULES) {
            const src = read(f);
            assert.truthy(src.includes('EngAuth.syncNow') || src.includes('EngAuth.postAttempt'),
                `${f} never syncs to the server`);
        }
    });

    test('every practice module awards pet-shop coins', () => {
        for (const f of PRACTICE_MODULES) {
            assert.truthy(/appState\.coins/.test(read(f)), `${f} never awards coins`);
        }
    });

    test('profile derives accuracy and session count from all skills, not legacy counters', () => {
        const src = read('profile.js');
        assert.truthy(src.includes('getHomeSkillStats'), 'accuracy ignores non-lesson practice');
        assert.truthy(src.includes('_homeAllSessionsCount'), 'lesson count ignores non-lesson practice');
    });

    test('admin sync payload covers every history the app records', () => {
        const src = read('auth.js');
        for (const h of ['lessonHistory', 'grammarHistory', 'phrasesHistory',
            'wordformHistory', 'rewriteHistory', 'unitsHistory', 'speedChallenge']) {
            assert.truthy(src.includes(h), `auth.js sync payload misses ${h}`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
