// NHÀ THẬT as a child sees it: mount the REAL js/night-raid.js against a DOM,
// answer night-raid/friends and night-raid/targets from a scripted server, and
// read the screen — a countdown for a sealed friend, CƯỚP NGAY for an open one,
// the shield marker, the child's own status, the empty state, and the ticker
// flipping a row the moment its clock runs out. Same mount recipe as
// tests/night-raid-screens.test.js.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { createDocument } = require('./domshim');

const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const Rules = require(path.join(root, 'js', 'night-raid-rules.js'));

function ctx2d() {
  return new Proxy({}, { get: (t, k) =>
    k === 'canvas' ? { width: 0, height: 0 }
      : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} })
      : k === 'measureText' ? () => ({ width: 10 })
      : k === 'getImageData' ? () => ({ data: [] })
      : (typeof k === 'string' ? () => {} : undefined) });
}
function withCanvas(doc) {
  const proto = Object.getPrototypeOf(doc.createElement('canvas'));
  if (!proto.getContext) proto.getContext = function () { return ctx2d(); };
  return doc;
}

const H = 3600000, M = 60000;
const RANDOM_TARGET = {
  targetId: 900, name: 'Nhà lạ', homeLevel: 2, difficulty: 'Cân bằng', lockedUntil: 0,
  layout: { cells: [], soldiers: 1, dogLane: 2 }, teammates: [], dogLevel: 3, castleHp: 200, seed: 3,
};

// `server` maps a route suffix ('friends' | 'targets' | 'start') to a reply.
function mount(server, extra) {
  const doc = withCanvas(createDocument('<div id="nightRaidScreen"></div><div id="bottomNav"></div>'));
  const toasts = [], timers = [], battles = [];
  class FakeAutoBattle {
    constructor(host, target, options) { this.target = target; this.options = options || {}; battles.push(this); }
    start() {} charge() { return true; } destroy() {}
  }
  const api = (route) => {
    const key = String(route).split('/').pop();
    const reply = server && server[key];
    return Promise.resolve(reply === undefined ? { ok: false, data: null } : (typeof reply === 'function' ? reply() : reply));
  };
  const state = {
    coins: 9000, dogLevel: 12, dogGrowthXP: 30000, allowBot: true,
    petBattleCastleSkin: 'stone-keep', battleTeammates: [],
    nightRaidLayout: { cells: [], soldiers: 6, dogLane: 2 },
    nightRaidHistory: [], nightRaidClaimed: {}, nightRaidRewardToday: 0,
    nightRaidRewardDate: null, nightRaidTicketCount: 0, vaultCoins: 0,
    nightRaidStars: {}, nightRaidRouteLevel: 1,
  };
  const ctx = Object.assign({
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise,
    RegExp, Set, Map, isNaN, parseInt, parseFloat, Error,
    document: doc,
    window: { addEventListener() {}, innerWidth: 375 },
    innerWidth: 375,
    navigator: { vibrate() {} },
    NightRaidRules: Rules,
    NightRaidGame: { AutoBattle: FakeAutoBattle },
    NightRaidArt: new Proxy({}, { get: () => () => {}, has: () => true }),
    CastleSkins: { get: () => ({ name: { vi: 'Thành Đá' } }), preload() {} },
    currentUser: 'Bé Na',
    appState: state,
    saveUserData() {},
    showToast(m) { toasts.push(String(m)); },
    setTimeout: () => 0, clearTimeout() {},
    // The ticker is captured, not run: tests advance it by hand.
    setInterval: (fn) => { timers.push(fn); return timers.length; }, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    performance: { now: () => 0 },
    confirm: () => true,
    EngAuth: { tokenFor: () => 'tok', api },
  }, extra || {});
  ctx.global = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/night-raid.js'), ctx, { filename: 'js/night-raid.js' });
  return { ctx, doc, toasts, timers, battles, screen: () => doc.getElementById('nightRaidScreen') };
}
const settle = () => new Promise(r => setImmediate(r));

async function openLive(server, extra) {
  const w = mount(server, extra);
  w.ctx.NightRaid.open();
  await w.ctx.NightRaid.showLiveTargets(); await settle();
  return w;
}
const rows = w => w.screen().querySelectorAll('.nr-friend-row');

function friendsReply(friends, me) {
  return { ok: true, data: { friends, me: me || { hasHome: true, homeLevel: 3, lockedUntil: 0, shieldUntil: 0 }, ticketsLeft: 2 } };
}
const targetsReply = { ok: true, data: { targets: [RANDOM_TARGET], ticketsLeft: 2 } };

