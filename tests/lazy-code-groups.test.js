// lazy-code-groups.test.js — the Arena and the Math tab are CODE that no
// longer blocks the first paint, and every road into them waits for it.
//
// Before 2026-09-11 index.html loaded 68 scripts (2.3 MB) before Home could
// draw, and ~1 MB of that was js/night-raid*.js, js/petbattle*.js, the ghost
// offering, js/math*.js — code a child on Learn never runs. They are now two
// groups in js/lazy-data.js GROUP_FILES (arena, math), fetched through the
// same loader as the question banks. That is only safe if
//   • nothing that runs at startup reaches for their names bare,
//   • every way in (the bottom bar, a Daily Task deep link, a study
//     checkpoint, the seed tray) waits for the group before calling into it,
//   • the group still runs cleanly when it lands AFTER the startup set.
// This file walks each of those. Modelled on tests/math-hk2-lazy-group.test.js.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const lazy = require(path.join(ROOT, 'js', 'lazy-data.js'));

// The order index.html loaded these in (v4.17.89), which is the order they
// must still run in: a later file may call an earlier one while it loads.
const ARENA = [
  'js/battlecalc.js', 'js/battle-teammates.js', 'js/battle-camera.js', 'js/battle-scenes.js',
  'js/castle-skins.js', 'js/farm-art-manifest.js',
  'js/night-raid-choreo.js', 'js/night-raid-art.js', 'js/night-raid-game.js', 'js/night-raid-ruins.js',
  'js/night-raid-phaser.js', 'js/night-raid.js',
  'js/ghost-offering-schedule.js', 'js/ghost-offering-link.js', 'js/ghost-offering-event.js',
  'js/battlelink.js', 'js/petbattle.js', 'js/petbattlegame.js',
];
const MATH = [
  'js/math-glossary.js', 'js/math-figures.js', 'js/mathwars.js', 'js/math-tables.js',
  'js/math-fight-rules.js', 'js/math-fight.js', 'js/math.js', 'js/math-copy.js', 'js/math-board.js',
];
// What Home, Daily Task and the Armoury draw from before any tab is opened —
// these must NOT move into a group, or the pet hero, the cheer, the farm
// sprite on the task card and the trophy cabinet quietly vanish.
const STAYS_EAGER = ['js/petart.js', 'js/petcheer.js', 'js/farm-rules.js', 'js/night-raid-rules.js',
  'js/cups.js', 'js/friends.js', 'js/armory.js'];

const html = read('index.html');
const eager = [...html.matchAll(/<script src="(js\/[^"]+)"><\/script>/g)].map((m) => m[1]);
const size = (files) => files.reduce((s, f) => s + fs.statSync(path.join(ROOT, f)).size, 0);

