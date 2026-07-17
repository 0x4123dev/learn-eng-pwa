// tests/gen-grammar-bank.test.js — Grammar units GLOBAL invariants.
// Complements grammar.test.js / grammar-all-units.test.js with checks those
// files don't make:
//   • Global (cross-unit) question-id uniqueness with EXACT totals, id format,
//     and id-prefix ↔ owning-unit integrity across ALL 13 units (the existing
//     prefix test skips unit13).
//   • Per-unit card metadata: icon, strict 6-digit #hex color, description.
//   • Per-unit mcq-style `correct` is an integer inside options bounds.
//   • Arrangement questions have parts.length ≥ 3 and NO `options` field
//     (the no-options invariant is not asserted anywhere else); they also
//     never carry a `q` field (prompt comes from `parts`).
//   • Exact type universe {vocabulary, grammar, pronunciation, arrangement}
//     with per-type totals; every question has a ≥35-char explanation.
//   • Topic hygiene: non-empty, trimmed; casing characterized as-is (43
//     distinct topics legitimately contain uppercase proper nouns/acronyms).

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

const ALL_13_UNIT_IDS = [
    'unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6', 'unit7',
    'unit8', 'unit9', 'unit10', 'unit11', 'unit12', 'unit13'
];

// ============================================================================
// GLOBAL QUESTION-ID UNIQUENESS (across all 13 units, exact totals)
// ============================================================================
suite('gen: global question-id uniqueness', () => {
    test('all 4,607 question ids are globally unique across the 13 units', () => {
        const ids = [];
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) ids.push(q.id);
        }
        assert.equal(ids.length, 4607, 'total question count changed');
        assert.equal(new Set(ids).size, 4607, 'duplicate question ids across units');
    });

    test('every question id matches the u<num>-<num> format', () => {
        const idRe = /^u\d+-\d+$/;
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                assert.truthy(typeof q.id === 'string' && idRe.test(q.id),
                    `${u.id} has malformed question id "${q.id}"`);
            }
        }
    });

    test('every question id prefix matches its owning unit (incl. unit13)', () => {
        // A question that lives in unitN must have an id starting "uN-";
        // combined with global uniqueness this proves no id can be claimed
        // by two units.
        for (const u of env.GRAMMAR_UNITS) {
            const prefix = 'u' + u.id.replace('unit', '') + '-';
            const strays = u.questions.filter(q => !q.id.startsWith(prefix));
            assert.equal(strays.length, 0,
                `${u.id} owns foreign-prefixed ids: ${strays.slice(0, 3).map(q => q.id).join(', ')}`);
        }
    });

    test('GRAMMAR_UNITS lists exactly unit1..unit13 in order', () => {
        assert.deepEqual(env.GRAMMAR_UNITS.map(u => u.id), ALL_13_UNIT_IDS);
    });

    test('question type universe is exactly {vocabulary:962, grammar:2597, pronunciation:432, arrangement:616}', () => {
        const counts = {};
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) counts[q.type] = (counts[q.type] || 0) + 1;
        }
        assert.deepEqual(counts, {
            vocabulary: 962,
            grammar: 2597,
            pronunciation: 432,
            arrangement: 616
        });
    });
});

// ============================================================================
// PER-UNIT CARD METADATA (icon / #hex color / description)
// ============================================================================
suite('gen: unit card metadata', () => {
    for (const unitId of ALL_13_UNIT_IDS) {
        test(`${unitId} has icon, 6-digit #hex color, and description`, () => {
            const u = env.getGrammarUnit(unitId);
            assert.truthy(u, `${unitId} not found`);
            assert.truthy(typeof u.icon === 'string' && u.icon.length > 0,
                `${unitId} missing icon`);
            // All 13 units use a strict 6-digit hex color (e.g. "#3a86ff").
            assert.truthy(/^#[0-9A-Fa-f]{6}$/.test(u.color),
                `${unitId} color is not 6-digit #hex: "${u.color}"`);
            assert.truthy(typeof u.description === 'string' && u.description.length >= 10,
                `${unitId} description missing/too short`);
        });
    }
});

// ============================================================================
// MCQ-STYLE `correct` INDEX BOUNDS (per unit, integer + in-range)
// ============================================================================
suite('gen: mcq correct index bounds per unit', () => {
    for (const unitId of ALL_13_UNIT_IDS) {
        test(`${unitId} — every mcq-style correct index is an integer within options`, () => {
            const u = env.getGrammarUnit(unitId);
            let checked = 0;
            for (const q of u.questions) {
                if (q.type === 'arrangement') continue;
                assert.truthy(Array.isArray(q.options) && q.options.length >= 2,
                    `${q.id} needs ≥2 options`);
                assert.truthy(q.options.every(o => typeof o === 'string' && o.trim().length > 0),
                    `${q.id} has a blank/non-string option`);
                assert.truthy(Number.isInteger(q.correct),
                    `${q.id} correct is not an integer: ${JSON.stringify(q.correct)}`);
                assert.inRange(q.correct, 0, q.options.length - 1,
                    `${q.id} correct index out of bounds`);
                checked++;
            }
            assert.truthy(checked > 0, `${unitId} has no mcq-style questions`);
        });
    }
});

