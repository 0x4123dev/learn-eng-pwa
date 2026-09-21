// Nông trại, screen by screen: mount the REAL js/night-raid.js against a DOM
// and behave like a child — open the tab, look at the yard, open the shop,
// buy a fence, harvest, leave.
//
// The rule these tests enforce: decorative/camera setup may fail, but the
// PRIMARY ACTION of the screen must always be armed — and, since the farm is
// a bottom-nav TAB now (September 2026, the Arena and the raid are gone),
// the screen must never hide the bottom bar, never draw a raid button, and
// the ✕ must land on Home.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { createDocument } = require('./domshim');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const Rules = require(path.join(root, 'js', 'night-raid-rules.js'));

// The shim has no canvas: give every element a 2D context that swallows
// drawing calls, so decorative painting cannot mask a real render failure.
function ctx2d() {
  return new Proxy({}, { get: (t, k) =>
    k === 'canvas' ? { width: 0, height: 0 }
      : k === 'createLinearGradient' || k === 'createRadialGradient'
        ? () => ({ addColorStop() {} })
      : k === 'measureText' ? () => ({ width: 10 })
      : k === 'getImageData' ? () => ({ data: [] })
      : (typeof k === 'string' ? () => {} : undefined) });
}
function withCanvas(doc) {
  const proto = Object.getPrototypeOf(doc.createElement('canvas'));
  if (!proto.getContext) proto.getContext = function () { return ctx2d(); };
  return doc;
}

function mount(overrides) {
  const doc = withCanvas(createDocument('<div id="nightRaidScreen"></div><div id="bottomNav"></div><div id="homeScreen"></div>'));
  const toasts = [], screens = [];
  const state = Object.assign({
    coins: 9000, dogLevel: 12, dogGrowthXP: 30000,
    petBattleCastleSkin: 'stone-keep',
    nightRaidLayout: { cells: [
      { type: 'wood-fence', gx: 3, gy: 7, tier: 1 },
      { type: 'stone-wall', gx: 8, gy: 7, tier: 1 },
      { type: 'rice-field', gx: 2, gy: 2, tier: 1, uid: 'p-farm0001', readyAt: 0 },
    ], soldiers: 6, dogLane: 2 },
    vaultCoins: 0,
  }, (overrides || {}).appState || {});

  const ctx = {
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise,
    RegExp, Set, Map, isNaN, parseInt, parseFloat, Error,
    document: doc,
    window: { addEventListener() {}, innerWidth: 900 },
    innerWidth: 900,
    navigator: { vibrate() {} },
    NightRaidRules: Rules,
    currentUser: 'FarmKid',
    appState: state,
    saveUserData() {},
    showToast(m) { toasts.push(String(m)); },
    switchScreen(id) { screens.push(String(id)); },
    setTimeout: () => 0, clearTimeout() {},
    setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    performance: { now: () => 0 },
    confirm: () => true,
    // Every server call fails the way an offline device does, so these tests
    // exercise the local paths a child hits first.
    EngAuth: { tokenFor: () => 'tok', api: () => Promise.resolve({ ok: false, data: null }) },
  };
  Object.assign(ctx, (overrides || {}).ctx || {});
  ctx.global = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/night-raid.js'), ctx, { filename: 'js/night-raid.js' });
  // Inline onclick="nrFoo()" attributes run inside the same sandbox, so a tap
  // in these tests reaches the real handler the markup names.
  doc.__runInline = (code, el, ev) => vm.runInContext(code, ctx, { filename: 'inline-handler' });
  return { ctx, doc, toasts, screens, state };
}

// Tap an element the way the app's own markup expects (inline onclick or a
// property handler). Returns false when nothing was wired.
function tap(el) {
  if (!el) return false;
  const hasInline = typeof el.onclick === 'function' || el.getAttribute('onclick');
  el.dispatch('click', {});
  return !!hasInline;
}

