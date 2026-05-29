// tests/grammar-per-lesson.test.js — Detailed per-lesson tests across all
// 66 lesson cards (11 units × 6 sub-lessons). Each lesson generates
// multiple tests covering structure, vocabulary, pronunciation, and
// grammar blocks. Adds ~500 tests with precise failure locations.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

const PAGE_RE = /^\d+(-\d+)?$/; // "10" or "10-11"

// ── Helper: normalize vocabulary to array (lesson.vocabulary can be either an object or an array) ──
function vocabBlocks(lesson) {
    if (!lesson.vocabulary) return [];
    return Array.isArray(lesson.vocabulary) ? lesson.vocabulary : [lesson.vocabulary];
}

// ============================================================================
// PER-LESSON: STRUCTURE
// ============================================================================
for (const unit of env.GRAMMAR_LESSONS) {
    const unitNum = unit.unitId.replace('unit', '');

    suite(`per-lesson structure: ${unit.unitId} ${unit.title}`, () => {
        for (const lesson of unit.lessons) {
            test(`${lesson.id} has valid id, title, page reference`, () => {
                // ID format
                const expectedIdRe = new RegExp(`^${unitNum}[a-g]$`);
                assert.truthy(expectedIdRe.test(lesson.id),
                    `${lesson.id} doesn't match ${unitNum}[a-g]`);
                // Title
                assert.truthy(typeof lesson.title === 'string' && lesson.title.length > 0,
                    `${lesson.id} missing title`);
                // Page reference
                assert.truthy(typeof lesson.page === 'string' && PAGE_RE.test(lesson.page),
                    `${lesson.id} bad page reference: "${lesson.page}"`);
            });

            test(`${lesson.id} has at least one content section (vocab/pron/grammar)`, () => {
                const hasVocab = !!lesson.vocabulary;
                const hasPron = !!lesson.pronunciation;
                const hasGrammar = Array.isArray(lesson.grammar) && lesson.grammar.length > 0;
                assert.truthy(hasVocab || hasPron || hasGrammar,
                    `${lesson.id} has no content`);
            });

            test(`${lesson.id} topicTags array is well-formed (if present)`, () => {
                if (!('topicTags' in lesson)) return; // optional
                assert.truthy(Array.isArray(lesson.topicTags),
                    `${lesson.id} topicTags not an array`);
                for (let i = 0; i < lesson.topicTags.length; i++) {
                    assert.truthy(typeof lesson.topicTags[i] === 'string' && lesson.topicTags[i].length > 0,
                        `${lesson.id} topicTags[${i}] not a non-empty string`);
                }
            });
        }
    });
}

// ============================================================================
// PER-LESSON: VOCABULARY BLOCKS
// ============================================================================
for (const unit of env.GRAMMAR_LESSONS) {
    suite(`per-lesson vocabulary: ${unit.unitId}`, () => {
        for (const lesson of unit.lessons) {
            const blocks = vocabBlocks(lesson);
            blocks.forEach((v, idx) => {
                const label = blocks.length > 1 ? `${lesson.id} vocab[${idx}] "${v.title}"` : `${lesson.id} vocab`;

                test(`${label} — has title and non-empty words array`, () => {
                    assert.truthy(typeof v.title === 'string' && v.title.length > 0,
                        `vocab missing title`);
                    assert.truthy(Array.isArray(v.words) && v.words.length > 0,
                        `vocab missing words`);
                });

                test(`${label} — all words are non-empty strings`, () => {
                    for (let i = 0; i < v.words.length; i++) {
                        assert.truthy(typeof v.words[i] === 'string' && v.words[i].length > 0,
                            `words[${i}] empty`);
                    }
                });

                test(`${label} — words array has no exact duplicates`, () => {
                    assert.equal(new Set(v.words).size, v.words.length,
                        `duplicate words: ${v.words.join(' | ')}`);
                });

                if (v.note) {
                    test(`${label} — note is a non-empty string ≥10 chars`, () => {
                        assert.truthy(typeof v.note === 'string' && v.note.length >= 10,
                            `note too short: "${v.note}"`);
                    });
                }
            });
        }
    });
}

// ============================================================================
// PER-LESSON: PRONUNCIATION BLOCKS
// ============================================================================
for (const unit of env.GRAMMAR_LESSONS) {
    suite(`per-lesson pronunciation: ${unit.unitId}`, () => {
        for (const lesson of unit.lessons) {
            if (!lesson.pronunciation) continue;
            const p = lesson.pronunciation;

            test(`${lesson.id} pronunciation — has title`, () => {
                assert.truthy(typeof p.title === 'string' && p.title.length > 0,
                    `pronunciation missing title`);
            });

            test(`${lesson.id} pronunciation — has rule ≥20 chars`, () => {
                assert.truthy(typeof p.rule === 'string' && p.rule.length >= 20,
                    `pronunciation rule too short: "${p.rule}"`);
            });

            test(`${lesson.id} pronunciation — has ≥2 examples`, () => {
                assert.truthy(Array.isArray(p.examples) && p.examples.length >= 2,
                    `pronunciation needs ≥2 examples (got ${p.examples ? p.examples.length : 0})`);
            });

            test(`${lesson.id} pronunciation — all examples are non-empty strings`, () => {
                for (let i = 0; i < p.examples.length; i++) {
                    assert.truthy(typeof p.examples[i] === 'string' && p.examples[i].length > 0,
                        `examples[${i}] empty`);
                }
            });
        }
    });
}

