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
    dailyTask: { date: TODAY, tasks: [{ id: 1, label: 'Units', target: 2, count: 1, done: false }], allDone: false,
      seeds: { progress: 1, goal: 2, next: { id: 'lettuce', name: 'Rau cải', days: 1, yield: 40 },
        inventory: Farm.CROPS.map(c => ({ id: c.id, name: c.name.vi, days: c.days, yield: c.yield, quantity: 3 })), recent: [] } },
  }, o.appState || {});
  const defaultApi = (p, opts) => {
    if (p === 'night-raid/home' && opts && opts.method === 'PUT') {
      return Promise.resolve({ ok: true, data: { ok: true, layout: state.nightRaidLayout, dayCount: state.farmDayCount, ctx: state.farmCtx, seeds: state.dailyTask.seeds } });
    }
    if (p !== 'night-raid/plant') return Promise.resolve({ ok: false, data: null });
    const b = opts.body, layout = Rules.normalizeLayout(JSON.parse(JSON.stringify(state.nightRaidLayout)));
    const cells = b.zone ? layout.farms[b.zone - 1].cells : layout.cells;
    cells.push({ type: b.cropId, gx: b.gx, gy: b.gy, uid: 'c-server-' + b.cropId + b.gx + b.gy, day: state.farmDayCount, at: TODAY });
    const item = state.dailyTask.seeds.inventory.find(x => x.id === b.cropId); if (item) item.quantity--;
    return Promise.resolve({ ok: true, data: { ok: true, layout, dayCount: state.farmDayCount, ctx: FRESH, seeds: state.dailyTask.seeds } });
  };
  const api = o.api ? ((p, opts) => o.api(p, opts, defaultApi)) : defaultApi;
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
    assert.truthy(out.includes('CHÍN · +40 XU'));
    assert.falsy(out.includes('cấp undefined'), 'crop accessibility labels never announce an undefined tier');
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
    assert.truthy(html(w2).includes('Hoàn thành Daily Task hôm nay để thu hoạch lính'));
    const w3 = mount({ appState: { farmDayCount: 4, farmCtx: { today: TODAY, doneYesterday: true, doneToday: true } } });
    w3.ctx.NightRaid.renderBuilder();
    assert.truthy(html(w3).includes('Hoàn thành Daily Task ngày mai để thu hoạch lính'));
  });
  test('placed buildings do not show a redundant level-1 bubble', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    assert.falsy(html(w).includes('<em>1</em>'), 'no numeric tier bubble is drawn on placed buildings');
  });
  test('the unified builder shows every owned soldier on the estate', () => {
    const w = mount({ appState: { nightRaidLayout: { cells: [], farms: [], soldiers: 5, dogLane: 2 } } });
    w.ctx.NightRaid.renderBuilder();
    assert.truthy(html(w).includes('data-nr-yard-army'), 'the army is mounted in builder view');
    assert.equal((html(w).match(/data-unit="\d+"/g) || []).length, 5, 'all five owned soldiers are visible');
    assert.truthy(html(w).includes('data-total="5"'));
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
  test('claiming a ready barracks confirms the soldier was received', async () => {
    const layout = { cells: [{ type: 'training-barracks', gx: 8, gy: 8, tier: 1, uid: 'p-barrac01', lastDay: 6 }], farms: [], soldiers: 3 };
    const w = mount({ api: p => p === 'night-raid/collect'
      ? Promise.resolve({ ok: true, data: { layout, coins: 9000, collectedCoins: 0, collectedSoldiers: 1, soldiers: 3, dayCount: 6, ctx: FRESH } })
      : Promise.resolve({ ok: true, data: { ok: true } }) });
    w.ctx.NightRaid.renderBuilder();
    await w.ctx.NightRaid.collectResources('p-barrac01');
    assert.truthy(w.toasts.some(t => t.includes('+1 lính') && t.includes('đã thu hoạch')), 'success is visible to the child');
    assert.equal(w.state.nightRaidLayout.soldiers, 3);
  });
});