const RAID_HANDLERS = ['nrShowLiveTargets', 'nrShowReports', 'nrOpenArmory', 'nrAttackLive', 'nrScoutLive',
  'nrQuitRaid', 'nrChargeArmy', 'nrRetryRaidResult', 'nrReplayReport', 'nrHome'];

suite('farm screen: the builder is the whole screen, and it is a tab', () => {
  test('the farm opens on the builder with the seed store as its only rail button', () => {
    const { ctx, doc, screens } = mount();
    ctx.NightRaid.open();
    assert.equal(screens[screens.length - 1], 'nightRaidScreen', 'open() switches to its own screen');
    const screen = doc.getElementById('nightRaidScreen');
    const html = screen.innerHTML;
    const buttons = screen.querySelectorAll('.nr-builder-nav-btn');
    assert.equal(buttons.length, 1, 'the rail has the seed store and nothing else');
    assert.equal(buttons[0].getAttribute('onclick'), 'nrOpenSeeds()');
    assert.truthy(html.includes('HẠT GIỐNG'), 'the seed store is labelled');
    assert.truthy(html.includes('class="nr-builder') && html.includes('menu-closed'), 'the rail starts collapsed');
    assert.truthy(html.includes('nrToggleBuilderMenu()') && html.includes('•••'), 'ellipsis opens the rail');
    assert.truthy(html.includes('nr-build-grid-cell'), 'the editable build grid is the landing screen');
    assert.falsy(html.includes('nr-fab-badge'), 'no seeds waiting → no badge');
    assert.truthy(html.includes('Nhà của bạn'), 'the screen is the learner\'s own home');
    assert.falsy(/Cướp Đêm|CƯỚP ĐÊM|NIGHT RAID/i.test(html), 'the old name is gone from the copy');
  });

  test('renderBuilder draws no raid button, no raid HUD and no lock chip', () => {
    const { ctx, doc } = mount({ appState: { dailyTask: { swords: { count: 3 }, pending: ['2026-09-01'], shields: { count: 2 } } } });
    ctx.NightRaid.open();
    ctx.NightRaid.renderBuilder();
    const html = doc.getElementById('nightRaidScreen').innerHTML;
    for (const fn of RAID_HANDLERS) {
      assert.falsy(html.includes(fn + '('), 'the builder must not wire ' + fn);
      assert.equal(typeof ctx[fn], 'undefined', fn + ' must not be a global any more');
    }
    for (const label of ['ĐI CƯỚP', 'NHẬT KÝ', 'VŨ KHÍ', 'TẤN CÔNG', 'TIẾN QUÂN', 'KHIÊN ĐÊM', 'BẢO VỆ']) {
      assert.falsy(html.includes(label), 'raid copy survived: ' + label);
    }
    assert.falsy(html.includes('<small>DAM</small>') || html.includes('<small>DEF</small>'), 'no combat score on the HUD');
    assert.falsy(html.includes('nr-lock-chip') || html.includes('data-nr-lock-until'), 'no shield/seal countdown');
    assert.truthy(html.includes('<small>LÍNH</small><strong>6</strong>'), 'the soldier count stays: the parade is countable');
    assert.truthy(html.includes('data-nr-yard-army'), 'the parade is still on the lawn');
    // The pending daily-task gift used to put a badge on the VŨ KHÍ fab; the
    // only badge left is the seed count, and there are no seeds here.
    assert.falsy(html.includes('nr-fab-badge'));
  });

  test('NightRaid.close() lands on homeScreen and never touches the bottom bar', () => {
    const { ctx, doc, screens } = mount();
    ctx.NightRaid.open();
    const nav = doc.getElementById('bottomNav');
    assert.equal(nav.style.display, '', 'opening the farm must not hide the bottom bar — it is a tab');
    ctx.NightRaid.close();
    assert.equal(screens[screens.length - 1], 'homeScreen', 'the ✕ goes Home');
    assert.equal(nav.style.display, '', 'closing does not fiddle with the bar either');
    assert.equal(typeof ctx.closeNightRaid, 'function');
    ctx.NightRaid.open();
    ctx.closeNightRaid();
    assert.equal(screens[screens.length - 1], 'homeScreen', 'the inline handler goes the same way');
    assert.falsy(screens.includes('petBattleScreen'), 'the Arena is gone');
  });

  test('the HUD ✕ and the topbar ✕ are both wired to the exit', () => {
    const { ctx, doc, screens } = mount();
    ctx.NightRaid.open();
    const screen = doc.getElementById('nightRaidScreen');
    const exits = screen.querySelectorAll('[onclick="closeNightRaid()"]');
    assert.truthy(exits.length >= 2, 'topbar ✕ and HUD ✕');
    assert.truthy(tap(exits[exits.length - 1]), 'the HUD ✕ is armed');
    assert.equal(screens[screens.length - 1], 'homeScreen');
  });

  test('VÀO HỌC opens the Daily Task screen and leaves the bottom bar alone', () => {
    let opened = 0;
    const { ctx, doc } = mount({
      appState: { dailyTask: { date: '2026-09-21', tasks: [{ done: false }], allDone: false } },
      ctx: { DailyTask: { open() { opened++; }, state() { return { tasks: [{ done: false }], allDone: false }; } } },
    });
    ctx.NightRaid.open();
    assert.truthy(doc.getElementById('nightRaidScreen').innerHTML.includes('nrGoLearn()'), 'the task bar offers Vào học');
    ctx.nrGoLearn();
    assert.equal(opened, 1, 'goLearn hands over to DailyTask.open()');
    assert.equal(doc.getElementById('bottomNav').style.display, '');
  });

  test('the seed store shows how many seeds are waiting', () => {
    const { ctx, doc } = mount({ appState: { dailyTask: { seeds: { progress: 1, goal: 2, inventory: [{ id: 'lettuce', quantity: 2 }, { id: 'pumpkin', quantity: 1 }], recent: [] } } } });
    ctx.NightRaid.open();
    const html = doc.getElementById('nightRaidScreen').innerHTML;
    assert.truthy(/nr-fab-badge"[^>]*>3</.test(html), 'three seeds badge the rail button');
    ctx.nrOpenSeeds();
    assert.truthy(doc.getElementById('nightRaidScreen').innerHTML.includes('nr-seed-item'), 'the seed cards render');
  });

  test('XÂY NHÀ opens the builder with its shop and grid', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.renderBuilder();                  // must not throw
    const html = doc.getElementById('nightRaidScreen').innerHTML;
    assert.truthy(html.includes('nrToggleBuildShop()'), 'the shop fab must be wired');
    assert.truthy(html.includes('nr-build-grid-cell'), 'the build grid must render');
    assert.truthy(html.includes('nrGridCell('), 'grid cells must be tappable');
    assert.truthy(html.includes('chụm hai ngón'), 'pinch zoom remains available without a permanent +/- rail');
  });

  test('opening from another screen clears edit mode and hides the placement grid', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.toggleBuilderGrid();
    assert.truthy(doc.getElementById('nightRaidScreen').innerHTML.includes('nr-builder editing'));
    ctx.NightRaid.open();
    const html = doc.getElementById('nightRaidScreen').innerHTML;
    assert.falsy(html.includes('nr-builder editing'), 'normal entry must not carry the edit grid');
    assert.falsy(html.includes('nr-builder shop-open'), 'normal entry must not carry the shop');
  });

  test('a building can be bought in the builder and the coins are spent once', () => {
    const { ctx, state } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.renderBuilder();
    const def = Rules.DEFENSES.find(d => d.id === 'wood-fence');
    const before = state.coins;
    ctx.NightRaid.selectBuild('wood-fence');
    ctx.NightRaid.buildCell(0, 0, true);            // confirmed purchase
    assert.equal(state.coins, before - def.price, 'exactly one price is charged');
    assert.truthy(state.nightRaidLayout.cells.some(c => c.gx === 0 && c.gy === 0),
      'the building must land on the yard');
  });

  test('harvesting offline still collects from the ready farm', () => {
    const { ctx, state } = mount();
    ctx.NightRaid.open();
    const before = state.coins;
    return Promise.resolve(ctx.NightRaid.collectResources()).then(() => {
      assert.truthy(state.coins > before, 'the ready rice field must pay out locally');
    });
  });

  test('the old seeded bot base is still recognised and emptied without the training targets', () => {
    // dropSeededBase used to derive its signature from trainingTarget(4);
    // that function is gone, so the signature is pinned. A child whose saved
    // layout is exactly that bot base opens on an empty lawn; anyone else's
    // buildings are left alone.
    const bot = { cells: [] };
    const add = (type, n) => { for (let i = 0; i < n; i++) bot.cells.push({ type, gx: (bot.cells.length * 2) % 12, gy: Math.floor(bot.cells.length / 6) * 2 + 6, tier: 1 }); };
    add('pebble-pup', 3); add('spike-trap', 4); add('stone-wall', 2); add('wood-fence', 2);
    const seeded = mount({ appState: { nightRaidLayout: bot } });
    seeded.ctx.NightRaid.open();
    assert.equal(seeded.state.nightRaidLayout.cells.length, 0, 'the bot base is dropped');
    const real = mount({ appState: { nightRaidLayout: { cells: bot.cells.slice(0, 5) } } });
    real.ctx.NightRaid.open();
    assert.equal(real.state.nightRaidLayout.cells.length, 5, 'a real base is kept');
  });

  test('forgetProfile empties the screen and forgets the shop tab, the harvest and the purchase', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.openSeeds();
    ctx.NightRaid.forgetProfile();
    assert.equal(doc.getElementById('nightRaidScreen').innerHTML, '');
    ctx.NightRaid.open();
    assert.falsy(doc.getElementById('nightRaidScreen').innerHTML.includes('nr-builder shop-open'), 'the next child does not inherit the seed store being open');
  });
});

