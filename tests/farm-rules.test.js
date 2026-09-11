// tests/farm-rules.test.js — the farm's pure rules: growth by task-days, wilt,
// sprite names, value. No DOM, no clock: dayCount and ctx are passed in.
const { suite, test, assert } = require('./harness');
const path = require('path');
const F = require(path.join(__dirname, '..', 'js', 'farm-rules.js'));

suite('farm rules: catalog', () => {
  test('six crops, ordered by days, priced as the spec table', () => {
    assert.deepEqual(F.CROPS.map(c => [c.id, c.days, c.price, c.yield]), [
      ['lettuce', 1, 3, 40], ['tomato', 2, 5, 90], ['carrot', 3, 8, 150],
      ['rice', 4, 10, 225], ['rose', 6, 15, 400], ['pumpkin', 8, 20, 600],
    ]);
    for (const c of F.CROPS) assert.equal(c.kind, 'crop');
  });
  test('eight farm buildings with footprints and prices', () => {
    assert.deepEqual(F.FARM_BUILDINGS.map(b => [b.id, b.price, b.footprint]), [
      ['fence', 300, 1], ['fruit-tree', 800, 1], ['well', 1000, 1], ['chicken-coop', 3000, 2],
      ['barn', 5000, 2], ['windmill', 8000, 2], ['cow-shed', 12000, 2], ['farmhouse', 20000, 2],
    ]);
    for (const b of F.FARM_BUILDINGS) assert.equal(b.kind, 'farm');
  });
  test('the extra farm plot is 10000 xu, 6x6, at most three', () => {
    assert.deepEqual([F.FARM_PLOT.price, F.FARM_PLOT.size, F.FARM_PLOT.max], [10000, 6, 3]);
    assert.deepEqual(F.FARM_PLOT_STYLES.map(s => [s.id, s.asset]), [
      ['stone', 'farm-plot-stone'], ['hedge', 'farm-plot-hedge'], ['clover', 'farm-plot-clover'],
    ]);
    assert.equal(F.plotStyle('unknown').id, 'stone', 'old or invalid layouts use the first approved style');
  });
  test('byId finds crops and buildings, nothing else', () => {
    assert.equal(F.byId('tomato').days, 2);
    assert.equal(F.byId('barn').price, 5000);
    assert.equal(F.byId('stone-wall'), null);
    assert.equal(F.byId(''), null);
    assert.truthy(Object.isFrozen(F.CROPS) && Object.isFrozen(F.CROPS[0]));
  });
});

suite('farm rules: growth counts task-days, not hours', () => {
  test('a crop planted at day 12 is ripe at day 12 + days', () => {
    const cell = { type: 'carrot', day: 12 };
    assert.deepEqual(F.progress(cell, 12), { g: 0, days: 3, ripe: false, left: 3 });
    assert.deepEqual(F.progress(cell, 14), { g: 2, days: 3, ripe: false, left: 1 });
    assert.deepEqual(F.progress(cell, 15), { g: 3, days: 3, ripe: true, left: 0 });
    assert.deepEqual(F.progress(cell, 40), { g: 3, days: 3, ripe: true, left: 0 }, 'g is capped at days');
  });
  test('lettuce planted this morning is ripe the moment today is done', () => {
    assert.truthy(F.progress({ type: 'lettuce', day: 5 }, 6).ripe);
  });
  test('a missing or negative day reads as zero; non-crops have no progress', () => {
    assert.equal(F.progress({ type: 'pumpkin' }, 3).g, 3);
    assert.equal(F.progress({ type: 'pumpkin', day: -4 }, 3).g, 3);
    assert.equal(F.progress({ type: 'well' }, 3), null);
  });
});

suite('farm rules: wilt', () => {
  const ctx = (doneYesterday, doneToday) => ({ today: '2026-09-04', doneYesterday, doneToday });
  const planted = (at) => ({ type: 'tomato', day: 1, at });
  test('planted before today, yesterday missed, today not done → wilted', () => {
    assert.truthy(F.isWilted(planted('2026-09-03'), ctx(false, false)));
    assert.truthy(F.isWilted(planted('2026-08-20'), ctx(false, false)));
  });
  test('done today revives; done yesterday keeps it fresh this morning', () => {
    assert.falsy(F.isWilted(planted('2026-09-03'), ctx(false, true)));
    assert.falsy(F.isWilted(planted('2026-09-03'), ctx(true, false)));
  });
  test('planted today never wilts today', () => {
    assert.falsy(F.isWilted(planted('2026-09-04'), ctx(false, false)));
  });
  test('no ctx, bad dates or non-crops are never wilted', () => {
    assert.falsy(F.isWilted(planted('2026-09-03'), null));
    assert.falsy(F.isWilted(planted(''), ctx(false, false)));
    assert.falsy(F.isWilted({ type: 'well', at: '2026-09-01' }, ctx(false, false)));
  });
});

