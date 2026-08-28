// tests/gen-grammar-lessons-deep.test.js — Deep structural characterization
// of GRAMMAR_LESSONS (js/grammar-lessons.js) and the getGrammarLesson /
// getGrammarLessonsForUnit lookup helpers.
//
// Characterized facts (as of v3.78.0):
//   - 13 units (unit1..unit13, in order), 57 lessons total
//   - units 1-11 have 4 lessons each (a-d); unit12 "Tenses" has 7 (12a-12g);
//     unit13 "Exam" has 6 (13a-13f)
//   - every lesson has a non-empty `grammar` array of theory blocks
//   - getGrammarLesson returns the SAME object reference stored in
//     GRAMMAR_LESSONS, and null (not undefined) for any unknown id,
//     missing args, or case-mismatched unit/lesson id
//   - getGrammarLessonsForUnit returns a fresh [] for unknown units and the
//     live lessons array reference for known ones

const { suite, test, assert } = require('./harness');
const { loadAppCode } = require('./setup');

const env = loadAppCode();

const EXPECTED_UNIT_IDS = [
    'unit1', 'unit2', 'unit3', 'unit4', 'unit5', 'unit6', 'unit7',
    'unit8', 'unit9', 'unit10', 'unit11', 'unit12', 'unit13'
];

const EXPECTED_LESSON_COUNTS = {
    unit1: 4, unit2: 4, unit3: 4, unit4: 4, unit5: 4, unit6: 4,
    unit7: 4, unit8: 4, unit9: 4, unit10: 4, unit11: 4,
    unit12: 7, unit13: 6
};

// ============================================================================
// EXPORTS + TOP-LEVEL SHAPE
// ============================================================================
suite('gen: grammar lessons exports', () => {
    test('sandbox exposes GRAMMAR_LESSONS as an array', () => {
        assert.truthy(Array.isArray(env.GRAMMAR_LESSONS), 'GRAMMAR_LESSONS not exported as array');
    });

    test('sandbox exposes getGrammarLesson and getGrammarLessonsForUnit as functions', () => {
        assert.equal(typeof env.getGrammarLesson, 'function');
        assert.equal(typeof env.getGrammarLessonsForUnit, 'function');
    });

    test('unitIds are exactly unit1..unit13 in order', () => {
        assert.deepEqual(env.GRAMMAR_LESSONS.map(u => u.unitId), EXPECTED_UNIT_IDS);
    });

    test('total lesson count across all units is 57', () => {
        const total = env.GRAMMAR_LESSONS.reduce((s, u) => s + u.lessons.length, 0);
        assert.equal(total, 57);
    });

    test('lesson ids are globally unique and strictly sequential (unitNum + a,b,c,…)', () => {
        const all = [];
        for (const u of env.GRAMMAR_LESSONS) {
            const num = u.unitId.replace('unit', '');
            u.lessons.forEach((l, i) => {
                all.push(l.id);
                // ids are derived positionally: 1a,1b,1c,1d / 12a..12g / 13a..13f
                assert.equal(l.id, num + String.fromCharCode(97 + i),
                    `${u.unitId} lessons[${i}] id "${l.id}" breaks the sequential pattern`);
            });
        }
        assert.equal(new Set(all).size, all.length, 'duplicate lesson id across units');
        assert.equal(all.length, 57);
    });
});

// ============================================================================
// UNIT-LEVEL METADATA (title / icon / color / intro / iCanGoals)
// ============================================================================
suite('gen: unit metadata', () => {
    test('unit titles are exactly the 13 known course units in order', () => {
        assert.deepEqual(env.GRAMMAR_LESSONS.map(u => u.title), [
            'People', 'Possessions', 'Places', 'Free time', 'Food',
            'Past lives', 'Journeys', 'Appearance', 'Entertainment',
            'Learning', 'Tourism', 'Tenses', 'Exam'
        ]);
        assert.equal(new Set(env.GRAMMAR_LESSONS.map(u => u.title)).size, 13,
            'unit titles must be unique');
    });

    test('every unit has a non-empty icon, intro, and a #RRGGBB color', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            assert.truthy(typeof u.icon === 'string' && u.icon.length > 0,
                `${u.unitId} icon missing`);
            assert.truthy(typeof u.intro === 'string' && u.intro.trim().length > 0,
                `${u.unitId} intro missing`);
            assert.truthy(/^#[0-9A-Fa-f]{6}$/.test(u.color),
                `${u.unitId} color "${u.color}" is not a 6-digit hex color`);
        }
    });

    test('every unit has iCanGoals as a non-empty array of non-empty strings', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            assert.truthy(Array.isArray(u.iCanGoals) && u.iCanGoals.length > 0,
                `${u.unitId} iCanGoals missing or empty`);
            for (let i = 0; i < u.iCanGoals.length; i++) {
                assert.truthy(typeof u.iCanGoals[i] === 'string' && u.iCanGoals[i].trim().length > 0,
                    `${u.unitId} iCanGoals[${i}] not a non-empty string`);
            }
        }
    });
});

