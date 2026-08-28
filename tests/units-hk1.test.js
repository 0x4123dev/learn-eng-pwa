// units-hk1.test.js — the HK1 word set on the Topics → Grade 4 tab.
//
// The promise this file guards: every single entry of the Wordlist printed on
// pages 78, 79 and 80 of "Tiếng Anh 4 – Global Success, Tập một" is somewhere
// in the five practice units. A word that quietly falls out of the bank is a
// word the child is never asked, and nothing on screen would say so.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { UNIT_WORDS } = require(path.join(__dirname, '..', 'js', 'units-data.js'));
const { UNIT_WORDS_HK1, UNIT_HK1_TITLES, UNIT_HK1_BOOKS } = require(path.join(__dirname, '..', 'js', 'units-hk1-data.js'));
const { UNIT_WORDS_HK2 } = require(path.join(__dirname, '..', 'js', 'units-hk2-data.js'));
const { UNIT_WORDS_POSTHK, UNIT_POSTHK_TITLES, UNIT_POSTHK_SOURCE } =
    require(path.join(__dirname, '..', 'js', 'units-posthk-data.js'));
global.UNIT_WORDS = UNIT_WORDS;
global.UNIT_WORDS_POSTHK = UNIT_WORDS_POSTHK;
global.UNIT_POSTHK_TITLES = UNIT_POSTHK_TITLES;
global.UNIT_POSTHK_SOURCE = UNIT_POSTHK_SOURCE;
global.UNIT_WORDS_HK2 = UNIT_WORDS_HK2;
global.UNIT_WORDS_HK1 = UNIT_WORDS_HK1;
global.UNIT_HK1_TITLES = UNIT_HK1_TITLES;
global.UNIT_HK1_BOOKS = UNIT_HK1_BOOKS;
const units = require(path.join(__dirname, '..', 'js', 'units.js'));

// The Wordlist, transcribed from the book. Bracketed hints in the book
// ("go (to bed)", "IT (information technology)") are dropped — the child types
// the word itself.
//
// The ten textbook units are merged two-by-two into five practice units,
// renumbered 1..5: unit 1 = books 1-2, unit 2 = books 3-4, and so on.
const WORDLIST_P78 = [
    'activity', 'America', 'April', 'art', 'August', 'Australia', 'Bangkok',
    'beach', 'because', 'birthday', 'Britain', 'building', 'campsite', 'can',
    'chips', 'city', 'computer room', 'countryside', 'December', 'English',
    'English teacher', 'February', 'forty-five', 'Friday', 'garden', 'get up',
    'go to bed', 'go to school', 'grape', 'hat', 'have breakfast',
    'history and geography', 'housework',
];
const WORDLIST_P79 = [
    'IT', 'jam', 'January', 'Japan', 'jump', 'last', 'lemonade', 'London',
    'Malaysia', 'March', 'maths', 'maths teacher', 'May', 'Monday', 'mountains',
    'music', 'November', "o'clock", 'October', 'outdoor', 'painter', 'party',
    'PE', 'play the guitar', 'play the piano', 'ride a bike', 'ride a horse',
    'roller skate', 'Saturday', 'school garden',
];
const WORDLIST_P80 = [
    'science', 'September', 'Singapore', 'sports day', 'stay at home', 'story',
    'study', 'subject', 'Sunday', 'Sydney', 'Thailand', 'thirty', 'Thursday',
    'today', 'Tokyo', 'town', 'Tuesday', 'Viet Nam', 'Vietnamese', 'village',
    'wash', 'Wednesday', 'weekday', 'weekend', 'when', 'why', 'yesterday',
];
const WORDLIST = [].concat(WORDLIST_P78, WORDLIST_P79, WORDLIST_P80);

const bankEn = () => new Set(UNIT_WORDS_HK1.map(w => w.en));

suite('units HK1: the book Wordlist is complete', () => {
    test('the transcription itself is the 90 entries the book prints', () => {
        assert.equal(WORDLIST_P78.length, 33, 'page 78');
        assert.equal(WORDLIST_P79.length, 30, 'page 79');
        assert.equal(WORDLIST_P80.length, 27, 'page 80');
        assert.equal(new Set(WORDLIST).size, 90, 'no duplicates in the transcription');
    });

    test('every Wordlist entry from pages 78-80 is in one of the units', () => {
        const have = bankEn();
        const missing = WORDLIST.filter(en => !have.has(en));
        assert.deepEqual(missing, [], `${missing.length} Wordlist words never taught`);
    });

    test('each Wordlist entry lands in exactly one place', () => {
        const wanted = new Set(WORDLIST);
        const seen = new Map();
        UNIT_WORDS_HK1.forEach(w => {
            if (!wanted.has(w.en)) return;
            seen.set(w.en, (seen.get(w.en) || 0) + 1);
        });
        const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([en]) => en);
        assert.deepEqual(dupes, [], 'a word taught twice is asked twice as often');
    });

    test('the extras beyond the Wordlist are only the ones the Book map teaches', () => {
        const wanted = new Set(WORDLIST);
        const extra = UNIT_WORDS_HK1.map(w => w.en).filter(en => !wanted.has(en)).sort();
        assert.deepEqual(extra, [
            'cook', 'draw', 'fifteen', 'juice', 'July', 'June', 'listen to music',
            'playground', 'swim', 'water',
        ].sort());
    });
});

