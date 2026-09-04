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
    const before = stored(world, kid.uid).cells;
    const r = await collect(world, kid);
    assert.truthy(r.data.nothingReady);
    assert.truthy(r.data.wilted, 'the child is told the plant is wilted');
    // The CELLS are untouched — the plant is not harvested and not aged. (The
    // stored JSON itself may be rewritten in its normalized shape now: a
    // nothingReady collect persists whatever normalizeLayout changed, or a
    // legacy barracks could never finish converting. See the barracks suite.)
    assert.deepEqual(stored(world, kid.uid).cells, before, 'the wilted crop stays exactly as it was');
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

suite('farm server: the Daily Task page gets a farm summary', () => {
  const meHandler = () => loadModule('functions/api/me/daily-tasks.js');
  const me = (world, kid) => world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET', token: kid.token });
  test('with the flag: counts and preview; without: farm is null', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await putHome(world, kid, { cells: [{ type: 'carrot', gx: 1, gy: 1, uid: 'c-carrot01' }] });
    doneOn(world, kid.uid, YESTERDAY);
    const r = await me(world, kid);
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.equal(r.data.farm.crops, 1);
    assert.equal(r.data.farm.growing, 1);
    assert.deepEqual(r.data.farm.preview, { id: 'carrot', g: 1, days: 3, wilted: false });
    assert.equal(r.data.farm.ctx.today, TODAY);
    const plain = await world.createUser({ allowBot: false });
    assert.equal((await me(world, plain)).data.farm, null);
  });
  test('a child with the flag but no home yet gets an empty summary, not an error', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    const r = await me(world, kid);
    assert.truthy(r.ok);
    assert.equal(r.data.farm.crops, 0);
    assert.equal(r.data.farm.preview, null);
  });
});

suite('farm server: a uid is an identity, not a coupon', () => {
  // Found by review, 2026-09-04. home.js PUT keeps the SERVER's day for a cell
  // whose uid it already knows — so a layout carrying the same uid 96 times
  // cloned one grown pumpkin into a field of ripe ones: 20 xu of seed
  // harvested as 11,520 xu. lootable_coins is the pile other children steal
  // from in a raid, so this minted money into the shared economy, not just
  // into one device's wallet. normalizeLayout now lets a uid appear once.
  test('a layout may not carry the same uid twice, on any board', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    const day = n => doneOn(world, kid.uid, gmt7(Date.now() - n * DAY));
    day(20); day(19);                                   // dayCount 2
    await putHome(world, kid, { cells: [{ type: 'pumpkin', gx: 0, gy: 0, uid: 'c-honest01' }] }, 100);
    assert.equal(stored(world, kid.uid).cells[0].day, 2, 'planted at day 2');
    for (let i = 18; i >= 8; i--) day(i);               // dayCount 13 → the pumpkin is ripe
    const clones = [];
    for (let gx = 0; gx < 12 && clones.length < 96; gx++)
      for (let gy = 0; gy < 12 && clones.length < 96; gy++) {
        if (gx >= 4 && gx < 7 && gy >= 1 && gy < 4) continue;   // the castle footprint
        clones.push({ type: 'pumpkin', gx, gy, uid: 'c-honest01' });
      }
    await putHome(world, kid, { cells: clones }, 100);
    const kept = stored(world, kid.uid).cells.filter(c => c.type === 'pumpkin');
    assert.equal(kept.length, 1, 'only the first claimant of a uid survives');
    const r = await collect(world, kid);
    assert.equal(r.data.collectedCoins, 120, 'one ripe pumpkin pays once, not 96 times');
    assert.equal(mirror(world, kid.uid), 220);
  });
  test('honest layouts are untouched: distinct uids, missing uids, malformed uids', () => {
    const R = require(require('path').join(__dirname, '..', 'js', 'night-raid-rules.js'));
    const honest = R.normalizeLayout({ cells: [
      { type: 'pumpkin', gx: 0, gy: 0, uid: 'c-aaaaaaaa', day: 1, at: '2026-09-01' },
      { type: 'tomato', gx: 1, gy: 0, uid: 'c-bbbbbbbb', day: 2, at: '2026-09-02' },
      { type: 'rice-field', gx: 3, gy: 3, uid: 'p-cccccccc', readyAt: 5 },
    ], farms: [{ cells: [{ type: 'lettuce', gx: 0, gy: 0, uid: 'c-dddddddd', day: 3, at: '2026-09-03' }] }] });
    assert.equal(honest.cells.length, 3);
    assert.equal(honest.farms[0].cells.length, 1);
    // A cell with no uid is a new planting, not a claim — the server mints one.
    assert.equal(R.normalizeLayout({ cells: [{ type: 'pumpkin', gx: 0, gy: 0 }, { type: 'pumpkin', gx: 2, gy: 0 }] }).cells.length, 2);
    // A malformed uid is not a claim either, so it cannot squat the namespace.
    assert.equal(R.normalizeLayout({ cells: [{ type: 'pumpkin', gx: 0, gy: 0, uid: 'bad' }, { type: 'pumpkin', gx: 2, gy: 0, uid: 'bad' }] }).cells.length, 2);
    // Rejecting a duplicate must not cost a NEIGHBOUR its place: the check runs
    // before the cell reserves a grid square or a maxOwned slot. Five fields
    // with one duplicated uid must keep four — what master kept — not three.
    const five = [];
    for (let i = 0; i < 5; i++) five.push({ type: 'rice-field', gx: i * 2, gy: 0, uid: 'p-rice000' + i, readyAt: 1 });
    five[2].uid = five[1].uid;
    assert.equal(R.normalizeLayout({ cells: five }).cells.filter(c => c.type === 'rice-field').length, 4);
    // The set spans boards: a farm board cannot re-use the castle grid's uid.
    const dup = R.normalizeLayout({ cells: [{ type: 'pumpkin', gx: 0, gy: 0, uid: 'c-aaaaaaaa' }],
      farms: [{ cells: [{ type: 'pumpkin', gx: 0, gy: 0, uid: 'c-aaaaaaaa' }] }] });
    assert.equal(dup.cells.length, 1);
    assert.equal(dup.farms[0].cells.length, 0);
  });
});

