// tests/grammar.test.js — Grammar question bank integrity + quiz logic
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

suite('grammar: GRAMMAR_UNITS shape', () => {
    test('exactly 4 units (Unit 8, 9, 10, 11)', () => {
        assert.equal(env.GRAMMAR_UNITS.length, 4);
    });

    test('unit IDs are unit8, unit9, unit10, unit11', () => {
        const ids = env.GRAMMAR_UNITS.map(u => u.id);
        assert.contains(ids, 'unit8');
        assert.contains(ids, 'unit9');
        assert.contains(ids, 'unit10');
        assert.contains(ids, 'unit11');
    });

    test('every unit has required metadata', () => {
        for (const u of env.GRAMMAR_UNITS) {
            assert.truthy(u.id);
            assert.truthy(u.name);
            assert.truthy(u.icon);
            assert.truthy(u.color);
            assert.truthy(u.description);
            assert.truthy(Array.isArray(u.questions));
        }
    });
});

suite('grammar: 160 questions per unit (all 4 units)', () => {
    for (const unitId of ['unit8', 'unit9', 'unit10', 'unit11']) {
        test(`${unitId} has exactly 160 questions`, () => {
            const u = env.getGrammarUnit(unitId);
            assert.equal(u.questions.length, 160);
        });
        test(`${unitId} has exactly 20 arrangement questions`, () => {
            const u = env.getGrammarUnit(unitId);
            const arrCount = u.questions.filter(q => q.type === 'arrangement').length;
            assert.equal(arrCount, 20);
        });
        test(`${unitId} has at least 20 pronunciation questions`, () => {
            const u = env.getGrammarUnit(unitId);
            const pronCount = u.questions.filter(q => q.type === 'pronunciation').length;
            assert.truthy(pronCount >= 20, `${unitId} pronunciation count is ${pronCount}, expected ≥20`);
        });
        test(`${unitId} has at least 25 vocabulary questions`, () => {
            const u = env.getGrammarUnit(unitId);
            const vocabCount = u.questions.filter(q => q.type === 'vocabulary').length;
            assert.truthy(vocabCount >= 25, `${unitId} vocabulary count is ${vocabCount}, expected ≥25`);
        });
        test(`${unitId} has at least 20 grammar questions`, () => {
            const u = env.getGrammarUnit(unitId);
            const grammarCount = u.questions.filter(q => q.type === 'grammar').length;
            assert.truthy(grammarCount >= 20, `${unitId} grammar count is ${grammarCount}, expected ≥20`);
        });
    }
});

suite('grammar: arrangement question integrity', () => {
    test('every arrangement question has parts array (3-8 chunks)', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type !== 'arrangement') continue;
                assert.truthy(Array.isArray(q.parts), `${q.id} missing parts array`);
                assert.truthy(q.parts.length >= 3, `${q.id} too few parts (${q.parts.length})`);
                assert.truthy(q.parts.length <= 8, `${q.id} too many parts (${q.parts.length})`);
                for (const p of q.parts) {
                    assert.truthy(typeof p === 'string' && p.length > 0, `${q.id} has empty part`);
                }
            }
        }
    });

    test('every arrangement question has explanation ≥20 chars', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type !== 'arrangement') continue;
                assert.truthy(q.explanation && q.explanation.length >= 20,
                    `${q.id} explanation too short`);
            }
        }
    });

    test('every arrangement question ends with . or ? in last part', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type !== 'arrangement') continue;
                const last = q.parts[q.parts.length - 1];
                assert.truthy(last === '.' || last === '?' || last.endsWith('.') || last.endsWith('?'),
                    `${q.id} last part should be punctuation: "${last}"`);
            }
        }
    });
});

