// Night Raid, screen by screen: mount the REAL js/night-raid.js against a DOM
// and behave like a child — open the raid, tap CƯỚP ĐÊM, tap TIẾN QUÂN, open
// XÂY NHÀ / NHẬT KÝ, harvest.
//
// The bug this suite exists for: the scout screen's map carries
// `nr-scout-map`, but the camera's ensureWorldPlane only looked for
// `nr-estate-map`, so it returned null, setBuilderZoom threw on
// `plane.offsetWidth`, and scout() died on the line BEFORE it wired
// `#nrStartRaid.onclick`. The button rendered, looked enabled, and did
// nothing: a bot-on child could not attack at all.
//
// Hence the rule these tests enforce: decorative/camera setup may fail, but
// the PRIMARY ACTION of a screen must always be armed.
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
  const doc = withCanvas(createDocument('<div id="nightRaidScreen"></div><div id="bottomNav"></div>'));
  const toasts = [];
  // A stand-in for the canvas/Phaser battle: it records that it was built and
  // whether charge() was reached, without needing a real 2D context.
  const battles = [];
  class FakeAutoBattle {
    constructor(host, target, options) {
      this.target = target; this.options = options || {}; this.charged = false;
      battles.push(this);
    }
    start() { this.started = true; }
    charge() { this.charged = true; return true; }
    destroy() { this.destroyed = true; }
  }
  const state = Object.assign({
    coins: 9000, dogLevel: 12, dogGrowthXP: 30000, allowBot: true,
    petBattleCastleSkin: 'stone-keep', battleTeammates: [],
    nightRaidLayout: { cells: [
      { type: 'wood-fence', gx: 3, gy: 7, tier: 1 },
      { type: 'stone-wall', gx: 8, gy: 7, tier: 1 },
      { type: 'rice-field', gx: 2, gy: 2, tier: 1, uid: 'p-farm0001', readyAt: 0 },
    ], soldiers: 6, dogLane: 2 },
    nightRaidHistory: [], nightRaidClaimed: {}, nightRaidRewardToday: 0,
    nightRaidRewardDate: null, nightRaidTicketCount: 0, vaultCoins: 0,
    nightRaidStars: {}, nightRaidRouteLevel: 1,
  }, (overrides || {}).appState || {});

  const ctx = {
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise,
    RegExp, Set, Map, isNaN, parseInt, parseFloat, Error,
    document: doc,
    window: { addEventListener() {}, innerWidth: 900 },
    innerWidth: 900,
    navigator: { vibrate() {} },
    NightRaidRules: Rules,
    NightRaidGame: { AutoBattle: FakeAutoBattle },
    // Art is decoration: stub every painter so a missing brush can never be
    // mistaken for a broken screen.
    NightRaidArt: new Proxy({}, { get: () => () => {}, has: () => true }),
    CastleSkins: { get: () => ({ name: { vi: 'Thành Đá' } }), preload() {} },
    currentUser: 'BotKid',
    appState: state,
    saveUserData() {},
    showToast(m) { toasts.push(String(m)); },
    setTimeout: () => 0, clearTimeout() {},
    setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    performance: { now: () => 0 },
    confirm: () => true,
    // Every server call fails the way an offline device does, so these tests
    // exercise the local paths a bot-on child hits first.
    EngAuth: { tokenFor: () => 'tok', api: () => Promise.resolve({ ok: false, data: null }) },
  };
  Object.assign(ctx, (overrides || {}).ctx || {});
  ctx.global = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/night-raid.js'), ctx, { filename: 'js/night-raid.js' });
  return { ctx, doc, toasts, battles, state };
}

// Tap an element the way the app's own markup expects (inline onclick or a
// property handler). Returns false when nothing was wired — the failure mode
// this suite is about.
function tap(el) {
  if (!el) return false;
  const hasInline = typeof el.onclick === 'function' || el.getAttribute('onclick');
  el.dispatch('click', {});
  return !!hasInline;
}

