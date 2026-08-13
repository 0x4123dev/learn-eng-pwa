// collocation.test.js — the 🧩 Collocation bank (PTNK style) and its grading.
const { suite, test, assert } = require('./harness');
// The quiz tabs render their Next button through the answer gate, exactly as
// the browser does — index.html always loads it before them.
Object.assign(global, require('../js/answer-audio.js'));
const path = require('path');

const { COLLOCATION_QUESTIONS } = require(path.join(__dirname, '..', 'js', 'collocation-data.js'));
global.COLLOCATION_QUESTIONS = COLLOCATION_QUESTIONS;
const col = require(path.join(__dirname, '..', 'js', 'collocation.js'));

const byType = {};
COLLOCATION_QUESTIONS.forEach(q => { (byType[q.type] = byType[q.type] || []).push(q); });

suite('collocation: bank integrity', () => {
    test('bank holds the five PTNK formats with pinned counts', () => {
        const counts = Object.fromEntries(Object.entries(byType).map(([k, v]) => [k, v.length]));
        assert.deepEqual(counts, COLLOC_EXPECTED_COUNTS);
        assert.equal(COLLOCATION_QUESTIONS.length,
            Object.values(COLLOC_EXPECTED_COUNTS).reduce((a, b) => a + b, 0));
    });

    test('ids are unique and sequential col-NNN', () => {
        const ids = COLLOCATION_QUESTIONS.map(q => q.id);
        assert.equal(new Set(ids).size, ids.length);
        assert.truthy(ids.every(id => /^col-\d{3}$/.test(id)));
    });

    test('every question has q, answer, vi and a 🔑 explanation', () => {
        for (const q of COLLOCATION_QUESTIONS) {
            assert.truthy(q.q && q.q.trim(), q.id);
            assert.truthy(q.answer && String(q.answer).trim(), q.id + ' answer');
            assert.truthy(q.vi && q.vi.trim(), q.id + ' vi');
            assert.truthy(q.explanation.includes('🔑'), q.id + ' explanation missing 🔑');
        }
    });

    test('mcq/pair: 4 unique options, valid correct index, answer at that index, 3 ✗ marks', () => {
        for (const q of [...(byType.pair || []), ...(byType.mcq || [])]) {
            assert.equal(q.options.length, 4, q.id);
            assert.equal(new Set(q.options.map(o => o.toLowerCase())).size, 4, q.id + ' dup options');
            assert.inRange(q.correct, 0, 3);
            assert.equal(q.options[q.correct], q.answer, q.id + ' answer/index mismatch');
            assert.truthy((q.explanation.match(/✗/g) || []).length >= 3, q.id + ' needs 3 ✗');
        }
    });

    test('pair questions have two blanks and pair-style options; mcq exactly one blank', () => {
        for (const q of byType.pair || []) {
            assert.equal((q.q.match(/___/g) || []).length, 2, q.id);
            assert.truthy(q.options.every(o => o.includes('/')), q.id + ' options must be pairs');
        }
        for (const q of byType.mcq || []) {
            assert.equal((q.q.match(/___/g) || []).length, 1, q.id);
        }
    });

    test('letter/open: one-word lowercase answer inside accept; letter hint shows first letter', () => {
        for (const q of [...(byType.letter || []), ...(byType.open || [])]) {
            assert.truthy(/^[a-z][a-z'-]*$/.test(q.answer), q.id + ' answer: ' + q.answer);
            assert.truthy(q.accept.some(a => a === q.answer), q.id + ' accept misses answer');
        }
        const l = (byType.letter || [])[0];
        if (l) assert.equal(col._colLetterHint(l.answer)[0], l.answer[0]);
    });

    test('transform: keyword uppercase, frame has one blank, answer 2-9 words containing keyword', () => {
        for (const q of byType.transform || []) {
            assert.truthy(q.keyword && q.keyword === q.keyword.toUpperCase(), q.id);
            assert.equal((q.frame.match(/___/g) || []).length, 1, q.id);
            const words = q.answer.split(/\s+/).length;
            assert.inRange(words, 2, 9);
            assert.truthy(q.answer.toUpperCase().includes(q.keyword), q.id + ' keyword not in answer');
            assert.truthy(q.accept.length >= 1, q.id);
        }
    });

    test('explanations use only <br>/<b> markup and never leak undefined/null', () => {
        for (const q of COLLOCATION_QUESTIONS) {
            const stripped = q.explanation.replace(/<br>|<b>|<\/b>/g, '');
            assert.falsy(/[<>]/.test(stripped.replace(/&lt;|&gt;/g, '')), q.id + ' stray HTML');
            assert.falsy(/\b(undefined|null)\b/.test(q.explanation), q.id);
        }
    });

    test('correct option index is well distributed (no position gives away the answer)', () => {
        const dist = [0, 0, 0, 0];
        [...(byType.pair || []), ...(byType.mcq || [])].forEach(q => dist[q.correct]++);
        dist.forEach((d, i) => assert.truthy(d >= 30, `position ${i} only ${d}`));
    });
});

suite('collocation: grading', () => {
    test('typed grading is case/space/punctuation-insensitive', () => {
        const q = { answer: 'conclusion', accept: ['conclusion'] };
        assert.truthy(col._colAnswerCorrect('  Conclusion ', q));
        assert.truthy(col._colAnswerCorrect('conclusion.', q));
        assert.falsy(col._colAnswerCorrect('conclusions', q));
        assert.falsy(col._colAnswerCorrect('', q));
    });

    test('apostrophes are optional (shes ≡ she\'s) and accept variants pass', () => {
        const q = { answer: "she's got no choice but to", accept: ["she has got no choice but to"] };
        assert.truthy(col._colAnswerCorrect("shes got no choice but to", q));
        assert.truthy(col._colAnswerCorrect("she has got no choice but to", q));
    });

    test('every bank answer grades correct against itself', () => {
        for (const q of COLLOCATION_QUESTIONS) {
            if (q.type === 'pair' || q.type === 'mcq') continue;
            assert.truthy(col._colAnswerCorrect(q.answer, q), q.id);
        }
    });

    test('letter hint format: first letter + one slot per remaining letter', () => {
        assert.equal(col._colLetterHint('cake'), 'c _ _ _');
        assert.equal(col._colLetterHint('a'), 'a');
    });
});

// Pinned after the generation workflow lands; update deliberately.
const COLLOC_EXPECTED_COUNTS = require('./collocation-counts.json');

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
