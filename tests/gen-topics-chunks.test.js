// tests/gen-topics-chunks.test.js — Topic lesson chunk helpers (v3.80 logic).
// Characterizes _isChunkDone / _nextUnfinishedChunk in js/topics.js:
//   * _isChunkDone(topicProgress, chunk, idx) — done when topicProgress[idx]
//     is truthy OR every chunk word's SRS card has interval ≥ SRS_MASTERED_INTERVAL.
//   * _nextUnfinishedChunk(topicId, currentIdx) — forward-preferring scan that
//     wraps backward (including currentIdx itself) and returns -1 when all done.
// These are plain top-level function declarations, so the vm sandbox exposes
// them directly on the loadAppCode() result (they are not in EXPORT_NAMES).
// Both read the lexical `appState`, injected via env.__setAppState.
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();
const { TOPICS, getWordsForTopic, WORDS_PER_LESSON, SRS_MASTERED_INTERVAL } = env;

const TOPIC_ID = TOPICS[0].id; // real first topic ("people")
const WORDS = getWordsForTopic(TOPIC_ID, null);
const TOTAL = Math.ceil(WORDS.length / WORDS_PER_LESSON);

function chunkAt(i) {
    return WORDS.slice(i * WORDS_PER_LESSON, (i + 1) * WORDS_PER_LESSON);
}

// Inject a fresh lexical appState. `progress` is the per-topic progress map
// (idx → status), `srs` the SRS card store keyed by English word.
function setState(progress, srs) {
    env.__setAppState({
        srs: srs || {},
        topicProgress: { [TOPIC_ID]: progress || {} }
    });
}

// Build an SRS store where every entry of `entries` is at `interval` days.
function srsFor(entries, interval) {
    const srs = {};
    for (const c of entries) {
        srs[c.word.en] = { interval, ease: 2.5, nextReview: 0, reps: 3 };
    }
    return srs;
}

// Progress map marking every chunk done except the listed indices.
function progAllExcept(exceptIdxs) {
    const skip = new Set(exceptIdxs || []);
    const p = {};
    for (let i = 0; i < TOTAL; i++) {
        if (!skip.has(i)) p[i] = { mistakes: 0 };
    }
    return p;
}

suite('gen: chunk helpers exist', () => {
    test('_isChunkDone is exposed by the sandbox as a 3-arg function', () => {
        assert.equal(typeof env._isChunkDone, 'function');
        assert.equal(env._isChunkDone.length, 3);
    });

    test('_nextUnfinishedChunk is exposed by the sandbox as a 2-arg function', () => {
        assert.equal(typeof env._nextUnfinishedChunk, 'function');
        assert.equal(env._nextUnfinishedChunk.length, 2);
    });

    test(`first topic "${TOPIC_ID}" has 340 words → 68 full chunks of ${WORDS_PER_LESSON}`, () => {
        assert.equal(WORDS.length, 340);
        assert.equal(TOTAL, 68);
        assert.equal(chunkAt(0).length, WORDS_PER_LESSON);
        assert.equal(chunkAt(TOTAL - 1).length, WORDS_PER_LESSON, '340 % 5 === 0 — last chunk is full');
    });

    test('pinned app constants: WORDS_PER_LESSON = 5, SRS_MASTERED_INTERVAL = 14', () => {
        assert.equal(WORDS_PER_LESSON, 5);
        assert.equal(SRS_MASTERED_INTERVAL, 14);
    });

    test('every "people" entry exposes a non-empty word.en string (the SRS store key)', () => {
        assert.equal(WORDS.length > 0, true);
        assert.truthy(WORDS.every(c => c && c.word && typeof c.word.en === 'string' && c.word.en.length > 0));
    });
});

