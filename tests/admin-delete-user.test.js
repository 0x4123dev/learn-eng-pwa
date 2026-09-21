// DELETE /api/admin/users — a permanent delete, executed against the real
// schema. It must take the account AND everything it owns, refuse the two
// accounts whose loss would lock the dashboard, and know about every table
// that names a user (a scan of sqlite_master keeps that list honest).
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const users = () => loadModule('functions/api/admin/users.js');
const del = (w, token, body) => w.call(users().onRequestDelete, { method: 'DELETE', url: '/api/admin/users', token, body });

// Columns that name a user but belong to SOMEONE ELSE's record about them
// (an admin's audit trail), or are not users at all.
const NOT_OWNERSHIP = new Set(['granted_by', 'created_by', 'turn_user_id', 'winner_id', 'leader_id', 'background_id', 'exam_id', 'crop_id', 'battle_id', 'client_session_id', 'device_id', 'item_id']);

suite('admin delete user: the table list matches the schema', () => {
  test('every table with a user-naming column is in USER_TABLES, with that column', () => {
    const { db } = createWorld();
    const listed = new Map(users().USER_TABLES);
    const missing = [];
    for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT IN ('users','config') AND name NOT LIKE 'sqlite_%'").all()) {
      const cols = db.prepare(`PRAGMA table_info(${name})`).all().map(c => c.name)
        .filter(c => /(_id$|user_id)/.test(c) && !NOT_OWNERSHIP.has(c) && c !== 'id');
      for (const c of cols) if (!(listed.get(name) || []).includes(c)) missing.push(`${name}.${c}`);
    }
    assert.deepEqual(missing, [], 'user-naming columns a delete would orphan: ' + missing.join(', '));
    for (const [table, cols] of users().USER_TABLES) {
      const real = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
      assert.truthy(real.length, `${table} is listed but does not exist`);
      for (const c of cols) assert.truthy(real.includes(c), `${table}.${c} is listed but does not exist`);
    }
  });
});

suite('admin delete user: gone for good, with everything it owned', () => {
  async function seeded() {
    const w = createWorld();
    const admin = await w.createUser({ username: 'boss', role: 'admin' });
    const kid = await w.createUser({ username: 'kid' });
    const other = await w.createUser({ username: 'other' });
    const { db } = w;
    const day = '2026-09-21';
    db.prepare("INSERT INTO activities(user_id,type,title,score,total,created_at) VALUES(?,?,?,?,?,?)").run(kid.uid, 'lesson', 'Unit 1 words practice', 5, 5, day + 'T01:00:00Z');
    db.prepare("INSERT INTO user_coin_snapshots(user_id,snapshot_date,balance,observed_at) VALUES(?,?,?,?)").run(kid.uid, day, 300, 1);
    db.prepare("INSERT INTO night_raid_homes(user_id,updated_at) VALUES(?,?)").run(kid.uid, 1);
    db.prepare("INSERT INTO user_assets(user_id,updated_at) VALUES(?,?)").run(kid.uid, 1);
    db.prepare("INSERT INTO coin_grants(user_id,amount,granted_by) VALUES(?,?,?)").run(kid.uid, 50, admin.uid);
    db.prepare("INSERT INTO daily_tasks(user_id,kind,label,target,activity_type,match_json,created_by) VALUES(?,?,?,?,?,?,?)").run(kid.uid, 'word:pr1-1', 'Book 1 · Bài 1-2', 1, 'lesson', '{}', admin.uid);
    db.prepare("INSERT INTO daily_task_rewards(user_id,task_date,coins,shields) VALUES(?,?,?,?)").run(kid.uid, day, 200, 0);
    db.prepare("INSERT INTO farm_seed_inventory(user_id,crop_id,quantity) VALUES(?,?,?)").run(kid.uid, 'lettuce', 2);
    // The same kinds of rows for another learner: they must survive.
    db.prepare("INSERT INTO activities(user_id,type,title,score,total,created_at) VALUES(?,?,?,?,?,?)").run(other.uid, 'lesson', 'Unit 1 words practice', 4, 5, day + 'T01:00:00Z');
    db.prepare("INSERT INTO coin_grants(user_id,amount,granted_by) VALUES(?,?,?)").run(other.uid, 20, admin.uid);
    return { w, admin, kid, other, db };
  }
  const count = (db, table, col, uid) => db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${col} = ?`).get(uid).n;

  test('the account and every row it owns are deleted; the other learner keeps theirs', async () => {
    const { w, admin, kid, other, db } = await seeded();
    const r = await del(w, admin.token, { userId: kid.uid });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    assert.deepEqual(r.data, { ok: true, userId: kid.uid, username: 'kid', deleted: true });
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE id = ?').get(kid.uid).n, 0, 'users row');
    for (const [table, cols] of users().USER_TABLES) for (const col of cols) {
      assert.equal(count(db, table, col, kid.uid), 0, `${table}.${col} still names the deleted user`);
    }
    assert.equal(count(db, 'activities', 'user_id', other.uid), 1);
    assert.equal(count(db, 'coin_grants', 'user_id', other.uid), 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, 2, 'admin + other remain');
    // The admin list no longer shows the account.
    const list = await w.call(users().onRequestGet, { method: 'GET', url: '/api/admin/users', token: admin.token });
    assert.deepEqual(list.data.users.map(u => u.username).sort(), ['boss', 'other']);
  });

  test('a stranger, a learner, a bad id and an unknown id are all refused, and nothing changes', async () => {
    const { w, admin, kid, other, db } = await seeded();
    const before = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
    assert.equal((await del(w, null, { userId: kid.uid })).status, 401);
    assert.equal((await del(w, other.token, { userId: kid.uid })).status, 403, 'a learner cannot delete another learner');
    assert.equal((await del(w, admin.token, { userId: 'x' })).status, 400);
    assert.equal((await del(w, admin.token, {})).status, 400);
    assert.equal((await del(w, admin.token, { userId: 99999 })).status, 404);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n, before);
    assert.equal(count(db, 'activities', 'user_id', kid.uid), 1);
  });

  test('never yourself, never another admin — the dashboard cannot be locked by one tap', async () => {
    const { w, admin, db } = await seeded();
    const admin2 = await w.createUser({ username: 'boss2', role: 'admin' });
    const self = await del(w, admin.token, { userId: admin.uid });
    assert.equal(self.status, 400); assert.equal(self.data.code, 'self_delete');
    const peer = await del(w, admin.token, { userId: admin2.uid });
    assert.equal(peer.status, 400); assert.equal(peer.data.code, 'admin_delete');
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE role='admin'").get().n, 2);
  });

  test('a deleted account cannot log in again and its old token is dead', async () => {
    const { w, admin, kid } = await seeded();
    await del(w, admin.token, { userId: kid.uid });
    const me = loadModule('functions/api/me/attempts.js');
    const r = await w.call(me.onRequestGet, { method: 'GET', url: '/api/me/attempts', token: kid.token });
    assert.truthy(r.status === 401 || r.status === 403, 'old token must be refused, got ' + r.status);
    const login = loadModule('functions/api/login.js');
    const l = await w.call(login.onRequestPost, { url: '/api/login', body: { username: 'kid', passcode: '1234' } });
    assert.truthy(l.status >= 400 && l.status < 500, 'login must fail, got ' + l.status);
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