suite('builder farm: shop tabs, seed inventory and buying', () => {
  test('Shop has no seed tab; the peer-level seed menu shows earned quantities without prices', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    for (const t of ['Phòng thủ', 'Nông trại', 'Mở rộng']) assert.truthy(html(w).includes(`aria-label="${t}"`), 'tab ' + t);
    assert.falsy(html(w).includes('onclick="nrSelectShopTab(\'seeds\')"'), 'seeds are not sold in Shop');
    assert.truthy(html(w).includes('onclick="nrOpenSeeds()"'), 'seed inventory is a peer navigation action');
    w.ctx.NightRaid.openSeeds();
    assert.truthy(html(w).includes('Bí ngô') && html(w).includes('8 ngày · thu 600 xu'), 'seed inventory card copy');
    assert.truthy(html(w).includes("nrSelectBuild('pumpkin')"));
    assert.truthy(html(w).includes('x3 hạt'));
    assert.falsy(html(w).includes('nr-item-price'), 'seed cards have no coin price');
    for (const crop of Farm.CROPS) {
      const art = `img/farm/${crop.id}-day${crop.days}.webp`;
      assert.truthy(html(w).includes(`src="${art}"`), crop.id + ' uses its mature crop art');
      assert.truthy(fs.existsSync(path.join(root, art)), crop.id + ' shop art exists on disk');
    }
    w.ctx.NightRaid.selectShopTab('farm');
    assert.truthy(html(w).includes('Cối xay gió') && html(w).includes('8000 xu'));
    w.ctx.NightRaid.selectShopTab('defense');
    assert.truthy(html(w).includes('Mỗi loại 1 cái'), 'the owned rice field is capped in the shop');
  });
  test('opening the seed inventory clears stale selection; tapping a seed confirms placement mode', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectBuild('lettuce');
    assert.truthy(html(w).includes('nr-builder editing'), 'selecting a seed enters placement mode');
    assert.truthy(w.toasts.some(t => t.includes('Đã chọn Rau cải') && t.includes('chạm một ô đất trống')), 'a visible instruction confirms the tap');
    w.ctx.NightRaid.openSeeds();
    assert.falsy(/nr-seed-item selected/.test(html(w)), 'reopening the inventory never paints an old seed as newly selected');
  });
  test('planting uses the server endpoint, consumes one owned seed and never charges coins', async () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectBuild('pumpkin');
    await w.ctx.NightRaid.buildCell(10, 10, true);
    const crop = w.state.nightRaidLayout.cells.find(c => c.type === 'pumpkin' && c.gx === 10);
    assert.truthy(crop, 'the pumpkin was planted');
    assert.equal(crop.day, 5); assert.equal(crop.at, TODAY);
    assert.truthy(/^c-/.test(crop.uid));
    assert.equal(w.state.coins, 9000);
    assert.equal(w.state.dailyTask.seeds.inventory.find(x => x.id === 'pumpkin').quantity, 2);
    assert.truthy(w.calls.some(c => c[0] === 'night-raid/plant' && c[1] === 'POST'), 'the seed is spent and planted on the server');
  });
  test('a second rice field and replacing a growing crop are refused; seeds do not need coins', async () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectBuild('rice-field');
    w.ctx.NightRaid.buildCell(0, 9, true);
    assert.equal(w.state.nightRaidLayout.cells.filter(c => c.type === 'rice-field').length, 1);
    assert.truthy(w.toasts.some(t => t.includes('Mỗi loại 1')));
    w.ctx.NightRaid.selectBuild('carrot');
    w.ctx.NightRaid.buildCell(1, 1, true);
    assert.equal(w.state.nightRaidLayout.cells.find(c => c.gx === 1 && c.gy === 1).type, 'tomato');
    w.state.coins = 2;
    await w.ctx.NightRaid.buildCell(11, 11, true);
    assert.truthy(w.state.nightRaidLayout.cells.some(c => c.type === 'carrot' && c.gx === 11 && c.gy === 11));
    assert.equal(w.state.coins, 2, 'planting does not spend the last coins');
  });
  test('removing a farm building refunds half its price', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectBuild('well'); w.ctx.NightRaid.buildCell(10, 4, true);
    assert.equal(w.state.coins, 8000);
    w.ctx.NightRaid.selectBuild('well'); w.ctx.NightRaid.buildCell(10, 4, true);
    assert.falsy(w.state.nightRaidLayout.cells.some(c => c.type === 'well'));
    assert.equal(w.state.coins, 8500);
  });
});

