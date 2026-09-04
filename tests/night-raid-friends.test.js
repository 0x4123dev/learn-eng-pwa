// "Bạn bè · khi nào cướp được" — the server side, EXECUTED against a real
// SQLite DB through tests/pages-harness.js (never substring-checked):
//   - a WON raid seals the defender for exactly 24 h, a LOST one seals nothing;
//   - start on a sealed home bounces with the same lockedUntil the list shows;
//   - GET /api/night-raid/friends lists only accepted friends WITH a home,
//     computes canRaidNow/availableAt the way start.js decides, sorts the
//     raidable ones first and leaks no layout, DEF or other-user shield clock.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const DAY = 24 * 3600 * 1000;
const homeHandler = () => loadModule('functions/api/night-raid/home.js');
const startHandler = () => loadModule('functions/api/night-raid/start.js');
const finishHandler = () => loadModule('functions/api/night-raid/finish.js');
const friendsHandler = () => loadModule('functions/api/night-raid/friends.js');
const targetsHandler = () => loadModule('functions/api/night-raid/targets.js');
const helper = () => loadModule('functions/api/_night-raid.js');

// A home whose strength is set by the dog and the barracks alone (no walls),
// so who wins a raid is decided by numbers this test controls.
async function seedHome(world, user, o) {
  o = o || {};
  const r = await world.call(homeHandler().onRequestPut, {
    url: '/api/night-raid/home', method: 'PUT', token: user.token,
    body: { layout: { cells: [], soldiers: o.soldiers == null ? 0 : o.soldiers, dogLane: 2 },
      dogLevel: o.dogLevel || 1, castleSkin: 'stone-keep', coins: o.coins == null ? 800 : o.coins },
  });
  assert.truthy(r.ok, 'seeding the home must succeed: ' + JSON.stringify(r.data));
}
const STRONG = { dogLevel: 100, soldiers: 10 };
const WEAK = { dogLevel: 1, soldiers: 0 };

function befriend(world, a, b, status) {
  world.db.prepare("INSERT INTO friendships (requester_id, addressee_id, status, responded_at) VALUES (?,?,?,datetime('now'))")
    .run(a.uid, b.uid, status || 'accepted');
}
const homeRow = (world, uid) => world.db.prepare('SELECT * FROM night_raid_homes WHERE user_id=?').get(uid);

async function raid(world, attacker, defender) {
  const s = await world.call(startHandler().onRequestPost, { token: attacker.token, body: { targetId: defender.uid } });
  assert.truthy(s.ok && s.data && s.data.raid, 'start must create a raid: ' + JSON.stringify(s.data));
  const f = await world.call(finishHandler().onRequestPost, { token: attacker.token, body: { raidId: s.data.raid.raidId } });
  assert.truthy(f.ok && f.data && f.data.result, 'finish must resolve: ' + JSON.stringify(f.data));
  const row = world.db.prepare('SELECT finished_at FROM night_raids WHERE id=?').get(s.data.raid.raidId);
  return { result: f.data.result, finishedAt: Number(row.finished_at) };
}
async function friendsOf(world, user) {
  const r = await world.call(friendsHandler().onRequestGet, { method: 'GET', url: '/api/night-raid/friends', token: user.token });
  assert.truthy(r.ok, 'friends must answer 200: ' + JSON.stringify(r.data));
  return r.data;
}

