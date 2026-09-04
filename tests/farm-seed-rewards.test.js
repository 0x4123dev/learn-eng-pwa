// Two-day Daily Task seed rewards and server-owned planting inventory.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');
const { createD1 } = require('./d1-mock');
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const core = () => loadModule('functions/api/_daily-task.js');

suite('farm seeds: schema and migration', () => {
  test('migration creates the completion ledger and non-negative inventory', () => {
    const { db } = createD1();
    db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY); INSERT INTO users(id) VALUES(1);');
    db.exec(fs.readFileSync(path.join(root, 'db/028-farm-seed-rewards.sql'), 'utf8'));
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'farm_seed_%' ORDER BY name").all().map(r => r.name);
    assert.deepEqual(tables, ['farm_seed_days', 'farm_seed_inventory']);
    db.prepare("INSERT INTO farm_seed_inventory(user_id,crop_id,quantity) VALUES(1,'lettuce',0)").run();
    assert.throws(() => db.prepare("UPDATE farm_seed_inventory SET quantity=-1 WHERE user_id=1 AND crop_id='lettuce'").run());
  });
});

suite('farm seeds: two consecutive days rotate the crop', () => {
  test('pairs award lettuce, tomato, then carrot; a missed day breaks an unfinished pair', async () => {
    const world = createWorld(), kid = await world.createUser({});
    let s = await core().seedStatus(world.env, kid.uid, '2026-09-01', true);
    assert.equal(s.progress, 1); assert.equal(s.next.id, 'lettuce'); assert.equal(s.justRewarded, null);
    s = await core().seedStatus(world.env, kid.uid, '2026-09-02', true);
    assert.equal(s.progress, 0); assert.equal(s.justRewarded.id, 'lettuce');
    assert.equal(s.inventory.find(x => x.id === 'lettuce').quantity, 1);
    const replay = await core().seedStatus(world.env, kid.uid, '2026-09-02', true);
    assert.equal(replay.inventory.find(x => x.id === 'lettuce').quantity, 1, 'same day never awards twice');
    await core().seedStatus(world.env, kid.uid, '2026-09-03', true);
    s = await core().seedStatus(world.env, kid.uid, '2026-09-04', true);
    assert.equal(s.justRewarded.id, 'tomato');
    s = await core().seedStatus(world.env, kid.uid, '2026-09-06', true);
    assert.equal(s.progress, 1, 'September 5 was missed, so September 6 starts a new pair');
    s = await core().seedStatus(world.env, kid.uid, '2026-09-07', true);
    assert.equal(s.justRewarded.id, 'carrot');
  });

  test('the sequence wraps from pumpkin back to lettuce', async () => {
    const world = createWorld(), kid = await world.createUser({});
    let last;
    for (let day = 1; day <= 14; day++) last = await core().seedStatus(world.env, kid.uid, `2026-08-${String(day).padStart(2, '0')}`, true);
    const rewards = world.db.prepare('SELECT crop_id FROM farm_seed_days WHERE user_id=? AND crop_id IS NOT NULL ORDER BY task_date').all(kid.uid).map(r => r.crop_id);
    assert.deepEqual(rewards, ['lettuce', 'tomato', 'carrot', 'rice', 'rose', 'pumpkin', 'lettuce']);
    assert.equal(last.next.id, 'tomato');
  });
});

suite('farm seeds: planting is server-owned', () => {
  test('one owned seed creates one crop and a repeat cannot plant for free', async () => {
    const world = createWorld(), kid = await world.createUser({ allowBot: true });
    world.db.prepare("INSERT INTO night_raid_homes(user_id,layout_json,updated_at) VALUES(?, ?, ?)")
      .run(kid.uid, JSON.stringify({ cells: [], farms: [], soldiers: 0 }), Date.now());
    world.db.prepare("INSERT INTO farm_seed_inventory(user_id,crop_id,quantity) VALUES(?,'lettuce',1)").run(kid.uid);
    const plant = loadModule('functions/api/night-raid/plant.js').onRequestPost;
    let r = await world.call(plant, { token: kid.token, body: { cropId: 'lettuce', zone: 0, gx: 10, gy: 10 } });
    assert.equal(r.status, 200); assert.equal(r.data.planted.id, 'lettuce');
    assert.equal(r.data.layout.cells.filter(c => c.type === 'lettuce').length, 1);
    assert.equal(world.db.prepare("SELECT quantity FROM farm_seed_inventory WHERE user_id=? AND crop_id='lettuce'").get(kid.uid).quantity, 0);
    r = await world.call(plant, { token: kid.token, body: { cropId: 'lettuce', zone: 0, gx: 11, gy: 11 } });
    assert.equal(r.status, 409);
    const stored = JSON.parse(world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(kid.uid).layout_json);
    assert.equal(stored.cells.filter(c => c.type === 'lettuce').length, 1, 'failed repeat leaves the home unchanged');
  });

  test('generic home sync cannot mint a crop outside the seed endpoint', async () => {
    const world = createWorld(), kid = await world.createUser({ allowBot: true });
    world.db.prepare("INSERT INTO night_raid_homes(user_id,layout_json,updated_at) VALUES(?, ?, ?)")
      .run(kid.uid, JSON.stringify({ cells: [], farms: [], soldiers: 0 }), Date.now());
    const home = loadModule('functions/api/night-raid/home.js').onRequestPut;
    const r = await world.call(home, { token: kid.token, method: 'PUT', body: { layout: { cells: [{ type: 'tomato', gx: 10, gy: 10 }], farms: [] } } });
    assert.equal(r.status, 409);
    assert.truthy(r.data.error.includes('Kho Hạt giống'));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
