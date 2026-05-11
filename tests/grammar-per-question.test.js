// tests/grammar-per-question.test.js — One test PER question (2,420 total).
// Each test is named with the question ID so a failure points directly to
// the bug. Grouped into 11 suites (one per unit) for readable reports.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

const VALID_TYPES = new Set(['vocabulary', 'grammar', 'pronunciation', 'arrangement']);

// Generate one suite per unit so the test report is grouped logically.
for (const unit of env.GRAMMAR_UNITS) {
    const unitNum = unit.id.replace('unit', '');
    const expectedPrefix = `u${unitNum}-`;

    suite(`per-question: ${unit.id} (${unit.questions.length} questions)`, () => {
        for (const q of unit.questions) {
            test(`${q.id} is well-formed`, () => {
                // ── ID format ──
                assert.truthy(typeof q.id === 'string' && q.id.startsWith(expectedPrefix),
                    `bad ID format: ${q.id} (expected ${expectedPrefix}<n>)`);

                // ── Type ──
                assert.truthy(VALID_TYPES.has(q.type),
                    `invalid type "${q.type}" for ${q.id}`);

                // ── Topic ──
                assert.truthy(typeof q.topic === 'string' && q.topic.trim().length > 0,
                    `${q.id} missing/empty topic`);

                // ── Explanation ──
                assert.truthy(typeof q.explanation === 'string' && q.explanation.length >= 20,
                    `${q.id} explanation under 20 chars: "${q.explanation}"`);

                // ── Type-specific ──
                if (q.type === 'arrangement') {
                    assert.truthy(Array.isArray(q.parts),
                        `${q.id} arrangement missing parts array`);
                    assert.truthy(q.parts.length >= 3 && q.parts.length <= 8,
                        `${q.id} parts length ${q.parts.length} out of range [3,8]`);
                    for (let i = 0; i < q.parts.length; i++) {
                        assert.truthy(typeof q.parts[i] === 'string' && q.parts[i].length > 0,
                            `${q.id} parts[${i}] empty`);
                    }
                    // Last part must end with sentence-final punctuation
                    const last = q.parts[q.parts.length - 1];
                    const okEnd = last === '.' || last === '?' || last === '!' ||
                                  last.endsWith('.') || last.endsWith('?') || last.endsWith('!');
                    assert.truthy(okEnd, `${q.id} arrangement doesn't end with .?!`);
                } else {
                    // Multiple-choice: q, options, correct
                    assert.truthy(typeof q.q === 'string' && q.q.length > 0,
                        `${q.id} missing question text`);
                    assert.truthy(Array.isArray(q.options) && q.options.length >= 2 && q.options.length <= 5,
                        `${q.id} options length ${q.options ? q.options.length : 'undefined'} out of range [2,5]`);
                    for (let i = 0; i < q.options.length; i++) {
                        assert.truthy(typeof q.options[i] === 'string' && q.options[i].length > 0,
                            `${q.id} options[${i}] empty`);
                    }
                    // Strict-unique options
                    assert.equal(new Set(q.options).size, q.options.length,
                        `${q.id} has duplicate options: ${q.options.join(' | ')}`);
                    // Correct in valid range
                    assert.truthy(typeof q.correct === 'number',
                        `${q.id} correct not a number: ${q.correct}`);
                    assert.truthy(q.correct >= 0 && q.correct < q.options.length,
                        `${q.id} correct=${q.correct} out of range`);
                }
            });
        }
    });
}

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