suite('night raid screens: every sub-menu opens and its primary action is armed', () => {
  test('the home stage renders with all four sub-menu fabs', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    const html = doc.getElementById('nightRaidScreen').innerHTML;
    for (const label of ['CƯỚP ĐÊM', 'NHÀ THẬT', 'XÂY NHÀ', 'NHẬT KÝ']) {
      assert.truthy(html.includes(label), 'home is missing the ' + label + ' fab');
    }
    for (const fn of ['nrScoutBot()', 'nrShowLiveTargets()', 'nrShowBuilder()', 'nrShowReports()']) {
      assert.truthy(html.includes(fn), 'fab not wired to ' + fn);
    }
  });

  test('CƯỚP ĐÊM opens scout AND arms the TIẾN QUÂN button', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.scoutBot();                       // must not throw
    const btn = doc.getElementById('nrStartRaid');
    assert.truthy(btn, 'the TIẾN QUÂN button must exist');
    assert.falsy(btn.disabled, 'and be enabled');
    assert.truthy(typeof btn.onclick === 'function',
      'TIẾN QUÂN must be WIRED — a rendered but dead button is the bug');
  });

  test('tapping TIẾN QUÂN actually starts the battle', () => {
    const { ctx, doc, battles } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.scoutBot();
    const before = battles.length;
    tap(doc.getElementById('nrStartRaid'));
    assert.truthy(battles.length > before, 'the raid battle must be created on tap');
  });

  test('XÂY NHÀ opens the builder with its shop and grid', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.renderBuilder();                  // must not throw
    const html = doc.getElementById('nightRaidScreen').innerHTML;
    assert.truthy(html.includes('nrToggleBuildShop()'), 'the shop fab must be wired');
    assert.truthy(html.includes('nr-build-grid-cell'), 'the build grid must render');
    assert.truthy(html.includes('nrGridCell('), 'grid cells must be tappable');
    assert.truthy(html.includes('nrZoomBuilder('), 'zoom controls must be wired');
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

  test('NHẬT KÝ opens without a server and offers a way back', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    return Promise.resolve(ctx.NightRaid.showReports()).then(() => {
      const html = doc.getElementById('nightRaidScreen').innerHTML;
      assert.truthy(html.includes('nrHome()'), 'the log screen must offer a way home');
    });
  });

  test('NHÀ THẬT degrades to a bot offer when the server is unreachable', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    return Promise.resolve(ctx.NightRaid.showLiveTargets()).then(() => {
      const html = doc.getElementById('nightRaidScreen').innerHTML;
      assert.truthy(html.includes('nrScoutBot()'),
        'an offline child must still be offered the bot raid');
    });
  });

  test('harvesting offline still collects from the ready farm', () => {
    const { ctx, state } = mount();
    ctx.NightRaid.open();
    const before = state.coins;
    return Promise.resolve(ctx.NightRaid.collectResources()).then(() => {
      assert.truthy(state.coins > before, 'the ready rice field must pay out locally');
    });
  });
});

suite('night raid screens: the camera can never disarm a screen', () => {
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
    assert.truthy(maps.length >= 3, 'the app has several pannable stages');
    for (const m of maps) {
      assert.truthy(m.includes(mapClass),
        m + ' is not selected by ensureWorldPlane (.' + mapClass + ') — its camera will throw');
    }
  });

  test('a screen whose camera cannot build a plane still arms its button', () => {
    // The shim cannot resolve `:scope >`, so ensureWorldPlane returns null here
    // exactly as it did in the browser. The screen must survive it.
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.scoutBot();
    assert.truthy(typeof doc.getElementById('nrStartRaid').onclick === 'function',
      'camera failure must never leave TIẾN QUÂN dead');
  });
});

