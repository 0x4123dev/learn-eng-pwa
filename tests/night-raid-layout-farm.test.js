// tests/night-raid-layout-farm.test.js — the castle layout now carries farm
// items and extra farm plots, and the combat/home-level maths ignores them.
const { suite, test, assert } = require('./harness');
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'night-raid-rules.js'));

const wall = (gx, gy) => ({ type: 'stone-wall', gx, gy, tier: 1 });

suite('layout: farm items live beside defenses', () => {
  test('itemById answers both catalogs', () => {
    assert.equal(R.itemById('stone-wall').price, 2000);
    assert.equal(R.itemById('tomato').days, 2);
    assert.equal(R.itemById('barn').footprint, 2);
    assert.equal(R.itemById('nope'), null);
    assert.equal(R.footprintFor('barn'), 2);
    assert.equal(R.footprintFor('tomato'), 1);
  });
  test('a crop keeps type, gx, gy, uid, day, at — and nothing combat-shaped', () => {
    const layout = R.normalizeLayout({ cells: [{ type: 'tomato', gx: 1, gy: 1, uid: 'c-abcdefgh', day: 12, at: '2026-09-04', tier: 3, lane: 2 }] });
    assert.deepEqual(layout.cells, [{ type: 'tomato', gx: 1, gy: 1, uid: 'c-abcdefgh', day: 12, at: '2026-09-04' }]);
    assert.equal(layout.gridVersion, 3);
  });
  test('a crop with a bad date gets opts.today; without opts it gets no date', () => {
    const cell = { type: 'rice', gx: 0, gy: 0, uid: 'c-abcdefgh', day: 2, at: 'yesterday' };
    assert.equal(R.normalizeLayout({ cells: [cell] }, { dayCount: 5, today: '2026-09-04' }).cells[0].at, '2026-09-04');
    assert.equal(R.normalizeLayout({ cells: [cell] }).cells[0].at, undefined);
  });
  test('unknown ids are dropped; farm items may not overlap defenses or each other', () => {
    const layout = R.normalizeLayout({ cells: [wall(0, 0), { type: 'well', gx: 0, gy: 0 }, { type: 'barn', gx: 0, gy: 5 }, { type: 'fence', gx: 1, gy: 6 }, { type: 'dragon', gx: 7, gy: 7 }] });
    const at = (gx, gy) => layout.cells.find(c => c.gx === gx && c.gy === gy);
    assert.equal(at(0, 0).type, 'stone-wall');
    assert.truthy(layout.cells.some(c => c.type === 'well'), 'the well is moved to free ground, not dropped');
    assert.truthy(layout.cells.find(c => c.type === 'well').gx + layout.cells.find(c => c.type === 'well').gy > 0);
    assert.falsy(layout.cells.some(c => c.type === 'dragon'));
    const barn = layout.cells.find(c => c.type === 'barn'), fence = layout.cells.find(c => c.type === 'fence');
    assert.falsy(fence.gx >= barn.gx && fence.gx < barn.gx + 2 && fence.gy >= barn.gy && fence.gy < barn.gy + 2, 'the fence was placed inside the barn');
  });
});

suite('layout: extra farm plots', () => {
  test('at most three farms, each a 6x6 board of farm items only', () => {
    const farms = [
      { cells: [{ type: 'pumpkin', gx: 5, gy: 5, uid: 'c-11111111', day: 1, at: '2026-09-01' }, { type: 'stone-wall', gx: 0, gy: 0 }, { type: 'rice-field', gx: 2, gy: 2 }, { type: 'barn', gx: 9, gy: 9 }] },
      { cells: [] }, { cells: [] }, { cells: [{ type: 'well', gx: 0, gy: 0 }] },
    ];
    const layout = R.normalizeLayout({ cells: [], farms });
    assert.equal(layout.farms.length, 3, 'the fourth farm is cut');
    const f0 = layout.farms[0].cells;
    assert.falsy(f0.some(c => c.type === 'stone-wall'), 'no defenses in a farm');
    assert.falsy(f0.some(c => c.type === 'rice-field'), 'no old producers in a farm');
    assert.truthy(f0.some(c => c.type === 'pumpkin'));
    const barn = f0.find(c => c.type === 'barn');
    assert.truthy(barn && barn.gx <= 4 && barn.gy <= 4, 'a 2x2 barn is pulled inside the 6x6 board');
  });
  test('a layout without farms normalizes to farms: []', () => {
    assert.deepEqual(R.normalizeLayout({ cells: [] }).farms, []);
    assert.deepEqual(R.normalizeLayout(undefined).farms, []);
  });
});

