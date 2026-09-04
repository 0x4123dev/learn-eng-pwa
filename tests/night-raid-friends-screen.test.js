// CƯỚP ĐÊM as a child sees it: mount the REAL js/night-raid.js against a DOM,
// answer night-raid/friends and night-raid/targets from a scripted server, and
// read the screen.
//
// The rule this suite exists to enforce: A ROW REVEALS NOTHING ABOUT THE STATE
// OF THE HOUSE BEHIND IT. The list used to shout "🛡️ CÓ KHIÊN", "VỪA BỊ CƯỚP"
// and "CON ĐÃ THĂM HÔM NAY", which turned the screen into a solved puzzle — a
// child read the labels, skipped every house that could not be won, and the
// raid stopped being a raid. A row may show exactly two things: the green
// ⚔️ TẤN CÔNG key, or the child's OWN wait on that door counting down. Whether
// a shield is up, and whether somebody already got there, are surprises the
// troops find on arrival.
//
// Same mount recipe as tests/night-raid-screens.test.js.
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
// The shape /targets sends now: a retry clock of the child's own, and not one
// word about the castle's seal or its shield.
const RANDOM_TARGET = {
  targetId: 900, name: 'Nhà lạ', homeLevel: 2, difficulty: 'Cân bằng', retryAt: 0,
  layout: { cells: [], soldiers: 1, dogLane: 2 }, dogLevel: 3, castleHp: 200, seed: 3,
};

