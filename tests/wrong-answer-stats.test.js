// wrong-answer-stats.test.js — "which ones do I keep getting wrong, and how
// often?" for the Book practice (js/units.js). It used to record only
// score/total, so the history could say 6/10 forever without ever saying
// WHICH six.
const { suite, test, assert } = require('./harness');
const path = require('path');

const bank = require(path.join(__dirname, '..', 'js', 'word-data.js'));
global.UNIT_WORDS_PR1 = bank.UNIT_WORDS_PR1;
global.UNIT_WORDS_PR2 = bank.UNIT_WORDS_PR2;
global.UNIT_WORDS_PR3 = bank.UNIT_WORDS_PR3;
global.UNIT_PR_TITLES = bank.UNIT_PR_TITLES;
global.currentUser = 'tester';
global.saveUserData = () => {};
global.document = { getElementById: () => null, querySelectorAll: () => [] };

// The owed-questions engine, because the panels step aside while a debt is
// open — without it loaded, retryCount() is absent and that rule cannot be
// exercised at all.
Object.assign(global, require(path.join(__dirname, '..', 'js', 'retrydrill.js')));

const units = require(path.join(__dirname, '..', 'js', 'units.js'));

const W = bank.UNIT_WORDS_PR1.slice(0, 3);            // three real words

suite('Book practice: words to review', () => {
    test('a finished practice records WHICH words were missed, not just how many', () => {
        // The aggregate can only exist if the session carries the list.
        const fs = require('fs');
        const src = fs.readFileSync(path.join(__dirname, '..', 'js', 'units.js'), 'utf8');
        assert.truthy(/unitsHistory\.unshift\(\{[^}]*wrong:/.test(src),
            'the session must store the missed words');
    });

    test('misses are counted across every past session, hardest first', () => {
        global.appState = { unitsHistory: [
            { unit: 'pr1-1', score: 8, total: 10, date: 3, wrong: [W[0].en, W[1].en] },
            { unit: 'pr1-1', score: 9, total: 10, date: 2, wrong: [W[0].en] },
            { unit: 'pr1-2', score: 7, total: 10, date: 1, wrong: [W[0].en, W[2].en] },
        ] };
        const agg = units.unitsWrongAggregate();
        assert.equal(agg.length, 3);
        assert.equal(agg[0].w.en, W[0].en, 'the most-missed word comes first');
        assert.equal(agg[0].misses, 3);
        assert.equal(agg.find(x => x.w.en === W[1].en).misses, 1);
        assert.equal(agg.find(x => x.w.en === W[2].en).misses, 1);
    });

    test('a word that is no longer in the bank is dropped, not rendered blank', () => {
        global.appState = { unitsHistory: [{ unit: 'pr1-1', score: 9, total: 10, date: 1, wrong: ['zznotaword'] }] };
        assert.deepEqual(units.unitsWrongAggregate(), []);
    });

    test('sessions saved before this feature simply contribute nothing', () => {
        global.appState = { unitsHistory: [{ unit: 'pr1-1', score: 6, total: 10, date: 1 }] };
        assert.deepEqual(units.unitsWrongAggregate(), []);
        assert.equal(units.renderUnitsWrongPanelHTML(), '', 'no panel rather than an empty one');
    });

    test('the panel names each word, its meaning and its miss count', () => {
        global.appState = { unitsHistory: [
            { unit: 'pr1-1', score: 8, total: 10, date: 2, wrong: [W[0].en] },
            { unit: 'pr1-1', score: 8, total: 10, date: 1, wrong: [W[0].en] },
        ] };
        const html = units.renderUnitsWrongPanelHTML();
        assert.truthy(html.includes('Từ hay sai'), 'panel title missing');
        assert.truthy(html.includes(W[0].en), 'the word itself must be shown');
        assert.truthy(html.includes(W[0].vi), 'the Vietnamese meaning must be shown');
        assert.truthy(html.includes('2×'), 'the miss count must be shown');
    });

    test('the panel steps aside while words are owed', () => {
        // The drill is the way to clear them; a second "practise your mistakes"
        // route next to it just sends a child round in circles.
        global.appState = { unitsHistory: [{ unit: 'pr1-1', score: 9, total: 10, date: 1, wrong: [W[0].en] }] };
        assert.truthy(units.renderUnitsWrongPanelHTML().includes('Từ hay sai'), 'shown with no debt');
        const real = global.retryCount;
        global.retryCount = (k) => (k === 'word' ? 1 : 0);
        try {
            assert.equal(units.renderUnitsWrongPanelHTML(), '', 'hidden while a word is owed');
        } finally { global.retryCount = real; }
    });

    test('misses are counted across the three books together', () => {
        // One history, three books: the panel on any book lists every missed
        // word the child owns, wherever it was met.
        const b2 = bank.UNIT_WORDS_PR2[0];
        global.appState = { unitsHistory: [
            { unit: 'pr1-1', score: 9, total: 10, date: 2, wrong: [W[0].en] },
            { unit: 'pr2-1', score: 9, total: 10, date: 1, wrong: [b2.en] },
        ] };
        const agg = units.unitsWrongAggregate();
        assert.deepEqual(agg.map(x => x.w.en).sort(), [W[0].en, b2.en].sort());
    });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
