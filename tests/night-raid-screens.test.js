// Night Raid, screen by screen: mount the REAL js/night-raid.js against a DOM
// and behave like a child — open straight into XÂY NHÀ, tap ĐI CƯỚP, tap
// TIẾN QUÂN, open NHẬT KÝ, harvest.
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
    petBattleCastleSkin: 'stone-keep',
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

// The bot road is gone. Reach the scout stage the way a child does: open the
// list of real houses (served by a stubbed API) and tap the first card.
function liveWorld(overrides) {
  overrides = overrides || {};
  const target = Object.assign(Rules.trainingTarget(3),
    { targetId: 42, name: 'Nhà Bin', homeLevel: 3, difficulty: 'vừa sức' });
  const api = (p) => {
    if (p === 'night-raid/friends') return Promise.resolve({ ok: true, data: { me: null, friends: [target], ticketsLeft: 3 } });
    if (p === 'night-raid/targets') return Promise.resolve({ ok: true, data: { targets: [target], ticketsLeft: 3 } });
    return Promise.resolve({ ok: false, data: null });
  };
  const ctx = Object.assign({ EngAuth: { tokenFor: () => 'tok', api } }, overrides.ctx || {});
  const w = mount(Object.assign({}, overrides, { ctx }));
  return Object.assign(w, { target });
}
async function enterScout(w) {
  w.ctx.NightRaid.open();
  await w.ctx.NightRaid.showLiveTargets();
  w.ctx.NightRaid.scoutLive(0);
}

