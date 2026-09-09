// cuuchuong-seconds.test.js — the one clock behind all six Bảng cửu chương
// drills, and the road it travels from an admin's text box to a child's round.
//
// EXECUTED against a real SQLite database (tests/pages-harness.js), never
// substring-checked. This one number decides how long every child's round runs
// on every device, and the failure mode is silent: a 0 written here does not
// throw anywhere — it just ends the round before the first question is read
// and scores 0/10, for everybody, until a human notices.
//
// Four things are pinned, each a way that could happen:
//
//   1. Only an admin may write it.
//   2. Junk and out-of-range values are CLAMPED to something a round can run
//      on — never stored raw, never allowed to reach a device as 0.
//   3. A database that has not had db/030 applied still answers with the
//      default. The code ships before the migration is run, and a null there
//      would be a dead drill for however long that gap lasts.
//   4. The value actually rides home on the coin sync, which is the only path
//      by which a device ever learns it.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const FLAGS = 'functions/api/admin/app-flags.js';
function flags() { return loadModule(FLAGS); }
function coins() { return loadModule('functions/api/coins.js'); }

const get = (world, o) => world.call(flags().onRequestGet, Object.assign(
  { method: 'GET', url: '/api/admin/app-flags' }, o));
const post = (world, o) => world.call(flags().onRequestPost, Object.assign(
  { method: 'POST', url: '/api/admin/app-flags' }, o));
const sync = (world, o) => world.call(coins().onRequestPost, Object.assign(
  { method: 'POST', url: '/api/coins', body: { ackOnly: true } }, o));

async function adminWorld(opts) {
  const world = createWorld(opts);
  const admin = await world.createUser({ username: 'boss', role: 'admin' });
  const kid = await world.createUser({});
  return { world, admin, kid };
}

function storedSeconds(world) {
  const row = world.db.prepare(
    "SELECT value FROM app_flags WHERE key = 'cuuchuong_seconds'").get();
  return row ? row.value : null;
}

suite('cửu chương clock: who may set it', () => {
  test('no token is 401 on both verbs', async () => {
    const { world } = await adminWorld();
    assert.equal((await get(world, {})).status, 401);
    assert.equal((await post(world, { body: { key: 'cuuchuong_seconds', value: 90 } })).status, 401);
  });

  test('a child with a valid token is 403, and the clock does not move', async () => {
    const { world, kid } = await adminWorld();
    const before = storedSeconds(world);
    assert.equal((await get(world, { token: kid.token })).status, 403);
    const r = await post(world, { token: kid.token, body: { key: 'cuuchuong_seconds', value: 15 } });
    assert.equal(r.status, 403);
    assert.equal(storedSeconds(world), before,
      'a forbidden request must not have written on its way to the 403');
  });

  test('an unknown key is refused rather than silently stored', async () => {
    const { world, admin } = await adminWorld();
    const r = await post(world, { token: admin.token, body: { key: 'cuuchuong_secondz', value: 90 } });
    assert.equal(r.status, 400);
    const row = world.db.prepare(
      "SELECT COUNT(*) AS n FROM app_flags WHERE key = 'cuuchuong_secondz'").get();
    assert.equal(row.n, 0, 'a typo must not sit in the table forever looking like a setting');
  });
});

