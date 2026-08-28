// gen-exam-bank.test.js — bank-wide invariants for the Exam-tab data
// (js/exam-data.js) that are NOT covered by tests/exam.test.js:
// subtitle presence, exact durations (40/90), unique ids/titles, the closed
// set of section labels, option string hygiene (trimmed, non-empty, distinct
// from the stem), and the exact tf option pair ['True','False'].
// exam-data.js is not loaded by setup.js, so evaluate it in a vm sandbox
// (same loader pattern as tests/exam.test.js).
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadExams() {
    const code = fs.readFileSync(path.join(__dirname, '..', 'js', 'exam-data.js'), 'utf8');
    return vm.runInNewContext(code + '\n;({ EXAMS: EXAMS });', {});
}
const { EXAMS } = loadExams();

// Derived by inspecting the shipped bank: every question in all 33 exams uses
// one of these eight section labels (2026-style papers use "Word bank",
// 2025-style use "Dictionary", 2024-style use neither).
const KNOWN_SECTIONS = [
    'Cloze', 'Dictionary', 'Language use', 'Phonetics',
    'Reading', 'Rewrite', 'Word bank', 'Word form'
];

const isTrimmedNonEmpty = v =>
    typeof v === 'string' && v.length > 0 && v === v.trim();

suite('gen: exam bank identity', () => {
    test('ids are unique across all 33 exams', () => {
        assert.equal(EXAMS.length, 33);
        const ids = EXAMS.map(e => e.id);
        assert.equal(new Set(ids).size, EXAMS.length, 'duplicate exam id in bank');
    });

    test('titles are unique across the bank', () => {
        const titles = EXAMS.map(e => e.title);
        assert.equal(new Set(titles).size, EXAMS.length,
            'two exams share a title: ' + JSON.stringify(titles));
    });

    test('the subtitle set is exactly the 7 known "HCMC Grade-10 Entrance" variants', () => {
        for (const ex of EXAMS) {
            assert.truthy(ex.subtitle.startsWith('HCMC Grade-10 Entrance'),
                `${ex.id} subtitle "${ex.subtitle}" lost the branding prefix`);
        }
        // 3 official-paper subtitles + Practice Set 1 + one per style year (2026/2025/2024)
        assert.deepEqual([...new Set(EXAMS.map(e => e.subtitle))].sort(), [
            'HCMC Grade-10 Entrance · Official 2026 (reference)',
            'HCMC Grade-10 Entrance · Official Paper 2024',
            'HCMC Grade-10 Entrance · Official Paper 2025',
            'HCMC Grade-10 Entrance · Practice (2024 style)',
            'HCMC Grade-10 Entrance · Practice (2025 style)',
            'HCMC Grade-10 Entrance · Practice (2026 style)',
            'HCMC Grade-10 Entrance · Practice Set 1'
        ]);
    });

    test('exactly 11 exams run 40 min (2026 style) and 22 run 90 min', () => {
        const at40 = EXAMS.filter(e => e.durationMin === 40);
        const at90 = EXAMS.filter(e => e.durationMin === 90);
        assert.equal(at40.length, 11);
        assert.equal(at90.length, 22);
        assert.equal(at40.length + at90.length, EXAMS.length, 'a duration other than 40/90 exists');
    });

    test('bank-wide section label set is exactly the 8 known labels', () => {
        const seen = new Set();
        for (const ex of EXAMS) for (const q of ex.questions) seen.add(q.section);
        assert.deepEqual([...seen].sort(), KNOWN_SECTIONS);
    });

    test('"Word bank" section appears only in the eleven 40-min exams', () => {
        const withWb = EXAMS.filter(e => e.questions.some(q => q.section === 'Word bank'));
        assert.deepEqual(withWb.map(e => e.id).sort(),
            ['exam1', 'exam2', 'examp10', 'examp2', 'examp3', 'examp4', 'examp5',
             'examp6', 'examp7', 'examp8', 'examp9']);
        for (const ex of withWb) {
            assert.equal(ex.durationMin, 40, `${ex.id} has Word bank but is not a 40-min paper`);
        }
    });

    test('"Dictionary" section appears only in the 2025-style exams', () => {
        const withDict = EXAMS.filter(e => e.questions.some(q => q.section === 'Dictionary'));
        assert.deepEqual(withDict.map(e => e.id).sort(),
            ['exam2025', 'examp11', 'examp12', 'examp13', 'examp14', 'examp15',
             'examp16', 'examp17', 'examp18', 'examp19', 'examp20']);
        for (const ex of withDict) {
            assert.equal(ex.durationMin, 90, `${ex.id} has Dictionary but is not a 90-min paper`);
        }
    });

    test('2024-style exams use neither "Word bank" nor "Dictionary"', () => {
        const style2024 = ['exam2024', 'examp21', 'examp22', 'examp23', 'examp24', 'examp25',
            'examp26', 'examp27', 'examp28', 'examp29', 'examp30'];
        for (const id of style2024) {
            const ex = EXAMS.find(e => e.id === id);
            assert.truthy(ex, `${id} missing from bank`);
            const secs = new Set(ex.questions.map(q => q.section));
            assert.falsy(secs.has('Word bank'), `${id} unexpectedly has a Word bank section`);
            assert.falsy(secs.has('Dictionary'), `${id} unexpectedly has a Dictionary section`);
        }
    });
});