suite('gen: _isChunkDone via topicProgress', () => {
    test('true when topicProgress[idx] is a status object', () => {
        setState({}, {});
        assert.equal(env._isChunkDone({ 0: { mistakes: 0 } }, chunkAt(0), 0), true);
    });

    test('true when topicProgress[idx] is boolean true (any truthy value counts)', () => {
        setState({}, {});
        assert.equal(env._isChunkDone({ 3: true }, chunkAt(3), 3), true);
    });

    test('true when topicProgress[idx] is the number 1', () => {
        setState({}, {});
        assert.equal(env._isChunkDone({ 2: 1 }, chunkAt(2), 2), true);
    });

    test('topicProgress short-circuits: true even when appState is null', () => {
        env.__setAppState(null);
        assert.equal(env._isChunkDone({ 0: { mistakes: 2 } }, chunkAt(0), 0), true);
    });

    test('false when topicProgress is null and no SRS mastery', () => {
        setState({}, {});
        assert.equal(env._isChunkDone(null, chunkAt(0), 0), false);
    });

    test('false when topicProgress is an empty object and no SRS mastery', () => {
        setState({}, {});
        assert.equal(env._isChunkDone({}, chunkAt(0), 0), false);
    });

    test('false when only a DIFFERENT chunk idx is marked done', () => {
        setState({}, {});
        assert.equal(env._isChunkDone({ 1: { mistakes: 0 } }, chunkAt(0), 0), false);
    });

    test('false when topicProgress[idx] is falsy (0) — falls through to SRS check', () => {
        setState({}, {});
        assert.equal(env._isChunkDone({ 0: 0 }, chunkAt(0), 0), false);
    });

    test('fall-through proof: status 0 + fully mastered chunk still returns true via SRS', () => {
        const chunk = chunkAt(0);
        setState({}, srsFor(chunk, SRS_MASTERED_INTERVAL));
        assert.equal(env._isChunkDone({ 0: 0 }, chunk, 0), true);
    });
});

suite('gen: _isChunkDone via SRS mastery', () => {
    test(`true when every chunk word is at exactly SRS_MASTERED_INTERVAL (${SRS_MASTERED_INTERVAL})`, () => {
        const chunk = chunkAt(0);
        setState({}, srsFor(chunk, SRS_MASTERED_INTERVAL));
        assert.equal(env._isChunkDone({}, chunk, 0), true);
    });

    test('true when every chunk word is well above the mastered threshold', () => {
        const chunk = chunkAt(0);
        setState({}, srsFor(chunk, SRS_MASTERED_INTERVAL + 16));
        assert.equal(env._isChunkDone({}, chunk, 0), true);
    });

    test('false when one word sits at threshold-1 (strict ≥ boundary)', () => {
        const chunk = chunkAt(0);
        const srs = srsFor(chunk, SRS_MASTERED_INTERVAL);
        srs[chunk[0].word.en].interval = SRS_MASTERED_INTERVAL - 1;
        setState({}, srs);
        assert.equal(env._isChunkDone({}, chunk, 0), false);
    });

    test('false when one chunk word has no SRS card at all', () => {
        const chunk = chunkAt(0);
        const srs = srsFor(chunk.slice(1), SRS_MASTERED_INTERVAL);
        setState({}, srs);
        assert.equal(env._isChunkDone({}, chunk, 0), false);
    });

    test('false with an empty SRS store', () => {
        setState({}, {});
        assert.equal(env._isChunkDone({}, chunkAt(0), 0), false);
    });

    test('false when appState.srs is null', () => {
        env.__setAppState({ srs: null, topicProgress: {} });
        assert.equal(env._isChunkDone({}, chunkAt(0), 0), false);
    });

    test('false when appState itself is null (guarded, no throw)', () => {
        env.__setAppState(null);
        assert.equal(env._isChunkDone({}, chunkAt(0), 0), false);
    });

    test('false for an EMPTY chunk even when the SRS store is fully mastered', () => {
        setState({}, srsFor(chunkAt(0), SRS_MASTERED_INTERVAL));
        assert.equal(env._isChunkDone({}, [], 0), false, 'chunk.length guard rejects []');
    });

    test('true for a single-word chunk whose one card is mastered', () => {
        const mini = [WORDS[0]];
        setState({}, srsFor(mini, SRS_MASTERED_INTERVAL));
        assert.equal(env._isChunkDone({}, mini, 0), true);
    });

    test('false for a single-word chunk below the threshold', () => {
        const mini = [WORDS[0]];
        setState({}, srsFor(mini, SRS_MASTERED_INTERVAL - 1));
        assert.equal(env._isChunkDone({}, mini, 0), false);
    });

    test('due-ness is irrelevant: mastered cards with nextReview in the past still count', () => {
        const chunk = chunkAt(0);
        const srs = srsFor(chunk, SRS_MASTERED_INTERVAL);
        for (const k of Object.keys(srs)) srs[k].nextReview = 1; // long overdue
        setState({}, srs);
        assert.equal(env._isChunkDone({}, chunk, 0), true);
    });

    test('cards for OTHER words do not make an untracked chunk done', () => {
        const chunk = chunkAt(0);
        setState({}, srsFor(chunkAt(1), SRS_MASTERED_INTERVAL));
        assert.equal(env._isChunkDone({}, chunk, 0), false);
    });

    // Data-driven: each of the first 5 real chunks is done once fully mastered.
    for (let i = 0; i < 5; i++) {
        test(`chunk ${i} of "${TOPIC_ID}" reports done when all ${chunkAt(i).length} words are mastered`, () => {
            const chunk = chunkAt(i);
            setState({}, srsFor(chunk, SRS_MASTERED_INTERVAL));
            assert.equal(env._isChunkDone({}, chunk, i), true);
        });
    }
});

