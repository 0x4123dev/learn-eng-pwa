// gen-exam-structure.test.js — practice exams mirror the reference papers'
// structure question-for-question. Every practice set was authored to clone a
// reference paper's blueprint: examp2..examp10 clone exam1 (Exam 2026),
// examp11..examp20 clone exam2025, examp21..examp30 clone exam2024. No other
// test covers the per-question-number {n → type/section} mirroring, so that is
// the focus here. Like exam.test.js we evaluate js/exam-data.js in an isolated
// vm context (setup.js does not load it) — nothing leaks into globalThis.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadExams() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam-data.js'), 'utf8');
    return vm.runInNewContext(code + '\n;({ EXAMS: EXAMS });', {});
}
const { EXAMS } = loadExams();
const byId = {};
for (const ex of EXAMS) byId[ex.id] = ex;

// {n → type} map for one exam, e.g. {1:'mcq', …, 23:'tf', …, 40:'text'}
function typeMap(ex) {
    const m = {};
    for (const q of ex.questions) m[q.n] = q.type;
    return m;
}

// {n → 'type|section'} — the full structural fingerprint of one exam. The
// practice sets mirror their reference on BOTH fields, so mirror tests
// compare this stronger map, not just types.
function structMap(ex) {
    const m = {};
    for (const q of ex.questions) m[q.n] = q.type + '|' + q.section;
    return m;
}

// Question numbers that carry a given optional field (passage / bank).
function slotsWith(ex, field) {
    return ex.questions.filter(q => q[field] !== undefined).map(q => q.n);
}

// How many question stems a practice set shares verbatim with its reference.
function identicalStems(refEx, ex) {
    let same = 0;
    for (let i = 0; i < refEx.questions.length; i++) {
        if (refEx.questions[i].q === ex.questions[i].q) same++;
    }
    return same;
}

// The shared type blueprint all three official papers follow (characterized
// from the data): Q1-22 mcq, Q23-26 tf, Q27-28 mcq, Q29-40 text.
const BLUEPRINT = {};
for (let n = 1; n <= 40; n++) {
    BLUEPRINT[n] = (n >= 23 && n <= 26) ? 'tf' : (n >= 29 ? 'text' : 'mcq');
}

// family id lists (reference first)
const FAMILY_2026 = ['exam1', 'exam2'];
for (let i = 2; i <= 10; i++) FAMILY_2026.push('examp' + i);
const FAMILY_2025 = ['exam2025'];
for (let i = 11; i <= 20; i++) FAMILY_2025.push('examp' + i);
const FAMILY_2024 = ['exam2024'];
for (let i = 21; i <= 30; i++) FAMILY_2024.push('examp' + i);

suite('gen: reference paper type blueprints', () => {
    test('exam1 (Exam 2026) follows the mcq/tf/text blueprint slot-for-slot', () => {
        assert.deepEqual(typeMap(byId.exam1), BLUEPRINT);
    });

    test('exam2025 follows the same blueprint', () => {
        assert.deepEqual(typeMap(byId.exam2025), BLUEPRINT);
    });

    test('exam2024 follows the same blueprint', () => {
        assert.deepEqual(typeMap(byId.exam2024), BLUEPRINT);
    });

    test('all three official papers share one identical {n → type} layout', () => {
        const a = JSON.stringify(typeMap(byId.exam1));
        assert.equal(JSON.stringify(typeMap(byId.exam2025)), a, 'exam2025 diverges from exam1');
        assert.equal(JSON.stringify(typeMap(byId.exam2024)), a, 'exam2024 diverges from exam1');
    });
});

