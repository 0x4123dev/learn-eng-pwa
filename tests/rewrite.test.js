// rewrite.test.js — the Rewrite typed-transformation bank (js/rewrite-data.js)
// must be well-formed and gradeable by js/rewrite.js.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { REWRITE_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'rewrite-data.js'));
global.REWRITE_QUESTIONS = REWRITE_QUESTIONS;
const rw = require(path.join(__dirname, '..', 'js', 'rewrite.js'));

suite('rewrite bank', () => {
    test('has 200 questions with unique sequential ids', () => {
        assert.equal(REWRITE_QUESTIONS.length, 200);
        REWRITE_QUESTIONS.forEach((q, i) => assert.equal(q.id, 'rw-' + (i + 1)));
    });

    test('25 structure types × 8 questions each', () => {
        const cats = {};
        REWRITE_QUESTIONS.forEach(q => cats[q.cat] = (cats[q.cat] || 0) + 1);
        assert.equal(Object.keys(cats).length, 25);
        Object.entries(cats).forEach(([cat, n]) => assert.equal(n, 8, `${cat} has ${n}`));
    });

    test('every question has orig, stem, answer, vi and a real explanation', () => {
        for (const q of REWRITE_QUESTIONS) {
            assert.truthy(q.orig && q.orig.length >= 15, `${q.id}: weak orig`);
            assert.truthy(q.stem && q.stem.length >= 2, `${q.id}: weak stem`);
            assert.truthy(q.answer && q.answer.length >= 2, `${q.id}: weak answer`);
            assert.truthy(q.vi && q.vi.length > 0, `${q.id}: missing vi`);
            assert.truthy(q.explanation && q.explanation.length >= 40, `${q.id}: weak explanation`);
            assert.falsy(/___/.test(q.stem) || /___/.test(q.answer), `${q.id}: stray blank marker`);
        }
    });

    test('grading: exact answer, case/space variants pass; junk fails (all 200)', () => {
        for (const q of REWRITE_QUESTIONS) {
            assert.equal(rw._rwTextCorrect(q.answer, q), true, `${q.id}: exact answer must pass`);
            assert.equal(rw._rwTextCorrect('  ' + q.answer.toUpperCase() + ' . ', q), true, `${q.id}: case/space variant must pass`);
            assert.equal(rw._rwTextCorrect('zz totally wrong zz', q), false, `${q.id}: junk must fail`);
            assert.equal(rw._rwTextCorrect('', q), false, `${q.id}: blank must fail`);
        }
    });

    test('every accept variant is itself graded correct (self-consistency)', () => {
        for (const q of REWRITE_QUESTIONS) {
            for (const a of q.accept) {
                assert.equal(rw._rwTextCorrect(a, q), true, `${q.id}: accept "${a}" must grade correct`);
            }
        }
    });

    test('contraction-insensitive normalizer', () => {
        assert.equal(rw._rwNormalize("she does not have"), rw._rwNormalize("she doesn't have"));
        assert.equal(rw._rwNormalize("he will not go"), rw._rwNormalize("he won't go"));
        assert.equal(rw._rwNormalize("They cannot swim!"), rw._rwNormalize("they can't swim"));
    });

    test('helpers: bank + byId resolve', () => {
        assert.equal(rw.rewriteBank().length, 200);
        assert.truthy(rw.rewriteById('rw-1'));
        assert.equal(rw.rewriteById('nope'), null);
    });
});
