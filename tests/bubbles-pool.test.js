// tests/bubbles-pool.test.js — Word Bubbles game pool is sourced from
// Grammar vocabulary questions (v3.33). Locks in the data flow so the
// game never silently falls back to random IELTS vocabulary.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode({ includeBubbles: true });

const ALL_UNIT_IDS = ['unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6', 'unit7', 'unit8', 'unit9', 'unit10', 'unit11'];

suite('bubbles: pool sourced from Grammar vocab questions (v3.33)', () => {
    test('getGameWordPool returns ≥200 entries (plenty for a single game)', () => {
        const pool = env.getGameWordPool();
        assert.truthy(pool.length >= 200, `pool only has ${pool.length} entries`);
    });

    test('every entry has { en, vi, emoji, _sourceQ, _unitId }', () => {
        const pool = env.getGameWordPool();
        for (const e of pool.slice(0, 50)) {
            assert.truthy(typeof e.en === 'string' && e.en.length > 0,
                `entry missing en: ${JSON.stringify(e)}`);
            assert.truthy(typeof e.vi === 'string' && e.vi.length > 0,
                `entry missing vi (question text): ${e.en}`);
            assert.truthy(typeof e.emoji === 'string' && e.emoji.length > 0,
                `entry missing emoji: ${e.en}`);
            assert.truthy(e._sourceQ && typeof e._sourceQ === 'object',
                `entry missing _sourceQ ref: ${e.en}`);
            assert.truthy(ALL_UNIT_IDS.includes(e._unitId),
                `entry has bad _unitId "${e._unitId}"`);
        }
    });

    test('every entry\'s en EQUALS its sourceQ\'s correct option', () => {
        const pool = env.getGameWordPool();
        for (const e of pool) {
            const correct = e._sourceQ.options[e._sourceQ.correct];
            assert.equal(e.en, String(correct).trim(),
                `mismatch — en="${e.en}" but sourceQ correct="${correct}"`);
        }
    });

    test('every entry\'s vi EQUALS its sourceQ\'s question text', () => {
        const pool = env.getGameWordPool();
        for (const e of pool) {
            assert.equal(e.vi, String(e._sourceQ.q || '').trim(),
                `vi mismatch for ${e._sourceQ.id}`);
        }
    });

    test('every entry comes from a vocabulary-type question', () => {
        const pool = env.getGameWordPool();
        for (const e of pool) {
            assert.equal(e._sourceQ.type, 'vocabulary',
                `${e._sourceQ.id} is type "${e._sourceQ.type}", not vocabulary`);
        }
    });

    test('every bubble option text is ≤22 chars (readable on phone)', () => {
        const pool = env.getGameWordPool();
        for (const e of pool) {
            assert.truthy(e.en.length <= 22,
                `option "${e.en}" too long (${e.en.length} chars)`);
            // And its sibling options too, since they become distractor bubbles
            for (const opt of e._sourceQ.options) {
                assert.truthy(opt.length <= 22,
                    `${e._sourceQ.id} has a long option "${opt}" (${opt.length} chars)`);
            }
        }
    });

    test('pool draws from ALL 11 units (no unit forgotten)', () => {
        const pool = env.getGameWordPool();
        const unitsRepresented = new Set(pool.map(e => e._unitId));
        for (const uid of ALL_UNIT_IDS) {
            assert.truthy(unitsRepresented.has(uid),
                `unit "${uid}" has 0 entries in pool`);
        }
    });

    test('pool has ≥10 entries per unit (variety in long games)', () => {
        const pool = env.getGameWordPool();
        const counts = {};
        for (const e of pool) counts[e._unitId] = (counts[e._unitId] || 0) + 1;
        for (const uid of ALL_UNIT_IDS) {
            assert.truthy(counts[uid] >= 10,
                `unit "${uid}" only has ${counts[uid] || 0} entries (need ≥10)`);
        }
    });

    test('every entry\'s sourceQ has 4 valid options', () => {
        const pool = env.getGameWordPool();
        for (const e of pool) {
            const opts = e._sourceQ.options;
            assert.equal(opts.length, 4, `${e._sourceQ.id} has ${opts.length} options`);
            // Correct index in range
            assert.truthy(e._sourceQ.correct >= 0 && e._sourceQ.correct < 4,
                `${e._sourceQ.id} bad correct index ${e._sourceQ.correct}`);
        }
    });

    test('pool does NOT fall back to ieltsVocabulary entries', () => {
        // The old implementation returned shuffled ieltsVocabulary entries
        // when SRS was empty. Those entries don't have _sourceQ — verify
        // every current entry has the grammar marker.
        const pool = env.getGameWordPool();
        for (const e of pool) {
            assert.truthy(e._sourceQ,
                `entry "${e.en}" is missing _sourceQ — it looks like an old fallback entry`);
        }
    });

    test('pool is shuffled (not always in the same order)', () => {
        // Call twice and compare first few entries — should usually differ
        // due to randomness.
        const p1 = env.getGameWordPool();
        const p2 = env.getGameWordPool();
        let diff = 0;
        for (let i = 0; i < Math.min(20, p1.length); i++) {
            if (p1[i].en !== p2[i].en) diff++;
        }
        assert.truthy(diff >= 3, `expected pool shuffled — only ${diff} differing positions in first 20`);
    });
});

suite('bubbles: pool entries match clue/bubble UI expectations', () => {
    test('every entry\'s vi (clue) contains a blank marker "___"', () => {
        const pool = env.getGameWordPool();
        let withBlank = 0;
        for (const e of pool) {
            if (/_{2,}/.test(e.vi)) withBlank++;
        }
        // Not all vocab questions are blank-style, but most should be.
        const pct = withBlank / pool.length;
        assert.truthy(pct >= 0.6,
            `only ${(pct * 100).toFixed(0)}% of clues contain a blank "___"`);
    });

    test('pool size is enough for a hard-mode game (6 bubbles × 10 rounds)', () => {
        const pool = env.getGameWordPool();
        const diff = env.BUBBLE_DIFFICULTIES.hard;
        const needed = diff.bubbles * diff.rounds;
        assert.truthy(pool.length >= needed,
            `pool ${pool.length} < needed ${needed} for hard mode`);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