suite('layout: producers', () => {
  test('barracks carry lastDay; a legacy readyAt converts only when the server passes dayCount', () => {
    const legacy = { type: 'training-barracks', gx: 0, gy: 0, uid: 'p-abcdefgh', readyAt: 5678 };
    const noOpts = R.normalizeLayout({ cells: [legacy] }).cells[0];
    assert.equal(noOpts.lastDay, undefined);
    assert.equal(noOpts.readyAt, 5678, 'kept for the server to convert');
    const server = R.normalizeLayout({ cells: [legacy] }, { dayCount: 9, today: '2026-09-04' }).cells[0];
    assert.equal(server.lastDay, 9);
    assert.equal(server.readyAt, undefined);
    const stamped = R.normalizeLayout({ cells: [{ type: 'training-barracks', gx: 0, gy: 0, uid: 'p-abcdefgh', lastDay: 4, readyAt: 1 }] }, { dayCount: 9 }).cells[0];
    assert.equal(stamped.lastDay, 4, 'an existing lastDay wins over dayCount');
    assert.equal(stamped.readyAt, undefined);
  });
  test('fields keep their 24h readyAt untouched', () => {
    const cell = R.normalizeLayout({ cells: [{ type: 'rice-field', gx: 0, gy: 0, uid: 'p-abcdefgh', readyAt: 1234 }] }, { dayCount: 9, today: '2026-09-04' }).cells[0];
    assert.equal(cell.readyAt, 1234);
    assert.equal(cell.lastDay, undefined);
  });
  test('a child who already owns four rice fields keeps all four; ten barracks are allowed', () => {
    const cells = [];
    for (let i = 0; i < 4; i++) cells.push({ type: 'rice-field', gx: i * 2, gy: 0, uid: 'rice-id-' + i, readyAt: 1 });
    for (let i = 0; i < 11; i++) cells.push({ type: 'training-barracks', gx: (i % 6) * 2, gy: 2 + Math.floor(i / 6) * 2, uid: 'barracks-' + i, readyAt: 1 });
    const layout = R.normalizeLayout({ cells });
    assert.equal(layout.cells.filter(c => c.type === 'rice-field').length, 4);
    assert.equal(layout.cells.filter(c => c.type === 'training-barracks').length, 10);
    assert.equal(R.defenseById('rice-field').buyMax, 1);
    assert.equal(R.defenseById('training-barracks').perTaskDay, true);
  });
});

suite('layout: combat and home level ignore the farm', () => {
  const base = { cells: [wall(0, 6), wall(1, 6)], soldiers: 2 };
  const farmy = { cells: base.cells.concat([{ type: 'farmhouse', gx: 8, gy: 8 }, { type: 'pumpkin', gx: 2, gy: 2, uid: 'c-11111111', day: 0, at: '2026-09-01' }]), soldiers: 2,
    farms: [{ cells: [{ type: 'windmill', gx: 0, gy: 0 }] }] };
  test('homeLevel and combatPower are unchanged by farm items', () => {
    assert.equal(R.homeLevel(farmy, 10), R.homeLevel(base, 10));
    assert.deepEqual(R.combatPower(farmy, 10, 2, 0), R.combatPower(base, 10, 2, 0));
  });
  test('createState does not throw on a layout with crops and buildings', () => {
    const target = Object.assign(R.trainingTarget(2), { layout: R.normalizeLayout(farmy) });
    let state = null;
    assert.truthy((() => { state = R.createState(target, 7); return true; })(), 'createState must not throw');
    assert.truthy(state && typeof state === 'object');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
