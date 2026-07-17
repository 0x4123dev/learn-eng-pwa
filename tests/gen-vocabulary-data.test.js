// gen-vocabulary-data.test.js — deep characterization of the vocabulary bank
// (js/vocabulary.js ieltsVocabulary): exact count, key set, field formatting
// (ipa slash-wrapping, trimmed strings, example-sentence shape, emoji field)
// plus the WORDS_PER_LESSON / TOTAL_LESSONS relationship from js/app.js.
// Complements tests/integration.test.js "Vocabulary: data integrity" (which
// only samples every 100th/200th entry) with FULL passes over all 1,957
// entries and pins the data facts it leaves loose (dupe count, ASCII emoji).
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();
const VOCAB = env.ieltsVocabulary;

suite('gen: vocabulary counts & shape', () => {
    test('bank has exactly 1957 entries (112 Beginning + 1845 IELTS)', () => {
        assert.equal(VOCAB.length, 1957);
    });

    test('TOTAL_LESSONS is 392 = ceil(entries/5); last lesson holds only 2 words', () => {
        assert.equal(env.WORDS_PER_LESSON, 5);
        assert.equal(env.TOTAL_LESSONS, 392);
        assert.equal(env.TOTAL_LESSONS, Math.ceil(VOCAB.length / env.WORDS_PER_LESSON));
        // 392*5 = 1960 != 1957: the final lesson is a short 2-word one.
        const lastStart = (env.TOTAL_LESSONS - 1) * env.WORDS_PER_LESSON;
        assert.equal(VOCAB.slice(lastStart).length, 2);
    });

    test('every entry is a plain object with exactly the keys emoji,en,ex,ipa,vi', () => {
        VOCAB.forEach((w, i) => {
            assert.truthy(w && typeof w === 'object' && !Array.isArray(w), `entry ${i}`);
            assert.equal(Object.keys(w).sort().join(','), 'emoji,en,ex,ipa,vi', `entry ${i} (${w.en})`);
        });
    });

    test('all five fields are non-empty strings on every entry', () => {
        for (const w of VOCAB) {
            for (const k of ['en', 'ipa', 'vi', 'emoji', 'ex']) {
                assert.truthy(typeof w[k] === 'string' && w[k].length > 0,
                    `${w.en || '?'} field ${k}`);
            }
        }
    });

    test('vi, ex, ipa and emoji carry no leading/trailing whitespace anywhere', () => {
        VOCAB.forEach((w, i) => {
            for (const k of ['vi', 'ex', 'ipa', 'emoji']) {
                assert.equal(w[k], w[k].trim(), `entry ${i} (${w.en}) field ${k}`);
            }
        });
    });

    test('1622 unique headwords → 335 duplicate occurrences (intentional re-exposure)', () => {
        const unique = new Set(VOCAB.map(w => w.en));
        assert.equal(unique.size, 1622);
        assert.equal(VOCAB.length - unique.size, 335);
    });

    test('dupe distribution: 239 words ×2, 42 words ×3, 4 words ×4 — nothing higher', () => {
        const counts = {};
        VOCAB.forEach(w => { counts[w.en] = (counts[w.en] || 0) + 1; });
        const byRepeat = {};
        for (const n of Object.values(counts)) byRepeat[n] = (byRepeat[n] || 0) + 1;
        assert.deepEqual(byRepeat, { 1: 1337, 2: 239, 3: 42, 4: 4 });
        // Extra occurrences derived from the data must equal the 335 duplicates above.
        const extras = Object.values(counts).reduce((sum, n) => sum + (n - 1), 0);
        assert.equal(extras, 335);
        const x4 = Object.keys(counts).filter(en => counts[en] === 4);
        assert.deepEqual(x4, ['comprehensive', 'motivation', 'assertion', 'articulate']);
    });

    test('vi translations: lengths span 2..40, no double spaces, none ASCII-capitalized', () => {
        const lens = VOCAB.map(w => w.vi.length);
        assert.equal(Math.min.apply(null, lens), 2);
        assert.equal(Math.max.apply(null, lens), 40);
        for (const w of VOCAB) {
            assert.falsy(/ {2}/.test(w.vi), `double space in vi of ${w.en}`);
            assert.falsy(/^[A-Z]/.test(w.vi), `vi of ${w.en} starts uppercase: ${JSON.stringify(w.vi)}`);
        }
    });

    test('first entry is apartment, last is zenith', () => {
        assert.deepEqual(VOCAB[0], {
            en: 'apartment', ipa: '/əˈpɑːrtmənt/', vi: 'căn hộ',
            emoji: '🏢', ex: 'She lives in a small apartment downtown.'
        });
        assert.equal(VOCAB[VOCAB.length - 1].en, 'zenith');
        assert.equal(VOCAB[VOCAB.length - 1].vi, 'đỉnh cao, cực điểm');
    });

    test('24 headwords are multi-word phrases, 3 are hyphenated (pinned)', () => {
        assert.equal(VOCAB.filter(w => w.en.includes(' ')).length, 24);
        assert.deepEqual(VOCAB.filter(w => w.en.includes('-')).map(w => w.en),
            ['e-commerce', 'non-proliferation', 'cross-sectional']);
    });
});

