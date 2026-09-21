// cross-boundary-drift.test.js — values that MUST be identical in two places
// that cannot import each other.
//
// This project has two runtimes that never share a module: the browser
// (js/*.js, classic scripts) and Cloudflare Pages Functions (functions/**,
// ESM). Any value duplicated across that boundary can drift, and drift there
// fails SILENTLY — nothing throws, the feature just quietly does the wrong
// thing. The same is true of two tables inside the browser that are keyed by
// the same string and cannot check each other.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ---- the pet -------------------------------------------------------------
// DOG_STAGES (js/home.js) decides which breed a level maps to. petart.js keeps
// TWO parallel tables keyed by the same stageCss, and both fall back to
// chihuahua on a miss — so a breed added to DOG_STAGES alone would render a
// level-200 Tibetan Mastiff as a chihuahua, with nothing thrown and nothing logged.
//
// tests/petart.test.js derives its breed list from PET_BREED_LOOKS itself, so
// it can only ever prove that table matches itself. These anchor to
// DOG_STAGES, which is where a new breed actually gets added.
suite('drift: pet breeds', () => {
    const { loadAppCode } = require('./setup');
    const env = loadAppCode();
    const art = require(path.join(ROOT, 'js', 'petart.js'));
    const stages = env.DOG_STAGES;

    test('DOG_STAGES is the source of truth and is well formed', () => {
        assert.truthy(Array.isArray(stages) && stages.length >= 10, 'DOG_STAGES missing');
        assert.equal(new Set(stages.map(s => s.stageCss)).size, stages.length, 'duplicate stageCss');
    });

    test('every breed has art AND an accent, not a silent chihuahua', () => {
        for (const st of stages) {
            assert.truthy(art.PET_BREED_LOOKS[st.stageCss],
                `breed "${st.stageCss}" would silently render as a chihuahua`);
            assert.truthy(art.PET_STAGE_ACCENT[st.stageCss],
                `breed "${st.stageCss}" has no accent colour and would fall back`);
        }
    });

    test('the art tables carry no breeds DOG_STAGES never awards', () => {
        const known = new Set(stages.map(s => s.stageCss));
        for (const table of ['PET_BREED_LOOKS', 'PET_STAGE_ACCENT']) {
            const orphans = Object.keys(art[table]).filter(k => !known.has(k));
            assert.equal(orphans.join(', '), '', `${table} has keys no level can reach — likely a typo`);
        }
    });

    test('stage thresholds ascend, because getDogStage scans backwards', () => {
        assert.equal(stages[0].minLevel, 1, 'a level-1 pet must match the first stage');
        for (let i = 1; i < stages.length; i++) {
            assert.truthy(stages[i].minLevel > stages[i - 1].minLevel,
                `minLevel ${stages[i].minLevel} does not follow ${stages[i - 1].minLevel} — the wrong breed would be picked`);
        }
    });

    test('every stage uses the live breed-specific SVG rather than stale raster art', () => {
        for (const st of stages) {
            assert.falsy(st.img, `${st.stageCss} still points at old raster breed art`);
            assert.truthy(art.petDogSVG({ stageCss: st.stageCss }).includes(`data-breed="${st.stageCss}"`));
        }
    });

    // Levelling up offline is exactly when a child is most likely to be
    // offline — on a plane, in a car — so the reward must not 404.
    test('the self-contained SVG renderer is precached by the service worker', () => {
        const sw = read('sw.js');
        assert.truthy(sw.includes("'/js/petart.js'"), 'pet SVG renderer would vanish offline');
        assert.falsy(sw.includes('/img/pets/diamond.png'), 'obsolete fantasy dog is still downloaded');
    });

    // The opponent's breed arrives over the network, so it may be a breed this
    // build has never heard of. That must degrade, not break.
    test('an unknown breed from the network degrades safely', () => {
        assert.equal(art.petBreedLook('breed-from-a-newer-app'), art.PET_BREED_LOOKS.chihuahua);
        assert.equal(art.petStageAccent('breed-from-a-newer-app'), art.PET_STAGE_ACCENT.chihuahua);
    });
});