// ---------------------------------------------------------------------------
// leaving a raid
// ---------------------------------------------------------------------------
//
// The raid stage hides the bottom bar (it sits above the board and was burying
// TIẾN QUÂN), so the only ways out are the topbar ✕ and the HUD map button.
// Both went straight out with no question — and for a raid on a REAL house
// that is not free: functions/api/night-raid/start.js writes the raid row
// before the first sword swings, and refuses a second visit to the same home
// on the same date ("Hôm nay con đã thăm nhà này rồi"). Walking out mid-fight
// burned one of the three houses on offer that night for nothing.
//
// js/night-raid.js already had a quit() with the right question in it. Nothing
// called it: nrQuitRaid() was dead code.
const LIVE_TARGET = {
  targetId: 42, name: 'Nhà bạn Bo', homeLevel: 4, difficulty: 'Cân sức',
  defense: 40, damage: 30, castleHp: 200, seed: 7, lockedUntil: 0,
  layout: { cells: [], soldiers: 3, dogLane: 2 }, teammates: [], dogLevel: 5,
};

// A server that hands out one real house and lets the raid start for real.
function onlineWorld(confirmAnswer) {
  const asked = [];
  // EngAuth.api is called with the full 'night-raid/<path>' route.
  const api = (route) => {
    if (/\/targets$/.test(route)) return Promise.resolve({ ok: true, data: { targets: [LIVE_TARGET], ticketsLeft: 3 } });
    if (/\/start$/.test(route)) return Promise.resolve({ ok: true, data: { raid: Object.assign({ raidId: 'a'.repeat(32) }, LIVE_TARGET) } });
    return Promise.resolve({ ok: false, data: null });
  };
  const w = mount({ ctx: {
    EngAuth: { tokenFor: () => 'tok', api },
    confirm: (msg) => { asked.push(String(msg)); return confirmAnswer; },
  } });
  w.asked = asked;
  return w;
}

// showLiveTargets and startRaid are async; the module awaits its own api()
// promises, so let the microtask queue drain between steps.
const settle = () => new Promise(r => setImmediate(r));