suite('lazy code groups: the split itself', () => {
  test('arena and math are groups of their own, in the order index.html had', () => {
    assert.deepEqual(lazy.GROUP_FILES.arena, ARENA);
    assert.deepEqual(lazy.GROUP_FILES.math, MATH);
    assert.deepEqual(lazy.filesFor('arena'), ARENA, 'filesFor must answer for a group key');
    assert.deepEqual(lazy.filesFor('math'), MATH);
  });

  test('none of them is an eager <script> any more, and every file exists', () => {
    for (const f of ARENA.concat(MATH)) {
      assert.falsy(eager.includes(f), f + ' is back in index.html');
      assert.truthy(fs.existsSync(path.join(ROOT, f)), f + ' does not exist');
    }
  });

  test('the startup set lost close to a megabyte — the point of the exercise', () => {
    const moved = size(ARENA.concat(MATH));
    assert.truthy(moved > 900 * 1024, 'only ' + (moved / 1024).toFixed(0) + ' kB moved off the first paint');
    const startup = size(eager);
    assert.truthy(startup < 1.45 * 1024 * 1024, 'startup JS is ' + (startup / 1048576).toFixed(2) + ' MB');
  });

  test('what Home needs before any tab opens stays eager', () => {
    for (const f of STAYS_EAGER) assert.truthy(eager.includes(f), f + ' must load at startup');
    for (const f of STAYS_EAGER) assert.falsy(ARENA.concat(MATH).includes(f), f + ' must not be in a group');
  });

  test('every file is still precached by the service worker, so offline is unchanged', () => {
    const sw = read('sw.js');
    for (const f of ARENA.concat(MATH)) assert.truthy(sw.includes("'/" + f + "'"), f + ' dropped from the precache');
  });

  test('and still claimed in the verify manifest', () => {
    const m = require(path.join(ROOT, 'tests', 'verify', 'manifest.js'));
    const claimed = new Set(m.FEATURES.flatMap((f) => f.banks || []));
    for (const f of ARENA.concat(MATH)) assert.truthy(claimed.has(f), f + ' is not claimed by any feature');
  });

  test('a screen maps to its code group, and filesFor puts the code before the banks', () => {
    assert.deepEqual(lazy.SCREEN_GROUPS, { petBattleScreen: 'arena', nightRaidScreen: 'arena', mathHubScreen: 'math' });
    assert.equal(lazy.groupFor('mathHubScreen'), 'math');
    assert.equal(lazy.groupFor('homeScreen'), null);
    const math = lazy.filesFor('mathHubScreen');
    assert.deepEqual(math.slice(0, MATH.length), MATH, 'the math code must come first');
    assert.deepEqual(math.slice(MATH.length), lazy.SCREEN_FILES.mathHubScreen, 'then the banks, unchanged');
    // …and after the code, the screen's own stylesheet(s) (tests/css-split.test.js).
    assert.deepEqual(lazy.filesFor('petBattleScreen'), ARENA.concat(lazy.SCREEN_FILES.petBattleScreen));
    assert.deepEqual(lazy.filesFor('nightRaidScreen'), ARENA.concat(lazy.SCREEN_FILES.nightRaidScreen));
    assert.deepEqual(lazy.SCREEN_FILES.petBattleScreen.filter((f) => !/\.css$/.test(f)), [], 'the Arena has no banks of its own, only stylesheets');
    // The HK2 split is untouched by this one.
    assert.falsy(lazy.filesFor('mathHubScreen').some((f) => /-hk2\.js$/.test(f)));
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
  test('ensure(mathHubScreen) injects the math code, in order, then the banks', () => {
    const m = mountLoader();
    assert.falsy(m.L.ready('mathHubScreen'));
    const p = m.L.ensure('mathHubScreen');
    assert.deepEqual(m.injected.map((n) => n.src), MATH.concat(lazy.SCREEN_FILES.mathHubScreen));
    assert.truthy(m.injected.filter((n) => !/\.css$/.test(n.src)).every((n) => n.async === false), 'in-order execution needs async=false');
    m.finish();
    return p.then(() => {
      assert.truthy(m.L.ready('mathHubScreen'));
      assert.truthy(m.L.ready('math'), 'the group reads as ready through its own key too');
      return m.L.ensure('math').then(() => assert.equal(m.injected.length, MATH.length + lazy.SCREEN_FILES.mathHubScreen.length, 'nothing is fetched twice'));
    });
  });

  test('the arena group arrives once for both of its screens', () => {
    const m = mountLoader();
    const p = m.L.ensure('petBattleScreen');
    assert.deepEqual(m.injected.map((n) => n.src), ARENA.concat(lazy.SCREEN_FILES.petBattleScreen));
    m.finish();
    return p.then(() => {
      assert.truthy(m.L.ready('nightRaidScreen'), 'the raid screen shares the code (and the Arena already fetched its sheet)');
      return m.L.ensure('nightRaidScreen').then(() => assert.equal(m.injected.length, ARENA.length + lazy.SCREEN_FILES.petBattleScreen.length));
    });
  });

  test('a code screen is remembered as the tab to warm next time', () => {
    const m = mountLoader();
    m.L.ensure('petBattleScreen');
    assert.equal(m.store['flashlingo-last-tab'], 'petBattleScreen');
    m.L.ensure('arena');
    assert.equal(m.store['flashlingo-last-tab'], 'petBattleScreen', 'a bare group key is not a tab');
    const w = mountLoader();
    w.store['flashlingo-last-tab'] = 'petBattleScreen';
    w.L.warmAll();
    // warmAll chains the files one after another, so the first tag is
    // appended a microtask later.
    return Promise.resolve().then(() => {
      assert.equal(w.injected[0] && w.injected[0].src, ARENA[0], 'warm-up starts with the first arena file');
    });
  });
});

suite('lazy code groups: every road in waits for the group', () => {
  const app = read('js/app.js');

  test('the bottom bar still names openPetBattle() and switchScreen(mathHubScreen)', () => {
    assert.truthy(/data-nav-key="arena"[^>]*onclick="openPetBattle\(\)"/.test(html));
    assert.truthy(/data-nav-key="math"[^>]*onclick="switchScreen\('mathHubScreen'\)"/.test(html));
  });

  test('openPetBattle and openNightRaid are startup placeholders that fetch the arena', () => {
    assert.truthy(app.includes("var openPetBattle = lazyEntry('arena', 'openPetBattle', 'petBattleScreen');"));
    assert.truthy(app.includes("var openNightRaid = lazyEntry('arena', 'openNightRaid', 'nightRaidScreen');"));
    const body = app.slice(app.indexOf('function lazyEntry('), app.indexOf('var openPetBattle'));
    assert.truthy(body.includes('if (switchScreen(screenId) === false) return Promise.resolve();'),
      'a refused screen switch must stop the whole thing');
    assert.truthy(body.includes('LazyData.ensure(group).then('));
    assert.truthy(body.includes('real === placeholder'), 'a failed download must not call the placeholder again');
    assert.truthy(body.includes("classList.contains('active')) return;"), 'the child may have moved on while it downloaded');
    // The real functions carry the SAME names, so they replace the
    // placeholders the moment their file runs.
    assert.truthy(/^function openPetBattle\(\)/m.test(read('js/petbattle.js')));
    assert.truthy(/^function openNightRaid\(\)/m.test(read('js/night-raid.js')));
    // …and a placeholder is a `var`, which a later function declaration
    // may overwrite; a `const` here would be a SyntaxError in the browser.
    assert.falsy(/(const|let) openPetBattle/.test(app));
  });

  test('switchScreen draws the placeholder and paints Math only after the group lands', () => {
    assert.truthy(app.includes("if (typeof LazyData !== 'undefined' && LazyData.filesFor(screenId).length) {"));
    assert.truthy(app.includes("else if (screenId === 'mathHubScreen' && typeof renderMathHome === 'function') renderMathHome();"));
    assert.truthy(app.includes('Đang tải bài…'));
  });

  test('a study checkpoint of a maths or Math Wars round waits for the Math screen (code included)', () => {
    assert.truthy(app.includes("math: 'mathHubScreen', mathwars: 'mathHubScreen',"));
    assert.truthy(app.includes('Promise.all(notReady.map(g => LazyData.ensure(g)))'));
  });

  test('a Daily Task deep link waits for its screen, which now includes the code', () => {
    const dt = read('js/daily-task.js');
    assert.truthy(dt.includes('await LazyData.ensure(entry.go.screen)'));
    const Catalog = require(path.join(ROOT, 'js', 'daily-task-catalog.js'));
    const mathKeys = Catalog.all().filter((e) => e.go && e.go.screen === 'mathHubScreen');
    assert.truthy(mathKeys.length >= 10, 'the catalog lists maths deep links');
    for (const e of mathKeys) assert.truthy(lazy.filesFor(e.go.screen).includes('js/math.js'), e.key + ' would run before js/math.js');
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
    const placeholder = h.sandbox.openPetBattle;
    await h.sandbox.openPetBattle();
    await drain();
    assert.truthy(asked >= 1, 'the group was asked for');
    assert.truthy(h.sandbox.openPetBattle === placeholder, 'nothing replaced the placeholder');
    assert.truthy(/Không tải được/.test(h.el('petBattleScreen').textContent), 'the failure is said on the screen');
    assert.truthy(asked <= 2, 'and the placeholder did not call itself again (asked ' + asked + ' times)');
  });

  test('a refused screen switch stops everything — no download, no call', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100 });
    let asked = 0;
    h.sandbox.LazyData.ensure = () => { asked++; return Promise.resolve(); };
    h.sandbox.isGrammarQuizActive = () => true;          // an exam in progress
    h.sandbox.__confirmAnswer = false;                    // …and the child stays
    await h.sandbox.openNightRaid();
    await drain();
    assert.equal(h.sandbox.__confirmLog.length, 1, 'the child was asked once');
    assert.equal(asked, 0, 'nothing was fetched after the child chose to stay');
    assert.falsy(h.el('nightRaidScreen').classList.contains('active'));
  });

  test('a child who moved on while it downloaded is not dragged back into the Arena', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100 });
    let release;
    const realEnsure = h.sandbox.LazyData.ensure;
    h.sandbox.LazyData.ensure = (k) => new Promise((r) => { release = () => realEnsure(k).then(r); });
    const p = h.sandbox.openPetBattle();
    h.sandbox.switchScreen('homeScreen');                 // tapped Home while it loaded
    h.sandbox.LazyData.ensure = realEnsure;
    release();
    await p;
    await drain();
    assert.truthy(h.el('homeScreen').classList.contains('active'), 'Home stays');
    assert.falsy(h.el('petBattleScreen').classList.contains('active'));
    assert.falsy(h.el('petBattleScreen').querySelector('.pb-friend'), 'the lobby was not rendered underneath');
  });
});

