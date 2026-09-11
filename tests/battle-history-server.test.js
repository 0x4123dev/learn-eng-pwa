// battle-history-server.test.js — GET /api/battle/history, the read-back the
// arena's 📜 Lịch sử đấu is rebuilt from.
//
// Before this route, battle history was written by ONE phone: whichever
// client was polling when the last shot landed appended the entry in
// finishPetBattle. Two children sharing a phone — A battles B from A's
// profile — left B's history without the battle, and B unpaid. The server
// row was always the truth; nobody read it back. These tests run the real
// handler against a real SQLite database (tests/pages-harness.js).
'use strict';

const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const history = () => loadModule('functions/api/battle/history.js');

// Two children and a finished battle between them, with its turns.
async function arena() {
  const world = createWorld();
  const a = await world.createUser({ username: 'An' });
  const b = await world.createUser({ username: 'Bình' });
  const stranger = await world.createUser({ username: 'Lạ' });
  const now = Date.now();

  function battle(fields) {
    const row = Object.assign({
      challenger_id: a.uid, opponent_id: b.uid, status: 'done', seed: 7,
      challenger_name: 'An', opponent_name: 'Bình',
      challenger_level: 12, opponent_level: 9,
      challenger_hp: 55, opponent_hp: 0, winner_id: a.uid,
      turn_no: 3, turn_started_at: null,
      created_at: now - 600000, expires_at: null, finished_at: now - 300000,
    }, fields);
    const cols = Object.keys(row);
    world.db.prepare(
      `INSERT INTO battles (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...cols.map(c => row[c]));
    return world.db.prepare('SELECT last_insert_rowid() AS id').get().id;
  }
  function turn(battleId, turnNo, userId, fields) {
    const row = Object.assign({
      battle_id: battleId, turn_no: turnNo, user_id: userId,
      angle: 45, power: 80, shots: 2, damage: 30, abilities: '[]', rocket: 0, created_at: now - 500000 + turnNo,
    }, fields || {});
    const cols = Object.keys(row);
    world.db.prepare(
      `INSERT INTO battle_turns (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...cols.map(c => row[c]));
  }
  const get = (user, qs) => world.call(history().onRequestGet,
    { method: 'GET', url: '/api/battle/history' + (qs || ''), token: user && user.token });
  return { world, a, b, stranger, now, battle, turn, get };
}

suite('battle history route: who may read it', () => {
  test('a stranger with no token is refused', async () => {
    const t = await arena();
    t.battle();
    const r = await t.get(null);
    assert.equal(r.status, 401);
  });

  test('a signed-in child who was in neither seat sees no battles', async () => {
    const t = await arena();
    t.battle();
    const r = await t.get(t.stranger);
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.battles, []);
    assert.equal(r.data.wins, 0);
  });

  test('an empty history is an empty list, not an error', async () => {
    const t = await arena();
    const r = await t.get(t.a);
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.battles, []);
  });
});

