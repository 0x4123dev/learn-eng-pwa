// Money-flow invariants, SERVER SIDE — the handlers are EXECUTED against a
// real SQLite database (tests/pages-harness.js), not substring-checked.
//
// The one rule every test here serves: no request, replay, race or missing
// field may zero a child's wallet, dog level or assets. A legitimate spend may
// lower the balance; nothing else may.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const NR = loadModule('js/night-raid-rules.js');

function coinsHandler() { return loadModule('functions/api/coins.js'); }
function grantHandler() { return loadModule('functions/api/admin/grant-coins.js'); }
function homeHandler() { return loadModule('functions/api/night-raid/home.js'); }
function collectHandler() { return loadModule('functions/api/night-raid/collect.js'); }
function activityHandler() { return loadModule('functions/api/activity.js'); }
function ghostHandler() { return loadModule('functions/api/ghost-offering.js'); }

function farmLayout(readyAt) {
  return NR.normalizeLayout({
    cells: [{ type: 'rice-field', lane: 0, col: 1, gx: 0, gy: 0, tier: 1,
      uid: 'p-testfarm01', readyAt }],
    soldiers: 2, dogLane: 2,
  });
}
function homeRow(db, uid) {
  return db.prepare('SELECT * FROM night_raid_homes WHERE user_id=?').get(uid);
}
async function seedHome(world, user, over) {
  const body = Object.assign({
    layout: farmLayout(Date.now() + 3600000),
    dogLevel: 7, castleSkin: 'royal-keep', coins: 800, vaultCoins: 40,
  }, over || {});
  const r = await world.call(homeHandler().onRequestPut,
    { url: '/api/night-raid/home', method: 'PUT', token: user.token, body });
  assert.truthy(r.ok, 'seeding the home must succeed: ' + JSON.stringify(r.data));
  return r;
}

suite('money server: a rebuilt database still pays the wallet paths', () => {
  test('POST /api/coins works on a DB rebuilt from schema.sql + migrations', async () => {
    // users.allow_bot is read by the grant-claim path on EVERY sync. If no
    // checked-in SQL creates the column, a rebuilt DB breaks the entire coin
    // pipeline and the client swallows it as "offline".
    const world = createWorld();
    const user = await world.createUser({});
    world.db.prepare(
      'INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,?)'
    ).run(user.uid, 50, 'test', 1);
    const r = await world.call(coinsHandler().onRequestPost,
      { url: '/api/coins', token: user.token });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.granted, 50);
  });
});

suite('money server: coin grants pay exactly once', () => {
  test('a Daily Task grant is identified separately from an admin gift', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    world.db.prepare(
      'INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,?)'
    ).run(user.uid, 200, 'Daily task 2026-09-05', 0);
    const result = await world.call(coinsHandler().onRequestPost, { token: user.token });
    assert.equal(result.data.granted, 200);
    assert.equal(result.data.dailyTaskGranted, 200);
    assert.deepEqual(result.data.adjustments, [
      { amount: 200, note: 'Daily task 2026-09-05', manual: false },
    ]);
  });

  test('a defence grant keeps the reason needed by child-facing copy', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    world.db.prepare(
      'INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,?)'
    ).run(user.uid, 100, 'Cướp Đêm: bạn giữ được nhà', 0);
    const result = await world.call(coinsHandler().onRequestPost, { token: user.token });
    assert.deepEqual(result.data.adjustments, [
      { amount: 100, note: 'Cướp Đêm: bạn giữ được nhà', manual: false },
    ]);
  });

  test('two grants are paid in one claim and never again', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    for (const amount of [30, 20]) {
      world.db.prepare(
        'INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,?)'
      ).run(user.uid, amount, '', 1);
    }
    const first = await world.call(coinsHandler().onRequestPost, { token: user.token });
    assert.equal(first.data.granted, 50);
    const replay = await world.call(coinsHandler().onRequestPost, { token: user.token });
    assert.equal(replay.data.granted, 0, 'a replayed claim must pay nothing');
  });

  test('admin grant endpoint refuses non-admins, zero, oversize and ghosts', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const grant = (token, body) => world.call(grantHandler().onRequestPost, { token, body });
    assert.equal((await grant(kid.token, { userId: kid.uid, amount: 10 })).status, 403);
    assert.equal((await grant(admin.token, { userId: kid.uid, amount: 0 })).status, 400);
    assert.equal((await grant(admin.token, { userId: kid.uid, amount: 100001 })).status, 400);
    assert.equal((await grant(admin.token, { userId: 999999, amount: 10 })).status, 404);
    const ok = await grant(admin.token, { userId: kid.uid, amount: 10 });
    assert.equal(ok.status, 200);
  });
});

