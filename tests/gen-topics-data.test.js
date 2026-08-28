// tests/gen-topics-data.test.js — Topics catalog integrity + word mapping sweep.
// Complements tests/topics.test.js (which covers counts, range coverage and
// single-topic spot checks). NEW here: per-topic id format (kebab/lower),
// 6-digit hex color format, non-empty metadata per topic, a full 15-topic
// sweep of getWordsForTopic(id, null) shape (≥100 items, .word.en, .idx bounds
// and back-reference) and strictly ascending .idx, case-sensitive
// getTopicById lookups, the difficultyKey filter path, and union coverage of
// the whole vocabulary.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();
const { TOPICS, getTopicById, getWordsForTopic, WORDS_PER_LESSON, ieltsVocabulary } = env;

const KEBAB_LOWER = /^[a-z]+(?:-[a-z]+)*$/;
const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

suite('gen: topics catalog', () => {
    // One test per topic: id is kebab/lower, name/icon/color are non-empty
    // strings, and color is a 6-digit hex value.
    for (const t of TOPICS) {
        test(`topic "${t.id}" has kebab/lower id + non-empty name/icon/color`, () => {
            assert.equal(typeof t.id, 'string', 'id must be a string');
            assert.truthy(KEBAB_LOWER.test(t.id),
                `id "${t.id}" is not kebab-case/lowercase`);
            assert.equal(typeof t.name, 'string', 'name must be a string');
            assert.truthy(t.name.trim().length > 0, 'name must be non-empty');
            assert.equal(typeof t.icon, 'string', 'icon must be a string');
            assert.truthy(t.icon.trim().length > 0, 'icon must be non-empty');
            assert.equal(typeof t.color, 'string', 'color must be a string');
            assert.truthy(HEX_COLOR.test(t.color),
                `color "${t.color}" is not a #RRGGBB hex value`);
        });
    }

    test('all topic ids are unique (even case-insensitively)', () => {
        const lowered = TOPICS.map(t => t.id.toLowerCase());
        assert.equal(new Set(lowered).size, TOPICS.length,
            'duplicate topic ids after lowercasing');
    });

    test('display names, icons and colors are each unique across topics', () => {
        assert.equal(new Set(TOPICS.map(t => t.name)).size, TOPICS.length,
            'duplicate topic names');
        assert.equal(new Set(TOPICS.map(t => t.icon)).size, TOPICS.length,
            'duplicate topic icons');
        assert.equal(new Set(TOPICS.map(t => t.color)).size, TOPICS.length,
            'duplicate topic colors');
    });
});

suite('gen: topic word mapping shape', () => {
    // One test per topic: getWordsForTopic(id, null) returns ≥100 entries
    // (the taxonomy guarantees 100+ words per topic via multi-tagging; the
    // smallest topic today is health at 114) and every entry has a non-empty
    // .word.en plus an integer .idx that points back at the same word in
    // ieltsVocabulary.
    for (const t of TOPICS) {
        test(`getWordsForTopic("${t.id}", null) → ≥100 entries with .word.en + valid .idx`, () => {
            const words = getWordsForTopic(t.id, null);
            assert.truthy(Array.isArray(words), 'expected an array');
            assert.truthy(words.length >= 100,
                `topic ${t.id} returned only ${words.length} words (need ≥100)`);
            for (const entry of words) {
                assert.truthy(entry.word, `entry missing .word in topic ${t.id}`);
                assert.equal(typeof entry.word.en, 'string',
                    `.word.en not a string in topic ${t.id}`);
                assert.truthy(entry.word.en.length > 0,
                    `.word.en empty in topic ${t.id}`);
                assert.equal(typeof entry.idx, 'number',
                    `.idx not a number in topic ${t.id}`);
                assert.truthy(Number.isInteger(entry.idx),
                    `.idx not an integer in topic ${t.id}`);
                assert.inRange(entry.idx, 0, ieltsVocabulary.length - 1,
                    `.idx out of vocabulary bounds in topic ${t.id}`);
                assert.equal(entry.word.en, ieltsVocabulary[entry.idx].en,
                    `.idx does not point back at the same word in topic ${t.id}`);
            }
        });
    }
});

suite('gen: topic word ordering', () => {
    // One test per topic: entries come back in strictly ascending .idx order
    // (easy → hard), which also guarantees no duplicate entries.
    for (const t of TOPICS) {
        test(`getWordsForTopic("${t.id}", null) has strictly ascending .idx`, () => {
            const words = getWordsForTopic(t.id, null);
            assert.truthy(words.length > 1, `topic ${t.id} too small to order-check`);
            for (let i = 1; i < words.length; i++) {
                assert.truthy(words[i].idx > words[i - 1].idx,
                    `topic ${t.id}: idx ${words[i].idx} at position ${i} not > previous ${words[i - 1].idx}`);
            }
        });
    }
});

suite('gen: lookup + difficulty filter', () => {
    test('getTopicById is case-sensitive and falsy for "", undefined', () => {
        assert.truthy(getTopicById('daily'), 'sanity: lowercase id must resolve');
        assert.falsy(getTopicById('DAILY'), 'uppercase id must NOT resolve');
        assert.falsy(getTopicById(''));
        assert.falsy(getTopicById(undefined));
    });

    test('difficultyKey "beginning" filters daily to word idx 0-114 (23 lessons × WORDS_PER_LESSON=5)', () => {
        assert.equal(WORDS_PER_LESSON, 5, 'lesson size the filter multiplies by');
        const all = getWordsForTopic('daily', null);
        const beg = getWordsForTopic('daily', 'beginning');
        assert.truthy(beg.length > 0, 'beginning slice must be non-empty');
        assert.truthy(beg.length < all.length,
            'filtered result must be a strict subset of the unfiltered list');
        const allIdx = new Set(all.map(x => x.idx));
        let maxIdx = -1;
        for (const entry of beg) {
            assert.truthy(allIdx.has(entry.idx),
                `filtered idx ${entry.idx} missing from unfiltered list`);
            if (entry.idx > maxIdx) maxIdx = entry.idx;
        }
        assert.equal(maxIdx, 114,
            'beginning range must end at word idx 114 (115 word slots)');
        assert.equal(beg.length, 115,
            'every beginning-range word is tagged daily today');
    });

    test('union of all 15 topics covers every one of the 1957 vocabulary indices', () => {
        assert.equal(ieltsVocabulary.length, 1957, 'vocabulary size pin');
        const covered = new Set();
        for (const t of TOPICS) {
            for (const entry of getWordsForTopic(t.id, null)) covered.add(entry.idx);
        }
        assert.equal(covered.size, ieltsVocabulary.length,
            'some word indices are tagged by no topic at all');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
