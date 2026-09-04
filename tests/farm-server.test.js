// tests/farm-server.test.js — the farm's server half, EXECUTED against a real
// SQLite database through the Pages harness: day counting, wilt context, the
// home GET/PUT stamps, harvesting, and the Daily Task page summary.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const DAY = 86400000;
const gmt7 = ms => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
const TODAY = gmt7(Date.now()), YESTERDAY = gmt7(Date.now() - DAY), TWO_AGO = gmt7(Date.now() - 2 * DAY);

function doneOn(world, uid, ...dates) {
  for (const d of dates) world.db.prepare('INSERT OR IGNORE INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?, ?, 200, 1)').run(uid, d);
}
const farmLib = () => loadModule('functions/api/_farm.js');

suite('farm server: the clock is the reward table', () => {
  test('dayCount is the number of finished task-days; wiltCtx reads the last two days', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    const lib = farmLib();
    assert.equal(await lib.dayCount(world.env, kid.uid), 0);
    doneOn(world, kid.uid, TWO_AGO, YESTERDAY);
    assert.equal(await lib.dayCount(world.env, kid.uid), 2);
    const ctx = await lib.wiltCtx(world.env, kid.uid);
    assert.deepEqual(ctx, { today: TODAY, doneYesterday: true, doneToday: false });
    doneOn(world, kid.uid, TODAY);
    assert.deepEqual((await lib.farmClock(world.env, kid.uid)), { dayCount: 3, ctx: { today: TODAY, doneYesterday: true, doneToday: true } });
  });
  test('farmSummary counts crops, ripe, growing, wilt and picks the closest-to-ripe preview', () => {
    const lib = farmLib();
    const ctx = { today: TODAY, doneYesterday: false, doneToday: false };
    const layout = { cells: [
      { type: 'pumpkin', gx: 0, gy: 0, uid: 'c-aaaaaaaa', day: 0, at: TWO_AGO },
      { type: 'lettuce', gx: 1, gy: 0, uid: 'c-bbbbbbbb', day: 0, at: TWO_AGO },
      { type: 'stone-wall', gx: 2, gy: 0, tier: 1 },
      { type: 'training-barracks', gx: 4, gy: 4, uid: 'p-cccccccc', lastDay: 0 },
    ], farms: [{ cells: [{ type: 'carrot', gx: 0, gy: 0, uid: 'c-dddddddd', day: 1, at: TODAY }] }] };
    const s = lib.farmSummary(layout, 2, ctx);
    assert.equal(s.crops, 3);
    assert.equal(s.ripe, 1, 'lettuce (1 day) is ripe at day 2');
    assert.equal(s.growing, 2);
    assert.equal(s.wiltedCount, 2, 'the two planted before today wilt; today\'s carrot does not');
    assert.truthy(s.wilted);
    assert.equal(s.barracksReady, 1);
    assert.deepEqual(s.preview, { id: 'lettuce', g: 1, days: 1, wilted: true });
    assert.deepEqual(lib.farmSummary({ cells: [] }, 0, ctx).preview, null);
  });
});

const homeHandler = () => loadModule('functions/api/night-raid/home.js');
async function putHome(world, kid, layout, coins) {
  return world.call(homeHandler().onRequestPut, { url: '/api/night-raid/home', method: 'PUT', token: kid.token,
    body: { layout, dogLevel: 1, castleSkin: 'stone-keep', coins: coins == null ? 500 : coins } });
}
const stored = (world, uid) => JSON.parse(world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(uid).layout_json);

