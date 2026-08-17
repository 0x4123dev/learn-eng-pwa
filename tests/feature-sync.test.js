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
    'lessons.js', 'units.js', 'grammar-ui.js', 'phrases.js', 'collocation.js',
    'wordform.js', 'rewrite.js', 'verbs.js', 'math.js', 'exam.js',
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

    test('every English practice module awards pet-shop coins', () => {
        // math.js is deliberately outside the pet economy — it feeds the streak
        // and the admin timeline, but not the coin balance. If that changes,
        // move it into this list rather than loosening the rule.
        for (const f of PRACTICE_MODULES.filter(f => f !== 'math.js')) {
            assert.truthy(/appState\.coins/.test(read(f)), `${f} never awards coins`);
        }
        assert.falsy(/appState\.coins/.test(read('math.js')),
            'math.js now awards coins — add it to the list above');
    });

    test('profile derives accuracy and session count from all skills, not legacy counters', () => {
        const src = read('profile.js');
        assert.truthy(src.includes('getHomeSkillStats'), 'accuracy ignores non-lesson practice');
        assert.truthy(src.includes('_homeAllSessionsCount'), 'lesson count ignores non-lesson practice');
    });

    test('admin sync payload covers every history the app records', () => {
        const src = read('auth.js');
        for (const h of ['lessonHistory', 'grammarHistory', 'phrasesHistory', 'collocHistory',
            'wordformHistory', 'rewriteHistory', 'unitsHistory', 'mathHistory', 'speedChallenge']) {
            assert.truthy(src.includes(h), `auth.js sync payload misses ${h}`);
        }
    });

    test('the server accepts every activity type the client sends', () => {
        // The failure this pins is SILENT: an unlisted type makes clean()
        // return null, the row is dropped, the response is still ok, and the
        // client marks it synced and never retries. Collocation and Math were
        // both uploaded and both discarded this way for as long as they existed.
        const client = [...new Set([...read('auth.js').matchAll(/type:\s*'([a-z]+)'/g)].map(m => m[1]))];
        const server = fs.readFileSync(
            path.join(__dirname, '..', 'functions', 'api', 'activity.js'), 'utf8');
        const m = /const TYPES = \[([^\]]*)\]/.exec(server);
        assert.truthy(m, 'functions/api/activity.js no longer declares a TYPES whitelist');
        const accepted = [...m[1].matchAll(/'([a-z]+)'/g)].map(x => x[1]);
        assert.truthy(client.length >= 8, `only found ${client.length} client types — the scan broke`);
        const rejected = client.filter(t => !accepted.includes(t));
        assert.deepEqual(rejected, [],
            `these would be dropped on the server: ${rejected.join(', ')}`);
    });

    test('the admin dashboard has a label for every accepted type', () => {
        // An unlabelled kind still renders — as the bare word "math" with no
        // pill colour, which reads as a bug on a parent's screen.
        const server = fs.readFileSync(
            path.join(__dirname, '..', 'functions', 'api', 'activity.js'), 'utf8');
        const accepted = [...(/const TYPES = \[([^\]]*)\]/.exec(server)[1]).matchAll(/'([a-z]+)'/g)]
            .map(x => x[1]);
        const admin = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
        const labels = /const KIND_LABEL = \{([^}]*)\}/.exec(admin);
        assert.truthy(labels, 'admin.html no longer declares KIND_LABEL');
        const missing = accepted.filter(t => !new RegExp('\\b' + t + '\\s*:').test(labels[1]));
        assert.deepEqual(missing, [], `admin.html has no label for: ${missing.join(', ')}`);
        // exam comes from the attempts table, not from activity types.
        assert.truthy(/\bexam\s*:/.test(labels[1]), 'exam attempts need a label too');
    });

    test('a sync epoch bump re-uploads a window that was silently dropped', () => {
        const src = read('auth.js');
        assert.truthy(/const SYNC_EPOCH = \d+/.test(src), 'auth.js lost its sync epoch');
        assert.truthy(/acct\.syncEpoch !== SYNC_EPOCH/.test(src),
            'nothing forgets the stale "already synced" marks, so lost activities stay lost');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
