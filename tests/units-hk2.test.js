// units-hk2.test.js — the HK2 word set on the Topics → Grade 4 tab.
//
// Same promise as tests/units-hk1.test.js, for the other half of the year:
// every entry of the Wordlist printed on pages 74 and 75 of "Tiếng Anh 4 –
// Global Success, Tập hai" is in the five practice units. A word that quietly
// falls out of the bank is a word the child is never asked, and nothing on
// screen would say so.
const { suite, test, assert } = require('./harness');
const path = require('path');

const { UNIT_WORDS } = require(path.join(__dirname, '..', 'js', 'units-data.js'));
const { UNIT_WORDS_HK1, UNIT_HK1_BOOKS } = require(path.join(__dirname, '..', 'js', 'units-hk1-data.js'));
const { UNIT_WORDS_HK2, UNIT_HK2_TITLES, UNIT_HK2_BOOKS } = require(path.join(__dirname, '..', 'js', 'units-hk2-data.js'));
global.UNIT_WORDS = UNIT_WORDS;
global.UNIT_WORDS_HK1 = UNIT_WORDS_HK1;
global.UNIT_HK1_BOOKS = UNIT_HK1_BOOKS;
global.UNIT_WORDS_HK2 = UNIT_WORDS_HK2;
global.UNIT_HK2_TITLES = UNIT_HK2_TITLES;
global.UNIT_HK2_BOOKS = UNIT_HK2_BOOKS;
global.UNIT_WORDS_POSTHK = require(path.join(__dirname, '..', 'js', 'units-posthk-data.js')).UNIT_WORDS_POSTHK;
const units = require(path.join(__dirname, '..', 'js', 'units.js'));

// The Wordlist, transcribed from the book. Bracketed hints in the book
// ("clean (the floor)", "wash (the clothes / the dishes)") are dropped to the
// form the child actually types.
//
// Book units 11..20 are merged two-by-two into five practice units, renumbered
// 1..5: unit 1 = books 11-12, unit 2 = books 13-14, and so on.
const WORDLIST_P74 = [
    'actor', 'afternoon', 'around', 'bakery', 'beautifully', 'behind', 'between',
    'big', 'bookshop', 'build a campfire', 'burrow', 'busy', 'centre', 'cinema',
    'clean the floor', 'cloudy', 'cooking', 'crocodile', 'dance around the campfire',
    'den', 'do the housework', 'do yoga', 'dong', 'email', 'evening', 'eye', 'face',
    'factory', 'farm', 'farmer', 'film', 'food stall', 'get to', 'gift shop',
    'giraffe', 'go straight', 'hair', 'help with the cooking', 'hippo', 'hospital',
    'in', 'left', 'like', 'lion', 'live', 'long', 'loudly', 'me', 'meal',
];
const WORDLIST_P75 = [
    'merrily', 'morning', 'near', 'noisy', 'noon', 'nurse', 'nursing home',
    'office worker', 'opposite', 'photo', 'play card games', 'play tennis',
    'play tug of war', 'policeman', 'put up a tent', 'quickly', 'quiet', 'rainy',
    'right', 'road', 'road sign', 'roar', 'round', 'shopping centre', 'short',
    'sing songs', 'skirt', 'slim', 'sports centre', 'stop', 'street', 'sunny',
    'supermarket', 'swimming pool', 'take a photo', 'tall', 'television',
    'tell a story', 'tent', 'thousand', 'T-shirt', 'turn', 'turn left',
    'turn right', 'turn round', 'wash', 'watch', 'water park', 'weather', 'web',
    'windy',
];
const WORDLIST = [].concat(WORDLIST_P74, WORDLIST_P75);