suite('farm server: home PUT stamps days on the server, not the client', () => {
  test('a new crop gets day = dayCount and at = today, whatever the client sent', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    doneOn(world, kid.uid, TWO_AGO, YESTERDAY);
    const r = await putHome(world, kid, { cells: [{ type: 'tomato', gx: 1, gy: 1, uid: 'c-aaaaaaaa', day: 999, at: '2020-01-01' }] });
    assert.truthy(r.ok, JSON.stringify(r.data));
    const crop = stored(world, kid.uid).cells.find(c => c.type === 'tomato');
    assert.equal(crop.day, 2);
    assert.equal(crop.at, TODAY);
    assert.equal(r.data.dayCount, 2);
    assert.deepEqual(r.data.ctx, { today: TODAY, doneYesterday: true, doneToday: false });
  });
  test('an existing crop keeps the server\'s day and at even if the client rewinds them', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    doneOn(world, kid.uid, TWO_AGO);
    await putHome(world, kid, { cells: [{ type: 'pumpkin', gx: 1, gy: 1, uid: 'c-aaaaaaaa' }] });
    doneOn(world, kid.uid, YESTERDAY, TODAY);
    await putHome(world, kid, { cells: [{ type: 'pumpkin', gx: 3, gy: 3, uid: 'c-aaaaaaaa', day: 0, at: '2020-01-01' }] });
    const crop = stored(world, kid.uid).cells.find(c => c.type === 'pumpkin');
    assert.equal(crop.day, 1, 'planted at day 1, still day 1');
    assert.equal(crop.at, TODAY, 'the planting date is the server\'s');
    assert.equal(crop.gx, 3, 'moving it is fine');
  });
  test('barracks: new ones get lastDay = dayCount; a legacy readyAt converts; lastDay cannot rewind', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    doneOn(world, kid.uid, TWO_AGO, YESTERDAY, TODAY);
    await putHome(world, kid, { cells: [] });
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?').run(JSON.stringify({ cells: [
      { type: 'training-barracks', gx: 0, gy: 0, tier: 1, uid: 'p-legacy01', readyAt: 5 }], soldiers: 0, dogLane: 2 }), kid.uid);
    const g = await world.call(homeHandler().onRequestGet, { url: '/api/night-raid/home', method: 'GET', token: kid.token });
    assert.truthy(g.ok);
    const legacy = g.data.home.layout.cells.find(c => c.uid === 'p-legacy01');
    assert.equal(legacy.lastDay, 3, 'converted on read with today\'s dayCount');
    assert.equal(legacy.readyAt, undefined);
    assert.equal(g.data.dayCount, 3);
    await putHome(world, kid, { cells: [{ type: 'training-barracks', gx: 0, gy: 0, uid: 'p-legacy01', lastDay: 0 }, { type: 'training-barracks', gx: 4, gy: 4, uid: 'p-newone01' }] });
    const cells = stored(world, kid.uid).cells;
    assert.equal(cells.find(c => c.uid === 'p-legacy01').lastDay, 3, 'the client may not rewind lastDay');
    assert.equal(cells.find(c => c.uid === 'p-newone01').lastDay, 3);
  });
  test('fields: a second new rice field is dropped, but four owned ones survive', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await putHome(world, kid, { cells: [{ type: 'rice-field', gx: 0, gy: 0, uid: 'p-rice0001' }, { type: 'rice-field', gx: 4, gy: 0, uid: 'p-rice0002' }] });
    assert.equal(stored(world, kid.uid).cells.filter(c => c.type === 'rice-field').length, 1, 'buyMax is 1');
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?').run(JSON.stringify({ cells: [0, 1, 2, 3].map(i =>
      ({ type: 'rice-field', gx: i * 2, gy: 0, tier: 1, uid: 'p-rice000' + i, readyAt: 1 })), soldiers: 0, dogLane: 2 }), kid.uid);
    await putHome(world, kid, { cells: [0, 1, 2, 3].map(i => ({ type: 'rice-field', gx: i * 2, gy: 0, uid: 'p-rice000' + i, readyAt: 1 })) });
    assert.equal(stored(world, kid.uid).cells.filter(c => c.type === 'rice-field').length, 4, 'owned fields are never taken away');
  });
  test('farms: kept, capped at three, stamped like the main board', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    doneOn(world, kid.uid, YESTERDAY);
    await putHome(world, kid, { cells: [], farms: [{ cells: [{ type: 'rose', gx: 0, gy: 0, uid: 'c-rose0001' }] }, { cells: [] }, { cells: [] }, { cells: [] }] });
    const s = stored(world, kid.uid);
    assert.equal(s.farms.length, 3);
    assert.equal(s.farms[0].cells[0].day, 1);
    assert.equal(s.farms[0].cells[0].at, TODAY);
  });
});

const collectHandler = () => loadModule('functions/api/night-raid/collect.js');
const collect = (world, kid, uid) => world.call(collectHandler().onRequestPost, { url: '/api/night-raid/collect', method: 'POST', token: kid.token, body: { uid: uid || '' } });
const mirror = (world, uid) => world.db.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').get(uid).lootable_coins;

