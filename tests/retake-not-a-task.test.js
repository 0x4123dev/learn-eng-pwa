// retake-not-a-task.test.js — a daily task is completed only by a FRESH
// attempt started from the menu. Re-doing the SAME paper through a results
// card's "🔁 Làm lại" (js/exam.js retakeExam) must not count, even at 100%.
//
// The rule crosses three boundaries, and every one is EXECUTED here:
//   engine   — retakeExam() arms a one-shot; startExam() consumes it into
//              _examState.retake; finishExam() writes `retake: true` on the
//              attempt, and only on that attempt;
//   uploader — js/auth.js syncNow() (the real one, with fetch captured) sends
//              detail.retake on that item and nothing on a fresh one;
//   server   — functions/api/_daily-task.js progress() counts the fresh 100%
//              and not the retaken one, and still counts every row written
//              before the flag existed (no detail_json, or no key).
//
// The client half boots index.html for real (tests/verify/client.js) and
// taps the rendered buttons; nothing reads source text.
const { suite, test, assert } = require('./harness');
const { mountApp, loginTestUser } = require('./verify/client.js');
const { createWorld, loadModule } = require('./pages-harness');

const tick = () => new Promise((r) => setImmediate(r));
const settle = async (n) => { for (let i = 0; i < (n || 6); i++) await tick(); };

// ---------------------------------------------------------------------------
// client
// ---------------------------------------------------------------------------

function boot() {
  const h = mountApp();
  // loginTestUser silences EngAuth.syncNow; the REAL one is what this file
  // proves, so keep a handle on it first.
  h.realSyncNow = h.peek('EngAuth').syncNow;
  loginTestUser(h, { coins: 100 });
  assert.deepEqual(h.loadErrors, [], 'the app must boot without a script error');
  return h;
}

function tapOnclick(h, screenId, fnName) {
  const html = h.el(screenId).innerHTML;
  const m = html.match(new RegExp('onclick="(' + fnName + '\\([^"]*\\))"'));
  assert.truthy(m, screenId + ' renders no button calling ' + fnName + '()');
  h.doc.__runInline(m[1]);
  return m[1];
}

function answerCurrent(h) {
  const s = h.peek('_examState');
  const q = s.questions[s.idx];
  if (q.type === 'text') {
    h.el('examTextInput').value = q.answer;
    h.sandbox.submitExamText();
  } else {
    h.sandbox.answerExamChoice(q.correct);
  }
}

// Answer every question right and tap through to the results screen.
function finishPerfect(h, screenId) {
  let guard = 0;
  while (h.sandbox.isExamActive() && guard++ < 500) {
    const s = h.peek('_examState');
    if (!s.answers[s.idx]) answerCurrent(h);
    h.sandbox.nextExamQuestion();
  }
  assert.falsy(h.sandbox.isExamActive(), 'the paper did not finish');
  assert.truthy(h.el(screenId).querySelector('.exam-result'), 'the results screen is up');
}

async function openReading(h) {
  assert.equal(h.sandbox.switchScreen('readingScreen'), true, 'could not open readingScreen');
  await settle(8);
  assert.truthy(h.el('readingScreen').innerHTML.includes('startReadingPractice'), 'the Reading home renders its Practice button');
}

// Run the real js/auth.js syncNow() against a captured fetch and return the
// items it posted to /api/activity.
async function uploaded(h) {
  const S = h.sandbox;
  h.store['flashlingo_accounts'] = JSON.stringify({ BeNa: { token: 'test-token', syncedKeys: [] } });
  const posts = [];
  S.fetch = (url, opts) => {
    posts.push({ url: String(url), body: opts && opts.body ? JSON.parse(opts.body) : null });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true, count: 0, dailyTask: null }) });
  };
  const r = await h.realSyncNow();
  assert.equal(r.ok, true, 'syncNow reported ' + JSON.stringify(r));
  const post = posts.find(p => p.url === '/api/activity');
  assert.truthy(post, 'syncNow posted to /api/activity (' + posts.map(p => p.url).join(', ') + ')');
  return post.body.items;
}

function readingItems(items) { return items.filter(i => i.type === 'exam' && i.detail && i.detail.set === 'reading'); }

