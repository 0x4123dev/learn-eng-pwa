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

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
