// tests/daily-task-farm-ui.test.js — the task page says, in one glance, that
// finishing today's tasks grows the plants and skipping wilts them. Mounted the
// way tests/daily-task-client.test.js mounts js/daily-task.js.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TODAY = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

function load(opts) {
  opts = opts || {};
  const html = {}, calls = [];
  const el = id => ({ id, set innerHTML(v) { html[id] = String(v); }, get innerHTML() { return html[id] || ''; }, hidden: false, classList: { add() {}, remove() {}, contains: () => false } });
  const sandbox = {
    console, Date, Math, JSON, Object, Array, Promise, setTimeout, clearTimeout,
    document: { getElementById: id => el(id), querySelectorAll: () => [] },
    appState: opts.appState || {}, currentUser: 'kid',
    FarmRules: require(path.join(ROOT, 'js', 'farm-rules.js')),
    saveUserData: () => calls.push(['save']), showToast: m => calls.push(['toast', m]),
    switchScreen: s => { calls.push(['switchScreen', s]); return true; }, setBottomNavActive: () => {},
    openNightRaid: () => calls.push(['openNightRaid']),
    NightRaid: { renderBuilder: () => calls.push(['renderBuilder']) },
    createConfetti: () => {},
    EngAuth: { tokenFor: () => 'tok', api: async (p) => { calls.push(['api', p]); return opts.api ? opts.api(p) : { ok: false, data: null }; }, refreshFlags: () => {} },
  };
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/daily-task-catalog.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/daily-task.js'), 'utf8'), ctx);
  return { DailyTask: ctx.DailyTask, html, calls, sandbox };
}
const TASKS = [{ id: 1, kind: 'word:pr1-1', label: 'Book 1 · Unit 1 · The Role of Public Relations', target: 1, count: 0, done: false }];
const farm = over => Object.assign({ crops: 4, ripe: 1, growing: 3, wiltedCount: 0, wilted: false, barracksReady: 0, preview: { id: 'tomato', g: 1, days: 2, wilted: false }, dayCount: 5, ctx: { today: TODAY, doneYesterday: true, doneToday: false } }, over || {});
const stateWith = over => ({ allowBot: true, dailyTask: Object.assign({ fetchedAt: Date.now(), date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, farm: farm() }, over || {}) });

suite('daily task farm ui: the hero and the strip', () => {
  test('growing: the hero promises growth and the strip shows the closest crop', () => {
    const { DailyTask, html } = load({ appState: stateWith() });
    DailyTask.renderScreen();
    const out = html.dailyTaskScreen;
    assert.truthy(out.includes('cây lớn thêm 1 ngày 🌱'), out.slice(0, 400));
    assert.truthy(out.includes('img/farm/tomato-day1.webp'), 'the preview crop at its day');
    assert.truthy(out.includes('3 cây đang lớn, 1 cây chín'));
    assert.truthy(out.includes('DailyTask.viewFarm()'));
  });
  test('wilted: the hero and the strip both say so, with the wilted sprite', () => {
    const { DailyTask, html } = load({ appState: stateWith({ farm: farm({ wilted: true, wiltedCount: 4, preview: { id: 'tomato', g: 1, days: 2, wilted: true }, ctx: { today: TODAY, doneYesterday: false, doneToday: false } }) }) });
    DailyTask.renderScreen();
    const out = html.dailyTaskScreen;
    assert.truthy(out.includes('Cây đang héo 🥀'));
    assert.truthy(out.includes('img/farm/tomato-wilted-old.webp'), 'g=1 of 2 is at half → old');
    assert.truthy(out.includes('4 cây đang héo'));
  });
  test('done: the hero says the plants grew today', () => {
    const { DailyTask, html } = load({ appState: stateWith({ allDone: true, rewardedToday: true, tasks: [{ id: 1, kind: 'word:pr1-1', label: 'P', target: 1, count: 1, done: true }], farm: farm({ ctx: { today: TODAY, doneYesterday: true, doneToday: true } }) }) });
    DailyTask.renderScreen();
    assert.truthy(html.dailyTaskScreen.includes('Cây đã lớn hôm nay 🌼'));
  });
  test('empty garden: the strip invites every child, including a bot-off account', () => {
    const empty = load({ appState: stateWith({ farm: farm({ crops: 0, ripe: 0, growing: 0, preview: null }) }) });
    empty.DailyTask.renderScreen();
    assert.truthy(empty.html.dailyTaskScreen.includes('Vườn đang trống'));
    const plain = load({ appState: Object.assign(stateWith(), { allowBot: false }) });
    plain.DailyTask.renderScreen();
    assert.truthy(plain.html.dailyTaskScreen.includes('3 cây đang lớn, 1 cây chín'), 'the farm must not depend on allowBot');
  });
  test('Xem vườn opens the clean Cướp Đêm main screen without forcing edit mode', () => {
    const { DailyTask, calls } = load({ appState: stateWith() });
    DailyTask.viewFarm();
    assert.equal(calls.filter(c => c[0] === 'openNightRaid').length, 1);
    assert.falsy(calls.some(c => c[0] === 'renderBuilder'), 'openNightRaid owns the clean main render');
  });
});

suite('daily task farm ui: the home card and the celebration', () => {
  test('a wilted garden changes the home card subtitle', () => {
    const { DailyTask, html } = load({ appState: stateWith({ farm: farm({ wilted: true }) }) });
    DailyTask.renderHomeCard();
    assert.truthy(html.dailyTaskCard.includes('Cây đang héo 🥀'));
  });
  test('refresh stores farm from the server and the celebration toast mentions the garden', async () => {
    const { DailyTask, calls, sandbox } = load({ appState: { allowBot: true }, api: () => ({ ok: true, data: { date: TODAY, tasks: [{ id: 1, kind: 'word:pr1-1', label: 'P', target: 1, count: 1, done: true }], allDone: true, rewardedToday: true, justRewarded: true, farm: farm({ ripe: 2, ctx: { today: TODAY, doneYesterday: false, doneToday: true } }) } }) });
    await DailyTask.refresh('sync');
    assert.equal(sandbox.appState.dailyTask.farm.ripe, 2);
    const toast = calls.find(c => c[0] === 'toast');
    assert.truthy(toast && toast[1].includes('Cây tươi lại rồi 🌱') && toast[1].includes('2 cây chín'), toast && toast[1]);
    assert.truthy(toast[1].includes('+200 xu') && !/khiên|kiếm|quà/.test(toast[1]), 'the toast promises the 200 xu and nothing to pick: ' + toast[1]);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
