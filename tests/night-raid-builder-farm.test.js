// tests/night-raid-builder-farm.test.js — the castle builder grows a farm:
// crops drawn per task-day, wilt, the shop tabs, extra farm boards, the task
// bar, harvest and replant. Mounted the way tests/night-raid-screens.test.js
// mounts the real js/night-raid.js against the DOM shim.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const { createDocument } = require('./domshim');
const root = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
const Rules = require(path.join(root, 'js', 'night-raid-rules.js'));
const Farm = Rules.farmRules;

const DAY = 86400000;
const gmt7 = ms => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
const TODAY = gmt7(Date.now()), YESTERDAY = gmt7(Date.now() - DAY), TWO_AGO = gmt7(Date.now() - 2 * DAY);
const FRESH = { today: TODAY, doneYesterday: true, doneToday: false };
const WILT = { today: TODAY, doneYesterday: false, doneToday: false };

function ctx2d() {
  return new Proxy({}, { get: (t, k) => k === 'canvas' ? { width: 0, height: 0 }
    : (k === 'createLinearGradient' || k === 'createRadialGradient') ? () => ({ addColorStop() {} })
    : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] })
    : (typeof k === 'string' ? () => {} : undefined) });
}
function mount(o) {
  o = o || {};
  const doc = createDocument('<div id="nightRaidScreen"></div><div id="bottomNav"></div>');
  const proto = Object.getPrototypeOf(doc.createElement('canvas'));
  if (!proto.getContext) proto.getContext = function () { return ctx2d(); };
  const toasts = [], calls = [];
  const state = Object.assign({
    coins: 9000, dogLevel: 12, allowBot: true, petBattleCastleSkin: 'stone-keep',
    farmDayCount: 5, farmCtx: FRESH,
    nightRaidLayout: { cells: [
      { type: 'wood-fence', gx: 3, gy: 7, tier: 1 },
      { type: 'tomato', gx: 1, gy: 1, uid: 'c-tomato01', day: 4, at: YESTERDAY },
      { type: 'pumpkin', gx: 2, gy: 1, uid: 'c-pumpk001', day: 5, at: TODAY },
      { type: 'lettuce', gx: 3, gy: 1, uid: 'c-lettuc01', day: 3, at: TWO_AGO },
      { type: 'training-barracks', gx: 8, gy: 8, tier: 1, uid: 'p-barrac01', lastDay: 4 },
      { type: 'rice-field', gx: 6, gy: 6, tier: 1, uid: 'p-rice0001', readyAt: 0 },
    ], soldiers: 2, dogLane: 2, farms: [] },
    dailyTask: { date: TODAY, tasks: [{ id: 1, label: 'Units', target: 2, count: 1, done: false }], allDone: false },
  }, o.appState || {});
  const api = o.api || (() => Promise.resolve({ ok: false, data: null }));
  const ctx = {
    console, Math, JSON, Date, String, Number, Array, Object, Boolean, Promise, RegExp, Set, Map, isNaN, parseInt, parseFloat, Error,
    document: doc, window: { addEventListener() {}, innerWidth: 900 }, innerWidth: 900, navigator: { vibrate() {} },
    NightRaidRules: Rules, NightRaidGame: { AutoBattle: class { start() {} charge() { return true; } destroy() {} } },
    NightRaidArt: new Proxy({}, { get: () => () => {}, has: () => true }),
    CastleSkins: { get: () => ({ name: { vi: 'Thành Đá' } }), preload() {} },
    DailyTask: { state: () => state.dailyTask, open() { calls.push(['dailyTask.open']); } },
    currentUser: 'Kid', appState: state, saveUserData() {}, showToast(m) { toasts.push(String(m)); },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {}, performance: { now: () => 0 }, confirm: () => true,
    switchScreen(s) { calls.push(['switchScreen', s]); }, renderPetBattle() {},
    EngAuth: { tokenFor: () => 'tok', api: (p, opts) => { calls.push([p, (opts && opts.method) || 'GET', opts && opts.body]); return api(p, opts); } },
  };
  Object.assign(ctx, o.ctx || {});
  ctx.global = ctx; ctx.globalThis = ctx; ctx.self = ctx;
  vm.createContext(ctx);
  vm.runInContext(read('js/night-raid.js'), ctx, { filename: 'js/night-raid.js' });
  return { ctx, doc, toasts, calls, state, screen: () => doc.getElementById('nightRaidScreen') };
}
const html = w => w.screen().innerHTML;