suite('night raid: the bottom bar, and what it costs to walk out of a raid', () => {
  test('the raid stage takes the bar away and the home stage gives it back', () => {
    const { ctx, doc } = mount();
    const nav = doc.getElementById('bottomNav');
    ctx.NightRaid.open();
    assert.truthy(nav.style.display !== 'none', 'the raid HOME is a hub — the bar belongs there');
    ctx.NightRaid.scoutBot();
    assert.equal(nav.style.display, 'none', 'the raid stage must not have the bar over it');
    ctx.NightRaid.renderHome();
    assert.truthy(nav.style.display !== 'none', 'and it must come back');
  });

  test('a committed raid on a real house asks before it is thrown away', async () => {
    const w = onlineWorld(false);
    w.ctx.NightRaid.open();
    w.ctx.NightRaid.showLiveTargets(); await settle();
    w.ctx.NightRaid.scoutLive(0); await settle();
    w.asked.length = 0;
    tap(w.doc.getElementById('nrStartRaid')); await settle();
    assert.truthy(w.ctx.NightRaid.isRaiding(), 'the raid should be live after TIẾN QUÂN');

    w.ctx.NightRaid.quit();
    assert.equal(w.asked.length, 1, 'walking out of a live raid must ask');
    assert.truthy(/không vào lại|không nhận/i.test(w.asked[0]),
      `the question must say what it costs — got: ${w.asked[0]}`);
    assert.truthy(w.ctx.NightRaid.isRaiding(), 'saying no must leave the raid running');
  });

  test('saying yes leaves, and hands the bottom bar back', async () => {
    const w = onlineWorld(true);
    w.ctx.NightRaid.open();
    w.ctx.NightRaid.showLiveTargets(); await settle();
    w.ctx.NightRaid.scoutLive(0); await settle();
    tap(w.doc.getElementById('nrStartRaid')); await settle();
    w.ctx.NightRaid.quit(); await settle();
    assert.falsy(w.ctx.NightRaid.isRaiding(), 'saying yes ends it');
    assert.truthy(w.doc.getElementById('bottomNav').style.display !== 'none',
      'a child must never be left on a screen with no bar and no raid');
  });

  test('the topbar ✕ asks too — it is the other way out of the same screen', async () => {
    const w = onlineWorld(false);
    w.ctx.NightRaid.open();
    w.ctx.NightRaid.showLiveTargets(); await settle();
    w.ctx.NightRaid.scoutLive(0); await settle();
    tap(w.doc.getElementById('nrStartRaid')); await settle();
    w.asked.length = 0;
    w.ctx.NightRaid.close();
    assert.equal(w.asked.length, 1, 'the ✕ must ask as well');
    assert.truthy(w.ctx.NightRaid.isRaiding(), 'saying no must keep the raid');
  });

  test('scouting is free — no raid exists on the server yet', async () => {
    const w = onlineWorld(false);
    w.ctx.NightRaid.open();
    w.ctx.NightRaid.showLiveTargets(); await settle();
    w.ctx.NightRaid.scoutLive(0); await settle();
    w.asked.length = 0;
    assert.falsy(w.ctx.NightRaid.isRaiding(), 'looking at a house is not raiding it');
    w.ctx.NightRaid.quit();
    assert.equal(w.asked.length, 0, 'backing out before TIẾN QUÂN costs nothing');
  });

  test('a bot raid is free to leave — nothing was written anywhere', () => {
    const asked = [];
    const w = mount({ ctx: { confirm: (m) => { asked.push(String(m)); return false; } } });
    w.ctx.NightRaid.open();
    w.ctx.NightRaid.scoutBot();
    tap(w.doc.getElementById('nrStartRaid'));
    assert.falsy(w.ctx.NightRaid.isRaiding(), 'a bot fight costs no house and no ticket');
    w.ctx.NightRaid.quit();
    assert.equal(asked.length, 0, 'and so it must not nag');
  });

  test('after an online raid, the map button still goes back to the houses', async () => {
    // The map button is shared by the scout stage, the battle and the result
    // frame. Once the raid is scored there is nothing to ask about — but it
    // must still land where the child was, not at the Cướp Đêm home.
    const w = onlineWorld(true);
    w.ctx.NightRaid.open();
    w.ctx.NightRaid.showLiveTargets(); await settle();
    w.ctx.NightRaid.scoutLive(0); await settle();
    tap(w.doc.getElementById('nrStartRaid')); await settle();
    // End the fight the way the engine does, so the module runs its own
    // finish path rather than a hand-placed result.
    const fight = w.battles[w.battles.length - 1];
    fight.options.onFinish({ status: 'lost', margin: 0, castleHp: 120, damage: 30, defense: 40 }, []);
    await settle(); await settle();
    assert.falsy(w.ctx.NightRaid.isRaiding(), 'a scored raid is not still at stake');
    w.asked.length = 0;
    w.ctx.NightRaid.quit(); await settle();
    assert.equal(w.asked.length, 0, 'a scored raid has nothing left to ask about');
    assert.truthy(w.doc.getElementById('nightRaidScreen').innerHTML.includes('Nhà người chơi')
      || w.doc.getElementById('nightRaidScreen').innerHTML.includes('Chọn một lâu đài'),
      'it must return to the list of real houses');
  });

  test('the raid stage wires its map button to the asking exit', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    ctx.NightRaid.scoutBot();
    const home = doc.querySelector('.nr-builder-home');
    assert.truthy(home, 'the raid stage has no way out at all');
    assert.truthy(String(home.getAttribute('onclick')).includes('nrQuitRaid()'),
      `the map button calls "${home.getAttribute('onclick')}" — it must ask first`);
  });

  test('nrQuitRaid is reachable from the markup, not dead code', () => {
    // It WAS dead: the function existed, carried the right question, and no
    // screen in the app ever called it.
    const src = read('js/night-raid.js');
    const wired = (src.match(/nrQuitRaid\(\)/g) || []).length;
    assert.truthy(wired >= 2,
      'nrQuitRaid must be called from the markup as well as declared');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
