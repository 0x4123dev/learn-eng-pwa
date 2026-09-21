// feature-sync.test.js — cross-feature consistency: every practice type's
// completion path must participate in the shared systems (daily streak via
// recordStudy, admin sync via EngAuth.syncNow, +5-coins-per-correct reward).
// Source-level pins: if a new tab is added or a handler is refactored and
// one of these calls is dropped, this suite fails.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const read = f => fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8');

// Every module with a practice-completion handler. Since the 2026-09 cut the
// Book practice (js/units.js) is the only exercise in the app.
const PRACTICE_MODULES = ['units.js'];

suite('feature sync: shared systems coverage', () => {
    test('every practice module records the daily streak (recordStudy)', () => {
        for (const f of PRACTICE_MODULES) {
            assert.truthy(read(f).includes('recordStudy()'), `${f} never calls recordStudy()`);
        }
    });

    test('every practice module triggers a server sync on completion', () => {
        for (const f of PRACTICE_MODULES) {
            const src = read(f);
            assert.truthy(src.includes('EngAuth.syncNow'), `${f} never syncs to the server`);
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
            assert.truthy(/petCheerAnswer\(/.test(src), `${f} does not cheer answers`);
            assert.truthy(/petComboBonus\(\)/.test(src),
                `${f} cheers combos but never banks them — the bonus leaks to another tab`);
        }
    });

    test('profile derives accuracy and session count from all skills, not legacy counters', () => {
        const src = read('profile.js');
        assert.truthy(src.includes('getHomeSkillStats'), 'accuracy ignores non-lesson practice');
        assert.truthy(src.includes('_homeAllSessionsCount'), 'lesson count ignores non-lesson practice');
    });

    test('admin sync payload covers every history the app records', () => {
        // The set of histories is read out of the app itself, so a new
        // `appState.fooHistory` writer that auth.js does not upload fails here.
        const histories = new Set();
        for (const f of fs.readdirSync(path.join(__dirname, '..', 'js')).filter(f => f.endsWith('.js'))) {
            for (const m of read(f).matchAll(/appState\.(\w+History)\b/g)) histories.add(m[1]);
        }
        assert.deepEqual([...histories].sort(), ['unitsHistory'], 'the Book practice history is the only one left');
        const src = read('auth.js');
        for (const h of histories) {
            assert.truthy(src.includes('appState.' + h), `auth.js sync payload misses ${h}`);
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
        // Since the 2026-09 cut the client uploads ONE type ('lesson', the
        // Book units); the guard only has to prove the scan found it.
        assert.truthy(client.length >= 1, `found no client types — the scan broke`);
        assert.truthy(client.includes('lesson'), 'the Book units upload as lesson');
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
    harness.runAll().then(code => process.exit(code));
}
