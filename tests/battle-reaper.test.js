// battle-reaper.test.js — the arena's only clock.
//
// This project has no cron. reapStale() in functions/api/_battle.js is the
// whole of the arena's housekeeping: it expires invites nobody answered, and
// settles battles whose turn clock ran out so no child is left staring at a
// board the other side walked away from. It runs at the top of every battle
// endpoint, which is why it is also the most expensive thing the account does.
//
// It had NO behavioural test. Đấu Toán's identical reaper has two
// (math-fight-settle, math-fight-list); the arena's had none, so all 571
// battle tests could pass without a single one of them expiring an invite or
// settling a stalled battle. That gap was found while indexing those very
// statements in db/027 — changing how a query is planned, with nothing
// asserting what it does, is exactly the trade you should not make.
//
// The last suite here pins db/027 itself: the two sweeps must ride their
// partial indexes. A migration that drops them would otherwise only show up
// as a Cloudflare bill, or — since 2026-09-01, when D1 began enforcing the
// free-tier ceiling — as the arena failing outright.
'use strict';

const { suite, test, assert } = require('./harness');
const path = require('path');
const { createWorld, loadModule } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const battleLib = () => loadModule('functions/api/_battle.js');
const indexHandler = () => loadModule('functions/api/battle/index.js');

// Two children and a battle row in whatever state the test needs. Times are
// ms epoch, as the table stores them.
async function arena() {
  const world = createWorld();
  const kid = await world.createUser({ username: 'Kid' });
  const friend = await world.createUser({ username: 'Friend' });
  const now = Date.now();

  function put(fields) {
    const row = Object.assign({
      challenger_id: kid.uid, opponent_id: friend.uid, status: 'invited', seed: 7,
      challenger_hp: 100, opponent_hp: 100, turn_started_at: null,
      created_at: now, expires_at: null, finished_at: null, winner_id: null,
    }, fields);
    const cols = Object.keys(row);
    world.db.prepare(
      `INSERT INTO battles (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`
    ).run(...cols.map(c => row[c]));
    return world.db.prepare('SELECT last_insert_rowid() AS id').get().id;
  }
  const read = (id) => world.db.prepare('SELECT * FROM battles WHERE id = ?').get(id);
  return { world, kid, friend, now, put, read };
}

suite('battle reaper: invites nobody answered', () => {
  test('an invite past its window is expired', async () => {
    const a = await arena();
    const id = a.put({ status: 'invited', expires_at: a.now - 1 });
    await battleLib().reapStale(a.world.env);
    assert.equal(a.read(id).status, 'expired', 'a dead invite must not stay pending');
  });

  test('an invite still inside its window is left alone', async () => {
    const a = await arena();
    const id = a.put({ status: 'invited', expires_at: a.now + 60 * 1000 });
    await battleLib().reapStale(a.world.env);
    assert.equal(a.read(id).status, 'invited', 'a live invite must survive the sweep');
  });

  test('an invite with no expiry set is never reaped', async () => {
    // expires_at IS NULL is the guard in the statement; a partial index that
    // quietly changed NULL handling would strand invites as expired.
    const a = await arena();
    const id = a.put({ status: 'invited', expires_at: null });
    await battleLib().reapStale(a.world.env);
    assert.equal(a.read(id).status, 'invited');
  });
});

