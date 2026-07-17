// gen-exam-explanations.test.js — characterization of Exam-tab explanation
// quality (js/exam-data.js). exam.test.js covers bank structure and asserts
// explanation.length >= 40; here we pin down the *content* conventions the
// 1,320 explanations actually follow today:
//   - every explanation is >= 100 chars (real floor: 109) and carries the
//     '🔑' rule marker
//   - every mcq explanation either uses the per-wrong-option '✗' marker or
//     names at least one distractor (case-insensitively, after stripping the
//     <b>/<br> markup that stress-pattern items weave through the words)
//   - no explanation leaks '&lt;'/'&gt;'/'&amp;' entities or the JS literals
//     'undefined'/'null'
// Like exam.test.js we evaluate exam-data.js in an isolated vm context.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadExams() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam-data.js'), 'utf8');
    return vm.runInNewContext(code + '\n;({ EXAMS: EXAMS });', {});
}
const { EXAMS } = loadExams();

// Lowercased plain text of an explanation with HTML tags removed, so that
// "re<b>PEAT</b>" still counts as mentioning the distractor "repeat".
const stripTags = s => String(s).replace(/<[^>]*>/g, '').toLowerCase();

const distractorsOf = q => q.options.filter((_, i) => i !== q.correct);
const namesADistractor = q => {
    const plain = stripTags(q.explanation);
    return distractorsOf(q).some(d => plain.includes(String(d).toLowerCase()));
};

const allQs = [];
for (const ex of EXAMS) for (const q of ex.questions) allQs.push({ examId: ex.id, q });

suite('gen: exam explanation quality (per exam)', () => {
    for (const ex of EXAMS) {
        test(`${ex.id} — all 40 explanations are substantial, 🔑-keyed and clean`, () => {
            // Guard the loop below against passing vacuously on an empty exam.
            assert.equal(ex.questions.length, 40,
                `${ex.id} has ${ex.questions.length} questions, expected 40`);
            for (const q of ex.questions) {
                const e = q.explanation;
                assert.truthy(typeof e === 'string' && e.length >= 100,
                    `${ex.id} Q${q.n} explanation only ${e && e.length} chars`);
                assert.truthy(e.includes('🔑'),
                    `${ex.id} Q${q.n} explanation missing the 🔑 rule marker`);
                assert.falsy(e.includes('&lt;') || e.includes('&gt;') || e.includes('&amp;'),
                    `${ex.id} Q${q.n} explanation leaks an HTML entity`);
                assert.falsy(/\b(undefined|null)\b/.test(e),
                    `${ex.id} Q${q.n} explanation contains a leaked JS literal`);
                if (q.type === 'mcq') {
                    assert.truthy(e.includes('✗') || namesADistractor(q),
                        `${ex.id} Q${q.n} mcq explanation neither uses ✗ nor names a distractor`);
                }
            }
        });
    }
});

