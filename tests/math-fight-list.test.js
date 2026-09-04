// math-fight-list.test.js — GET /api/math-fight, executed against a real
// database, because this list is polled every 3 seconds by every open Đấu Toán
// tab and the refactor that made it cheap must not have changed a single field.
//
// What it used to do, per poll: one query for the friendships, then pairState()
// AND currentFight() for EACH friend, plus currentFight() for the child and the
// two reaper statements — 2N+4 D1 round trips, 44 of them for a child with
// twenty friends, three times a second, per device. It now issues a fixed
// handful whatever N is.
//
// The list is the gate on a child's money: `readyAt` is the pair's 3-day
// cooldown, `friendReadyAt` is the 3-day wait on a brand-new friendship, and
// `busy` is what stops a challenge being sent into a fight already in progress.
// A friend row that quietly loses one of those is worse than a slow poll, so
// the first test below re-runs the OLD per-friend loop against the same
// database and demands the two answers be identical.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const { createWorld, loadModule } = require('./pages-harness');

const ROOT = path.join(__dirname, '..');
const MF = require(path.join(ROOT, 'js', 'math-fight-rules.js'));
const { MATH_FIGHT_BANK } = require(path.join(ROOT, 'js', 'math-fight-bank.js'));

const listHandler = () => loadModule('functions/api/math-fight/index.js');
const helpers = () => loadModule('functions/api/_math-fight.js');

const MIGRATION_026 = 'db/026-math-fight-deadline-index.sql';
const DAY = 24 * 3600 * 1000;

// The exact friendships query the handler runs. Duplicated on purpose: the
// legacy loop below has to start from the same rows to be a fair comparison.
const FRIENDS_SQL =
  `SELECT CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END AS friend_id,
          CASE WHEN f.requester_id = ? THEN au.username ELSE ru.username END AS friend_name,
          strftime('%s', COALESCE(f.responded_at, f.created_at)) AS since
     FROM friendships f
     JOIN users ru ON ru.id = f.requester_id
     JOIN users au ON au.id = f.addressee_id
    WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
      AND ru.disabled = 0 AND au.disabled = 0`;

function freshWorld() {
  const world = createWorld();
  // db/026 is not in the harness's SQL_FILES yet; applying it here keeps the
  // test honest about the schema the handler now assumes, and proves the file
  // replays cleanly on top of db/011.
  world.db.exec(fs.readFileSync(path.join(ROOT, MIGRATION_026), 'utf8'));
  world.db.prepare("INSERT OR REPLACE INTO app_flags(key,value,updated_at) VALUES('math_fight',1,0)").run();
  return world;
}

function befriend(world, a, b, ago) {
  world.db.prepare(
    `INSERT INTO friendships (requester_id, addressee_id, status, created_at, responded_at)
     VALUES (?,?,'accepted', datetime('now', ?), datetime('now', ?))`
  ).run(a, b, ago, ago);
}

function setPair(world, a, b, leaderId, streak, nextReadyAt) {
  const { lo, hi } = MF.pairKey(a, b);
  world.db.prepare(
    `INSERT INTO math_fight_pairs(lo_id,hi_id,leader_id,streak,next_ready_at,updated_at)
     VALUES(?,?,?,?,?,?)`
  ).run(lo, hi, leaderId, streak, nextReadyAt, Date.now());
}