suite('NHÀ THẬT: the friends list with raid timers', () => {
  test('a sealed friend shows how long until that home can be raided again', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([{ targetId: 7, name: 'Tí', homeLevel: 4, difficulty: 'Cân bằng', lockedUntil: now + 5 * H + 12 * M, availableAt: now + 5 * H + 12 * M, visitedToday: false, shielded: false, canRaidNow: false }]),
      targets: targetsReply,
    });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('còn 5 giờ 12 phút'), 'the wait is spelled out in hours and minutes: ' + html.slice(0, 200));
    assert.truthy(html.includes('cướp lại lúc'), 'and the clock time it comes back');
    assert.truthy(html.includes('VỪA BỊ CƯỚP'), 'the reason is the seal');
    const row = rows(w)[0];
    assert.truthy(row.disabled, 'a sealed home cannot be tapped');
    assert.truthy(row.classList.contains('wait'));
    assert.falsy(html.includes('CƯỚP NGAY'), 'nothing on this list is raidable');
  });

  test('an open friend is a big CƯỚP NGAY and tapping it opens the scout stage', async () => {
    const w = await openLive({
      friends: friendsReply([{ targetId: 8, name: 'Bo', homeLevel: 2, difficulty: 'Dễ', lockedUntil: 0, availableAt: 0, visitedToday: false, shielded: false, canRaidNow: true }]),
      targets: targetsReply,
    });
    const row = rows(w)[0];
    assert.truthy(w.screen().innerHTML.includes('CƯỚP NGAY'));
    assert.falsy(row.disabled);
    assert.truthy(row.classList.contains('ready'));
    assert.equal(row.getAttribute('onclick'), 'nrScoutLive(0)', 'the row rides the same path as a target card');
    w.ctx.NightRaid.scoutLive(0); await settle();
    assert.truthy(w.doc.getElementById('nrStartRaid'), 'the scout stage with TIẾN QUÂN is up');
    assert.truthy(w.screen().innerHTML.includes('Bo'), 'named after the friend');
    const preview = w.battles[w.battles.length - 1];
    assert.equal(preview.target.targetId, 8);
    assert.deepEqual(preview.target.layout.cells, [], 'the preview never holds a friend layout');
  });

  test('a shielded friend carries the shield marker and the warning', async () => {
    const w = await openLive({
      friends: friendsReply([{ targetId: 9, name: 'Mi', homeLevel: 5, difficulty: 'Khó', lockedUntil: 0, availableAt: 0, visitedToday: false, shielded: true, canRaidNow: true }]),
      targets: targetsReply,
    });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('🛡️'), 'shield marker');
    assert.truthy(html.includes('đang có khiên — cướp là thua'), 'and what it means');
    assert.truthy(rows(w)[0].classList.contains('shield'));
  });

  test('a friend visited today waits for the next raid day, not for a seal', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([{ targetId: 10, name: 'Su', homeLevel: 3, difficulty: 'Cân bằng', lockedUntil: 0, availableAt: now + 90 * M, visitedToday: true, shielded: false, canRaidNow: false }]),
      targets: targetsReply,
    });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('CON ĐÃ THĂM HÔM NAY'));
    assert.truthy(html.includes('còn 1 giờ 30 phút'));
    assert.truthy(rows(w)[0].disabled);
  });

  test('raidable friends come first, whatever order the server used', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([
        { targetId: 1, name: 'Chờ lâu', homeLevel: 3, difficulty: 'Cân bằng', lockedUntil: now + 20 * H, availableAt: now + 20 * H, visitedToday: false, shielded: false, canRaidNow: false },
        { targetId: 2, name: 'Mở', homeLevel: 3, difficulty: 'Cân bằng', lockedUntil: 0, availableAt: 0, visitedToday: false, shielded: false, canRaidNow: true },
        { targetId: 3, name: 'Chờ ít', homeLevel: 3, difficulty: 'Cân bằng', lockedUntil: now + 2 * H, availableAt: now + 2 * H, visitedToday: false, shielded: false, canRaidNow: false },
      ]),
      targets: targetsReply,
    });
    const names = rows(w).map(r => r.querySelector('strong').textContent);
    assert.deepEqual(names, ['Mở', 'Chờ ít', 'Chờ lâu']);
    // The random target card follows the friends in the shared index space.
    const card = w.screen().querySelector('.nr-target-card');
    assert.equal(card.getAttribute('onclick'), 'nrScoutLive(3)');
    w.ctx.NightRaid.scoutLive(3); await settle();
    assert.equal(w.battles[w.battles.length - 1].target.targetId, RANDOM_TARGET.targetId, 'index 3 is the random house');
  });

  test('the child sees their own home status on top — protected…', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([], { hasHome: true, homeLevel: 3, lockedUntil: now + 23 * H, shieldUntil: 0 }),
      targets: targetsReply,
    });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Nhà con'));
    assert.truthy(html.includes('đang được bảo vệ'));
    assert.truthy(html.includes('còn 23 giờ'));
  });

  test('…shielded…', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([], { hasHome: true, homeLevel: 3, lockedUntil: 0, shieldUntil: now + 3 * H }),
      targets: targetsReply,
    });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Nhà con'));
    assert.truthy(html.includes('đang có khiên'));
  });

  test('…or open', async () => {
    const w = await openLive({ friends: friendsReply([]), targets: targetsReply });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Nhà con'));
    assert.truthy(html.includes('có thể bị cướp'));
  });

  test('no friends yet: a friendly empty state that points at 👥 Bạn bè, plus the bot and random houses', async () => {
    const w = await openLive({ friends: friendsReply([]), targets: targetsReply });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Chưa có bạn nào có lâu đài'));
    assert.truthy(html.includes('Bạn bè'), 'it names the Friends tab');
    assert.truthy(html.includes('profileScreen'), 'and offers to take the child there');
    assert.truthy(html.includes('nrScoutBot()'), 'the bot fallback stays');
    assert.truthy(html.includes('Nhà ngẫu nhiên'));
    assert.truthy(html.includes('nr-target-card'), 'the random houses stay reachable');
    assert.equal(rows(w).length, 0);
  });

  test('both calls failing still degrades to the bot offer (offline child)', async () => {
    const w = await openLive({});
    assert.truthy(w.screen().innerHTML.includes('nrScoutBot()'));
    assert.truthy(w.screen().innerHTML.includes('Chưa thể tìm nhà thật'));
  });

  test('friends failing but targets answering keeps the random houses', async () => {
    const w = await openLive({ targets: targetsReply });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Chưa tải được danh sách bạn bè'));
    assert.truthy(html.includes('nr-target-card'));
    assert.equal(w.screen().querySelector('.nr-target-card').getAttribute('onclick'), 'nrScoutLive(0)');
  });

  test('the countdown ticks in place and hands the row back as CƯỚP NGAY when it runs out', async () => {
    const now = Date.now();
    const realNow = Date.now;
    const w = await openLive({
      friends: friendsReply([{ targetId: 11, name: 'Tèo', homeLevel: 3, difficulty: 'Cân bằng', lockedUntil: now + 61 * M, availableAt: now + 61 * M, visitedToday: false, shielded: false, canRaidNow: false }]),
      targets: targetsReply,
    });
    // renderHome (inside open()) armed its own tickers first; the live screen's
    // is the LAST one captured, and it is the only one left running after the
    // cleanup() that opens the screen.
    const tick = w.timers[w.timers.length - 1];
    const row = rows(w)[0];
    assert.truthy(row.querySelector('[data-nr-friend-time]').textContent.includes('1 giờ 1 phút'));
    try {
      Date.now = () => now + 30 * M;
      tick();
      assert.truthy(row.querySelector('[data-nr-friend-time]').textContent.includes('31 phút'), 'the text follows the clock without a fetch');
      assert.truthy(row.disabled, 'still sealed');
      Date.now = () => now + 61 * M + 1;
      tick();
      assert.falsy(row.disabled, 'the row is live again');
      assert.truthy(row.classList.contains('ready'));
      assert.truthy(row.innerHTML.includes('CƯỚP NGAY'));
      assert.falsy(row.hasAttribute('data-nr-friend-until'), 'and leaves the ticker');
    } finally { Date.now = realNow; }
  });

  test('a shielded friend whose seal runs out flips to the shield warning, not to CƯỚP NGAY', async () => {
    const now = Date.now();
    const realNow = Date.now;
    const w = await openLive({
      friends: friendsReply([{ targetId: 12, name: 'Lan', homeLevel: 3, difficulty: 'Cân bằng', lockedUntil: now + M, availableAt: now + M, visitedToday: false, shielded: true, canRaidNow: false }]),
      targets: targetsReply,
    });
    try {
      Date.now = () => now + 2 * M;
      w.timers[w.timers.length - 1]();
      const row = rows(w)[0];
      assert.falsy(row.disabled);
      assert.truthy(row.classList.contains('shield'));
      assert.truthy(row.innerHTML.includes('cướp là thua'));
    } finally { Date.now = realNow; }
  });

  test('the markup keeps every tap target a real button and no friend secret', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([{ targetId: 13, name: '<b>x</b>', homeLevel: 3, difficulty: 'Cân bằng', lockedUntil: now + H, availableAt: now + H, visitedToday: false, shielded: false, canRaidNow: false }]),
      targets: targetsReply,
    });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('&lt;b&gt;x&lt;/b&gt;'), 'names are escaped');
    for (const row of rows(w)) assert.equal(row.tagName, 'BUTTON');
    assert.falsy(/DEF/.test(w.screen().querySelector('.nr-friend-list').innerHTML), 'no DEF on the list');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