suite('cửu chương clock: what an admin can actually store', () => {
  test('the migration seeds 60, and that is what GET reports', async () => {
    const { world, admin } = await adminWorld();
    const r = await get(world, { token: admin.token });
    assert.equal(r.status, 200);
    assert.equal(r.data.settings.cuuchuong_seconds, 60);
  });

  test('a sane value round-trips through the database', async () => {
    const { world, admin } = await adminWorld();
    const r = await post(world, { token: admin.token, body: { key: 'cuuchuong_seconds', value: 90 } });
    assert.equal(r.status, 200);
    assert.equal(r.data.settings.cuuchuong_seconds, 90);
    assert.equal(storedSeconds(world), 90, 'it must be in the table, not just in the reply');
    const back = await get(world, { token: admin.token });
    assert.equal(back.data.settings.cuuchuong_seconds, 90);
  });

  test('too small and too large are clamped into range, never stored raw', async () => {
    const { world, admin } = await adminWorld();
    let r = await post(world, { token: admin.token, body: { key: 'cuuchuong_seconds', value: 1 } });
    assert.equal(r.data.settings.cuuchuong_seconds, 15);
    assert.equal(storedSeconds(world), 15);
    r = await post(world, { token: admin.token, body: { key: 'cuuchuong_seconds', value: 99999 } });
    assert.equal(r.data.settings.cuuchuong_seconds, 180);
    assert.equal(storedSeconds(world), 180);
  });

  test('junk never becomes a zero-second round', async () => {
    // The whole reason this file exists. A 0 here throws nowhere: it ends the
    // round before the first question is read and scores 0/10 every time.
    const { world, admin } = await adminWorld();
    for (const junk of [0, -30, 'abc', null, {}, []]) {
      const r = await post(world, { token: admin.token, body: { key: 'cuuchuong_seconds', value: junk } });
      assert.equal(r.status, 200, 'junk ' + JSON.stringify(junk) + ' should not 500');
      assert.truthy(r.data.settings.cuuchuong_seconds >= 15,
        'junk ' + JSON.stringify(junk) + ' produced ' + r.data.settings.cuuchuong_seconds);
      assert.truthy(storedSeconds(world) >= 15);
    }
  });

  test('flipping the Đấu Toán switch does not disturb the clock, and vice versa', async () => {
    // They share one table. A write to either must not blank the other.
    const { world, admin } = await adminWorld();
    await post(world, { token: admin.token, body: { key: 'cuuchuong_seconds', value: 75 } });
    const r = await post(world, { token: admin.token, body: { key: 'math_fight', value: true } });
    assert.equal(r.data.flags.math_fight, true);
    assert.equal(r.data.settings.cuuchuong_seconds, 75, 'the clock was blanked by a switch write');
  });
});

suite('cửu chương clock: a database without db/030 applied', () => {
  // The code ships before a migration is hand-applied. Between those two
  // moments the row simply is not there, and the drill must still work.
  function worldWithoutRow() {
    const world = createWorld();
    world.db.prepare("DELETE FROM app_flags WHERE key = 'cuuchuong_seconds'").run();
    return world;
  }

  test('GET still answers with the default rather than null', async () => {
    const world = worldWithoutRow();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    assert.equal(storedSeconds(world), null, 'the row really is absent');
    const r = await get(world, { token: admin.token });
    assert.equal(r.status, 200);
    assert.equal(r.data.settings.cuuchuong_seconds, 60);
  });

  test('and a child syncing still gets a length they can run a round on', async () => {
    const world = worldWithoutRow();
    const kid = await world.createUser({});
    const r = await sync(world, { token: kid.token });
    assert.equal(r.status, 200);
    assert.equal(r.data.flags.cuuchuongSeconds, 60);
  });
});

suite('cửu chương clock: the road to the child', () => {
  test('the coin sync carries it home — the only path a device has', async () => {
    const { world, admin, kid } = await adminWorld();
    await post(world, { token: admin.token, body: { key: 'cuuchuong_seconds', value: 120 } });
    const r = await sync(world, { token: kid.token });
    assert.equal(r.status, 200);
    assert.equal(r.data.flags.cuuchuongSeconds, 120,
      'an admin can change the clock but no device would ever hear about it');
  });

  test('a hand-poked out-of-range row is still clamped on the way out', async () => {
    // A row can predate the range, or be written by hand against production.
    // The device must never be handed a number it should not run on.
    const { world, kid } = await adminWorld();
    world.db.prepare("UPDATE app_flags SET value = 0 WHERE key = 'cuuchuong_seconds'").run();
    let r = await sync(world, { token: kid.token });
    assert.equal(r.data.flags.cuuchuongSeconds, 60, 'a stored 0 must not reach a device');
    world.db.prepare("UPDATE app_flags SET value = 9999 WHERE key = 'cuuchuong_seconds'").run();
    r = await sync(world, { token: kid.token });
    assert.equal(r.data.flags.cuuchuongSeconds, 180);
  });

  test('a stranger gets nothing', async () => {
    const { world } = await adminWorld();
    assert.equal((await sync(world, {})).status, 401);
  });
});

suite('cửu chương clock: the client honours what it is sent', () => {
  test('the drill reads the synced setting, and all six drills share it', () => {
    const tables = require(path.join(ROOT, 'js', 'math-tables.js'));
    global.appState = { coins: 0, mathHistory: [], cuuchuongSeconds: 120 };
    for (const m of tables.mathTablesModes()) {
      assert.equal(tables.mathTablesSeconds(m), 120, m.key + ' ignored the admin setting');
    }
    global.appState = { coins: 0, mathHistory: [] };
    assert.equal(tables.mathTablesSeconds(null), 60, 'an unsynced device falls back to 60');
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