// ============================================================================
// PER-UNIT: LESSON IDS, TITLES, GRAMMAR BLOCK ARRAYS
// ============================================================================
for (const unit of env.GRAMMAR_LESSONS) {
    suite(`gen: lessons structure ${unit.unitId}`, () => {
        test(`${unit.unitId} has ${EXPECTED_LESSON_COUNTS[unit.unitId]} lessons with unique ids and non-empty titles`, () => {
            assert.truthy(Array.isArray(unit.lessons), `${unit.unitId} lessons not an array`);
            assert.equal(unit.lessons.length, EXPECTED_LESSON_COUNTS[unit.unitId],
                `${unit.unitId} unexpected lesson count`);
            const ids = unit.lessons.map(l => l.id);
            assert.equal(new Set(ids).size, ids.length,
                `${unit.unitId} duplicate lesson ids: ${ids.join(',')}`);
            for (const l of unit.lessons) {
                assert.truthy(typeof l.id === 'string' && l.id.length > 0,
                    `${unit.unitId} lesson id empty`);
                assert.truthy(typeof l.title === 'string' && l.title.trim().length > 0,
                    `${unit.unitId} ${l.id} title empty`);
            }
        });

        test(`${unit.unitId} every lesson has a non-empty grammar blocks array with titled blocks`, () => {
            for (const l of unit.lessons) {
                assert.truthy(Array.isArray(l.grammar),
                    `${l.id} grammar not an array`);
                assert.truthy(l.grammar.length > 0,
                    `${l.id} grammar blocks array is empty`);
                for (let i = 0; i < l.grammar.length; i++) {
                    const g = l.grammar[i];
                    assert.truthy(g && typeof g === 'object',
                        `${l.id} grammar[${i}] not an object`);
                    assert.truthy(typeof g.title === 'string' && g.title.length > 0,
                        `${l.id} grammar[${i}] missing title`);
                }
            }
        });
    });
}

// ============================================================================
// PER-UNIT: getGrammarLesson ROUND-TRIP FOR EVERY LESSON
// ============================================================================
for (const unit of env.GRAMMAR_LESSONS) {
    suite(`gen: lesson round-trip ${unit.unitId}`, () => {
        test(`getGrammarLesson round-trips all ${unit.lessons.length} lessons of ${unit.unitId} (same object reference)`, () => {
            for (const l of unit.lessons) {
                const got = env.getGrammarLesson(unit.unitId, l.id);
                assert.truthy(got, `getGrammarLesson(${unit.unitId}, ${l.id}) returned ${got}`);
                // Strict !== identity: the helper hands back the stored object,
                // not a copy (so any .id/.title re-check would be redundant).
                assert.equal(got, l,
                    `getGrammarLesson(${unit.unitId}, ${l.id}) did not return the stored lesson object`);
            }
            // Companion helper hands back the live lessons array itself.
            const list = env.getGrammarLessonsForUnit(unit.unitId);
            assert.equal(list, unit.lessons,
                `${unit.unitId}: getGrammarLessonsForUnit did not return the exact lessons array reference`);
        });
    });
}

