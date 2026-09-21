// lazy-code-groups.test.js — the farm is CODE that does not block the first
// paint, and every road into it waits for it.
//
// Before 2026-09-11 index.html loaded 68 scripts (2.3 MB) before Home could
// draw. The Arena and the Math tab are gone now, but the same loader keeps
// the farm (js/night-raid.js) off the first paint: it is a group in
// js/lazy-data.js GROUP_FILES (farm), fetched through the same loader as the
// question banks. That is only safe if
//   • nothing that runs at startup reaches for its names bare,
//   • every way in (the bottom bar, a Daily Task deep link, the seed tray)
//     waits for the group before calling into it,
//   • the group still runs cleanly when it lands AFTER the startup set.
// This file walks each of those.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const lazy = require(path.join(ROOT, 'js', 'lazy-data.js'));

// The order index.html loaded these in, which is the order they must still
// run in: a later file may call an earlier one while it loads.
const FARM = ['js/farm-art-manifest.js', 'js/night-raid.js'];
// What Home and Daily Task draw from before any tab is opened — these must
// NOT move into a group, or the pet hero, the cheer and the farm sprite on
// the task card quietly vanish.
const STAYS_EAGER = ['js/petart.js', 'js/petcheer.js', 'js/farm-rules.js', 'js/night-raid-rules.js'];

const html = read('index.html');
const eager = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
const size = (files) => files.reduce((s, f) => s + fs.statSync(path.join(ROOT, f)).size, 0);

suite('lazy code groups: the split itself', () => {
  test('the farm is a group of its own, in the order index.html had', () => {
    assert.deepEqual(Object.keys(lazy.GROUP_FILES), ['farm'], 'the farm is the only code group');
    assert.deepEqual(lazy.GROUP_FILES.farm, FARM);
    assert.deepEqual(lazy.filesFor('farm'), FARM, 'filesFor must answer for a group key');
  });

  test('none of them is an eager <script> any more, and every file exists', () => {
    for (const f of FARM) {
      assert.falsy(eager.includes(f), f + ' is back in index.html');
      assert.truthy(fs.existsSync(path.join(ROOT, f)), f + ' does not exist');
    }
  });

  test('the startup set stays light — the point of the exercise', () => {
    const moved = size(FARM);
    assert.truthy(moved > 100 * 1024, 'only ' + (moved / 1024).toFixed(0) + ' kB moved off the first paint');
    const startup = size(eager);
    assert.truthy(startup < 600 * 1024, 'startup JS is ' + (startup / 1024).toFixed(0) + ' kB');
  });

  test('what Home needs before any tab opens stays eager', () => {
    for (const f of STAYS_EAGER) assert.truthy(eager.includes(f), f + ' must load at startup');
    for (const f of STAYS_EAGER) assert.falsy(FARM.includes(f), f + ' must not be in a group');
  });

  test('every file is still precached by the service worker, so offline is unchanged', () => {
    const sw = read('sw.js');
    for (const f of FARM) assert.truthy(sw.includes("'/" + f + "'"), f + ' dropped from the precache');
  });

  test('and still claimed in the verify manifest', () => {
    const m = require(path.join(ROOT, 'tests', 'verify', 'manifest.js'));
    const claimed = new Set(m.FEATURES.flatMap((f) => f.banks || []));
    for (const f of FARM) assert.truthy(claimed.has(f), f + ' is not claimed by any feature');
  });

  test('a screen maps to its code group, and filesFor puts the code before the stylesheet', () => {
    assert.deepEqual(lazy.SCREEN_GROUPS, { nightRaidScreen: 'farm' });
    assert.equal(lazy.groupFor('nightRaidScreen'), 'farm');
    assert.equal(lazy.groupFor('homeScreen'), null);
    assert.equal(lazy.groupFor('wordScreen'), null, 'the Word screen has banks, not code');
    // …and after the code, the screen's own stylesheet(s) (tests/css-split.test.js).
    assert.deepEqual(lazy.filesFor('nightRaidScreen'), FARM.concat(lazy.SCREEN_FILES.nightRaidScreen));
    assert.deepEqual(lazy.SCREEN_FILES.nightRaidScreen.filter((f) => !/\.css$/.test(f)), [], 'the farm has no banks of its own, only a stylesheet');
  });
});