suite('money server: grant receipts survive a crash between claim and save', () => {
  function grant(world, uid, amount) {
    world.db.prepare(
      'INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?,?,?,?)'
    ).run(uid, amount, '', 1);
  }
  // Simulate the stale window passing without waiting 10 real minutes.
  function ageClaims(world, uid) {
    world.db.prepare(
      "UPDATE coin_grants SET claimed_at=datetime('now','-11 minutes') WHERE user_id=?"
    ).run(uid);
  }
  const claim = (world, user, body) =>
    world.call(coinsHandler().onRequestPost, { token: user.token, body });

  test('a proto-2 claim returns a receipt, and an acked grant never pays again', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    grant(world, user.uid, 50);
    const first = await claim(world, user, { proto: 2 });
    assert.equal(first.data.granted, 50);
    assert.truthy(/^[a-f0-9]{32}$/.test(String(first.data.receipt || '')),
      'a paid claim must carry a receipt to ack');
    const ack = await claim(world, user, { ackOnly: true, ackReceipts: [first.data.receipt] });
    assert.equal(ack.data.granted, 0, 'an ack-only call must never claim');
    ageClaims(world, user.uid);
    const later = await claim(world, user, { proto: 2 });
    assert.equal(later.data.granted, 0, 'a confirmed grant is final — no re-offer, ever');
  });

  test('an unacked claim is re-offered after the stale window — the crashed device gets the gift back', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    grant(world, user.uid, 50);
    const first = await claim(world, user, { proto: 2 });
    assert.equal(first.data.granted, 50);
    // The client crashed before saving: no ack. A fresh pending claim must
    // NOT be re-offered immediately (another device syncing seconds later)…
    const rushed = await claim(world, user, { proto: 2 });
    assert.equal(rushed.data.granted, 0, 'a fresh pending claim is not re-offered');
    // …but after the window it is offered again, with a new receipt.
    ageClaims(world, user.uid);
    const retry = await claim(world, user, { proto: 2 });
    assert.equal(retry.data.granted, 50, 'the lost gift comes back');
    assert.truthy(retry.data.receipt && retry.data.receipt !== first.data.receipt,
      'a re-offer gets its own receipt');
    await claim(world, user, { ackOnly: true, ackReceipts: [retry.data.receipt] });
    ageClaims(world, user.uid);
    const done = await claim(world, user, { proto: 2 });
    assert.equal(done.data.granted, 0, 'once saved and acked, it is over');
  });

  test('a legacy client (no proto) keeps claim-equals-confirm and cannot be double-paid', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    grant(world, user.uid, 50);
    const legacy = await claim(world, user, undefined); // old clients send no body
    assert.equal(legacy.data.granted, 50);
    assert.falsy(legacy.data.receipt, 'legacy claims carry no receipt');
    ageClaims(world, user.uid);
    assert.equal((await claim(world, user, undefined)).data.granted, 0);
    assert.equal((await claim(world, user, { proto: 2 })).data.granted, 0,
      'a legacy claim is confirmed on the spot — never re-offered to anyone');
  });

  test("an ack from the wrong account confirms nothing", async () => {
    const world = createWorld();
    const alice = await world.createUser({ username: 'alice' });
    const bob = await world.createUser({ username: 'bob' });
    grant(world, alice.uid, 50);
    const first = await claim(world, alice, { proto: 2 });
    assert.equal(first.data.granted, 50);
    await claim(world, bob, { ackOnly: true, ackReceipts: [first.data.receipt] });
    ageClaims(world, alice.uid);
    const retry = await claim(world, alice, { proto: 2 });
    assert.equal(retry.data.granted, 50,
      "bob's ack must not have confirmed alice's pending claim");
  });
});