suite('units HK1: bank shape', () => {
    test('five units, renumbered 1..5, each merging two consecutive book units', () => {
        assert.deepEqual(units.unitsList('hk1'), [1, 2, 3, 4, 5]);
        for (const u of units.unitsList('hk1')) {
            assert.truthy(units.unitTitle('hk1', u), `unit ${u} has no title`);
            assert.deepEqual(UNIT_HK1_BOOKS[u], [2 * u - 1, 2 * u],
                `unit ${u} must merge books ${2 * u - 1} and ${2 * u}`);
        }
        assert.equal(units.unitTitle('hk1', 1), 'My friends · Time and daily routines');
        assert.equal(units.unitTitle('hk1', 5), 'Our sports day · Our summer holidays');
    });

    test('a card still says which book units it covers', () => {
        // Renumbered cards would otherwise lose the pointer into the textbook.
        assert.equal(units.unitBooksLabel('hk1', 1), 'Bài 1-2');
        assert.equal(units.unitBooksLabel('hk1', 5), 'Bài 9-10');
        assert.equal(units.unitBooksLabel('pre', 4), '');
    });

    test('every word carries the textbook unit that teaches it', () => {
        const byBook = {};
        UNIT_WORDS_HK1.forEach(w => {
            assert.truthy(UNIT_HK1_BOOKS[w.unit] && UNIT_HK1_BOOKS[w.unit].includes(w.book),
                `${w.en}: book ${w.book} does not belong to unit ${w.unit}`);
            byBook[w.book] = (byBook[w.book] || 0) + 1;
        });
        // The Book map split, before the pairing — this is the fidelity check.
        assert.deepEqual(byBook, { 1: 8, 2: 9, 3: 13, 4: 13, 5: 12, 6: 9, 7: 10, 8: 8, 9: 8, 10: 10 });
    });

    test('per-unit counts are the merged pairs', () => {
        const expected = { 1: 17, 2: 26, 3: 21, 4: 18, 5: 18 };
        const counts = {};
        UNIT_WORDS_HK1.forEach(w => counts[w.unit] = (counts[w.unit] || 0) + 1);
        assert.deepEqual(counts, expected);
        assert.equal(UNIT_WORDS_HK1.length, 100);
    });

    test('every unit holds more words than one run asks, so runs stay varied', () => {
        // A run draws 10; merging the book's 8-13 word units was the point.
        for (const u of units.unitsList('hk1')) {
            assert.truthy(units._unitPool('hk1-' + u).length > 10, `unit ${u} is too thin`);
        }
    });

    test('every word has en, vi and a picture; en unique across the set', () => {
        const seen = new Set();
        for (const w of UNIT_WORDS_HK1) {
            assert.truthy(w.en && w.en.trim() === w.en, `bad en: "${w.en}"`);
            assert.truthy(w.vi && w.vi.length > 0, `${w.en}: missing vi`);
            assert.truthy(w.emoji && w.emoji.length > 0, `${w.en}: missing emoji`);
            assert.falsy(seen.has(w.en.toLowerCase()), `duplicate word: ${w.en}`);
            seen.add(w.en.toLowerCase());
        }
    });

    test('book spot-checks: the countries, the months and the cities sit where the book puts them', () => {
        const of = b => UNIT_WORDS_HK1.filter(w => w.book === b).map(w => w.en).sort();
        assert.deepEqual(of(1), ['America', 'Australia', 'Britain', 'Japan', 'Malaysia',
            'Singapore', 'Thailand', 'Viet Nam'].sort());
        // Birthday months in book Unit 4, sports-day months in book Unit 9 —
        // the book splits the year across the two units that need it.
        assert.deepEqual(of(4).filter(en => /^(Jan|Feb|Mar|Apr|May)/.test(en)),
            ['April', 'February', 'January', 'March', 'May']);
        assert.equal(of(9).length, 8, 'book Unit 9 = seven months + sports day');
        assert.truthy(of(10).includes('Bangkok') && of(10).includes('Tokyo'),
            'summer-holiday cities belong to book Unit 10');
        assert.truthy(of(8).includes('because') && of(8).includes('why'),
            'the reason words belong to book Unit 8');
    });

    test('every word grades correct against itself and rebuilds from its gap', () => {
        for (const w of UNIT_WORDS_HK1) {
            assert.truthy(units._unitAnswerCorrect(w.en, w.en), w.en);
            const g = units.buildUnitGap(w.en, 'full', () => 0.5);
            assert.equal(g.display.map(d => d.ch).join(''), w.en);
        }
    });
});

