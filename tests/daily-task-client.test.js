// js/daily-task.js in a vm sandbox with stubbed globals: what the child sees
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
    switchTopicsSubTab: t => calls.push(['switchTopicsSubTab', t]),
    switchUnitSet: s => calls.push(['switchUnitSet', s]),
    startUnitPractice: u => calls.push(['startUnitPractice', u]),
    startMathExam: id => calls.push(['startMathExam', id]),
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
  { id: 1, kind: 'units:hk1-mix', label: 'Units HK1 · 🎲 Mix', target: 5, count: 2, done: false },
  { id: 2, kind: 'phrases', label: 'Phrases practice', target: 1, count: 1, done: true },
];
// Counts are only trusted for the current GMT+7 day (see todayGmt7() in
// js/daily-task.js), so the fixtures follow the clock instead of pinning a
// date that would go stale overnight and fail the suite tomorrow.
const TODAY = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 31 * 3600000).toISOString().slice(0, 10);
function stateWith(over) {
  return { dailyTask: Object.assign({ fetchedAt: Date.now(), date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, shields: { count: 0, activeUntil: 0 } }, over || {}) };
}

suite('daily task client: home card', () => {
  test('no tasks → the card renders empty (nothing for a child who was not assigned)', () => {
    const { DailyTask, html } = load({ appState: stateWith({ tasks: [] }) });
    DailyTask.renderHomeCard();
    assert.equal(html.dailyTaskCard, '');
  });
  test('shows done/total and the shield count', () => {
    const { DailyTask, html } = load({ appState: stateWith({ shields: { count: 3, activeUntil: 0 } }) });
    DailyTask.renderHomeCard();
    assert.truthy(html.dailyTaskCard.includes('1/2'), html.dailyTaskCard);
    assert.truthy(html.dailyTaskCard.includes('3 khiên'));
    assert.truthy(html.dailyTaskCard.includes('DailyTask.open()'));
  });
});

