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

    test('every practice module awards pet-shop coins', () => {
        for (const f of PRACTICE_MODULES) {
            assert.truthy(/appState\.coins/.test(read(f)), `${f} never awards coins`);
        }
    });

    test('every module that cheers an answer also banks the combo bonus', () => {
        // petCheerAnswer pops "+N 🪙" on each streak; petComboBonus() is what
        // pays and RESETS it. A module that cheers without banking leaves the
        // unclaimed total to ride into whichever practice finishes next —
        // which is what maths did until v4.11.8.
        for (const f of PRACTICE_MODULES) {
            const src = read(f);
            if (!/petCheerAnswer\(/.test(src)) continue;
            assert.truthy(/petComboBonus\(\)/.test(src),
                `${f} cheers combos but never banks them — the bonus leaks to another tab`);
        }
    });

    test('maths pays half the English rate, from one named constant', () => {
        const src = read('math.js');
        const m = /const MATH_COINS_PER_CORRECT = (\d+)/.exec(src);
        assert.truthy(m, 'math.js should name its coin rate rather than inlining it');
        assert.equal(Number(m[1]), 2);
        assert.truthy(/score \* MATH_COINS_PER_CORRECT/.test(src), 'the rate must actually be used');
        // The pet card turns "coins still needed" into "questions still to
        // answer". Quoting the English rate on the maths screen halves it.
        assert.truthy(/petRewardCardHTML\(score, total, coinsEarned, MATH_COINS_PER_CORRECT\)/.test(src),
            'the maths reward card must be told the maths rate');
        const pet = read('petcheer.js');
        assert.truthy(/Math\.ceil\(left \/ rate\)/.test(pet),
            'petcheer.js still hardcodes the questions-remaining rate');
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