suite('money server: the home PUT can never wipe what a child owns', () => {
  test('an empty PUT leaves wallet, dog level, layout and skin untouched', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    await seedHome(world, user);
    const before = homeRow(world.db, user.uid);
    const r = await world.call(homeHandler().onRequestPut,
      { method: 'PUT', token: user.token, body: {} });
    assert.equal(r.status, 200);
    const after = homeRow(world.db, user.uid);
    assert.equal(after.lootable_coins, before.lootable_coins, 'wallet must survive an empty PUT');
    assert.equal(after.dog_level, before.dog_level, 'dog level must survive an empty PUT');
    assert.equal(after.castle_skin, before.castle_skin, 'castle skin must survive an empty PUT');
    assert.deepEqual(JSON.parse(after.layout_json).cells.map(c => c.type),
      JSON.parse(before.layout_json).cells.map(c => c.type), 'buildings must survive an empty PUT');
  });

  test('a PUT that omits coins keeps the stored balance', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    await seedHome(world, user);
    const r = await world.call(homeHandler().onRequestPut, {
      method: 'PUT', token: user.token,
      body: { layout: farmLayout(Date.now() + 3600000), dogLevel: 7 },
    });
    assert.equal(r.status, 200);
    assert.equal(homeRow(world.db, user.uid).lootable_coins, 800);
  });

  test('non-numeric coins (null, NaN-string) never become zero', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    await seedHome(world, user);
    for (const bad of [null, 'oops']) {
      await world.call(homeHandler().onRequestPut, {
        method: 'PUT', token: user.token,
        body: { layout: farmLayout(Date.now() + 3600000), coins: bad },
      });
      assert.equal(homeRow(world.db, user.uid).lootable_coins, 800,
        'coins=' + JSON.stringify(bad) + ' must not wipe the wallet');
    }
  });

  test('dog level never goes backwards (XP is never deducted by design)', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    await seedHome(world, user); // dogLevel 7
    await world.call(homeHandler().onRequestPut, {
      method: 'PUT', token: user.token,
      body: { layout: farmLayout(Date.now() + 3600000), dogLevel: 3, coins: 800 },
    });
    assert.equal(homeRow(world.db, user.uid).dog_level, 7);
    await world.call(homeHandler().onRequestPut, {
      method: 'PUT', token: user.token,
      body: { layout: farmLayout(Date.now() + 3600000), dogLevel: 9, coins: 800 },
    });
    assert.equal(homeRow(world.db, user.uid).dog_level, 9, 'a genuine level-up still lands');
  });

  test('a lower coins value is still accepted — spending is legal', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    await seedHome(world, user);
    await world.call(homeHandler().onRequestPut, {
      method: 'PUT', token: user.token,
      body: { layout: farmLayout(Date.now() + 3600000), coins: 500 },
    });
    assert.equal(homeRow(world.db, user.uid).lootable_coins, 500);
  });
});

suite('money server: ghost offering rewards ride the receipt-protected grant pipeline', () => {
  const SESSION = '12345678-90ab-cdef-1234-567890abcdef';
  const grants = (world, uid) => world.db.prepare(
    'SELECT amount, note, claimed_at FROM coin_grants WHERE user_id=?').all(uid);

  test('an award is one unclaimed grant; a replay adds nothing', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    const claim = () => world.call(ghostHandler().onRequestPost, {
      token: user.token, body: { itemId: 'mooncake1', sessionId: SESSION },
    });
    const first = await claim();
    assert.equal(first.status, 200, JSON.stringify(first.data));
    assert.truthy(first.data.awarded);
    assert.equal(first.data.reward, 50);
    const rows = grants(world, user.uid);
    assert.equal(rows.length, 1, 'exactly one IOU per awarded item');
    assert.equal(rows[0].amount, 50);
    assert.truthy(String(rows[0].note).includes('mooncake1'), 'the note names the item');
    assert.falsy(rows[0].claimed_at, 'the IOU waits for the receipt-protected claim');
    // The event must NOT hand-write the raid wallet any more — that mirror
    // was silently overwritten by the next syncHome on another device.
    const home = world.db.prepare(
      'SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').get(user.uid);
    assert.falsy(home && home.lootable_coins > 0, 'no direct wallet write');
    const replay = await claim();
    assert.falsy(replay.data.awarded, 'a replay must not award again');
    assert.equal(replay.data.reward, 0);
    assert.equal(grants(world, user.uid).length, 1, 'a replay mints no second IOU');
  });

  test('end to end: the event reward arrives through POST /api/coins with a receipt', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    await world.call(ghostHandler().onRequestPost, {
      token: user.token, body: { itemId: 'hangnga', sessionId: SESSION },
    });
    const paid = await world.call(coinsHandler().onRequestPost,
      { token: user.token, body: { proto: 2 } });
    assert.equal(paid.data.granted, 200, 'the pig reward is paid by the grant pipeline');
    assert.truthy(paid.data.receipt, 'and it is crash-protected like any other grant');
    const again = await world.call(coinsHandler().onRequestPost,
      { token: user.token, body: { proto: 2, ackReceipts: [paid.data.receipt] } });
    assert.equal(again.data.granted, 0, 'acked means paid exactly once');
  });
});

