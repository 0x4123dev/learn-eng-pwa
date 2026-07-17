// tests/gen-phrases-bank.test.js — Deep data invariants for the Phrases bank.
// Requires js/phrases-data.js directly (it module.exports PREPOSITION_QUESTIONS).
// Goes beyond tests/phrases.test.js: exact schema key set, exact category
// distribution, correct-option token vocabulary, phrase-field ties (the blank
// filled with the correct option always contains the phrase's preposition
// token), and per-question sampled bundles.

const { suite, test, assert } = require('./harness');

const { PREPOSITION_QUESTIONS: BANK } = require('../js/phrases-data.js');

const CATS = ['verb', 'adj', 'noun', 'phrase', 'place'];
const TOTAL = 913;
const SCHEMA_KEYS = 'cat,correct,explanation,id,options,phrase,q,vi';

// Word set of the question with the blank filled by the correct option.
function filledWords(q) {
    const filled = String(q.q).replace('___', q.options[q.correct]).toLowerCase();
    return new Set(filled.split(/[^a-z']+/));
}
function phraseWords(q) {
    return String(q.phrase).toLowerCase().trim().split(/\s+/);
}

suite('gen: phrases bank shape', () => {
    test('direct require exposes PREPOSITION_QUESTIONS with 913 entries', () => {
        assert.truthy(Array.isArray(BANK), 'should be an array via module.exports');
        assert.equal(BANK.length, TOTAL);
    });

    test('ids run sequentially pp-1..pp-913 with no gaps', () => {
        BANK.forEach((q, i) => assert.equal(q.id, 'pp-' + (i + 1), `index ${i}`));
        assert.equal(BANK[0].id, 'pp-1');
        assert.equal(BANK[TOTAL - 1].id, 'pp-913');
    });

    test('every question has exactly the 8 documented schema keys', () => {
        BANK.forEach(q => {
            assert.equal(Object.keys(q).sort().join(','), SCHEMA_KEYS, `${q.id} keys`);
        });
    });

    test('exact category distribution matches the file header comment', () => {
        const c = { verb: 0, adj: 0, noun: 0, phrase: 0, place: 0 };
        BANK.forEach(q => { c[q.cat]++; });
        assert.deepEqual(c, { verb: 315, adj: 196, noun: 169, phrase: 118, place: 115 });
    });

    test('every stem has exactly one ___ blank, sentence-initial or space-preceded', () => {
        let initial = 0;
        BANK.forEach(q => {
            const blanks = (String(q.q).match(/___/g) || []).length;
            assert.equal(blanks, 1, `${q.id} has ${blanks} blanks`);
            if (q.q.startsWith('___')) initial++;
            else assert.truthy(q.q.indexOf(' ___') !== -1,
                `${q.id} blank neither sentence-initial nor preceded by a space`);
        });
        assert.equal(initial, 4); // same 4 questions as the capitalized-options test
    });

    test('all 913 stems are unique sentences ending in "." or "?" (exactly 18 "?")', () => {
        assert.equal(new Set(BANK.map(q => q.q)).size, TOTAL, 'duplicate stems');
        let qm = 0;
        BANK.forEach(q => {
            const last = q.q.trim().slice(-1);
            assert.truthy(last === '.' || last === '?', `${q.id} ends with "${last}"`);
            if (last === '?') qm++;
        });
        assert.equal(qm, 18);
    });

    test('all 4 options are pre-trimmed single tokens (no whitespace anywhere)', () => {
        BANK.forEach(q => {
            assert.equal(q.options.length, 4, `${q.id} option count`);
            q.options.forEach(o => {
                assert.equal(o, o.trim(), `${q.id} untrimmed option "${o}"`);
                assert.falsy(/\s/.test(o), `${q.id} option with inner space "${o}"`);
            });
            assert.equal(new Set(q.options.map(o => o.toLowerCase())).size, 4,
                `${q.id} duplicate options after trim/lowercase`);
        });
    });

    test('every vi has the "meaning — phrase" em-dash separator and is >= 27 chars', () => {
        BANK.forEach(q => {
            assert.truthy(q.vi.indexOf(' — ') !== -1, `${q.id} vi missing " — " separator`);
            assert.truthy(q.vi.length >= 27, `${q.id} vi only ${q.vi.length} chars`);
        });
    });
});

suite('gen: phrases correct-option properties', () => {
    test('correct index is valid and the correct option is a short token (<= 8 chars)', () => {
        BANK.forEach(q => {
            assert.truthy(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3,
                `${q.id} correct=${q.correct}`);
            const tok = q.options[q.correct];
            assert.inRange(tok.length, 1, 8, `${q.id} correct token "${tok}"`);
        });
    });

    test('the longest option anywhere in the bank is exactly 8 chars', () => {
        let max = 0;
        BANK.forEach(q => q.options.forEach(o => { if (o.length > max) max = o.length; }));
        assert.equal(max, 8); // "Contrary" (pp-476) / "opposite" (pp-797)
    });

    test('correct answers draw from exactly 40 preposition-ish tokens', () => {
        const KNOWN = ['about', 'above', 'across', 'after', 'against', 'along', 'among',
            'around', 'at', 'away', 'because', 'behind', 'below', 'beside', 'between',
            'by', 'contrary', 'down', 'due', 'far', 'for', 'from', 'in', 'into', 'of',
            'off', 'on', 'onto', 'opposite', 'out', 'over', 'past', 'prior', 'through',
            'to', 'towards', 'under', 'up', 'upon', 'with'];
        const toks = new Set(BANK.map(q => q.options[q.correct].toLowerCase()));
        assert.equal(toks.size, 40);
        toks.forEach(t => assert.contains(KNOWN, t, `unexpected correct token "${t}"`));
    });

    test('ALL options (distractors included) draw from exactly 51 known tokens', () => {
        const KNOWN_ALL = ['about', 'above', 'across', 'after', 'against', 'ahead',
            'along', 'among', 'apart', 'around', 'as', 'aside', 'at', 'away', 'because',
            'before', 'behind', 'below', 'beside', 'between', 'by', 'contrary', 'down',
            'due', 'during', 'far', 'for', 'from', 'in', 'instead', 'into', 'near', 'of',
            'off', 'on', 'onto', 'opposite', 'out', 'over', 'past', 'previous', 'prior',
            'reverse', 'than', 'through', 'to', 'towards', 'under', 'up', 'upon', 'with'];
        const toks = new Set();
        BANK.forEach(q => q.options.forEach(o => toks.add(o.toLowerCase())));
        assert.equal(toks.size, 51);
        toks.forEach(t => assert.contains(KNOWN_ALL, t, `unexpected option token "${t}"`));
    });

    test('correct option is a word of its phrase for 912/913 — sole exception pp-683', () => {
        const misses = BANK.filter(q =>
            !phraseWords(q).includes(q.options[q.correct].toLowerCase()));
        assert.equal(misses.length, 1);
        assert.equal(misses[0].id, 'pp-683'); // phrase "basis of", answer "on" (on the basis of)
        assert.equal(misses[0].phrase, 'basis of');
        assert.equal(misses[0].options[misses[0].correct], 'on');
    });

    test('correct option equals the phrase-final word in exactly 820 questions', () => {
        const n = BANK.filter(q => {
            const pw = phraseWords(q);
            return q.options[q.correct].toLowerCase() === pw[pw.length - 1];
        }).length;
        assert.equal(n, 820); // the rest are mid-phrase particles (e.g. run OUT of)
    });

    test('capitalized options appear only in the 4 sentence-initial-blank questions', () => {
        const capIds = new Set();
        BANK.forEach(q => {
            if (q.options.some(o => o !== o.toLowerCase())) capIds.add(q.id);
        });
        assert.deepEqual([...capIds].sort(), ['pp-447', 'pp-476', 'pp-743', 'pp-752']);
        capIds.forEach(id => {
            const q = BANK.find(x => x.id === id);
            assert.truthy(q.q.startsWith('___'), `${id} has capitalized options but the blank is not sentence-initial`);
            // in these questions ALL options are capitalized consistently
            q.options.forEach(o => assert.equal(o[0], o[0].toUpperCase(), `${id} mixed-case option "${o}"`));
        });
    });

    test('every explanation is >= 62 chars AND names its correct token', () => {
        let min = Infinity;
        BANK.forEach(q => {
            assert.truthy(typeof q.explanation === 'string' && q.explanation.length >= 20,
                `${q.id} explanation too short`);
            assert.truthy(
                q.explanation.toLowerCase().indexOf(q.options[q.correct].toLowerCase()) !== -1,
                `${q.id} explanation never mentions "${q.options[q.correct]}"`);
            if (q.explanation.length < min) min = q.explanation.length;
        });
        assert.truthy(min >= 62, `actual min explanation length is ${min}`);
    });
});

suite('gen: phrases phrase-field ties', () => {
    test('every phrase field is a non-empty trimmed string', () => {
        BANK.forEach(q => {
            assert.truthy(typeof q.phrase === 'string' && q.phrase.length > 0, `${q.id} empty phrase`);
            assert.equal(q.phrase, q.phrase.trim(), `${q.id} untrimmed phrase`);
        });
    });

    test('blank filled with the correct option always contains the phrase-final preposition token', () => {
        BANK.forEach(q => {
            const pw = phraseWords(q);
            const last = pw[pw.length - 1];
            assert.truthy(filledWords(q).has(last),
                `${q.id}: filled question lacks final phrase token "${last}" (phrase="${q.phrase}")`);
        });
    });

    test('exactly 9 single-word phrases: pp-793..pp-801, all cat place, phrase === answer', () => {
        const single = BANK.filter(q => phraseWords(q).length === 1);
        assert.equal(single.length, 9);
        assert.deepEqual(single.map(q => q.id),
            ['pp-793', 'pp-794', 'pp-795', 'pp-796', 'pp-797', 'pp-798', 'pp-799', 'pp-800', 'pp-801']);
        single.forEach(q => {
            assert.equal(q.cat, 'place', `${q.id} cat`);
            assert.equal(q.options[q.correct].toLowerCase(), q.phrase.toLowerCase(), `${q.id} phrase != answer`);
        });
    });

    test('exactly 732 questions contain every phrase word verbatim in the filled sentence', () => {
        // The other 181 differ only by verb inflection (focus/focuses, come/came...).
        const n = BANK.filter(q => {
            const words = filledWords(q);
            return phraseWords(q).every(w => words.has(w));
        }).length;
        assert.equal(n, 732);
    });

    test('phrases are unique except "subject to" (pp-301 adj vs pp-481 phrase)', () => {
        const byPhrase = new Map();
        BANK.forEach(q => {
            const k = q.phrase.toLowerCase();
            if (!byPhrase.has(k)) byPhrase.set(k, []);
            byPhrase.get(k).push(q);
        });
        assert.equal(byPhrase.size, 912);
        const dups = [...byPhrase.values()].filter(v => v.length > 1);
        assert.equal(dups.length, 1);
        assert.equal(dups[0].map(q => q.id).join(','), 'pp-301,pp-481');
        assert.deepEqual(dups[0].map(q => q.cat), ['adj', 'phrase']);
    });

    test('pp-683 spot check: "on the basis of" appears once the blank is filled', () => {
        const q = BANK.find(x => x.id === 'pp-683');
        const filled = q.q.replace('___', q.options[q.correct]).toLowerCase();
        assert.truthy(filled.indexOf('on the basis of') !== -1, filled);
    });
});

suite('gen: phrases sampled per-question bundles', () => {
    // Deterministic stride sample across the whole bank: 28 questions.
    const SAMPLE_STRIDE = 33;
    const sampleIdx = [];
    for (let i = 0; i * SAMPLE_STRIDE < TOTAL; i++) sampleIdx.push(i * SAMPLE_STRIDE);

    sampleIdx.forEach(idx => {
        const q = BANK[idx];
        test(`${q.id} [${q.cat}] "${q.phrase}" — full invariant bundle`, () => {
            // one blank
            assert.equal((String(q.q).match(/___/g) || []).length, 1, 'one blank');
            // 4 unique trimmed options
            assert.equal(q.options.length, 4, '4 options');
            assert.equal(new Set(q.options.map(o => o.trim().toLowerCase())).size, 4, 'unique options');
            q.options.forEach(o => assert.equal(o, o.trim(), `untrimmed "${o}"`));
            // correct is a short preposition-ish token
            assert.inRange(q.correct, 0, 3, 'correct index');
            assert.inRange(q.options[q.correct].length, 1, 8, 'correct token length');
            // vi + explanation
            assert.truthy(q.vi.indexOf(' — ') !== -1, 'vi separator');
            assert.truthy(q.explanation.length >= 20, 'explanation length');
            // cat + phrase
            assert.contains(CATS, q.cat, 'cat');
            assert.truthy(q.phrase.trim().length > 0, 'phrase non-empty');
            // characterization: the filled sentence contains the phrase's preposition token
            const pw = phraseWords(q);
            assert.truthy(filledWords(q).has(pw[pw.length - 1]),
                `filled q lacks "${pw[pw.length - 1]}"`);
        });
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