suite('builder farm: extra farm boards', () => {
  test('the Mở rộng tab sells three equally-priced plot styles up to three total; castle and farms stay on one map', () => {
    const w = mount({ appState: { coins: 35000 } }); w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectShopTab('expand');
    const shop = html(w);
    for (const name of ['Vườn Thành Đá', 'Vườn Hàng Hoa', 'Vườn Cỏ May Mắn']) assert.truthy(shop.includes(name), name + ' is available');
    assert.equal((shop.match(/10000 xu/g) || []).length, 3, 'all three choices have the same price');
    assert.equal((shop.match(/đã có 0\/3/g) || []).length, 3, 'the shared maximum is clear on every card');
    for (const art of ['stone', 'hedge', 'clover']) assert.truthy(shop.includes(`img/farm/farm-plot-${art}.webp`), art + ' preview');
    w.ctx.NightRaid.buyFarmPlot('stone',true);
    assert.equal(w.state.nightRaidLayout.farms.length, 1);
    assert.equal(w.state.coins, 25000);
    const out = html(w);
    assert.truthy(out.includes('NÔNG TRẠI 1 · KÉO'), 'the farm gets a drag handle on the shared meadow');
    assert.truthy(out.includes('nr-farm-docks') && (out.match(/data-farm-dock=/g)||[]).length===8, 'eight visible-on-drag square docks surround the castle');
    assert.truthy(out.includes('nr-farm-surface') && out.includes('data-farm-style="stone"'), 'the selected green style is painted on the farm');
    assert.falsy(out.includes('data-furrows') || out.includes('3 rãnh đất'), 'the rejected three brown furrows are gone');
    assert.truthy(/nr-free-grid size-6/.test(out), 'the new board is 6x6');
    assert.falsy(out.includes('nr-zone-chips'), 'there is no castle/farm tab switcher');
    assert.truthy(out.includes('aria-label="Phòng thủ"'), 'the unified shop keeps castle items available');
    assert.truthy(out.includes('data-zone="1"'), 'farm cells identify their destination zone');
    w.ctx.NightRaid.buyFarmPlot('hedge',true);
    assert.equal(w.state.nightRaidLayout.farms.length, 2);
    assert.equal(w.state.nightRaidLayout.farms[1].style, 'hedge');
    w.ctx.NightRaid.buyFarmPlot('clover',true);
    assert.equal(w.state.nightRaidLayout.farms.length, 3);
    assert.deepEqual(w.state.nightRaidLayout.farms.map(f => f.style), ['stone', 'hedge', 'clover']);
    w.state.coins = 5000;
    w.ctx.NightRaid.buyFarmPlot('stone',true);
    assert.equal(w.state.nightRaidLayout.farms.length, 3, 'the shared maximum prevents a fourth farm');
  });
  test('planting on a farm board lands in that farm; a defense cannot be placed there', async () => {
    const w = mount({ appState: { nightRaidLayout: { cells: [], soldiers: 0, dogLane: 2, farms: [{ cells: [] }] } } });
    w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectBuild('lettuce'); await w.ctx.NightRaid.buildCell(2, 2, true, 1);
    assert.equal(w.state.nightRaidLayout.farms[0].cells.length, 1);
    assert.equal(w.state.nightRaidLayout.cells.length, 0);
    w.ctx.NightRaid.selectBuild('stone-wall'); w.ctx.NightRaid.buildCell(0, 0, true, 1);
    assert.equal(w.state.nightRaidLayout.farms[0].cells.length, 1, 'no wall on a farm');
    assert.truthy(w.toasts.some(t => t.includes('chỉ trồng cây')));
    w.ctx.NightRaid.selectBuild('barn'); w.ctx.NightRaid.buildCell(4, 4, true, 1);
    assert.equal(w.state.nightRaidLayout.farms[0].cells.length, 2, 'a 2x2 barn fits at (4,4) on a 6x6 board');
    assert.truthy(w.state.nightRaidLayout.farms[0].cells.some(c => c.type === 'barn' && c.gx === 4 && c.gy === 4));
    assert.truthy(/nr-free-grid[^"]*size-12/.test(html(w)) || html(w).includes('Lưới xây dựng 12'), 'castle stays visible beside the farm');
  });
});
suite('builder farm: every screen points at today\'s tasks', () => {
  test('the task bar says how many tasks are left and what finishing does', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    assert.truthy(html(w).includes('Hôm nay 0/1 nhiệm vụ · xong hết là cây lớn thêm 1 ngày'));
    assert.truthy(html(w).includes('nrGoLearn()'), 'Vào học is offered');
    w.ctx.NightRaid.renderHome();
    assert.truthy(html(w).includes('xong hết là cây lớn thêm 1 ngày'), 'the home stage has the bar too');
  });
  test('no tasks → "chưa có nhiệm vụ"; all done → no space-taking banner; wilted → "đang héo"', () => {
    const none = mount({ appState: { dailyTask: { date: TODAY, tasks: [], allDone: false } } }); none.ctx.NightRaid.renderBuilder();
    assert.truthy(html(none).includes('Hôm nay chưa có nhiệm vụ'));
    assert.falsy(html(none).includes('nrGoLearn()'));
    const done = mount({ appState: { dailyTask: { date: TODAY, tasks: [{ id: 1, done: true }], allDone: true }, farmCtx: { today: TODAY, doneYesterday: false, doneToday: true } } }); done.ctx.NightRaid.renderBuilder();
    assert.falsy(html(done).includes('Cây đã lớn hôm nay'));
    assert.falsy(html(done).includes('nr-task-bar'), 'completed work leaves the estate viewport clear');
    const wilt = mount({ appState: { farmCtx: WILT } }); wilt.ctx.NightRaid.renderBuilder();
    assert.truthy(html(wilt).includes('Cây đang héo'));
  });
  // Found by review, 2026-09-04. Both screens used to flip the button on
  // anyWilted(layout) ALONE. The three coin fields run on their own 24h clock
  // and a barracks on finished task-days — none of them wilt — so a single
  // wilted crop anywhere, including on a private extra farm board, replaced
  // THU HOẠCH on the home AND the builder: the child could not collect a ready
  // field from its own button, under copy telling them nothing was
  // harvestable. The flip now needs anyWilted(layout) && !ready.
  const WILTED_CROP = { type: 'lettuce', gx: 3, gy: 1, uid: 'c-lettuc01', day: 3, at: TWO_AGO };
  const withField = readyAt => ({ appState: { farmCtx: WILT, nightRaidLayout: {
    cells: [WILTED_CROP, { type: 'rice-field', gx: 6, gy: 6, tier: 1, uid: 'p-rice0001', readyAt }],
    soldiers: 2, dogLane: 2, farms: [] } } });
  for (const [screen, render] of [['builder', w => w.ctx.NightRaid.renderBuilder()], ['home', w => w.ctx.NightRaid.renderHome()]]) {
    test('a wilted crop does not hide the harvest button for a ready field (' + screen + ')', () => {
      const w = mount(withField(0)); render(w);
      const out = html(w);
      assert.truthy(out.includes('THU HOẠCH 1'), 'the ready rice field is still collectable: ' + (out.match(/THU HOẠCH \d+|ĐANG SẢN XUẤT|VÀO HỌC ĐỂ CÂY TƯƠI/) || [''])[0]);
      assert.truthy(/nr-collect-all[^"]*"[^>]*onclick="nrCollectResources\(\)"/.test(out), 'and the button harvests');
      assert.falsy(out.includes('VÀO HỌC ĐỂ CÂY TƯƠI'), 'the study CTA is for when nothing can be collected');
      assert.falsy(/class="nr-collect-all[^"]*\bwilted\b/.test(out));
    });
    test('with nothing ready at all a wilted crop still asks the child to study (' + screen + ')', () => {
      const w = mount(withField(Date.now() + 3600000)); render(w);
      const out = html(w);
      assert.truthy(out.includes('VÀO HỌC ĐỂ CÂY TƯƠI'));
      assert.truthy(/nr-collect-all[^"]*\bwilted\b[^>]*onclick="nrGoLearn\(\)"/.test(out), 'the button leads to the tasks');
      assert.falsy(/THU HOẠCH \d/.test(out), 'a wilted crop never counts as harvestable');
    });
  }
  // Spec 5.1.3: tapping a wilted plant shows the reason AND a Vào học button.
  // A toast cannot carry a button, so the screen carries the guarantee: while
  // anything is wilted there is always a Vào học somewhere. It was not: the
  // task bar only offered one while there were unfinished tasks, and the
  // harvest button only becomes VÀO HỌC ĐỂ CÂY TƯƠI when nothing at all is
  // ready — so a child with a ripe rice field and either no tasks assigned or
  // all of them already done stared at a dead garden with nothing to press.
  const wiltedPlusReadyField = task => ({ appState: { farmCtx: WILT, dailyTask: task, nightRaidLayout: {
    cells: [WILTED_CROP, { type: 'rice-field', gx: 6, gy: 6, tier: 1, uid: 'p-rice0001', readyAt: 0 }],
    soldiers: 2, dogLane: 2, farms: [] } } });
  const TASK_STATES = [
    ['no tasks assigned today', { date: TODAY, tasks: [], allDone: false }],
    ['some tasks done', { date: TODAY, tasks: [{ id: 1, done: true }, { id: 2, done: false }], allDone: false }],
    ['every task done', { date: TODAY, tasks: [{ id: 1, done: true }], allDone: true }],
  ];
  for (const [screen, render] of [['builder', w => w.ctx.NightRaid.renderBuilder()], ['home', w => w.ctx.NightRaid.renderHome()]]) {
    for (const [label, task] of TASK_STATES) {
      test('a wilted garden always offers Vào học — ' + label + ' (' + screen + ')', () => {
        const w = mount(wiltedPlusReadyField(task)); render(w);
        const out = html(w);
        assert.truthy(out.includes('THU HOẠCH 1'), 'the ripe field still has its own harvest button');
        assert.truthy(/onclick="nrGoLearn\(\)"/.test(out), 'and the child still has a way into today\'s tasks');
      });
    }
  }
  test('tapping a wilted crop says why AND where the Vào học button is', () => {
    const w = mount({ appState: { farmCtx: WILT, nightRaidLayout: { cells: [WILTED_CROP], soldiers: 0, dogLane: 2, farms: [] } } });
    w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.gridCell(3, 1);
    const toast = w.toasts[w.toasts.length - 1] || '';
    assert.truthy(toast.includes('héo'), 'the reason: ' + toast);
    assert.truthy(toast.includes('Vào học'), 'and where the button is: ' + toast);
  });
  test('Vào học leaves Night Raid and opens the Daily Task screen', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    w.ctx.nrGoLearn();
    assert.truthy(w.calls.some(c => c[0] === 'dailyTask.open'));
  });
});

suite('builder farm: replant what was just harvested', () => {
  test('replant re-buys the same seeds on the same cells in one PUT, then forgets the list', async () => {
    const reply = { ok: true, data: { layout: { cells: [{ type: 'wood-fence', gx: 3, gy: 7, tier: 1 }], farms: [{ cells: [] }] }, coins: 9026, collectedCoins: 26, collectedSoldiers: 0,
      harvested: [{ type: 'tomato', gx: 1, gy: 1, zone: 0 }, { type: 'lettuce', gx: 0, gy: 0, zone: 1 }], wilted: false, dayCount: 6, ctx: FRESH } };
    const w = mount({ api: (p, opts, fallback) => p === 'night-raid/collect' ? Promise.resolve(reply) : fallback(p, opts) });
    w.ctx.NightRaid.renderBuilder();
    await w.ctx.NightRaid.collectResources();
    assert.truthy(html(w).includes('2/2 ô có hạt'));
    await w.ctx.NightRaid.replant();
    const L = w.state.nightRaidLayout;
    const tomato = L.cells.find(c => c.type === 'tomato' && c.gx === 1 && c.gy === 1);
    const lettuce = L.farms[0].cells.find(c => c.type === 'lettuce' && c.gx === 0 && c.gy === 0);
    assert.truthy(tomato && lettuce, 'both seeds are back where they were');
    assert.equal(tomato.day, 6, 'planted at the dayCount the server just sent');
    assert.equal(w.state.coins, 9026, 'replanting spends seeds, not coins');
    assert.equal(w.calls.filter(c => c[0] === 'night-raid/plant').length, 2);
    assert.falsy(html(w).includes('TRỒNG LẠI NHƯ CŨ'), 'the offer is spent');
  });
  test('replant is disabled and says how much is missing when the child is short', async () => {
    const reply = { ok: true, data: { layout: { cells: [], farms: [] }, coins: 3, collectedCoins: 120, collectedSoldiers: 0, harvested: [{ type: 'pumpkin', gx: 2, gy: 2, zone: 0 }], wilted: false, dayCount: 6, ctx: FRESH } };
    const noSeeds = { progress: 0, goal: 2, next: { id: 'lettuce', name: 'Rau cải', days: 1 }, inventory: Farm.CROPS.map(c => ({ id: c.id, quantity: 0 })), recent: [] };
    const w = mount({ appState: { dailyTask: { date: TODAY, tasks: [], allDone: false, seeds: noSeeds } }, api: (p, opts, fallback) => p === 'night-raid/collect' ? Promise.resolve(reply) : fallback(p, opts) });
    w.ctx.NightRaid.renderBuilder();
    await w.ctx.NightRaid.collectResources();
    assert.truthy(/nr-replant[^>]*disabled/.test(html(w)));
    assert.truthy(html(w).includes('Kho không còn hạt phù hợp'));
    await w.ctx.NightRaid.replant();
    assert.equal(w.state.nightRaidLayout.cells.length, 0, 'nothing planted');
  });
});

suite('builder farm: replant consumes only seeds the server plants', () => {
  test('a blocked cell is skipped and its seed remains untouched', async () => {
    const reply = { ok: true, data: { layout: { cells: [{ type: 'stone-wall', gx: 1, gy: 1, tier: 1 }], farms: [] },
      coins: 9000, collectedCoins: 138, collectedSoldiers: 0,
      // (1,1) is where the wall now stands; (5,5) is open ground.
      harvested: [{ type: 'pumpkin', gx: 1, gy: 1, zone: 0 }, { type: 'tomato', gx: 5, gy: 5, zone: 0 }],
      wilted: false, dayCount: 6, ctx: FRESH } };
    const w = mount({ api: (p, opts, fallback) => p === 'night-raid/collect' ? Promise.resolve(reply)
      : p === 'night-raid/plant' && opts.body.gx === 1 ? Promise.resolve({ ok: false, data: { error: 'Ô này đã có công trình' } })
      : fallback(p, opts) });
    w.ctx.NightRaid.renderBuilder();
    await w.ctx.NightRaid.collectResources();
    assert.truthy(html(w).includes('2/2 ô có hạt'));
    await w.ctx.NightRaid.replant();
    const cells = w.state.nightRaidLayout.cells;
    assert.truthy(cells.some(c => c.type === 'tomato' && c.gx === 5 && c.gy === 5), 'the free cell is replanted');
    assert.falsy(cells.some(c => c.type === 'pumpkin'), 'the blocked cell is not');
    assert.equal(w.state.coins, 9000, 'neither successful nor refused planting spends coins');
    assert.equal(w.state.dailyTask.seeds.inventory.find(x => x.id === 'pumpkin').quantity, 3, 'the refused seed remains');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
