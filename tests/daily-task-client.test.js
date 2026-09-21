// js/daily-task.js in a vm sandbox with stubbed globals: what the learner sees
// on the home card and task screen, and where "Vào học" sends them.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function load(opts) {
  opts = opts || {};
  const html = {};
  const el = id => ({
    id,
    set innerHTML(v) { html[id] = String(v); },
    get innerHTML() { return html[id] || ''; },
    hidden: false, classList: { add() {}, remove() {}, contains: () => false },
  });
  const calls = [];
  const sandbox = {
    console, Date, Math, JSON, Object, Array, Promise, setTimeout, clearTimeout,
    document: { getElementById: id => el(id), querySelectorAll: () => [] },
    appState: opts.appState || {},
    currentUser: 'kid',
    saveUserData: () => calls.push(['save']),
    showToast: m => calls.push(['toast', m]),
    switchScreen: s => { calls.push(['switchScreen', s]); return opts.switchOk === false ? false : true; },
    setBottomNavActive: s => calls.push(['nav', s]),
    switchUnitSet: s => calls.push(['switchUnitSet', s]),
    startUnitPractice: u => calls.push(['startUnitPractice', u]),
    EngAuth: {
      tokenFor: () => opts.token === undefined ? 'tok' : opts.token,
      api: async (p, o) => { calls.push(['api', p, (o && o.method) || 'GET']); return opts.api ? opts.api(p, o) : { ok: false, data: null }; },
      refreshFlags: () => calls.push(['refreshFlags']),
    },
  };
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/daily-task-catalog.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/daily-task.js'), 'utf8'), ctx);
  return { DailyTask: ctx.DailyTask, html, calls, sandbox };
}

const TASKS = [
  { id: 1, kind: 'word:pr1-mix', label: 'Book 1 · 🎲 Mix', target: 5, count: 2, done: false },
  { id: 2, kind: 'word:pr2-7', label: 'Book 2 · Unit 7 · Entertainment and Sports', target: 1, count: 1, done: true },
];
// Counts are only trusted for the current GMT+7 day (see todayGmt7() in
// js/daily-task.js), so the fixtures follow the clock instead of pinning a
// date that would go stale overnight and fail the suite tomorrow.
const TODAY = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 31 * 3600000).toISOString().slice(0, 10);
function stateWith(over) {
  return { dailyTask: Object.assign({ fetchedAt: Date.now(), date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false }, over || {}) };
}
// The whole Armory vocabulary. None of it may survive in anything the
// learner is shown: the reward is 200 xu and nothing else.
const ARMORY_WORDS = ['khiên', 'kiếm', 'Khiên', 'Kiếm', 'Armory', 'armory', 'shield', 'sword', 'phần quà', 'món quà', 'chờ bạn chọn', 'dt-gift-cta', 'dt-armory', 'dt-mini', 'activateShield', 'night-raid/shield'];
function assertNoArmory(out, where) {
  for (const w of ARMORY_WORDS) assert.falsy(out.includes(w), where + ' still mentions "' + w + '": ' + out.slice(0, 300));
}

suite('daily task client: home card', () => {
  test('no tasks → the card renders empty (nothing for a learner who was not assigned)', () => {
    const { DailyTask, html } = load({ appState: stateWith({ tasks: [] }) });
    DailyTask.renderHomeCard();
    assert.equal(html.dailyTaskCard, '');
  });
  test('shows done/total, what is left, and opens the task screen', () => {
    const { DailyTask, html } = load({ appState: stateWith() });
    DailyTask.renderHomeCard();
    assert.truthy(html.dailyTaskCard.includes('1/2'), html.dailyTaskCard);
    assert.truthy(html.dailyTaskCard.includes('Bạn còn 1 nhiệm vụ hôm nay'));
    assert.truthy(html.dailyTaskCard.includes('Hoàn thành để nhận 200 xu'));
    assert.truthy(html.dailyTaskCard.includes('DailyTask.open()'));
  });
  test('all done: the card says the 200 xu are in', () => {
    const { DailyTask, html } = load({ appState: stateWith({ tasks: [TASKS[1]], allDone: true, rewardedToday: true }) });
    DailyTask.renderHomeCard();
    assert.truthy(html.dailyTaskCard.includes('Bạn đã hoàn thành hôm nay!'), html.dailyTaskCard);
    assert.truthy(html.dailyTaskCard.includes('+200 xu đã vào túi'));
    assert.truthy(html.dailyTaskCard.includes('dt-card done'));
  });
  test('the card and the screen carry no Armory: no khiên, no kiếm, no gift to pick, in any state', () => {
    const states = [
      stateWith(),
      stateWith({ tasks: [TASKS[1]], allDone: true, rewardedToday: true }),
      stateWith({ tasks: [TASKS[1]], allDone: true, rewardedToday: true, seeds: { ready: true, progress: 0, recent: [{ date: TODAY, id: 'lettuce', name: 'Rau cải' }] } }),
      // A profile saved before the cut still carries the old fields; they
      // must be ignored, not rendered.
      stateWith({ shields: { count: 3, activeUntil: Date.now() + 3600000 }, swords: { count: 2 }, pending: [TODAY], recent: [{ date: TODAY, kind: 'sword' }] }),
      stateWith({ date: '2000-01-01' }),
    ];
    for (const appState of states) {
      const { DailyTask, html } = load({ appState });
      DailyTask.renderHomeCard();
      DailyTask.renderScreen();
      assertNoArmory(html.dailyTaskCard, 'home card');
      assertNoArmory(html.dailyTaskScreen, 'task screen');
    }
    const { DailyTask } = load({ appState: stateWith() });
    for (const gone of ['activateShield', 'applyArmory', 'pendingCount', 'swordCount']) {
      assert.equal(typeof DailyTask[gone], 'undefined', 'DailyTask.' + gone + ' should be gone with the Armory');
    }
  });
});