suite('builder farm: crops draw their day and their mood', () => {
  test('a growing crop shows its sprite for g and "còn N ngày"', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    const out = html(w);
    assert.truthy(out.includes('img/farm/tomato-day1.webp'), 'tomato at g=1');
    assert.truthy(out.includes('còn 1 ngày'), 'tomato has one task-day left');
    assert.truthy(out.includes('img/farm/sprout.webp'), 'a crop planted today is the shared sprout');
    assert.truthy(out.includes('img/farm/lettuce-day1.webp'), 'ripe lettuce shows its last day');
    assert.truthy(out.includes('CHÍN · +8 XU'));
  });
  test('wilted crops draw the wilted sprite and HÉO; the builder wears the wilted class', () => {
    const w = mount({ appState: { farmCtx: WILT } }); w.ctx.NightRaid.renderBuilder();
    const out = html(w);
    assert.truthy(out.includes('img/farm/tomato-wilted-old.webp'), 'tomato g=1 of 2 is at half → old');
    assert.truthy(out.includes('img/farm/lettuce-wilted-old.webp'));
    assert.truthy(out.includes('img/farm/sprout.webp'), 'today\'s planting is not wilted');
    assert.truthy(out.includes('>HÉO<'));
    assert.truthy(/class="nr-builder[^"]*\bwilted\b/.test(out));
  });
  test('barracks read the task-day clock; fields keep their timer', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    const out = html(w);
    assert.truthy(out.includes('NHẬN LÍNH'), 'lastDay 4 < dayCount 5 → ready');
    assert.truthy(out.includes('data-ready-at="0"'), 'the rice field still carries its clock');
    const w2 = mount({ appState: { farmDayCount: 4 } }); w2.ctx.NightRaid.renderBuilder();
    assert.truthy(html(w2).includes('chờ nhiệm vụ'));
  });
  test('THU HOẠCH counts ripe fresh crops, ready barracks and ready fields', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    assert.truthy(html(w).includes('THU HOẠCH 3'), html(w).match(/THU HOẠCH \d+|ĐANG SẢN XUẤT/)[0]);
  });
});

suite('builder farm: the server clock is adopted', () => {
  test('GET home hands over dayCount and ctx', async () => {
    const w = mount({ api: p => p === 'night-raid/home'
      ? Promise.resolve({ ok: true, data: { home: { layout: { cells: [], farms: [] }, lootableCoins: 9000 }, dayCount: 9, ctx: WILT } })
      : Promise.resolve({ ok: false, data: null }) });
    w.state.nightRaidWalletSynced = true;
    w.ctx.NightRaid.open();
    await new Promise(r => setImmediate(r)); await new Promise(r => setImmediate(r));
    assert.equal(w.state.farmDayCount, 9);
    assert.deepEqual(w.state.farmCtx, WILT);
  });
  test('collect adopts dayCount/ctx, remembers what was harvested, and explains a wilted refusal', async () => {
    let reply = { ok: true, data: { layout: { cells: [], farms: [] }, coins: 9018, collectedCoins: 18, collectedSoldiers: 0, harvested: [{ type: 'tomato', gx: 1, gy: 1, zone: 0 }], wilted: false, dayCount: 6, ctx: FRESH } };
    const w = mount({ api: p => p === 'night-raid/collect' ? Promise.resolve(reply) : Promise.resolve({ ok: true, data: { ok: true } }) });
    w.ctx.NightRaid.renderBuilder();
    await w.ctx.NightRaid.collectResources();
    assert.equal(w.state.coins, 9018);
    assert.equal(w.state.farmDayCount, 6);
    assert.truthy(w.toasts.some(t => t.includes('+18 xu')));
    assert.truthy(html(w).includes('TRỒNG LẠI NHƯ CŨ'), 'a harvested crop offers replanting');
    reply = { ok: true, data: { nothingReady: true, wilted: true, layout: { cells: [], farms: [] }, coins: 9018, soldiers: 2, dayCount: 6, ctx: WILT } };
    await w.ctx.NightRaid.collectResources();
    assert.truthy(w.toasts.some(t => t.includes('héo')), 'the child is told the plants are wilted');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
