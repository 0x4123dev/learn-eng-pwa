// gen-phrases-quiz.test.js — characterization tests for the Phrases quiz logic
// in js/phrases.js, exercised through the shared sandbox (tests/setup.js).
//
// setup.js's includePhrases loads js/phrases-data.js + js/phrases.js but NOT
// js/phrases-meanings.js, so PHRASE_MEANINGS is injected via extraGlobals to
// exercise the meaning-question pairing (phrMeaningQuestion / phrExpandPairs /
// phrasesById('pm-…')). A second bare env characterizes the without-meanings
// behavior. Top-level `function` declarations in phrases.js land on the vm
// global, so helpers like phrTier/phrShuffle are reachable on `env` even
// though they are not in setup.js's EXPORT_NAMES list.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');
const path = require('path');

const { PHRASE_MEANINGS } = require(path.join(__dirname, '..', 'js', 'phrases-meanings.js'));
const env = loadAppCode({ includePhrases: true, extraGlobals: { PHRASE_MEANINGS } });
const BANK = env.PREPOSITION_QUESTIONS;

// Bare env: exactly what setup.js gives every other test (no PHRASE_MEANINGS).
const bareEnv = loadAppCode({ includePhrases: true });

suite('gen: phrases tier boundaries', () => {
    // phrTier: 100 → perfect, 80-99 → great, 60-79 → ok, <60 → weak.
    const TIER_CASES = [
        [0, 'weak'],
        [59, 'weak'],
        [60, 'ok'],
        [79, 'ok'],
        [80, 'great'],
        [99, 'great'],
        [100, 'perfect'],
    ];
    TIER_CASES.forEach(([pct, tier]) => {
        test(`phrTier(${pct}) → '${tier}'`, () => {
            assert.equal(env.phrTier(pct), tier);
        });
    });

    const EMOJI_CASES = [
        [0, '📝'],
        [59, '📝'],
        [60, '👍'],
        [79, '👍'],
        [80, '✅'],
        [99, '✅'],
        [100, '⭐'],
    ];
    EMOJI_CASES.forEach(([pct, emoji]) => {
        test(`phrTierEmoji(${pct}) → '${emoji}'`, () => {
            assert.equal(env.phrTierEmoji(pct), emoji);
        });
    });

});

suite('gen: phrases HTML escaping', () => {
    test('phrEsc escapes ampersand to &amp;', () => {
        assert.equal(env.phrEsc('fish & chips'), 'fish &amp; chips');
    });

    test('phrEsc escapes angle brackets to &lt;/&gt;', () => {
        assert.equal(env.phrEsc('<b>bold</b>'), '&lt;b&gt;bold&lt;/b&gt;');
    });

    test('phrEsc escapes all three specials in one string', () => {
        assert.equal(env.phrEsc('a<b>&c'), 'a&lt;b&gt;&amp;c');
    });

    test('phrEsc does NOT escape quotes or apostrophes (characterization)', () => {
        assert.equal(env.phrEsc(`"it's"`), `"it's"`);
    });

    test('phrEsc double-escapes already-escaped entities (& first)', () => {
        // & is replaced before < and >, so pre-escaped text gets re-escaped.
        assert.equal(env.phrEsc('&amp; &lt;'), '&amp;amp; &amp;lt;');
    });

    test('phrEsc coerces non-string inputs via String()', () => {
        assert.equal(env.phrEsc(5), '5');
        assert.equal(env.phrEsc(null), 'null');
        assert.equal(env.phrEsc(undefined), 'undefined');
    });
});

suite('gen: phrases seeded shuffle', () => {
    test('same seed → identical order (deterministic)', () => {
        const a = env.phrShuffle([1, 2, 3, 4, 5, 6, 7, 8], 20260717);
        const b = env.phrShuffle([1, 2, 3, 4, 5, 6, 7, 8], 20260717);
        assert.deepEqual(a, b);
    });

    test('seed 42 on [1..5] produces the exact LCG order (locks constants)', () => {
        // Sequence changed deliberately in the LCG high-bit fix: `s % (i + 1)`
        // took the generator's low bits, which barely vary — one item was drawn
        // into 12.5% of samples against a fair 1.67%. Determinism (the property
        // this suite guards) is unchanged; only the order is new.
        assert.deepEqual(env.phrShuffle([1, 2, 3, 4, 5], 42), [1, 2, 4, 5, 3]);
    });

    test('falsy seed (0 / undefined) falls back to seed 1', () => {
        const one = env.phrShuffle([1, 2, 3, 4, 5], 1);
        assert.deepEqual(env.phrShuffle([1, 2, 3, 4, 5], 0), one);
        assert.deepEqual(env.phrShuffle([1, 2, 3, 4, 5]), one);
        assert.deepEqual(one, [2, 5, 4, 1, 3]);
    });

    test('different seeds give different orders (on a 10-item array)', () => {
        const a = env.phrShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 42);
        const b = env.phrShuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 43);
        assert.falsy(JSON.stringify(a) === JSON.stringify(b), 'seeds 42/43 should differ');
    });

    test('output is a permutation and the input array is not mutated', () => {
        const src = [10, 20, 30, 40, 50, 60];
        const out = env.phrShuffle(src, 7);
        assert.deepEqual(src, [10, 20, 30, 40, 50, 60], 'input mutated');
        assert.equal(out.length, src.length);
        assert.deepEqual(out.slice().sort((x, y) => x - y), src);
    });

    test('degenerate inputs: empty stays empty, single stays single', () => {
        assert.deepEqual(env.phrShuffle([], 5), []);
        assert.deepEqual(env.phrShuffle([7], 5), [7]);
    });

    test('shuffling the full 913-question bank is an id-permutation', () => {
        assert.equal(BANK.length, 913, 'bank size invariant');
        const out = env.phrShuffle(BANK, 12345);
        assert.equal(out.length, BANK.length);
        const ids = new Set(out.map(q => q.id));
        assert.equal(ids.size, BANK.length);
        BANK.forEach(q => assert.truthy(ids.has(q.id), `lost ${q.id}`));
    });
});

