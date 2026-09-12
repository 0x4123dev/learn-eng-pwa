// friends-permanent.test.js — once two children are friends on the app, no
// route, no button and no admin page can undo it.
//
// The parent's rule (2026-09-12): a friendship, once accepted, is permanent.
// The server never had an unfriend path; this file makes that a contract —
// every friendship route is EXECUTED against a real SQLite DB, and the
// client and admin pages are checked for any control that would end one.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { createWorld } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

async function befriend(world) {
  const a = await world.createUser({ username: 'anh' });
  const b = await world.createUser({ username: 'bao' });
  const friends = world.loadModule('functions/api/friends/index.js');
  const respond = world.loadModule('functions/api/friends/respond.js');
  const inv = await world.call(friends.onRequestPost, { token: a.token, body: { username: 'bao' } });
  assert.equal(inv.status, 200, 'the invite goes out');
  const row = world.db.prepare('SELECT id, status FROM friendships').get();
  const acc = await world.call(respond.onRequestPost, { token: b.token, body: { friendshipId: row.id, accept: true } });
  assert.equal(acc.status, 200);
  assert.equal(world.db.prepare('SELECT status FROM friendships WHERE id = ?').get(row.id).status, 'accepted');
  return { a, b, friends, respond, id: row.id };
}
const statusOf = (world, id) => world.db.prepare('SELECT status FROM friendships WHERE id = ?').get(id).status;

suite('friends are permanent: the server', () => {
  test('the respond route cannot decline (or re-answer) an accepted friendship', async () => {
    const world = createWorld();
    const { b, a, respond, id } = await befriend(world);
    for (const who of [b, a]) {
      for (const accept of [false, true]) {
        const r = await world.call(respond.onRequestPost, { token: who.token, body: { friendshipId: id, accept } });
        assert.truthy(r.status === 409 || r.status === 403, `${who.username} accept=${accept}: ${r.status}`);
        assert.equal(statusOf(world, id), 'accepted');
      }
    }
  });

  test('inviting an existing friend again changes nothing, in either direction', async () => {
    const world = createWorld();
    const { a, b, friends, id } = await befriend(world);
    const r1 = await world.call(friends.onRequestPost, { token: a.token, body: { username: 'bao' } });
    const r2 = await world.call(friends.onRequestPost, { token: b.token, body: { username: 'anh' } });
    assert.equal(r1.status, 409); assert.equal(r2.status, 409);
    assert.equal(statusOf(world, id), 'accepted');
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM friendships').get().n, 1, 'no second row either');
  });

  test('no friendship route answers DELETE, and none writes a status other than pending/accepted/declined', () => {
    const dir = path.join(ROOT, 'functions', 'api', 'friends');
    for (const f of fs.readdirSync(dir)) {
      const src = read('functions/api/friends/' + f);
      assert.falsy(/onRequestDelete/.test(src), f + ' must not accept DELETE');
      assert.falsy(/DELETE\s+FROM\s+friendships/i.test(src), f + ' must not delete friendships');
      // Every status the route can write is one of the three states; an
      // accepted row is only ever READ from here, never moved.
      for (const m of src.matchAll(/SET\s+status\s*=\s*'([a-z]+)'/g)) {
        assert.truthy(['pending', 'accepted', 'declined'].includes(m[1]), f + ' writes status ' + m[1]);
      }
    }
    // The only UPDATE that goes back to 'pending' is the re-invite of a
    // DECLINED row — the route refuses when the row is accepted first.
    const idx = read('functions/api/friends/index.js');
    assert.truthy(idx.indexOf("existing.status === 'accepted') return err") < idx.indexOf("SET status = 'pending'"),
      'the accepted check must come before the row is reset to pending');
  });

  test('the admin API has no friendship write either', () => {
    const dir = path.join(ROOT, 'functions', 'api', 'admin');
    for (const f of fs.readdirSync(dir)) {
      const src = read('functions/api/admin/' + f);
      assert.falsy(/(UPDATE|DELETE\s+FROM|INSERT\s+INTO)\s+friendships/i.test(src), 'admin/' + f + ' must not write friendships');
    }
  });
});

suite('friends are permanent: the screens', () => {
  test('the friends list renders no unfriend / block / remove control for an accepted friend', () => {
    const src = read('js/friends.js');
    assert.falsy(/unfriend|removeFriend|blockFriend|huỷ kết bạn|hủy kết bạn|xoá bạn|xóa bạn/i.test(src), 'no unfriend control in js/friends.js');
    // The only ✕ is the decline on a PENDING invite (respondFriend(id, false)).
    const declines = [...src.matchAll(/respondFriend\(\$\{(\w+)\.friendshipId\},\s*false\)/g)];
    assert.truthy(declines.length >= 1, 'declining an invite still exists');
    for (const [, v] of declines) assert.truthy(/^(i|inv|invite)$/.test(v), 'decline is wired to an invite entry, not a friend: ' + v);
    // …and only inside the invites block, never in the friends list.
    const friendsList = src.slice(src.indexOf('const list = (friends || []).map'));
    assert.falsy(/respondFriend\(/.test(friendsList), 'no respond/decline control on an accepted friend');
  });

  test('admin.html offers no way to end a friendship', () => {
    assert.falsy(/unfriend|huỷ kết bạn|hủy kết bạn|xoá bạn|xóa bạn|friendships/i.test(read('admin.html')));
  });
});

if (require.main === module) {
  const harness = require('./harness');
  harness.runAll().then(code => process.exit(code));
}