// `server` maps a route suffix ('friends' | 'targets' | 'start') to a reply.
function mount(server, extra) {
  const doc = withCanvas(createDocument('<div id="nightRaidScreen"></div><div id="bottomNav"></div>'));
  const toasts = [], timers = [], battles = [], calls = [];
  class FakeAutoBattle {
    constructor(host, target, options) { this.target = target; this.options = options || {}; battles.push(this); }
    start() {} charge() { return true; } destroy() {}
  }
  const api = (route, opts) => {
    const key = String(route).split('/').pop();
    calls.push({ key, opts });
    const reply = server && server[key];
    return Promise.resolve(reply === undefined ? { ok: false, data: null } : (typeof reply === 'function' ? reply() : reply));
  };
  const state = {
    coins: 9000, dogLevel: 12, dogGrowthXP: 30000, allowBot: true,
    petBattleCastleSkin: 'stone-keep',
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
  return { ctx, doc, toasts, timers, battles, calls, screen: () => doc.getElementById('nightRaidScreen') };
}
const settle = () => new Promise(r => setImmediate(r));

async function openLive(server, extra) {
  const w = mount(server, extra);
  w.ctx.NightRaid.open();
  await w.ctx.NightRaid.showLiveTargets(); await settle();
  return w;
}
const rows = w => w.screen().querySelectorAll('.nr-friend-row');
// Everything a child can read about OTHER people's houses. The child's own
// status banner is deliberately excluded: their own shield and their own seal
// are theirs to know.
function targetsHTML(w) {
  const list = w.screen().querySelector('.nr-friend-list');
  const grid = w.screen().querySelector('.nr-target-grid');
  return (list ? list.innerHTML : '') + (grid ? grid.innerHTML : '');
}
// The exact words that used to solve the puzzle for the child.
const LEAKS = ['KHIÊN', 'khiên', 'VỪA BỊ CƯỚP', 'ĐÃ THĂM', 'đã thăm', 'cướp là thua', 'shield'];
function assertNoLeaks(w, why) {
  const html = targetsHTML(w);
  for (const word of LEAKS) {
    assert.falsy(html.includes(word), why + ' — the list still says "' + word + '"');
  }
}

function friendsReply(friends, me) {
  return { ok: true, data: { friends, me: me || { hasHome: true, homeLevel: 3, lockedUntil: 0, shieldUntil: 0 }, ticketsLeft: 2 } };
}
const targetsReply = { ok: true, data: { targets: [RANDOM_TARGET], ticketsLeft: 2 } };
// The row the server sends now, and nothing else.
const friend = (over) => Object.assign(
  { targetId: 7, name: 'Tí', homeLevel: 4, difficulty: 'Cân bằng', retryAt: 0 }, over || {});

suite('CƯỚP ĐÊM: the list of houses tells the child nothing about them', () => {
  test('a row the child must wait on shows the countdown, the unlock time, and no reason', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([friend({ retryAt: now + 5 * H + 12 * M })]),
      targets: targetsReply,
    });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('còn 5 giờ 12 phút'), 'the wait is spelled out in hours and minutes');
    assert.truthy(html.includes('vào lại lúc'), 'and the clock time it opens');
    assert.truthy(html.includes('CHỜ THÊM'), 'the label says only that the child waits');
    const row = rows(w)[0];
    assert.truthy(row.disabled, 'a row on its clock cannot be tapped');
    assert.truthy(row.classList.contains('wait'));
    // (the page's own instructions name the key; the ROW must not carry one)
    assert.falsy(row.innerHTML.includes('TẤN CÔNG'), 'and offers no attack key');
    assertNoLeaks(w, 'a waiting row');
  });

  test('an open row is a green ⚔️ TẤN CÔNG key and tapping it opens the scout stage', async () => {
    const w = await openLive({
      friends: friendsReply([friend({ targetId: 8, name: 'Bo', homeLevel: 2, difficulty: 'Dễ', retryAt: 0 })]),
      targets: targetsReply,
    });
    const row = rows(w)[0];
    assert.truthy(row.innerHTML.includes('TẤN CÔNG'), 'the attack key lives on the row itself');
    assert.falsy(row.disabled);
    assert.truthy(row.classList.contains('ready'), 'and is painted green');
    assert.equal(row.getAttribute('onclick'), 'nrScoutLive(0)', 'the row rides the same path as a target card');
    // A <button> inside a <button> is invalid markup that Safari resolves by
    // dropping one of them, so the key must be an element the row can hold.
    assert.equal(row.tagName, 'BUTTON');
    assert.equal(row.querySelectorAll('button').length, 0, 'no button nested inside the row button');
    w.ctx.NightRaid.scoutLive(0); await settle();
    assert.truthy(w.doc.getElementById('nrStartRaid'), 'the scout stage with TIẾN QUÂN is up');
    assert.truthy(w.screen().innerHTML.includes('Bo'), 'named after the house');
    const preview = w.battles[w.battles.length - 1];
    assert.equal(preview.target.targetId, 8);
    assert.deepEqual(preview.target.layout.cells, [], 'the preview never holds a real layout');
  });

  test('a house holding a shield looks exactly like every other open house', async () => {
    // Even when an older server still volunteers `shielded`, the row must not
    // repeat it: the shield is the surprise the troops find on arrival.
    const w = await openLive({
      friends: friendsReply([friend({ targetId: 9, name: 'Mi', homeLevel: 5, difficulty: 'Khó', retryAt: 0, shielded: true })]),
      targets: targetsReply,
    });
    const row = rows(w)[0];
    assert.truthy(row.classList.contains('ready'), 'still just an open house');
    assert.falsy(row.classList.contains('shield'), 'there is no shield state any more');
    assert.truthy(row.innerHTML.includes('TẤN CÔNG'));
    assert.falsy(row.hasAttribute('data-nr-friend-shield'), 'not even in a data attribute');
    assertNoLeaks(w, 'a shielded house');
  });

  test('a house somebody already robbed looks exactly like every other open house', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([friend({ targetId: 10, name: 'Su', retryAt: 0, lockedUntil: now + 20 * H })]),
      targets: targetsReply,
    });
    // lockedUntil is the HOUSE's seal. It is not the child's clock, so it must
    // not gate, grey out or annotate the row.
    assert.falsy(rows(w)[0].disabled, 'the child may still march on it and find out');
    assert.truthy(rows(w)[0].innerHTML.includes('TẤN CÔNG'));
    assertNoLeaks(w, 'an already-robbed house');
  });

  test('the scout stage a row opens is as blind as the row', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([friend({ targetId: 21, name: 'Kem', retryAt: 0, shielded: true, lockedUntil: now + 20 * H })]),
      targets: targetsReply,
    });
    w.ctx.NightRaid.scoutLive(0); await settle();
    const html = w.screen().innerHTML;
    assert.truthy(w.doc.getElementById('nrStartRaid'), 'TIẾN QUÂN is armed, not sealed off');
    assert.falsy(html.includes('KHIÊN'), 'no shield word on the scout stage either');
    assert.falsy(html.includes('NHÀ VỪA BỊ PHÁ'), 'and no seal chip');
    const target = w.battles[w.battles.length - 1].target;
    assert.falsy(target.shieldClue, 'no shield clue travels with the target');
    assert.falsy(target.lockedUntil, 'and no seal clock');
  });

  test('rows the child can attack come first, whatever order the server used', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([
        friend({ targetId: 1, name: 'Chờ lâu', retryAt: now + 20 * H }),
        friend({ targetId: 2, name: 'Mở', retryAt: 0 }),
        friend({ targetId: 3, name: 'Chờ ít', retryAt: now + 2 * H }),
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

  test('an older server that still says availableAt is read the same way', async () => {
    // Deploys land in whatever order they land. The client must not show a
    // "0 minutes" wait on every row because the field was renamed under it.
    const now = Date.now();
    const w = await openLive({
      friends: { ok: true, data: { friends: [
        { targetId: 31, name: 'Cũ', homeLevel: 3, difficulty: 'Cân bằng', availableAt: now + 90 * M, shielded: true, visitedToday: true },
      ], me: { hasHome: true, lockedUntil: 0, shieldUntil: 0 }, ticketsLeft: 2 } },
      targets: targetsReply,
    });
    assert.truthy(w.screen().innerHTML.includes('còn 1 giờ 30 phút'), 'the old field still drives the clock');
    assert.truthy(rows(w)[0].disabled);
    assertNoLeaks(w, 'an old-shaped payload');
  });

  test('a random castle carries the same two states and no shield halo', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([]),
      targets: { ok: true, data: { targets: [
        Object.assign({}, RANDOM_TARGET, { targetId: 91, name: 'Mở', retryAt: 0, shieldClue: true }),
        Object.assign({}, RANDOM_TARGET, { targetId: 92, name: 'Chờ', retryAt: now + 3 * H }),
      ], ticketsLeft: 2 } },
    });
    const cards = w.screen().querySelectorAll('.nr-target-card');
    assert.equal(cards.length, 2);
    assert.falsy(cards[0].disabled, 'the open castle is tappable');
    assert.falsy(cards[0].innerHTML.includes('shield-clue'), 'the shield halo is gone');
    assert.truthy(cards[1].disabled, 'the one on the child\'s clock is not');
    assert.truthy(cards[1].classList.contains('locked'));
    assert.truthy(cards[1].innerHTML.includes('CHỜ THÊM'), 'and says only that the child waits');
    assertNoLeaks(w, 'a random castle');
  });

  test('the child sees their OWN home status on top — protected…', async () => {
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

  test('…shielded — a child may know everything about their own house…', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([], { hasHome: true, homeLevel: 3, lockedUntil: 0, shieldUntil: now + 3 * H }),
      targets: targetsReply,
    });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Nhà con'));
    assert.truthy(html.includes('đang có khiên'));
    assert.truthy(w.screen().querySelector('.nr-own-status'), 'and it lives in its own banner, not on a row');
  });

  test('…or open', async () => {
    const w = await openLive({ friends: friendsReply([]), targets: targetsReply });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Nhà con'));
    assert.truthy(html.includes('có thể bị cướp'));
  });

  test('no friends yet: a friendly empty state that points at 👥 Bạn bè, plus the random houses', async () => {
    const w = await openLive({ friends: friendsReply([]), targets: targetsReply });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Chưa có bạn nào có lâu đài'));
    assert.truthy(html.includes('Bạn bè'), 'it names the Friends tab');
    assert.truthy(html.includes('profileScreen'), 'and offers to take the child there');
    assert.falsy(html.includes('nrScoutBot()'), 'a friendless child is not handed a bot instead');
    assert.truthy(html.includes('Nhà ngẫu nhiên'));
    assert.truthy(html.includes('nr-target-card'), 'the random houses stay reachable');
    assert.equal(rows(w).length, 0);
  });

  test('both calls failing says so — it does not fall back to a bot (offline child)', async () => {
    const w = await openLive({});
    assert.falsy(w.screen().innerHTML.includes('nrScoutBot()'));
    assert.truthy(w.screen().innerHTML.includes('Chưa thể tìm nhà thật'));
    assert.truthy(w.screen().innerHTML.includes('Chưa tải được nhà người chơi'));
  });

  test('a normal bot-off child never sees the QA bot button', async () => {
    const w = mount({ friends: friendsReply([]), targets: targetsReply });
    w.ctx.appState.allowBot = false;
    w.ctx.NightRaid.open();
    await w.ctx.NightRaid.showLiveTargets();
    await settle();
    const html = w.screen().innerHTML;
    assert.falsy(html.includes('nrScoutBot()'), 'bot practice is reserved for admin-enabled test accounts');
    assert.falsy(html.includes('Chơi thử với Bot'));
    assert.truthy(html.includes('nr-target-card'), 'real random houses remain available');
  });

  test('friends failing but targets answering keeps the random houses', async () => {
    const w = await openLive({ targets: targetsReply });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('Chưa tải được danh sách bạn bè'));
    assert.truthy(html.includes('nr-target-card'));
    assert.equal(w.screen().querySelector('.nr-target-card').getAttribute('onclick'), 'nrScoutLive(0)');
  });

  test('the countdown ticks in place and hands the row back as TẤN CÔNG when it runs out', async () => {
    const now = Date.now();
    const realNow = Date.now;
    const w = await openLive({
      friends: friendsReply([friend({ targetId: 11, name: 'Tèo', retryAt: now + 61 * M })]),
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
      assert.truthy(row.disabled, 'still waiting');
      Date.now = () => now + 61 * M + 1;
      tick();
      assert.falsy(row.disabled, 'the row is live again');
      assert.truthy(row.classList.contains('ready'));
      assert.truthy(row.innerHTML.includes('TẤN CÔNG'));
      assert.falsy(row.hasAttribute('data-nr-friend-until'), 'and leaves the ticker');
    } finally { Date.now = realNow; }
  });

  test('a random castle whose clock runs out is handed back too', async () => {
    const now = Date.now();
    const realNow = Date.now;
    const w = await openLive({
      friends: friendsReply([]),
      targets: { ok: true, data: { targets: [Object.assign({}, RANDOM_TARGET, { retryAt: now + M })], ticketsLeft: 2 } },
    });
    try {
      Date.now = () => now + 2 * M;
      w.timers[w.timers.length - 1]();
      const card = w.screen().querySelector('.nr-target-card');
      assert.falsy(card.disabled, 'a card left greyed out until the screen reopens is a dead end');
      assert.falsy(card.classList.contains('locked'));
    } finally { Date.now = realNow; }
  });

  test('the markup keeps every tap target a real button and no house secret', async () => {
    const now = Date.now();
    const w = await openLive({
      friends: friendsReply([friend({ targetId: 13, name: '<b>x</b>', retryAt: now + H })]),
      targets: targetsReply,
    });
    const html = w.screen().innerHTML;
    assert.truthy(html.includes('&lt;b&gt;x&lt;/b&gt;'), 'names are escaped');
    for (const row of rows(w)) assert.equal(row.tagName, 'BUTTON');
    assert.falsy(/DEF/.test(targetsHTML(w)), 'no DEF on the list');
  });
});

if (require.main === module) {
  require('./harness').runAll().then(code => process.exit(code));
}