suite('daily task client: task screen', () => {
  test('lists every task; unfinished ones get Vào học, finished ones a tick and no button', () => {
    const { DailyTask, html } = load({ appState: stateWith() });
    DailyTask.renderScreen();
    const out = html.dailyTaskScreen;
    assert.truthy(out.includes('Book 1 · 🎲 Mix'));
    assert.truthy(out.includes('2/5'));
    assert.truthy(out.includes("DailyTask.go('word:pr1-mix')"));
    assert.falsy(out.includes("DailyTask.go('word:pr2-7')"), 'a done task has no Vào học button');
    assert.truthy(out.includes('✓'));
    assert.truthy(out.includes('Xong hết nhiệm vụ: +200 xu'), 'the reward line promises the 200 xu and nothing else');
  });
  test('all done + rewarded shows the reward line and the hero celebrates', () => {
    const r = load({ appState: stateWith({ tasks: [TASKS[1]], allDone: true, rewardedToday: true }) });
    r.DailyTask.renderScreen();
    assert.truthy(r.html.dailyTaskScreen.includes('Đã nhận 200 xu hôm nay'), r.html.dailyTaskScreen);
    assert.truthy(r.html.dailyTaskScreen.includes('Hôm nay xong rồi'), 'the hero celebrates');
    assert.truthy(r.html.dailyTaskScreen.includes('+200 xu đã vào túi'));
  });
  test('shows the two-day seed streak, next crop and the seed inventory door', () => {
    const seeds = { ready: true, progress: 1, goal: 2, next: { id: 'tomato', name: 'Cà chua', days: 2, yield: 18 },
      inventory: [{ id: 'lettuce', name: 'Rau cải', quantity: 2 }], recent: [] };
    const r = load({ appState: stateWith({ seeds }) });
    r.DailyTask.renderScreen();
    assert.truthy(r.html.dailyTaskScreen.includes('1/2 ngày liên tiếp'));
    assert.truthy(r.html.dailyTaskScreen.includes('Thêm 1 ngày hoàn thành liên tiếp để nhận hạt Cà chua'));
    assert.truthy(r.html.dailyTaskScreen.includes('DailyTask.viewSeeds()'));
    assert.truthy(r.html.dailyTaskScreen.includes('Kho hạt · 2'));
    const earned = load({ appState: stateWith({ seeds: Object.assign({}, seeds, { progress: 0,
      recent: [{ date: TODAY, id: 'lettuce', name: 'Rau cải' }] }) }) });
    earned.DailyTask.renderScreen();
    assert.truthy(earned.html.dailyTaskScreen.includes('aria-label="Tiến độ nhận hạt giống 2 trên 2 ngày"'));
  });
});