suite('gen: phrases pair expansion', () => {
    test('phrExpandPairs doubles 5 bank questions into base+meaning pairs in order', () => {
        assert.deepEqual(env.phrExpandPairs([]), [], 'empty input → empty output');
        const picked = BANK.slice(0, 5);
        const out = env.phrExpandPairs(picked);
        assert.equal(out.length, 10);
        for (let i = 0; i < 5; i++) {
            assert.equal(out[2 * i].id, picked[i].id, `base at step ${2 * i}`);
            assert.equal(out[2 * i + 1].id, 'pm-' + picked[i].id, `meaning at step ${2 * i + 1}`);
        }
    });

    test('every one of the 913 bank questions has a well-formed meaning entry', () => {
        // Full-bank data invariant: PHRASE_MEANINGS covers the entire bank,
        // every entry has exactly 4 options and a valid correct index, and
        // phrMeaningQuestion never degrades to null for a real bank question.
        const bad = [];
        BANK.forEach(q => {
            const m = PHRASE_MEANINGS[q.id];
            if (!m || !Array.isArray(m.options) || m.options.length !== 4 ||
                !Number.isInteger(m.correct) || m.correct < 0 || m.correct > 3 ||
                typeof m.options[m.correct] !== 'string' || !m.options[m.correct].length) {
                bad.push(q.id);
                return;
            }
            const mq = env.phrMeaningQuestion(q);
            if (!mq || mq.id !== 'pm-' + q.id) bad.push('mq:' + q.id);
        });
        assert.deepEqual(bad, [], 'malformed/missing meaning entries');
        // And no orphan keys: meanings only exist for real bank ids.
        const bankIds = new Set(BANK.map(q => q.id));
        const orphans = Object.keys(PHRASE_MEANINGS).filter(k => !bankIds.has(k));
        assert.deepEqual(orphans, [], 'meaning keys without a bank question');
    });

    // Sampled across the whole bank: each base yields a well-formed follow-up.
    [0, 150, 300, 456, 912].forEach(i => {
        const base = BANK[i];
        test(`phrExpandPairs pairs ${base.id} ("${base.phrase}") with its pm- question`, () => {
            const out = env.phrExpandPairs([base]);
            assert.equal(out.length, 2);
            assert.equal(out[0].id, base.id);
            const mq = out[1];
            assert.equal(mq.id, 'pm-' + base.id);
            assert.equal(mq.meaning, true);
            assert.equal(mq.cat, base.cat);
            assert.equal(mq.phrase, base.phrase);
            assert.equal(mq.vi, base.vi);
            assert.equal(mq.options.length, 4);
            assert.truthy(mq.q.indexOf(base.phrase) !== -1, 'question quotes the phrase');
        });
    });
});