suite('units HK2: the book Wordlist is complete', () => {
    test('the transcription itself is the 100 entries the book prints', () => {
        assert.equal(WORDLIST_P74.length, 49, 'page 74');
        assert.equal(WORDLIST_P75.length, 51, 'page 75');
        assert.equal(new Set(WORDLIST).size, 100, 'no duplicates in the transcription');
    });

    test('every Wordlist entry from pages 74-75 is in one of the units', () => {
        const have = new Set(UNIT_WORDS_HK2.map(w => w.en));
        const missing = WORDLIST.filter(en => !have.has(en));
        assert.deepEqual(missing, [], `${missing.length} Wordlist words never taught`);
    });

    test('HK2 is exactly the Wordlist — nothing invented, nothing doubled', () => {
        const wanted = new Set(WORDLIST);
        const extra = UNIT_WORDS_HK2.map(w => w.en).filter(en => !wanted.has(en)).sort();
        assert.deepEqual(extra, [], 'HK2 needs no filler: the Wordlist already covers every unit');
        assert.equal(UNIT_WORDS_HK2.length, 100);
    });
});

suite('units HK2: bank shape', () => {
    test('five units, renumbered 1..5, each merging two book units from 11..20', () => {
        assert.deepEqual(units.unitsList('hk2'), [1, 2, 3, 4, 5]);
        for (const u of units.unitsList('hk2')) {
            assert.truthy(units.unitTitle('hk2', u), `unit ${u} has no title`);
            assert.deepEqual(UNIT_HK2_BOOKS[u], [2 * u + 9, 2 * u + 10],
                `unit ${u} must merge books ${2 * u + 9} and ${2 * u + 10}`);
        }
        assert.equal(units.unitTitle('hk2', 1), 'My home · Jobs');
        assert.equal(units.unitTitle('hk2', 5), 'The animal world · At summer camp');
    });

    test('a card says which book units it covers', () => {
        assert.equal(units.unitBooksLabel('hk2', 1), 'Bài 11-12');
        assert.equal(units.unitBooksLabel('hk2', 5), 'Bài 19-20');
        // And the two semesters never claim the same lessons.
        assert.equal(units.unitBooksLabel('hk1', 1), 'Bài 1-2');
    });

    test('every word carries the textbook unit that teaches it', () => {
        const byBook = {};
        UNIT_WORDS_HK2.forEach(w => {
            assert.truthy(UNIT_HK2_BOOKS[w.unit] && UNIT_HK2_BOOKS[w.unit].includes(w.book),
                `${w.en}: book ${w.book} does not belong to unit ${w.unit}`);
            byBook[w.book] = (byBook[w.book] || 0) + 1;
        });
        // The Book map split, before the pairing — this is the fidelity check.
        assert.deepEqual(byBook,
            { 11: 8, 12: 9, 13: 9, 14: 10, 15: 10, 16: 11, 17: 10, 18: 9, 19: 12, 20: 12 });
    });

    test('per-unit counts are the merged pairs', () => {
        const expected = { 1: 17, 2: 19, 3: 21, 4: 19, 5: 24 };
        const counts = {};
        UNIT_WORDS_HK2.forEach(w => counts[w.unit] = (counts[w.unit] || 0) + 1);
        assert.deepEqual(counts, expected);
    });

    test('every unit holds more words than one run asks, so runs stay varied', () => {
        for (const u of units.unitsList('hk2')) {
            assert.truthy(units._unitPool('hk2-' + u).length > 10, `unit ${u} is too thin`);
        }
    });

    test('every word has en, vi and a picture; en unique across the set', () => {
        const seen = new Set();
        for (const w of UNIT_WORDS_HK2) {
            assert.truthy(w.en && w.en.trim() === w.en, `bad en: "${w.en}"`);
            assert.truthy(w.vi && w.vi.length > 0, `${w.en}: missing vi`);
            assert.truthy(w.emoji && w.emoji.length > 0, `${w.en}: missing emoji`);
            assert.falsy(seen.has(w.en.toLowerCase()), `duplicate word: ${w.en}`);
            seen.add(w.en.toLowerCase());
        }
    });

    test('book spot-checks: jobs, directions and the animals sit where the book puts them', () => {
        const of = b => UNIT_WORDS_HK2.filter(w => w.book === b).map(w => w.en).sort();
        assert.deepEqual(of(12), ['actor', 'factory', 'farm', 'farmer', 'hospital',
            'nurse', 'nursing home', 'office worker', 'policeman'].sort());
        assert.deepEqual(of(19), ['beautifully', 'burrow', 'crocodile', 'den', 'giraffe',
            'hippo', 'lion', 'loudly', 'merrily', 'quickly', 'roar', 'web'].sort());
        // Verified on the lesson pages, not guessed from the alphabet:
        // "Do you want to go to the water park with me?" is Unit 16 Lesson 2,
        // and the supermarket is one of that lesson's four places.
        assert.truthy(of(16).includes('me') && of(16).includes('supermarket'));
        // "I do the housework… I watch TV" is Unit 14, not Unit 15's weekend list.
        assert.truthy(of(14).includes('do the housework') && of(14).includes('watch'));
        assert.truthy(of(15).includes('television') && of(15).includes('film'));
    });

    test('every word grades correct against itself and rebuilds from its gap', () => {
        for (const w of UNIT_WORDS_HK2) {
            assert.truthy(units._unitAnswerCorrect(w.en, w.en), w.en);
            const g = units.buildUnitGap(w.en, 'full', () => 0.5);
            assert.equal(g.display.map(d => d.ch).join(''), w.en);
        }
    });
});