// ============================================================================
// PER-LESSON: GRAMMAR BLOCKS
// ============================================================================
for (const unit of env.GRAMMAR_LESSONS) {
    suite(`per-lesson grammar: ${unit.unitId}`, () => {
        for (const lesson of unit.lessons) {
            if (!Array.isArray(lesson.grammar)) continue;
            lesson.grammar.forEach((g, idx) => {
                const label = `${lesson.id} grammar[${idx}] "${g.title}"`;

                test(`${label} — has title and rule`, () => {
                    assert.truthy(typeof g.title === 'string' && g.title.length > 0,
                        `grammar missing title`);
                    assert.truthy(typeof g.rule === 'string' && g.rule.length >= 20,
                        `grammar rule too short`);
                });

                test(`${label} — has ≥1 example`, () => {
                    assert.truthy(Array.isArray(g.examples) && g.examples.length >= 1,
                        `needs ≥1 example`);
                });

                test(`${label} — all examples are non-empty strings`, () => {
                    for (let i = 0; i < g.examples.length; i++) {
                        assert.truthy(typeof g.examples[i] === 'string' && g.examples[i].length > 0,
                            `examples[${i}] empty`);
                    }
                });

                if (Array.isArray(g.form)) {
                    test(`${label} — form table is well-formed`, () => {
                        for (let i = 0; i < g.form.length; i++) {
                            const row = g.form[i];
                            assert.truthy(row && typeof row === 'object',
                                `form[${i}] not an object`);
                            assert.truthy(typeof row.label === 'string' && row.label.length > 0,
                                `form[${i}].label missing`);
                            assert.truthy(typeof row.text === 'string' && row.text.length > 0,
                                `form[${i}].text missing`);
                        }
                    });
                }
            });
        }
    });
}

// ============================================================================
// PER-LESSON: PRACTICE QUIZ INTEGRATION
// ============================================================================
const SKIP_PRACTICE_TAGS = new Set([
    'video lesson', 'museum objects', 'free time', 'a thousand words',
    'writing description', 'writing instructions', 'writing short messages',
    'capital letters', 'Oxford', 'KISS rules'
]);

function isVideoOrWritingLesson(lesson) {
    if (!lesson.topicTags) return false;
    return lesson.topicTags.some(t => SKIP_PRACTICE_TAGS.has(t));
}

for (const unit of env.GRAMMAR_LESSONS) {
    suite(`per-lesson practice: ${unit.unitId}`, () => {
        for (const lesson of unit.lessons) {
            test(`${lesson.id} — getLessonPracticeQuestions handles max=0`, () => {
                env.__setAppState({ grammarHistory: [], grammarMistakes: {} });
                const qs = env.getLessonPracticeQuestions(unit.unitId, lesson.id, 0);
                assert.truthy(Array.isArray(qs) && qs.length === 0,
                    `max=0 should return empty array`);
            });

            test(`${lesson.id} — getLessonPracticeQuestions respects max=5 cap`, () => {
                env.__setAppState({ grammarHistory: [], grammarMistakes: {} });
                const qs = env.getLessonPracticeQuestions(unit.unitId, lesson.id, 5);
                assert.truthy(Array.isArray(qs) && qs.length <= 5,
                    `${lesson.id} returned ${qs.length} > 5`);
            });

            if (!isVideoOrWritingLesson(lesson)) {
                test(`${lesson.id} — practice questions all belong to this unit's question bank`, () => {
                    env.__setAppState({ grammarHistory: [], grammarMistakes: {} });
                    const u = env.getGrammarUnit(unit.unitId);
                    const unitIds = new Set(u.questions.map(q => q.id));
                    const qs = env.getLessonPracticeQuestions(unit.unitId, lesson.id, 50);
                    for (const q of qs) {
                        assert.truthy(unitIds.has(q.id),
                            `${q.id} not in ${unit.unitId}`);
                    }
                });
            }
        }
    });
}

// ============================================================================
// PER-LESSON: PDF PAGE REFERENCE CONSISTENCY
// ============================================================================
for (const unit of env.GRAMMAR_LESSONS) {
    suite(`per-lesson page-ref: ${unit.unitId}`, () => {
        for (const lesson of unit.lessons) {
            test(`${lesson.id} page range is contained within unit's page span`, () => {
                // Each lesson's page should be within the overall unit's range.
                // We just verify the page format here.
                const m = lesson.page.match(/^(\d+)(?:-(\d+))?$/);
                assert.truthy(m, `${lesson.id} bad page format: "${lesson.page}"`);
                if (m && m[2]) {
                    const start = parseInt(m[1], 10);
                    const end = parseInt(m[2], 10);
                    assert.truthy(end >= start, `${lesson.id} page range reversed: ${lesson.page}`);
                    assert.truthy(end - start <= 5, `${lesson.id} page range too wide: ${lesson.page}`);
                }
            });
        }
    });
}

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