suite('gen: ipa formatting', () => {
    test('every ipa starts and ends with "/" — full pass over all 1957', () => {
        VOCAB.forEach((w, i) => {
            assert.truthy(w.ipa.startsWith('/'), `entry ${i} (${w.en}) ipa ${JSON.stringify(w.ipa)}`);
            assert.truthy(w.ipa.endsWith('/'), `entry ${i} (${w.en}) ipa ${JSON.stringify(w.ipa)}`);
        });
    });

    test('every ipa has non-empty content between the slashes', () => {
        for (const w of VOCAB) {
            assert.truthy(w.ipa.slice(1, -1).trim().length > 0, `${w.en} ipa ${JSON.stringify(w.ipa)}`);
        }
    });

    test('exactly two slashes per ipa — no /variant/or/alt/ notation', () => {
        for (const w of VOCAB) {
            assert.equal((w.ipa.match(/\//g) || []).length, 2, `${w.en} ipa ${JSON.stringify(w.ipa)}`);
        }
    });

    test('26 spaced ipas = all 24 multi-word headwords + 2 specific hyphenated ones', () => {
        const spaced = VOCAB.filter(w => /\s/.test(w.ipa));
        assert.equal(spaced.length, 26);
        // Every multi-word headword gets a spaced transcription…
        for (const w of VOCAB.filter(x => x.en.includes(' '))) {
            assert.truthy(/\s/.test(w.ipa), `${w.en} should have spaced ipa`);
        }
        // …and the only single-word ens with spaced ipa are two hyphenated compounds.
        assert.deepEqual(spaced.filter(w => !w.en.includes(' ')).map(w => w.en),
            ['non-proliferation', 'cross-sectional']);
    });

    test('spot-check known transcriptions: hut, church, zenith', () => {
        assert.equal(VOCAB.find(w => w.en === 'hut').ipa, '/hʌt/');
        assert.equal(VOCAB.find(w => w.en === 'church').ipa, '/tʃɜːrtʃ/');
        assert.equal(VOCAB[VOCAB.length - 1].ipa, '/ˈzenɪθ/');
    });
});

suite('gen: en headword formatting', () => {
    test('no en has leading or trailing whitespace — full pass', () => {
        VOCAB.forEach((w, i) => {
            assert.equal(w.en, w.en.trim(), `entry ${i}: ${JSON.stringify(w.en)}`);
        });
    });

    test('en is lowercase ASCII letters/space/hyphen except exactly 2 entries', () => {
        // No headword needs apostrophes, digits or parens — strict charset holds.
        const pat = /^[a-z][a-z -]*$/;
        const violations = VOCAB.filter(w => !pat.test(w.en)).map(w => w.en);
        assert.deepEqual(violations, ['détente', 'Renaissance']);
    });

    test('the two pattern exceptions sit at indices 1647 and 1845', () => {
        assert.equal(VOCAB[1647].en, 'détente');
        assert.equal(VOCAB[1845].en, 'Renaissance');
    });

    test('no digits and no double spaces in any headword', () => {
        for (const w of VOCAB) {
            assert.falsy(/[0-9]/.test(w.en), `digit in ${JSON.stringify(w.en)}`);
            assert.falsy(/ {2}/.test(w.en), `double space in ${JSON.stringify(w.en)}`);
        }
    });
});

suite('gen: ex example sentences', () => {
    test('every ex is at least 10 chars — full pass over all 1957', () => {
        VOCAB.forEach((w, i) => {
            assert.truthy(w.ex.length >= 10, `entry ${i} (${w.en}): ${JSON.stringify(w.ex)}`);
        });
    });

    test('ex lengths span exactly 12..94 characters', () => {
        const lens = VOCAB.map(w => w.ex.length);
        assert.equal(Math.min.apply(null, lens), 12);
        assert.equal(Math.max.apply(null, lens), 94);
    });

    test('every ex ends with ".", "!" or "?"', () => {
        for (const w of VOCAB) {
            assert.truthy(/[.!?]$/.test(w.ex), `${w.en}: ${JSON.stringify(w.ex)}`);
        }
    });

    test('every ex starts with a capital letter, digit or quote', () => {
        for (const w of VOCAB) {
            assert.truthy(/^[A-Z"'0-9]/.test(w.ex), `${w.en}: ${JSON.stringify(w.ex)}`);
        }
    });

    test('every ex has at least two words (a space-separated sentence)', () => {
        for (const w of VOCAB) {
            assert.truthy(w.ex.trim().split(/\s+/).length >= 2, `${w.en}: ${JSON.stringify(w.ex)}`);
        }
    });

    test('exactly 137 exes are minimal two-word sentences (e.g. "Yield results.")', () => {
        const twoWord = VOCAB.filter(w => w.ex.trim().split(/\s+/).length < 3);
        assert.equal(twoWord.length, 137);
        assert.equal(VOCAB.find(w => w.en === 'yield').ex, 'Yield results.');
    });
});

suite('gen: emoji field', () => {
    test('every emoji is 1-11 code units with no whitespace', () => {
        for (const w of VOCAB) {
            assert.inRange(w.emoji.length, 1, 11, `${w.en} emoji ${JSON.stringify(w.emoji)}`);
            assert.falsy(/\s/.test(w.emoji), `${w.en} emoji has whitespace`);
        }
    });

    test('emoji code-unit length distribution is pinned (5 ZWJ sequences at len 11)', () => {
        const dist = {};
        for (const w of VOCAB) dist[w.emoji.length] = (dist[w.emoji.length] || 0) + 1;
        // 1 = ASCII/BMP single, 2 = surrogate-pair pictogram (bulk), 3 = BMP+VS16
        // or pair+modifier, 4/5 = flag or modifier combos, 11 = ZWJ family-style.
        assert.deepEqual(dist, { 1: 137, 2: 1632, 3: 172, 4: 1, 5: 10, 11: 5 });
    });

    test('exactly 4 entries use plain-ASCII symbol emoji ("=" and "%")', () => {
        const ascii = [];
        VOCAB.forEach((w, i) => {
            if (/^[\x00-\x7F]*$/.test(w.emoji)) ascii.push(i);
        });
        assert.deepEqual(ascii, [288, 338, 534, 851]);
        assert.equal(VOCAB[288].emoji, '=');
        assert.equal(VOCAB[338].emoji, '%');
        assert.equal(VOCAB[534].emoji, '%');
        assert.equal(VOCAB[851].emoji, '=');
    });

    test('the ASCII four are equivalent, percentage, interest, equate', () => {
        assert.deepEqual([288, 338, 534, 851].map(i => VOCAB[i].en),
            ['equivalent', 'percentage', 'interest', 'equate']);
    });

    test('the other 1953 entries all carry a non-ASCII pictogram', () => {
        const nonAscii = VOCAB.filter(w => !/^[\x00-\x7F]*$/.test(w.emoji));
        assert.equal(nonAscii.length, 1953);
    });
});

suite('gen: sampled entry integrity (every 100th, offset 50)', () => {
    // Offset by 50 so this samples different rows than integration.test.js
    // (which walks i = 0, 100, 200, …). Each test also pins WHICH headword
    // sits at that index, so insertions/reorders upstream get caught.
    const EXPECTED_AT_INDEX = [
        'closet', 'happen', 'resolve', 'task', 'energy',
        'contract', 'streaming', 'composition', 'enumerate', 'subsequent',
        'discourse', 'precipitate', 'marginal', 'skepticism', 'ledger',
        'algorithm', 'veto', 'feudalism', 'mythology', 'instigate'
    ];
    for (let s = 0; s < 20; s++) {
        const idx = s * 100 + 50;
        const w = VOCAB[idx];
        const expectedEn = EXPECTED_AT_INDEX[s];
        test(`entry[${idx}] "${expectedEn}" is fully well-formed`, () => {
            assert.equal(w.en, expectedEn, `headword pinned at index ${idx}`);
            assert.equal(Object.keys(w).sort().join(','), 'emoji,en,ex,ipa,vi');
            assert.equal(w.en, w.en.trim(), 'en trimmed');
            assert.truthy(w.en.length > 0, 'en non-empty');
            assert.truthy(w.vi.trim().length > 0, 'vi non-empty');
            assert.truthy(w.emoji.length > 0, 'emoji non-empty');
            assert.truthy(w.ipa.startsWith('/') && w.ipa.endsWith('/'),
                `ipa slash-wrapped: ${JSON.stringify(w.ipa)}`);
            assert.truthy(w.ex.length >= 10, `ex >= 10 chars: ${JSON.stringify(w.ex)}`);
            assert.truthy(/[.!?]$/.test(w.ex), `ex ends in punctuation: ${JSON.stringify(w.ex)}`);
        });
    }
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