suite('farm screen: the camera can never disarm the screen', () => {
  test('every pannable map carries a class the world-plane builder accepts', () => {
    // ensureWorldPlane moves the map into a scrolling plane. It selects the map
    // by class; a screen whose map is not selected gets a null plane, and the
    // camera then throws mid-render. Derive the accepted class FROM the source
    // so a renamed selector cannot silently strand a screen again.
    const src = read('js/night-raid.js');
    const fn = src.slice(src.indexOf('function ensureWorldPlane'));
    const accepted = fn.slice(0, fn.indexOf('\n  }'))
      .match(/:scope > \.([a-z0-9-]+)/g).map(s => s.replace(':scope > .', ''));
    assert.truthy(accepted.length >= 2, 'ensureWorldPlane must select a plane and a map');
    const mapClass = accepted.find(c => c !== 'nr-world-plane');
    const maps = src.match(/class="nr-builder-map [^"]*"/g) || [];
    assert.truthy(maps.length >= 2, 'the estate and the mini yard are both pannable/mountable stages');
    for (const m of maps) {
      assert.truthy(m.includes(mapClass),
        m + ' is not selected by ensureWorldPlane (.' + mapClass + ') — its camera will throw');
    }
    assert.falsy(maps.some(m => m.includes('nr-scout-map')), 'the scout board is gone');
  });

  test('the shop still opens when the camera cannot build a plane', () => {
    // The shim cannot resolve `:scope >`, so ensureWorldPlane returns null here
    // exactly as it did in the browser. The screen must survive it.
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.toggleBuildShop();
    assert.truthy(doc.getElementById('nightRaidScreen').innerHTML.includes('nr-builder-nav'), 'the rail is drawn');
    assert.truthy(doc.getElementById('nightRaidScreen').innerHTML.includes('nr-build-shop open'), 'camera failure must never block the shop');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