suite('daily task client: Vào học deep links', () => {
  test('a Book unit: open the Word screen, select its Book, then start the unit', async () => {
    const { DailyTask, calls } = load({ appState: stateWith() });
    assert.equal(await DailyTask.go('word:pr2-7'), true);
    assert.deepEqual(calls, [
      ['switchScreen', 'wordScreen'], ['switchUnitSet', 'pr2'],
      ['startUnitPractice', 'pr2-7'], ['nav', 'wordScreen'],
    ]);
  });
  test('a Mix passes the mix key; unknown kind does nothing', async () => {
    const { DailyTask, calls } = load({ appState: stateWith() });
    assert.equal(await DailyTask.go('word:pr3-mix'), true);
    assert.deepEqual(calls, [['switchScreen', 'wordScreen'], ['switchUnitSet', 'pr3'], ['startUnitPractice', 'pr3-mix'], ['nav', 'wordScreen']]);
    calls.length = 0;
    assert.equal(await DailyTask.go('bogus'), false);
    assert.deepEqual(calls, []);
    assert.equal(await DailyTask.go('units:hk1-mix'), false, 'a pre-cut key is unknown now');
    assert.deepEqual(calls, []);
  });
  test('a lazily-loaded screen waits for its word bank before the start function runs', async () => {
    const { DailyTask, calls, sandbox } = load({ appState: stateWith() });
    sandbox.LazyData = {
      filesFor: s => (s === 'wordScreen' ? ['js/word-data.js'] : []),
      ensure: s => { calls.push(['ensure', s]); return new Promise(r => setTimeout(r, 5)); },
    };
    assert.equal(await DailyTask.go('word:pr1-3'), true);
    assert.deepEqual(calls, [['switchScreen', 'wordScreen'], ['ensure', 'wordScreen'], ['switchUnitSet', 'pr1'], ['startUnitPractice', 'pr1-3'], ['nav', 'wordScreen']]);
    calls.length = 0;
    sandbox.LazyData.filesFor = () => [];
    assert.equal(await DailyTask.go('word:pr1-mix'), true);
    assert.falsy(calls.some(c => c[0] === 'ensure'), 'screens without lazy files are not awaited');
  });
  test('a refused switchScreen stops the deep link before any start call', async () => {
    const { DailyTask, calls } = load({ appState: stateWith(), switchOk: false });
    assert.equal(await DailyTask.go('word:pr1-3'), false);
    assert.deepEqual(calls, [['switchScreen', 'wordScreen']]);
  });
  test('a missing app function is skipped, not thrown', async () => {
    const { DailyTask, sandbox } = load({ appState: stateWith() });
    delete sandbox.startUnitPractice;
    assert.equal(await DailyTask.go('word:pr1-mix'), true);
  });
});

suite('daily task client: refresh', () => {
  test('without a token nothing is fetched', async () => {
    const { DailyTask, calls } = load({ token: null });
    assert.equal(await DailyTask.refresh('home'), null);
    assert.deepEqual(calls, []);
  });
  test('stores the reply in appState, repaints, and claims coins + celebrates on justRewarded', async () => {
    const reply = { date: TODAY, tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: true };
    const { DailyTask, calls, sandbox, html } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    const st = await DailyTask.refresh('home');
    assert.equal(st.allDone, true);
    assert.truthy(calls.some(c => c[0] === 'api' && c[1] === 'me/daily-tasks'));
    assert.truthy(calls.some(c => c[0] === 'refreshFlags'), 'claims the 200 xu right away');
    const toast = calls.find(c => c[0] === 'toast');
    assert.truthy(toast, 'celebrates');
    assert.truthy(toast[1].includes('+200 xu'), toast[1]);
    assertNoArmory(toast[1], 'the celebration toast');
    assert.truthy(html.dailyTaskCard.includes('1/1'));
    assert.deepEqual(Object.keys(sandbox.appState.dailyTask).sort(),
      ['allDone', 'celebratedDate', 'date', 'farm', 'fetchedAt', 'rewardedToday', 'seeds', 'tasks'],
      'nothing of the Armory is kept in the profile');
  });
  test('a replayed justRewarded for the same date (offline cache) does not celebrate twice', async () => {
    const reply = { date: TODAY, tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: true };
    const { DailyTask, calls, sandbox } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 1);
    assert.equal(sandbox.appState.dailyTask.celebratedDate, TODAY);
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 1, 'same date → no second celebration');
    assert.equal(calls.filter(c => c[0] === 'refreshFlags').length, 1);
    reply.date = TOMORROW;
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 2, 'a new date celebrates again');
  });
  test('a reward paid inside the activity POST (GET shows rewardedToday only) still celebrates once', async () => {
    const reply = { date: TODAY, tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: false };
    const { DailyTask, calls, sandbox } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 1, 'first sight of today\'s reward celebrates');
    assert.equal(calls.filter(c => c[0] === 'refreshFlags').length, 1, 'and claims the coins');
    assert.equal(sandbox.appState.dailyTask.celebratedDate, TODAY);
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 1, 'later polls stay quiet');
  });
  test('the celebration names the seed earned today', async () => {
    const reply = { date: TODAY, tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: true,
      seeds: { ready: true, progress: 0, next: { id: 'tomato', name: 'Cà chua', days: 2 }, inventory: [], recent: [], justRewarded: { id: 'lettuce', name: 'Rau cải', days: 1 } } };
    const { DailyTask, calls } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    const toast = calls.find(c => c[0] === 'toast');
    assert.truthy(toast && toast[1].includes('Nhận 1 hạt Rau cải'), toast && toast[1]);
  });
  test('a fresh cache is reused on a home render but not on a sync', async () => {
    let n = 0;
    const api = async () => { n++; return { ok: true, data: { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false } }; };
    const { DailyTask } = load({ appState: stateWith(), api });
    await DailyTask.refresh('home');
    assert.equal(n, 0, 'fetchedAt is now → throttled');
    await DailyTask.refresh('sync');
    assert.equal(n, 1);
  });
});

