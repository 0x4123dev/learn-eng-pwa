// tests/phrases.test.js — Phrases tab (prepositional-phrase MCQ bank), v3.63.
// Locks in the 913-question bank shape (5 categories incl. place), and data integrity.

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode({ includePhrases: true });
const BANK = env.PREPOSITION_QUESTIONS;
const CATS = ['verb', 'adj', 'noun', 'phrase', 'place'];
const TOTAL = 913;

suite('phrases: bank structure', () => {
    test('PREPOSITION_QUESTIONS exists with exactly 913 questions', () => {
        assert.truthy(Array.isArray(BANK), 'PREPOSITION_QUESTIONS should be an array');
        assert.equal(BANK.length, TOTAL);
    });

    test('distribution across the 5 categories (verb-heavy, place present)', () => {
        const c = { verb: 0, adj: 0, noun: 0, phrase: 0, place: 0 };
        BANK.forEach(q => { c[q.cat] = (c[q.cat] || 0) + 1; });
        assert.equal(c.verb + c.adj + c.noun + c.phrase + c.place, TOTAL);
        CATS.forEach(cat => assert.truthy(c[cat] > 0, `category ${cat} should have questions`));
        // weighting: verb is the largest category
        assert.truthy(c.verb >= c.adj, 'verb >= adj');
        assert.truthy(c.verb >= c.place, 'verb >= place');
    });

    test('ids are unique and sequential pp-1..pp-913', () => {
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
        // each of the 4 answer positions should hold a healthy share of the answers
        [0, 1, 2, 3].forEach(i => assert.truthy(pos[i] >= 50, `position ${i} only used ${pos[i]} times`));
    });
});

suite('phrases: UI wiring', () => {
    test('quiz functions are exposed', () => {
        ['renderPhrasesHome', 'startPhrasesQuiz', 'answerPhrQuestion', 'nextPhrQuestion',
         'finishPhrasesQuiz', 'isPhrasesQuizActive', 'abandonPhrasesQuiz',
         'switchPhrSubTab', 'phrasesLessonEntries', 'filterPhrLessons'].forEach(fn => {
            assert.truthy(typeof env[fn] === 'function', `${fn} should be a function`);
        });
    });
});

suite('phrases: lessons list', () => {
    const entries = env.phrasesLessonEntries();

    test('one lesson entry per distinct collocation (913)', () => {
        assert.equal(entries.length, 913);
    });

    test('every lesson has a phrase, Vietnamese meaning, and a complete example', () => {
        entries.forEach(e => {
            assert.truthy(typeof e.phrase === 'string' && e.phrase.length > 0, 'phrase');
            assert.truthy(typeof e.vi === 'string' && e.vi.length >= 5, `vi for ${e.phrase}`);
            assert.truthy(typeof e.example === 'string' && e.example.length > 0, `example for ${e.phrase}`);
            // the example is a finished sentence — the blank has been filled in
            assert.truthy(e.example.indexOf('___') === -1, `example for ${e.phrase} still has a blank`);
            assert.contains(CATS, e.cat, `cat for ${e.phrase}`);
        });
    });

    test('no duplicate collocation within a category', () => {
        const seen = new Set();
        entries.forEach(e => {
            const k = e.cat + '|' + e.phrase.toLowerCase();
            assert.falsy(seen.has(k), `duplicate ${k}`);
            seen.add(k);
        });
    });
});
