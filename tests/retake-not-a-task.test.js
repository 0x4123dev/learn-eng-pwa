// retake-not-a-task.test.js — a daily task is completed only by a FRESH
// attempt. An `activities` row marked `detail.retake = true` must not count,
// even at 100%.
//
// The flag was written by the exam engine's "🔁 Làm lại" (js/exam.js, cut in
// 2026-09 with every exam menu). The app no longer uploads it, but the rows
// it wrote are still in production, and the rule in
// functions/api/_daily-task.js NOT_RETAKE_SQL still has to hold for them —
// and, above all, must keep counting every row WITHOUT the flag (no
// detail_json, no key, false, 0). Everything here is EXECUTED against a real
// SQLite DB (tests/pages-harness.js).
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

function core() { return loadModule('functions/api/_daily-task.js'); }
function activityHandler() { return loadModule('functions/api/activity.js'); }
function adminActivity() { return loadModule('functions/api/admin/activity.js'); }

// 10:00 UTC on 2026-09-02 = 17:00 GMT+7 the same day.
const NOW = Date.UTC(2026, 8, 2, 10, 0, 0);
const TITLE = 'Unit pr1-3 words practice';   // what js/auth.js uploads for word:pr1-3

function addTask(world, uid, kind, target) {
  const spec = core().taskSpec(kind);
  assert.truthy(spec, kind + ' is not in the catalog');
  world.db.prepare(
    'INSERT INTO daily_tasks (user_id, kind, label, target, activity_type, match_json, created_by) VALUES (?,?,?,?,?,?,1)'
  ).run(uid, spec.kind, spec.label, target, spec.activityType, spec.matchJson);
}
// detail: an object → JSON; null → a NULL detail_json (a legacy row); a
// string → stored verbatim.
function addActivity(world, uid, o) {
  const detail = o.detail == null ? null : (typeof o.detail === 'string' ? o.detail : JSON.stringify(o.detail));
  world.db.prepare(
    'INSERT INTO activities (user_id, type, title, score, total, detail_json, created_at) VALUES (?,?,?,?,?,?,?)'
  ).run(uid, o.type, o.title || '', o.score, o.total, detail, o.at || '2026-09-02 09:00:00');
}
async function count(world, uid, kind) {
  const p = await core().progress(world.env, uid, NOW);
  const t = p.tasks.find(x => x.kind === kind);
  assert.truthy(t, 'task ' + kind + ' is active');
  return t.count;
}

suite('retake is not a task · server (progress() over a real SQLite DB)', () => {
  test('a retake at 100% leaves the count at 0; a fresh 100% makes it 1', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-3', 1);
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 10, total: 10,
      detail: { sec: 42, retake: true }, at: '2026-09-02 09:00:00' });
    assert.equal(await count(world, kid.uid, 'word:pr1-3'), 0, 'a retaken 100% does not count');
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 10, total: 10,
      detail: { sec: 40 }, at: '2026-09-02 09:05:00' });
    assert.equal(await count(world, kid.uid, 'word:pr1-3'), 1, 'the fresh 100% of the same unit counts');
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].done, true);
    assert.equal(p.allDone, true);
  });

  test('legacy rows still count: detail_json NULL, no retake key, retake false, retake 0', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-3', 4);
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 10, total: 10, detail: null, at: '2026-09-02 09:00:00' });
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 10, total: 10, detail: { sec: 30 }, at: '2026-09-02 09:01:00' });
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 10, total: 10, detail: { sec: 30, retake: false }, at: '2026-09-02 09:02:00' });
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 10, total: 10, detail: { sec: 30, retake: 0 }, at: '2026-09-02 09:03:00' });
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 10, total: 10, detail: { sec: 30, retake: true }, at: '2026-09-02 09:04:00' });
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 9, total: 10, detail: { sec: 30 }, at: '2026-09-02 09:05:00' });
    assert.equal(await count(world, kid.uid, 'word:pr1-3'), 4, 'NULL, no key, false and 0 count; only true (and the 9/10) are left out');
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.allDone, true);
  });

  test('a detail_json that is not an object never throws and does not count as fresh either way', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'word:pr1-3', 1);
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 10, total: 10, detail: '{"retake":true}', at: '2026-09-02 09:00:00' });
    assert.equal(await count(world, kid.uid, 'word:pr1-3'), 0);
    addActivity(world, kid.uid, { type: 'lesson', title: TITLE, score: 10, total: 10, detail: '{"sec":20}', at: '2026-09-02 09:01:00' });
    assert.equal(await count(world, kid.uid, 'word:pr1-3'), 1);
  });

  test('end to end: the activity POST keeps detail.retake, the counter ignores it, the admin feed tags it', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const admin = await world.createUser({ role: 'admin' });
    addTask(world, kid.uid, 'word:pr1-3', 1);
    const at = Date.now();
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token,
      body: { items: [
        { type: 'lesson', title: TITLE, score: 10, total: 10, at: at - 60000, detail: { sec: 33, retake: true } },
      ] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.count, 1, 'the retake row is stored (the admin sees it)');
    assert.deepEqual(r.data.dailyTask, { allDone: false, justRewarded: false, rewardedToday: false }, 'but it completes nothing');
    const stored = world.db.prepare('SELECT detail_json FROM activities WHERE user_id=?').get(kid.uid);
    assert.equal(JSON.parse(stored.detail_json).retake, true, 'clean() kept the flag in detail_json');
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM daily_task_rewards WHERE user_id=?').get(kid.uid).n, 0, 'no reward paid for a retake');
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM coin_grants WHERE user_id=?').get(kid.uid).n, 0, 'and no coins');

    const r2 = await world.call(activityHandler().onRequestPost, {
      token: kid.token,
      body: { items: [
        { type: 'lesson', title: TITLE, score: 10, total: 10, at, detail: { sec: 31 } },
      ] },
    });
    assert.equal(r2.status, 200);
    assert.deepEqual(r2.data.dailyTask, { allDone: true, justRewarded: true, rewardedToday: true }, 'the fresh 100% completes the task');
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM coin_grants WHERE user_id=? AND amount=200').get(kid.uid).n, 1, 'exactly one 200-xu grant');

    const feed = await world.call(adminActivity().onRequestGet, { url: '/api/admin/activity?user_id=' + kid.uid, method: 'GET', token: admin.token });
    assert.equal(feed.status, 200);
    const rows = feed.data.activity;
    assert.equal(rows.length, 2);
    const retaken = rows.find(x => Number(x.retake) === 1);
    const fresh = rows.find(x => Number(x.retake) === 0);
    assert.truthy(retaken, 'the admin feed marks the retake row: ' + JSON.stringify(rows));
    assert.truthy(fresh, 'and not the fresh one');
    assert.equal(retaken.kind, 'lesson');
    assert.equal(retaken.score, 10);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