suite('gen: exam explanation aggregates', () => {
    test('the bank carries 1,320 explanations across 33 exams', () => {
        assert.equal(EXAMS.length, 33);
        assert.equal(allQs.length, 1320);
        assert.truthy(allQs.every(({ q }) => typeof q.explanation === 'string'));
    });

    test('shortest explanation in the whole bank is exam2025 Q31 at 109 chars', () => {
        let min = allQs[0];
        for (const x of allQs) if (x.q.explanation.length < min.q.explanation.length) min = x;
        assert.equal(min.q.explanation.length, 109);
        assert.equal(`${min.examId} Q${min.q.n}`, 'exam2025 Q31');
        assert.truthy(allQs.every(({ q }) => q.explanation.length >= 40));
    });

    test('longest explanation is 1540 chars — nothing runaway or truncated to nonsense', () => {
        const maxLen = Math.max(...allQs.map(({ q }) => q.explanation.length));
        assert.equal(maxLen, 1540);
    });

    test('type mix behind the mcq split: 792 mcq, 132 tf, 396 text', () => {
        const counts = {};
        for (const { q } of allQs) counts[q.type] = (counts[q.type] || 0) + 1;
        assert.deepEqual(counts, { mcq: 792, tf: 132, text: 396 });
    });

    test('explanations use only inline formatting tags (b, br, i, strong, u)', () => {
        // Explanations are injected as innerHTML by the Exam tab, so pin the
        // tag vocabulary: no <script>, <img>, event handlers, or block markup.
        const allowed = new Set(['b', 'br', 'i', 'strong', 'u']);
        const offenders = [];
        for (const { examId, q } of allQs) {
            for (const m of q.explanation.matchAll(/<\/?([a-z][a-z0-9]*)/gi)) {
                if (!allowed.has(m[1].toLowerCase())) offenders.push(`${examId} Q${q.n}: ${m[0]}`);
            }
        }
        assert.deepEqual(offenders, []);
    });

    test('every single explanation contains the 🔑 rule marker', () => {
        const withKey = allQs.filter(({ q }) => q.explanation.includes('🔑')).length;
        assert.equal(withKey, 1320);
    });

    test('772 of the 792 mcq explanations carry the per-wrong-option ✗ marker', () => {
        const mcqs = allQs.filter(({ q }) => q.type === 'mcq');
        assert.equal(mcqs.length, 792);
        const withX = mcqs.filter(({ q }) => q.explanation.includes('✗')).length;
        assert.equal(withX, 772);
    });

    test('the 20 ✗-less mcq explanations are all stress-pattern Q3 items', () => {
        const noX = allQs.filter(({ q }) => q.type === 'mcq' && !q.explanation.includes('✗'));
        assert.equal(noX.length, 20);
        for (const { examId, q } of noX) {
            assert.equal(q.n, 3, `${examId} unexpected ✗-less mcq at Q${q.n}`);
            assert.truthy(/stress/.test(q.q), `${examId} Q3 is not a stress question`);
        }
    });

    test('each ✗-less stress explanation still names a distractor through the <b> markup', () => {
        const noX = allQs.filter(({ q }) => q.type === 'mcq' && !q.explanation.includes('✗'));
        for (const { examId, q } of noX) {
            // Raw text never contains the distractor verbatim ("re<b>PEAT</b>"),
            // but the tag-stripped text does.
            assert.falsy(distractorsOf(q).some(d => q.explanation.includes(d)),
                `${examId} Q${q.n} unexpectedly names a distractor verbatim`);
            assert.truthy(namesADistractor(q),
                `${examId} Q${q.n} names no distractor even after stripping tags`);
        }
    });

    test('bold markup (<b> or <strong>) appears in all but exactly 2 explanations', () => {
        const noBold = allQs.filter(({ q }) =>
            !q.explanation.includes('<b>') && !q.explanation.includes('<strong>'));
        assert.equal(noBold.length, 2);
        assert.equal(allQs.length - noBold.length, 1318);
    });

    test('the two bold-less explanations are exam1 Q13 and examp8 Q13, formatted with <br> + 🔑', () => {
        const noBold = allQs.filter(({ q }) =>
            !q.explanation.includes('<b>') && !q.explanation.includes('<strong>'));
        assert.deepEqual(noBold.map(x => `${x.examId} Q${x.q.n}`).sort(),
            ['exam1 Q13', 'examp8 Q13']);
        for (const { q } of noBold) {
            assert.truthy(q.explanation.includes('<br>'));
            assert.truthy(q.explanation.includes('🔑'));
        }
    });

    test('no explanation leaks the &lt; HTML entity', () => {
        const leaks = allQs.filter(({ q }) => q.explanation.includes('&lt;'));
        assert.deepEqual(leaks.map(x => `${x.examId} Q${x.q.n}`), []);
    });

    test('no explanation leaks &gt; or &amp; entities either', () => {
        const leaks = allQs.filter(({ q }) =>
            q.explanation.includes('&gt;') || q.explanation.includes('&amp;'));
        assert.deepEqual(leaks.map(x => `${x.examId} Q${x.q.n}`), []);
    });

    test('no explanation contains the literal word "undefined"', () => {
        const leaks = allQs.filter(({ q }) => /\bundefined\b/i.test(q.explanation));
        assert.deepEqual(leaks.map(x => `${x.examId} Q${x.q.n}`), []);
    });

    test('no explanation contains the literal word "null"', () => {
        const leaks = allQs.filter(({ q }) => /\bnull\b/i.test(q.explanation));
        assert.deepEqual(leaks.map(x => `${x.examId} Q${x.q.n}`), []);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
