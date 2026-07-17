// gen-phrases-meanings-deep.test.js — deep invariants of PHRASE_MEANINGS
// (js/phrases-meanings.js) against the Phrases bank (js/phrases-data.js).
// Goes beyond tests/phrases-meanings.test.js: bijection with the bank,
// per-category option hygiene, no English-phrase leakage into the Vietnamese
// options, correct-index spread across 0..3, and a 100-entry sampled check
// that the correct option differs from every distractor after normalization.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { PREPOSITION_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'phrases-data.js'));
const { PHRASE_MEANINGS } = require(path.join(__dirname, '..', 'js', 'phrases-meanings.js'));

const norm = s => String(s).toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();
const CATS = ['verb', 'adj', 'noun', 'phrase', 'place'];
const byCat = {};
for (const q of PREPOSITION_QUESTIONS) (byCat[q.cat] = byCat[q.cat] || []).push(q);
const LATIN_ONLY = /^[A-Za-z ,'-]+$/;

suite('gen: phrase meanings coverage & shape', () => {
    test('bank has exactly 913 questions across the 5 known categories', () => {
        assert.equal(PREPOSITION_QUESTIONS.length, 913);
        assert.deepEqual(Object.keys(byCat).sort(), CATS.slice().sort());
    });

    test('bank ids are sequential pp-1..pp-913 with no gaps or reordering', () => {
        PREPOSITION_QUESTIONS.forEach((q, i) => {
            assert.equal(q.id, `pp-${i + 1}`, `index ${i} has id ${q.id}`);
        });
    });

    test('PHRASE_MEANINGS has exactly 913 keys (1:1 with the bank)', () => {
        assert.equal(Object.keys(PHRASE_MEANINGS).length, 913);
    });

    test('no orphan meaning keys — every key resolves to a bank question id', () => {
        const bankIds = new Set(PREPOSITION_QUESTIONS.map(q => q.id));
        const orphans = Object.keys(PHRASE_MEANINGS).filter(k => !bankIds.has(k));
        assert.equal(orphans.length, 0, `orphans: ${orphans.slice(0, 10).join(',')}`);
    });

    for (const cat of CATS) {
        test(`[${cat}] every option is a non-empty trimmed string of at most 60 chars`, () => {
            for (const q of byCat[cat]) {
                const m = PHRASE_MEANINGS[q.id];
                for (const o of m.options) {
                    assert.equal(typeof o, 'string', `${q.id}: option not a string`);
                    assert.truthy(o.trim().length > 0, `${q.id}: blank option`);
                    assert.equal(o, o.trim(), `${q.id}: option has stray whitespace`);
                    assert.inRange(o.length, 1, 60, `${q.id}: option too long: "${o}"`);
                }
            }
        });
    }

    test('option lengths actually span 2..30 chars (characterized)', () => {
        let min = Infinity, max = 0;
        for (const q of PREPOSITION_QUESTIONS) {
            for (const o of PHRASE_MEANINGS[q.id].options) {
                min = Math.min(min, o.length);
                max = Math.max(max, o.length);
            }
        }
        assert.equal(min, 2, 'shortest option (e.g. "xa")');
        assert.equal(max, 30, 'longest option');
    });

    test('every entry has exactly 4 options — total pool is 3652', () => {
        let total = 0;
        for (const k of Object.keys(PHRASE_MEANINGS)) {
            const m = PHRASE_MEANINGS[k];
            assert.truthy(Array.isArray(m.options), `${k}: options not an array`);
            assert.equal(m.options.length, 4, `${k}: expected 4 options, got ${m.options.length}`);
            total += m.options.length;
        }
        assert.equal(total, 3652);
    });

    test('every bank vi field has the "short meaning — phrase reminder" shape', () => {
        for (const q of PREPOSITION_QUESTIONS) {
            assert.equal(typeof q.vi, 'string', `${q.id}: vi not a string`);
            assert.truthy(q.vi.includes(' — '), `${q.id}: vi lacks the em-dash separator: "${q.vi}"`);
            assert.truthy(norm(q.vi.split(' — ')[0]).length > 0, `${q.id}: empty short meaning`);
        }
    });
});

suite('gen: no English-phrase leakage into options', () => {
    for (const cat of CATS) {
        test(`[${cat}] no option equals the entry's own English phrase (normalized)`, () => {
            for (const q of byCat[cat]) {
                const p = norm(q.phrase);
                for (const o of PHRASE_MEANINGS[q.id].options) {
                    assert.truthy(norm(o) !== p, `${q.id}: option "${o}" duplicates phrase "${q.phrase}"`);
                }
            }
        });
    }

    test('no option equals ANY English phrase anywhere in the bank', () => {
        const allPhrases = new Set(PREPOSITION_QUESTIONS.map(q => norm(q.phrase)));
        const hits = [];
        for (const q of PREPOSITION_QUESTIONS) {
            for (const o of PHRASE_MEANINGS[q.id].options) {
                if (allPhrases.has(norm(o))) hits.push(`${q.id}:${o}`);
            }
        }
        assert.equal(hits.length, 0, `English phrases leaked as options: ${hits.slice(0, 10).join(',')}`);
    });

    test('no option contains its own English phrase as a substring', () => {
        const hits = [];
        for (const q of PREPOSITION_QUESTIONS) {
            const p = norm(q.phrase);
            for (const o of PHRASE_MEANINGS[q.id].options) {
                if (norm(o).includes(p)) hits.push(`${q.id}:${o}`);
            }
        }
        assert.equal(hits.length, 0, `options embedding the phrase: ${hits.slice(0, 10).join(',')}`);
    });

    test('exactly 28 Latin-only options exist and all are diacritic-free Vietnamese, not English', () => {
        const latin = [];
        for (const q of PREPOSITION_QUESTIONS) {
            for (const o of PHRASE_MEANINGS[q.id].options) {
                if (LATIN_ONLY.test(o)) latin.push({ id: q.id, o, phrase: q.phrase });
            }
        }
        // Characterized: 28 options happen to use only ASCII letters (e.g.
        // "nghe", "thay cho", "bay qua") — legit Vietnamese without diacritics.
        assert.equal(latin.length, 28, latin.map(x => `${x.id}:${x.o}`).slice(0, 30).join(' | '));
        for (const x of latin) {
            assert.truthy(norm(x.o) !== norm(x.phrase), `${x.id}: Latin-only option "${x.o}" duplicates its phrase`);
        }
    });
});

suite('gen: correct index distribution', () => {
    const dist = [0, 0, 0, 0];
    for (const q of PREPOSITION_QUESTIONS) dist[PHRASE_MEANINGS[q.id].correct]++;

    for (let k = 0; k < 4; k++) {
        test(`correct index ${k} is used at least 50 times across the 913 entries`, () => {
            assert.inRange(dist[k], 50, 913, `index ${k} used ${dist[k]} times`);
        });
    }

    test('deterministic placement spreads almost evenly: [230,229,227,227]', () => {
        assert.deepEqual(dist, [230, 229, 227, 227]);
        assert.equal(dist.reduce((a, b) => a + b, 0), 913);
    });

    test('correct option aligns with the vi short meaning: 590 exact, 711 exact-or-prefix', () => {
        // Characterized: the correct Vietnamese option usually restates the
        // short meaning before the em-dash in q.vi; the remaining 202 differ
        // only in punctuation/parentheticals (e.g. "hỏi xin" vs "yêu cầu, xin
        // (điều gì)"), so no stricter tie to q.vi is possible.
        let exact = 0, prefixRelated = 0;
        for (const q of PREPOSITION_QUESTIONS) {
            const m = PHRASE_MEANINGS[q.id];
            const c = norm(m.options[m.correct]);
            const viShort = norm(q.vi.split(' — ')[0]);
            if (c === viShort) exact++;
            else if (viShort.startsWith(c) || c.startsWith(viShort)) prefixRelated++;
        }
        assert.equal(exact, 590);
        assert.equal(exact + prefixRelated, 711);
    });

    for (const cat of CATS) {
        test(`[${cat}] every correct position 0..3 is used at least 20 times within the category`, () => {
            const d = [0, 0, 0, 0];
            for (const q of byCat[cat]) d[PHRASE_MEANINGS[q.id].correct]++;
            for (let k = 0; k < 4; k++) {
                assert.inRange(d[k], 20, byCat[cat].length, `${cat}: index ${k} used ${d[k]} times`);
            }
        });
    }
});

suite('gen: sampled correct-vs-distractor distinctness (100 entries)', () => {
    // Deterministic sample: every 9th question -> 100 unique entries (0..891).
    const sampled = [];
    for (let i = 0; i < 100; i++) sampled.push(PREPOSITION_QUESTIONS[i * 9]);

    for (let b = 0; b < 20; b++) {
        const batch = sampled.slice(b * 5, b * 5 + 5);
        const ids = batch.map(q => q.id).join(', ');
        test(`sample batch ${b + 1} (${ids}): all 4 options pairwise distinct, valid correct index`, () => {
            for (const q of batch) {
                const m = PHRASE_MEANINGS[q.id];
                assert.truthy(Number.isInteger(m.correct), `${q.id}: correct index not an integer`);
                assert.inRange(m.correct, 0, 3, `${q.id}: correct index out of range`);
                const correct = norm(m.options[m.correct]);
                assert.truthy(correct.length > 0, `${q.id}: empty correct option`);
                const seen = new Set(m.options.map(norm));
                assert.equal(seen.size, 4, `${q.id}: options not pairwise distinct after normalization`);
            }
        });
    }
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