suite('daily task client: task screen', () => {
  test('lists every task; unfinished ones get Vào học, finished ones a tick and no button', () => {
    const { DailyTask, html } = load({ appState: stateWith() });
    DailyTask.renderScreen();
    const out = html.dailyTaskScreen;
    assert.truthy(out.includes('Units HK1 · 🎲 Mix'));
    assert.truthy(out.includes('2/5'));
    assert.truthy(out.includes("DailyTask.go('units:hk1-mix')"));
    assert.falsy(out.includes("DailyTask.go('phrases')"), 'a done task has no Vào học button');
    assert.truthy(out.includes('✓'));
  });
  test('shield block: button when owning shields, countdown when active, nothing to press when empty', () => {
    let r = load({ appState: stateWith({ shields: { count: 2, activeUntil: 0 } }) });
    r.DailyTask.renderScreen();
    assert.truthy(r.html.dailyTaskScreen.includes('DailyTask.activateShield()'));
    assert.truthy(r.html.dailyTaskScreen.includes('x2'));
    r = load({ appState: stateWith({ shields: { count: 1, activeUntil: Date.now() + 3600000 } }) });
    r.DailyTask.renderScreen();
    assert.falsy(r.html.dailyTaskScreen.includes('DailyTask.activateShield()'));
    assert.truthy(r.html.dailyTaskScreen.includes('Đang bảo vệ'));
    r = load({ appState: stateWith({ shields: { count: 0, activeUntil: 0 } }) });
    r.DailyTask.renderScreen();
    assert.falsy(r.html.dailyTaskScreen.includes('DailyTask.activateShield()'));
  });
  test('all done + rewarded shows the reward line — and what the pick became, or that it is still waiting', () => {
    let r = load({ appState: stateWith({ tasks: [TASKS[1]], allDone: true, rewardedToday: true, pending: [TODAY] }) });
    r.DailyTask.renderScreen();
    assert.truthy(r.html.dailyTaskScreen.includes('Đã nhận 200 xu'), r.html.dailyTaskScreen);
    assert.truthy(r.html.dailyTaskScreen.includes('quà đang chờ con mở'), 'today\'s pick is still pending');
    assert.truthy(r.html.dailyTaskScreen.includes('Hôm nay xong rồi'), 'the hero celebrates');
    assert.truthy(r.html.dailyTaskScreen.includes('dt-gift-cta') && r.html.dailyTaskScreen.includes('Armory.open()'), 'the gift button points at the armory');
    r = load({ appState: stateWith({ tasks: [TASKS[1]], allDone: true, rewardedToday: true, pending: [], recent: [{ date: TODAY, kind: 'sword' }] }) });
    r.DailyTask.renderScreen();
    assert.truthy(r.html.dailyTaskScreen.includes('Đã nhận 200 xu + 1 kiếm'), r.html.dailyTaskScreen);
    assert.falsy(r.html.dailyTaskScreen.includes('dt-gift-cta'), 'nothing left to open');
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
  test('units: switch screen, sub-tab, set, then start the unit', async () => {
    const { DailyTask, calls } = load({ appState: stateWith() });
    assert.equal(await DailyTask.go('units:hk1-mix'), true);
    assert.deepEqual(calls, [
      ['switchScreen', 'topicsScreen'], ['switchTopicsSubTab', 'grade4'], ['switchUnitSet', 'hk1'],
      ['startUnitPractice', 'hk1-mix'], ['nav', 'topicsScreen'],
    ]);
  });
  test('maths exam passes the exam id; unknown kind does nothing', async () => {
    const { DailyTask, calls } = load({ appState: stateWith() });
    assert.equal(await DailyTask.go('math-exam:hk1-source-3'), true);
    assert.deepEqual(calls, [['switchScreen', 'mathHubScreen'], ['startMathExam', 'hk1-source-3'], ['nav', 'mathHubScreen']]);
    calls.length = 0;
    assert.equal(await DailyTask.go('bogus'), false);
    assert.deepEqual(calls, []);
  });
  test('a lazily-loaded screen waits for its question bank before the start function runs', async () => {
    const { DailyTask, calls, sandbox } = load({ appState: stateWith() });
    sandbox.LazyData = {
      filesFor: s => (s === 'mathHubScreen' ? ['js/math-exams.js'] : []),
      ensure: s => { calls.push(['ensure', s]); return new Promise(r => setTimeout(r, 5)); },
    };
    assert.equal(await DailyTask.go('math-exam:hk1-source-3'), true);
    assert.deepEqual(calls, [['switchScreen', 'mathHubScreen'], ['ensure', 'mathHubScreen'], ['startMathExam', 'hk1-source-3'], ['nav', 'mathHubScreen']]);
    calls.length = 0;
    assert.equal(await DailyTask.go('units:hk1-mix'), true);
    assert.falsy(calls.some(c => c[0] === 'ensure'), 'screens without lazy files are not awaited');
  });
  test('a missing app function is skipped, not thrown', async () => {
    const { DailyTask, sandbox } = load({ appState: stateWith() });
    delete sandbox.startUnitPractice;
    assert.equal(await DailyTask.go('units:hk1-mix'), true);
  });
});

suite('daily task client: refresh', () => {
  test('without a token nothing is fetched', async () => {
    const { DailyTask, calls } = load({ token: null });
    assert.equal(await DailyTask.refresh('home'), null);
    assert.deepEqual(calls, []);
  });
  test('stores the reply in appState, repaints, and claims coins + celebrates on justRewarded', async () => {
    const reply = { date: TODAY, tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: true, shields: { count: 1, activeUntil: 0 } };
    const { DailyTask, calls, sandbox, html } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    const st = await DailyTask.refresh('home');
    assert.equal(st.allDone, true);
    assert.equal(sandbox.appState.dailyTask.shields.count, 1);
    assert.truthy(calls.some(c => c[0] === 'api' && c[1] === 'me/daily-tasks'));
    assert.truthy(calls.some(c => c[0] === 'refreshFlags'), 'claims the 200 xu right away');
    assert.truthy(calls.some(c => c[0] === 'toast'), 'celebrates');
    assert.truthy(html.dailyTaskCard.includes('1/1'));
  });
  test('a replayed justRewarded for the same date (offline cache) does not celebrate twice', async () => {
    const reply = { date: TODAY, tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: true, shields: { count: 1, activeUntil: 0 } };
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
    const reply = { date: TODAY, tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: false, shields: { count: 1, activeUntil: 0 } };
    const { DailyTask, calls, sandbox } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 1, 'first sight of today\'s reward celebrates');
    assert.equal(calls.filter(c => c[0] === 'refreshFlags').length, 1, 'and claims the coins');
    assert.equal(sandbox.appState.dailyTask.celebratedDate, TODAY);
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 1, 'later polls stay quiet');
  });
  test('a fresh cache is reused on a home render but not on a sync', async () => {
    let n = 0;
    const api = async () => { n++; return { ok: true, data: { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false, shields: { count: 0, activeUntil: 0 } } }; };
    const { DailyTask } = load({ appState: stateWith(), api });
    await DailyTask.refresh('home');
    assert.equal(n, 0, 'fetchedAt is now → throttled');
    await DailyTask.refresh('sync');
    assert.equal(n, 1);
  });
});