suite('farm server: a legacy barracks must finish converting', () => {
  // Found by review, 2026-09-04. `training-barracks` used to pay one soldier
  // per 24 h through cell.readyAt; it now pays one per finished task-day
  // through cell.lastDay, and normalizeLayout converts a legacy cell by
  // setting lastDay = dayCount and dropping readyAt. A cell converted in THIS
  // request is rightly not ready in this request — but collect.js sent the
  // nothingReady reply WITHOUT writing, so the conversion was thrown away.
  // The next day dayCount had grown, the stored cell still carried readyAt
  // and no lastDay, so it was converted to the NEW dayCount and was again not
  // ready. Simulated over four task-days, the child's soldiers never left 0.
  test('the conversion is written down, and the next task-day pays a soldier', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await putHome(world, kid, { cells: [] }, 100);
    const day = n => doneOn(world, kid.uid, gmt7(Date.now() - n * DAY));
    day(10);                                            // dayCount 1
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?').run(JSON.stringify({
      cells: [{ type: 'training-barracks', gx: 0, gy: 0, tier: 1, uid: 'p-legacy01', readyAt: Date.now() - 1000 }],
      soldiers: 0, dogLane: 2 }), kid.uid);
    const first = await collect(world, kid);
    assert.truthy(first.data.nothingReady, 'the day it converts on is not a day it can pay for');
    const cell = stored(world, kid.uid).cells.find(c => c.uid === 'p-legacy01');
    assert.equal(cell.lastDay, 1, 'the conversion is persisted, not discarded with the reply');
    assert.equal(cell.readyAt, undefined, 'and the old 24h clock is gone for good');
    assert.equal(stored(world, kid.uid).soldiers, 0);
    assert.equal(mirror(world, kid.uid), 100, 'the conversion write never touches the money column');
    day(9);                                             // dayCount 2
    const second = await collect(world, kid);
    assert.equal(second.data.collectedSoldiers, 1, 'the next finished task-day pays one soldier');
    assert.equal(stored(world, kid.uid).soldiers, 1);
    assert.equal(mirror(world, kid.uid), 100, 'and soldiers are not coins');
  });
  test('four task-days in a row: the barracks does not stay stuck at zero', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await putHome(world, kid, { cells: [] }, 100);
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?').run(JSON.stringify({
      cells: [{ type: 'training-barracks', gx: 0, gy: 0, tier: 1, uid: 'p-legacy01', readyAt: 5 }],
      soldiers: 0, dogLane: 2 }), kid.uid);
    let paid = 0;
    for (let n = 12; n >= 9; n--) {
      doneOn(world, kid.uid, gmt7(Date.now() - n * DAY));
      paid += Number((await collect(world, kid)).data.collectedSoldiers || 0);
    }
    assert.equal(paid, 3, 'day one converts; days two, three and four each pay a soldier');
    assert.equal(stored(world, kid.uid).soldiers, 3);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
