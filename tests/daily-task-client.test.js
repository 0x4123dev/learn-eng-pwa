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
    saveUserData() {},
    showToast: m => calls.push(['toast', m]),
    switchScreen: s => { calls.push(['switchScreen', s]); return true; },
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
function stateWith(over) {
  return { dailyTask: Object.assign({ fetchedAt: Date.now(), date: '2026-09-02', tasks: TASKS, allDone: false, rewardedToday: false, shields: { count: 0, activeUntil: 0 } }, over || {}) };
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
    assert.truthy(html.dailyTaskCard.includes('🛡️ 3'));
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
  test('all done + rewarded shows the reward line', () => {
    const { DailyTask, html } = load({ appState: stateWith({ tasks: [TASKS[1]], allDone: true, rewardedToday: true }) });
    DailyTask.renderScreen();
    assert.truthy(html.dailyTaskScreen.includes('Đã nhận 200 xu + 1 khiên'));
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
    const reply = { date: '2026-09-02', tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: true, shields: { count: 1, activeUntil: 0 } };
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
    const reply = { date: '2026-09-02', tasks: [TASKS[1]], allDone: true, rewardedToday: true, justRewarded: true, shields: { count: 1, activeUntil: 0 } };
    const { DailyTask, calls, sandbox } = load({ appState: {}, api: async () => ({ ok: true, data: reply }) });
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 1);
    assert.equal(sandbox.appState.dailyTask.celebratedDate, '2026-09-02');
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 1, 'same date → no second celebration');
    assert.equal(calls.filter(c => c[0] === 'refreshFlags').length, 1);
    reply.date = '2026-09-03';
    await DailyTask.refresh('sync');
    assert.equal(calls.filter(c => c[0] === 'toast').length, 2, 'a new date celebrates again');
  });
  test('a fresh cache is reused on a home render but not on a sync', async () => {
    let n = 0;
    const api = async () => { n++; return { ok: true, data: { date: '2026-09-02', tasks: TASKS, allDone: false, rewardedToday: false, justRewarded: false, shields: { count: 0, activeUntil: 0 } } }; };
    const { DailyTask } = load({ appState: stateWith(), api });
    await DailyTask.refresh('home');
    assert.equal(n, 0, 'fetchedAt is now → throttled');
    await DailyTask.refresh('sync');
    assert.equal(n, 1);
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