suite('units HK2: it plugs into the same machinery', () => {
    test('HK2 is a real set now, not a "coming soon" card', () => {
        const hk2 = units.UNIT_SETS.find(s => s.id === 'hk2');
        assert.truthy(hk2, 'hk2 must be one of the sets');
        assert.falsy(hk2.soon, 'the placeholder flag must be gone');
        assert.equal(units.unitsBank('hk2').length, 100);
    });

    test('its keys parse, and its pools never bleed into another set', () => {
        assert.deepEqual(units._unitParse('hk2-4'), { set: 'hk2', unit: 4 });
        assert.equal(units._unitPool('hk2-mix').length, UNIT_WORDS_HK2.length);
        assert.equal(units._unitPool('hk2-9').length, 0, 'HK2 stops at Unit 5');
        const hk2u1 = units._unitPool('hk2-1').map(w => w.en);
        const hk1u1 = units._unitPool('hk1-1').map(w => w.en);
        assert.truthy(hk2u1.includes('actor') && !hk1u1.includes('actor'));
        assert.truthy(hk1u1.includes('Japan') && !hk2u1.includes('Japan'));
        // The merged card really does serve both of its book units.
        assert.truthy(hk2u1.includes('road') && hk2u1.includes('hospital'));
    });

    test('labels and mastery keys follow the same rules as HK1', () => {
        assert.equal(units._unitLabel('hk2-4'), 'HK2 · Unit 4');
        assert.equal(units._unitLabel('hk2-mix'), 'HK2 · 🎲 Mix');
        const perfects = (unit, n) => Array.from({ length: n }, () => ({ unit, score: 10, total: 10, date: 1 }));
        assert.falsy(units.isUnitMastered('hk2-mix', perfects('hk2-mix', 50)));
        assert.truthy(units.isUnitMastered('hk2-3', perfects('hk2-3', 10)));
        assert.falsy(units.isUnitMastered('hk1-3', perfects('hk2-3', 10)),
            'the two semesters keep separate mastery ladders');
    });

    test('unitsAllWords now spans every set', () => {
        const { UNIT_WORDS_POSTHK } = require(path.join(__dirname, '..', 'js', 'units-posthk-data.js'));
        assert.equal(units.unitsAllWords().length,
            UNIT_WORDS.length + UNIT_WORDS_HK1.length + UNIT_WORDS_HK2.length + UNIT_WORDS_POSTHK.length);
        // A word owed from HK2 must resolve, even though the debt stores only
        // the English.
        const bank = units.unitsAllWords();
        assert.truthy(bank.find(w => w.en === 'play tug of war'));
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