suite('battle history route: both children see the same battle, each from their side', () => {
  test('the challenger and the opponent get mirrored me/foe', async () => {
    const t = await arena();
    const id = t.battle();
    t.turn(id, 1, t.a.uid, { damage: 40, shots: 3 });
    t.turn(id, 2, t.b.uid, { damage: 45, shots: 2 });
    t.turn(id, 3, t.a.uid, { damage: 60, shots: 3, rocket: 1, abilities: '["shield"]' });

    const ra = await t.get(t.a);
    const rb = await t.get(t.b);
    assert.equal(ra.status, 200); assert.equal(rb.status, 200);
    assert.equal(ra.data.battles.length, 1);
    assert.equal(rb.data.battles.length, 1);
    const fa = ra.data.battles[0], fb = rb.data.battles[0];

    assert.equal(fa.id, id); assert.equal(fb.id, id);
    assert.equal(fa.status, 'done'); assert.equal(fb.status, 'done');
    assert.equal(fa.finishedAt, t.now - 300000);
    // An's view
    assert.equal(fa.me.id, t.a.uid); assert.equal(fa.me.name, 'An'); assert.equal(fa.me.level, 12); assert.equal(fa.me.hp, 55);
    assert.equal(fa.foe.id, t.b.uid); assert.equal(fa.foe.name, 'Bình'); assert.equal(fa.foe.level, 9); assert.equal(fa.foe.hp, 0);
    assert.truthy(fa.iAmChallenger);
    // Bình's view is the mirror image
    assert.equal(fb.me.id, t.b.uid); assert.equal(fb.me.name, 'Bình'); assert.equal(fb.me.hp, 0);
    assert.equal(fb.foe.id, t.a.uid); assert.equal(fb.foe.name, 'An'); assert.equal(fb.foe.hp, 55);
    assert.falsy(fb.iAmChallenger);
    // same winner, same verdict
    assert.equal(fa.winnerId, t.a.uid); assert.equal(fb.winnerId, t.a.uid);
    assert.falsy(fa.draw); assert.falsy(fb.draw);
    // the win count is per viewer
    assert.equal(ra.data.wins, 1);
    assert.equal(rb.data.wins, 0);
  });

  test('the turns come with the battle, in order, with who fired them', async () => {
    const t = await arena();
    const id = t.battle();
    t.turn(id, 1, t.a.uid, { damage: 40, shots: 3, angle: 50, power: 75 });
    t.turn(id, 2, t.b.uid, { damage: 45, shots: 2 });
    t.turn(id, 3, t.a.uid, { damage: 60, shots: 3, rocket: 1, abilities: '["shield"]' });
    const r = await t.get(t.b);
    const turns = r.data.battles[0].turns;
    assert.equal(turns.length, 3);
    assert.deepEqual(turns.map(x => x.turnNo), [1, 2, 3]);
    assert.deepEqual(turns.map(x => x.userId), [t.a.uid, t.b.uid, t.a.uid]);
    assert.deepEqual(turns.map(x => x.damage), [40, 45, 60]);
    assert.deepEqual(turns.map(x => x.shots), [3, 2, 3]);
    assert.equal(turns[0].angle, 50); assert.equal(turns[0].power, 75);
    assert.equal(turns[2].rocket, 1);
    assert.deepEqual(turns[2].abilities, ['shield']);
    assert.deepEqual(turns[0].abilities, []);
  });

  test('a draw is labelled a draw for both', async () => {
    const t = await arena();
    t.battle({ challenger_hp: 30, opponent_hp: 30, winner_id: null });
    const ra = await t.get(t.a), rb = await t.get(t.b);
    assert.truthy(ra.data.battles[0].draw);
    assert.truthy(rb.data.battles[0].draw);
    assert.equal(ra.data.battles[0].winnerId, null);
  });

  test('only FINISHED battles are history — an active or expired one is not', async () => {
    const t = await arena();
    t.battle({ status: 'active', finished_at: null, winner_id: null });
    t.battle({ status: 'expired', finished_at: null, winner_id: null });
    t.battle({ status: 'declined', finished_at: null, winner_id: null });
    const done = t.battle();
    const r = await t.get(t.a);
    assert.deepEqual(r.data.battles.map(b => b.id), [done]);
  });

  test('newest first, and the turns of several battles do not bleed into each other', async () => {
    const t = await arena();
    const old = t.battle({ finished_at: t.now - 900000 });
    const mid = t.battle({ finished_at: t.now - 600000, challenger_id: t.b.uid, opponent_id: t.a.uid, winner_id: t.b.uid });
    const recent = t.battle({ finished_at: t.now - 100000 });
    t.turn(old, 1, t.a.uid, { damage: 1 });
    t.turn(mid, 1, t.b.uid, { damage: 2 });
    t.turn(mid, 2, t.a.uid, { damage: 3 });
    t.turn(recent, 1, t.a.uid, { damage: 4 });
    const r = await t.get(t.a);
    assert.deepEqual(r.data.battles.map(b => b.id), [recent, mid, old]);
    assert.deepEqual(r.data.battles.map(b => b.turns.map(x => x.damage)), [[4], [2, 3], [1]]);
    // `mid` was fought from the other seat: still my battle, viewed from my side.
    assert.equal(r.data.battles[1].me.id, t.a.uid);
    assert.falsy(r.data.battles[1].iAmChallenger);
    assert.equal(r.data.wins, 2);
  });
});

suite('battle history route: ?since keeps the repeat call cheap', () => {
  test('since=<ms> returns only battles finished after that moment', async () => {
    const t = await arena();
    t.battle({ finished_at: t.now - 900000 });
    const mid = t.battle({ finished_at: t.now - 600000 });
    const recent = t.battle({ finished_at: t.now - 100000 });
    const r = await t.get(t.a, '?since=' + (t.now - 700000));
    assert.deepEqual(r.data.battles.map(b => b.id), [recent, mid]);
  });

  test('since equal to the newest finished_at returns nothing — the steady state', async () => {
    const t = await arena();
    t.battle({ finished_at: t.now - 100000 });
    const r = await t.get(t.a, '?since=' + (t.now - 100000));
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.battles, []);
    assert.equal(r.data.wins, 1, 'the lifetime count is still reported');
  });

  test('a garbage since is treated as 0', async () => {
    const t = await arena();
    const id = t.battle();
    const r = await t.get(t.a, '?since=abc');
    assert.equal(r.status, 200);
    assert.deepEqual(r.data.battles.map(b => b.id), [id]);
  });

  test('the list is capped at HISTORY_MAX', async () => {
    const t = await arena();
    const max = history().HISTORY_MAX;
    for (let i = 0; i < max + 5; i++) t.battle({ finished_at: t.now - 1000000 + i });
    const r = await t.get(t.a);
    assert.equal(r.data.battles.length, max);
    assert.equal(r.data.battles[0].finishedAt, t.now - 1000000 + max + 4, 'the newest are the ones kept');
  });

  test('the response is never cached', async () => {
    const t = await arena();
    const req = new Request('http://app.test/api/battle/history', { headers: { Authorization: 'Bearer ' + t.a.token } });
    const res = await history().onRequestGet({ request: req, env: t.world.env });
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
