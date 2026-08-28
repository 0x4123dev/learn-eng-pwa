// units-posthk.test.js — the Post-HK word set on the Topics → Grade 4 tab.
//
// After the semester exam the class moves on to two English-medium subject
// books, and this set is their end-of-book glossaries:
//
//   Global Maths 4   — pages 76-79,  76 terms
//   Global Science 4 — pages 74-79, 122 terms
//
// The promise this file guards is the same one the HK1 file guards: every
// entry the glossary prints is somewhere in the five practice units. A word
// that quietly falls out of the bank is a word the child is never asked, and
// nothing on screen would say so.
//
// One word is left out on purpose — "dong", the currency — and one is glossed
// differently from the book: "soft" is taught here as the everyday word rather
// than as the quiet half of the loud/soft pair in the sound unit. Both are
// pinned below, so a later "restore the glossary" edit has to be deliberate.
const { suite, test, assert } = require('./harness');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { UNIT_WORDS } = require(path.join(ROOT, 'js', 'units-data.js'));
const { UNIT_WORDS_HK1 } = require(path.join(ROOT, 'js', 'units-hk1-data.js'));
const { UNIT_WORDS_HK2 } = require(path.join(ROOT, 'js', 'units-hk2-data.js'));
const { UNIT_WORDS_POSTHK, UNIT_POSTHK_TITLES, UNIT_POSTHK_SOURCE } =
    require(path.join(ROOT, 'js', 'units-posthk-data.js'));
global.UNIT_WORDS = UNIT_WORDS;
global.UNIT_WORDS_HK1 = UNIT_WORDS_HK1;
global.UNIT_WORDS_HK2 = UNIT_WORDS_HK2;
global.UNIT_WORDS_POSTHK = UNIT_WORDS_POSTHK;
global.UNIT_POSTHK_TITLES = UNIT_POSTHK_TITLES;
global.UNIT_POSTHK_SOURCE = UNIT_POSTHK_SOURCE;
const units = require(path.join(ROOT, 'js', 'units.js'));

const fs = require('fs');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

suite('post-hk: the glossary arrived whole', () => {
    test('197 words: 75 from the maths book, 122 from the science book', () => {
        // 198 in the two glossaries; "dong" is deliberately not taught.
        assert.equal(UNIT_WORDS_POSTHK.length, 197);
        assert.falsy(UNIT_WORDS_POSTHK.some(w => w.en === 'dong'), 'the currency is back in the bank');
        const maths = UNIT_WORDS_POSTHK.filter(w => w.unit <= 2).length;
        const science = UNIT_WORDS_POSTHK.filter(w => w.unit >= 3).length;
        assert.equal(maths, 75, 'the Global Maths 4 glossary, less "dong"');
        assert.equal(science, 122, 'the Global Science 4 glossary');
    });

    test('no word is printed twice, and none is blank', () => {
        // Two glossaries were transcribed by hand from photographs of the page.
        // A word entered twice is a word the child meets twice and another
        // never; an empty field renders as a card with nothing on it.
        const seen = new Set(), dupes = [];
        for (const w of UNIT_WORDS_POSTHK) {
            const k = w.en.toLowerCase();
            if (seen.has(k)) dupes.push(w.en);
            seen.add(k);
        }
        assert.deepEqual(dupes, [], 'duplicated: ' + dupes.join(', '));
        for (const w of UNIT_WORDS_POSTHK) {
            assert.truthy(w.en && w.en.trim(), `${JSON.stringify(w)}: no English`);
            assert.truthy(w.vi && w.vi.trim(), `${w.en}: no Vietnamese`);
            assert.truthy(w.emoji && w.emoji.trim(), `${w.en}: no picture`);
            assert.truthy(Number.isInteger(w.unit) && w.unit >= 1 && w.unit <= 5, `${w.en}: unit ${w.unit}`);
        }
    });

    test('the words a glossary cannot do without are all here', () => {
        // A spot check across both books and every letter block, so a whole
        // page going missing in a future edit is loud.
        const have = new Set(UNIT_WORDS_POSTHK.map(w => w.en));
        const must = [
            // maths, first page to last
            'acute angle', 'average', 'bar chart', 'denominator', 'division of fractions',
            'divisor', 'equivalent fractions', 'hundred thousands', 'more (than)',
            '(the) most', 'numerator', 'parallelogram', 'quotient', 'right angle',
            'round', 'square millimetre', 'three-fourths', 'whole number',
            // science, first page to last
            'amount', 'button mushroom', 'carbon dioxide', 'come from', 'conduction',
            'food chain', 'food pyramid', 'herbivore', "make one's own food", 'mycelium',
            'omnivore', 'public transport', 'straw mushroom', 'sunlight', 'too much',
            'torch', 'vitamin', 'wooden',
        ];
        // "soft" is taught as the everyday word, not as the quiet half of the
        // book's loud/soft pair.
        assert.equal((UNIT_WORDS_POSTHK.find(w => w.en === 'soft') || {}).vi, 'mềm');
        const missing = must.filter(w => !have.has(w));
        assert.deepEqual(missing, [], 'missing from the bank: ' + missing.join(', '));
    });

    test('every unit is big enough to practise and small enough to finish', () => {
        const by = {};
        UNIT_WORDS_POSTHK.forEach(w => { by[w.unit] = (by[w.unit] || 0) + 1; });
        assert.deepEqual(Object.keys(by).sort(), ['1', '2', '3', '4', '5']);
        for (const u of [1, 2, 3, 4, 5]) {
            assert.inRange(by[u], 30, 50, `unit ${u} holds ${by[u]} words`);
        }
    });
});

