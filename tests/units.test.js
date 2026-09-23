// units.test.js — the picture-dictionary Unit practice: data integrity,
// gap-building rules and lenient grading.
const { suite, test, assert } = require('./harness');
const path = require('path');

// The bank is js/word-data.js (lazy in the app; loaded eagerly here): three
// Career Paths books, fifteen units each.
const bank = require(path.join(__dirname, '..', 'js', 'word-data.js'));
global.UNIT_WORDS_PR1 = bank.UNIT_WORDS_PR1;
global.UNIT_WORDS_PR2 = bank.UNIT_WORDS_PR2;
global.UNIT_WORDS_PR3 = bank.UNIT_WORDS_PR3;
global.UNIT_PR_TITLES = bank.UNIT_PR_TITLES;
global.UNIT_PR_BOOKS = bank.UNIT_PR_BOOKS;
const units = require(path.join(__dirname, '..', 'js', 'units.js'));
const SETS = ['pr1', 'pr2', 'pr3'];
const UNIT_WORDS = units.unitsAllWords();

suite('units: word bank', () => {
    test('every book covers its practice units with a non-trivial word list', () => {
        // Book 1: its first eight units, one practice unit each, ~30 words.
        // Books 2 and 3: fifteen units merged into seven.
        for (const set of SETS) {
            const want = set === 'pr1' ? [1, 2, 3, 4, 5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7];
            assert.deepEqual(units.unitsList(set), want, set);
            assert.truthy(units.unitsBank(set).length >= 140, `${set}: only ${units.unitsBank(set).length} words`);
        }
        assert.equal(UNIT_WORDS.length, 610, 'Book 1 rebuilt at ~30 words a unit, plus the Vocabulary columns of Books 2 and 3');
    });

    test('every word has en, vi and an emoji/picture; en unique within its unit', () => {
        for (const set of SETS) {
            const seen = new Set();
            for (const w of units.unitsBank(set)) {
                assert.truthy(w.en && w.en.trim() === w.en, `bad en: "${w.en}"`);
                assert.truthy(w.vi && w.vi.length > 0, `${w.en}: missing vi`);
                assert.truthy(w.emoji && w.emoji.length > 0, `${w.en}: missing emoji`);
                const key = w.unit + '|' + w.en.toLowerCase();
                assert.falsy(seen.has(key), `duplicate in ${set} unit ${w.unit}: ${w.en}`);
                seen.add(key);
            }
        }
    });

    test('every unit has at least 6 words', () => {
        for (const set of SETS) {
            for (const u of units.unitsList(set)) {
                const n = units._unitPool(units._unitKey(set, u)).length;
                assert.truthy(n >= 6, `${set} unit ${u} has only ${n}`);
            }
        }
    });

    test('every unit carries its Scope and Sequence title', () => {
        for (const set of SETS) {
            for (const u of units.unitsList(set)) {
                assert.truthy(units.unitTitle(set, u), `${set} unit ${u} has no title`);
            }
        }
        assert.equal(units.unitTitle('pr1', 1), 'The Role of Public Relations', 'a Book 1 practice unit is one book unit');
        assert.equal(units.unitTitle('pr2', 1), 'Skills of a Public Relations Professional · Strategic Planning', 'a merged practice unit names both book units');
        assert.equal(units.unitBooksLabel('pr1', 1), 'Bài 1');
        assert.equal(units.unitBooksLabel('pr2', 1), 'Bài 1-2');
        assert.equal(units.unitBooksLabel('pr3', 7), 'Bài 13-15');
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

    test('Mix numeric modes hide the first letter too', () => {
        const g = units.buildUnitGap('playground', 6, () => 0.5, true);
        assert.truthy(g.display[0].blank, 'the first letter must not remain as a Mix hint');
        assert.equal(g.nBlanks, 6);
        const teaching = units.buildUnitGap('playground', 6, () => 0.5);
        assert.falsy(teaching.display[0].blank, 'individual Units still teach with the first-letter hint');
    });

    test('pickUnitGapMode only returns 4, 5 or full — at least 4 blanks', () => {
        for (let i = 0; i < 20; i++) {
            const m = units.pickUnitGapMode(() => i / 20);
            assert.truthy([4, 5, 'full'].includes(m), String(m));
        }
    });

    test('Mix raises recall to 6, 7, 8 or the full word only, in every book', () => {
        for (const set of SETS) {
            const seen = new Set();
            for (let i = 0; i < 50; i++) seen.add(units.pickUnitGapModeForKey(set + '-mix', () => i / 50));
            assert.deepEqual([...seen], [6, 7, 8, 'full'], set);
            assert.equal(units.pickUnitGapModeForKey(set + '-3', () => 0), 4,
                'individual units keep the gentler teaching level');
        }
        assert.equal(units.pickUnitGapModeForKey('pr1-mix', () => 0, 'Monday'), 'full',
            'a short word must not keep its first-letter hint under a nominal 6-letter mode');
        assert.equal(units.pickUnitGapModeForKey('pr1-mix', () => 0, 'playground'), 6);
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
    test('_unitPool("<set>-mix") draws from the whole book; numbers stay per-unit', () => {
        for (const set of SETS) {
            assert.equal(units._unitPool(set + '-mix').length, units.unitsBank(set).length, set);
            const u2 = units._unitPool(set + '-2');
            assert.truthy(u2.length >= 6, set + ' unit 2');
            assert.truthy(u2.every(w => w.unit === 2 && w.set === set));
        }
    });

    test('_unitLabel names the book, then mix or the unit number', () => {
        assert.equal(units._unitLabel('pr1-mix'), 'Book 1 · 🎲 Mix');
        assert.equal(units._unitLabel('pr2-3'), 'Book 2 · Unit 3');
        assert.equal(units._unitLabel('mix'), '🎲 Mix', 'a row written before the sets is still readable');
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