// A LazyData mounted the way tests/lazy-data.test.js mounts it: <script>
// tags are recorded, and finish() fires their onload in order.
function mountLoader() {
  const injected = [];
  const doc = {
    head: { appendChild(node) { injected.push(node); } },
    // A <script src> for a bank, a <link href> for a stylesheet: `src` reads either.
    createElement: () => ({ set src(v) { this._src = v; }, set href(v) { this._src = v; }, get src() { return this._src; }, async: true }),
  };
  const store = {};
  const ctx = { document: doc, console, Promise, Object, Array, JSON, String, Number,
    setTimeout: (fn) => fn(), requestIdleCallback: null,
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } } };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/lazy-data.js') + '\n;globalThis.LazyData = LazyData;', ctx, { filename: 'js/lazy-data.js' });
  return { L: ctx.LazyData, injected, store, finish: () => injected.forEach((n) => n.onload && n.onload()) };
}

suite('lazy code groups: the loader treats a screen and its code as one wait', () => {
  test('ensure(nightRaidScreen) injects the farm code, in order, then the stylesheet', () => {
    const m = mountLoader();
    assert.falsy(m.L.ready('nightRaidScreen'));
    const p = m.L.ensure('nightRaidScreen');
    assert.deepEqual(m.injected.map((n) => n.src), FARM.concat(lazy.SCREEN_FILES.nightRaidScreen));
    assert.truthy(m.injected.filter((n) => !/\.css$/.test(n.src)).every((n) => n.async === false), 'in-order execution needs async=false');
    m.finish();
    return p.then(() => {
      assert.truthy(m.L.ready('nightRaidScreen'));
      assert.truthy(m.L.ready('farm'), 'the group reads as ready through its own key too');
      return m.L.ensure('farm').then(() => assert.equal(m.injected.length, FARM.length + lazy.SCREEN_FILES.nightRaidScreen.length, 'nothing is fetched twice'));
    });
  });

  test('a code screen is remembered as the tab to warm next time', () => {
    const m = mountLoader();
    m.L.ensure('nightRaidScreen');
    assert.equal(m.store['flashlingo-last-tab'], 'nightRaidScreen');
    m.L.ensure('farm');
    assert.equal(m.store['flashlingo-last-tab'], 'nightRaidScreen', 'a bare group key is not a tab');
    const w = mountLoader();
    w.store['flashlingo-last-tab'] = 'nightRaidScreen';
    w.L.warmAll();
    // warmAll chains the files one after another, so the first tag is
    // appended a microtask later.
    return Promise.resolve().then(() => {
      assert.equal(w.injected[0] && w.injected[0].src, FARM[0], 'warm-up starts with the first farm file');
    });
  });
});

suite('lazy code groups: every road in waits for the group', () => {
  const app = read('js/app.js');

  test('the bottom bar still names openNightRaid()', () => {
    assert.truthy(/data-nav-key="farm"[^>]*onclick="openNightRaid\(\)"/.test(html));
  });

  test('openNightRaid is a startup placeholder that fetches the farm', () => {
    assert.truthy(app.includes("var openNightRaid = lazyEntry('farm', 'openNightRaid', 'nightRaidScreen');"));
    const body = app.slice(app.indexOf('function lazyEntry('), app.indexOf('var openNightRaid'));
    assert.truthy(body.includes('if (switchScreen(screenId) === false) return Promise.resolve();'),
      'a refused screen switch must stop the whole thing');
    assert.truthy(body.includes('LazyData.ensure(group).then('));
    assert.truthy(body.includes('real === placeholder'), 'a failed download must not call the placeholder again');
    assert.truthy(body.includes("classList.contains('active')) return;"), 'the child may have moved on while it downloaded');
    // The real function carries the SAME name, so it replaces the
    // placeholder the moment its file runs.
    assert.truthy(/^function openNightRaid\(\)/m.test(read('js/night-raid.js')));
    // …and a placeholder is a `var`, which a later function declaration
    // may overwrite; a `const` here would be a SyntaxError in the browser.
    assert.falsy(/(const|let) openNightRaid/.test(app));
  });

  test('switchScreen draws the placeholder and paints the Word screen only after its bank lands', () => {
    assert.truthy(app.includes("if (typeof LazyData !== 'undefined' && LazyData.filesFor(screenId).length) {"));
    assert.truthy(app.includes("if (screenId === 'wordScreen' && typeof renderWordHome === 'function') renderWordHome();"));
    assert.truthy(app.includes('Đang tải bài…'));
  });

  test('a study checkpoint of a Book practice waits for the Word screen (bank included)', () => {
    assert.truthy(app.includes("if (checkpoint.kind !== 'units' || checkpoint.screen !== 'wordScreen') {"));
    assert.truthy(app.includes('Promise.all(notReady.map(g => LazyData.ensure(g)))'));
  });

  test('a Daily Task deep link waits for its screen, which includes any code', () => {
    const dt = read('js/daily-task.js');
    assert.truthy(dt.includes('await LazyData.ensure(entry.go.screen)'));
    const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));
    const wordKeys = Catalog.all().filter((e) => e.go && e.go.screen === 'wordScreen');
    assert.truthy(wordKeys.length >= 10, 'the catalog lists Book deep links');
    for (const e of wordKeys) assert.truthy(lazy.filesFor(e.go.screen).includes('js/word-data.js'), e.key + ' would run before js/word-data.js');
  });

  test('the seed tray waits for the placeholder to finish before asking NightRaid to open it', () => {
    const dt = read('js/daily-task.js');
    assert.truthy(dt.includes('Promise.resolve(openNightRaid()).then(() => {'));
  });
});