suite('night raid: the 24 h seal, executed', () => {
  test('a WON raid seals the defender for exactly 24 hours from the moment it finished', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true }), defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, STRONG); await seedHome(world, defender, WEAK);
    const { result, finishedAt } = await raid(world, attacker, defender);
    assert.equal(result.won, true, 'the fixture must produce a win: ' + JSON.stringify(result));
    const until = Number(homeRow(world, defender.uid).ruined_until);
    assert.equal(until - finishedAt, DAY, 'ruined_until = finished_at + 24 h, to the millisecond');
    assert.equal(result.lockedUntil, until, 'the result tells the attacker the same deadline');
    assert.equal(helper().RAID_LOCK_MS, DAY, 'the constant itself is 24 h');
  });

  test('a LOST raid seals nothing', async () => {
    const world = createWorld();
    const attacker = await world.createUser({ allowBot: true }), defender = await world.createUser({ allowBot: true });
    await seedHome(world, attacker, WEAK); await seedHome(world, defender, STRONG);
    const { result } = await raid(world, attacker, defender);
    assert.equal(result.won, false, 'the fixture must produce a loss: ' + JSON.stringify(result));
    assert.equal(result.lockedUntil, 0);
    assert.equal(homeRow(world, defender.uid).ruined_until, null, 'no seal is written for a failed raid');
  });

  test('start on a sealed home bounces with the lockedUntil the friends list shows', async () => {
    const world = createWorld();
    const winner = await world.createUser({ allowBot: true }), defender = await world.createUser({ allowBot: true });
    const friend = await world.createUser({ allowBot: true });
    await seedHome(world, winner, STRONG); await seedHome(world, defender, WEAK); await seedHome(world, friend, STRONG);
    befriend(world, defender, friend);
    await raid(world, winner, defender);
    const until = Number(homeRow(world, defender.uid).ruined_until);

    const list = await friendsOf(world, friend);
    assert.equal(list.friends.length, 1);
    assert.equal(list.friends[0].targetId, defender.uid);
    assert.equal(list.friends[0].lockedUntil, until);
    assert.equal(list.friends[0].availableAt, until);
    assert.equal(list.friends[0].canRaidNow, false);

    const s = await world.call(startHandler().onRequestPost, { token: friend.token, body: { targetId: defender.uid } });
    assert.truthy(s.ok, 'the bounce is a 200, not an error');
    assert.equal(s.data.locked, true);
    assert.equal(s.data.lockedUntil, until, 'start and the list quote one deadline');
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM night_raids WHERE attacker_id=?').get(friend.uid).n, 0,
      'a bounced visit writes no raid row');
  });
});