suite('farm rules: sprites', () => {
  const fresh = { today: '2026-09-04', doneYesterday: true, doneToday: false };
  const wilt = { today: '2026-09-04', doneYesterday: false, doneToday: false };
  test('one file per growth day, the shared sprout at day zero', () => {
    const c = { type: 'pumpkin', day: 10, at: '2026-09-01' };
    assert.equal(F.spriteFor(c, 10, fresh), 'img/farm/sprout.webp');
    assert.equal(F.spriteFor(c, 11, fresh), 'img/farm/pumpkin-day1.webp');
    assert.equal(F.spriteFor(c, 18, fresh), 'img/farm/pumpkin-day8.webp');
    assert.equal(F.spriteFor(c, 30, fresh), 'img/farm/pumpkin-day8.webp', 'ripe waits, no day9');
  });
  test('wilted: shared wilted sprout, then young below half, old from half up', () => {
    const c = { type: 'pumpkin', day: 10, at: '2026-09-01' };
    assert.equal(F.spriteFor(c, 10, wilt), 'img/farm/sprout-wilted.webp');
    assert.equal(F.spriteFor(c, 13, wilt), 'img/farm/pumpkin-wilted-young.webp');
    assert.equal(F.spriteFor(c, 14, wilt), 'img/farm/pumpkin-wilted-old.webp');
    assert.equal(F.spriteFor({ type: 'lettuce', day: 0, at: '2026-09-01' }, 1, wilt), 'img/farm/lettuce-wilted-old.webp');
  });
  test('farm buildings draw their own file; unknown types draw nothing', () => {
    assert.equal(F.spriteFor({ type: 'barn' }, 0, null), 'img/farm/barn.webp');
    assert.equal(F.spriteFor({ type: 'stone-wall' }, 0, null), null);
  });
  test('spriteNames lists every file spriteFor can ask for: 46 names', () => {
    const names = F.spriteNames();
    assert.equal(names.length, 46);
    assert.equal(new Set(names).size, 46, 'no duplicates');
    for (const n of ['sprout', 'sprout-wilted', 'lettuce-day1', 'rose-day6', 'pumpkin-wilted-old', 'farmhouse']) assert.contains(names, n);
  });
});

suite('farm rules: value and barracks', () => {
  test('farmValue sums farm buildings across the castle grid and every extra farm', () => {
    const layout = { cells: [{ type: 'well' }, { type: 'stone-wall' }, { type: 'tomato' }],
      farms: [{ cells: [{ type: 'barn' }] }, { cells: [{ type: 'fence' }, { type: 'fence' }] }] };
    assert.equal(F.farmValue(layout), 1000 + 5000 + 600);
    assert.equal(F.farmValue({}), 0);
  });
  test('barracks require 1, 2, 3, 4, then 5 task-days for every later soldier', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 5, 99].map(soldierCycles => F.barracksGoal({ soldierCycles })), [1, 2, 3, 4, 5, 5, 5]);
    assert.deepEqual(F.barracksProgress({ lastDay: 10, soldierCycles: 2 }, 12), { done: 2, goal: 3, left: 1, ready: false, soldier: 3 });
    assert.deepEqual(F.barracksProgress({ lastDay: 10, soldierCycles: 2 }, 13), { done: 3, goal: 3, left: 0, ready: true, soldier: 3 });
    assert.truthy(F.barracksReady({ lastDay: 5, soldierCycles: 0 }, 6), 'first soldier needs one completed day');
    assert.falsy(F.barracksReady({ lastDay: 5, soldierCycles: 1 }, 6), 'second soldier needs two completed days');
    assert.truthy(F.barracksReady({ lastDay: 5, soldierCycles: 1 }, 7));
    assert.falsy(F.barracksReady({ readyAt: 123 }, 6), 'a legacy cell without lastDay waits for the server');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