suite('retake is not a task · client (Reading, booted for real)', () => {
  test('fresh from the menu: no retake on the entry, none on the uploaded item; Retake: both carry it; fresh again: clean', async () => {
    const h = boot();
    await openReading(h);

    // 1. Fresh attempt, started from the menu's Practice button.
    tapOnclick(h, 'readingScreen', 'startReadingPractice');
    assert.truthy(h.sandbox.isExamActive(), 'the passage opened');
    assert.equal(h.sandbox.examCurrentSet(), 'reading');
    assert.equal(h.peek('_examState').retake, false, 'a menu start is not a retake');
    finishPerfect(h, 'readingScreen');
    let hist = h.state().readingHistory;
    assert.equal(hist.length, 1, 'one attempt written');
    assert.equal(hist[0].score, hist[0].total, '100%');
    assert.falsy('retake' in hist[0], 'a fresh attempt carries no retake key at all: ' + JSON.stringify(Object.keys(hist[0])));
    const freshId = hist[0].examId;
    let items = readingItems(await uploaded(h));
    assert.equal(items.length, 1, 'one reading item uploaded');
    assert.equal(items[0].score, items[0].total);
    assert.falsy('retake' in items[0].detail, 'no detail.retake on a fresh item: ' + JSON.stringify(items[0].detail));

    // The results card says so before the tap.
    const card = h.el('readingScreen').innerHTML;
    assert.truthy(card.includes('🔁 Làm lại'), 'the Retake button reads "Làm lại"');
    assert.truthy(card.includes('Làm lại không tính vào nhiệm vụ ngày'), 'the card explains a retake does not count');
    assert.truthy(h.el('readingScreen').querySelector('.exam-retake-note'), 'the note is a real element');

    // 2. Retake, through the rendered button on the results screen.
    h.sandbox.__confirmAnswer = true;
    h.sandbox.__confirmLog.length = 0;
    const call = tapOnclick(h, 'readingScreen', 'retakeExam');
    assert.equal(call, "retakeExam('" + freshId + "')", 'the button re-opens the SAME paper');
    assert.equal(h.sandbox.__confirmLog.length, 1, 'a retake still asks "Start?"');
    assert.truthy(h.sandbox.isExamActive(), 'the retake started');
    assert.equal(h.peek('_examState').examId, freshId, 'the same paper');
    assert.equal(h.peek('_examState').retake, true, 'the live paper knows it is a retake');
    assert.equal(h.peek('_examRetake'), false, 'the one-shot was consumed by startExam');
    finishPerfect(h, 'readingScreen');
    hist = h.state().readingHistory;
    assert.equal(hist.length, 2, 'two attempts now');
    assert.equal(hist[0].examId, freshId);
    assert.equal(hist[0].score, hist[0].total, 'the retake was also 100%');
    assert.equal(hist[0].retake, true, 'the retaken attempt is marked');
    assert.falsy('retake' in hist[1], 'the earlier fresh attempt is untouched');
    items = readingItems(await uploaded(h));
    assert.equal(items.length, 2);
    // Matched by content, not by time: two papers can finish in one millisecond here.
    const retakenItems = items.filter(i => i.detail.retake === true);
    const freshItems = items.filter(i => !('retake' in i.detail));
    assert.equal(freshItems.length, 1, 'the fresh item still has no retake key: ' + JSON.stringify(items.map(i => i.detail)));
    assert.equal(retakenItems.length, 1, 'the retaken item carries detail.retake = true');
    assert.equal(retakenItems[0].detail.examId, freshId);
    assert.equal(retakenItems[0].detail.set, 'reading');
    assert.equal(retakenItems[0].at, hist[0].ts, 'the retaken item is the newest attempt');

    // 3. Back to the menu, a fresh start again: clean.
    tapOnclick(h, 'readingScreen', 'renderExamHome');
    await settle(4);
    tapOnclick(h, 'readingScreen', 'startReadingPractice');
    assert.truthy(h.sandbox.isExamActive());
    assert.equal(h.peek('_examState').retake, false, 'a menu start after a retake is fresh');
    finishPerfect(h, 'readingScreen');
    hist = h.state().readingHistory;
    assert.equal(hist.length, 3);
    assert.falsy('retake' in hist[0], 'the third, fresh attempt carries no retake key');
    items = readingItems(await uploaded(h));
    assert.equal(items.filter(i => i.detail.retake === true).length, 1, 'exactly one of three items is a retake');
  });

  test('a retake cancelled at "Start?" or walked out of leaves no flag for the next fresh paper', async () => {
    const h = boot();
    await openReading(h);
    tapOnclick(h, 'readingScreen', 'startReadingPractice');
    finishPerfect(h, 'readingScreen');

    // Cancel at the confirm: nothing starts, the one-shot is dropped.
    h.sandbox.__confirmAnswer = false;
    tapOnclick(h, 'readingScreen', 'retakeExam');
    assert.falsy(h.sandbox.isExamActive(), 'Cancel starts nothing');
    assert.equal(h.peek('_examRetake'), false, 'the one-shot is dropped on Cancel');
    tapOnclick(h, 'readingScreen', 'renderExamHome');
    await settle(4);
    tapOnclick(h, 'readingScreen', 'startReadingPractice');
    assert.equal(h.peek('_examState').retake, false, 'the next menu start is fresh');
    h.sandbox.abandonExam();
    h.sandbox.renderReadingHome();   // abandonExam() stops the paper; the home is drawn by whoever leaves

    // Walk out of a retake: abandonExam clears it too.
    tapOnclick(h, 'readingScreen', 'startReadingPractice');
    finishPerfect(h, 'readingScreen');
    h.sandbox.__confirmAnswer = true;
    tapOnclick(h, 'readingScreen', 'retakeExam');
    assert.equal(h.peek('_examState').retake, true);
    h.sandbox.abandonExam();
    assert.equal(h.peek('_examRetake'), false);
    assert.equal(h.peek('_examState'), null);
    h.sandbox.renderReadingHome();
    tapOnclick(h, 'readingScreen', 'startReadingPractice');
    assert.equal(h.peek('_examState').retake, false, 'fresh after an abandoned retake');
    finishPerfect(h, 'readingScreen');
    const hist = h.state().readingHistory;
    assert.equal(hist.length, 3, 'the abandoned retake wrote nothing');
    assert.truthy(hist.every(a => !('retake' in a)), 'no attempt in the history is a retake: ' + JSON.stringify(hist.map(a => a.retake)));
  });

  test('the history review card\'s Retake and the PTNK results card are retakes too', async () => {
    const h = boot();
    // Review → Retake re-opens the same paper: a retake.
    await openReading(h);
    tapOnclick(h, 'readingScreen', 'startReadingPractice');
    finishPerfect(h, 'readingScreen');
    h.sandbox.examSelectSet('reading');
    h.sandbox.renderExamHistory();
    h.sandbox.reviewExamAttempt(0);
    assert.truthy(h.el('readingScreen').innerHTML.includes("retakeExam('"), 'the review card offers Làm lại');
    h.sandbox.__confirmAnswer = true;
    tapOnclick(h, 'readingScreen', 'retakeExam');
    assert.equal(h.peek('_examState').retake, true, 'a retake from the review card is marked');
    finishPerfect(h, 'readingScreen');
    assert.equal(h.state().readingHistory[0].retake, true);

    // PTNK: the real papers ride the same engine and the same flag.
    assert.equal(h.sandbox.switchScreen('ptnkScreen'), true);
    await settle(8);
    h.sandbox.__confirmAnswer = true;
    tapOnclick(h, 'ptnkScreen', 'startPtnkExam');
    assert.equal(h.sandbox.examCurrentSet(), 'ptnk');
    assert.equal(h.peek('_examState').retake, false, 'a PTNK paper from the list is fresh');
    finishPerfect(h, 'ptnkScreen');
    assert.falsy('retake' in h.state().ptnkHistory[0]);
    tapOnclick(h, 'ptnkScreen', 'retakeExam');
    assert.equal(h.peek('_examState').retake, true);
    finishPerfect(h, 'ptnkScreen');
    assert.equal(h.state().ptnkHistory[0].retake, true, 'the PTNK retake is marked');
    const items = (await uploaded(h)).filter(i => i.detail && i.detail.set === 'ptnk');
    assert.equal(items.length, 2);
    assert.equal(items.filter(i => i.detail.retake === true).length, 1, 'one of the two PTNK items is a retake');
  });
});