suite('units: the three word sets', () => {
    test('Pre, HK1, HK2 and Post-HK are the sets, and all four have words', () => {
        assert.deepEqual(units.UNIT_SETS.map(s => s.id), ['pre', 'hk1', 'hk2', 'posthk']);
        for (const set of units.UNIT_SETS) {
            assert.truthy(units.unitsBank(set.id).length > 0, `${set.id} has no words`);
            assert.falsy(set.soon, `${set.id} is still flagged "coming soon"`);
        }
    });

    test('the Pre set still holds the original picture dictionary', () => {
        assert.deepEqual(units.unitsList('pre'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        assert.equal(units.unitsBank('pre').length, UNIT_WORDS.length);
    });

    test('unitsAllWords spans every set, so an owed word always resolves', () => {
        assert.equal(units.unitsAllWords().length,
            UNIT_WORDS.length + UNIT_WORDS_HK1.length + UNIT_WORDS_HK2.length + UNIT_WORDS_POSTHK.length);
    });

    test('HK1 is the default set, and switching remembers itself', () => {
        global.appState = {};
        assert.equal(units.currentUnitSet(), 'hk1');
        units.switchUnitSet('pre');
        assert.equal(global.appState.unitsSet, 'pre');
        assert.equal(units.currentUnitSet(), 'pre');
        units.switchUnitSet('nonsense');
        assert.equal(units.currentUnitSet(), 'pre', 'an unknown set is ignored');
        units.switchUnitSet('hk1');
        assert.equal(units.currentUnitSet(), 'hk1');
        global.appState = undefined;
    });
});

suite('units: unit keys across sets', () => {
    test('Pre keeps its bare keys so old history still counts', () => {
        assert.equal(units._unitKey('pre', 4), 4);
        assert.equal(units._unitKey('pre', 'mix'), 'mix');
        assert.deepEqual(units._unitParse(4), { set: 'pre', unit: 4 });
        assert.deepEqual(units._unitParse('4'), { set: 'pre', unit: 4 });
        assert.deepEqual(units._unitParse('mix'), { set: 'pre', unit: 'mix' });
    });

    test('the newer sets prefix theirs, and parse back', () => {
        assert.equal(units._unitKey('hk1', 7), 'hk1-7');
        assert.equal(units._unitKey('hk1', 'mix'), 'hk1-mix');
        assert.deepEqual(units._unitParse('hk1-7'), { set: 'hk1', unit: 7 });
        assert.deepEqual(units._unitParse('hk1-mix'), { set: 'hk1', unit: 'mix' });
        assert.deepEqual(units._unitParse('hk2-2'), { set: 'hk2', unit: 2 });
    });

    test('a key picks the right pool — no bleed between Pre and HK1', () => {
        assert.equal(units._unitPool('hk1-mix').length, UNIT_WORDS_HK1.length);
        assert.equal(units._unitPool('mix').length, UNIT_WORDS.length);
        // Both sets have a Unit 1, and they are different words.
        const pre1 = units._unitPool(1).map(w => w.en);
        const hk1 = units._unitPool('hk1-1').map(w => w.en);
        assert.truthy(pre1.includes('doctor') && !hk1.includes('doctor'));
        assert.truthy(hk1.includes('Japan') && !pre1.includes('Japan'));
        // The merged card really does serve both of its book units.
        assert.truthy(hk1.includes('get up'), 'unit 1 must also carry book unit 2');
        assert.equal(units._unitPool('hk1-9').length, 0, 'HK1 stops at Unit 5');
        // HK2 is its own book entirely.
        assert.falsy(units._unitPool('hk2-1').some(w => hk1.includes(w.en)));
    });

    test('labels name the set, except Pre which keeps the old wording', () => {
        assert.equal(units._unitLabel(3), 'Unit 3');
        assert.equal(units._unitLabel('mix'), '🎲 Mix');
        assert.equal(units._unitLabel('hk1-3'), 'HK1 · Unit 3');
        assert.equal(units._unitLabel('hk1-mix'), 'HK1 · 🎲 Mix');
    });

    test('keys render as valid JavaScript literals in onclick handlers', () => {
        assert.equal(units._unitKeyArg(4), '4');
        assert.equal(units._unitKeyArg('mix'), "'mix'");
        assert.equal(units._unitKeyArg('hk1-mix'), "'hk1-mix'");
    });

    test('no Mix is ever mastered, in any set', () => {
        const perfects = (unit, n) => Array.from({ length: n }, () => ({ unit, score: 10, total: 10, date: 1 }));
        assert.falsy(units.isUnitMastered('mix', perfects('mix', 50)));
        assert.falsy(units.isUnitMastered('hk1-mix', perfects('hk1-mix', 50)));
        assert.truthy(units.isUnitMastered('hk1-3', perfects('hk1-3', 10)));
        // Pre Unit 3 and HK1 Unit 3 are separate ladders.
        assert.falsy(units.isUnitMastered(3, perfects('hk1-3', 10)));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
