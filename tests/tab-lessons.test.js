// tab-lessons.test.js — the Lessons sub-tab data for the Word form and Rewrite
// tabs must be complete, well-formed HTML, and keyed to real content.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { WORDFORM_LESSONS } = require(path.join(__dirname, '..', 'js', 'wordform-lessons.js'));
const { REWRITE_LESSONS } = require(path.join(__dirname, '..', 'js', 'rewrite-lessons.js'));
const { REWRITE_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'rewrite-data.js'));

const ALLOWED_TAGS = new Set(['p', 'h4', 'ul', 'li', 'table', 'tr', 'td', 'th', 'b', 'br', 'i']);

function checkLessonSet(name, lessons, expectedCount) {
    test(`${name}: ${expectedCount} lessons with unique keys`, () => {
        assert.equal(lessons.length, expectedCount);
        assert.equal(new Set(lessons.map(l => l.key)).size, expectedCount);
    });
    for (const l of lessons) {
        test(`${name}/${l.key}: title, icon and substantial structured content`, () => {
            assert.truthy(l.title && l.title.length >= 5, 'weak title');
            assert.truthy(l.icon && l.icon.length > 0, 'missing icon');
            assert.truthy(l.content && l.content.length >= 400, 'content too short');
            assert.truthy((l.content.match(/<h4>/g) || []).length >= 3, 'needs ≥3 <h4> sections');
            assert.falsy(/<script|onerror=|onclick=/i.test(l.content), 'unsafe markup');
            // Only allowed tags
            const tags = [...l.content.matchAll(/<\/?([a-zA-Z0-9]+)[^>]*>/g)].map(m => m[1].toLowerCase());
            const bad = tags.filter(t => !ALLOWED_TAGS.has(t));
            assert.deepEqual([...new Set(bad)], [], `disallowed tags: ${[...new Set(bad)].join(',')}`);
        });
    }
}

suite('tab lessons: word form', () => {
    checkLessonSet('wordform', WORDFORM_LESSONS, 12);
});

suite('tab lessons: rewrite', () => {
    checkLessonSet('rewrite', REWRITE_LESSONS, 25);
    test('every rewrite lesson key matches a question cat with 8 questions', () => {
        for (const l of REWRITE_LESSONS) {
            const n = REWRITE_QUESTIONS.filter(q => q.cat === l.key).length;
            assert.equal(n, 8, `${l.key}: ${n} questions`);
        }
    });
    test('every question cat has a lesson', () => {
        const keys = new Set(REWRITE_LESSONS.map(l => l.key));
        const cats = [...new Set(REWRITE_QUESTIONS.map(q => q.cat))];
        const missing = cats.filter(c => !keys.has(c));
        assert.deepEqual(missing, [], `cats without a lesson: ${missing.join(',')}`);
    });
});

suite('tab lessons: polished rewrite explanations', () => {
    test('all 200 explanations follow the 3-part standard (công thức + áp dụng + đáp án)', () => {
        for (const q of REWRITE_QUESTIONS) {
            assert.truthy(q.explanation.length >= 100, `${q.id}: too short (${q.explanation.length})`);
            assert.truthy(/Đáp án/.test(q.explanation), `${q.id}: missing "Đáp án" model-answer part`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