suite('gen: _nextUnfinishedChunk forward scan', () => {
    test('fresh topic, currentIdx -1 → first chunk (0)', () => {
        setState({}, {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, -1), 0);
    });

    test('fresh topic, currentIdx 0 → 1 (never re-returns currentIdx while forward chunks remain)', () => {
        setState({}, {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 0), 1);
    });

    test('fresh topic, currentIdx 5 → 6', () => {
        setState({}, {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 5), 6);
    });

    test('skips a chunk done via topicProgress: chunk 1 done, currentIdx 0 → 2', () => {
        setState({ 1: { mistakes: 0 } }, {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 0), 2);
    });

    test('skips a run of done chunks: 1-3 done, currentIdx 0 → 4', () => {
        setState({ 1: { mistakes: 0 }, 2: { mistakes: 1 }, 3: { mistakes: 0 } }, {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 0), 4);
    });

    test('skips a chunk done via SRS mastery alone (no topicProgress): chunk 1 mastered → 2', () => {
        setState({}, srsFor(chunkAt(1), SRS_MASTERED_INTERVAL));
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 0), 2);
    });

    test('near the end: currentIdx TOTAL-2 → TOTAL-1', () => {
        setState({}, {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, TOTAL - 2), TOTAL - 1);
    });

    test('mid-scan skip: chunks 6 and 7 done, currentIdx 5 → 8', () => {
        setState({ 6: { mistakes: 0 }, 7: { mistakes: 0 } }, {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 5), 8);
    });
});

suite('gen: _nextUnfinishedChunk wrap + all-done', () => {
    test('at the last chunk with nothing done, wraps backward to 0', () => {
        setState({}, {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, TOTAL - 1), 0);
    });

    test('everything after currentIdx done → wraps to earliest unfinished (0)', () => {
        setState(progAllExcept([0, 1, 2]), {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 2), 0);
    });

    test('wrap loop includes currentIdx itself: only idx 2 unfinished, currentIdx 2 → 2', () => {
        setState(progAllExcept([2]), {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 2), 2);
    });

    test('wrap picks the earliest unfinished before currentIdx: only 1,2 open, currentIdx 5 → 1', () => {
        setState(progAllExcept([1, 2]), {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 5), 1);
    });

    test('all chunks done via topicProgress, currentIdx -1 → -1', () => {
        setState(progAllExcept([]), {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, -1), -1);
    });

    test('all chunks done via topicProgress, currentIdx 10 → -1', () => {
        setState(progAllExcept([]), {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 10), -1);
    });

    test('all chunks done via SRS mastery alone (no topicProgress) → -1', () => {
        setState({}, srsFor(WORDS, SRS_MASTERED_INTERVAL));
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 0), -1);
    });

    test('mixed done-ness: all-but-last via progress, last chunk via SRS → -1', () => {
        setState(progAllExcept([TOTAL - 1]), srsFor(chunkAt(TOTAL - 1), SRS_MASTERED_INTERVAL));
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 3), -1);
    });

    test('currentIdx past the end (TOTAL+3): wrap loop is bounded by total → 0', () => {
        setState({}, {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, TOTAL + 3), 0);
    });

    test('only chunk 0 unfinished, currentIdx 0 → 0 (returned via wrap)', () => {
        setState(progAllExcept([0]), {});
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, 0), 0);
    });

    test('null appState is tolerated: fresh scan still returns 0', () => {
        env.__setAppState(null);
        assert.equal(env._nextUnfinishedChunk(TOPIC_ID, -1), 0);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