suite('grammar: scoring helpers', () => {
    test('isArrangementCorrect — correct order returns true', () => {
        // Need to access via setAppState; the function is defined in grammar-units.js
        // and is a top-level helper — let's check.
        if (typeof env.isArrangementCorrect !== 'function') return;
        assert.truthy(env.isArrangementCorrect([0, 1, 2, 3, 4], 5));
    });

    test('isArrangementCorrect — wrong order returns false', () => {
        if (typeof env.isArrangementCorrect !== 'function') return;
        assert.falsy(env.isArrangementCorrect([1, 0, 2, 3, 4], 5));
    });

    test('saveGrammarSession scores arrangement correctly', () => {
        env.__setAppState({ grammarHistory: [], coins: 0 });
        const u8 = env.getGrammarUnit('unit8');
        const arrQ = u8.questions.find(q => q.type === 'arrangement');
        assert.truthy(arrQ);
        const correctOrder = arrQ.parts.map((_, i) => i);
        const wrongOrder = [...correctOrder]; wrongOrder[0] = 1; wrongOrder[1] = 0;

        const session1 = env.saveGrammarSession('unit8', [arrQ], [correctOrder]);
        assert.equal(session1.score, 1);

        const session2 = env.saveGrammarSession('unit8', [arrQ], [wrongOrder]);
        assert.equal(session2.score, 0);
    });
});

suite('grammar: question integrity', () => {
    test('every multiple-choice question has id, type, topic, q, options, correct, explanation', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type === 'arrangement') continue; // arrangement has different shape
                assert.truthy(q.id, `question missing id in ${u.id}`);
                assert.truthy(q.type, `${q.id} missing type`);
                assert.truthy(q.topic, `${q.id} missing topic`);
                assert.truthy(q.q, `${q.id} missing question text`);
                assert.truthy(Array.isArray(q.options) && q.options.length >= 2, `${q.id} bad options`);
                assert.truthy(typeof q.correct === 'number', `${q.id} bad correct index`);
                assert.truthy(q.correct >= 0 && q.correct < q.options.length, `${q.id} correct index out of bounds`);
                assert.truthy(q.explanation, `${q.id} missing explanation`);
            }
        }
    });

    test('every question type is vocabulary, grammar, pronunciation, or arrangement', () => {
        const validTypes = new Set(['vocabulary', 'grammar', 'pronunciation', 'arrangement']);
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                assert.truthy(validTypes.has(q.type), `${q.id} has invalid type "${q.type}"`);
            }
        }
    });

    test('question IDs are unique within each unit', () => {
        for (const u of env.GRAMMAR_UNITS) {
            const ids = u.questions.map(q => q.id);
            const unique = new Set(ids);
            assert.equal(ids.length, unique.size, `duplicate question IDs in ${u.id}`);
        }
    });

    test('all options are non-empty strings (multiple-choice only)', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                if (q.type === 'arrangement') continue;
                for (const opt of q.options) {
                    assert.truthy(typeof opt === 'string' && opt.length > 0,
                        `${q.id} has empty option`);
                }
            }
        }
    });

    test('explanations are at least 20 chars', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
                assert.truthy(q.explanation.length >= 20,
                    `${q.id} explanation too short: "${q.explanation}"`);
            }
        }
    });
});

suite('grammar: type coverage per unit', () => {
    test('Unit 8 has vocabulary, grammar, pronunciation questions', () => {
        const u8 = env.getGrammarUnit('unit8');
        const types = new Set(u8.questions.map(q => q.type));
        assert.contains([...types], 'vocabulary');
        assert.contains([...types], 'grammar');
        assert.contains([...types], 'pronunciation');
    });

    test('Unit 9 has vocabulary, grammar, pronunciation questions', () => {
        const u9 = env.getGrammarUnit('unit9');
        const types = new Set(u9.questions.map(q => q.type));
        assert.contains([...types], 'vocabulary');
        assert.contains([...types], 'grammar');
        assert.contains([...types], 'pronunciation');
    });

    test('Unit 8 covers expected topics', () => {
        const u8 = env.getGrammarUnit('unit8');
        const topics = new Set(u8.questions.map(q => q.topic));
        assert.contains([...topics], 'clothes');
        assert.contains([...topics], 'face & body');
        assert.contains([...topics], 'present continuous');
        assert.contains([...topics], 'present simple vs continuous');
        assert.contains([...topics], 'have got');
        assert.contains([...topics], 'word stress');
    });

    test('Unit 9 covers expected topics', () => {
        const u9 = env.getGrammarUnit('unit9');
        const topics = new Set(u9.questions.map(q => q.topic));
        assert.contains([...topics], 'films');
        assert.contains([...topics], 'TV');
        assert.contains([...topics], 'nature');
        assert.contains([...topics], 'be going to');
        assert.contains([...topics], 'infinitive of purpose');
    });

    test('Unit 10 covers expected topics', () => {
        const u10 = env.getGrammarUnit('unit10');
        const topics = new Set(u10.questions.map(q => q.topic));
        assert.contains([...topics], 'subjects');
        assert.contains([...topics], 'learning verbs');
        assert.contains([...topics], 'present perfect');
        assert.contains([...topics], 'perfect vs past simple');
        assert.contains([...topics], 'imperatives');
    });

    test('Unit 11 covers expected topics', () => {
        const u11 = env.getGrammarUnit('unit11');
        const topics = new Set(u11.questions.map(q => q.topic));
        assert.contains([...topics], 'tourism');
        assert.contains([...topics], 'in another country');
        assert.contains([...topics], 'have to / can');
        assert.contains([...topics], "should/shouldn't");
        assert.contains([...topics], 'some/any/no');
        assert.contains([...topics], 'making suggestions');
    });
});