// ---- the Books -------------------------------------------------------------
// The unit list is DERIVED from the word bank rather than declared twice, so
// it cannot drift by construction. These tests protect that property and the
// data it depends on.
suite('drift: Book units', () => {
    const unitsSrc = read('js/units.js');

    test('the unit list is derived from the bank, never hardcoded', () => {
        const fn = unitsSrc.slice(unitsSrc.indexOf('function unitsList'), unitsSrc.indexOf('// ---- unit keys ----'));
        assert.truthy(/unitsBank\(/.test(fn), 'unitsList must read the data');
        assert.falsy(/\[\s*1\s*,\s*2\s*,/.test(fn), 'a hardcoded unit list would drift from the words');
    });

    test('every unit in every word set has words behind its card', () => {
        // units.js reads the banks off the globals, the way the browser does.
        const { UNIT_WORDS_PR1, UNIT_WORDS_PR2, UNIT_WORDS_PR3 } = require(path.join(ROOT, 'js', 'word-data.js'));
        global.UNIT_WORDS_PR1 = UNIT_WORDS_PR1;
        global.UNIT_WORDS_PR2 = UNIT_WORDS_PR2;
        global.UNIT_WORDS_PR3 = UNIT_WORDS_PR3;
        const units = require(path.join(ROOT, 'js', 'units.js'));

        const sizes = { pr1: 15, pr2: 15, pr3: 15 };
        for (const [set, want] of Object.entries(sizes)) {
            const list = units.unitsList(set);
            assert.truthy(list.length >= want, `${set}: only ${list.length} units`);
            for (const u of list) {
                assert.truthy(units._unitPool(units._unitKey(set, u)).length > 0,
                    `${set} Unit ${u} renders a card with no words`);
            }
            // Mix must see the whole set, or "N units" on the card is a lie.
            assert.equal(units._unitPool(units._unitKey(set, 'mix')).length, units.unitsBank(set).length);
        }
        assert.equal(units.unitsBank('pr1').length, UNIT_WORDS_PR1.length);
        assert.equal(units.unitsBank('pr2').length, UNIT_WORDS_PR2.length);
        assert.equal(units.unitsBank('pr3').length, UNIT_WORDS_PR3.length);
    });

    test('the mastery target is read from the constant, not retyped', () => {
        const render = unitsSrc.slice(unitsSrc.indexOf('function renderUnitsBar'), unitsSrc.indexOf('// ---- celebration'));
        assert.truthy(render.includes('UNIT_MASTERY_TARGET'), 'the card must use the constant');
        assert.falsy(/\$\{perfect\}\/10 /.test(render), 'a hardcoded 10 would drift from the rule');
    });
});

// ---- activity sync ---------------------------------------------------------
suite('drift: every practice module reaches the admin dashboard', () => {
    // _localHistoryItems() in js/auth.js enumerates each module's history by
    // hand. A new tab that forgets to add itself syncs NOTHING — the child's
    // work simply never appears in the dashboard, with no error anywhere.
    // This derives the list from the app instead of trusting a second copy.
    const EXCLUDED = {};

    test('no practice history is silently left out of the sync', () => {
        const found = new Set();
        for (const f of fs.readdirSync(path.join(ROOT, 'js')).filter(f => f.endsWith('.js'))) {
            const src = read('js/' + f);
            for (const m of src.matchAll(/appState\.([a-zA-Z]*[Hh]istory)\b/g)) found.add(m[1]);
        }
        const auth = read('js/auth.js');
        const synced = new Set([...auth.matchAll(/appState\.([a-zA-Z]*[Hh]istory)\b/g)].map(m => m[1]));
        const missing = [...found].filter(h => !synced.has(h) && !(h in EXCLUDED));
        assert.equal(missing.join(', '), '',
            'this history never syncs — the child\'s work would be invisible to the dashboard');
    });

    test('the exclusions still exist, so the list cannot rot', () => {
        const all = read('js/auth.js') + Object.keys(EXCLUDED).map(k => k).join(' ');
        for (const key of Object.keys(EXCLUDED)) {
            const used = fs.readdirSync(path.join(ROOT, 'js'))
                .some(f => f.endsWith('.js') && read('js/' + f).includes('appState.' + key));
            assert.truthy(used, `${key} is excluded from sync but no longer exists — drop the exclusion`);
        }
    });
});

suite('drift: the username rule', () => {
    // Already pinned in tests/username.test.js; asserted here too so the whole
    // cross-boundary inventory lives in one place.
    test('the client and the register endpoint share one pattern', () => {
        const srv = read('functions/api/register.js').match(/(\/\^\[[^\n]*?\/u)\.test\(username\)/);
        const cli = read('js/auth.js').match(/const USERNAME_RE = (\/\^\[[^\n]*?\/u);/);
        assert.truthy(srv && cli, 'username pattern missing on one side');
        assert.equal(cli[1], srv[1], 'the username rule differs between client and server');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
