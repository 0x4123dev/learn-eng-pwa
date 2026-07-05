// exam.test.js — structural integrity of the Exam-tab question bank
// (js/exam-data.js). The main harness (setup.js) doesn't load exam-data.js,
// so we evaluate it directly in an isolated vm context.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadExams() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam-data.js'), 'utf8');
    return vm.runInNewContext(code + '\n;({ EXAMS: EXAMS, getExam: getExam });', {});
}
const { EXAMS, getExam } = loadExams();

const norm = s => String(s).toLowerCase().replace(/^→\s*/, '')
    .replace(/[.,!?;:"'’`]/g, '').replace(/\s+/g, ' ').trim();

suite('exam: bank structure', () => {
    test('at least the practice sets and both past papers exist', () => {
        assert.truthy(EXAMS.length >= 4, `expected ≥4 exams, got ${EXAMS.length}`);
        const ids = EXAMS.map(e => e.id);
        ['exam1', 'exam2', 'exam2024', 'exam2025'].forEach(id =>
            assert.truthy(ids.includes(id), `missing ${id}`));
    });

    for (const ex of EXAMS) {
        test(`${ex.id} has 40 questions and a sensible timer`, () => {
            assert.equal(ex.questions.length, 40);
            assert.truthy(ex.durationMin >= 20 && ex.durationMin <= 120,
                `${ex.id} durationMin ${ex.durationMin} out of range`);
            assert.truthy(ex.title && ex.title.length > 0, `${ex.id} needs a title`);
        });

        test(`${ex.id} question numbers are 1..40 and unique`, () => {
            const ns = ex.questions.map(q => q.n).sort((a, b) => a - b);
            assert.equal(new Set(ns).size, 40);
            assert.equal(ns[0], 1);
            assert.equal(ns[39], 40);
        });

        test(`${ex.id} every question has a valid type, answer key and explanation`, () => {
            for (const q of ex.questions) {
                assert.truthy(['mcq', 'tf', 'text'].includes(q.type), `${ex.id} Q${q.n} bad type ${q.type}`);
                assert.truthy(q.explanation && q.explanation.length >= 40, `${ex.id} Q${q.n} explanation too short`);
                if (q.type === 'mcq') {
                    assert.truthy(Array.isArray(q.options) && q.options.length === 4, `${ex.id} Q${q.n} needs 4 options`);
                    assert.truthy(q.correct >= 0 && q.correct < 4, `${ex.id} Q${q.n} bad correct index`);
                } else if (q.type === 'tf') {
                    assert.equal(q.options.length, 2);
                    assert.truthy(q.correct === 0 || q.correct === 1, `${ex.id} Q${q.n} bad tf correct`);
                } else {
                    assert.truthy(q.answer && q.answer.length > 0, `${ex.id} Q${q.n} missing answer`);
                    assert.truthy(Array.isArray(q.accept) && q.accept.length >= 1, `${ex.id} Q${q.n} missing accept[]`);
                    assert.truthy(q.accept.map(norm).includes(norm(q.answer)),
                        `${ex.id} Q${q.n} answer "${q.answer}" not covered by accept[]`);
                }
            }
        });

        test(`${ex.id} cloze/reading questions carry a passage`, () => {
            for (const q of ex.questions) {
                if (q.section === 'Cloze' || q.section === 'Reading') {
                    assert.truthy(q.passage && q.passage.length > 50, `${ex.id} Q${q.n} missing passage`);
                }
            }
        });

        test(`${ex.id} word-bank questions carry a bank`, () => {
            for (const q of ex.questions) {
                if (q.section === 'Word bank') {
                    assert.truthy(Array.isArray(q.bank) && q.bank.length >= 2, `${ex.id} Q${q.n} missing bank`);
                }
            }
        });
    }

    test('getExam resolves ids and returns null otherwise', () => {
        assert.equal(getExam('exam1').id, 'exam1');
        assert.equal(getExam('exam2').id, 'exam2');
        assert.equal(getExam('nope'), null);
    });
});