// The part that proves the claim in the file header: index.html's remaining
// startup scripts boot without a ReferenceError in the same harness
// tests/verify/client.js uses, and each group runs cleanly on top of them.
suite('lazy code groups: startup boots without the groups, and the groups boot on top', () => {
  const { mountApp, loginTestUser, stubServer } = require('./verify/client.js');

  test('the startup set runs with no error, and reaches Home and the Daily Task card without the groups', () => {
    const h = mountApp();
    assert.deepEqual(h.loadErrors, [], 'files that threw while loading');
    assert.equal(h.scripts.length, eager.length);
    loginTestUser(h, { coins: 300, dogLevel: 3, dogGrowthXP: 400,
      dailyTask: { date: new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10), fetchedAt: Date.now(),
        shields: { count: 1, activeUntil: 0 }, swords: { count: 2 }, pending: [], recent: [],
        tasks: [{ id: 1, kind: 'phrases', label: 'Phrases practice', target: 1, count: 0, done: false }],
        farm: { crops: 1, ripe: 0, growing: 1, wiltedCount: 0, wilted: false, preview: { id: 'tomato', g: 1, days: 2, wilted: false } } } });
    h.sandbox.renderHome();
    assert.truthy(h.el('homeScreen').innerHTML.length > 0, 'Home rendered');
    assert.truthy(h.el('homeScreen').innerHTML.includes('<svg'), 'the pet hero is still the petart.js rig, not the emoji fallback');
    assert.equal(typeof h.sandbox.openPetBattle, 'function');
    assert.equal(typeof h.sandbox.renderMathHome, 'undefined', 'the math code must not be in yet');
    // Every piece of startup code that names something the groups define —
    // the leave guards in switchScreen, the update guard, the checkpoint
    // writer and reader, the profile teardown, the Daily Task card and the
    // Armoury (NightRaidRules stays eager for them), the Profile screen's
    // trophy cabinet — run with the groups absent. A bare reference would be
    // a ReferenceError here, exactly as on the device.
    assert.equal(h.sandbox._busyWithTimedActivity(), false);
    assert.equal(h.sandbox.buildStudyCheckpoint(), null);
    assert.equal(h.sandbox.restoreStudyCheckpoint(), false);
    for (const id of ['learnHubScreen', 'gradeFourScreen', 'dailyTaskScreen', 'homeScreen']) {
      assert.truthy(h.sandbox.switchScreen(id), 'switchScreen(' + id + ')');
    }
    h.sandbox.navigateToProfile();
    assert.truthy(h.el('profileScreen').classList.contains('active'));
    h.sandbox.navigateFromProfile();
    h.peek('DailyTask').renderHomeCard();
    assert.truthy(h.el('dailyTaskCard').innerHTML.includes('Armory.open()'), 'the task card offers the Armoury');
    h.peek('DailyTask').renderScreen();
    assert.truthy(h.el('dailyTaskScreen').innerHTML.includes('img/farm/tomato-day1.webp'), 'the farm sprite still comes from the eager FarmRules');
    h.peek('Armory').open();
    assert.truthy(h.el('armoryScreen') && h.el('armoryScreen').textContent.includes('DAM'), 'the Armoury still counts sword damage from the eager rules');
    h.peek('Armory').close();
    h.sandbox.forgetProfileState();
    h.sandbox.switchScreen('homeScreen');
    assert.equal(h.consoleLog.error.length, 0, 'console.error: ' + h.consoleLog.error.join(' | '));
  });

  for (const group of ['arena', 'math']) {
    test('the ' + group + ' group runs cleanly after the startup set', async () => {
      const h = mountApp();
      const files = h.sandbox.LazyData.GROUP_FILES[group];
      await h.sandbox.LazyData.ensure(group);
      assert.deepEqual(h.loadErrors.filter((e) => e.phase === 'lazy'), [], 'files that threw while loading lazily');
      assert.deepEqual(h.banksLoaded, files, 'every file of the group ran, in order');
      assert.truthy(h.sandbox.LazyData.ready(group));
    });
  }

  test('once the arena has landed, the placeholders are gone and the bottom bar opens the real lobby', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100, dogLevel: 4 });
    stubServer(h, (p) => (p === 'battle'
      ? { ok: true, data: { ammo: 2, readyAt: 0, stats: { wins: 0, losses: 0 }, battle: null } }
      : { ok: false, data: null }));
    h.run("_friendsData = { friends: [{userId:22,username:'Oleole'}], incoming: [], outgoing: [] }");
    const placeholder = h.sandbox.openPetBattle;
    const p = h.sandbox.openPetBattle();               // the nav button's onclick
    assert.truthy(h.el('petBattleScreen').classList.contains('active'), 'the Arena screen is shown at once');
    assert.truthy(/Đang tải/.test(h.el('petBattleScreen').textContent), 'with the loading line while the code downloads');
    await p;
    for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
    assert.truthy(h.sandbox.openPetBattle !== placeholder, 'js/petbattle.js replaced the placeholder');
    assert.truthy(h.el('petBattleScreen').querySelectorAll('.pb-friend').length === 1, 'the real lobby rendered');
    assert.falsy(/Đang tải/.test(h.el('petBattleScreen').textContent));
  });

  test('the Math tab draws its menu after the code and the banks land', async () => {
    const h = mountApp();
    loginTestUser(h, { coins: 100 });
    h.sandbox.switchScreen('mathHubScreen');
    assert.truthy(/Đang tải/.test(h.el('mathHubScreen').textContent), 'the loading line while the code downloads');
    for (let i = 0; i < 8; i++) await new Promise((r) => setImmediate(r));
    assert.truthy(h.sandbox.LazyData.ready('mathHubScreen'));
    assert.equal(typeof h.sandbox.renderMathHome, 'function');
    assert.falsy(/Đang tải/.test(h.el('mathHubScreen').textContent));
    assert.truthy(h.el('mathHubScreen').innerHTML.includes('openMathSection'), 'the maths menu rendered');
  });
});

if (require.main === module) {
  require('./harness').runAll().then((code) => process.exit(code));
}