suite('night raid screens: every sub-menu opens and its primary action is armed', () => {
  test('Night Raid opens on the builder with four peer navigation menus', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    const screen = doc.getElementById('nightRaidScreen');
    const html = screen.innerHTML;
    const buttons = screen.querySelectorAll('.nr-builder-nav-btn');
    assert.equal(buttons.length, 4, 'builder navigation also has the earned seed inventory');
    assert.truthy(html.includes('class="nr-builder') && html.includes('menu-closed'), 'the rail starts collapsed');
    assert.truthy(html.includes('nrToggleBuilderMenu()') && html.includes('•••'), 'ellipsis opens the rail');
    for (const label of ['ĐI CƯỚP', 'NHẬT KÝ', 'VŨ KHÍ', 'HẠT GIỐNG']) {
      assert.truthy(html.includes(label), 'builder is missing the ' + label + ' menu');
    }
    assert.truthy(html.includes('nr-build-grid-cell'), 'the editable build grid is the landing screen');
    assert.falsy(html.includes('>XÂY NHÀ<'), 'there is no redundant link to the screen already open');
    assert.falsy(html.includes('NHÀ THẬT'), 'NHÀ THẬT must be gone');
    assert.falsy(html.includes('nrScoutBot()'), 'and the home stage no longer shortcuts to a bot');
    assert.equal(buttons.find(f => f.classList.contains('raid')).getAttribute('onclick'),
      'nrShowLiveTargets()', 'ĐI CƯỚP must open the list of houses');
    for (const fn of ['nrShowLiveTargets()', 'nrShowReports()', 'nrOpenArmory()', 'nrOpenSeeds()']) {
      assert.truthy(html.includes(fn), 'fab not wired to ' + fn);
    }
    assert.falsy(html.includes('nr-fab-badge'), 'no gift waiting → no badge');
    assert.equal(typeof ctx.nrOpenArmory, 'function');
    ctx.nrOpenArmory();   // js/armory.js is not loaded here: must not throw, just say so
  });

  test('the HUD DAM counts the swords the server will count, and the VŨ KHÍ fab wears the gift badge', () => {
    const { ctx, doc, state } = mount({ appState: { dailyTask: { swords: { count: 3 }, pending: ['2026-09-01', '2026-09-02'] } } });
    ctx.NightRaid.open();
    const html = doc.getElementById('nightRaidScreen').innerHTML;
    const layout = state.nightRaidLayout;
    const withSwords = Rules.combatPower(layout, state.dogLevel, layout.soldiers, 3).damage;
    const without = Rules.combatPower(layout, state.dogLevel, layout.soldiers, 0).damage;
    assert.equal(withSwords - without, 30);
    assert.truthy(html.includes(`<small>DAM</small><strong>${withSwords}</strong>`), 'HUD DAM must include the sword bonus');
    assert.truthy(html.includes('nr-fab-badge'));
    assert.truthy(/nr-fab-badge"[^>]*>2</.test(html), 'two gifts waiting');
    // The armory module, when present, is what the fab opens.
    let opened = 0;
    ctx.Armory = { open() { opened++; } };
    ctx.nrOpenArmory();
    assert.equal(opened, 1);
  });

  test('a live TẤN CÔNG goes directly to a moving battle', async () => {
    const w = onlineWorld(true);
    await enterScout(w); await settle(); await settle();
    assert.falsy(w.doc.getElementById('nrStartRaid'), 'the intermediate TIẾN QUÂN button is gone');
    assert.truthy(w.battles.length, 'the battle renderer is created directly');
    assert.truthy(w.battles[w.battles.length - 1].charged, 'the formation begins moving automatically');
  });

  test('tapping TIẾN QUÂN actually starts the battle', async () => {
    // A real house, so /start answers with a raid row: that is the only road
    // into a battle now.
    const w = onlineWorld(true);
    w.ctx.NightRaid.open();
    await w.ctx.NightRaid.showLiveTargets();
    w.ctx.NightRaid.scoutLive(0);
    const before = w.battles.length;
    tap(w.doc.getElementById('nrStartRaid'));
    await settle();
    assert.truthy(w.battles.length > before, 'the raid battle must be created on tap');
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

  test('NHẬT KÝ opens compactly without a duplicate back/title block', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    return Promise.resolve(ctx.NightRaid.showReports()).then(() => {
      const html = doc.getElementById('nightRaidScreen').innerHTML;
      assert.falsy(html.includes('nrHome()'), 'the journal must not repeat a back button below the shared X');
      assert.falsy(html.includes('Nhật ký Cướp Đêm'), 'the shared Night Raid topbar already identifies the mode');
      assert.falsy(html.includes('Kết quả những trận'), 'the long explanatory copy must stay off the first viewport');
      assert.truthy(html.includes('closeNightRaid()'), 'the shared X remains the one app-level exit');
    });
  });

  test('CƯỚP ĐÊM offers NO bot when the server is unreachable', () => {
    const { ctx, doc } = mount();
    ctx.NightRaid.open();
    return Promise.resolve(ctx.NightRaid.showLiveTargets()).then(() => {
      const html = doc.getElementById('nightRaidScreen').innerHTML;
      assert.falsy(html.includes('nrScoutBot()'), 'an offline child must not be handed a bot raid');
      assert.truthy(html.includes('Chưa tải được nhà người chơi'), 'and is told to try again later');
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

  test('a screen whose camera cannot build a plane still starts its battle', async () => {
    // The shim cannot resolve `:scope >`, so ensureWorldPlane returns null here
    // exactly as it did in the browser. The screen must survive it.
    const w = onlineWorld(true);
    await enterScout(w); await settle(); await settle();
    assert.truthy(w.battles.length, 'camera failure must never block direct attack');
  });
});

// ---------------------------------------------------------------------------
// leaving a raid
// ---------------------------------------------------------------------------
//
// Night Raid hides the bottom bar from its garden through the final result, so
// the app-level way out is the topbar ✕. The HUD map button only navigates
// between sub-screens inside the mode.
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
  layout: { cells: [], soldiers: 3, dogLane: 2 }, dogLevel: 5,
};

// A server that hands out one real house and lets the raid start for real.
function onlineWorld(confirmAnswer) {
  const asked = [];
  // EngAuth.api is called with the full 'night-raid/<path>' route.
  const api = (route) => {
    if (/\/friends$/.test(route)) return Promise.resolve({ ok: true, data: { me: null, friends: [LIVE_TARGET], ticketsLeft: 3 } });
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
  test('the bottom bar stays hidden throughout Night Raid and returns only after X', async () => {
    const w = liveWorld();
    const nav = w.doc.getElementById('bottomNav');
    w.ctx.NightRaid.open();
    assert.equal(nav.style.display, 'none', 'the Night Raid garden is already full-screen');
    await enterScout(w);
    assert.equal(nav.style.display, 'none', 'the raid stage must not have the bar over it');
    w.ctx.NightRaid.renderHome();
    assert.equal(nav.style.display, 'none', 'returning to the garden must not reveal the app nav');
    w.ctx.NightRaid.close();
    assert.truthy(nav.style.display !== 'none', 'X restores the app nav after leaving Night Raid');
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

  test('saying yes leaves the battle but keeps the bottom bar hidden inside Night Raid', async () => {
    const w = onlineWorld(true);
    w.ctx.NightRaid.open();
    w.ctx.NightRaid.showLiveTargets(); await settle();
    w.ctx.NightRaid.scoutLive(0); await settle();
    tap(w.doc.getElementById('nrStartRaid')); await settle();
    w.ctx.NightRaid.quit(); await settle();
    assert.falsy(w.ctx.NightRaid.isRaiding(), 'saying yes ends it');
    assert.equal(w.doc.getElementById('bottomNav').style.display, 'none',
      'the player is back on the Night Raid target list, where the X is the exit');
  });

  test('the target list has no duplicated back block or giant selection title', async () => {
    const w = onlineWorld(true);
    w.ctx.NightRaid.open();
    w.ctx.NightRaid.showLiveTargets(); await settle();
    const html = w.doc.getElementById('nightRaidScreen').innerHTML;
    assert.falsy(html.includes('Chọn nhà để cướp'));
    assert.falsy(html.includes('>Quay lại<'));
    assert.truthy(html.includes('nr-raid-overview'));
    assert.truthy(html.includes('lượt còn lại'));
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

  test('tapping a target commits the raid immediately', async () => {
    const w = onlineWorld(false);
    w.ctx.NightRaid.open();
    w.ctx.NightRaid.showLiveTargets(); await settle();
    w.ctx.NightRaid.scoutLive(0); await settle();
    w.asked.length = 0;
    assert.truthy(w.ctx.NightRaid.isRaiding(), 'there is no free scout step before the raid');
    w.ctx.NightRaid.quit();
    assert.equal(w.asked.length, 1, 'leaving a committed raid asks for confirmation');
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
    assert.truthy(w.doc.getElementById('nightRaidScreen').innerHTML.includes('nr-friend-list')
      || w.doc.getElementById('nightRaidScreen').innerHTML.includes('Con chưa có bạn để đi cướp'),
      'it must return to the list of real houses');
  });

  test('the raid stage wires its map button to the asking exit', async () => {
    const w = liveWorld();
    await enterScout(w);
    const home = w.doc.querySelector('.nr-builder-home');
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

// ---------------------------------------------------------------------------
// a /finish that never came back
// ---------------------------------------------------------------------------
//
// /start writes the raid row — tonight's visit to that house is spent — and
// if /finish then fails (tunnel, app killed) the child saw "Kết quả đang chờ
// đồng bộ" with 0 xu, and nothing ever asked the server again. The raidId is
// now remembered and asked about on the next open; finish.js replays a stored
// result for a 'done' raid and scores an 'active' one still inside its window.
suite('night raid: a lost /finish is retried on the next open', () => {
  const RAID = 'b'.repeat(32);
  function world(finish) {
    const calls = [];
    const api = (route, opts) => {
      calls.push(route);
      if (/\/finish$/.test(route)) return Promise.resolve(finish(opts));
      return Promise.resolve({ ok: false, data: null });
    };
    return Object.assign(mount({
      appState: { coins: 100, nightRaidPending: { raidId: RAID, at: Date.now() - 60000 } },
      ctx: { EngAuth: { tokenFor: () => 'tok', api } },
    }), { calls });
  }

  test('a stored win is claimed once, the wallet grows, the pending raid is cleared', async () => {
    const w = world(() => ({ ok: true, data: { result: { won: true, reward: 60, loss: 0, stars: 2, soldiers: 4 } } }));
    w.ctx.NightRaid.open(); await settle(); await settle();
    assert.truthy(w.calls.some(r => /night-raid\/finish$/.test(r)), 'open() asked the server about the pending raid');
    assert.equal(w.state.coins, 160);
    assert.equal(w.state.nightRaidPending, null);
    assert.truthy(w.state.nightRaidClaimed[RAID]);
    assert.equal(w.state.nightRaidLayout.soldiers, 4, 'the server\'s soldier count wins');
    assert.truthy(w.toasts.some(t => /\+60 xu/.test(t)), 'the child is told what came in');
    // Opening again must not pay twice.
    w.ctx.NightRaid.open(); await settle(); await settle();
    assert.equal(w.state.coins, 160);
  });

  test('a stored loss is charged once and cleared', async () => {
    const w = world(() => ({ ok: true, data: { result: { won: false, reward: 0, loss: 20, stars: 0 } } }));
    w.ctx.NightRaid.open(); await settle(); await settle();
    assert.equal(w.state.coins, 80);
    assert.equal(w.state.nightRaidPending, null);
  });

  test('an expired or unknown raid is dropped; a mere network failure is kept for next time', async () => {
    const gone = world(() => ({ ok: false, data: { error: 'Raid expired' } }));
    gone.ctx.NightRaid.open(); await settle(); await settle();
    assert.equal(gone.state.nightRaidPending, null, 'nothing left to recover');
    assert.equal(gone.state.coins, 100);
    const offline = world(() => ({ ok: false, data: null }));
    offline.ctx.NightRaid.open(); await settle(); await settle();
    assert.truthy(offline.state.nightRaidPending && offline.state.nightRaidPending.raidId === RAID, 'still pending — ask again later');
    assert.equal(offline.state.coins, 100);
  });

  test('TẤN CÔNG remembers the raid the moment /start succeeds', async () => {
    // A fresh copy of the house: onlineWorld() hands out the shared
    // LIVE_TARGET object, and startRaid stamps the raidId onto the target it
    // is given — so after an earlier test the shared one already "has" a raid
    // and /start is (correctly) skipped.
    const house = Object.assign({}, LIVE_TARGET, { raidId: undefined });
    const api = (route) => {
      if (/\/friends$/.test(route)) return Promise.resolve({ ok: true, data: { me: null, friends: [house], ticketsLeft: 3 } });
      if (/\/start$/.test(route)) return Promise.resolve({ ok: true, data: { raid: Object.assign({}, LIVE_TARGET, { raidId: 'c'.repeat(32) }) } });
      return Promise.resolve({ ok: false, data: null });
    };
    const w = mount({ ctx: { EngAuth: { tokenFor: () => 'tok', api }, confirm: () => true } });
    w.ctx.NightRaid.open(); await settle();
    w.ctx.NightRaid.showLiveTargets(); await settle();
    w.ctx.NightRaid.attackLive(0); await settle(); await settle();
    assert.truthy(w.state.nightRaidPending && w.state.nightRaidPending.raidId === 'c'.repeat(32),
      'the raidId is on disk before the first sword swings');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
