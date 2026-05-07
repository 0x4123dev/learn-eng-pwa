// tests/grammar.test.js — Grammar question bank integrity + quiz logic
const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

suite('grammar: GRAMMAR_UNITS shape', () => {
    test('exactly 2 units (Unit 8 + Unit 9)', () => {
        assert.equal(env.GRAMMAR_UNITS.length, 2);
    });

    test('unit IDs are unit8 and unit9', () => {
        const ids = env.GRAMMAR_UNITS.map(u => u.id);
        assert.contains(ids, 'unit8');
        assert.contains(ids, 'unit9');
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

suite('grammar: 120 questions per unit', () => {
    test('Unit 8 has exactly 120 questions', () => {
        const u8 = env.getGrammarUnit('unit8');
        assert.equal(u8.questions.length, 120);
    });

    test('Unit 9 has exactly 120 questions', () => {
        const u9 = env.getGrammarUnit('unit9');
        assert.equal(u9.questions.length, 120);
    });

    test('Unit 8 has at least 30 pronunciation questions (10 original + 20 new)', () => {
        const u8 = env.getGrammarUnit('unit8');
        const pronCount = u8.questions.filter(q => q.type === 'pronunciation').length;
        assert.truthy(pronCount >= 30, `pronunciation count is ${pronCount}, expected ≥30`);
    });

    test('Unit 9 has at least 32 pronunciation questions (12 original + 20 new)', () => {
        const u9 = env.getGrammarUnit('unit9');
        const pronCount = u9.questions.filter(q => q.type === 'pronunciation').length;
        assert.truthy(pronCount >= 32, `pronunciation count is ${pronCount}, expected ≥32`);
    });
});

suite('grammar: question integrity', () => {
    test('every question has id, type, topic, q, options, correct, explanation', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
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

    test('every question type is vocabulary, grammar, or pronunciation', () => {
        const validTypes = new Set(['vocabulary', 'grammar', 'pronunciation']);
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

    test('all options are non-empty strings', () => {
        for (const u of env.GRAMMAR_UNITS) {
            for (const q of u.questions) {
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
        assert.equal(q.length, 120);
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
