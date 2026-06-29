// tests/phrases.test.js — Phrases tab (prepositional-phrase MCQ bank), v3.60.
// Locks in the 500-question bank shape, weighted distribution, and data integrity.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode({ includePhrases: true });
const BANK = env.PREPOSITION_QUESTIONS;
const CATS = ['verb', 'adj', 'noun', 'phrase'];

suite('phrases: bank structure', () => {
    test('PREPOSITION_QUESTIONS exists with exactly 500 questions', () => {
        assert.truthy(Array.isArray(BANK), 'PREPOSITION_QUESTIONS should be an array');
        assert.equal(BANK.length, 500);
    });

    test('weighted distribution across the 4 categories (verb-heavy)', () => {
        const c = { verb: 0, adj: 0, noun: 0, phrase: 0 };
        BANK.forEach(q => { c[q.cat] = (c[q.cat] || 0) + 1; });
        assert.equal(c.verb + c.adj + c.noun + c.phrase, 500);
        assert.inRange(c.verb, 170, 180, 'verb count');
        assert.inRange(c.adj, 120, 130, 'adj count');
        assert.inRange(c.noun, 95, 105, 'noun count');
        assert.inRange(c.phrase, 95, 105, 'phrase count');
        // weighting: verb is the largest, phrase/noun the smallest
        assert.truthy(c.verb >= c.adj, 'verb >= adj');
        assert.truthy(c.adj >= c.noun, 'adj >= noun');
    });

    test('ids are unique and sequential pp-1..pp-500', () => {
        const ids = new Set();
        BANK.forEach((q, i) => {
            assert.equal(q.id, 'pp-' + (i + 1), `id at index ${i}`);
            assert.falsy(ids.has(q.id), `duplicate id ${q.id}`);
            ids.add(q.id);
        });
    });
});

suite('phrases: per-question integrity', () => {
    test('every question has a valid category', () => {
        BANK.forEach(q => assert.contains(CATS, q.cat, `bad cat in ${q.id}`));
    });

    test('every question has exactly one blank', () => {
        BANK.forEach(q => {
            const blanks = (String(q.q).match(/___/g) || []).length;
            assert.equal(blanks, 1, `${q.id} has ${blanks} blanks`);
        });
    });

    test('every question has 4 distinct preposition options', () => {
        BANK.forEach(q => {
            assert.truthy(Array.isArray(q.options) && q.options.length === 4, `${q.id} options`);
            const low = new Set(q.options.map(o => String(o).toLowerCase()));
            assert.equal(low.size, 4, `${q.id} has duplicate options [${q.options}]`);
            q.options.forEach(o => assert.truthy(/^[A-Za-z]+$/.test(o), `${q.id} non-word option "${o}"`));
        });
    });

    test('correct is a valid index into options', () => {
        BANK.forEach(q => {
            assert.truthy(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 3, `${q.id} correct=${q.correct}`);
            assert.truthy(typeof q.options[q.correct] === 'string', `${q.id} correct points to missing option`);
        });
    });

    test('every question has a Vietnamese meaning and a meaningful explanation', () => {
        BANK.forEach(q => {
            assert.truthy(typeof q.vi === 'string' && q.vi.length >= 5, `${q.id} missing vi`);
            assert.truthy(typeof q.explanation === 'string' && q.explanation.length >= 30, `${q.id} weak explanation`);
        });
    });

    test('no duplicate question stems', () => {
        const seen = new Set();
        BANK.forEach(q => {
            const k = String(q.q).toLowerCase().replace(/\s+/g, ' ').trim();
            assert.falsy(seen.has(k), `duplicate stem: ${q.id}`);
            seen.add(k);
        });
    });

    test('answer positions are spread (no positional bias)', () => {
        const pos = { 0: 0, 1: 0, 2: 0, 3: 0 };
        BANK.forEach(q => pos[q.correct]++);
        // each of the 4 positions should hold a healthy share of the 500 answers
        CATS.forEach((_, i) => assert.truthy(pos[i] >= 50, `position ${i} only used ${pos[i]} times`));
    });
});

suite('phrases: UI wiring', () => {
    test('quiz functions are exposed', () => {
        ['renderPhrasesHome', 'startPhrasesQuiz', 'answerPhrQuestion', 'nextPhrQuestion',
         'finishPhrasesQuiz', 'isPhrasesQuizActive', 'abandonPhrasesQuiz'].forEach(fn => {
            assert.truthy(typeof env[fn] === 'function', `${fn} should be a function`);
        });
    });
});