suite('money server: the daily snapshot is a real recovery net', () => {
  function snapshotBalance(db, uid) {
    const row = db.prepare('SELECT balance FROM user_coin_snapshots WHERE user_id=?').get(uid);
    return row ? row.balance : null;
  }
  const item = () => ({ type: 'lesson', title: 'Vocabulary lesson #1', score: 4, total: 5, at: Date.now() });

  function snapshotPeak(db, uid) {
    const row = db.prepare('SELECT peak_balance FROM user_coin_snapshots WHERE user_id=?').get(uid);
    return row ? row.peak_balance : null;
  }

  test('balance is what the child has NOW; peak_balance is what recovery needs', async () => {
    // These are two different questions and they used to share one column:
    // MAX-ing `balance` protected a wiped device but made the admin's Balance
    // column report the day's high-water mark — 18,440 xu beside a wallet
    // that really held ~10,000.
    const world = createWorld();
    const user = await world.createUser({});
    const post = (coinBalance) => world.call(activityHandler().onRequestPost, {
      token: user.token, body: { items: [item()], coinBalance, coinObservedAt: Date.now() },
    });
    await post(500);
    assert.equal(snapshotBalance(world.db, user.uid), 500);
    assert.equal(snapshotPeak(world.db, user.uid), 500);
    await post(200); // the child SPENT 300 on the pet shop
    assert.equal(snapshotBalance(world.db, user.uid), 200,
      'the admin must see the wallet as it is now, not the day\'s peak');
    assert.equal(snapshotPeak(world.db, user.uid), 500,
      'the recovery high-water mark survives honest spending');
    await post(800);
    assert.equal(snapshotBalance(world.db, user.uid), 800);
    assert.equal(snapshotPeak(world.db, user.uid), 800, 'a real gain raises the peak too');
  });

  test('a wiped device reporting 0 keeps the recoverable peak', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    const post = (coinBalance) => world.call(activityHandler().onRequestPost, {
      token: user.token, body: { items: [item()], coinBalance, coinObservedAt: Date.now() },
    });
    await post(5000);
    await post(0); // cleared storage / fresh profile
    assert.equal(snapshotBalance(world.db, user.uid), 0, 'the truth: this device now holds nothing');
    assert.equal(snapshotPeak(world.db, user.uid), 5000,
      'and the 5000 xu to restore is still on record');
  });

  test('a sync with no new activity still records the balance', async () => {
    // Coins earned in pet chores / Night Raid / the shop produce no activity
    // items, so a balance-only sync must still leave a recovery snapshot.
    const world = createWorld();
    const user = await world.createUser({});
    const r = await world.call(activityHandler().onRequestPost, {
      token: user.token, body: { items: [], coinBalance: 700, coinObservedAt: Date.now() },
    });
    assert.equal(r.status, 200);
    assert.equal(snapshotBalance(world.db, user.uid), 700);
  });
});