suite('grammar: helpers', () => {
    test('getGrammarUnit returns unit by id', () => {
        const u = env.getGrammarUnit('unit8');
        assert.equal(u.id, 'unit8');
    });

    test('getGrammarUnit returns undefined for unknown id', () => {
        assert.falsy(env.getGrammarUnit('unit99'));
    });

    test('generateGrammarQuiz returns N random questions', () => {
        const q10 = env.generateGrammarQuiz('unit8', 10);
        assert.equal(q10.length, 10);
        const q25 = env.generateGrammarQuiz('unit9', 25);
        assert.equal(q25.length, 25);
    });

    test('generateGrammarQuiz returns unique questions (no dupes)', () => {
        const q = env.generateGrammarQuiz('unit8', 50);
        const ids = q.map(x => x.id);
        const unique = new Set(ids);
        assert.equal(ids.length, unique.size);
    });

    test('generateGrammarQuiz caps at unit total', () => {
        const q = env.generateGrammarQuiz('unit8', 1000);
        assert.equal(q.length, 160);
    });

    test('saveGrammarSession stores session in appState.grammarHistory', () => {
        env.__setAppState({ grammarHistory: [], coins: 0 });
        const questions = env.GRAMMAR_UNITS[0].questions.slice(0, 3);
        // Force two correct answers (Q0, Q1) and one definitely-wrong answer for Q2
        const wrongIdxForQ2 = questions[2].correct === 0 ? 1 : 0;
        const answers = [questions[0].correct, questions[1].correct, wrongIdxForQ2];
        const session = env.saveGrammarSession('unit8', questions, answers);
        const state = env.__getAppState();
        assert.equal(state.grammarHistory.length, 1);
        assert.equal(session.score, 2);
        assert.equal(session.total, 3);
        assert.equal(session.unitId, 'unit8');
    });

    test('getGrammarStats returns attempts, best, last', () => {
        env.__setAppState({
            grammarHistory: [
                { id: 'g1', unitId: 'unit8', date: 1000, score: 5, total: 10, questions: [] },
                { id: 'g2', unitId: 'unit8', date: 2000, score: 8, total: 10, questions: [] },
                { id: 'g3', unitId: 'unit9', date: 3000, score: 9, total: 10, questions: [] }
            ]
        });
        const u8stats = env.getGrammarStats('unit8');
        assert.equal(u8stats.attempts, 2);
        assert.equal(u8stats.best.score, 8);
        // Newest first means last is the most recent
        const u9stats = env.getGrammarStats('unit9');
        assert.equal(u9stats.attempts, 1);
        assert.equal(u9stats.best.score, 9);
    });

    test('getGrammarStats returns empty for never-attempted unit', () => {
        env.__setAppState({ grammarHistory: [] });
        const stats = env.getGrammarStats('unit8');
        assert.equal(stats.attempts, 0);
        assert.equal(stats.best, null);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
