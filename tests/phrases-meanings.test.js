// phrases-meanings.test.js — every Phrases question must have a paired
// Vietnamese meaning question (PHRASE_MEANINGS), and the pair-expansion
// helpers must produce well-formed follow-up questions.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { PREPOSITION_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'phrases-data.js'));
const { PHRASE_MEANINGS } = require(path.join(__dirname, '..', 'js', 'phrases-meanings.js'));

// phrases.js reads these as globals in the browser; provide them for require().
global.PHRASE_MEANINGS = PHRASE_MEANINGS;
global.PREPOSITION_QUESTIONS = PREPOSITION_QUESTIONS;
const phrases = require(path.join(__dirname, '..', 'js', 'phrases.js'));

const norm = s => String(s).toLowerCase().normalize('NFC').replace(/\s+/g, ' ').trim();

suite('phrases: meaning questions', () => {
    test('every bank question has a meaning entry (913/913)', () => {
        const missing = PREPOSITION_QUESTIONS.filter(q => !PHRASE_MEANINGS[q.id]);
        assert.equal(missing.length, 0,
            `missing meaning entries: ${missing.slice(0, 10).map(q => q.id).join(',')}`);
    });

    test('every meaning entry has 4 distinct options and a valid correct index', () => {
        for (const q of PREPOSITION_QUESTIONS) {
            const m = PHRASE_MEANINGS[q.id];
            assert.truthy(Array.isArray(m.options) && m.options.length === 4, `${q.id}: needs 4 options`);
            assert.truthy(m.correct >= 0 && m.correct < 4, `${q.id}: bad correct index`);
            const set = new Set(m.options.map(norm));
            assert.equal(set.size, 4, `${q.id}: duplicate options`);
            m.options.forEach(o => assert.truthy(o && o.length <= 60, `${q.id}: bad option length`));
        }
    });

    test('no distractor equals the real vi meaning', () => {
        for (const q of PREPOSITION_QUESTIONS) {
            const m = PHRASE_MEANINGS[q.id];
            const viShort = norm(q.vi.split(' — ')[0]);
            m.options.forEach((o, i) => {
                if (i !== m.correct) {
                    assert.truthy(norm(o) !== viShort, `${q.id}: distractor equals real meaning`);
                }
            });
        }
    });

    test('phrMeaningQuestion builds a well-formed follow-up question', () => {
        const base = PREPOSITION_QUESTIONS[0];
        const mq = phrases.phrMeaningQuestion(base);
        assert.equal(mq.id, 'pm-' + base.id);
        assert.truthy(mq.meaning === true);
        assert.truthy(mq.q.includes(base.phrase), 'question text should quote the phrase');
        assert.equal(mq.options.length, 4);
        assert.truthy(mq.explanation.includes(mq.options[mq.correct]));
    });

    test('phrExpandPairs doubles the quiz (base + meaning interleaved)', () => {
        const picked = PREPOSITION_QUESTIONS.slice(0, 5);
        const steps = phrases.phrExpandPairs(picked);
        assert.equal(steps.length, 10);
        for (let i = 0; i < 5; i++) {
            assert.equal(steps[2 * i].id, picked[i].id);
            assert.equal(steps[2 * i + 1].id, 'pm-' + picked[i].id);
        }
    });

    test('phrasesById resolves meaning ids for review re-practice', () => {
        const mq = phrases.phrasesById('pm-pp-1');
        assert.truthy(mq && mq.meaning === true && mq.id === 'pm-pp-1');
        assert.truthy(phrases.phrasesById('pp-1') && !phrases.phrasesById('pp-1').meaning);
    });
});