suite('gen: phrases lookup by id', () => {
    test("phrasesById('pm-pp-7') builds the meaning question with correct fields", () => {
        const mq = env.phrasesById('pm-pp-7');
        assert.truthy(mq, 'should resolve');
        assert.equal(mq.id, 'pm-pp-7');
        assert.equal(mq.meaning, true);
        assert.equal(mq.cat, 'verb');
        assert.equal(mq.phrase, 'look for');
        assert.equal(mq.q, 'What is the meaning of "look for"?');
        assert.truthy(Array.isArray(mq.options) && mq.options.length === 4, 'options len 4');
    });

    test("pm-pp-7 carries the pp-7 meaning entry (correct=2, 'tìm kiếm')", () => {
        const mq = env.phrasesById('pm-pp-7');
        assert.deepEqual(mq.options, ['đốt cháy', 'chào đón', 'tìm kiếm', 'cất giấu']);
        assert.equal(mq.correct, 2);
        assert.equal(mq.options[mq.correct], 'tìm kiếm');
    });

    test("phrasesById('pp-7') returns the base fill-in question, not a meaning one", () => {
        const q = env.phrasesById('pp-7');
        assert.equal(q.id, 'pp-7');
        assert.falsy(q.meaning, 'base question has no meaning flag');
        assert.equal(q.phrase, 'look for');
        assert.equal(q.options[q.correct], 'for');
    });

    test('phrasesById and phrMeaningQuestion return null for unknown/missing input', () => {
        assert.equal(env.phrasesById('pp-99999'), null);
        assert.equal(env.phrasesById('pm-pp-99999'), null);
        assert.equal(env.phrasesById('nope'), null);
        assert.equal(env.phrMeaningQuestion(null), null);
        assert.equal(env.phrMeaningQuestion({ id: 'pp-99999', phrase: 'ghost' }), null);
    });
});

suite('gen: phrases meaning explanations', () => {
    test('pm-pp-7 explanation embeds its correct option text verbatim', () => {
        const mq = env.phrasesById('pm-pp-7');
        assert.equal(mq.explanation, '"look for" có nghĩa là "tìm kiếm".');
        assert.truthy(mq.explanation.indexOf(mq.options[mq.correct]) !== -1);
    });

    // Sampled: the template always quotes the phrase and its correct meaning.
    [10, 200, 500, 800].forEach(i => {
        const base = BANK[i];
        test(`meaning explanation for ${base.id} embeds phrase + correct option`, () => {
            const mq = env.phrasesById('pm-' + base.id);
            assert.truthy(mq, `pm-${base.id} should resolve`);
            const correctText = mq.options[mq.correct];
            assert.truthy(mq.explanation.indexOf('"' + correctText + '"') !== -1,
                `explanation should quote "${correctText}"`);
            assert.truthy(mq.explanation.indexOf('"' + base.phrase + '"') !== -1,
                `explanation should quote "${base.phrase}"`);
            assert.truthy(mq.explanation.indexOf('có nghĩa là') !== -1);
        });
    });
});

suite('gen: phrases session history cap', () => {
    function fill(n) {
        env.__setAppState({ phrasesHistory: [] });
        for (let i = 0; i < n; i++) {
            env.savePhrasesSession({ id: 's' + i, date: '2026-07-17', score: 1, total: 2, wrong: [] });
        }
        return env.__getAppState().phrasesHistory;
    }

    test('savePhrasesSession prepends: newest session is first', () => {
        const hist = fill(3);
        assert.deepEqual(hist.map(s => s.id), ['s2', 's1', 's0']);
    });

    test('exactly 300 sessions are all kept (cap boundary, no trim)', () => {
        const hist = fill(300);
        assert.equal(hist.length, 300);
        assert.equal(hist[0].id, 's299');
        assert.equal(hist[299].id, 's0');
    });

    test('301st session trims the oldest — history capped at 300', () => {
        const hist = fill(301);
        assert.equal(hist.length, 300);
        assert.equal(hist[0].id, 's300');
        assert.equal(hist[299].id, 's1', 'oldest (s0) dropped');
    });

    test('305 sessions still cap at 300, dropping the 5 oldest', () => {
        const hist = fill(305);
        assert.equal(hist.length, 300);
        assert.equal(hist[0].id, 's304');
        assert.equal(hist[299].id, 's5');
        assert.falsy(hist.some(s => s.id === 's0'), 's0 should be gone');
    });

    test('creates appState.phrasesHistory when it is missing', () => {
        env.__setAppState({});
        env.savePhrasesSession({ id: 'solo', score: 2, total: 2, wrong: [] });
        const st = env.__getAppState();
        assert.truthy(Array.isArray(st.phrasesHistory));
        assert.equal(st.phrasesHistory.length, 1);
        assert.equal(st.phrasesHistory[0].id, 'solo');
    });
});

suite('gen: phrases without meanings loaded (setup.js default)', () => {
    // setup.js includePhrases does not load js/phrases-meanings.js, so the
    // default sandbox has no PHRASE_MEANINGS — pairing degrades gracefully.
    test("bare env: phrasesById('pm-pp-7') is null (no PHRASE_MEANINGS)", () => {
        assert.equal(bareEnv.phrasesById('pm-pp-7'), null);
        assert.truthy(bareEnv.phrasesById('pp-7'), 'base lookup still works');
    });

    test('bare env: phrExpandPairs returns bases only (no meaning follow-ups)', () => {
        const picked = bareEnv.PREPOSITION_QUESTIONS.slice(0, 4);
        const out = bareEnv.phrExpandPairs(picked);
        assert.equal(out.length, 4);
        assert.deepEqual(out.map(q => q.id), picked.map(q => q.id));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