suite('money server: the asset backup may only ever add', () => {
  const assetsHandler = () => loadModule('functions/api/assets.js');
  const put = (world, user, body) => world.call(assetsHandler().onRequestPut,
    { method: 'PUT', token: user.token, body });

  test('a first sync stores the device assets and echoes them back', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    const r = await put(world, user, {
      accessories: ['bow', 'cap'], castleSkins: ['stone-keep', 'royal-keep'],
      stickers: ['star1'], dogGrowthXP: 30000, streakShields: 2,
    });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.deepEqual(r.data.assets.accessories, ['bow', 'cap']);
    assert.deepEqual(r.data.assets.castleSkins, ['stone-keep', 'royal-keep']);
    assert.equal(r.data.assets.dogGrowthXP, 30000);
    assert.equal(r.data.assets.streakShields, 2);
  });

  test('a wiped device syncing empty arrays cannot shrink the backup', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    await put(world, user, { accessories: ['bow'], castleSkins: ['royal-keep'],
      stickers: ['star1'], dogGrowthXP: 30000, streakShields: 2 });
    const wiped = await put(world, user, {
      accessories: [], castleSkins: [], stickers: [], dogGrowthXP: 0, streakShields: 0,
    });
    assert.deepEqual(wiped.data.assets.accessories, ['bow'], 'owned assets never vanish');
    assert.deepEqual(wiped.data.assets.castleSkins, ['royal-keep']);
    assert.equal(wiped.data.assets.dogGrowthXP, 30000, 'XP is monotonic');
    assert.equal(wiped.data.assets.streakShields, 2);
    // …and the reply IS the restore: the wiped device gets everything back.
  });

  test('new purchases from a second device merge in as a union', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    await put(world, user, { accessories: ['bow'] });
    const merged = await put(world, user, { accessories: ['cap'], stickers: ['star2'] });
    assert.deepEqual(merged.data.assets.accessories.sort(), ['bow', 'cap']);
    assert.deepEqual(merged.data.assets.stickers, ['star2']);
  });

  test('junk is sanitized: bad ids dropped, numbers clamped, shapes tolerated', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    const r = await put(world, user, {
      accessories: ['bow', '<script>', 'x'.repeat(100), 42],
      castleSkins: 'not-an-array',
      dogGrowthXP: 1e12, streakShields: 99,
    });
    assert.deepEqual(r.data.assets.accessories, ['bow', '42']);
    assert.deepEqual(r.data.assets.castleSkins, []);
    assert.equal(r.data.assets.dogGrowthXP, 99999999, 'XP is capped');
    assert.equal(r.data.assets.streakShields, 3, 'shields cap at 3');
  });

  test('GET returns the stored backup and strangers are refused', async () => {
    const world = createWorld();
    const user = await world.createUser({});
    await put(world, user, { accessories: ['bow'] });
    const r = await world.call(assetsHandler().onRequestGet, { method: 'GET', token: user.token });
    assert.deepEqual(r.data.assets.accessories, ['bow']);
    const anon = await world.call(assetsHandler().onRequestGet, { method: 'GET' });
    assert.equal(anon.status, 401);
  });
});

suite('money server: the admin can SEE a wipe before restoring it', () => {
  test('the users list carries the latest and 7-day-peak snapshot balances', async () => {
    const world = createWorld();
    const admin = await world.createUser({ username: 'boss', role: 'admin' });
    const kid = await world.createUser({});
    const quiet = await world.createUser({});
    const gmt7 = ms => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
    const day = 24 * 3600000;
    // Yesterday the child had 5000; today the device reports 0 — a wipe.
    world.db.prepare(`INSERT INTO user_coin_snapshots
      (user_id,snapshot_date,balance,observed_at) VALUES (?,?,?,?)`)
      .run(kid.uid, gmt7(Date.now() - day), 5000, Date.now() - day);
    world.db.prepare(`INSERT INTO user_coin_snapshots
      (user_id,snapshot_date,balance,observed_at) VALUES (?,?,?,?)`)
      .run(kid.uid, gmt7(Date.now()), 0, Date.now());
    const r = await world.call(
      loadModule('functions/api/admin/users.js').onRequestGet,
      { method: 'GET', token: admin.token });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    const row = r.data.users.find(u => u.id === kid.uid);
    assert.equal(row.coin_latest, 0, 'the wiped balance is visible');
    assert.equal(row.coin_peak7, 5000, 'the recoverable peak is right beside it');
    assert.truthy(row.coin_peak7 > row.coin_latest, 'which is what the wipe badge reads');
    const none = r.data.users.find(u => u.id === quiet.uid);
    assert.equal(none.coin_latest, null, 'no snapshots -> no claim about the wallet');
    assert.equal(none.coin_peak7, null);
  });
});

suite('money server: collect adds a delta and respects the cap', () => {
  test('harvest is added to the stored wallet and capped at 100000', async () => {
    const world = createWorld();
    const user = await world.createUser({ allowBot: true });
    world.db.prepare(
      'INSERT INTO night_raid_homes(user_id,layout_json,updated_at) VALUES(?,?,?)'
    ).run(user.uid, JSON.stringify(farmLayout(Date.now() - 1000)), Date.now());
    world.db.prepare('UPDATE night_raid_homes SET lootable_coins=? WHERE user_id=?')
      .run(99990, user.uid);
    const r = await world.call(collectHandler().onRequestPost,
      { token: user.token, body: {} });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.equal(r.data.collectedCoins, 10, 'only the room left under the cap is harvested');
    assert.equal(homeRow(world.db, user.uid).lootable_coins, 100000);
    const again = await world.call(collectHandler().onRequestPost,
      { token: user.token, body: {} });
    assert.truthy(again.data.nothingReady, 'the farm was rescheduled — nothing to double-collect');
    assert.equal(homeRow(world.db, user.uid).lootable_coins, 100000);
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
