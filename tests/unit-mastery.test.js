// unit-mastery.test.js — retiring a Grade 4 unit after ten perfect runs.
//
// The point is to stop a child grinding the one unit they already know: once
// it is mastered the card locks, and the units they have NOT mastered become
// the only way forward.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const unitsSrc = fs.readFileSync(path.join(root, 'js', 'units.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(root, 'css', 'styles.css'), 'utf8');

// Pull the pure mastery helpers out of the file — no DOM, no data bank needed.
const ctx = { appState: { unitsHistory: [] } };
vm.createContext(ctx);
vm.runInContext(
    unitsSrc.slice(unitsSrc.indexOf('const UNIT_MASTERY_TARGET'), unitsSrc.indexOf('function renderUnitsBar'))
    + '\nthis.UNIT_MASTERY_TARGET = UNIT_MASTERY_TARGET;'
    + '\nthis.unitPerfectCount = unitPerfectCount; this.isUnitMastered = isUnitMastered;', ctx);
const { UNIT_MASTERY_TARGET, unitPerfectCount, isUnitMastered } = ctx;

const run = (unit, score, total) => ({ unit, score, total, date: 1 });
const perfects = (unit, n) => Array.from({ length: n }, () => run(unit, 10, 10));

suite('unit mastery: counting perfect runs', () => {
    test('the target is ten', () => {
        assert.equal(UNIT_MASTERY_TARGET, 10);
    });

    test('only a full score counts', () => {
        const h = [run(1, 10, 10), run(1, 9, 10), run(1, 8, 10), run(1, 10, 10)];
        assert.equal(unitPerfectCount(1, h), 2, 'nine out of ten is not mastery');
    });

    test('a perfect run on a shorter set still counts', () => {
        // A unit with fewer than ten words yields a shorter quiz.
        assert.equal(unitPerfectCount(3, [run(3, 6, 6), run(3, 5, 6)]), 1);
    });

    test('counts are per unit and never bleed across', () => {
        const h = perfects(1, 10).concat(perfects(2, 3));
        assert.equal(unitPerfectCount(1, h), 10);
        assert.equal(unitPerfectCount(2, h), 3);
        assert.equal(unitPerfectCount(7, h), 0);
    });

    test('a numeric unit and its string form are the same unit', () => {
        // History rows have been written by more than one code path over time.
        const h = [run('4', 10, 10), run(4, 10, 10)];
        assert.equal(unitPerfectCount(4, h), 2);
        assert.equal(unitPerfectCount('4', h), 2);
    });

    test('junk history rows never crash or miscount', () => {
        const h = [null, undefined, {}, { unit: 1 }, { unit: 1, score: 10, total: 0 }, run(1, 10, 10)];
        assert.equal(unitPerfectCount(1, h), 1, 'a zero-length run is not a perfect run');
    });
});

suite('unit mastery: retiring a unit', () => {
    test('nine perfect runs is not enough; the tenth retires it', () => {
        assert.falsy(isUnitMastered(1, perfects(1, 9)));
        assert.truthy(isUnitMastered(1, perfects(1, 10)));
    });

    test('extra runs beyond ten keep it mastered', () => {
        assert.truthy(isUnitMastered(1, perfects(1, 25)));
    });

    test('imperfect runs do not count toward retirement', () => {
        const h = Array.from({ length: 40 }, () => run(1, 9, 10));
        assert.falsy(isUnitMastered(1, h), '40 near-misses must not retire a unit');
    });

    // Mix draws from every unit, so retiring it would leave a fully-mastered
    // child with nothing left to practise.
    test('Mix can never be mastered', () => {
        assert.falsy(isUnitMastered('mix', perfects('mix', 100)));
    });

    test('an empty history masters nothing', () => {
        assert.falsy(isUnitMastered(1, []));
        assert.equal(unitPerfectCount(1, []), 0);
    });
});

suite('unit mastery: the rule is enforced, not just displayed', () => {
    test('a mastered card is disabled in the markup', () => {
        const render = unitsSrc.slice(unitsSrc.indexOf('function renderUnitsBar'), unitsSrc.indexOf('// ---- celebration'));
        assert.truthy(render.includes('isUnitMastered(u)'), 'the card must know');
        assert.truthy(render.includes("mastered ? 'disabled aria-disabled=\"true\"' : ''"),
            'a retired unit must not be clickable, and must say so to a screen reader');
    });

    // A disabled attribute alone is a suggestion: a stale DOM node or a queued
    // tap could still fire the handler.
    test('starting a mastered unit is refused in code', () => {
        const fn = unitsSrc.slice(unitsSrc.indexOf('function startUnitPractice'));
        const head = fn.slice(0, 400);
        assert.truthy(head.includes('isUnitMastered(unit)'), 'the guard must be in the handler too');
        assert.truthy(head.indexOf('isUnitMastered') < head.indexOf('_unitPool'),
            'the check must come before any work is done');
    });

    test('progress toward mastery is shown while it is still reachable', () => {
        const render = unitsSrc.slice(unitsSrc.indexOf('function renderUnitsBar'), unitsSrc.indexOf('// ---- celebration'));
        assert.truthy(render.includes('g4-mastery'), 'a child should see how close they are');
        assert.truthy(render.includes('lần 10/10'), 'and what the goal actually is');
    });

    test('a mastered unit reads as an achievement, not a removal', () => {
        const render = unitsSrc.slice(unitsSrc.indexOf('function renderUnitsBar'), unitsSrc.indexOf('// ---- celebration'));
        assert.truthy(render.includes('👑'), 'it should feel earned');
        assert.truthy(render.includes('Thành thạo'));
        assert.truthy(cssSrc.includes('.g4-card.mastered'), 'and look different');
        assert.truthy(cssSrc.includes('.g4-mastery i'), 'the progress bar needs styles');
    });
});

if (require.main === module) {
    const harness = require('./harness');
    process.exit(harness.runAll());
}
