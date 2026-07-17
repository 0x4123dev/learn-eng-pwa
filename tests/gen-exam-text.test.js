// gen-exam-text.test.js — accept-list hygiene for the Exam tab's type:'text'
// questions (js/exam-data.js). exam.test.js already checks that answer/accept
// exist and that the answer is covered; here we characterize the accept lists
// themselves: entry shape (non-empty, lowercase, trimmed), no raw duplicates,
// size bounds, and agreement with the _normalizeAnswer grading rule from
// js/exam.js. Loaded in an isolated vm context like exam.test.js.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadExams() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam-data.js'), 'utf8');
    return vm.runInNewContext(code + '\n;({ EXAMS: EXAMS });', {});
}
const { EXAMS } = loadExams();

// Copied verbatim from js/exam.js _normalizeAnswer — the grading normalizer.
function normalizeAnswer(s) {
    return String(s || '')
        .toLowerCase()
        .replace(/^→\s*/, '')
        .replace(/[.,!?;:"'’`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

// Flattened list of every text question, tagged with its exam id.
const textQs = [];
for (const ex of EXAMS) {
    for (const q of ex.questions) {
        if (q.type === 'text') textQs.push({ examId: ex.id, q });
    }
}

suite('gen: exam text normalizer (copied from js/exam.js)', () => {
    test('lowercases input', () => {
        assert.equal(normalizeAnswer('Went SHOPPING'), 'went shopping');
    });

    test('strips a leading "→ " arrow prefix', () => {
        assert.equal(normalizeAnswer('→ was practical'), 'was practical');
        // Arrow only stripped at the start, not mid-string.
        assert.equal(normalizeAnswer('a → b'), 'a → b');
    });

    test('strips sentence punctuation . , ! ? ; : quotes and backticks', () => {
        assert.equal(normalizeAnswer('run out of money.'), 'run out of money');
        assert.equal(normalizeAnswer("don't stop, please!"), 'dont stop please');
        assert.equal(normalizeAnswer('"quoted"; `x’:'), 'quoted x');
    });

    test('collapses internal whitespace and trims the ends', () => {
        assert.equal(normalizeAnswer('  spend   money \t wisely  '), 'spend money wisely');
    });

    test('null / undefined / empty string all normalize to ""', () => {
        assert.equal(normalizeAnswer(null), '');
        assert.equal(normalizeAnswer(undefined), '');
        assert.equal(normalizeAnswer(''), '');
        assert.equal(normalizeAnswer('  .,!  '), '');
    });

    test('is idempotent on every accept entry in the bank', () => {
        for (const { examId, q } of textQs) {
            for (const a of q.accept) {
                const once = normalizeAnswer(a);
                assert.equal(normalizeAnswer(once), once,
                    `${examId} Q${q.n} entry ${JSON.stringify(a)} not stable under re-normalization`);
            }
        }
    });

    test('local copy behaves identically to _normalizeAnswer in js/exam.js', () => {
        // Guard against drift: extract the real grading normalizer from the app
        // source and compare it against our copy on every accept entry, every
        // answer, and a set of edge inputs.
        const examSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam.js'), 'utf8');
        const m = examSrc.match(/function _normalizeAnswer\(s\) \{[\s\S]*?\n\}/);
        assert.truthy(m, 'could not find _normalizeAnswer in js/exam.js');
        const appNormalize = vm.runInNewContext('(' + m[0] + ')', {});
        const edges = [null, undefined, '', '  .,!  ', '→ Was Practical.', 'a → b',
            '"Don’t stop, please!"', '  spend   money \t wisely  '];
        for (const input of edges) {
            assert.equal(normalizeAnswer(input), appNormalize(input),
                `divergence on edge input ${JSON.stringify(input)}`);
        }
        for (const { examId, q } of textQs) {
            assert.equal(normalizeAnswer(q.answer), appNormalize(q.answer),
                `${examId} Q${q.n} answer diverges`);
            for (const a of q.accept) {
                assert.equal(normalizeAnswer(a), appNormalize(a),
                    `${examId} Q${q.n} entry ${JSON.stringify(a)} diverges`);
            }
        }
    });
});

suite('gen: exam text accept lists (per exam)', () => {
    for (const ex of EXAMS) {
        test(`${ex.id} text questions have clean, deduped, normalizer-consistent accept lists`, () => {
            const qs = ex.questions.filter(q => q.type === 'text');
            assert.equal(qs.length, 12, `${ex.id} expected 12 text questions, got ${qs.length}`);
            for (const q of qs) {
                // answer: a non-empty string that survives normalization
                assert.equal(typeof q.answer, 'string', `${ex.id} Q${q.n} answer not a string`);
                assert.truthy(q.answer.trim().length > 0, `${ex.id} Q${q.n} answer is blank`);
                assert.truthy(normalizeAnswer(q.answer).length > 0,
                    `${ex.id} Q${q.n} answer normalizes to empty`);

                // accept: 1..8 entries
                assert.truthy(Array.isArray(q.accept), `${ex.id} Q${q.n} accept is not an array`);
                assert.inRange(q.accept.length, 1, 8, `${ex.id} Q${q.n} accept size out of bounds`);

                const trimmed = [];
                for (const a of q.accept) {
                    assert.equal(typeof a, 'string', `${ex.id} Q${q.n} non-string accept entry`);
                    assert.truthy(a.trim().length > 0, `${ex.id} Q${q.n} blank accept entry`);
                    // characterization: entries are stored pre-trimmed and fully lowercase
                    assert.equal(a, a.trim(), `${ex.id} Q${q.n} entry has stray whitespace: ${JSON.stringify(a)}`);
                    assert.equal(a, a.toLowerCase(), `${ex.id} Q${q.n} entry not lowercase: ${JSON.stringify(a)}`);
                    trimmed.push(a.trim());
                }

                // no duplicates after trimming
                assert.equal(new Set(trimmed).size, trimmed.length,
                    `${ex.id} Q${q.n} duplicate accept entries: ${JSON.stringify(q.accept)}`);

                // the model answer must be gradeable via the accept list
                assert.contains(q.accept.map(normalizeAnswer), normalizeAnswer(q.answer),
                    `${ex.id} Q${q.n} normalized answer not in normalized accept`);
            }
        });
    }
});

suite('gen: exam text bank shape (aggregate)', () => {
    test('bank has 396 text questions — 12 in each of the 33 exams', () => {
        assert.equal(EXAMS.length, 33);
        assert.equal(textQs.length, 396);
    });

    test('text questions only appear in the four expected sections', () => {
        const counts = {};
        for (const { q } of textQs) counts[q.section] = (counts[q.section] || 0) + 1;
        assert.equal(Object.keys(counts).length, 4, `sections: ${JSON.stringify(counts)}`);
        assert.equal(counts['Word form'], 198);
        assert.equal(counts['Rewrite'], 154);
        assert.equal(counts['Word bank'], 22);
        assert.equal(counts['Dictionary'], 22);
    });

    test('accept sizes stay small: 272×1, 95×2, 23×3, 6×4 — max 4, well under the 8 cap', () => {
        const bySize = {};
        for (const { q } of textQs) bySize[q.accept.length] = (bySize[q.accept.length] || 0) + 1;
        assert.deepEqual(bySize, { 1: 272, 2: 95, 3: 23, 4: 6 });
    });

    test('bank holds 555 accept entries; exactly 60 carry punctuation stripped by grading', () => {
        let total = 0, punctBearing = 0;
        for (const { q } of textQs) {
            for (const a of q.accept) {
                total++;
                if (normalizeAnswer(a) !== a) punctBearing++;
            }
        }
        assert.equal(total, 555);
        assert.equal(punctBearing, 60);
    });

    test('no accept entry carries the leading "→" arrow the normalizer strips', () => {
        for (const { examId, q } of textQs) {
            for (const a of q.accept) {
                assert.falsy(/^→/.test(a), `${examId} Q${q.n} arrow-prefixed entry ${JSON.stringify(a)}`);
            }
        }
    });

    test('accept entry lengths span exactly 5..93 characters', () => {
        let min = Infinity, max = -Infinity;
        for (const { q } of textQs) {
            for (const a of q.accept) {
                if (a.length < min) min = a.length;
                if (a.length > max) max = a.length;
            }
        }
        assert.equal(min, 5);
        assert.equal(max, 93);
    });

    test('exactly 50 questions carry punctuation-variant entries that collapse under normalization', () => {
        // Characterization: some Rewrite answers are listed both with and
        // without commas/periods; those variants are raw-distinct but
        // normalize to the same string. Harmless redundancy for grading.
        // Split: 48 in Rewrite, 2 in Word bank, none elsewhere.
        const bySection = {};
        let collapsing = 0;
        for (const { q } of textQs) {
            if (new Set(q.accept.map(normalizeAnswer)).size < q.accept.length) {
                collapsing++;
                bySection[q.section] = (bySection[q.section] || 0) + 1;
            }
        }
        assert.equal(collapsing, 50);
        assert.equal(bySection['Rewrite'], 48);
        assert.equal(bySection['Word bank'], 2);
        assert.equal(Object.keys(bySection).length, 2, JSON.stringify(bySection));
    });

    test('the four text sections contain only text-type questions (converse exclusivity)', () => {
        const TEXT_SECTIONS = ['Word form', 'Rewrite', 'Word bank', 'Dictionary'];
        for (const ex of EXAMS) {
            for (const q of ex.questions) {
                if (TEXT_SECTIONS.includes(q.section)) {
                    assert.equal(q.type, 'text',
                        `${ex.id} Q${q.n} in section ${q.section} has type ${q.type}`);
                }
            }
        }
    });

    test('every exam has exactly 6 Word form text questions', () => {
        for (const ex of EXAMS) {
            const wf = ex.questions.filter(q => q.type === 'text' && q.section === 'Word form').length;
            assert.equal(wf, 6, `${ex.id} has ${wf} Word form text questions`);
        }
    });

    test('per-exam text layouts: three patterns, 11 exams each', () => {
        // 2026-family: WF6+WB2+RW4; 2025-family: WF6+D2+RW4; 2024-family: WF6+RW6.
        const layoutCounts = {};
        for (const ex of EXAMS) {
            const s = {};
            for (const q of ex.questions) {
                if (q.type === 'text') s[q.section] = (s[q.section] || 0) + 1;
            }
            const key = Object.keys(s).sort().map(k => `${k}:${s[k]}`).join('|');
            layoutCounts[key] = (layoutCounts[key] || 0) + 1;
        }
        assert.equal(Object.keys(layoutCounts).length, 3, JSON.stringify(layoutCounts));
        assert.equal(layoutCounts['Rewrite:4|Word bank:2|Word form:6'], 11);
        assert.equal(layoutCounts['Dictionary:2|Rewrite:4|Word form:6'], 11);
        assert.equal(layoutCounts['Rewrite:6|Word form:6'], 11);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