suite('gen: examp2..examp10 mirror exam1 (Exam 2026)', () => {
    const ref = structMap(byId.exam1);

    test('exam2 ("Exam 1" practice) mirrors exam1 on type AND section per slot', () => {
        assert.equal(byId.exam2.questions.length, 40);
        assert.deepEqual(structMap(byId.exam2), ref);
    });

    for (let i = 2; i <= 10; i++) {
        const id = 'examp' + i;
        test(`${id} has 40 questions and matches exam1 on every {n → type|section}`, () => {
            const ex = byId[id];
            assert.truthy(ex, `missing ${id}`);
            assert.equal(ex.questions.length, 40);
            assert.deepEqual(structMap(ex), ref, `${id} structure diverges from exam1`);
        });
    }
});

suite('gen: examp11..examp20 mirror exam2025', () => {
    const ref = structMap(byId.exam2025);

    for (let i = 11; i <= 20; i++) {
        const id = 'examp' + i;
        test(`${id} has 40 questions and matches exam2025 on every {n → type|section}`, () => {
            const ex = byId[id];
            assert.truthy(ex, `missing ${id}`);
            assert.equal(ex.questions.length, 40);
            assert.deepEqual(structMap(ex), ref, `${id} structure diverges from exam2025`);
        });
    }
});

suite('gen: examp21..examp30 mirror exam2024', () => {
    const ref = structMap(byId.exam2024);

    for (let i = 21; i <= 30; i++) {
        const id = 'examp' + i;
        test(`${id} has 40 questions and matches exam2024 on every {n → type|section}`, () => {
            const ex = byId[id];
            assert.truthy(ex, `missing ${id}`);
            assert.equal(ex.questions.length, 40);
            assert.deepEqual(structMap(ex), ref, `${id} structure diverges from exam2024`);
        });
    }
});

suite('gen: whole-bank structural invariants', () => {
    test('all 33 exams store questions in positional order: questions[i].n === i+1', () => {
        assert.equal(EXAMS.length, 33);
        for (const ex of EXAMS) {
            for (let i = 0; i < ex.questions.length; i++) {
                assert.equal(ex.questions[i].n, i + 1,
                    `${ex.id} question at index ${i} is n=${ex.questions[i].n}`);
            }
        }
    });

    test('every exam has exactly 24 mcq, 4 tf and 12 text questions', () => {
        for (const ex of EXAMS) {
            const c = { mcq: 0, tf: 0, text: 0 };
            for (const q of ex.questions) c[q.type]++;
            assert.equal(c.mcq, 24, `${ex.id} mcq count`);
            assert.equal(c.tf, 4, `${ex.id} tf count`);
            assert.equal(c.text, 12, `${ex.id} text count`);
        }
    });

    test('2026 family (exam1, exam2, examp2..10) all run 40 minutes', () => {
        for (const id of FAMILY_2026) {
            assert.equal(byId[id].durationMin, 40, `${id} durationMin`);
        }
    });

    test('2025 family (exam2025, examp11..20) all run 90 minutes', () => {
        for (const id of FAMILY_2025) {
            assert.equal(byId[id].durationMin, 90, `${id} durationMin`);
        }
    });

    test('2024 family (exam2024, examp21..30) all run 90 minutes', () => {
        for (const id of FAMILY_2024) {
            assert.equal(byId[id].durationMin, 90, `${id} durationMin`);
        }
    });
});