let fightSeq = 0;
function putFight(world, challenger, opponent, status, o) {
  o = o || {};
  const id = String(++fightSeq).padStart(32, 'f');
  const now = Date.now();
  world.db.prepare(
    `INSERT INTO math_fights(id,challenger_id,opponent_id,prize,seed,challenger_level,opponent_level,
       status,created_at,expires_at,started_at,deadline_at)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(id, challenger, opponent, MF.PRIZE, 123456, 3, 3, status, now,
    o.expiresAt === undefined ? now + 60000 : o.expiresAt,
    o.startedAt === undefined ? null : o.startedAt,
    o.deadlineAt === undefined ? null : o.deadlineAt);
  return id;
}

// One child, nine other accounts, every state the list can be in at once.
// ASCII names only, so the Vietnamese collation in the handler's sort produces
// the same order on every ICU build.
async function listWorld() {
  const world = freshWorld();
  // Created FIRST so its id sorts BELOW the child's. Its pair row is therefore
  // stored as (lo_id = Anh, hi_id = Kid) and is only reachable through the
  // hi_id half of the new one-shot read — the half that had no index at all.
  const anh = await world.createUser({ username: 'Anh' });
  const kid = await world.createUser({ username: 'Kid' });
  const bao = await world.createUser({ username: 'Bao' });
  const cuc = await world.createUser({ username: 'Cuc' });
  const dao = await world.createUser({ username: 'Dao' });
  const ell = await world.createUser({ username: 'Ell' });
  const fen = await world.createUser({ username: 'Fen' });
  const gia = await world.createUser({ username: 'Gia' });
  const hoa = await world.createUser({ username: 'Hoa' });
  const zed = await world.createUser({ username: 'Zed' });   // never a friend

  for (const f of [anh, bao, cuc, dao, ell, gia, hoa]) befriend(world, kid.uid, f.uid, '-10 days');
  befriend(world, fen.uid, kid.uid, '-1 hour');              // brand new, and the OTHER way round
  world.db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(hoa.uid);

  const now = Date.now();
  const past = now - 90 * 1000;
  const future = now + 2 * DAY;
  setPair(world, kid.uid, anh.uid, kid.uid, 4, past);   // handicap streak, cooldown already up
  setPair(world, kid.uid, cuc.uid, cuc.uid, 1, future); // still cooling down
  setPair(world, kid.uid, gia.uid, null, 0, 0);         // fought long ago, clock cleared
  // Bao has never fought Kid at all — no row.

  // Dao is mid-bout with Kid; Ell has an unanswered invite from a stranger.
  // Both deadlines are in the future so the reaper leaves them alone.
  const myFight = putFight(world, kid.uid, dao.uid, 'active',
    { startedAt: now - 10000, deadlineAt: now + MF.SECONDS * 1000 });
  putFight(world, zed.uid, ell.uid, 'invited', { expiresAt: now + 60000 });

  return { world, kid, anh, bao, cuc, dao, ell, fen, gia, hoa, zed, myFight, now };
}

function get(world, user) {
  return world.call(listHandler().onRequestGet, { method: 'GET', url: '/api/math-fight', token: user.token });
}

// Counts the SQL statements a call actually prepares. tests/d1-mock.js has no
// counter of its own, so this wraps env.DB.prepare — real statements, really
// executed, just tallied on the way through.
function spyQueries(world) {
  const DB = world.env.DB;
  const real = DB.prepare.bind(DB);
  const log = [];
  DB.prepare = (sql) => { log.push(String(sql).replace(/\s+/g, ' ').trim()); return real(sql); };
  return log;
}

suite('math fight list: the set-based read returns exactly the old answer', () => {
  test('every friend row is identical to what the per-friend loop produced', async () => {
    const { world, kid } = await listWorld();
    const res = await get(world, kid);
    assert.equal(res.status, 200, JSON.stringify(res.data));

    // The loop this endpoint used to run, re-implemented from the same helpers
    // against the same database, AFTER the same reap. If the refactor dropped
    // a cooldown or a busy flag, these two arrays stop matching.
    const H = helpers();
    const rows = await world.env.DB.prepare(FRIENDS_SQL)
      .bind(kid.uid, kid.uid, kid.uid, kid.uid).all();
    const legacy = [];
    for (const r of (rows.results || [])) {
      const pair = await H.pairState(world.env, kid.uid, r.friend_id);
      const busy = await H.currentFight(world.env, r.friend_id);
      legacy.push({
        userId: r.friend_id,
        username: r.friend_name || 'Bạn',
        readyAt: pair.nextReadyAt || null,
        friendReadyAt: Number(r.since) * 1000 + MF.COOLDOWN_MS,
        busy: !!busy,
      });
    }
    legacy.sort((a, b) => a.username.localeCompare(b.username, 'vi'));

    assert.equal(legacy.length, 7, 'the fixture must actually exercise seven friends');
    assert.deepEqual(res.data.friends, legacy,
      'the one-shot read must be byte-identical to the per-friend loop');
  });

  test('each state the list can be in is still reported correctly', async () => {
    const { world, kid, anh, bao, cuc, dao, ell, fen, gia, now } = await listWorld();
    const res = await get(world, kid);
    const by = {};
    for (const f of res.data.friends) by[f.username] = f;

    assert.deepEqual(Object.keys(by).sort(), ['Anh', 'Bao', 'Cuc', 'Dao', 'Ell', 'Fen', 'Gia']);
    assert.equal(res.data.friends.map(f => f.username).join(','), 'Anh,Bao,Cuc,Dao,Ell,Fen,Gia',
      'the list is still sorted by name');

    // Ids survive the join, and they are the ids the client posts back.
    assert.equal(by.Anh.userId, anh.uid);
    assert.equal(by.Bao.userId, bao.uid);

    // A friend on the LOW side of the pair key keeps their handicap row: this
    // is the (lo_id = friend, hi_id = kid) half of the new query.
    assert.equal(by.Anh.readyAt, now - 90 * 1000, 'a past cooldown is passed through, not zeroed');
    // A pair still inside its 3-day cooldown.
    assert.equal(by.Cuc.readyAt, now + 2 * DAY);
    // Never fought: no row at all.
    assert.equal(by.Bao.readyAt, null, 'a friend with no history has no cooldown');
    // Fought, but the clock was cleared: 0 must still surface as null, the way
    // `pair.nextReadyAt || null` always coerced it.
    assert.equal(by.Gia.readyAt, null, 'a zero cooldown is null, not 0');

    // busy: mid-bout with this child, and mid-invite with someone else.
    assert.equal(by.Dao.busy, true, 'a friend inside an active bout is busy');
    assert.equal(by.Ell.busy, true, "a friend's unanswered invite counts as busy");
    for (const n of ['Anh', 'Bao', 'Cuc', 'Fen', 'Gia'])
      assert.equal(by[n].busy, false, n + ' is free');

    // The 3-day wait on a new friendship, read off the friendship row itself.
    const since = n => Number(world.db.prepare(
      `SELECT strftime('%s', COALESCE(f.responded_at, f.created_at)) AS s FROM friendships f
        JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       WHERE (f.requester_id = ? OR f.addressee_id = ?) AND u.username = ?`
    ).get(kid.uid, kid.uid, kid.uid, n).s);
    assert.equal(by.Fen.friendReadyAt, since('Fen') * 1000 + MF.COOLDOWN_MS);
    assert.truthy(by.Fen.friendReadyAt > now, 'an hour-old friendship must still be waiting');
    assert.equal(by.Anh.friendReadyAt, since('Anh') * 1000 + MF.COOLDOWN_MS);
    assert.truthy(by.Anh.friendReadyAt < now, 'a ten-day-old friendship is past its wait');

    // The handicap is still invisible: no row may carry the leader or streak.
    const raw = JSON.stringify(res.data.friends);
    for (const leak of ['leader', 'streak', 'lo', 'hi'])
      assert.falsy(new RegExp('"' + leak).test(raw), 'the list must not carry ' + leak);
    assert.deepEqual(Object.keys(by.Anh).sort(), ['busy', 'friendReadyAt', 'readyAt', 'userId', 'username'],
      'the row shape the client reads must not gain or lose a field');
  });

  test('a disabled account and a non-friend are still absent', async () => {
    const { world, kid } = await listWorld();
    const res = await get(world, kid);
    const names = res.data.friends.map(f => f.username);
    assert.notContains(names, 'Hoa', 'a disabled friend must not be challengeable');
    assert.notContains(names, 'Zed', 'a stranger is not a friend');
  });

  test('the rest of the payload, and the fight this child is inside, are unchanged', async () => {
    const { world, kid, dao, myFight } = await listWorld();
    const res = await get(world, kid);
    assert.equal(res.data.prize, MF.PRIZE);
    assert.equal(res.data.questions, MF.QUESTIONS);
    assert.equal(res.data.seconds, MF.SECONDS);
    assert.equal(res.data.heartbeatMs, MF.HEARTBEAT_MS);
    assert.truthy(res.data.now > 0);
    // The child's own bout still rides along with the list.
    assert.equal(res.data.fight.fightId, myFight);
    assert.equal(res.data.fight.status, 'active');
    assert.equal(res.data.fight.role, 'challenger');
    assert.equal(res.data.fight.foeId, dao.uid);
    assert.equal(res.data.fight.questions.length, MF.QUESTIONS);
    assert.deepEqual(res.data.fight.questions,
      MF.fightQuestions(123456, 3, MATH_FIGHT_BANK), 'the round travels with the fight');
  });

  test('a child with no friends still gets a list, and asks for no pair rows', async () => {
    const world = freshWorld();
    const kid = await world.createUser({ username: 'Alone' });
    const log = spyQueries(world);
    const res = await get(world, kid);
    assert.equal(res.status, 200);
    assert.deepEqual(res.data.friends, []);
    assert.equal(res.data.fight, null);
    assert.equal(log.filter(s => s.includes('math_fight_pairs')).length, 0,
      'an empty friend list must not build an empty IN () clause');
  });
});

suite('math fight list: the poll no longer fans out per friend', () => {
  async function kidWith(n) {
    const world = freshWorld();
    const kid = await world.createUser({ username: 'Kid' });
    for (let i = 0; i < n; i++) {
      const f = await world.createUser({ username: 'F' + String(i).padStart(2, '0') });
      befriend(world, kid.uid, f.uid, '-10 days');
      setPair(world, kid.uid, f.uid, kid.uid, 1, Date.now() + DAY);
    }
    return { world, kid };
  }

  test('twelve friends cost the same number of queries as two', async () => {
    const small = await kidWith(2), big = await kidWith(12);
    const a = spyQueries(small.world), b = spyQueries(big.world);
    const r1 = await get(small.world, small.kid);
    const r2 = await get(big.world, big.kid);
    assert.equal(r1.data.friends.length, 2);
    assert.equal(r2.data.friends.length, 12);
    // The old shape was 2N+4: 8 queries for two friends, 28 for twelve.
    assert.equal(b.length, a.length,
      'the poll must cost the same whatever the friend count — got ' +
      a.length + ' for 2 and ' + b.length + ' for 12');
    assert.truthy(b.length <= 10, 'a whole poll is a handful of queries, not ' + b.length);
  });

  test('one query for every handicap, one for every busy flag', async () => {
    const { world, kid } = await kidWith(12);
    const log = spyQueries(world);
    await get(world, kid);
    assert.equal(log.filter(s => s.includes('math_fight_pairs')).length, 1,
      'twelve handicaps, one read');
    // reapStale's UPDATE + SELECT, the busy set, and this child's own fight.
    assert.equal(log.filter(s => s.includes('math_fights')).length, 4,
      'twelve busy flags must not be twelve queries');
    assert.equal(log.filter(s => s.includes('friendships')).length, 1);
  });

  test('the busy set answers for one friend the same way currentFight did', async () => {
    const world = freshWorld();
    const kid = await world.createUser({ username: 'Kid' });
    const pal = await world.createUser({ username: 'Pal' });
    const zed = await world.createUser({ username: 'Zed' });
    const H = helpers();
    const now = Date.now();
    for (const [status, opts] of [
      ['invited', { expiresAt: now + 60000 }],
      ['active', { startedAt: now, deadlineAt: now + MF.SECONDS * 1000 }],
      ['done', {}], ['declined', {}], ['expired', {}],
    ]) {
      const w = freshWorld();
      // Same three accounts, same ids, in a throwaway database per status.
      await w.createUser({ username: 'Kid' }); await w.createUser({ username: 'Pal' });
      await w.createUser({ username: 'Zed' });
      putFight(w, zed.uid, pal.uid, status, opts);
      const busy = await H.busyIdsAmong(w.env, [pal.uid, kid.uid]);
      const legacy = await H.currentFight(w.env, pal.uid);
      assert.equal(busy.has(pal.uid), !!legacy, 'busy disagreed with currentFight on ' + status);
      assert.equal(busy.has(kid.uid), false, 'a bystander is never busy on ' + status);
    }
  });

  test('an unreaped bout still blocks both children, so the reaper stays on this path', async () => {
    // The reason reapStale() is not simply moved off the poll: this project has
    // no cron, so nothing else would ever settle a fight whose five minutes ran
    // out — both players would read `busy` forever and neither pair clock would
    // start. db/026 is what makes keeping it here cheap.
    const world = freshWorld();
    const kid = await world.createUser({ username: 'Kid' });
    const pal = await world.createUser({ username: 'Pal' });
    befriend(world, kid.uid, pal.uid, '-10 days');
    const now = Date.now();
    const id = putFight(world, kid.uid, pal.uid, 'active',
      { startedAt: now - 10 * 60000, deadlineAt: now - 5 * 60000 });

    const res = await get(world, kid);
    const pair = world.db.prepare('SELECT * FROM math_fight_pairs').get();
    assert.equal(world.db.prepare('SELECT status FROM math_fights WHERE id=?').get(id).status, 'done',
      'the list poll is the only clock a timed-out bout has');
    assert.equal(res.data.friends[0].busy, false, 'and the friend is free again in the same response');
    assert.truthy(pair && pair.next_ready_at > now, 'settling starts the 3-day cooldown');
  });
});

suite('math fight list: the reaper has an index to stand on', () => {
  const sql = () => fs.readFileSync(path.join(ROOT, MIGRATION_026), 'utf8');

  test('the migration carries the command that applies it', () => {
    assert.truthy(sql().includes('wrangler@3 d1 execute'));
  });
  test('both reaper predicates are covered by a partial index', () => {
    const s = sql();
    assert.truthy(/CREATE INDEX IF NOT EXISTS \S+\s+ON math_fights\(deadline_at\) WHERE status = 'active'/.test(s),
      'the stale-bout scan needs an index');
    assert.truthy(/CREATE INDEX IF NOT EXISTS \S+\s+ON math_fights\(expires_at\) WHERE status = 'invited'/.test(s),
      'the dead-invite scan needs one too');
  });
  test('the pair read has an index for the hi_id half of the key', () => {
    assert.truthy(/ON math_fight_pairs\(hi_id\)/.test(sql()),
      'lo_id rides the primary key; hi_id had nothing');
  });
  test('SQLite really does use them', () => {
    const world = freshWorld();
    const plan = q => world.db.prepare('EXPLAIN QUERY PLAN ' + q).all().map(r => r.detail).join(' | ');
    assert.truthy(/idx_math_fights_active_deadline/.test(
      plan("SELECT * FROM math_fights WHERE status='active' AND deadline_at < 1")),
      'the stale-bout read must not be a table scan');
    assert.truthy(/idx_math_fights_invited_expires/.test(
      plan("SELECT id FROM math_fights WHERE status='invited' AND expires_at < 1")),
      'the dead-invite read must not be a table scan');
    assert.truthy(/idx_math_fight_pairs_hi|sqlite_autoindex_math_fight_pairs/.test(
      plan('SELECT lo_id, hi_id, leader_id, streak, next_ready_at FROM math_fight_pairs WHERE lo_id=1 OR hi_id=1')),
      'the one-shot pair read must use both halves of the key');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