// ============================================================================
// UNKNOWN IDS — CHARACTERIZATION
// ============================================================================
suite('gen: unknown lesson lookups (characterization)', () => {
    test('getGrammarLesson returns null (not undefined) for unknown unit or lesson ids', () => {
        assert.equal(env.getGrammarLesson('unit99', '1a'), null);
        assert.equal(env.getGrammarLesson('unit1', 'zz'), null);
        assert.equal(env.getGrammarLesson('unit13', '13z'), null);
    });

    test('getGrammarLesson with missing or null arguments returns null', () => {
        assert.equal(env.getGrammarLesson(), null);
        assert.equal(env.getGrammarLesson(null, null), null);
        assert.equal(env.getGrammarLesson('unit1'), null);
    });

    test('lookups are case-sensitive — "Unit1" and "1A" both miss', () => {
        assert.equal(env.getGrammarLesson('Unit1', '1a'), null);
        assert.equal(env.getGrammarLesson('unit1', '1A'), null);
    });

    test('a lesson id is only reachable through its own unit', () => {
        assert.equal(env.getGrammarLesson('unit1', '12a'), null);
        assert.equal(env.getGrammarLesson('unit12', '1a'), null);
        assert.equal(env.getGrammarLesson('unit13', '11a'), null);
    });

    test('getGrammarLessonsForUnit returns a fresh empty array for unknown/missing unit ids', () => {
        const a = env.getGrammarLessonsForUnit('nope');
        assert.truthy(Array.isArray(a), 'expected an array');
        assert.equal(a.length, 0);
        // fresh [] each call, not a shared sentinel
        const b = env.getGrammarLessonsForUnit('nope');
        assert.falsy(a === b, 'unknown-unit lookups share the same array instance');
        assert.deepEqual(env.getGrammarLessonsForUnit(), []);
    });

    test('whitespace-padded ids miss — lookup does no trimming', () => {
        assert.equal(env.getGrammarLesson('unit1 ', '1a'), null);
        assert.equal(env.getGrammarLesson('unit1', ' 1a'), null);
        assert.equal(env.getGrammarLesson('unit1', '1a '), null);
        assert.equal(env.getGrammarLessonsForUnit('UNIT1').length, 0,
            'getGrammarLessonsForUnit must be case-sensitive too');
    });

    test('non-string unit args (number/null) fall through to the empty/null path', () => {
        assert.equal(env.getGrammarLessonsForUnit(1).length, 0,
            'numeric 1 must not match "unit1"');
        assert.deepEqual(env.getGrammarLessonsForUnit(null), []);
        assert.equal(env.getGrammarLesson(1, '1a'), null);
        assert.equal(env.getGrammarLesson(12, '12a'), null);
    });

    test('known-unit list lookups are stable — the same live array every call', () => {
        for (const u of env.GRAMMAR_LESSONS) {
            const first = env.getGrammarLessonsForUnit(u.unitId);
            const second = env.getGrammarLessonsForUnit(u.unitId);
            assert.equal(first, second,
                `${u.unitId}: repeated lookups returned different array instances`);
            assert.equal(first, u.lessons,
                `${u.unitId}: lookup does not return the stored lessons array`);
        }
    });
});

// ============================================================================
// CONTENT DISTRIBUTION — which lessons carry vocabulary / pronunciation
// (aggregate counts; per-lesson field formats live in grammar-per-lesson.test.js)
// ============================================================================
suite('gen: lesson content distribution', () => {
    test('exactly 49 lessons have vocabulary and 28 have pronunciation', () => {
        let vocab = 0, pron = 0;
        for (const u of env.GRAMMAR_LESSONS) {
            for (const l of u.lessons) {
                if (l.vocabulary !== undefined) vocab++;
                if (l.pronunciation !== undefined) pron++;
            }
        }
        assert.equal(vocab, 49, `expected 49 lessons with vocabulary, got ${vocab}`);
        assert.equal(pron, 28, `expected 28 lessons with pronunciation, got ${pron}`);
    });

    test('the vocabulary-less lessons are exactly 11c and all of unit12', () => {
        const missing = [];
        for (const u of env.GRAMMAR_LESSONS) {
            for (const l of u.lessons) {
                if (l.vocabulary === undefined) missing.push(l.id);
            }
        }
        assert.deepEqual(missing,
            ['11c', '12a', '12b', '12c', '12d', '12e', '12f', '12g']);
    });

    test('the 28 pronunciation-bearing lessons are exactly the known id list', () => {
        const has = [];
        for (const u of env.GRAMMAR_LESSONS) {
            for (const l of u.lessons) {
                if (l.pronunciation !== undefined) has.push(l.id);
            }
        }
        assert.deepEqual(has, [
            '1a', '1b', '1d', '2b', '2c', '2d', '3b', '3c',
            '4a', '4c', '4d', '5a', '5d', '6a', '6d', '7a',
            '8a', '8b', '8d', '9a', '9d', '10b', '10d',
            '11a', '11d', '13a', '13b', '13e'
        ]);
    });

    test('unit12 (Tenses) is grammar-only — no vocabulary or pronunciation blocks', () => {
        const u12 = env.getGrammarLessonsForUnit('unit12');
        assert.equal(u12.length, 7);
        for (const l of u12) {
            assert.falsy('vocabulary' in l, `${l.id} unexpectedly has vocabulary`);
            assert.falsy('pronunciation' in l, `${l.id} unexpectedly has pronunciation`);
            assert.truthy(l.grammar.length > 0, `${l.id} grammar empty`);
        }
    });

    test('total grammar theory blocks across all 57 lessons is 99', () => {
        let blocks = 0;
        for (const u of env.GRAMMAR_LESSONS) {
            for (const l of u.lessons) blocks += l.grammar.length;
        }
        assert.equal(blocks, 99);
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