suite('post-hk: the tab, the five units and the mix', () => {
    test('it is a set of its own, next to Pre, HK1 and HK2', () => {
        const ids = units.UNIT_SETS.map(s => s.id);
        assert.truthy(ids.includes('posthk'), `sets are ${ids.join(', ')}`);
        const set = units.UNIT_SETS.find(s => s.id === 'posthk');
        assert.truthy(set.label && set.name && set.sub, 'the tab needs a label, a name and a subtitle');
        assert.falsy(set.soon, 'it is not "coming soon" — the words are here');
    });

    test('the tab shows five units', () => {
        assert.deepEqual(units.unitsList('posthk'), [1, 2, 3, 4, 5]);
        assert.equal(units.unitsBank('posthk').length, 197);
    });

    test('each unit says which subject and which book it is', () => {
        for (const u of [1, 2, 3, 4, 5]) {
            const title = units.unitTitle('posthk', u);
            assert.truthy(title, `unit ${u} has no title`);
            assert.truthy(/^(Maths|Science) · /.test(title), `unit ${u}: "${title}" does not name its subject`);
            const label = units.unitBooksLabel('posthk', u);
            assert.truthy(/^Global (Maths|Science) 4$/.test(label),
                `unit ${u} card says "${label}" — it must name the book, since "Bài 3-4" points nowhere in a glossary`);
        }
    });

    test('the mix lesson draws on all five units at once', () => {
        // The tab gives every set a 🎲 Mix. Without the key parser knowing
        // "posthk", 'posthk-mix' fell through to the old picture-dictionary set
        // and the child practised the wrong book entirely.
        const src = read('js/units.js');
        assert.truthy(/\(hk1\|hk2\|posthk\)-\(mix\|/.test(src),
            'the unit-key parser does not recognise posthk keys');
        const pool = units._unitPool ? units._unitPool('posthk-mix') : null;
        if (pool) {
            assert.equal(pool.length, 197, 'the mix must reach every word');
            assert.equal(new Set(pool.map(w => w.unit)).size, 5, 'the mix must span all five units');
        }
    });

    test('the bank loads in the page and offline, before units.js needs it', () => {
        const index = read('index.html'), sw = read('sw.js');
        assert.truthy(index.includes('js/units-posthk-data.js'), 'the page never loads the bank');
        assert.truthy(index.indexOf('js/units-posthk-data.js') < index.indexOf('js/units.js'),
            'the bank must load before the tab that reads it');
        assert.truthy(sw.includes("'/js/units-posthk-data.js'"), 'the bank is missing from the offline cache');
    });
});

if (require.main === module) {
    require('./harness').runAll().then(code => process.exit(code));
}