// The placeholder door, executed, in the same harness tests/verify/client.js
// boots the real index.html script list with (a DOM shim, lazy <script>s
// served from disk).
suite('lazy code groups: the placeholder door, executed', () => {
  const { mountApp, loginTestUser } = require('./verify/client.js');
  const drain = async () => { for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r)); };

  test('a failed download leaves the child where they are with a message, and never loops', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100 });
    let asked = 0;
    // LazyData resolves even when a file fails to download; nothing then
    // replaces the placeholder. Stand in for that without touching the DOM.
    h.sandbox.LazyData.ensure = () => { asked++; return Promise.resolve(); };
    const placeholder = h.sandbox.openNightRaid;
    await h.sandbox.openNightRaid();
    await drain();
    assert.truthy(asked >= 1, 'the group was asked for');
    assert.truthy(h.sandbox.openNightRaid === placeholder, 'nothing replaced the placeholder');
    assert.truthy(/Không tải được/.test(h.el('nightRaidScreen').textContent), 'the failure is said on the screen');
    assert.truthy(asked <= 2, 'and the placeholder did not call itself again (asked ' + asked + ' times)');
  });

  test('a refused screen switch stops everything — no download, no call', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100 });
    let asked = 0;
    h.sandbox.LazyData.ensure = () => { asked++; return Promise.resolve(); };
    h.sandbox.isUnitPracticeActive = () => true;         // a Book practice in progress
    h.sandbox.__confirmAnswer = false;                    // …and the child stays
    await h.sandbox.openNightRaid();
    await drain();
    assert.equal(h.sandbox.__confirmLog.length, 1, 'the child was asked once');
    assert.equal(asked, 0, 'nothing was fetched after the child chose to stay');
    assert.falsy(h.el('nightRaidScreen').classList.contains('active'));
  });

  test('a child who moved on while it downloaded is not dragged back into the farm', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100 });
    let release;
    const realEnsure = h.sandbox.LazyData.ensure;
    h.sandbox.LazyData.ensure = (k) => new Promise((r) => { release = () => realEnsure(k).then(r); });
    const p = h.sandbox.openNightRaid();
    h.sandbox.switchScreen('homeScreen');                 // tapped Home while it loaded
    h.sandbox.LazyData.ensure = realEnsure;
    release();
    await p;
    await drain();
    assert.truthy(h.el('homeScreen').classList.contains('active'), 'Home stays');
    assert.falsy(h.el('nightRaidScreen').classList.contains('active'));
    assert.falsy(h.el('nightRaidScreen').querySelector('.nr-builder-map'), 'the farm was not rendered underneath');
  });
});