suite('gen: section layouts per reference paper', () => {
    // {n → section} for one exam, as an ordered 40-entry array.
    const sections = ex => ex.questions.map(q => q.section);
    const spans = list => {
        // collapse ['Phonetics','Phonetics','Cloze',…] → [['Phonetics',1,2],['Cloze',3,3],…]
        const out = [];
        list.forEach((s, i) => {
            if (out.length && out[out.length - 1][0] === s) out[out.length - 1][2] = i + 1;
            else out.push([s, i + 1, i + 1]);
        });
        return out;
    };

    test('exam1 sections: Phonetics 1-4, Language use 5-16, Cloze 17-22, Reading 23-28, Word form 29-34, Word bank 35-36, Rewrite 37-40', () => {
        assert.deepEqual(spans(sections(byId.exam1)), [
            ['Phonetics', 1, 4], ['Language use', 5, 16], ['Cloze', 17, 22],
            ['Reading', 23, 28], ['Word form', 29, 34], ['Word bank', 35, 36],
            ['Rewrite', 37, 40]
        ]);
    });

    test('exam2025 sections: same shape but 35-36 is "Dictionary" instead of "Word bank"', () => {
        assert.deepEqual(spans(sections(byId.exam2025)), [
            ['Phonetics', 1, 4], ['Language use', 5, 16], ['Cloze', 17, 22],
            ['Reading', 23, 28], ['Word form', 29, 34], ['Dictionary', 35, 36],
            ['Rewrite', 37, 40]
        ]);
    });

    test('exam2024 sections: no 35-36 special block — Rewrite spans 35-40', () => {
        assert.deepEqual(spans(sections(byId.exam2024)), [
            ['Phonetics', 1, 4], ['Language use', 5, 16], ['Cloze', 17, 22],
            ['Reading', 23, 28], ['Word form', 29, 34], ['Rewrite', 35, 40]
        ]);
    });

    test('Reading (23-28) spans the whole tf block plus two mcq in all 33 exams', () => {
        for (const ex of EXAMS) {
            for (const q of ex.questions) {
                if (q.n >= 23 && q.n <= 28) {
                    assert.equal(q.section, 'Reading', `${ex.id} Q${q.n} section`);
                    assert.equal(q.type, q.n <= 26 ? 'tf' : 'mcq', `${ex.id} Q${q.n} type`);
                }
            }
        }
    });
});

suite('gen: passage and bank slots mirror per family', () => {
    test('2026 family: passages sit at exactly Q17-28 in all 11 exams', () => {
        const expected = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
        for (const id of FAMILY_2026) {
            assert.deepEqual(slotsWith(byId[id], 'passage'), expected, `${id} passage slots`);
        }
    });

    test('2025 family: passages sit at Q17-28 AND the Dictionary pair Q35-36 in all 11 exams', () => {
        const expected = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 35, 36];
        for (const id of FAMILY_2025) {
            assert.deepEqual(slotsWith(byId[id], 'passage'), expected, `${id} passage slots`);
        }
    });

    test('2024 family: passages sit at exactly Q17-28 in all 11 exams', () => {
        const expected = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28];
        for (const id of FAMILY_2024) {
            assert.deepEqual(slotsWith(byId[id], 'passage'), expected, `${id} passage slots`);
        }
    });

    test('word banks exist only in the 2026 family, at exactly Q35-36', () => {
        for (const id of FAMILY_2026) {
            assert.deepEqual(slotsWith(byId[id], 'bank'), [35, 36], `${id} bank slots`);
        }
    });

    test('2025 and 2024 families carry no bank field on any question', () => {
        for (const id of FAMILY_2025.concat(FAMILY_2024)) {
            assert.deepEqual(slotsWith(byId[id], 'bank'), [], `${id} unexpectedly has bank`);
        }
    });
});

suite('gen: content-level structure', () => {
    test('every tf question in the bank offers exactly ["True","False"] (132 questions)', () => {
        let count = 0;
        for (const ex of EXAMS) {
            for (const q of ex.questions) {
                if (q.type !== 'tf') continue;
                count++;
                assert.deepEqual(q.options, ['True', 'False'], `${ex.id} Q${q.n} tf options`);
            }
        }
        assert.equal(count, 132, 'total tf questions bank-wide');
    });

    test('practice sets are fresh content: each shares only 10-12 of 40 stems verbatim with its reference', () => {
        const families = [
            [byId.exam1, FAMILY_2026.slice(1)],
            [byId.exam2025, FAMILY_2025.slice(1)],
            [byId.exam2024, FAMILY_2024.slice(1)]
        ];
        for (const [refEx, ids] of families) {
            for (const id of ids) {
                const same = identicalStems(refEx, byId[id]);
                assert.inRange(same, 10, 12,
                    `${id} shares ${same}/40 stems verbatim with ${refEx.id}`);
            }
        }
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