suite('daily task client: a cached day that is not today', () => {
  test('yesterday counts are shown as unknown, but the tasks still open', () => {
    const { DailyTask, html } = load({ appState: stateWith({ date: '2000-01-01', allDone: true, rewardedToday: true }) });
    DailyTask.renderHomeCard();
    assert.truthy(html.dailyTaskCard.includes('Đang cập nhật'), html.dailyTaskCard);
    assert.falsy(html.dailyTaskCard.includes('1/2'), 'yesterday progress is not passed off as today');
    DailyTask.renderScreen();
    assert.falsy(html.dailyTaskScreen.includes('2/5'));
    assert.truthy(html.dailyTaskScreen.includes('…'));
    assert.truthy(html.dailyTaskScreen.includes("DailyTask.go('word:pr1-mix')"), 'the learner can still go and learn');
    // Yesterday's tick is worth no more than yesterday's count.
    assert.falsy(html.dailyTaskScreen.includes('✓ Xong'), 'no task claims to be done on a day we have not counted');
    assert.truthy(html.dailyTaskScreen.includes("DailyTask.go('word:pr2-7')"), 'the stale-done task gets its button back');
    assert.falsy(html.dailyTaskScreen.includes('Đã nhận 200 xu hôm nay'), 'yesterday\'s reward is not passed off as today\'s');
  });
});

suite('daily task client: open', () => {
  test('a refused switchScreen paints nothing', () => {
    const { DailyTask, html, calls } = load({ appState: stateWith(), switchOk: false });
    DailyTask.open();
    assert.falsy(html.dailyTaskScreen, 'no HTML built for a screen we never reached');
    assert.deepEqual(calls, [['switchScreen', 'dailyTaskScreen']]);
  });
  test('opening paints the screen and leaves the nav to switchScreen', () => {
    const { DailyTask, html, calls } = load({ appState: stateWith() });
    DailyTask.open();
    assert.truthy(html.dailyTaskScreen.includes('Nhiệm vụ hôm nay'));
    assert.falsy(calls.some(c => c[0] === 'nav'), 'switchScreen already highlighted the bar');
  });
  test('with no tasks the screen offers no reward to chase', () => {
    const { DailyTask, html } = load({ appState: stateWith({ tasks: [] }) });
    DailyTask.renderScreen();
    assert.truthy(html.dailyTaskScreen.includes('Hôm nay chưa có nhiệm vụ nào'));
    assert.falsy(html.dailyTaskScreen.includes('dt-reward'));
  });
  test('close goes back home', () => {
    const { DailyTask, calls } = load({ appState: stateWith() });
    DailyTask.close();
    assert.deepEqual(calls, [['switchScreen', 'homeScreen']]);
  });
});

suite('daily task client: refresh housekeeping', () => {
  test('a background sync repaints the card but not a task screen nobody is on', async () => {
    const reply = { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false };
    const { DailyTask, html } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    assert.truthy(html.dailyTaskCard.includes('1/2'));
    assert.falsy(html.dailyTaskScreen, 'the hidden screen is left alone');
    DailyTask.renderScreen();
    assert.truthy(html.dailyTaskScreen.includes('Book 1 · 🎲 Mix'), 'and still paints on demand');
  });
  test('a poll that found nothing new does not rewrite the profile', async () => {
    const reply = { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false };
    const { DailyTask, calls, sandbox } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'save').length, 1);
    const first = sandbox.appState.dailyTask.fetchedAt;
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'save').length, 1, 'unchanged → no second write');
    assert.truthy(sandbox.appState.dailyTask.fetchedAt >= first, 'the throttle stamp still moves');
    reply.tasks = [Object.assign({}, TASKS[0], { count: 3 })];
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'save').length, 2, 'real progress is written');
    reply.seeds = { ready: true, progress: 1, next: { id: 'lettuce', name: 'Rau cải', days: 1 }, inventory: [], recent: [] };
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'save').length, 3, 'a seed-streak step is written too');
  });
  test('a profile switch mid-flight never lands one learner\'s tasks in the other profile', async () => {
    const reply = { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false };
    const { DailyTask, sandbox } = load({ appState: {}, api: async () => new Promise(r => setTimeout(() => r({ ok: true, data: reply }), 5)) });
    const pending = DailyTask.refresh('sync');
    sandbox.currentUser = 'other-kid';
    await pending;
    assert.falsy(sandbox.appState.dailyTask, 'nothing written for the learner who never asked');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