// ============================================================================
// ARRANGEMENT SHAPE (parts ≥ 3, no `options` field) — per unit
// ============================================================================
suite('gen: arrangement questions have parts, never options', () => {
    for (const unitId of ALL_13_UNIT_IDS) {
        test(`${unitId} — arrangement questions have ≥3 parts and no options field`, () => {
            const u = env.getGrammarUnit(unitId);
            const arrQs = u.questions.filter(q => q.type === 'arrangement');
            // Every unit — including unit12 (105) and unit13 (55) — ships
            // arrangement questions.
            assert.truthy(arrQs.length > 0, `${unitId} has no arrangement questions`);
            for (const q of arrQs) {
                assert.truthy(Array.isArray(q.parts) && q.parts.length >= 3,
                    `${q.id} parts missing or <3 (${q.parts ? q.parts.length : 'none'})`);
                assert.falsy('options' in q,
                    `${q.id} is arrangement but carries an options field`);
            }
        });
    }
});

// ============================================================================
// QUESTION TEXT + EXPLANATION COVERAGE (global)
// ============================================================================
suite('gen: question text and explanations', () => {
    test('arrangement questions never carry a q field; all other types have non-empty q', () => {
        // Characterization: arrangement prompts come from `parts`, so the 616
        // arrangement questions omit `q` entirely; the 3,991 others all have
        // real question text.
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type === 'arrangement') {
                    assert.falsy('q' in q, `${q.id} is arrangement but has a q field`);
                } else {
                    assert.truthy(typeof q.q === 'string' && q.q.trim().length > 0,
                        `${q.id} (${q.type}) has missing/empty q text`);
                }
            }
        }
    });

    test('every question has a substantive explanation (≥35 chars, all 4,607)', () => {
        let count = 0;
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                assert.truthy(typeof q.explanation === 'string' && q.explanation.length >= 35,
                    `${q.id} explanation missing/too short (${q.explanation ? q.explanation.length : 'none'} chars)`);
                count++;
            }
        }
        assert.equal(count, 4607, 'explanation sweep did not cover the whole bank');
    });
});

// ============================================================================
// TOPIC HYGIENE (non-empty, trimmed; casing characterized)
// ============================================================================
suite('gen: topic hygiene', () => {
    test('every question topic is a non-empty, trimmed string', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                assert.truthy(typeof q.topic === 'string' && q.topic.length > 0,
                    `${q.id} topic missing/empty`);
                assert.equal(q.topic.trim(), q.topic,
                    `${q.id} topic has leading/trailing whitespace`);
            }
        }
    });

    test('bank has exactly 443 distinct topics across all units', () => {
        const topics = new Set();
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) topics.add(q.topic);
        }
        assert.equal(topics.size, 443);
    });

    test('exactly 43 distinct topics contain uppercase (proper nouns/acronyms only)', () => {
        // Characterization: topics are lowercase by convention EXCEPT proper
        // nouns, acronyms, and the pronoun "I" ("TV", "London buildings",
        // "van Gogh", "present simple (I/you/we/they)", …).
        const nonLower = new Set();
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.topic !== q.topic.toLowerCase()) nonLower.add(q.topic);
            }
        }
        assert.equal(nonLower.size, 43,
            `non-lowercase topic set changed: ${[...nonLower].slice(0, 5).join(' | ')}`);
        assert.truthy(nonLower.has('TV'), 'expected acronym topic "TV"');
        assert.truthy(nonLower.has('London buildings'), 'expected proper-noun topic');
    });

    test('units 1, 2, 4, 5, 6, 12, 13 use strictly lowercase topics', () => {
        // The uppercase (proper-noun) topics live only in units 3, 7, 8-11.
        for (const unitId of ['unit1', 'unit2', 'unit4', 'unit5', 'unit6', 'unit12', 'unit13']) {
            const u = env.getGrammarUnit(unitId);
            const bad = u.questions.filter(q => q.topic !== q.topic.toLowerCase());
            assert.equal(bad.length, 0,
                `${unitId} has non-lowercase topics: ${bad.slice(0, 3).map(q => q.topic).join(' | ')}`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