suite('daily task client: a cached day that is not today', () => {
  test('yesterday counts are shown as unknown, but the tasks still open', () => {
    const { DailyTask, html } = load({ appState: stateWith({ date: '2000-01-01' }) });
    DailyTask.renderHomeCard();
    assert.truthy(html.dailyTaskCard.includes('Đang cập nhật'), html.dailyTaskCard);
    assert.falsy(html.dailyTaskCard.includes('1/2'), 'yesterday progress is not passed off as today');
    DailyTask.renderScreen();
    assert.falsy(html.dailyTaskScreen.includes('2/5'));
    assert.truthy(html.dailyTaskScreen.includes('…'));
    assert.truthy(html.dailyTaskScreen.includes("DailyTask.go('units:hk1-mix')"), 'the child can still go and learn');
    // Yesterday's tick is worth no more than yesterday's count.
    assert.falsy(html.dailyTaskScreen.includes('✓ Xong'), 'no task claims to be done on a day we have not counted');
    assert.truthy(html.dailyTaskScreen.includes("DailyTask.go('phrases')"), 'the stale-done task gets its button back');
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
});

suite('daily task client: shield button', () => {
  test('every server refusal gets its own child-sized reason', async () => {
    const cases = [['empty', 'Con chưa có khiên nào'], ['active', 'Khiên đang bật rồi'], ['no_home', 'Hãy mở Cướp Đêm và xây nhà trước']];
    for (const [code, msg] of cases) {
      const { DailyTask, calls } = load({
        appState: stateWith(),
        api: async p => (p === 'night-raid/shield' ? { ok: false, data: { code } } : { ok: false, data: null }),
      });
      await DailyTask.activateShield();
      assert.truthy(calls.some(c => c[0] === 'toast' && c[1] === msg), code + ' → ' + JSON.stringify(calls));
    }
  });
  test('offline: the thrown request is caught and explained, never left silent', async () => {
    const { DailyTask, calls } = load({ appState: stateWith(), api: async () => { throw new Error('network down'); } });
    await DailyTask.activateShield();
    assert.truthy(calls.some(c => c[0] === 'toast' && c[1].includes('Không có mạng')), JSON.stringify(calls));
    assert.falsy(calls.some(c => c[0] === 'api' && c[1] === 'me/daily-tasks'), 'no refresh after a failed send');
  });
  test('a double tap spends one shield, not two', async () => {
    let posts = 0;
    const api = async p => {
      if (p === 'night-raid/shield') { posts++; return new Promise(r => setTimeout(() => r({ ok: true, data: {} }), 5)); }
      return { ok: true, data: { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false, shields: { count: 0, activeUntil: 0 } } };
    };
    const { DailyTask } = load({ appState: stateWith(), api });
    const first = DailyTask.activateShield();
    const second = DailyTask.activateShield();
    await first; await second;
    assert.equal(posts, 1);
    await DailyTask.activateShield();
    assert.equal(posts, 2, 'the guard lifts once the first one is done');
  });
});

suite('daily task client: refresh housekeeping', () => {
  test('a background sync repaints the card but not a task screen nobody is on', async () => {
    const reply = { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false, shields: { count: 0, activeUntil: 0 } };
    const { DailyTask, html } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    assert.truthy(html.dailyTaskCard.includes('1/2'));
    assert.falsy(html.dailyTaskScreen, 'the hidden screen is left alone');
    DailyTask.renderScreen();
    assert.truthy(html.dailyTaskScreen.includes('Units HK1'), 'and still paints on demand');
  });
  test('a poll that found nothing new does not rewrite the profile', async () => {
    const reply = { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false, shields: { count: 0, activeUntil: 0 } };
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
  });
  test('a profile switch mid-flight never lands one child tasks in the other profile', async () => {
    const reply = { date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false, shields: { count: 0, activeUntil: 0 } };
    const { DailyTask, sandbox } = load({ appState: {}, api: async () => new Promise(r => setTimeout(() => r({ ok: true, data: reply }), 5)) });
    const pending = DailyTask.refresh('sync');
    sandbox.currentUser = 'other-kid';
    await pending;
    assert.falsy(sandbox.appState.dailyTask, 'nothing written for the child who never asked');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