suite('GET /api/night-raid/friends', () => {
  test('needs a token and a Phase-2 account', async () => {
    const world = createWorld();
    const anon = await world.call(friendsHandler().onRequestGet, { method: 'GET' });
    assert.equal(anon.status, 401);
    const off = await world.createUser({});
    const r = await world.call(friendsHandler().onRequestGet, { method: 'GET', token: off.token });
    assert.equal(r.status, 403);
  });

  test('lists only ACCEPTED friends who have a home, whichever way the friendship points', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true, username: 'me' });
    await seedHome(world, me, WEAK);
    const iAsked = await world.createUser({ allowBot: true, username: 'iAsked' });      // I requested, they accepted
    const theyAsked = await world.createUser({ allowBot: true, username: 'theyAsked' }); // they requested, I accepted
    const noHome = await world.createUser({ allowBot: true, username: 'noHome' });
    const pending = await world.createUser({ allowBot: true, username: 'pending' });
    const declined = await world.createUser({ allowBot: true, username: 'declined' });
    const gone = await world.createUser({ allowBot: true, username: 'gone' });
    const stranger = await world.createUser({ allowBot: true, username: 'stranger' });
    for (const u of [iAsked, theyAsked, pending, declined, gone, stranger]) await seedHome(world, u, WEAK);
    befriend(world, me, iAsked, 'accepted');
    befriend(world, theyAsked, me, 'accepted');
    befriend(world, me, noHome, 'accepted');
    befriend(world, pending, me, 'pending');
    befriend(world, me, declined, 'declined');
    befriend(world, me, gone, 'accepted');
    world.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(gone.uid);

    const list = await friendsOf(world, me);
    const ids = list.friends.map(f => f.targetId).sort();
    assert.deepEqual(ids, [iAsked.uid, theyAsked.uid].sort(), 'exactly the two accepted friends with homes');
    for (const f of list.friends) {
      assert.equal(f.canRaidNow, true);
      assert.equal(f.lockedUntil, 0);
      assert.equal(f.availableAt, 0);
      assert.equal(f.visitedToday, false);
      assert.equal(f.shielded, false);
      assert.equal(f.difficulty, 'Cân bằng');
      assert.equal(f.homeLevel, 1);
    }
    assert.equal(typeof list.ticketsLeft, 'number');
  });

  test('sends timing, name and level ONLY — no layout, no DEF, no shield clock of another child', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true });
    const shielded = await world.createUser({ allowBot: true, username: 'shieldy' });
    await seedHome(world, me, WEAK); await seedHome(world, shielded, STRONG);
    befriend(world, me, shielded);
    const shieldUntil = Date.now() + 3600000;
    world.db.prepare('UPDATE night_raid_homes SET shield_until=? WHERE user_id=?').run(shieldUntil, shielded.uid);

    const list = await friendsOf(world, me);
    const f = list.friends[0];
    assert.deepEqual(Object.keys(f).sort(),
      ['availableAt', 'canRaidNow', 'difficulty', 'homeLevel', 'level', 'lockedUntil', 'name', 'shielded', 'targetId', 'visitedToday'],
      'the entry carries nothing but timing, name and level');
    assert.equal(f.shielded, true, 'a shield is announced…');
    assert.equal(Object.values(f).includes(shieldUntil), false, '…but its deadline is never sent');
    const text = JSON.stringify(list);
    for (const leak of ['layout', 'cells', 'defense', 'damage', 'lootable', 'dogLevel', 'castleHp', 'shieldUntil":' + shieldUntil]) {
      assert.equal(text.includes(leak), false, 'must not leak ' + leak);
    }
    assert.equal(f.canRaidNow, true, 'a shielded home can still be visited — the raider just loses');
  });

  test('a friend I already visited today is not raidable again until the next Night Raid day', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), buddy = await world.createUser({ allowBot: true });
    const other = await world.createUser({ allowBot: true });
    await seedHome(world, me, WEAK); await seedHome(world, buddy, STRONG); await seedHome(world, other, WEAK);
    befriend(world, me, buddy); befriend(world, other, buddy);
    const before = Date.now();
    const { result } = await raid(world, me, buddy);
    assert.equal(result.won, false, 'this fixture loses on purpose, so no seal is involved');

    const mine = (await friendsOf(world, me)).friends[0];
    assert.equal(mine.lockedUntil, 0, 'a lost raid seals nothing…');
    assert.equal(mine.visitedToday, true);
    assert.equal(mine.canRaidNow, false, '…but start.js would still refuse a second visit today');
    assert.truthy(mine.availableAt > before, 'so the countdown runs to the next Night Raid day');
    assert.equal(mine.availableAt, friendsHandler().nextNightStart(mine.availableAt - 1),
      'availableAt is exactly the ICT midnight that starts the next raid day');
    assert.equal(helper().nightDate(mine.availableAt) > helper().nightDate(before), true);
    assert.equal(helper().nightDate(mine.availableAt - 1), helper().nightDate(before));
    const s = await world.call(startHandler().onRequestPost, { token: me.token, body: { targetId: buddy.uid } });
    assert.equal(s.status, 409, 'start agrees: visited today');

    const theirs = (await friendsOf(world, other)).friends[0];
    assert.equal(theirs.targetId, buddy.uid);
    assert.equal(theirs.canRaidNow, true, 'someone else can still raid that home right now');
    assert.equal(theirs.visitedToday, false);
  });

  test('raidable friends sort first, then whoever opens up soonest', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true, username: 'me' });
    await seedHome(world, me, WEAK);
    const soon = await world.createUser({ allowBot: true, username: 'a-soon' });
    const later = await world.createUser({ allowBot: true, username: 'b-later' });
    const openZ = await world.createUser({ allowBot: true, username: 'z-open' });
    const openA = await world.createUser({ allowBot: true, username: 'a-open' });
    for (const u of [soon, later, openZ, openA]) { await seedHome(world, u, WEAK); befriend(world, me, u); }
    const now = Date.now();
    world.db.prepare('UPDATE night_raid_homes SET ruined_until=? WHERE user_id=?').run(now + 2 * 3600000, soon.uid);
    world.db.prepare('UPDATE night_raid_homes SET ruined_until=? WHERE user_id=?').run(now + 20 * 3600000, later.uid);

    const list = await friendsOf(world, me);
    assert.deepEqual(list.friends.map(f => f.name), ['a-open', 'z-open', 'a-soon', 'b-later']);
    assert.deepEqual(list.friends.map(f => f.canRaidNow), [true, true, false, false]);
    assert.equal(list.friends[2].lockedUntil, now + 2 * 3600000);
    assert.equal(list.friends[3].lockedUntil, now + 20 * 3600000);
  });

  test('an expired seal reads as raidable — raidLockUntil, not the raw column', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), buddy = await world.createUser({ allowBot: true });
    await seedHome(world, me, WEAK); await seedHome(world, buddy, WEAK); befriend(world, me, buddy);
    world.db.prepare('UPDATE night_raid_homes SET ruined_until=? WHERE user_id=?').run(Date.now() - 1000, buddy.uid);
    const f = (await friendsOf(world, me)).friends[0];
    assert.equal(f.lockedUntil, 0);
    assert.equal(f.canRaidNow, true);
  });

  test('me: my own seal and shield clock, the way home.js reports them', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true });
    const homeless = await world.createUser({ allowBot: true });
    await seedHome(world, me, WEAK);
    const now = Date.now();
    world.db.prepare('UPDATE night_raid_homes SET ruined_until=?, shield_until=? WHERE user_id=?').run(now + DAY, now + 7200000, me.uid);

    const list = await friendsOf(world, me);
    assert.equal(list.me.hasHome, true);
    assert.equal(list.me.lockedUntil, now + DAY);
    assert.equal(list.me.shieldUntil, now + 7200000, 'the owner may see their own shield deadline');
    const home = await world.call(homeHandler().onRequestGet, { method: 'GET', token: me.token });
    assert.equal(home.data.home.lockedUntil, list.me.lockedUntil, 'same number GET /home reports');
    assert.equal(home.data.home.shieldUntil, list.me.shieldUntil);

    const none = await friendsOf(world, homeless);
    assert.equal(none.me.hasHome, false);
    assert.equal(none.me.lockedUntil, 0);
    assert.equal(none.me.shieldUntil, 0);
    assert.deepEqual(none.friends, []);
  });

  test('difficulty is the label targets.js puts on the same home', async () => {
    const world = createWorld();
    const me = await world.createUser({ allowBot: true }), tough = await world.createUser({ allowBot: true });
    await seedHome(world, me, WEAK); await seedHome(world, tough, WEAK); befriend(world, me, tough);
    world.db.prepare('UPDATE night_raid_homes SET home_level=9 WHERE user_id=?').run(tough.uid);

    const fromFriends = (await friendsOf(world, me)).friends[0];
    const t = await world.call(targetsHandler().onRequestGet, { method: 'GET', token: me.token });
    assert.truthy(t.ok, JSON.stringify(t.data));
    const fromTargets = t.data.targets.find(x => x.targetId === tough.uid);
    assert.truthy(fromTargets, 'the only other home must be offered as a target');
    assert.equal(fromFriends.difficulty, 'Khó');
    assert.equal(fromFriends.difficulty, fromTargets.difficulty);
    assert.equal(fromFriends.homeLevel, fromTargets.homeLevel);
    assert.equal(fromFriends.lockedUntil, fromTargets.lockedUntil);
    const { difficultyLabel } = friendsHandler();
    assert.equal(difficultyLabel(1, 5), 'Dễ');
    assert.equal(difficultyLabel(3, 5), 'Cân bằng');
    assert.equal(difficultyLabel(7, 5), 'Cân bằng');
    assert.equal(difficultyLabel(8, 5), 'Khó');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
