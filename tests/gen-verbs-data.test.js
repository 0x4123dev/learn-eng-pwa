// gen-verbs-data.test.js — deep characterization of the irregular verbs
// dataset (js/vocabulary.js `irregularVerbs`) that powers the Verbs tab
// Speed Challenge (js/verbs.js). Pins: exact count (257 — the source
// comment still says "100 Common Irregular Verbs" but the bank outgrew it),
// key set, level distribution 1..5, v1 uniqueness, the 24 legitimately
// invariant verbs (cut/cut/cut style), slash-alternative form shapes, and
// that every example sentence actually uses a form of its verb.
// No other test file touches irregularVerbs (only ieltsVocabulary is covered
// by gen-vocabulary-data.test.js / integration.test.js).
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();
const VERBS = env.irregularVerbs;

// Split "burnt/burned"-style alternatives into individual lowercase forms.
function formsOf(v) {
    const out = new Set();
    for (const f of [v.v1, v.v2, v.v3]) {
        f.split('/').forEach(p => out.add(p.trim().toLowerCase()));
    }
    return [...out];
}

// True when the ex sentence contains one of the verb's exact forms as a word.
function exMentionsExactForm(v) {
    const words = v.ex.toLowerCase().replace(/[^a-z']/g, ' ').split(/\s+/);
    return formsOf(v).some(f => words.includes(f));
}

// Tolerant matcher: exact forms plus simple inflections of the base
// (crows, fitting, shaving …). This is the reality of the data — 7 exes
// only use an inflected base form (pinned in a test below).
function exMentionsVerb(v) {
    if (exMentionsExactForm(v)) return true;
    const words = v.ex.toLowerCase().replace(/[^a-z']/g, ' ').split(/\s+/);
    const b = v.v1.toLowerCase();
    const derived = [b + 's', b + 'es', b + 'ing'];
    if (b.endsWith('e')) derived.push(b.slice(0, -1) + 'ing');
    return derived.some(d => words.includes(d));
}

suite('gen: irregular verbs count & shape', () => {
    test('bank has exactly 257 verbs (source comment says 100 — long outgrown)', () => {
        assert.truthy(Array.isArray(VERBS), 'irregularVerbs is an array');
        assert.equal(VERBS.length, 257);
    });

    test('every entry is a plain object with exactly the keys ex,level,v1,v2,v3,vi', () => {
        VERBS.forEach((v, i) => {
            assert.truthy(v && typeof v === 'object' && !Array.isArray(v), `entry ${i}`);
            assert.equal(Object.keys(v).sort().join(','), 'ex,level,v1,v2,v3,vi',
                `entry ${i} (${v.v1})`);
        });
    });

    test('v1, v2, v3, vi and ex are non-empty trimmed strings on every entry', () => {
        VERBS.forEach((v, i) => {
            for (const k of ['v1', 'v2', 'v3', 'vi', 'ex']) {
                assert.truthy(typeof v[k] === 'string' && v[k].length > 0,
                    `entry ${i} (${v.v1}) field ${k} non-empty`);
                assert.equal(v[k], v[k].trim(), `entry ${i} (${v.v1}) field ${k} trimmed`);
            }
        });
    });

    test('every level is an integer within the observed 1..5 range', () => {
        for (const v of VERBS) {
            assert.truthy(Number.isInteger(v.level), `${v.v1} level is integer`);
            assert.inRange(v.level, 1, 5, `${v.v1} level`);
        }
    });

    test('level distribution pinned: 27/28/51/91/60 — every game level has verbs', () => {
        // verbs.js:128 filters `v.level === level`; a zero-count level would
        // break the Speed Challenge, so pinning the exact distribution also
        // guards that every level 1..5 is non-empty.
        const dist = {};
        for (const v of VERBS) dist[v.level] = (dist[v.level] || 0) + 1;
        assert.deepEqual(dist, { 1: 27, 2: 28, 3: 51, 4: 91, 5: 60 });
    });

    test('all 257 v1 base forms are unique', () => {
        const unique = new Set(VERBS.map(v => v.v1));
        assert.equal(unique.size, VERBS.length);
    });

    test('every v1 is lowercase a-z only — no spaces, hyphens, digits or slashes', () => {
        VERBS.forEach((v, i) => {
            assert.truthy(/^[a-z]+$/.test(v.v1), `entry ${i}: ${JSON.stringify(v.v1)}`);
        });
    });

    test('first entry is "be" (full shape pinned), last is "wring"', () => {
        assert.deepEqual(VERBS[0], {
            v1: 'be', v2: 'was/were', v3: 'been',
            vi: 'thì/là/ở (động từ to be)',
            ex: 'I want to be a doctor in the future.', level: 1
        });
        const last = VERBS[VERBS.length - 1];
        assert.equal(last.v1, 'wring');
        assert.equal(last.v2, 'wrung');
        assert.equal(last.v3, 'wrung');
    });
});

suite('gen: verb form patterns', () => {
    test('exactly 24 invariant verbs (v1===v2===v3) — all legitimately no-change', () => {
        const inv = VERBS.filter(v => v.v1 === v.v2 && v.v2 === v.v3).map(v => v.v1).sort();
        assert.equal(inv.length, 24);
        assert.deepEqual(inv, [
            'beset', 'bet', 'bid', 'broadcast', 'burst', 'cast', 'cost', 'cut',
            'forecast', 'hit', 'hurt', 'let', 'put', 'quit', 'read', 'rid',
            'set', 'shed', 'shut', 'slit', 'split', 'spread', 'thrust', 'upset'
        ]);
    });

    test('no invariant verb carries slash alternatives — each is a single form', () => {
        const inv = VERBS.filter(v => v.v1 === v.v2 && v.v2 === v.v3);
        for (const v of inv) {
            assert.falsy(v.v1.includes('/'), `${v.v1} has no slash`);
        }
    });

    test('36 v2s and 42 v3s carry slash alternatives; every part is a lowercase word', () => {
        assert.equal(VERBS.filter(v => v.v2.includes('/')).length, 36);
        assert.equal(VERBS.filter(v => v.v3.includes('/')).length, 42);
        for (const v of VERBS) {
            for (const f of [v.v2, v.v3]) {
                for (const part of f.split('/')) {
                    assert.truthy(/^[a-z]+$/.test(part),
                        `${v.v1} form part ${JSON.stringify(part)}`);
                }
            }
        }
    });

    test('only chide and cleave list three slash alternatives in one form', () => {
        const triple = VERBS
            .filter(v => [v.v2, v.v3].some(f => f.split('/').length > 2))
            .map(v => v.v1);
        assert.deepEqual(triple, ['chide', 'cleave']);
        assert.equal(VERBS.find(v => v.v1 === 'cleave').v2, 'cleft/clove/cleaved');
    });

    test('form-pattern taxonomy: beat is the only v1===v2!==v3; 6 verbs are v1===v3!==v2; 127 are v2===v3!==v1', () => {
        const abb = VERBS.filter(v => v.v1 === v.v2 && v.v2 !== v.v3).map(v => v.v1);
        assert.deepEqual(abb, ['beat']); // beat/beat/beaten
        const aba = VERBS.filter(v => v.v1 === v.v3 && v.v1 !== v.v2).map(v => v.v1).sort();
        assert.deepEqual(aba, ['become', 'come', 'outrun', 'overcome', 'overrun', 'run']);
        assert.equal(VERBS.filter(v => v.v2 === v.v3 && v.v1 !== v.v2).length, 127);
    });

    test('classic spot-checks: go, write, get, read keep their textbook forms', () => {
        const go = VERBS.find(v => v.v1 === 'go');
        assert.deepEqual([go.v2, go.v3, go.level], ['went', 'gone', 1]);
        const write = VERBS.find(v => v.v1 === 'write');
        assert.deepEqual([write.v2, write.v3, write.level], ['wrote', 'written', 2]);
        const get = VERBS.find(v => v.v1 === 'get');
        assert.deepEqual([get.v2, get.v3], ['got', 'got/gotten']);
        const read = VERBS.find(v => v.v1 === 'read');
        assert.deepEqual([read.v2, read.v3, read.level], ['read', 'read', 2]);
    });

    test('levels first appear at indices 0/27/55/80/157 but later entries interleave', () => {
        const firstIdx = {};
        VERBS.forEach((v, i) => { if (!(v.level in firstIdx)) firstIdx[v.level] = i; });
        assert.deepEqual(firstIdx, { 1: 0, 2: 27, 3: 55, 4: 80, 5: 157 });
        // The array is NOT strictly level-sorted: the appended v-tail block
        // mixes level-4 verbs (e.g. sneak, sweat) into the level-5 run.
        let sorted = true;
        for (let i = 1; i < VERBS.length; i++) {
            if (VERBS[i].level < VERBS[i - 1].level) { sorted = false; break; }
        }
        assert.falsy(sorted, 'array is not fully sorted by level');
    });
});

suite('gen: vi & ex text quality', () => {
    test('every vi has no double spaces, is not ASCII-capitalized, and contains Vietnamese diacritics', () => {
        VERBS.forEach((v, i) => {
            assert.falsy(/ {2}/.test(v.vi), `double space in vi of ${v.v1}`);
            assert.falsy(/^[A-Z]/.test(v.vi), `vi of ${v.v1} starts uppercase`);
            // Every single meaning genuinely uses Vietnamese (non-ASCII) letters.
            assert.falsy(/^[\x00-\x7F]*$/.test(v.vi), `vi of ${v.v1} is ASCII-only`);
        });
        // All 257 meanings are distinct and span exactly 12..44 chars.
        assert.equal(new Set(VERBS.map(v => v.vi)).size, VERBS.length);
        const lens = VERBS.map(v => v.vi.length);
        assert.equal(Math.min.apply(null, lens), 12);
        assert.equal(Math.max.apply(null, lens), 44);
    });

    test('every ex ends with ".", "!" or "?" and starts with a capital/quote/digit', () => {
        for (const v of VERBS) {
            assert.truthy(/[.!?]$/.test(v.ex), `${v.v1}: ${JSON.stringify(v.ex)}`);
            assert.truthy(/^[A-Z"'0-9]/.test(v.ex), `${v.v1}: ${JSON.stringify(v.ex)}`);
        }
    });

    test('ex lengths span exactly 29..68 chars and 5..11 words, and all 257 are unique', () => {
        assert.equal(new Set(VERBS.map(v => v.ex)).size, VERBS.length);
        const lens = VERBS.map(v => v.ex.length);
        assert.equal(Math.min.apply(null, lens), 29);
        assert.equal(Math.max.apply(null, lens), 68);
        const wcs = VERBS.map(v => v.ex.trim().split(/\s+/).length);
        assert.equal(Math.min.apply(null, wcs), 5);
        assert.equal(Math.max.apply(null, wcs), 11);
    });

    test('every ex mentions a form of its verb — full pass over all 257', () => {
        VERBS.forEach((v, i) => {
            assert.truthy(exMentionsVerb(v),
                `entry ${i} (${v.v1}): no verb form in ${JSON.stringify(v.ex)}`);
        });
    });

    test('exactly 7 exes rely on an inflected base form rather than exact v1/v2/v3', () => {
        const inflectedOnly = VERBS.filter(v => !exMentionsExactForm(v)).map(v => v.v1).sort();
        assert.deepEqual(inflectedOnly,
            ['crow', 'fit', 'interweave', 'misspell', 'oversee', 'remake', 'shave']);
    });
});

suite('gen: sampled verb integrity (every 8th entry)', () => {
    // 30 samples at stride 8 → indices 0, 8, 16, …, 232 across all 5 levels.
    for (let s = 0; s < 30; s++) {
        const idx = s * 8;
        const v = VERBS[idx];
        test(`verb[${idx}] "${v.v1}" (L${v.level}) is well-formed and ex uses it`, () => {
            assert.equal(Object.keys(v).sort().join(','), 'ex,level,v1,v2,v3,vi');
            assert.truthy(/^[a-z]+$/.test(v.v1), 'v1 lowercase word');
            assert.truthy(v.v2.length > 0 && v.v3.length > 0, 'v2/v3 non-empty');
            assert.truthy(v.vi.trim().length > 0, 'vi non-empty');
            assert.inRange(v.level, 1, 5, 'level in range');
            assert.truthy(/[.!?]$/.test(v.ex), `ex punctuated: ${JSON.stringify(v.ex)}`);
            assert.truthy(exMentionsVerb(v),
                `ex mentions a form of ${v.v1}: ${JSON.stringify(v.ex)}`);
        });
    }
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