// The part that proves the claim in the file header: index.html's remaining
// startup scripts boot without a ReferenceError in the same harness
// tests/verify/client.js uses, and the group runs cleanly on top of them.
suite('lazy code groups: startup boots without the group, and the group boots on top', () => {
  const { mountApp, loginTestUser, stubServer } = require('./verify/client.js');

  test('the startup set runs with no error, and reaches Home and the Daily Task card without the group', () => {
    const h = mountApp();
    assert.deepEqual(h.loadErrors, [], 'files that threw while loading');
    assert.equal(h.scripts.length, eager.length);
    loginTestUser(h, { coins: 300, dogLevel: 3, dogGrowthXP: 400,
      dailyTask: { date: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), fetchedAt: Date.now(),
        shields: { count: 1, activeUntil: 0 }, pending: [], recent: [],
        tasks: [{ id: 1, kind: 'word:pr1-1', label: 'Book 1 · Unit 1', target: 1, count: 0, done: false }],
        farm: { crops: 1, ripe: 0, growing: 1, wiltedCount: 0, wilted: false, preview: { id: 'tomato', g: 1, days: 2, wilted: false } } } });
    h.sandbox.renderHome();
    assert.truthy(h.el('homeScreen').innerHTML.length > 0, 'Home rendered');
    assert.truthy(h.el('homeScreen').innerHTML.includes('<svg'), 'the pet hero is still the petart.js rig, not the emoji fallback');
    assert.equal(typeof h.sandbox.openNightRaid, 'function');
    assert.equal(typeof h.sandbox.NightRaid, 'undefined', 'the farm code must not be in yet');
    // Every piece of startup code that names something the group defines —
    // the leave guards in switchScreen, the update guard, the checkpoint
    // writer and reader, the profile teardown, the Daily Task card (FarmRules
    // stays eager for it) — run with the group absent. A bare reference
    // would be a ReferenceError here, exactly as on the device.
    assert.equal(h.sandbox._busyWithTimedActivity(), false);
    assert.equal(h.sandbox.buildStudyCheckpoint(), null);
    assert.equal(h.sandbox.restoreStudyCheckpoint(), false);
    for (const id of ['wordScreen', 'dailyTaskScreen', 'homeScreen']) {
      assert.truthy(h.sandbox.switchScreen(id), 'switchScreen(' + id + ')');
    }
    h.sandbox.navigateToProfile();
    assert.truthy(h.el('profileScreen').classList.contains('active'));
    h.sandbox.navigateFromProfile();
    h.peek('DailyTask').renderHomeCard();
    assert.truthy(h.el('dailyTaskCard').innerHTML.length > 0, 'the task card rendered');
    h.peek('DailyTask').renderScreen();
    assert.truthy(h.el('dailyTaskScreen').innerHTML.includes('img/farm/tomato-day1.webp'), 'the farm sprite still comes from the eager FarmRules');
    h.sandbox.forgetProfileState();
    h.sandbox.switchScreen('homeScreen');
    assert.equal(h.consoleLog.error.length, 0, 'console.error: ' + h.consoleLog.error.join(' | '));
  });

  test('the farm group runs cleanly after the startup set', async () => {
    const h = mountApp();
    const files = h.sandbox.LazyData.GROUP_FILES.farm;
    await h.sandbox.LazyData.ensure('farm');
    assert.deepEqual(h.loadErrors.filter((e) => e.phase === 'lazy'), [], 'files that threw while loading lazily');
    assert.deepEqual(h.banksLoaded, files, 'every file of the group ran, in order');
    assert.truthy(h.sandbox.LazyData.ready('farm'));
  });

  test('once the farm has landed, the placeholder is gone and the bottom bar opens the real farm', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100, dogLevel: 4 });
    stubServer(h, (p) => (p === 'night-raid/home'
      ? { ok: true, data: { home: { coins: 100, dogLevel: 4, layout: null }, dayCount: 3,
          ctx: { today: '2026-01-08', doneYesterday: true, doneToday: false },
          seeds: { progress: 0, goal: 2, next: null, inventory: [], recent: [] } } }
      : { ok: false, data: null }));
    const placeholder = h.sandbox.openNightRaid;
    const p = h.sandbox.openNightRaid();               // the nav button's onclick
    assert.truthy(h.el('nightRaidScreen').classList.contains('active'), 'the farm screen is shown at once');
    assert.truthy(/Đang tải/.test(h.el('nightRaidScreen').textContent), 'with the loading line while the code downloads');
    await p;
    for (let i = 0; i < 12; i++) await new Promise((r) => setImmediate(r));
    assert.truthy(h.sandbox.openNightRaid !== placeholder, 'js/night-raid.js replaced the placeholder');
    assert.truthy(h.sandbox.LazyData.ready('nightRaidScreen'));
    assert.equal(typeof h.sandbox.NightRaid, 'object');
    assert.falsy(/Đang tải/.test(h.el('nightRaidScreen').textContent));
    assert.truthy(h.el('nightRaidScreen').innerHTML.length > 0, 'the real farm rendered');
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