suite('battle reaper: battles the other side walked away from', () => {
  const STALE = 10 * 60 * 1000;

  test('a battle stalled past the limit is settled on remaining HP', async () => {
    const a = await arena();
    const id = a.put({
      status: 'active', turn_started_at: a.now - STALE - 1000,
      challenger_hp: 70, opponent_hp: 30,
    });
    await battleLib().reapStale(a.world.env);
    const row = a.read(id);
    assert.equal(row.status, 'done', 'nobody may be stuck in a dead battle');
    assert.equal(row.winner_id, a.kid.uid, 'the side with more HP wins');
    assert.truthy(row.finished_at, 'and the finish is stamped, or the cooldown never starts');
  });

  test('the other side winning is settled the same way', async () => {
    const a = await arena();
    const id = a.put({
      status: 'active', turn_started_at: a.now - STALE - 1000,
      challenger_hp: 10, opponent_hp: 90,
    });
    await battleLib().reapStale(a.world.env);
    assert.equal(a.read(id).winner_id, a.friend.uid);
  });

  test('equal HP settles as a draw, not as a win for whoever is listed first', async () => {
    const a = await arena();
    const id = a.put({
      status: 'active', turn_started_at: a.now - STALE - 1000,
      challenger_hp: 50, opponent_hp: 50,
    });
    await battleLib().reapStale(a.world.env);
    const row = a.read(id);
    assert.equal(row.status, 'done');
    assert.equal(row.winner_id, null, 'a draw must not award the battle to anyone');
  });

  test('a battle whose turn clock is still running is untouched', async () => {
    const a = await arena();
    const id = a.put({
      status: 'active', turn_started_at: a.now - 5000, challenger_hp: 70, opponent_hp: 30,
    });
    await battleLib().reapStale(a.world.env);
    const row = a.read(id);
    assert.equal(row.status, 'active', 'a live battle must never be settled under the players');
    assert.equal(row.winner_id, null);
  });

  test('a battle that never started a turn is not treated as abandoned', async () => {
    const a = await arena();
    const id = a.put({ status: 'active', turn_started_at: null });
    await battleLib().reapStale(a.world.env);
    assert.equal(a.read(id).status, 'active');
  });
});

suite('battle reaper: it runs where the arena asks for state', () => {
  test('GET /api/battle sweeps a dead invite before answering', async () => {
    const a = await arena();
    const id = a.put({ status: 'invited', expires_at: a.now - 1 });
    const res = await a.world.call(indexHandler().onRequestGet,
      { method: 'GET', url: '/api/battle', token: a.kid.token });
    assert.truthy(res.ok, 'the arena must load: ' + res.status);
    assert.equal(a.read(id).status, 'expired',
      'the child must not be shown an invite that has already run out');
    assert.falsy(res.data.battle, 'and it must not be handed back as the battle in progress');
  });

  test('a stranger is refused before any sweeping happens', async () => {
    const a = await arena();
    const id = a.put({ status: 'invited', expires_at: a.now - 1 });
    const res = await a.world.call(indexHandler().onRequestGet, { method: 'GET', url: '/api/battle' });
    assert.equal(res.status, 401);
    assert.equal(a.read(id).status, 'invited', 'an unauthenticated call must do no work at all');
  });
});

// db/027. Both sweeps run on every battle request, and `battles` is never
// pruned, so a scan here is a cost that grows forever — it reached 4.4 million
// rows read in one week, 52% of everything this account read.
suite('battle reaper: the sweeps must not scan the table', () => {
  function planFor(db, sql) {
    return db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map(r => r.detail).join(' | ');
  }

  test('expiring invites rides idx_battles_invited_expires', async () => {
    const a = await arena();
    const plan = planFor(a.world.db,
      "UPDATE battles SET status = 'expired' " +
      "WHERE status = 'invited' AND expires_at IS NOT NULL AND expires_at < 1");
    assert.truthy(/USING INDEX idx_battles_invited_expires/.test(plan),
      'the invite sweep fell back to a scan: ' + plan);
    assert.falsy(/SCAN battles/.test(plan), plan);
  });

  test('settling stalled battles rides idx_battles_active_turn', async () => {
    const a = await arena();
    const plan = planFor(a.world.db,
      "UPDATE battles SET status = 'done' " +
      "WHERE status = 'active' AND turn_started_at IS NOT NULL AND turn_started_at < 1");
    assert.truthy(/USING INDEX idx_battles_active_turn/.test(plan),
      'the settle sweep fell back to a scan: ' + plan);
    assert.falsy(/SCAN battles/.test(plan), plan);
  });

  test('both indexes are partial, so only reapable rows are ever indexed', async () => {
    const a = await arena();
    const rows = a.world.db.prepare("SELECT name, partial FROM pragma_index_list('battles')").all();
    const byName = Object.fromEntries(rows.map(r => [r.name, r.partial]));
    for (const name of ['idx_battles_invited_expires', 'idx_battles_active_turn']) {
      assert.truthy(name in byName, name + ' is missing — db/027 was not applied');
      assert.equal(byName[name], 1, name + ' must be partial, or it indexes every finished battle');
    }
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