suite('gen: exam bank aggregates', () => {
    test('type distribution across the bank: 792 mcq + 132 tf + 396 text = 1320', () => {
        const counts = { mcq: 0, tf: 0, text: 0 };
        for (const ex of EXAMS) for (const q of ex.questions) counts[q.type]++;
        assert.equal(counts.mcq, 792);
        assert.equal(counts.tf, 132);
        assert.equal(counts.text, 396);
        assert.equal(counts.mcq + counts.tf + counts.text, 1320);
    });

    test('true/false questions appear only in the Reading section', () => {
        const tfSections = new Set();
        let tfCount = 0;
        for (const ex of EXAMS) for (const q of ex.questions) {
            if (q.type === 'tf') { tfSections.add(q.section); tfCount++; }
        }
        assert.truthy(tfCount > 0, 'bank has no tf questions at all');
        assert.deepEqual([...tfSections], ['Reading']);
    });

    test('every exam has the same type mix: 24 mcq + 4 tf + 12 text', () => {
        for (const ex of EXAMS) {
            const m = { mcq: 0, tf: 0, text: 0 };
            for (const q of ex.questions) m[q.type]++;
            assert.deepEqual(m, { mcq: 24, tf: 4, text: 12 },
                `${ex.id} type mix is ${JSON.stringify(m)}`);
        }
    });

    test('every exam spans 6 or 7 distinct section labels (6 only in 2024 style)', () => {
        for (const ex of EXAMS) {
            const distinct = new Set(ex.questions.map(q => q.section)).size;
            assert.inRange(distinct, 6, 7,
                `${ex.id} spans ${distinct} sections`);
        }
    });
});

// Per-style section profiles: within each style year, every exam allocates its
// 40 questions across sections identically (verified against the shipped data).
const STYLE_ROSTERS = {
    '2026 (40-min)': {
        ids: ['exam1', 'exam2', 'examp2', 'examp3', 'examp4', 'examp5', 'examp6',
            'examp7', 'examp8', 'examp9', 'examp10'],
        profile: { 'Phonetics': 4, 'Language use': 12, 'Word form': 6, 'Cloze': 6,
            'Reading': 6, 'Word bank': 2, 'Rewrite': 4 }
    },
    '2025 (90-min)': {
        ids: ['exam2025', 'examp11', 'examp12', 'examp13', 'examp14', 'examp15',
            'examp16', 'examp17', 'examp18', 'examp19', 'examp20'],
        profile: { 'Phonetics': 4, 'Language use': 12, 'Word form': 6, 'Cloze': 6,
            'Reading': 6, 'Dictionary': 2, 'Rewrite': 4 }
    },
    '2024 (90-min)': {
        ids: ['exam2024', 'examp21', 'examp22', 'examp23', 'examp24', 'examp25',
            'examp26', 'examp27', 'examp28', 'examp29', 'examp30'],
        profile: { 'Phonetics': 4, 'Language use': 12, 'Word form': 6, 'Cloze': 6,
            'Reading': 6, 'Rewrite': 6 }
    }
};

suite('gen: per-style section profiles', () => {
    test('the three style rosters partition all 33 exam ids', () => {
        const rostered = Object.values(STYLE_ROSTERS).flatMap(s => s.ids);
        assert.equal(new Set(rostered).size, rostered.length, 'an id appears in two rosters');
        assert.deepEqual(rostered.sort(), EXAMS.map(e => e.id).sort());
    });

    for (const [style, { ids, profile }] of Object.entries(STYLE_ROSTERS)) {
        test(`every ${style} exam allocates sections as ${JSON.stringify(profile)}`, () => {
            const expectedSorted = Object.entries(profile).sort();
            for (const id of ids) {
                const ex = EXAMS.find(e => e.id === id);
                assert.truthy(ex, `${id} missing from bank`);
                const counts = {};
                for (const q of ex.questions) counts[q.section] = (counts[q.section] || 0) + 1;
                assert.deepEqual(Object.entries(counts).sort(), expectedSorted,
                    `${id} section allocation is ${JSON.stringify(counts)}`);
            }
        });
    }
});

suite('gen: per-exam metadata & option hygiene', () => {
    for (const ex of EXAMS) {
        test(`${ex.id} metadata, sections and options are well-formed`, () => {
            // metadata
            assert.truthy(isTrimmedNonEmpty(ex.title), `${ex.id} title not a trimmed non-empty string`);
            assert.truthy(isTrimmedNonEmpty(ex.subtitle), `${ex.id} subtitle not a trimmed non-empty string`);
            assert.truthy(ex.durationMin === 40 || ex.durationMin === 90,
                `${ex.id} durationMin ${ex.durationMin} is neither 40 nor 90`);

            for (const q of ex.questions) {
                // section from the closed label set
                assert.contains(KNOWN_SECTIONS, q.section,
                    `${ex.id} Q${q.n} unknown section "${q.section}"`);

                // stem hygiene
                assert.truthy(isTrimmedNonEmpty(q.q), `${ex.id} Q${q.n} stem not a trimmed non-empty string`);

                // option hygiene (mcq + tf carry options; text does not)
                if (q.options !== undefined) {
                    for (const opt of q.options) {
                        assert.truthy(isTrimmedNonEmpty(opt),
                            `${ex.id} Q${q.n} option ${JSON.stringify(opt)} is empty or untrimmed`);
                        assert.truthy(opt !== q.q,
                            `${ex.id} Q${q.n} option equals the question stem`);
                    }
                    assert.equal(new Set(q.options).size, q.options.length,
                        `${ex.id} Q${q.n} has duplicate options`);
                }

                // tf questions use exactly the True/False pair, in that order
                if (q.type === 'tf') {
                    assert.deepEqual(q.options, ['True', 'False'],
                        `${ex.id} Q${q.n} tf options are ${JSON.stringify(q.options)}`);
                }
            }
        });
    }
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
