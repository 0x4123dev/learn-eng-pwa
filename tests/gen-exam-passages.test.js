// gen-exam-passages.test.js — passage/bank consistency across the Exam-tab
// question bank (js/exam-data.js). Complements tests/exam.test.js, which only
// checks that Cloze/Reading questions carry *a* passage: here we assert that
// within any passage-bearing section every question carries the IDENTICAL
// passage string, that cloze passages embed the literal blank marker for each
// question number, that passages are substantial (>400 chars — shortest real
// one is 429), and that Word-bank sections share one identical bank array.
// exam-data.js is not loaded by setup.js, so evaluate it in an isolated vm.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadExams() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam-data.js'), 'utf8');
    return vm.runInNewContext(code + '\n;({ EXAMS: EXAMS });', {});
}
const { EXAMS } = loadExams();

const norm = s => String(s).toLowerCase().trim();

function bySection(exam) {
    const groups = {};
    for (const q of exam.questions) {
        (groups[q.section] = groups[q.section] || []).push(q);
    }
    return groups;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-exam: any section where some question has a passage → every question of
// that section has the byte-identical passage string, and it is >100 chars.
// ─────────────────────────────────────────────────────────────────────────────
suite('gen: exam passage consistency', () => {
    for (const ex of EXAMS) {
        test(`${ex.id} — passage-bearing sections share one identical >400-char passage`, () => {
            const groups = bySection(ex);
            let sectionsWithPassage = 0;
            for (const [sec, qs] of Object.entries(groups)) {
                const withPassage = qs.filter(q => q.passage);
                if (withPassage.length === 0) continue;
                sectionsWithPassage++;
                // If one question of a section has a passage, ALL of them must.
                assert.equal(withPassage.length, qs.length,
                    `${ex.id} "${sec}": only ${withPassage.length}/${qs.length} questions carry a passage`);
                const reference = qs[0].passage;
                assert.truthy(typeof reference === 'string' && reference.length > 400,
                    `${ex.id} "${sec}" passage too short (${reference.length} chars)`);
                for (const q of qs) {
                    assert.equal(q.passage, reference,
                        `${ex.id} "${sec}" Q${q.n} passage differs from the section's shared passage`);
                }
            }
            // Every exam has at least Cloze + Reading passages (Dictionary adds a 3rd).
            assert.inRange(sectionsWithPassage, 2, 3,
                `${ex.id} expected 2-3 passage-bearing sections, got ${sectionsWithPassage}`);
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-exam (2026-format papers only): the Word bank section carries the same
// bank array — same words, same order — on both of its questions.
// ─────────────────────────────────────────────────────────────────────────────
const wordBankExams = EXAMS.filter(ex => ex.questions.some(q => q.section === 'Word bank'));

suite('gen: word-bank consistency', () => {
    for (const ex of wordBankExams) {
        test(`${ex.id} — Word bank questions share one identical 5-word bank`, () => {
            const qs = ex.questions.filter(q => q.section === 'Word bank');
            assert.equal(qs.length, 2, `${ex.id} expected 2 word-bank questions`);
            const reference = qs[0].bank;
            assert.truthy(Array.isArray(reference), `${ex.id} bank must be an array`);
            assert.equal(reference.length, 5, `${ex.id} bank has ${reference.length} words, expected 5`);
            assert.equal(new Set(reference).size, 5, `${ex.id} bank has duplicate entries`);
            for (const q of qs) {
                assert.deepEqual(q.bank, reference,
                    `${ex.id} Q${q.n} bank differs from the section's shared bank`);
                // The fill-in answer must be drawn from the shared bank.
                assert.equal(q.type, 'text', `${ex.id} Q${q.n} word-bank question should be type text`);
                assert.contains(q.bank.map(norm), norm(q.answer),
                    `${ex.id} Q${q.n} answer "${q.answer}" is not in its bank`);
            }
            // Q35 and Q36 must not consume the same bank word.
            assert.truthy(norm(qs[0].answer) !== norm(qs[1].answer),
                `${ex.id} both word-bank questions share the answer "${qs[0].answer}"`);
        });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// Bank-wide aggregates: blank markers, numbering blueprint, placement rules.
// ─────────────────────────────────────────────────────────────────────────────
suite('gen: cloze markers & passage placement', () => {
    test('every cloze passage embeds the literal (n) blank marker for each of its questions', () => {
        for (const ex of EXAMS) {
            for (const q of ex.questions.filter(q => q.section === 'Cloze')) {
                assert.truthy(q.passage.includes('(' + q.n + ')'),
                    `${ex.id} cloze passage is missing the blank marker (${q.n})`);
            }
        }
    });

    test('cloze passages contain EXACTLY the six <b>(n)&nbsp;___</b> markers 17-22, no extras', () => {
        for (const ex of EXAMS) {
            const cloze = ex.questions.find(q => q.section === 'Cloze');
            const markers = [...cloze.passage.matchAll(/<b>\((\d+)\)&nbsp;___<\/b>/g)]
                .map(m => Number(m[1]))
                .sort((a, b) => a - b);
            assert.deepEqual(markers, [17, 18, 19, 20, 21, 22],
                `${ex.id} cloze passage markers are [${markers}], expected exactly 17-22`);
        }
    });

    test('numbering blueprint holds everywhere: Cloze is Q17-22, Reading is Q23-28', () => {
        for (const ex of EXAMS) {
            const cns = ex.questions.filter(q => q.section === 'Cloze').map(q => q.n).sort((a, b) => a - b);
            const rns = ex.questions.filter(q => q.section === 'Reading').map(q => q.n).sort((a, b) => a - b);
            assert.deepEqual(cns, [17, 18, 19, 20, 21, 22], `${ex.id} cloze numbering off-blueprint`);
            assert.deepEqual(rns, [23, 24, 25, 26, 27, 28], `${ex.id} reading numbering off-blueprint`);
        }
    });

    test('non-cloze passages are prose: no ___ blanks at all, pairwise distinct from each other', () => {
        for (const ex of EXAMS) {
            // No blank of any style leaks outside the Cloze section.
            for (const q of ex.questions) {
                if (q.section !== 'Cloze' && q.passage) {
                    assert.falsy(q.passage.includes('___'),
                        `${ex.id} Q${q.n} "${q.section}" passage contains a ___ blank`);
                }
            }
            // Each passage-bearing section uses its own text (cloze/reading/dictionary
            // are pairwise distinct).
            const texts = {};
            for (const q of ex.questions) {
                if (q.passage) texts[q.section] = q.passage;
            }
            const secs = Object.keys(texts);
            for (let i = 0; i < secs.length; i++) {
                for (let j = i + 1; j < secs.length; j++) {
                    assert.truthy(texts[secs[i]] !== texts[secs[j]],
                        `${ex.id} sections "${secs[i]}" and "${secs[j]}" share the same passage`);
                }
            }
        }
    });

    test('passages appear only in Cloze/Reading/Dictionary sections; banks only in Word bank', () => {
        const passageSections = ['Cloze', 'Reading', 'Dictionary'];
        for (const ex of EXAMS) {
            for (const q of ex.questions) {
                if (q.passage) {
                    assert.contains(passageSections, q.section,
                        `${ex.id} Q${q.n}: unexpected passage in section "${q.section}"`);
                }
                if (q.bank) {
                    assert.equal(q.section, 'Word bank',
                        `${ex.id} Q${q.n}: unexpected bank in section "${q.section}"`);
                }
            }
        }
    });

    test('the 33 exams split 11/11/11 across the three paper formats', () => {
        const hasSec = (ex, s) => ex.questions.some(q => q.section === s);
        const wordBank = EXAMS.filter(ex => hasSec(ex, 'Word bank'));
        const dictionary = EXAMS.filter(ex => hasSec(ex, 'Dictionary'));
        const neither = EXAMS.filter(ex => !hasSec(ex, 'Word bank') && !hasSec(ex, 'Dictionary'));
        // 2026-format: Word bank Q35-36 (exam1, exam2, examp2-10)
        assert.equal(wordBank.length, 11, 'expected 11 word-bank (2026-format) exams');
        assert.contains(wordBank.map(e => e.id), 'exam1');
        // 2025-format: Dictionary-entry passage on Q35-36 (exam2025, examp11-20)
        assert.equal(dictionary.length, 11, 'expected 11 dictionary (2025-format) exams');
        assert.contains(dictionary.map(e => e.id), 'exam2025');
        // 2024-format: neither — six Rewrite questions instead (exam2024, examp21-30)
        assert.equal(neither.length, 11, 'expected 11 rewrite-heavy (2024-format) exams');
        assert.contains(neither.map(e => e.id), 'exam2024');
        // No exam mixes Word bank and Dictionary.
        for (const ex of EXAMS) {
            assert.falsy(hasSec(ex, 'Word bank') && hasSec(ex, 'Dictionary'),
                `${ex.id} mixes Word bank and Dictionary sections`);
        }
        // Dictionary Q35-36 mirror the word-bank slot in the other format, are
        // free-text questions, and their shared passage reads like a dictionary
        // entry (part-of-speech markers such as /n/, "noun", "verb"…).
        for (const ex of dictionary) {
            const qs = ex.questions.filter(q => q.section === 'Dictionary');
            const ns = qs.map(q => q.n).sort((a, b) => a - b);
            assert.deepEqual(ns, [35, 36], `${ex.id} dictionary questions off the Q35-36 slot`);
            for (const q of qs) {
                assert.equal(q.type, 'text', `${ex.id} Q${q.n} dictionary question should be type text`);
                assert.truthy(typeof q.answer === 'string' && q.answer.length > 0,
                    `${ex.id} Q${q.n} dictionary question is missing a text answer`);
            }
            assert.truthy(/\/(n|v|adj)|noun|verb|adjective/i.test(qs[0].passage),
                `${ex.id} dictionary passage lacks part-of-speech markers`);
        }
        for (const ex of wordBank) {
            const ns = ex.questions.filter(q => q.section === 'Word bank').map(q => q.n).sort((a, b) => a - b);
            assert.deepEqual(ns, [35, 36], `${ex.id} word-bank questions off the Q35-36 slot`);
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