// ---------------------------------------------------------------------------
// server
// ---------------------------------------------------------------------------

function core() { return loadModule('functions/api/_daily-task.js'); }
function activityHandler() { return loadModule('functions/api/activity.js'); }
function adminActivity() { return loadModule('functions/api/admin/activity.js'); }

// 10:00 UTC on 2026-09-02 = 17:00 GMT+7 the same day.
const NOW = Date.UTC(2026, 8, 2, 10, 0, 0);

function addTask(world, uid, kind, target) {
  const spec = core().taskSpec(kind);
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
    addTask(world, kid.uid, 'reading:any', 1);
    addActivity(world, kid.uid, { type: 'exam', title: 'The School Garden', score: 3, total: 3,
      detail: { examId: 'rd-kc-01-1', set: 'reading', retake: true }, at: '2026-09-02 09:00:00' });
    assert.equal(await count(world, kid.uid, 'reading:any'), 0, 'a retaken 100% does not count');
    addActivity(world, kid.uid, { type: 'exam', title: 'The School Garden', score: 3, total: 3,
      detail: { examId: 'rd-kc-01-1', set: 'reading' }, at: '2026-09-02 09:05:00' });
    assert.equal(await count(world, kid.uid, 'reading:any'), 1, 'the fresh 100% of the same paper counts');
    const p = await core().progress(world.env, kid.uid, NOW);
    assert.equal(p.tasks[0].done, true);
    assert.equal(p.allDone, true);
  });

  test('legacy rows still count: detail_json NULL, no retake key, retake false, retake 0', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'collocation', 4);     // matched by title, so a NULL detail is a real case
    addTask(world, kid.uid, 'reading:any', 3);
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, detail: null, at: '2026-09-02 09:00:00' });
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, detail: { qs: 20 }, at: '2026-09-02 09:01:00' });
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, detail: { qs: 20, retake: false }, at: '2026-09-02 09:02:00' });
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, detail: { qs: 20, retake: 0 }, at: '2026-09-02 09:03:00' });
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, detail: { qs: 20, retake: true }, at: '2026-09-02 09:04:00' });
    assert.equal(await count(world, kid.uid, 'collocation'), 4, 'NULL, no key, false and 0 count; only true is left out');
    addActivity(world, kid.uid, { type: 'exam', title: 'a', score: 5, total: 5, detail: { examId: 'rd-kc-02-1', set: 'reading' }, at: '2026-09-02 09:05:00' });
    addActivity(world, kid.uid, { type: 'exam', title: 'b', score: 5, total: 5, detail: { examId: 'rd-ch-03-1', set: 'reading', retake: false }, at: '2026-09-02 09:06:00' });
    addActivity(world, kid.uid, { type: 'exam', title: 'c', score: 5, total: 5, detail: { examId: 'rd-ch-03-1', set: 'reading', retake: true }, at: '2026-09-02 09:07:00' });
    addActivity(world, kid.uid, { type: 'exam', title: 'd', score: 4, total: 5, detail: { examId: 'rd-ch-04-1', set: 'reading' }, at: '2026-09-02 09:08:00' });
    assert.equal(await count(world, kid.uid, 'reading:any'), 2, 'two fresh 100%s; the retake and the 4/5 do not count');
  });

  test('a retake that is not JSON-valid or not an object never throws and does not count as fresh either way', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    addTask(world, kid.uid, 'collocation', 1);
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, detail: '{"retake":true}', at: '2026-09-02 09:00:00' });
    assert.equal(await count(world, kid.uid, 'collocation'), 0);
    addActivity(world, kid.uid, { type: 'collocation', title: 'Collocation practice (20 Qs)', score: 20, total: 20, detail: '{"qs":20}', at: '2026-09-02 09:01:00' });
    assert.equal(await count(world, kid.uid, 'collocation'), 1);
  });

  test('end to end: the activity POST keeps detail.retake, the counter ignores it, the admin feed tags it', async () => {
    const world = createWorld();
    const kid = await world.createUser({});
    const admin = await world.createUser({ role: 'admin' });
    addTask(world, kid.uid, 'reading:any', 1);
    const at = Date.now();
    const r = await world.call(activityHandler().onRequestPost, {
      token: kid.token,
      body: { items: [
        { type: 'exam', title: 'The School Garden', score: 3, total: 3, at: at - 60000, detail: { examId: 'rd-kc-01-1', set: 'reading', retake: true } },
      ] },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.count, 1, 'the retake row is stored (the parent sees it)');
    assert.deepEqual(r.data.dailyTask, { allDone: false, justRewarded: false, rewardedToday: false }, 'but it completes nothing');
    const stored = world.db.prepare('SELECT detail_json FROM activities WHERE user_id=?').get(kid.uid);
    assert.equal(JSON.parse(stored.detail_json).retake, true, 'clean() kept the flag in detail_json');
    assert.equal(world.db.prepare('SELECT COUNT(*) AS n FROM daily_task_rewards WHERE user_id=?').get(kid.uid).n, 0, 'no reward paid for a retake');

    const r2 = await world.call(activityHandler().onRequestPost, {
      token: kid.token,
      body: { items: [
        { type: 'exam', title: 'The School Garden', score: 3, total: 3, at, detail: { examId: 'rd-kc-01-1', set: 'reading' } },
      ] },
    });
    assert.equal(r2.status, 200);
    assert.deepEqual(r2.data.dailyTask, { allDone: true, justRewarded: true, rewardedToday: true }, 'the fresh 100% completes the task');

    const feed = await world.call(adminActivity().onRequestGet, { url: '/api/admin/activity?user_id=' + kid.uid, method: 'GET', token: admin.token });
    assert.equal(feed.status, 200);
    const rows = feed.data.activity;
    assert.equal(rows.length, 2);
    const retaken = rows.find(x => Number(x.retake) === 1);
    const fresh = rows.find(x => Number(x.retake) === 0);
    assert.truthy(retaken, 'the admin feed marks the retake row: ' + JSON.stringify(rows));
    assert.truthy(fresh, 'and not the fresh one');
    assert.equal(retaken.kind, 'exam');
    assert.equal(retaken.score, 3);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