suite('farm server: collect', () => {
  async function farmWorld(dates, cells, farms) {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await putHome(world, kid, { cells: [] }, 100);
    doneOn(world, kid.uid, ...dates);
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?').run(JSON.stringify({ cells, farms: farms || [], soldiers: 0, dogLane: 2 }), kid.uid);
    return { world, kid };
  }
  test('a ripe fresh crop pays its yield once, is removed, and is reported for replanting', async () => {
    const { world, kid } = await farmWorld([TWO_AGO, YESTERDAY], [
      { type: 'tomato', gx: 1, gy: 1, uid: 'c-tomato01', day: 0, at: TWO_AGO },
      { type: 'pumpkin', gx: 2, gy: 2, uid: 'c-pumpk001', day: 0, at: TWO_AGO },
    ], [{ cells: [{ type: 'lettuce', gx: 0, gy: 0, uid: 'c-lettuc01', day: 1, at: YESTERDAY }] }]);
    const r = await collect(world, kid);
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.equal(r.data.collectedCoins, 18 + 8, 'tomato (2 days) and lettuce (1 day) are ripe; pumpkin is not');
    assert.equal(r.data.coins, 126);
    assert.equal(mirror(world, kid.uid), 126);
    assert.deepEqual(r.data.harvested.map(h => [h.type, h.zone]).sort(), [['lettuce', 1], ['tomato', 0]]);
    const s = stored(world, kid.uid);
    assert.falsy(s.cells.some(c => c.type === 'tomato'));
    assert.truthy(s.cells.some(c => c.type === 'pumpkin'));
    assert.equal(s.farms[0].cells.length, 0);
    assert.equal(r.data.dayCount, 2);
    const again = await collect(world, kid);
    assert.truthy(again.data.nothingReady, 'nothing left to pay');
    assert.equal(mirror(world, kid.uid), 126, 'no double pay');
  });
  test('a ripe but wilted crop is not harvested and the reply says why', async () => {
    const { world, kid } = await farmWorld([TWO_AGO], [{ type: 'lettuce', gx: 1, gy: 1, uid: 'c-lettuc01', day: 0, at: TWO_AGO }]);
    const before = JSON.stringify(stored(world, kid.uid));
    const r = await collect(world, kid);
    assert.truthy(r.data.nothingReady);
    assert.truthy(r.data.wilted, 'the child is told the plant is wilted');
    assert.equal(JSON.stringify(stored(world, kid.uid)), before, 'layout untouched');
    assert.equal(mirror(world, kid.uid), 100);
    doneOn(world, kid.uid, TODAY);
    const revived = await collect(world, kid);
    assert.equal(revived.data.collectedCoins, 8, 'finishing today revives and pays');
  });
  test('barracks pay one soldier per task-day since the last collect, and not by the clock', async () => {
    const { world, kid } = await farmWorld([TWO_AGO, YESTERDAY], [{ type: 'training-barracks', gx: 0, gy: 0, tier: 1, uid: 'p-barrac01', lastDay: 0 }]);
    const r = await collect(world, kid);
    assert.equal(r.data.collectedSoldiers, 1);
    assert.equal(stored(world, kid.uid).cells[0].lastDay, 2);
    const again = await collect(world, kid);
    assert.truthy(again.data.nothingReady, 'same dayCount → nothing');
    doneOn(world, kid.uid, TODAY);
    assert.equal((await collect(world, kid)).data.collectedSoldiers, 1);
  });
  test('fields still pay by their 24h clock', async () => {
    const { world, kid } = await farmWorld([], [{ type: 'rice-field', gx: 0, gy: 0, tier: 1, uid: 'p-rice0001', readyAt: 0 }, { type: 'fish-pond', gx: 4, gy: 0, tier: 1, uid: 'p-fish0001', readyAt: Date.now() + 3600000 }]);
    const r = await collect(world, kid);
    assert.equal(r.data.collectedCoins, 100);
    assert.truthy(stored(world, kid.uid).cells.find(c => c.uid === 'p-rice0001').readyAt > Date.now());
  });
  test('uid harvests one cell only', async () => {
    const { world, kid } = await farmWorld([TWO_AGO, YESTERDAY], [
      { type: 'lettuce', gx: 1, gy: 1, uid: 'c-lettuc01', day: 0, at: TWO_AGO },
      { type: 'lettuce', gx: 2, gy: 1, uid: 'c-lettuc02', day: 0, at: TWO_AGO }]);
    const r = await collect(world, kid, 'c-lettuc02');
    assert.equal(r.data.collectedCoins, 8);
    assert.equal(stored(world, kid.uid).cells.length, 1);
    assert.equal(stored(world, kid.uid).cells[0].uid, 'c-lettuc01');
  });
  test('403 without the flag', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: false });
    assert.equal((await collect(world, kid)).status, 403);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
