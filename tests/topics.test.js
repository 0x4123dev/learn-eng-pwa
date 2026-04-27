// tests/topics.test.js — Topic classification and lookup
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();
const { TOPICS, INDEX_RANGE_TOPICS, WORD_TOPIC_OVERRIDES, WORD_TOPIC_ADDITIONS,
        getTopicsForWord, getTopicsForWordIndex, getWordsForTopic, getTopicCounts,
        getTopicById, ieltsVocabulary } = env;

suite('topics: TOPICS taxonomy', () => {
    test('exactly 15 topics defined', () => {
        assert.equal(TOPICS.length, 15);
    });

    test('every topic has id, name, icon, color', () => {
        for (const t of TOPICS) {
            assert.truthy(t.id, `topic missing id: ${JSON.stringify(t)}`);
            assert.truthy(t.name, `topic ${t.id} missing name`);
            assert.truthy(t.icon, `topic ${t.id} missing icon`);
            assert.truthy(t.color, `topic ${t.id} missing color`);
        }
    });

    test('topic IDs are unique', () => {
        const ids = TOPICS.map(t => t.id);
        const unique = new Set(ids);
        assert.equal(ids.length, unique.size, 'duplicate topic IDs');
    });

    test('all expected topics present', () => {
        const expectedIds = ['people', 'character', 'communication', 'actions', 'thinking',
            'business', 'society', 'science', 'health', 'environment',
            'tech', 'education', 'arts', 'daily', 'quality'];
        for (const id of expectedIds) {
            assert.truthy(TOPICS.find(t => t.id === id), `missing topic: ${id}`);
        }
    });
});

suite('topics: INDEX_RANGE_TOPICS coverage', () => {
    test('ranges cover word index 0', () => {
        const r = INDEX_RANGE_TOPICS.find(r => 0 >= r.from && 0 < r.to);
        assert.truthy(r, 'word index 0 not covered');
    });

    test('ranges cover the last word index', () => {
        const lastIdx = ieltsVocabulary.length - 1;
        const r = INDEX_RANGE_TOPICS.find(r => lastIdx >= r.from && lastIdx < r.to);
        assert.truthy(r, `last index ${lastIdx} not covered`);
    });

    test('ranges are non-overlapping and contiguous', () => {
        const sorted = [...INDEX_RANGE_TOPICS].sort((a, b) => a.from - b.from);
        for (let i = 1; i < sorted.length; i++) {
            assert.equal(sorted[i].from, sorted[i-1].to,
                `gap or overlap between [${sorted[i-1].from}, ${sorted[i-1].to}) and [${sorted[i].from}, ${sorted[i].to})`);
        }
    });

    test('every range references valid topic IDs', () => {
        const validIds = new Set(TOPICS.map(t => t.id));
        for (const r of INDEX_RANGE_TOPICS) {
            for (const tid of r.topics) {
                assert.truthy(validIds.has(tid),
                    `range [${r.from}, ${r.to}) references unknown topic: ${tid}`);
            }
        }
    });
});

suite('topics: WORD_TOPIC_ADDITIONS validity', () => {
    test('every addition references valid topic IDs', () => {
        const validIds = new Set(TOPICS.map(t => t.id));
        for (const [word, topics] of Object.entries(WORD_TOPIC_ADDITIONS)) {
            for (const tid of topics) {
                assert.truthy(validIds.has(tid),
                    `WORD_TOPIC_ADDITIONS["${word}"] references unknown topic: ${tid}`);
            }
        }
    });

    test('overrides reference valid topic IDs', () => {
        const validIds = new Set(TOPICS.map(t => t.id));
        for (const [word, topics] of Object.entries(WORD_TOPIC_OVERRIDES)) {
            for (const tid of topics) {
                assert.truthy(validIds.has(tid),
                    `WORD_TOPIC_OVERRIDES["${word}"] references unknown topic: ${tid}`);
            }
        }
    });
});

suite('topics: getTopicsForWord', () => {
    test('returns topic IDs for first vocabulary word', () => {
        const first = ieltsVocabulary[0]; // apartment (Buildings)
        const topics = getTopicsForWord(first.en);
        assert.truthy(Array.isArray(topics));
        assert.truthy(topics.length > 0);
        assert.contains(topics, 'daily');
    });

    test('returns array for any valid word', () => {
        for (let i = 0; i < ieltsVocabulary.length; i += 100) {
            const w = ieltsVocabulary[i];
            const topics = getTopicsForWord(w.en);
            assert.truthy(Array.isArray(topics) && topics.length > 0,
                `word "${w.en}" at idx ${i} has no topics`);
        }
    });

    test('addition word gets union of range + addition topics', () => {
        // 'analysis' is in WORD_TOPIC_ADDITIONS as ['thinking']
        // Check it gets the range topics PLUS thinking (no duplication)
        if (WORD_TOPIC_ADDITIONS.analysis && ieltsVocabulary.find(w => w.en === 'analysis')) {
            const topics = getTopicsForWord('analysis');
            assert.contains(topics, 'thinking');
            // Should not have duplicate 'thinking'
            const count = topics.filter(t => t === 'thinking').length;
            assert.equal(count, 1, 'thinking duplicated in topics');
        }
    });

    test('returns ["thinking"] fallback for unknown word', () => {
        const topics = getTopicsForWord('___nonexistent___');
        assert.deepEqual(topics, ['thinking']);
    });
});

suite('topics: getTopicCounts (≥100 per topic)', () => {
    test('every topic has at least 100 words', () => {
        const counts = getTopicCounts(null);
        for (const t of TOPICS) {
            assert.truthy(counts[t.id] >= 100,
                `topic ${t.id} has only ${counts[t.id]} words (need ≥100)`);
        }
    });

    test('total tagged-word count exceeds vocabulary count (multi-tagging works)', () => {
        const counts = getTopicCounts(null);
        const total = Object.values(counts).reduce((a, b) => a + b, 0);
        assert.truthy(total > ieltsVocabulary.length,
            `total tags ${total} should exceed vocab size ${ieltsVocabulary.length}`);
    });
});

suite('topics: getWordsForTopic', () => {
    test('returns words for each topic', () => {
        for (const t of TOPICS) {
            const words = getWordsForTopic(t.id, null);
            assert.truthy(words.length > 0, `topic ${t.id} returned 0 words`);
        }
    });

    test('returned words include valid {word, idx} shape', () => {
        const words = getWordsForTopic('thinking', null);
        for (let i = 0; i < Math.min(5, words.length); i++) {
            assert.truthy(words[i].word, `entry ${i} missing word`);
            assert.truthy(words[i].word.en, `entry ${i} word missing 'en'`);
            assert.equal(typeof words[i].idx, 'number');
        }
    });

    test('words are sorted by index (easy → hard)', () => {
        const words = getWordsForTopic('communication', null);
        for (let i = 1; i < words.length; i++) {
            assert.truthy(words[i].idx > words[i-1].idx,
                `words out of order at position ${i}`);
        }
    });

    test('returns empty array for unknown topic', () => {
        const words = getWordsForTopic('___fake___', null);
        assert.equal(words.length, 0);
    });
});

suite('topics: getTopicById', () => {
    test('returns metadata for known topic', () => {
        const t = getTopicById('thinking');
        assert.equal(t.id, 'thinking');
        assert.truthy(t.name);
        assert.truthy(t.icon);
    });

    test('returns undefined for unknown topic', () => {
        assert.falsy(getTopicById('___fake___'));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
