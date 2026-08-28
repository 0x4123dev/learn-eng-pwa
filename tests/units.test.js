// units.test.js — the picture-dictionary Unit practice: data integrity,
// gap-building rules and lenient grading.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { UNIT_WORDS } = require(path.join(__dirname, '..', 'js', 'units-data.js'));
global.UNIT_WORDS = UNIT_WORDS;
const units = require(path.join(__dirname, '..', 'js', 'units.js'));

suite('units: word bank', () => {
    test('covers units 1..12 with a non-trivial word list', () => {
        assert.deepEqual(units.unitsList('pre'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        assert.truthy(UNIT_WORDS.length >= 140, `only ${UNIT_WORDS.length} words`);
    });

    test('every word has en, vi and an emoji/picture; en unique within its unit', () => {
        const seen = new Set();
        for (const w of UNIT_WORDS) {
            assert.truthy(w.en && w.en.trim() === w.en, `bad en: "${w.en}"`);
            assert.truthy(w.vi && w.vi.length > 0, `${w.en}: missing vi`);
            assert.truthy(w.emoji && w.emoji.length > 0, `${w.en}: missing emoji`);
            const key = w.unit + '|' + w.en.toLowerCase();
            assert.falsy(seen.has(key), `duplicate in unit ${w.unit}: ${w.en}`);
            seen.add(key);
        }
    });

    test('every unit has at least 6 words', () => {
        for (const u of units.unitsList('pre')) {
            const n = UNIT_WORDS.filter(w => w.unit === u).length;
            assert.truthy(n >= 6, `unit ${u} has only ${n}`);
        }
    });

    test('per-unit word counts match the textbook picture dictionary', () => {
        // Derived from the book pages (column-major flow, verified vs photos).
        const expected = { 1: 7, 2: 11, 3: 27, 4: 11, 5: 15, 6: 15, 7: 15, 8: 14, 9: 13, 10: 12, 11: 15, 12: 14 };
        const counts = {};
        UNIT_WORDS.forEach(w => counts[w.unit] = (counts[w.unit] || 0) + 1);
        assert.deepEqual(counts, expected);
        assert.equal(UNIT_WORDS.length, 169);
    });

    test('book spot-checks: Unit 2 has its 11 places/animals, Unit 10 repeats farm', () => {
        const u2 = UNIT_WORDS.filter(w => w.unit === 2).map(w => w.en).sort();
        assert.deepEqual(u2, ['airport', 'bank', 'farm', 'fire station', 'hospital', 'nest',
            'octopus', 'office', 'parrot', 'police station', 'store'].sort());
        assert.truthy(UNIT_WORDS.some(w => w.unit === 10 && w.en === 'farm'), 'unit 10 -ar phonics farm');
        assert.truthy(UNIT_WORDS.some(w => w.unit === 11 && w.en === 'nurse'), 'nurse belongs to unit 11');
        assert.truthy(UNIT_WORDS.some(w => w.unit === 6 && w.en === 'yogurt'), 'yogurt belongs to unit 6');
        assert.equal(UNIT_WORDS.filter(w => w.unit === 1).length, 7, 'unit 1 = 7 jobs only');
    });
});

suite('units: gap engine', () => {
    const fixedRand = () => 0.5;

    test('mode 1/2/3 blanks that many letters (capped) and keeps first letter', () => {
        for (const mode of [1, 2, 3]) {
            const g = units.buildUnitGap('student', mode, fixedRand);
            assert.equal(g.nBlanks, mode);
            assert.falsy(g.display[0].blank, 'first letter must stay visible');
        }
    });

    test('mode full blanks every letter', () => {
        const g = units.buildUnitGap('chicken', 'full', fixedRand);
        assert.equal(g.nBlanks, 7);
        assert.truthy(g.display.every(d => d.blank));
    });

    test('non-letters (spaces, dots, hyphens) are never blanked', () => {
        for (const en of ['police officer', 'P.E.', 'twenty-one', 'go to bed']) {
            const g = units.buildUnitGap(en, 'full', fixedRand);
            for (const d of g.display) {
                if (!/[a-zA-Z]/.test(d.ch)) assert.falsy(d.blank, `${en}: blanked "${d.ch}"`);
            }
        }
    });

    test('display always reconstructs the original word', () => {
        for (const w of UNIT_WORDS.slice(0, 40)) {
            const g = units.buildUnitGap(w.en, 2, fixedRand);
            assert.equal(g.display.map(d => d.ch).join(''), w.en);
        }
    });

    test('short words still get at least 1 blank and never blank everything in numeric modes', () => {
        const g = units.buildUnitGap('you', 3, fixedRand);
        assert.inRange(g.nBlanks, 1, 2);   // "you" has 3 letters, first stays visible
    });

    test('pickUnitGapMode only returns 4, 5 or full — at least 4 blanks', () => {
        for (let i = 0; i < 20; i++) {
            const m = units.pickUnitGapMode(() => i / 20);
            assert.truthy([4, 5, 'full'].includes(m), String(m));
        }
    });
});

suite('units: grading', () => {
    test('exact + case/space-insensitive answers pass', () => {
        assert.truthy(units._unitAnswerCorrect('student', 'student'));
        assert.truthy(units._unitAnswerCorrect('  STUDENT ', 'student'));
        assert.truthy(units._unitAnswerCorrect('Police  Officer', 'police officer'));
    });

    test('dots and hyphens are optional (PE ≡ P.E., twenty one ≡ twenty-one)', () => {
        assert.truthy(units._unitAnswerCorrect('pe', 'P.E.'));
        assert.truthy(units._unitAnswerCorrect('twenty one', 'twenty-one'));
        assert.truthy(units._unitAnswerCorrect('yo yo', 'yo-yo'));
    });

    test('wrong or blank answers fail', () => {
        assert.falsy(units._unitAnswerCorrect('studant', 'student'));
        assert.falsy(units._unitAnswerCorrect('', 'student'));
        assert.falsy(units._unitAnswerCorrect('   ', 'student'));
    });

    test('every bank word grades correct against itself', () => {
        for (const w of UNIT_WORDS) {
            assert.truthy(units._unitAnswerCorrect(w.en, w.en), w.en);
        }
    });
});

suite('units: mix mode, labels and voice', () => {
    test('_unitPool("mix") draws from the whole bank; numbers stay per-unit', () => {
        assert.equal(units._unitPool('mix').length, UNIT_WORDS.length);
        assert.equal(units._unitPool(2).length, 11);
        assert.truthy(units._unitPool(2).every(w => w.unit === 2));
    });

    test('_unitLabel names mix and numeric units', () => {
        assert.equal(units._unitLabel('mix'), '🎲 Mix');
        assert.equal(units._unitLabel(3), 'Unit 3');
    });

    test('_unitSpeak is a safe no-op without the Web Speech API', () => {
        units._unitSpeak('student');   // sandbox has no speechSynthesis — must not throw
        assert.truthy(true);
    });

    test('_unitSpeakAttr escapes quotes for inline onclick handlers', () => {
        assert.equal(units._unitSpeakAttr("it's"), "it\\'s");
        assert.equal(units._unitSpeakAttr('a"b'), 'a&quot;b');
    });
});

suite('units: adaptive difficulty ladder', () => {
    test('level maps to mode: 0→1 blank, 1→2, 2→3, 3→full', () => {
        assert.equal(units.modeForUnitLevel(0), 1);
        assert.equal(units.modeForUnitLevel(1), 2);
        assert.equal(units.modeForUnitLevel(2), 3);
        assert.equal(units.modeForUnitLevel(3), 'full');
    });

    test('correct answers climb the ladder, mistakes drop it (clamped 0..3)', () => {
        global.appState = {};
        assert.equal(units._unitWordLevel('doctor'), 0, 'new word starts at 0');
        units._unitBumpWordLevel('doctor', true);
        units._unitBumpWordLevel('doctor', true);
        assert.equal(units._unitWordLevel('doctor'), 2);
        units._unitBumpWordLevel('doctor', false);
        assert.equal(units._unitWordLevel('doctor'), 1);
        for (let i = 0; i < 6; i++) units._unitBumpWordLevel('doctor', true);
        assert.equal(units._unitWordLevel('doctor'), 3, 'caps at 3');
        for (let i = 0; i < 6; i++) units._unitBumpWordLevel('doctor', false);
        assert.equal(units._unitWordLevel('doctor'), 0, 'floors at 0');
        global.appState = undefined;
    });

    test('level lookup is case-insensitive per word', () => {
        global.appState = {};
        units._unitBumpWordLevel('Chicken', true);
        assert.equal(units._unitWordLevel('chicken'), 1);
        assert.equal(units._unitWordLevel('CHICKEN'), 1);
        global.appState = undefined;
    });
});

if (require.main === module) {
    const harness = require('./harness');
    harness.runAll().then(code => process.exit(code));
}
