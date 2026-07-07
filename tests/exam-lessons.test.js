// exam-lessons.test.js — the Vietnamese grammar lessons for the Exam→Lessons
// sub-tab must exist, be non-trivial, and cover every question of Exam 1.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function load(file, name) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', file), 'utf8');
    return vm.runInNewContext(code + '\n;' + name + ';', {}, { filename: file });
}
const LESSONS = load('exam-lessons.js', 'EXAM1_LESSONS');
const EXAMS = load('exam-data.js', 'EXAMS');
const exam1 = EXAMS.find(e => e.id === 'exam1');

suite('exam lessons', () => {
    test('there is a non-empty lesson set', () => {
        assert.truthy(Array.isArray(LESSONS) && LESSONS.length >= 15,
            `expected ≥15 lessons, got ${LESSONS && LESSONS.length}`);
    });

    test('every lesson has id, icon, title, qRefs and substantial content', () => {
        const seen = new Set();
        for (const l of LESSONS) {
            assert.truthy(l.id && !seen.has(l.id), `duplicate/empty lesson id ${l.id}`);
            seen.add(l.id);
            assert.truthy(l.icon && l.title && l.title.length > 3, `${l.id} missing icon/title`);
            assert.truthy(Array.isArray(l.qRefs) && l.qRefs.length >= 1, `${l.id} missing qRefs`);
            assert.truthy(typeof l.content === 'string' && l.content.length >= 500,
                `${l.id} content too short (${l.content && l.content.length})`);
            assert.truthy(/<h4>/.test(l.content), `${l.id} content missing section headings`);
        }
    });

    test('lessons cover every question (1..40) of Exam 1', () => {
        const covered = new Set();
        LESSONS.forEach(l => l.qRefs.forEach(n => covered.add(n)));
        const total = exam1.questions.length;
        const missing = [];
        for (let n = 1; n <= total; n++) if (!covered.has(n)) missing.push(n);
        assert.equal(missing.length, 0, `uncovered Exam 1 questions: ${missing.join(',')}`);
    });

    test('qRefs point to real Exam 1 question numbers', () => {
        const valid = new Set(exam1.questions.map(q => q.n));
        for (const l of LESSONS) {
            for (const n of l.qRefs) {
                assert.truthy(valid.has(n), `${l.id} references non-existent Q${n}`);
            }
        }
    });
});
