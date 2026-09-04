# Nông trại theo ngày nhiệm vụ — kế hoạch cài đặt

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bé trồng cây ngay trong khu vườn lâu đài; cây lớn một nấc mỗi ngày bé xong hết Daily Task, héo khi bỏ ngày, hái ra xu; hạt, công trình nông trại và "Nông trại riêng" mua trong SHOP đang có; trại lính ra lính theo ngày nhiệm vụ.

**Architecture:** Không bảng mới, không API mới. Món nông trại nằm trong `night_raid_homes.layout_json` cùng công trình lâu đài, đi qua `GET/PUT /api/night-raid/home` và `POST /api/night-raid/collect`. Số ngày nông trại `dayCount` đếm từ `daily_task_rewards`; trạng thái héo tính từ hai ngày gần nhất của bảng đó. Luật thuần nằm ở `js/farm-rules.js` (mới) và `js/night-raid-rules.js`, dùng chung máy bé và server. Màn xây nhà đang có nhận thêm tab SHOP, chip chuyển khu, thanh nhiệm vụ. Trang Daily Task nhận thêm dải vườn từ trường `farm` của `GET /api/me/daily-tasks`.

**Tech Stack:** Vanilla JS UMD, Cloudflare Pages Functions + D1, Node 22 (`node:sqlite` cho `tests/d1-mock.js`), `tests/pages-harness.js` để chạy handler thật, `tests/domshim.js` cho test màn hình, Python 3 + Pillow cho `scripts/build-farm-art.py`.

**Spec:** `docs/superpowers/specs/2026-09-04-daily-task-farm-design.md`. **Kế hoạch đi trước:** `docs/superpowers/plans/2026-09-04-remove-bot-modes.md` (làm xong trước, cùng nhánh).

**Nhánh:** `feat/daily-task-farm` tách từ `master`. Stage bằng đường dẫn rõ, không `git add -A`. Không bump phiên bản bằng tay. Không `git push`.

---

## Bản đồ file

| File | Trách nhiệm |
|---|---|
| `js/farm-rules.js` (mới) | Bảng cây, công trình nông trại, nông trại riêng; `progress`, `isWilted`, `spriteFor`, `farmValue`, `barracksReady`, `spriteNames`. Không DOM, không Date. |
| `js/farm-art-manifest.js` (mới) | Danh sách 48 file hình trong `img/farm/` với cỡ và mô tả. |
| `js/night-raid-rules.js` | `itemById`, `footprintFor` nhận món nông trại; `normalizeLayout(value, opts)` nhận ô nông trại, `farms`, trại lính `lastDay`, ruộng `buyMax`; `createState` không đổ khi gặp ô nông trại; export `itemById`, `farmRules`. |
| `functions/api/_farm.js` (mới) | `dayCount`, `wiltCtx`, `farmClock`, `farmSummary`. |
| `functions/api/night-raid/home.js` | GET trả `dayCount`, `ctx`; PUT đóng dấu `day/at/lastDay` từ server, áp `buyMax`, giữ `farms`. |
| `functions/api/night-raid/collect.js` | Thu cây chín tươi, lính theo ngày, ruộng theo giờ; trả `harvested`, `wilted`, `dayCount`, `ctx`. |
| `functions/api/me/daily-tasks.js` | Thêm `farm` khi `allow_bot`. |
| `js/night-raid.js` | Vẽ cây theo ngày và héo; tab SHOP; chip khu; lưới 6×6; mua hạt, công trình, nông trại riêng; dỡ; thanh nhiệm vụ; THU HOẠCH đổi trạng thái; TRỒNG LẠI NHƯ CŨ. |
| `js/daily-task.js` | Hero, dải vườn, thẻ Home, khoảnh khắc thưởng nhắc vườn. |
| `css/styles.css` | Tab SHOP, chip khu, lưới 6×6, huy hiệu héo, thanh nhiệm vụ, lớp héo, dải vườn. |
| `index.html`, `sw.js` | Nạp `farm-rules.js` trước `night-raid-rules.js`; precache hai file và 48 hình. |
| `scripts/build-farm-art.py` (mới) | Dựng WebP từ ảnh gốc theo bản kê; có chế độ `--placeholder` vẽ hình tạm để pipeline chạy trước khi có tranh thật. |
| `tests/pages-harness.js` | Thêm `db/018-daily-tasks.sql`, `db/019-armory-swords.sql` vào `SQL_FILES`. |
| Tests mới | `tests/farm-rules.test.js`, `tests/night-raid-layout-farm.test.js`, `tests/farm-server.test.js`, `tests/farm-art.test.js`, `tests/night-raid-builder-farm.test.js`, `tests/daily-task-farm-ui.test.js`. |
| Tests sửa | `tests/night-raid-rules.test.js` (giới hạn trại, `productionMs`), `tests/verify/client.js` (SHOP có tab Hạt giống). |

Ghi chú lệch spec: spec 4.2 nói nạp `farm-rules.js` qua `lazy-data.js`. Không được, vì `night-raid-rules.js` nạp ngay lúc mở app và cần `FarmRules`. Hai file này nhỏ (dưới 10 KB) nên nạp thẳng trong `index.html`.

## Quy ước chung cho mọi task

- Test: `const { suite, test, assert } = require('./harness');` với `assert.equal/deepEqual/truthy/falsy/contains/throws`. File test kết bằng `if (require.main === module) require('./harness').runAll().then(code => process.exit(code));`.
- Server test: `const { createWorld, loadModule } = require('./pages-harness');` `world.createUser({ allowBot: true })`, `world.call(handler, { url, method, token, body })`, `world.db` là `node:sqlite` để chèn dữ liệu thẳng.
- Ngày GMT+7: `const gmt7 = ms => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);`
- Chèn một ngày nhiệm vụ đã xong: `world.db.prepare('INSERT INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?, ?, 200, 1)').run(uid, date)`.

---

## Phần A — Luật thuần

### Task 1: `js/farm-rules.js`

**Files:**
- Create: `js/farm-rules.js`
- Test: `tests/farm-rules.test.js`

- [ ] **Step 1: Viết test (đỏ)**

```js
// tests/farm-rules.test.js — the farm's pure rules: growth by task-days, wilt,
// sprite names, value. No DOM, no clock: dayCount and ctx are passed in.
const { suite, test, assert } = require('./harness');
const path = require('path');
const F = require(path.join(__dirname, '..', 'js', 'farm-rules.js'));

suite('farm rules: catalog', () => {
  test('six crops, ordered by days, priced as the spec table', () => {
    assert.deepEqual(F.CROPS.map(c => [c.id, c.days, c.price, c.yield]), [
      ['lettuce', 1, 3, 8], ['tomato', 2, 5, 18], ['carrot', 3, 8, 30],
      ['rice', 4, 10, 45], ['rose', 6, 15, 80], ['pumpkin', 8, 20, 120],
    ]);
    for (const c of F.CROPS) assert.equal(c.kind, 'crop');
  });
  test('eight farm buildings with footprints and prices', () => {
    assert.deepEqual(F.FARM_BUILDINGS.map(b => [b.id, b.price, b.footprint]), [
      ['fence', 300, 1], ['fruit-tree', 800, 1], ['well', 1000, 1], ['chicken-coop', 3000, 2],
      ['barn', 5000, 2], ['windmill', 8000, 2], ['cow-shed', 12000, 2], ['farmhouse', 20000, 2],
    ]);
    for (const b of F.FARM_BUILDINGS) assert.equal(b.kind, 'farm');
  });
  test('the extra farm plot is 10000 xu, 6x6, at most three', () => {
    assert.deepEqual([F.FARM_PLOT.price, F.FARM_PLOT.size, F.FARM_PLOT.max], [10000, 6, 3]);
  });
  test('byId finds crops and buildings, nothing else', () => {
    assert.equal(F.byId('tomato').days, 2);
    assert.equal(F.byId('barn').price, 5000);
    assert.equal(F.byId('stone-wall'), null);
    assert.equal(F.byId(''), null);
    assert.truthy(Object.isFrozen(F.CROPS) && Object.isFrozen(F.CROPS[0]));
  });
});

suite('farm rules: growth counts task-days, not hours', () => {
  test('a crop planted at day 12 is ripe at day 12 + days', () => {
    const cell = { type: 'carrot', day: 12 };
    assert.deepEqual(F.progress(cell, 12), { g: 0, days: 3, ripe: false, left: 3 });
    assert.deepEqual(F.progress(cell, 14), { g: 2, days: 3, ripe: false, left: 1 });
    assert.deepEqual(F.progress(cell, 15), { g: 3, days: 3, ripe: true, left: 0 });
    assert.deepEqual(F.progress(cell, 40), { g: 3, days: 3, ripe: true, left: 0 }, 'g is capped at days');
  });
  test('lettuce planted this morning is ripe the moment today is done', () => {
    assert.truthy(F.progress({ type: 'lettuce', day: 5 }, 6).ripe);
  });
  test('a missing or negative day reads as zero; non-crops have no progress', () => {
    assert.equal(F.progress({ type: 'pumpkin' }, 3).g, 3);
    assert.equal(F.progress({ type: 'pumpkin', day: -4 }, 3).g, 3);
    assert.equal(F.progress({ type: 'well' }, 3), null);
  });
});

suite('farm rules: wilt', () => {
  const ctx = (doneYesterday, doneToday) => ({ today: '2026-09-04', doneYesterday, doneToday });
  const planted = (at) => ({ type: 'tomato', day: 1, at });
  test('planted before today, yesterday missed, today not done → wilted', () => {
    assert.truthy(F.isWilted(planted('2026-09-03'), ctx(false, false)));
    assert.truthy(F.isWilted(planted('2026-08-20'), ctx(false, false)));
  });
  test('done today revives; done yesterday keeps it fresh this morning', () => {
    assert.falsy(F.isWilted(planted('2026-09-03'), ctx(false, true)));
    assert.falsy(F.isWilted(planted('2026-09-03'), ctx(true, false)));
  });
  test('planted today never wilts today', () => {
    assert.falsy(F.isWilted(planted('2026-09-04'), ctx(false, false)));
  });
  test('no ctx, bad dates or non-crops are never wilted', () => {
    assert.falsy(F.isWilted(planted('2026-09-03'), null));
    assert.falsy(F.isWilted(planted(''), ctx(false, false)));
    assert.falsy(F.isWilted({ type: 'well', at: '2026-09-01' }, ctx(false, false)));
  });
});

suite('farm rules: sprites', () => {
  const fresh = { today: '2026-09-04', doneYesterday: true, doneToday: false };
  const wilt = { today: '2026-09-04', doneYesterday: false, doneToday: false };
  test('one file per growth day, the shared sprout at day zero', () => {
    const c = { type: 'pumpkin', day: 10, at: '2026-09-01' };
    assert.equal(F.spriteFor(c, 10, fresh), 'img/farm/sprout.webp');
    assert.equal(F.spriteFor(c, 11, fresh), 'img/farm/pumpkin-day1.webp');
    assert.equal(F.spriteFor(c, 18, fresh), 'img/farm/pumpkin-day8.webp');
    assert.equal(F.spriteFor(c, 30, fresh), 'img/farm/pumpkin-day8.webp', 'ripe waits, no day9');
  });
  test('wilted: shared wilted sprout, then young below half, old from half up', () => {
    const c = { type: 'pumpkin', day: 10, at: '2026-09-01' };
    assert.equal(F.spriteFor(c, 10, wilt), 'img/farm/sprout-wilted.webp');
    assert.equal(F.spriteFor(c, 13, wilt), 'img/farm/pumpkin-wilted-young.webp');
    assert.equal(F.spriteFor(c, 14, wilt), 'img/farm/pumpkin-wilted-old.webp');
    assert.equal(F.spriteFor({ type: 'lettuce', day: 0, at: '2026-09-01' }, 1, wilt), 'img/farm/lettuce-wilted-old.webp');
  });
  test('farm buildings draw their own file; unknown types draw nothing', () => {
    assert.equal(F.spriteFor({ type: 'barn' }, 0, null), 'img/farm/barn.webp');
    assert.equal(F.spriteFor({ type: 'stone-wall' }, 0, null), null);
  });
  test('spriteNames lists every file spriteFor can ask for: 46 names', () => {
    const names = F.spriteNames();
    assert.equal(names.length, 46);
    assert.equal(new Set(names).size, 46, 'no duplicates');
    for (const n of ['sprout', 'sprout-wilted', 'lettuce-day1', 'rose-day6', 'pumpkin-wilted-old', 'farmhouse']) assert.contains(names, n);
  });
});

suite('farm rules: value and barracks', () => {
  test('farmValue sums farm buildings across the castle grid and every extra farm', () => {
    const layout = { cells: [{ type: 'well' }, { type: 'stone-wall' }, { type: 'tomato' }],
      farms: [{ cells: [{ type: 'barn' }] }, { cells: [{ type: 'fence' }, { type: 'fence' }] }] };
    assert.equal(F.farmValue(layout), 1000 + 5000 + 600);
    assert.equal(F.farmValue({}), 0);
  });
  test('barracks are ready when a task-day passed since the last collect', () => {
    assert.falsy(F.barracksReady({ lastDay: 5 }, 5));
    assert.truthy(F.barracksReady({ lastDay: 5 }, 6));
    assert.falsy(F.barracksReady({ readyAt: 123 }, 6), 'a legacy cell without lastDay waits for the server');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node tests/farm-rules.test.js`
Expected: FAIL — `Cannot find module '.../js/farm-rules.js'`.

- [ ] **Step 3: Viết `js/farm-rules.js`**

```js
// Farm rules — pure data and predicates shared by the browser (js/night-raid.js,
// js/daily-task.js) and the server (functions/api/_farm.js, home.js,
// collect.js). No DOM, no Date: callers pass dayCount (how many days the child
// has finished every daily task, counted from daily_task_rewards) and the wilt
// context { today, doneYesterday, doneToday }.
//
// A plant grows one step per finished task-day, never per hour. It wilts when
// the child skipped yesterday and has not finished today; finishing today
// revives it. Wilt is a picture and a lock on harvesting — never lost progress.
var FarmRules = (() => {
  'use strict';
  const int = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(Number(n) || 0)));
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const freeze = list => Object.freeze(list.map(o => Object.freeze(o)));

  const CROPS = freeze([
    { id: 'lettuce', kind: 'crop', name: { en: 'Lettuce', vi: 'Rau cải' },  days: 1, price: 3,  yield: 8 },
    { id: 'tomato',  kind: 'crop', name: { en: 'Tomato',  vi: 'Cà chua' },  days: 2, price: 5,  yield: 18 },
    { id: 'carrot',  kind: 'crop', name: { en: 'Carrot',  vi: 'Cà rốt' },   days: 3, price: 8,  yield: 30 },
    { id: 'rice',    kind: 'crop', name: { en: 'Rice',    vi: 'Lúa' },      days: 4, price: 10, yield: 45 },
    { id: 'rose',    kind: 'crop', name: { en: 'Rose',    vi: 'Hoa hồng' }, days: 6, price: 15, yield: 80 },
    { id: 'pumpkin', kind: 'crop', name: { en: 'Pumpkin', vi: 'Bí ngô' },   days: 8, price: 20, yield: 120 },
  ]);
  // Decoration only: no attack, no defense, no production. They are what the
  // learning buys, so homeLevel and combatPower must never see them — they
  // are not in NightRaidRules.DEFENSES and that is deliberate.
  const FARM_BUILDINGS = freeze([
    { id: 'fence',        kind: 'farm', name: { en: 'Farm fence',   vi: 'Hàng rào gỗ nông trại' }, price: 300,   footprint: 1 },
    { id: 'fruit-tree',   kind: 'farm', name: { en: 'Fruit tree',   vi: 'Cây ăn quả' },            price: 800,   footprint: 1 },
    { id: 'well',         kind: 'farm', name: { en: 'Well',         vi: 'Giếng' },                 price: 1000,  footprint: 1 },
    { id: 'chicken-coop', kind: 'farm', name: { en: 'Chicken coop', vi: 'Chuồng gà' },             price: 3000,  footprint: 2 },
    { id: 'barn',         kind: 'farm', name: { en: 'Barn',         vi: 'Nhà kho' },               price: 5000,  footprint: 2 },
    { id: 'windmill',     kind: 'farm', name: { en: 'Windmill',     vi: 'Cối xay gió' },           price: 8000,  footprint: 2 },
    { id: 'cow-shed',     kind: 'farm', name: { en: 'Cow shed',     vi: 'Chuồng bò' },             price: 12000, footprint: 2 },
    { id: 'farmhouse',    kind: 'farm', name: { en: 'Farmhouse',    vi: 'Nhà nông dân' },          price: 20000, footprint: 2 },
  ]);
  const FARM_PLOT = Object.freeze({ id: 'farm-plot', kind: 'plot', name: { en: 'Extra farm', vi: 'Nông trại riêng' }, price: 10000, size: 6, max: 3 });
  const ITEMS = Object.freeze(CROPS.concat(FARM_BUILDINGS));

  function byId(id) { return ITEMS.find(i => i.id === id) || null; }
  function cropById(id) { return CROPS.find(c => c.id === id) || null; }
  function isCrop(cell) { return !!cropById(cell && cell.type); }
  function isFarmBuilding(cell) { return !!FARM_BUILDINGS.find(b => b.id === (cell && cell.type)); }
  function footprintFor(item) { return item && item.footprint === 2 ? 2 : 1; }
  function art(name) { return 'img/farm/' + name + '.webp'; }

  // g = finished task-days since planting, capped at the crop's days.
  function progress(cell, dayCount) {
    const crop = cropById(cell && cell.type);
    if (!crop) return null;
    const g = Math.min(crop.days, Math.max(0, int(dayCount, 0, 1e9) - int(cell.day, 0, 1e9)));
    return { g, days: crop.days, ripe: g >= crop.days, left: crop.days - g };
  }
  function isWilted(cell, ctx) {
    if (!cropById(cell && cell.type) || !ctx) return false;
    if (!DATE_RE.test(String(cell.at || '')) || !DATE_RE.test(String(ctx.today || ''))) return false;
    return cell.at < ctx.today && !ctx.doneYesterday && !ctx.doneToday;
  }
  function spriteFor(cell, dayCount, ctx) {
    const crop = cropById(cell && cell.type);
    if (!crop) { const b = FARM_BUILDINGS.find(x => x.id === (cell && cell.type)); return b ? art(b.id) : null; }
    const p = progress(cell, dayCount), wilted = isWilted(cell, ctx);
    if (p.g === 0) return art(wilted ? 'sprout-wilted' : 'sprout');
    if (wilted) return art(crop.id + (p.g * 2 < crop.days ? '-wilted-young' : '-wilted-old'));
    return art(crop.id + '-day' + p.g);
  }
  function allCells(layout) {
    const farms = (layout && Array.isArray(layout.farms)) ? layout.farms : [];
    return [].concat((layout && layout.cells) || [], ...farms.map(f => (f && f.cells) || []));
  }
  function farmValue(layout) {
    return allCells(layout).reduce((sum, c) => {
      const b = FARM_BUILDINGS.find(x => x.id === (c && c.type));
      return sum + (b ? b.price : 0);
    }, 0);
  }
  // A barracks pays one soldier per finished task-day since the last collect.
  // A legacy cell that still carries readyAt and no lastDay is not ready: the
  // server converts it on its next read (night-raid-rules normalizeLayout).
  function barracksReady(cell, dayCount) {
    return Number.isFinite(+(cell && cell.lastDay)) && int(dayCount, 0, 1e9) > int(cell.lastDay, 0, 1e9);
  }
  // Every sprite spriteFor can ever name. js/farm-art-manifest.js is checked
  // against this list so no plant can ever point at a file that is not there.
  function spriteNames() {
    const names = ['sprout', 'sprout-wilted'];
    for (const c of CROPS) {
      for (let g = 1; g <= c.days; g++) names.push(c.id + '-day' + g);
      names.push(c.id + '-wilted-young', c.id + '-wilted-old');
    }
    for (const b of FARM_BUILDINGS) names.push(b.id);
    return names;
  }

  return Object.freeze({ CROPS, FARM_BUILDINGS, FARM_PLOT, ITEMS, DATE_RE, byId, cropById, isCrop, isFarmBuilding,
    footprintFor, art, progress, isWilted, spriteFor, allCells, farmValue, barracksReady, spriteNames });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = FarmRules;
```

- [ ] **Step 4: Chạy, xác nhận xanh**

Run: `node tests/farm-rules.test.js`
Expected: PASS toàn bộ.

- [ ] **Step 5: Nạp file và precache**

`index.html`: chèn ngay **trước** dòng `<script src="js/night-raid-rules.js"></script>`:
```html
    <script src="js/farm-rules.js"></script>
```
`sw.js`: chèn ngay trước dòng `'/js/night-raid-rules.js',`:
```js
  '/js/farm-rules.js',
```

Run: `node tests/extra-coverage.test.js && node tests/gen-app-integrity.test.js`
Expected: PASS (mọi `js/*.js` có trong ASSETS và ngược lại).

- [ ] **Step 6: Commit**

```bash
git add js/farm-rules.js tests/farm-rules.test.js index.html sw.js
git commit -m "feat(farm): pure farm rules — crops grow per finished task-day, wilt, sprites

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: `night-raid-rules.js` nhận món nông trại, `farms`, trại lính theo ngày, ruộng `buyMax`

**Files:**
- Modify: `js/night-raid-rules.js` (đầu module, `DEFENSES`, `footprintFor`, `normalizeLayout`, `createState`, export)
- Modify: `tests/night-raid-rules.test.js:19-41`
- Test: `tests/night-raid-layout-farm.test.js`

- [ ] **Step 1: Viết test mới (đỏ)**

```js
// tests/night-raid-layout-farm.test.js — the castle layout now carries farm
// items and extra farm plots, and the combat/home-level maths ignores them.
const { suite, test, assert } = require('./harness');
const path = require('path');
const R = require(path.join(__dirname, '..', 'js', 'night-raid-rules.js'));

const wall = (gx, gy) => ({ type: 'stone-wall', gx, gy, tier: 1 });

suite('layout: farm items live beside defenses', () => {
  test('itemById answers both catalogs', () => {
    assert.equal(R.itemById('stone-wall').price, 2000);
    assert.equal(R.itemById('tomato').days, 2);
    assert.equal(R.itemById('barn').footprint, 2);
    assert.equal(R.itemById('nope'), null);
    assert.equal(R.footprintFor('barn'), 2);
    assert.equal(R.footprintFor('tomato'), 1);
  });
  test('a crop keeps type, gx, gy, uid, day, at — and nothing combat-shaped', () => {
    const layout = R.normalizeLayout({ cells: [{ type: 'tomato', gx: 1, gy: 1, uid: 'c-abcdefgh', day: 12, at: '2026-09-04', tier: 3, lane: 2 }] });
    assert.deepEqual(layout.cells, [{ type: 'tomato', gx: 1, gy: 1, uid: 'c-abcdefgh', day: 12, at: '2026-09-04' }]);
    assert.equal(layout.gridVersion, 3);
  });
  test('a crop with a bad date gets opts.today; without opts it gets no date', () => {
    const cell = { type: 'rice', gx: 0, gy: 0, uid: 'c-abcdefgh', day: 2, at: 'yesterday' };
    assert.equal(R.normalizeLayout({ cells: [cell] }, { dayCount: 5, today: '2026-09-04' }).cells[0].at, '2026-09-04');
    assert.equal(R.normalizeLayout({ cells: [cell] }).cells[0].at, undefined);
  });
  test('unknown ids are dropped; farm items may not overlap defenses or each other', () => {
    const layout = R.normalizeLayout({ cells: [wall(0, 0), { type: 'well', gx: 0, gy: 0 }, { type: 'barn', gx: 0, gy: 5 }, { type: 'fence', gx: 1, gy: 6 }, { type: 'dragon', gx: 7, gy: 7 }] });
    const at = (gx, gy) => layout.cells.find(c => c.gx === gx && c.gy === gy);
    assert.equal(at(0, 0).type, 'stone-wall');
    assert.truthy(layout.cells.some(c => c.type === 'well'), 'the well is moved to free ground, not dropped');
    assert.truthy(layout.cells.find(c => c.type === 'well').gx + layout.cells.find(c => c.type === 'well').gy > 0);
    assert.falsy(layout.cells.some(c => c.type === 'dragon'));
    const barn = layout.cells.find(c => c.type === 'barn'), fence = layout.cells.find(c => c.type === 'fence');
    assert.falsy(fence.gx >= barn.gx && fence.gx < barn.gx + 2 && fence.gy >= barn.gy && fence.gy < barn.gy + 2, 'the fence was placed inside the barn');
  });
});

suite('layout: extra farm plots', () => {
  test('at most three farms, each a 6x6 board of farm items only', () => {
    const farms = [
      { cells: [{ type: 'pumpkin', gx: 5, gy: 5, uid: 'c-11111111', day: 1, at: '2026-09-01' }, { type: 'stone-wall', gx: 0, gy: 0 }, { type: 'rice-field', gx: 2, gy: 2 }, { type: 'barn', gx: 9, gy: 9 }] },
      { cells: [] }, { cells: [] }, { cells: [{ type: 'well', gx: 0, gy: 0 }] },
    ];
    const layout = R.normalizeLayout({ cells: [], farms });
    assert.equal(layout.farms.length, 3, 'the fourth farm is cut');
    const f0 = layout.farms[0].cells;
    assert.falsy(f0.some(c => c.type === 'stone-wall'), 'no defenses in a farm');
    assert.falsy(f0.some(c => c.type === 'rice-field'), 'no old producers in a farm');
    assert.truthy(f0.some(c => c.type === 'pumpkin'));
    const barn = f0.find(c => c.type === 'barn');
    assert.truthy(barn && barn.gx <= 4 && barn.gy <= 4, 'a 2x2 barn is pulled inside the 6x6 board');
  });
  test('a layout without farms normalizes to farms: []', () => {
    assert.deepEqual(R.normalizeLayout({ cells: [] }).farms, []);
    assert.deepEqual(R.normalizeLayout(undefined).farms, []);
  });
});

suite('layout: producers', () => {
  test('barracks carry lastDay; a legacy readyAt converts only when the server passes dayCount', () => {
    const legacy = { type: 'training-barracks', gx: 0, gy: 0, uid: 'p-abcdefgh', readyAt: 5678 };
    const noOpts = R.normalizeLayout({ cells: [legacy] }).cells[0];
    assert.equal(noOpts.lastDay, undefined);
    assert.equal(noOpts.readyAt, 5678, 'kept for the server to convert');
    const server = R.normalizeLayout({ cells: [legacy] }, { dayCount: 9, today: '2026-09-04' }).cells[0];
    assert.equal(server.lastDay, 9);
    assert.equal(server.readyAt, undefined);
    const stamped = R.normalizeLayout({ cells: [{ type: 'training-barracks', gx: 0, gy: 0, uid: 'p-abcdefgh', lastDay: 4, readyAt: 1 }] }, { dayCount: 9 }).cells[0];
    assert.equal(stamped.lastDay, 4, 'an existing lastDay wins over dayCount');
    assert.equal(stamped.readyAt, undefined);
  });
  test('fields keep their 24h readyAt untouched', () => {
    const cell = R.normalizeLayout({ cells: [{ type: 'rice-field', gx: 0, gy: 0, uid: 'p-abcdefgh', readyAt: 1234 }] }, { dayCount: 9, today: '2026-09-04' }).cells[0];
    assert.equal(cell.readyAt, 1234);
    assert.equal(cell.lastDay, undefined);
  });
  test('a child who already owns four rice fields keeps all four; ten barracks are allowed', () => {
    const cells = [];
    for (let i = 0; i < 4; i++) cells.push({ type: 'rice-field', gx: i * 2, gy: 0, uid: 'rice-id-' + i, readyAt: 1 });
    for (let i = 0; i < 11; i++) cells.push({ type: 'training-barracks', gx: (i % 6) * 2, gy: 2 + Math.floor(i / 6) * 2, uid: 'barracks-' + i, readyAt: 1 });
    const layout = R.normalizeLayout({ cells });
    assert.equal(layout.cells.filter(c => c.type === 'rice-field').length, 4);
    assert.equal(layout.cells.filter(c => c.type === 'training-barracks').length, 10);
    assert.equal(R.defenseById('rice-field').buyMax, 1);
    assert.equal(R.defenseById('training-barracks').perTaskDay, true);
  });
});

suite('layout: combat and home level ignore the farm', () => {
  const base = { cells: [wall(0, 6), wall(1, 6)], soldiers: 2 };
  const farmy = { cells: base.cells.concat([{ type: 'farmhouse', gx: 8, gy: 8 }, { type: 'pumpkin', gx: 2, gy: 2, uid: 'c-11111111', day: 0, at: '2026-09-01' }]), soldiers: 2,
    farms: [{ cells: [{ type: 'windmill', gx: 0, gy: 0 }] }] };
  test('homeLevel and combatPower are unchanged by farm items', () => {
    assert.equal(R.homeLevel(farmy, 10), R.homeLevel(base, 10));
    assert.deepEqual(R.combatPower(farmy, 10, 2, 0), R.combatPower(base, 10, 2, 0));
  });
  test('createState does not throw on a layout with crops and buildings', () => {
    const target = Object.assign(R.trainingTarget(2), { layout: R.normalizeLayout(farmy) });
    let state = null;
    assert.truthy((() => { state = R.createState(target, 7); return true; })(), 'createState must not throw');
    assert.truthy(state && typeof state === 'object');
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
```

- [ ] **Step 2: Chạy, xác nhận đỏ**

Run: `node tests/night-raid-layout-farm.test.js`
Expected: FAIL — `R.itemById is not a function`.

- [ ] **Step 3: Sửa `js/night-raid-rules.js`**

a. Ngay sau `'use strict';` thêm:
```js
  // Farm items (crops, farm buildings) are defined in js/farm-rules.js. The
  // browser loads that file first (index.html); Node and the Pages bundle
  // require it. Kept out of DEFENSES on purpose: homeLevel, combatPower and
  // createState only ever look at DEFENSES, so the farm can never change a
  // fight or a matchup.
  const Farm = typeof FarmRules !== 'undefined' ? FarmRules
    : (typeof require === 'function' ? require('./farm-rules.js') : null);
```

b. Trong `DEFENSES`, sửa bốn dòng sản xuất:
```js
    Object.freeze({ id:'training-barracks', asset:'training-barracks.png', name:{en:'Training Barracks',vi:'Trại Huấn Luyện'}, price:8000, stat:'producer', footprint:2, attack:0, defense:0, producer:'soldier', yield:1, perTaskDay:true, maxOwned:10, color:'#d8783d' }),
    Object.freeze({ id:'rice-field', asset:'rice-field.png', name:{en:'Rice Field',vi:'Ruộng Lúa'}, price:6000, stat:'producer', footprint:2, attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, buyMax:1, color:'#e5b93d' }),
    Object.freeze({ id:'tomato-field', asset:'tomato-field.png', name:{en:'Tomato Garden',vi:'Vườn Cà Chua'}, price:6000, stat:'producer', footprint:2, attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, buyMax:1, color:'#ef5544' }),
    Object.freeze({ id:'fish-pond', asset:'fish-pond.png', name:{en:'Koi Fish Pond',vi:'Ao Cá Koi'}, price:6000, stat:'producer', footprint:2, attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, buyMax:1, color:'#38a9d6' }),
```
(`maxOwned` của ruộng giữ 4 để `normalizeLayout` không xóa ruộng bé đã có; `buyMax: 1` chỉ dùng ở SHOP và server PUT.)

c. Thay `footprintFor`:
```js
  const itemById = id => byId(DEFENSES, id) || (Farm ? Farm.byId(id) : null);
  const footprintFor = value => {
    const def=typeof value==='string'?itemById(value):value;
    return def&&def.footprint===2?2:1;
  };
```

d. Thay nguyên hàm `normalizeLayout(value)` bằng:
```js
  const UID_RE=/^[A-Za-z0-9-]{8,64}$/,DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
  // One board's worth of cells → clean cells. `grid` is the board size (12 for
  // the castle, 6 for an extra farm); `occupied` is seeded with the castle on
  // the main board and empty on a farm; `allowDefense` is false on a farm.
  function normalizeCells(rawCells, grid, occupied, allowDefense, dayCount, today) {
    const owned = Object.create(null);
    const clean = [];
    const findSpace=(gx,gy,size,layer)=>{
      const candidates=[];
      for(let y=0;y<=grid-size;y++)for(let x=0;x<=grid-size;x++)candidates.push({gx:x,gy:y,size,score:Math.abs(x-gx)+Math.abs(y-gy)});
      candidates.sort((a,b)=>a.score-b.score||a.gy-b.gy||a.gx-b.gx);
      return candidates.find(candidate=>!occupied[layer].some(box=>rectsOverlap(candidate,box)))||null;
    };
    rawCells.slice(0, grid * grid * 2).forEach(cell => {
      const type = itemById(String(cell && cell.type || ''));
      if (!type) return;
      const isDefense = !!byId(DEFENSES, type.id);
      if (isDefense && !allowDefense) return;
      if (type.maxOwned && (owned[type.id] || 0) >= type.maxOwned) return;
      const hasGrid = Number.isFinite(Number(cell && cell.gx)) && Number.isFinite(Number(cell && cell.gy));
      const size=footprintFor(type),layer=type.trap?'floor':'stand';
      const wantedX = hasGrid ? int(cell.gx, 0, grid - size) : Math.round((int(cell.col, 1, COLS) - 1) * (grid - size) / (COLS - 1));
      const wantedY = hasGrid ? int(cell.gy, 0, grid - size) : Math.round(int(cell.lane, 0, LANES - 1) * (grid - size) / (LANES - 1));
      const spot=findSpace(wantedX,wantedY,size,layer);
      if(!spot)return;
      const gx=spot.gx,gy=spot.gy;
      occupied[layer].push({gx,gy,size});
      owned[type.id] = (owned[type.id] || 0) + 1;
      const uid=String(cell&&cell.uid||'');
      if (!isDefense) {
        // Crops and farm buildings: no lane, col or tier — they never fight.
        const entry={ type:type.id, gx, gy };
        if(UID_RE.test(uid))entry.uid=uid;
        if(type.kind==='crop'){
          entry.day=int(cell && cell.day, 0, 1e9);
          const at=String(cell&&cell.at||'');
          if(DATE_RE.test(at))entry.at=at;else if(today)entry.at=today;
        }
        clean.push(entry);
        return;
      }
      // Combat still uses five lanes and eight columns. The free builder grid is
      // presentation data mapped deterministically into those battle lanes.
      const lane = Math.round(gy * (LANES - 1) / (BUILD_GRID - 1));
      const col = 1 + Math.round(gx * (COLS - 1) / (BUILD_GRID - 1));
      const entry={ type:type.id, lane, col, gx, gy, tier:type.producer?1:int(cell.tier || 1, 1, 3) };
      if(type.producer){
        if(UID_RE.test(uid))entry.uid=uid;
        if(type.perTaskDay){
          // Barracks pay per finished task-day. A cell that still carries the
          // old 24h clock converts the first time the SERVER normalizes it
          // (it alone knows dayCount); a client without dayCount leaves the
          // legacy clock in place and FarmRules.barracksReady says "not yet".
          if(Number.isFinite(+(cell&&cell.lastDay)))entry.lastDay=int(cell.lastDay,0,1e9);
          else if(dayCount!==null)entry.lastDay=dayCount;
          else if(Number.isFinite(+(cell&&cell.readyAt)))entry.readyAt=Math.max(0,Math.trunc(+cell.readyAt));
        } else entry.readyAt=Math.max(0,Math.trunc(+cell.readyAt||0));
      }
      clean.push(entry);
    });
    return clean;
  }

  // opts = { dayCount, today } — passed by the server (and by a client that
  // has heard them from the server). Without them nothing about days changes.
  function normalizeLayout(value, opts) {
    opts = opts || {};
    const dayCount = Number.isFinite(+opts.dayCount) ? int(opts.dayCount, 0, 1e9) : null;
    const today = DATE_RE.test(String(opts.today || '')) ? String(opts.today) : null;
    const cells = Array.isArray(value && value.cells) ? value.cells : [];
    const castleRaw=value&&value.castleCell;
    const legacy=value&&value.castlePos;
    const castleCell={
      gx:castleRaw&&Number.isFinite(+castleRaw.gx)?int(castleRaw.gx,0,BUILD_GRID-CASTLE_SIZE):legacy&&Number.isFinite(+legacy.x)?int(Math.round((+legacy.x-12)/76*BUILD_GRID-CASTLE_SIZE/2),0,BUILD_GRID-CASTLE_SIZE):4,
      gy:castleRaw&&Number.isFinite(+castleRaw.gy)?int(castleRaw.gy,0,BUILD_GRID-CASTLE_SIZE):legacy&&Number.isFinite(+legacy.y)?int(Math.round((+legacy.y-8)/81*BUILD_GRID-CASTLE_SIZE/2),0,BUILD_GRID-CASTLE_SIZE):1,
    };
    const occupied={stand:[{gx:castleCell.gx,gy:castleCell.gy,size:CASTLE_SIZE}],floor:[]};
    const clean = normalizeCells(cells, BUILD_GRID, occupied, true, dayCount, today);
    const plot = Farm ? Farm.FARM_PLOT : null;
    const rawFarms = plot && Array.isArray(value && value.farms) ? value.farms.slice(0, plot.max) : [];
    const farms = rawFarms.map(f => ({ cells: normalizeCells(Array.isArray(f && f.cells) ? f.cells : [], plot.size, { stand: [], floor: [] }, false, dayCount, today) }));
    return { cells:clean, dogLane:int(value && value.dogLane, 0, LANES - 1), soldiers:int(value&&value.soldiers,0,SOLDIER_SANITY_CAP), gridVersion:3, castleCell, farms };
  }
```

e. Trong `createState`, dòng lọc phòng thủ (quanh dòng 211) đổi từ
```js
    const defenses = layout.cells.filter(cell=>!byId(DEFENSES,cell.type).producer).map((cell, index) => {
```
thành
```js
    const defenses = layout.cells.filter(cell=>{const d=byId(DEFENSES,cell.type);return d&&!d.producer;}).map((cell, index) => {
```

f. Export: trong `return Object.freeze({...})` thêm `itemById,farmRules:Farm,` ngay sau `defenseById:id => byId(DEFENSES,id),`.

- [ ] **Step 4: Sửa test cũ `tests/night-raid-rules.test.js`**

Dòng 20–21 và 27:
```js
    assert.equal(barracks.price,8000);assert.equal(barracks.maxOwned,10);assert.equal(barracks.yield,1);
    assert.equal(rice.price,6000);assert.equal(rice.maxOwned,4);assert.equal(rice.buyMax,1);assert.equal(rice.yield,100);
```
```js
    assert.equal(barracks.perTaskDay,true);assert.equal(barracks.productionMs,undefined);
```
Dòng 41 (ba trại đưa vào, giờ giữ cả ba):
```js
    assert.equal(layout.cells.filter(c=>c.type==='rice-field').length,4);assert.equal(layout.cells.filter(c=>c.type==='training-barracks').length,3);assert.equal(layout.soldiers,99);
```

- [ ] **Step 5: Chạy**

Run: `node tests/night-raid-layout-farm.test.js && node tests/night-raid-rules.test.js && node tests/night-raid-choreo.test.js && node tests/home-yard-layout.test.js && node tests/night-raid-ui.test.js && node tests/night-raid-screens.test.js`
Expected: PASS. Nếu `night-raid-screens` đỏ vì `FarmRules` chưa có trong sandbox: sandbox nạp `Rules` bằng `require` nên `Farm` đã được `require` bên trong; không cần thêm gì.

- [ ] **Step 6: Commit**

```bash
git add js/night-raid-rules.js tests/night-raid-layout-farm.test.js tests/night-raid-rules.test.js
git commit -m "feat(night-raid): layout carries crops, farm buildings and extra farms; barracks pay per task-day

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phần B — Server

### Task 3: Harness biết bảng Daily Task; `functions/api/_farm.js`

**Files:**
- Modify: `tests/pages-harness.js:60-106` (`SQL_FILES`)
- Create: `functions/api/_farm.js`
- Test: `tests/farm-server.test.js` (phần 1)

- [x] **Step 1: KHÔNG cần thêm migration vào harness** — đã kiểm và bỏ

Dự định ban đầu là thêm `db/018-daily-tasks.sql` và `db/019-armory-swords.sql` vào `SQL_FILES`. **Sai**: `db/schema.sql` chạy đầu tiên trong danh sách đó và đã chứa sẵn `daily_tasks`, `daily_task_rewards` (kể cả `claimed_kind`, `claimed_at`), `users.night_shields` và `users.night_swords`. Thêm vào làm harness đổ `duplicate column name: night_shields`. Quy tắc của `SQL_FILES`: chỉ nhận `schema.sql` cộng các migration thuần CREATE; migration có `ALTER` đã được gộp vào `schema.sql`.

Đổi lại, một lỗi thật của harness phải sửa: `loadModule` nạp script thường bằng `new Function('module','exports',src)`, mà `require` không phải biến toàn cục trong Node, nên bên trong hàm đó `typeof require === 'undefined'`. `js/night-raid-rules.js` lấy danh mục nông trại qua đúng nhánh dự phòng ấy, nên `NR.farmRules` lặng lẽ thành `null` và mọi luật nông trại phía server test ra "không làm gì" thay vì đỏ. Truyền một `require` thật cho đường dẫn tương đối, ném lỗi với specifier trần.

- [ ] **Step 2: Viết test (đỏ)**

```js
// tests/farm-server.test.js — the farm's server half, EXECUTED against a real
// SQLite database through the Pages harness: day counting, wilt context, the
// home GET/PUT stamps, harvesting, and the Daily Task page summary.
const { suite, test, assert } = require('./harness');
const { createWorld, loadModule } = require('./pages-harness');

const DAY = 86400000;
const gmt7 = ms => new Date(ms + 7 * 3600000).toISOString().slice(0, 10);
const TODAY = gmt7(Date.now()), YESTERDAY = gmt7(Date.now() - DAY), TWO_AGO = gmt7(Date.now() - 2 * DAY);

function doneOn(world, uid, ...dates) {
  for (const d of dates) world.db.prepare('INSERT OR IGNORE INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?, ?, 200, 1)').run(uid, d);
}
const farmLib = () => loadModule('functions/api/_farm.js');

suite('farm server: the clock is the reward table', () => {
  test('dayCount is the number of finished task-days; wiltCtx reads the last two days', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    const lib = farmLib();
    assert.equal(await lib.dayCount(world.env, kid.uid), 0);
    doneOn(world, kid.uid, TWO_AGO, YESTERDAY);
    assert.equal(await lib.dayCount(world.env, kid.uid), 2);
    const ctx = await lib.wiltCtx(world.env, kid.uid);
    assert.deepEqual(ctx, { today: TODAY, doneYesterday: true, doneToday: false });
    doneOn(world, kid.uid, TODAY);
    assert.deepEqual((await lib.farmClock(world.env, kid.uid)), { dayCount: 3, ctx: { today: TODAY, doneYesterday: true, doneToday: true } });
  });
  test('farmSummary counts crops, ripe, growing, wilt and picks the closest-to-ripe preview', () => {
    const lib = farmLib();
    const ctx = { today: TODAY, doneYesterday: false, doneToday: false };
    const layout = { cells: [
      { type: 'pumpkin', gx: 0, gy: 0, uid: 'c-aaaaaaaa', day: 0, at: TWO_AGO },
      { type: 'lettuce', gx: 1, gy: 0, uid: 'c-bbbbbbbb', day: 0, at: TWO_AGO },
      { type: 'stone-wall', gx: 2, gy: 0, tier: 1 },
      { type: 'training-barracks', gx: 4, gy: 4, uid: 'p-cccccccc', lastDay: 0 },
    ], farms: [{ cells: [{ type: 'carrot', gx: 0, gy: 0, uid: 'c-dddddddd', day: 1, at: TODAY }] }] };
    const s = lib.farmSummary(layout, 2, ctx);
    assert.equal(s.crops, 3);
    assert.equal(s.ripe, 1, 'lettuce (1 day) is ripe at day 2');
    assert.equal(s.growing, 2);
    assert.equal(s.wiltedCount, 2, 'the two planted before today wilt; today\'s carrot does not');
    assert.truthy(s.wilted);
    assert.equal(s.barracksReady, 1);
    assert.deepEqual(s.preview, { id: 'lettuce', g: 1, days: 1, wilted: true });
    assert.deepEqual(lib.farmSummary({ cells: [] }, 0, ctx).preview, null);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
```

Run: `node tests/farm-server.test.js`
Expected: FAIL — không tìm thấy `functions/api/_farm.js`.

- [ ] **Step 3: Viết `functions/api/_farm.js`**

```js
import { NR, nightDate } from './_night-raid.js';
import { rewardedOn } from './_daily-task.js';

// The farm's clock is the daily-task reward table. One row per GMT+7 day the
// child finished every task; the row count is "how many days the farm has
// grown", and yesterday's/today's rows decide whether the plants are wilted.
// Nothing here writes: the reward row is inserted by _daily-task.js evaluate()
// under its own once-a-day lock, so the farm can never tick twice in a day.
const Farm = NR.farmRules;

export async function dayCount(env, uid) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM daily_task_rewards WHERE user_id = ?').bind(uid).first();
  return Math.max(0, Math.trunc(Number((r && r.n) || 0)));
}

export async function wiltCtx(env, uid, now = Date.now()) {
  const today = nightDate(now), yesterday = nightDate(now - 86400000);
  const [doneToday, doneYesterday] = await Promise.all([rewardedOn(env, uid, today), rewardedOn(env, uid, yesterday)]);
  return { today, doneYesterday: !!doneYesterday, doneToday: !!doneToday };
}

export async function farmClock(env, uid, now = Date.now()) {
  const [count, ctx] = await Promise.all([dayCount(env, uid), wiltCtx(env, uid, now)]);
  return { dayCount: count, ctx };
}

// What the Daily Task page shows about the garden. Pure: the layout is already
// normalized by the caller.
export function farmSummary(layout, dayCountValue, ctx) {
  const cells = Farm.allCells(layout);
  const crops = cells.filter(c => Farm.isCrop(c));
  let ripe = 0, growing = 0, wiltedCount = 0, preview = null, best = -Infinity;
  for (const c of crops) {
    const p = Farm.progress(c, dayCountValue), w = Farm.isWilted(c, ctx);
    if (w) wiltedCount++;
    if (p.ripe) ripe++; else growing++;
    // Ripe first, then the fewest days left. A ripe crop beats every growing one.
    const score = p.ripe ? 1000 : 100 - p.left;
    if (score > best) { best = score; preview = { id: c.type, g: p.g, days: p.days, wilted: w }; }
  }
  const barracksReady = cells.filter(c => c.type === 'training-barracks' && Farm.barracksReady(c, dayCountValue)).length;
  return { crops: crops.length, ripe, growing, wiltedCount, wilted: wiltedCount > 0, barracksReady, preview, dayCount: dayCountValue };
}
```

- [ ] **Step 4: Chạy**

Run: `node tests/farm-server.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/pages-harness.js functions/api/_farm.js tests/farm-server.test.js
git commit -m "feat(farm): server clock — task-days and wilt context from daily_task_rewards

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `home.js` — GET trả `dayCount`/`ctx`, PUT đóng dấu ngày và áp `buyMax`

**Files:**
- Modify: `functions/api/night-raid/home.js`
- Test: `tests/farm-server.test.js` (thêm suite)

- [ ] **Step 1: Thêm test (đỏ)**

Thêm vào `tests/farm-server.test.js` trước dòng `if (require.main === module)`:

```js
const homeHandler = () => loadModule('functions/api/night-raid/home.js');
async function putHome(world, kid, layout, coins) {
  return world.call(homeHandler().onRequestPut, { url: '/api/night-raid/home', method: 'PUT', token: kid.token,
    body: { layout, dogLevel: 1, castleSkin: 'stone-keep', coins: coins == null ? 500 : coins } });
}
const stored = (world, uid) => JSON.parse(world.db.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id=?').get(uid).layout_json);

suite('farm server: home PUT stamps days on the server, not the client', () => {
  test('a new crop gets day = dayCount and at = today, whatever the client sent', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    doneOn(world, kid.uid, TWO_AGO, YESTERDAY);
    const r = await putHome(world, kid, { cells: [{ type: 'tomato', gx: 1, gy: 1, uid: 'c-aaaaaaaa', day: 999, at: '2020-01-01' }] });
    assert.truthy(r.ok, JSON.stringify(r.data));
    const crop = stored(world, kid.uid).cells.find(c => c.type === 'tomato');
    assert.equal(crop.day, 2);
    assert.equal(crop.at, TODAY);
    assert.equal(r.data.dayCount, 2);
    assert.deepEqual(r.data.ctx, { today: TODAY, doneYesterday: true, doneToday: false });
  });
  test('an existing crop keeps the server\'s day and at even if the client rewinds them', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    doneOn(world, kid.uid, TWO_AGO);
    await putHome(world, kid, { cells: [{ type: 'pumpkin', gx: 1, gy: 1, uid: 'c-aaaaaaaa' }] });
    doneOn(world, kid.uid, YESTERDAY, TODAY);
    await putHome(world, kid, { cells: [{ type: 'pumpkin', gx: 3, gy: 3, uid: 'c-aaaaaaaa', day: 0, at: '2020-01-01' }] });
    const crop = stored(world, kid.uid).cells.find(c => c.type === 'pumpkin');
    assert.equal(crop.day, 1, 'planted at day 1, still day 1');
    assert.equal(crop.at, TODAY, 'the planting date is the server\'s');
    assert.equal(crop.gx, 3, 'moving it is fine');
  });
  test('barracks: new ones get lastDay = dayCount; a legacy readyAt converts; lastDay cannot rewind', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    doneOn(world, kid.uid, TWO_AGO, YESTERDAY, TODAY);
    // seed a legacy row straight into the table
    await putHome(world, kid, { cells: [] });
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?').run(JSON.stringify({ cells: [
      { type: 'training-barracks', gx: 0, gy: 0, tier: 1, uid: 'p-legacy01', readyAt: 5 }], soldiers: 0, dogLane: 2 }), kid.uid);
    const g = await world.call(homeHandler().onRequestGet, { url: '/api/night-raid/home', method: 'GET', token: kid.token });
    assert.truthy(g.ok);
    const legacy = g.data.home.layout.cells.find(c => c.uid === 'p-legacy01');
    assert.equal(legacy.lastDay, 3, 'converted on read with today\'s dayCount');
    assert.equal(legacy.readyAt, undefined);
    assert.equal(g.data.dayCount, 3);
    await putHome(world, kid, { cells: [{ type: 'training-barracks', gx: 0, gy: 0, uid: 'p-legacy01', lastDay: 0 }, { type: 'training-barracks', gx: 4, gy: 4, uid: 'p-newone01' }] });
    const cells = stored(world, kid.uid).cells;
    assert.equal(cells.find(c => c.uid === 'p-legacy01').lastDay, 3, 'the client may not rewind lastDay');
    assert.equal(cells.find(c => c.uid === 'p-newone01').lastDay, 3);
  });
  test('fields: a second new rice field is dropped, but four owned ones survive', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await putHome(world, kid, { cells: [{ type: 'rice-field', gx: 0, gy: 0, uid: 'p-rice0001' }, { type: 'rice-field', gx: 4, gy: 0, uid: 'p-rice0002' }] });
    assert.equal(stored(world, kid.uid).cells.filter(c => c.type === 'rice-field').length, 1, 'buyMax is 1');
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?').run(JSON.stringify({ cells: [0, 1, 2, 3].map(i =>
      ({ type: 'rice-field', gx: i * 2, gy: 0, tier: 1, uid: 'p-rice000' + i, readyAt: 1 })), soldiers: 0, dogLane: 2 }), kid.uid);
    await putHome(world, kid, { cells: [0, 1, 2, 3].map(i => ({ type: 'rice-field', gx: i * 2, gy: 0, uid: 'p-rice000' + i, readyAt: 1 })) });
    assert.equal(stored(world, kid.uid).cells.filter(c => c.type === 'rice-field').length, 4, 'owned fields are never taken away');
  });
  test('farms: kept, capped at three, stamped like the main board', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    doneOn(world, kid.uid, YESTERDAY);
    await putHome(world, kid, { cells: [], farms: [{ cells: [{ type: 'rose', gx: 0, gy: 0, uid: 'c-rose0001' }] }, { cells: [] }, { cells: [] }, { cells: [] }] });
    const s = stored(world, kid.uid);
    assert.equal(s.farms.length, 3);
    assert.equal(s.farms[0].cells[0].day, 1);
    assert.equal(s.farms[0].cells[0].at, TODAY);
  });
});
```

Run: `node tests/farm-server.test.js`
Expected: FAIL ở suite mới (`day` là 999, `dayCount` undefined…).

- [ ] **Step 2: Sửa `functions/api/night-raid/home.js`**

Import thêm:
```js
import { farmClock } from '../_farm.js';
```

GET — thay hàm bằng:
```js
export async function onRequestGet({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid is not enabled',403);
  const now=Date.now(),clock=await farmClock(env,auth.uid,now);
  const row=await env.DB.prepare('SELECT h.*, u.username FROM night_raid_homes h JOIN users u ON u.id=h.user_id WHERE h.user_id=?').bind(auth.uid).first();
  // The owner sees their own DAM the way start.js will score it: swords in.
  if(row)row.night_swords=await swordCount(env,auth.uid);
  const home=row?homeSnapshot(row):null;
  // Only the server knows dayCount, so only this read can convert a barracks
  // that still carries the old 24h clock (see normalizeLayout in the rules).
  if(home)home.layout=NR.normalizeLayout(home.layout,{dayCount:clock.dayCount,today:clock.ctx.today});
  // shieldUntil is for the OWNER only — targets.js never exposes it.
  return json({home:home?Object.assign(home,{shieldUntil:Math.max(0,Math.trunc(+row.shield_until||0))}):null,dayCount:clock.dayCount,ctx:clock.ctx});
}
```

PUT — tính đồng hồ **trước** khi chuẩn hóa bố cục cũ, để trại lính cũ trong `oldLayout` cũng được chuyển sang `lastDay`. Thay hai dòng `const current=...` / `const oldLayout=...` và dòng `const layout=body.layout===undefined?oldLayout:NR.normalizeLayout(body.layout);` cùng vòng `for(const cell of layout.cells){...readyAt...}` bằng:
```js
  const now=Date.now(),clock=await farmClock(env,auth.uid,now),dayCount=clock.dayCount,today=clock.ctx.today;
  const current=await env.DB.prepare('SELECT layout_json,dog_level,castle_skin,lootable_coins,vault_coins FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  const oldLayout=NR.normalizeLayout(current?safeJson(current.layout_json,{cells:[],soldiers:0}):{cells:[],soldiers:0},{dayCount,today});
  const layout=body.layout===undefined?oldLayout:NR.normalizeLayout(body.layout,{dayCount,today});
  // Every cell the server already knows, by uid — main board and extra farms.
  const oldByUid=new Map(NR.farmRules.allCells(oldLayout).filter(c=>c.uid).map(c=>[c.uid,c]));
  const newUid=prefix=>prefix+crypto.randomUUID().replace(/-/g,'').slice(0,20);
  // The server stamps every clock. A client may move a plant or a barracks,
  // never rewind it: a cell whose uid the server knows keeps the server's
  // day/at/lastDay/readyAt; a cell it has never seen starts today.
  const stamp=cell=>{const def=NR.itemById(cell.type);if(!def)return;const prior=cell.uid?oldByUid.get(cell.uid):null,same=!!(prior&&prior.type===cell.type);
    if(def.producer==='coins'){if(same)cell.readyAt=prior.readyAt;else{if(!cell.uid)cell.uid=newUid('p-');cell.readyAt=now+NR.PRODUCTION_MS;}}
    else if(def.producer==='soldier'){if(same&&Number.isFinite(+prior.lastDay))cell.lastDay=prior.lastDay;else{if(!cell.uid)cell.uid=newUid('p-');cell.lastDay=dayCount;}delete cell.readyAt;}
    else if(def.kind==='crop'){if(same){cell.day=prior.day;cell.at=prior.at;}else{if(!cell.uid)cell.uid=newUid('c-');cell.day=dayCount;cell.at=today;}}
    else if(def.kind==='farm'){if(!cell.uid)cell.uid=newUid('f-');}};
  layout.cells.forEach(stamp);layout.farms.forEach(f=>f.cells.forEach(stamp));
  // buyMax: a NEW field of a type the child already owns is dropped. Fields the
  // child already has are never touched — the cap is on buying, not owning.
  for(const def of NR.DEFENSES){if(!def.buyMax)continue;const had=oldLayout.cells.filter(c=>c.type===def.id).length,room=Math.max(0,Math.max(had,def.buyMax)-had);let taken=0;
    layout.cells=layout.cells.filter(c=>{if(c.type!==def.id)return true;const prior=c.uid&&oldByUid.get(c.uid);if(prior&&prior.type===def.id)return true;return ++taken<=room;});}
```
Giữ nguyên các dòng `layout.soldiers=current?oldLayout.soldiers:0;`, dog level, skin, coins, vault, INSERT. Đổi dòng trả về thành:
```js
  return json({ok:true,homeLevel,layout,coins,dayCount,ctx:clock.ctx});
```
Xóa dòng `const now=Date.now(),oldProduction=new Map(...)` cũ (đã thay).

- [ ] **Step 3: Chạy**

Run: `node tests/farm-server.test.js && node tests/money-conservation.test.js && node tests/money-raid-transfer.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/api/night-raid/home.js tests/farm-server.test.js
git commit -m "feat(night-raid): home GET/PUT stamp crop days and barracks task-days on the server; fields buy-max 1

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `collect.js` — hái cây chín tươi, lính theo ngày, ruộng theo giờ

**Files:**
- Modify: `functions/api/night-raid/collect.js`
- Test: `tests/farm-server.test.js` (thêm suite)

- [ ] **Step 1: Thêm test (đỏ)**

```js
const collectHandler = () => loadModule('functions/api/night-raid/collect.js');
const collect = (world, kid, uid) => world.call(collectHandler().onRequestPost, { url: '/api/night-raid/collect', method: 'POST', token: kid.token, body: { uid: uid || '' } });
const mirror = (world, uid) => world.db.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').get(uid).lootable_coins;

suite('farm server: collect', () => {
  async function farmWorld(dates, cells, farms) {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await putHome(world, kid, { cells: [] }, 100);
    doneOn(world, kid.uid, ...dates);
    world.db.prepare('UPDATE night_raid_homes SET layout_json=? WHERE user_id=?').run(JSON.stringify({ cells, farms: farms || [], soldiers: 0, dogLane: 2 }), kid.uid);
    return { world, kid };
  }
  test('a ripe fresh crop pays its yield once, is removed, and is reported for replanting', async () => {
    const { world, kid } = await farmWorld([TWO_AGO, YESTERDAY], [
      { type: 'tomato', gx: 1, gy: 1, uid: 'c-tomato01', day: 0, at: TWO_AGO },
      { type: 'pumpkin', gx: 2, gy: 2, uid: 'c-pumpk001', day: 0, at: TWO_AGO },
    ], [{ cells: [{ type: 'lettuce', gx: 0, gy: 0, uid: 'c-lettuc01', day: 1, at: YESTERDAY }] }]);
    const r = await collect(world, kid);
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.equal(r.data.collectedCoins, 18 + 8, 'tomato (2 days) and lettuce (1 day) are ripe; pumpkin is not');
    assert.equal(r.data.coins, 126);
    assert.equal(mirror(world, kid.uid), 126);
    assert.deepEqual(r.data.harvested.map(h => [h.type, h.zone]).sort(), [['lettuce', 1], ['tomato', 0]]);
    const s = stored(world, kid.uid);
    assert.falsy(s.cells.some(c => c.type === 'tomato'));
    assert.truthy(s.cells.some(c => c.type === 'pumpkin'));
    assert.equal(s.farms[0].cells.length, 0);
    assert.equal(r.data.dayCount, 2);
    const again = await collect(world, kid);
    assert.truthy(again.data.nothingReady, 'nothing left to pay');
    assert.equal(mirror(world, kid.uid), 126, 'no double pay');
  });
  test('a ripe but wilted crop is not harvested and the reply says why', async () => {
    const { world, kid } = await farmWorld([TWO_AGO], [{ type: 'lettuce', gx: 1, gy: 1, uid: 'c-lettuc01', day: 0, at: TWO_AGO }]);
    const before = JSON.stringify(stored(world, kid.uid));
    const r = await collect(world, kid);
    assert.truthy(r.data.nothingReady);
    assert.truthy(r.data.wilted, 'the child is told the plant is wilted');
    assert.equal(JSON.stringify(stored(world, kid.uid)), before, 'layout untouched');
    assert.equal(mirror(world, kid.uid), 100);
    doneOn(world, kid.uid, TODAY);
    const revived = await collect(world, kid);
    assert.equal(revived.data.collectedCoins, 8, 'finishing today revives and pays');
  });
  test('barracks pay one soldier per task-day since the last collect, and not by the clock', async () => {
    const { world, kid } = await farmWorld([TWO_AGO, YESTERDAY], [{ type: 'training-barracks', gx: 0, gy: 0, tier: 1, uid: 'p-barrac01', lastDay: 0 }]);
    const r = await collect(world, kid);
    assert.equal(r.data.collectedSoldiers, 1);
    assert.equal(stored(world, kid.uid).cells[0].lastDay, 2);
    const again = await collect(world, kid);
    assert.truthy(again.data.nothingReady, 'same dayCount → nothing');
    doneOn(world, kid.uid, TODAY);
    assert.equal((await collect(world, kid)).data.collectedSoldiers, 1);
  });
  test('fields still pay by their 24h clock', async () => {
    const { world, kid } = await farmWorld([], [{ type: 'rice-field', gx: 0, gy: 0, tier: 1, uid: 'p-rice0001', readyAt: 0 }, { type: 'fish-pond', gx: 4, gy: 0, tier: 1, uid: 'p-fish0001', readyAt: Date.now() + 3600000 }]);
    const r = await collect(world, kid);
    assert.equal(r.data.collectedCoins, 100);
    assert.truthy(stored(world, kid.uid).cells.find(c => c.uid === 'p-rice0001').readyAt > Date.now());
  });
  test('uid harvests one cell only', async () => {
    const { world, kid } = await farmWorld([TWO_AGO, YESTERDAY], [
      { type: 'lettuce', gx: 1, gy: 1, uid: 'c-lettuc01', day: 0, at: TWO_AGO },
      { type: 'lettuce', gx: 2, gy: 1, uid: 'c-lettuc02', day: 0, at: TWO_AGO }]);
    const r = await collect(world, kid, 'c-lettuc02');
    assert.equal(r.data.collectedCoins, 8);
    assert.equal(stored(world, kid.uid).cells.length, 1);
    assert.equal(stored(world, kid.uid).cells[0].uid, 'c-lettuc01');
  });
  test('403 without the flag', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: false });
    assert.equal((await collect(world, kid)).status, 403);
  });
});
```

Run: `node tests/farm-server.test.js`
Expected: FAIL ở suite collect (cây không được hái, `harvested` undefined).

- [ ] **Step 2: Thay `functions/api/night-raid/collect.js`**

```js
import { requireAuth, json, err } from '../_lib.js';
import { NR, nightRaidEnabled, safeJson } from '../_night-raid.js';
import { farmClock } from '../_farm.js';

// Harvest everything that is ready: fields by their 24h clock, barracks and
// crops by finished task-days. A ripe crop that is WILTED (yesterday skipped,
// today not done) is skipped and reported — finishing today's tasks revives
// it. Coins land as a delta on lootable_coins exactly like the fields always
// did; there is one harvest path for everything on the estate.
export async function onRequestPost({request,env}) {
  const auth=await requireAuth(request,env);if(!auth)return err('Unauthorized',401);
  if(!(await nightRaidEnabled(env,auth.uid)))return err('Night Raid is not enabled',403);
  let body={};try{body=await request.json();}catch(e){}
  const uid=String(body.uid||''),row=await env.DB.prepare('SELECT layout_json,lootable_coins FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  if(!row)return err('Hãy mở Nhà Cướp Đêm trước',409);
  const now=Date.now(),{dayCount,ctx}=await farmClock(env,auth.uid,now),Farm=NR.farmRules;
  const layout=NR.normalizeLayout(safeJson(row.layout_json,{cells:[],soldiers:0}),{dayCount,today:ctx.today});
  let coins=Math.max(0,+row.lootable_coins||0),soldiers=layout.soldiers,collectedCoins=0,collectedSoldiers=0,wilted=false;const harvested=[];
  const pay=amount=>{if(coins>=100000)return 0;const gain=Math.min(amount,100000-coins);coins+=gain;collectedCoins+=gain;return gain;};
  // Returns the cells that STAY on the board (harvested crops leave it).
  const sweep=(cells,zone)=>cells.filter(cell=>{
    const def=NR.itemById(cell.type);if(!def||(uid&&cell.uid!==uid))return true;
    if(def.producer==='coins'){if(cell.readyAt<=now&&pay(def.yield))cell.readyAt=now+def.productionMs;return true;}
    if(def.producer==='soldier'){if(Farm.barracksReady(cell,dayCount)){soldiers++;collectedSoldiers++;cell.lastDay=dayCount;}return true;}
    if(def.kind==='crop'){
      if(!Farm.progress(cell,dayCount).ripe)return true;
      if(Farm.isWilted(cell,ctx)){wilted=true;return true;}
      if(!pay(def.yield))return true;
      harvested.push({type:cell.type,gx:cell.gx,gy:cell.gy,zone});return false;
    }
    return true;
  });
  layout.cells=sweep(layout.cells,0);
  layout.farms=layout.farms.map((f,i)=>({cells:sweep(f.cells,i+1)}));
  layout.soldiers=soldiers;
  if(!collectedCoins&&!collectedSoldiers)return json({ok:true,nothingReady:true,wilted,layout,coins,soldiers,dayCount,ctx});
  // Add the harvest as a DELTA instead of writing back the absolute number:
  // the old read-modify-write raced with a concurrent collect or a raid
  // deduction, and whichever wrote last silently undid the other's money.
  await env.DB.prepare('UPDATE night_raid_homes SET layout_json=?,lootable_coins=MIN(100000,MAX(0,lootable_coins)+?),updated_at=? WHERE user_id=?').bind(JSON.stringify(layout),collectedCoins,now,auth.uid).run();
  const fresh=await env.DB.prepare('SELECT lootable_coins FROM night_raid_homes WHERE user_id=?').bind(auth.uid).first();
  return json({ok:true,layout,coins:Math.max(0,Math.trunc(+((fresh&&fresh.lootable_coins))||0)),soldiers,collectedCoins,collectedSoldiers,harvested,wilted,dayCount,ctx});
}
```

- [ ] **Step 3: Chạy**

Run: `node tests/farm-server.test.js && npm test 2>&1 | tail -5`
Expected: PASS; toàn suite không có FAIL. Nếu một test tiền cũ ghim shape trả về của `collect` (ví dụ so `deepEqual` cả object), nới thành kiểm từng trường.

- [ ] **Step 4: Commit**

```bash
git add functions/api/night-raid/collect.js tests/farm-server.test.js
git commit -m "feat(night-raid): collect harvests ripe fresh crops and task-day barracks; wilted crops wait

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `GET /api/me/daily-tasks` trả `farm`

**Files:**
- Modify: `functions/api/me/daily-tasks.js`
- Test: `tests/farm-server.test.js` (thêm suite)

- [ ] **Step 1: Thêm test (đỏ)**

```js
suite('farm server: the Daily Task page gets a farm summary', () => {
  const meHandler = () => loadModule('functions/api/me/daily-tasks.js');
  const me = (world, kid) => world.call(meHandler().onRequestGet, { url: '/api/me/daily-tasks', method: 'GET', token: kid.token });
  test('with the flag: counts and preview; without: farm is null', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    await putHome(world, kid, { cells: [{ type: 'carrot', gx: 1, gy: 1, uid: 'c-carrot01' }] });
    doneOn(world, kid.uid, YESTERDAY);
    const r = await me(world, kid);
    assert.truthy(r.ok, JSON.stringify(r.data));
    assert.equal(r.data.farm.crops, 1);
    assert.equal(r.data.farm.growing, 1);
    assert.deepEqual(r.data.farm.preview, { id: 'carrot', g: 1, days: 3, wilted: false });
    assert.equal(r.data.farm.ctx.today, TODAY);
    const plain = await world.createUser({ allowBot: false });
    assert.equal((await me(world, plain)).data.farm, null);
  });
  test('a child with the flag but no home yet gets an empty summary, not an error', async () => {
    const world = createWorld();
    const kid = await world.createUser({ allowBot: true });
    const r = await me(world, kid);
    assert.truthy(r.ok);
    assert.equal(r.data.farm.crops, 0);
    assert.equal(r.data.farm.preview, null);
  });
});
```

Run: `node tests/farm-server.test.js`
Expected: FAIL — `r.data.farm` undefined.

- [ ] **Step 2: Sửa `functions/api/me/daily-tasks.js`**

Import thêm:
```js
import { NR, nightRaidEnabled, safeJson } from '../_night-raid.js';
import { farmClock, farmSummary } from '../_farm.js';
```
Trước `return json({...})` thêm:
```js
  // The garden strip on the task page. Only for early-access children (the
  // farm lives inside Cướp Đêm); computed AFTER evaluate() so a reward that
  // just landed already counts as today's day.
  let farm = null;
  if (await nightRaidEnabled(env, auth.uid)) {
    const row = await env.DB.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id = ?').bind(auth.uid).first();
    const clock = await farmClock(env, auth.uid, now);
    const layout = NR.normalizeLayout(row ? safeJson(row.layout_json, { cells: [] }) : { cells: [] }, { dayCount: clock.dayCount, today: clock.ctx.today });
    farm = Object.assign(farmSummary(layout, clock.dayCount, clock.ctx), { ctx: clock.ctx });
  }
```
và thêm `farm,` vào object trả về (sau `armoryReady: armory.ready,`).

- [ ] **Step 3: Chạy**

Run: `node tests/farm-server.test.js && node tests/daily-task-client.test.js`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add functions/api/me/daily-tasks.js tests/farm-server.test.js
git commit -m "feat(daily-task): me/daily-tasks carries the garden summary for early-access children

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phần C — Tranh

Làm trước phần màn hình để test tồn tại xanh sớm. Tranh thật sinh bằng ImageGen là việc của người dùng; chế độ `--placeholder` của script vẽ 48 hình tạm đúng tên, đúng cỡ, để pipeline, test và bản test với vài bé chạy được ngay, rồi thay bằng tranh thật sau mà không đổi mã.

### Task 7: Bản kê hình `js/farm-art-manifest.js` và test tồn tại

**Files:**
- Create: `js/farm-art-manifest.js`
- Create: `tests/farm-art.test.js`
- Modify: `index.html`, `sw.js`

- [ ] **Step 1: Viết test (đỏ)**

```js
// tests/farm-art.test.js — every picture the farm can ask for exists on disk,
// is precached, and nothing extra hides in img/farm/. Two castle boards once
// shipped as untracked files that a clean checkout did not have; this makes
// that impossible for the farm.
const { suite, test, assert } = require('./harness');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const F = require(path.join(ROOT, 'js', 'farm-rules.js'));
const M = require(path.join(ROOT, 'js', 'farm-art-manifest.js'));

suite('farm art: the manifest is the rules plus two extras', () => {
  test('48 entries: every sprite name, the plot icon and the dry-ground overlay', () => {
    const names = M.FILES.map(f => f.name);
    assert.equal(names.length, 48);
    assert.equal(new Set(names).size, 48, 'no duplicate names');
    for (const n of F.spriteNames()) assert.contains(names, n, 'missing sprite ' + n);
    assert.contains(names, 'farm-plot');
    assert.contains(names, 'dry-ground');
  });
  test('every entry has a size and a prompt', () => {
    for (const f of M.FILES) {
      assert.truthy([256, 512].includes(f.px), f.name + ': px');
      assert.truthy(f.prompt && f.prompt.length > 20, f.name + ': prompt');
      assert.equal(M.pathFor(f.name), 'img/farm/' + f.name + '.webp');
    }
    assert.equal(M.FILES.find(f => f.name === 'barn').px, 512, '2x2 buildings are 512');
    assert.equal(M.FILES.find(f => f.name === 'tomato-day2').px, 256, 'crops are 256');
  });
});

suite('farm art: files on disk and in the service worker', () => {
  const dir = path.join(ROOT, 'img', 'farm');
  test('every manifest file exists', () => {
    const missing = M.FILES.filter(f => !fs.existsSync(path.join(ROOT, M.pathFor(f.name)))).map(f => f.name);
    assert.deepEqual(missing, [], 'run: python3 scripts/build-farm-art.py --placeholder');
  });
  test('img/farm/ holds nothing the manifest does not name', () => {
    const onDisk = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.webp')) : [];
    const wanted = new Set(M.FILES.map(f => f.name + '.webp'));
    assert.deepEqual(onDisk.filter(f => !wanted.has(f)), []);
  });
  test('sw.js precaches every farm file and the two farm scripts', () => {
    const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
    for (const f of M.FILES) assert.truthy(sw.includes(`'/${M.pathFor(f.name)}'`), 'sw.js lacks ' + f.name);
    assert.truthy(sw.includes("'/js/farm-rules.js'"));
    assert.truthy(sw.includes("'/js/farm-art-manifest.js'"));
  });
  test('index.html loads farm-rules before night-raid-rules, and the manifest', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.truthy(html.indexOf('js/farm-rules.js') > 0 && html.indexOf('js/farm-rules.js') < html.indexOf('js/night-raid-rules.js'));
    assert.truthy(html.includes('js/farm-art-manifest.js'));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
```

Run: `node tests/farm-art.test.js`
Expected: FAIL — không có `js/farm-art-manifest.js`.

- [ ] **Step 2: Viết `js/farm-art-manifest.js`**

```js
// Farm art manifest — the ONE list of pictures the farm may draw. Built from
// FarmRules.spriteNames() (every growth day and wilt state of every crop, every
// farm building) plus two extras. scripts/build-farm-art.py renders exactly
// these files into img/farm/, tests/farm-art.test.js checks they all exist and
// are precached, and js/night-raid.js never names a file that is not here.
// UMD like js/farm-rules.js.
var FarmArtManifest = (() => {
  'use strict';
  const Farm = typeof FarmRules !== 'undefined' ? FarmRules
    : (typeof require === 'function' ? require('./farm-rules.js') : null);
  // The style sheet every prompt starts with. One sentence, never edited per
  // file, so 48 pictures read as one set.
  const STYLE = 'Isometric game sprite, same camera angle as a 2:1 isometric tile viewed from the front-left, '
    + 'soft cel shading, bright storybook palette matching a green castle garden, transparent background, '
    + 'no text, no ground shadow longer than the object, centered, fills 80% of the canvas.';
  const CROP_VI = { lettuce: 'rau cải xanh', tomato: 'cây cà chua', carrot: 'cây cà rốt', rice: 'khóm lúa', rose: 'khóm hoa hồng', pumpkin: 'dây bí ngô' };
  const CROP_EN = { lettuce: 'lettuce', tomato: 'tomato plant', carrot: 'carrot plant', rice: 'rice plant', rose: 'rose bush', pumpkin: 'pumpkin vine' };
  const files = [];
  const add = (name, px, prompt) => files.push(Object.freeze({ name, px, prompt: STYLE + ' ' + prompt }));

  add('sprout', 256, 'A tiny green seedling with two leaves in a small mound of dark soil, freshly watered.');
  add('sprout-wilted', 256, 'A tiny seedling drooping sideways, leaves yellowed and limp, soil dry and cracked.');
  for (const c of Farm.CROPS) {
    for (let g = 1; g <= c.days; g++) {
      const stage = g === c.days ? 'fully ripe and ready to harvest, fruit or flowers bright and abundant'
        : `at growth stage ${g} of ${c.days}, ${Math.round(g / c.days * 100)}% grown, visibly larger than stage ${g - 1}`;
      add(c.id + '-day' + g, 256, `One ${CROP_EN[c.id]} (${CROP_VI[c.id]}) in a small soil bed, ${stage}.`);
    }
    add(c.id + '-wilted-young', 256, `A young ${CROP_EN[c.id]} wilting: stems bent, leaves yellow-brown and limp, soil dry and cracked, a little sad.`);
    add(c.id + '-wilted-old', 256, `A grown ${CROP_EN[c.id]} wilting: drooping heavily, leaves brown at the edges, fruit dull, soil dry and cracked, a little sad.`);
  }
  const BUILDING_PROMPT = {
    'fence': 'A short wooden farm fence segment with two posts and three rails.',
    'fruit-tree': 'A round fruit tree with red apples, small trunk, a few fallen apples.',
    'well': 'A stone water well with a small wooden roof and a bucket on a rope.',
    'chicken-coop': 'A small red wooden chicken coop with a ramp and two white hens outside.',
    'barn': 'A red wooden barn with white trim and a hay bale by the door.',
    'windmill': 'A stone-and-wood windmill with four cloth sails, a tiny door.',
    'cow-shed': 'A long open-front cow shed with a brown-and-white cow inside and a trough.',
    'farmhouse': 'A cozy farmhouse with a tiled roof, chimney smoke, a porch and flower boxes.',
  };
  for (const b of Farm.FARM_BUILDINGS) add(b.id, b.footprint === 2 ? 512 : 256, BUILDING_PROMPT[b.id]);
  add('farm-plot', 256, 'A small fenced square of tilled farmland seen from above at an angle, with a wooden sign, as a shop icon.');
  add('dry-ground', 512, 'A seamless square tile of dry cracked pale-brown soil with a few dead grass tufts, flat, top-down, for tinting a garden that has been neglected.');

  const FILES = Object.freeze(files);
  function pathFor(name) { return 'img/farm/' + name + '.webp'; }
  return Object.freeze({ STYLE, FILES, pathFor });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = FarmArtManifest;
```

- [ ] **Step 3: Nạp và precache**

`index.html`: ngay sau dòng `<script src="js/farm-rules.js"></script>` thêm:
```html
    <script src="js/farm-art-manifest.js"></script>
```
`sw.js`: ngay sau `'/js/farm-rules.js',` thêm `'/js/farm-art-manifest.js',`. Sau dòng `'/img/night-raid/home-castle.webp',` thêm đúng 48 dòng, một dòng mỗi file theo thứ tự bản kê, dạng `'/img/farm/<name>.webp',`. Sinh 48 dòng bằng:
```bash
node -e "const M=require('./js/farm-art-manifest.js');console.log(M.FILES.map(f=>\"  '/\"+M.pathFor(f.name)+\"',\").join('\n'))"
```
rồi dán vào `sw.js`.

Run: `node tests/farm-art.test.js`
Expected: hai suite đầu PASS; test "every manifest file exists" FAIL (chưa có hình) — đúng, Task 8 sửa.

- [ ] **Step 4: Commit**

```bash
git add js/farm-art-manifest.js tests/farm-art.test.js index.html sw.js
git commit -m "feat(farm): art manifest — 48 named pictures, precached and checked

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: `scripts/build-farm-art.py` — dựng WebP từ ảnh gốc, hoặc hình tạm

**Files:**
- Create: `scripts/build-farm-art.py`
- Create: `img/farm/*.webp` (48 file)

- [ ] **Step 1: Viết script**

```python
#!/usr/bin/env python3
"""Build img/farm/*.webp from the art manifest.

    python3 scripts/build-farm-art.py --placeholder
        Draw 48 simple stand-in pictures (a coloured isometric block with the
        file name) so the code, tests and a small test group can run before
        the real art exists. Re-running overwrites them.

    python3 scripts/build-farm-art.py --masters DIR
        Read DIR/<name>.png (one master per manifest entry, generated with
        ImageGen from the prompt in js/farm-art-manifest.js), trim the
        transparent margin, fit into px × px, and write WebP. A missing master
        keeps the existing placeholder and is listed at the end.

The manifest (names, sizes, prompts) is read from js/farm-art-manifest.js by
running node, so Python never holds a second copy of the list.
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "img" / "farm"


def manifest():
    js = ("const M=require(process.argv[1]);"
          "console.log(JSON.stringify(M.FILES.map(f=>({name:f.name,px:f.px}))))")
    out = subprocess.check_output(["node", "-e", js, str(ROOT / "js" / "farm-art-manifest.js")])
    return json.loads(out)


def trim_and_fit(image: Image.Image, px: int) -> Image.Image:
    image = image.convert("RGBA")
    bbox = image.getbbox()
    if bbox:
        image = image.crop(bbox)
    w, h = image.size
    scale = min((px * 0.9) / w, (px * 0.9) / h)
    image = image.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    canvas.paste(image, ((px - image.width) // 2, px - image.height - px // 20), image)
    return canvas


def tint(name: str):
    if "wilted" in name:
        return (176, 140, 80)
    if name.startswith(("sprout",)):
        return (120, 190, 90)
    if name == "dry-ground":
        return (196, 170, 130)
    for crop, colour in (("lettuce", (110, 200, 110)), ("tomato", (220, 80, 70)), ("carrot", (240, 140, 50)),
                         ("rice", (210, 190, 90)), ("rose", (230, 90, 150)), ("pumpkin", (240, 150, 40))):
        if name.startswith(crop):
            return colour
    return (150, 110, 70)  # buildings


def placeholder(name: str, px: int) -> Image.Image:
    """A flat isometric block in the family colour with the name on it."""
    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    r, g, b = tint(name)
    if name == "dry-ground":
        d.rectangle((0, 0, px, px), fill=(r, g, b, 255))
        for i in range(0, px, px // 8):
            d.line((i, 0, px - i, px), fill=(r - 30, g - 30, b - 30, 255), width=2)
        return img
    cx, top, w, h = px // 2, px * 0.30, px * 0.72, px * 0.36
    d.polygon([(cx, top), (cx + w / 2, top + h / 2), (cx, top + h), (cx - w / 2, top + h / 2)], fill=(r, g, b, 255))
    d.polygon([(cx - w / 2, top + h / 2), (cx, top + h), (cx, px * 0.86), (cx - w / 2, px * 0.68)], fill=(r - 40, g - 40, b - 40, 255))
    d.polygon([(cx + w / 2, top + h / 2), (cx, top + h), (cx, px * 0.86), (cx + w / 2, px * 0.68)], fill=(r - 70, g - 70, b - 70, 255))
    d.text((px * 0.08, px * 0.04), name, fill=(40, 30, 20, 255))
    return img


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--placeholder", action="store_true")
    ap.add_argument("--masters", type=Path)
    args = ap.parse_args()
    if not args.placeholder and not args.masters:
        ap.error("pass --placeholder or --masters DIR")
    OUT.mkdir(parents=True, exist_ok=True)
    missing = []
    for entry in manifest():
        name, px = entry["name"], entry["px"]
        target = OUT / f"{name}.webp"
        if args.masters:
            src = args.masters / f"{name}.png"
            if not src.exists():
                missing.append(name)
                continue
            image = trim_and_fit(Image.open(src), px)
        else:
            image = placeholder(name, px)
        image.save(target, "WEBP", quality=82, method=6)
    if missing:
        print("no master for:", ", ".join(missing), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 2: Dựng hình tạm**

Run: `python3 -c "import PIL" || python3 -m pip install --user pillow`
Run: `python3 scripts/build-farm-art.py --placeholder && ls img/farm | wc -l`
Expected: `48`.

- [ ] **Step 3: Chạy test**

Run: `node tests/farm-art.test.js && node tests/gen-app-integrity.test.js`
Expected: PASS toàn bộ (kể cả "every manifest file exists").

- [ ] **Step 4: Commit**

```bash
git add scripts/build-farm-art.py img/farm/*.webp
git commit -m "feat(farm): art build script with placeholder mode; 48 stand-in pictures

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 5: Tranh thật (người dùng làm, ngoài phiên cài đặt)**

Cách lấy lời nhắc cho từng hình:
```bash
node -e "const M=require('./js/farm-art-manifest.js');for(const f of M.FILES)console.log(f.name+' ('+f.px+'px): '+f.prompt+'\n')"
```
Sinh mỗi cây trong **một** phiên ImageGen để chuỗi ngày liền mạch, lưu `<name>.png` vào một thư mục, rồi:
```bash
python3 scripts/build-farm-art.py --masters /path/to/masters
git add img/farm/*.webp
git commit -m "art(farm): real farm sprites replace the placeholders"
```
Test không đổi vì tên và cỡ không đổi.

---

## Phần D — Màn xây nhà (`js/night-raid.js`)

Ba task, cùng một file test `tests/night-raid-builder-farm.test.js`. Helper `mount()` của file này chép từ `tests/night-raid-screens.test.js` (cùng shim, cùng stub), thêm `farmDayCount`/`farmCtx` vào `appState` và một `api` có thể lập trình.

### Task 9: Vẽ cây theo ngày, huy hiệu, trạng thái sẵn, nhận đồng hồ từ server

**Files:**
- Modify: `js/night-raid.js` — `buildAsset`, `productionBadge`, `placedHtml`, `still()` trong `renderHome`/`yardBuildingsHtml`, `renderHome`/`renderBuilder` (`production`, `ready`), `gridCell`, `updateProductionTimers`, `localCollect`, `collectResources`, `syncHome`, `refreshHome`, mọi `defenseById(`
- Create: `tests/night-raid-builder-farm.test.js`

- [ ] **Step 1: Viết test (đỏ)**

```js
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
      { type: 'tomato', gx: 1, gy: 1, uid: 'c-tomato01', day: 4, at: YESTERDAY },   // 1 of 2 days
      { type: 'pumpkin', gx: 2, gy: 1, uid: 'c-pumpk001', day: 5, at: TODAY },      // just planted
      { type: 'lettuce', gx: 3, gy: 1, uid: 'c-lettuc01', day: 3, at: TWO_AGO },    // ripe
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
    assert.falsy(out.includes('<em>1</em><span class="nr-production-badge shown'), 'no tier bubble on a crop');
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
```

Run: `node tests/night-raid-builder-farm.test.js`
Expected: FAIL — cây không được vẽ (`defenseById` không biết `tomato`), không có `TRỒNG LẠI NHƯ CŨ`.

- [ ] **Step 2: `itemById` khắp `js/night-raid.js`**

Thay mọi `NightRaidRules.defenseById(` bằng `NightRaidRules.itemById(` (18 chỗ):
```bash
sed -i '' 's/NightRaidRules\.defenseById(/NightRaidRules.itemById(/g' js/night-raid.js && grep -c "itemById(" js/night-raid.js
```
Expected: `18`.

- [ ] **Step 3: Đồng hồ nông trại và hàm vẽ**

Ngay sau `function buildAsset(def){...}` (dòng 355) thay hàm và thêm helper:
```js
  function buildAsset(def){return def.kind?NightRaidRules.farmRules.art(def.id):'img/night-raid/'+(def.asset||def.id+'.webp');}
  // The farm clock as last heard from the server (GET home, PUT home, collect).
  const farmDay=()=>Math.max(0,Math.trunc(+appState.farmDayCount||0));
  const farmCtx=()=>appState.farmCtx||null;
  function adoptFarmClock(data){if(!data)return;if(typeof data.dayCount==='number'&&Number.isFinite(data.dayCount))appState.farmDayCount=Math.max(0,Math.trunc(data.dayCount));if(data.ctx&&typeof data.ctx==='object')appState.farmCtx={today:String(data.ctx.today||''),doneYesterday:!!data.ctx.doneYesterday,doneToday:!!data.ctx.doneToday};}
  const isCropCell=cell=>NightRaidRules.farmRules.isCrop(cell);
  const isWiltedCell=cell=>NightRaidRules.farmRules.isWilted(cell,farmCtx());
  // Every cell on every board — the castle grid and each extra farm.
  const allCells=layout=>NightRaidRules.farmRules.allCells(layout);
  function cellArt(cell,def){return def.kind==='crop'?NightRaidRules.farmRules.spriteFor(cell,farmDay(),farmCtx()):buildAsset(def);}
  // Ready to collect right now: a ripe FRESH crop, a barracks with a new
  // task-day, or a field past its 24h clock.
  function cellReady(cell){const def=NightRaidRules.itemById(cell.type),F=NightRaidRules.farmRules;if(!def)return false;if(def.kind==='crop'){return F.progress(cell,farmDay()).ripe&&!F.isWilted(cell,farmCtx());}if(def.perTaskDay)return F.barracksReady(cell,farmDay());return !!def.producer&&cell.readyAt<=Date.now();}
  const isProducing=cell=>{const d=NightRaidRules.itemById(cell.type);return !!d&&(!!d.producer||d.kind==='crop');};
  const anyWilted=layout=>allCells(layout).some(c=>isCropCell(c)&&isWiltedCell(c));
```

Thay `productionBadge`:
```js
  function productionBadge(cell){const def=NightRaidRules.itemById(cell.type);if(!def)return'';const F=NightRaidRules.farmRules;
    if(def.kind==='crop'){const p=F.progress(cell,farmDay()),wilted=F.isWilted(cell,farmCtx()),fresh=p.ripe&&!wilted;const label=wilted?'HÉO':p.ripe?`CHÍN · +${def.yield} XU`:`còn ${p.left} ngày`;return `<span class="nr-production-badge shown ${fresh?'ready':''} ${wilted?'wilted':''}" data-static-ready="${fresh?1:0}" data-producer-uid="${esc(cell.uid||'')}">${label}</span>`;}
    if(def.kind||!def.producer)return'';
    if(def.perTaskDay){const ready=F.barracksReady(cell,farmDay());return `<span class="nr-production-badge shown ${ready?'ready':''}" data-static-ready="${ready?1:0}" data-producer-uid="${esc(cell.uid||'')}">${ready?'NHẬN LÍNH':'chờ nhiệm vụ'}</span>`;}
    const ready=cell.readyAt<=Date.now(),label=`+${def.yield} XU`;return `<span class="nr-production-badge ${ready?'ready':''}" data-ready-at="${cell.readyAt}" data-ready-label="${label}" data-producer-uid="${esc(cell.uid||'')}">${ready?label:'24:00:00'}</span>`;}
```

Thay `placedHtml`:
```js
  function placedHtml(cell,layer,gx,gy){if(!cell)return'';const def=NightRaidRules.itemById(cell.type),size=NightRaidRules.footprintFor(def);return `<img class="nr-placed ${layer} footprint-${size} ${def.producer?'producer '+def.id:''} ${def.kind?'farm-item '+def.kind:''}" src="${cellArt(cell,def)}" draggable="false" alt="${esc(def.name.vi)}, chiếm ${size} × ${size} ô, kéo để đổi vị trí" oncontextmenu="return false" onpointerdown="nrBeginPlacedDrag(event,${gx},${gy},'${layer}')">${def.kind?'':`<em>${cell.tier}</em>`}${productionBadge(cell)}`;}
```

Trong `renderHome` (dòng 141) và `yardBuildingsHtml` (dòng 377), hàm `still` đổi `src="${buildAsset(def)}"` thành `src="${cellArt(cell,def)}"`, thêm ` ${def.kind?'farm-item '+def.kind:''}` vào class, và `<em>${cell.tier}</em>` thành `${def.kind?'':`<em>${cell.tier}</em>`}`.

Trong `renderHome` và `renderBuilder`, hai biến đầu đổi thành:
```js
production=allCells(layout).filter(isProducing),ready=production.filter(cellReady).length
```
Ở `<main class="nr-builder ...">` của cả hai hàm thêm class `${anyWilted(layout)?'wilted':''}`.

- [ ] **Step 4: Bộ đếm, chạm ô, thu cục bộ**

`updateProductionTimers` — đếm cả huy hiệu tĩnh:
```js
  function updateProductionTimers(){let ready=document.querySelectorAll('.nr-production-badge[data-static-ready="1"]').length;document.querySelectorAll('.nr-production-badge[data-ready-at]').forEach(el=>{const left=+el.dataset.readyAt-Date.now(),isReady=left<=0;el.classList.toggle('ready',isReady);el.textContent=isReady?el.dataset.readyLabel:productionTime(left);if(isReady)ready++;});const all=document.querySelector('.nr-collect-all:not(.wilted)');if(all){all.disabled=!ready;all.classList.toggle('ready',!!ready);const strong=all.querySelector('strong');if(strong)strong.textContent=ready?'THU HOẠCH '+ready:'ĐANG SẢN XUẤT';}updateLockTimers();}
```

`gridCell`:
```js
  function gridCell(gx,gy){const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),cell=footprintOwner(layout,gx,gy,'stand');if(cell&&cellReady(cell))return collectResources(cell.uid);if(cell&&isCropCell(cell)&&isWiltedCell(cell)){if(typeof showToast==='function')showToast('Cây đang héo 🥀 — làm xong nhiệm vụ hôm nay để cây tươi rồi hái');return;}buildCell(gx,gy);}
```
(Task 10 sẽ đổi `layout.cells` sang khu đang mở; giữ nguyên ở bước này.)

`localCollect` — dự phòng mất mạng, cùng luật:
```js
  function localCollect(uid){const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),now=Date.now(),F=NightRaidRules.farmRules;let coins=0,soldiers=0;const room=()=>Math.max(0,100000-(+appState.coins||0));
    const sweep=cells=>cells.filter(cell=>{const def=NightRaidRules.itemById(cell.type);if(!def||(uid&&cell.uid!==uid))return true;
      if(def.producer==='coins'){if(cell.readyAt<=now&&room()){const gain=Math.min(def.yield,room());appState.coins=Math.max(0,+appState.coins||0)+gain;coins+=gain;cell.readyAt=now+def.productionMs;}return true;}
      if(def.producer==='soldier'){if(F.barracksReady(cell,farmDay())){layout.soldiers++;soldiers++;cell.lastDay=farmDay();}return true;}
      if(def.kind==='crop'){if(!cellReady(cell)||!room())return true;const gain=Math.min(def.yield,room());appState.coins=Math.max(0,+appState.coins||0)+gain;coins+=gain;return false;}
      return true;});
    layout.cells=sweep(layout.cells);layout.farms=layout.farms.map(f=>({cells:sweep(f.cells)}));appState.nightRaidLayout=layout;return{coins,soldiers};}
```

`collectResources` — nhận đồng hồ, nhớ cây vừa hái, nói rõ khi héo. Thêm biến module `let lastHarvest=[];` cạnh `let game=null,...`. Thay hàm:
```js
  async function collectResources(uid){const trigger=document.querySelector('.nr-collect-all');if(trigger)trigger.disabled=true;const synced=await syncHome(),res=synced&&synced.ok?await api('collect',{method:'POST',body:{uid:uid||''}}):{ok:false};let coins=0,soldiers=0,wiltedRefusal=false;if(res.ok&&res.data){adoptFarmClock(res.data);appState.nightRaidLayout=NightRaidRules.normalizeLayout(res.data.layout);coins=Math.max(0,Math.trunc(+res.data.collectedCoins||0));soldiers=+res.data.collectedSoldiers||0;wiltedRefusal=!!res.data.wilted&&!coins&&!soldiers;lastHarvest=Array.isArray(res.data.harvested)?res.data.harvested.filter(h=>NightRaidRules.farmRules.cropById(h.type)):[];
    // Trust the server's absolute balance only when it actually sent one.
    if(typeof res.data.coins==='number'&&Number.isFinite(res.data.coins))appState.coins=Math.max(0,Math.trunc(res.data.coins));else appState.coins=Math.max(0,(+appState.coins||0))+coins;}else{const local=localCollect(uid);coins=local.coins;soldiers=local.soldiers;}
    if(!coins&&!soldiers){if(typeof showToast==='function')showToast(wiltedRefusal?'Cây đang héo 🥀 — làm xong nhiệm vụ hôm nay để cây tươi rồi hái':(+appState.coins||0)>=100000?'Kho xu đã đầy':'Chưa có công trình sẵn sàng');if(view==='builder')renderBuilder();else if(view==='home')renderHome();return;}
    save();if(!res.ok)syncHome();if(typeof showToast==='function')showToast([coins?('+'+coins+' xu'):'',soldiers?('+'+soldiers+' lính'):''].filter(Boolean).join(' · ')+' đã thu hoạch');announce('Thu hoạch thành công');if(view==='builder')renderBuilder();else if(view==='home')renderHome();}
```
Chỗ hiện nút thu hoạch trong `renderBuilder` và `renderHome`, ngay sau `</button>` của `.nr-collect-all`, thêm `${replantHtml()}` với:
```js
  function replantHtml(){if(!lastHarvest.length)return'';const F=NightRaidRules.farmRules,cost=lastHarvest.reduce((s,h)=>s+(F.cropById(h.type)||{price:0}).price,0),balance=Math.max(0,Math.floor(+appState.coins||0)),short=Math.max(0,cost-balance);return `<button class="nr-replant ${short?'':'ready'}" type="button" onclick="nrReplant()" ${short?'disabled':''}>${svg('coin')}<span><strong>TRỒNG LẠI NHƯ CŨ</strong><small>${short?'thiếu '+short+' xu':lastHarvest.length+' ô · '+cost+' xu'}</small></span></button>`;}
```
(`nrReplant` được viết ở Task 11; ở task này chỉ cần nút xuất hiện.) Thêm export `replant` và wrapper `function nrReplant(){NightRaid.replant();}` cùng một hàm tạm `function replant(){}` để không đổ; Task 11 thay thân hàm.

`syncHome`: sau `if(res.ok&&res.data?.layout)...` thêm `if(res.ok)adoptFarmClock(res.data);`.
`refreshHome`: ngay sau `if(!res.ok||!res.data)return;` thêm `adoptFarmClock(res.data);`.

- [ ] **Step 5: CSS**

Thêm vào cuối `css/styles.css`:
```css
/* Farm on the castle grid: per-day sprites, wilt, task-day badges */
.nr-production-badge.wilted{background:#7a5a3a;color:#ffe9c9}
.nr-build-grid-cell .nr-placed.farm-item.crop{width:150%;height:150%;bottom:4%}
.nr-build-grid-cell .nr-placed.farm-item.farm.footprint-2{left:100%;bottom:-100%;width:205%;height:205%;z-index:4}
.nr-builder.wilted .nr-builder-map{filter:saturate(.72) sepia(.18)}
.nr-builder.wilted .nr-builder-map::after{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;background:url(../img/farm/dry-ground.webp) center/280px repeat;opacity:.16;mix-blend-mode:multiply}
.nr-replant{position:absolute;z-index:7;left:14px;bottom:88px;display:inline-flex;align-items:center;gap:8px;min-height:52px;padding:6px 14px;border:0;border-radius:18px;background:#fff;color:#3f6046;font-weight:950;box-shadow:0 8px 20px rgba(58,84,48,.18);cursor:pointer}
.nr-replant.ready{background:linear-gradient(145deg,#73cd58,#3ca845);color:#fff}
.nr-replant:disabled{opacity:.7;cursor:default}
.nr-replant small{display:block;font-size:10px;font-weight:800;opacity:.85}
```

- [ ] **Step 6: Chạy**

Run: `node tests/night-raid-builder-farm.test.js && node tests/night-raid-screens.test.js && node tests/night-raid-ui.test.js && node tests/home-yard-layout.test.js`
Expected: PASS. Nếu `night-raid-ui.test.js` ghim chuỗi `defenseById` trong nguồn, đổi kỳ vọng sang `itemById`.

- [ ] **Step 7: Commit**

```bash
git add js/night-raid.js css/styles.css tests/night-raid-builder-farm.test.js
git commit -m "feat(night-raid): builder draws crops per task-day, wilt, task-day barracks; adopts the farm clock

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Khu đang mở, tab SHOP, mua hạt và công trình, nông trại riêng, dỡ

**Files:**
- Modify: `js/night-raid.js` — trạng thái `builderZone`, `builderShopTab`; `buildSpaceFree`, `footprintOwner`, `buildPurchasePlan`, `showBuildPurchase`, `confirmBuildPurchase`, `buildCell`, `newBuildCell`, `selectBuild`, `beginBuildDrag`, `movePlacedItem`, `renderBuilder`; hàm mới `zoneOf`, `activeZone`, `shopItems`, `shopTabsHtml`, `zoneChipsHtml`, `selectShopTab`, `selectZone`, `buyFarmPlot`, `confirmFarmPlot`; export và wrapper
- Modify: `css/styles.css`
- Test: `tests/night-raid-builder-farm.test.js` (thêm suite)

- [ ] **Step 1: Thêm test (đỏ)**

```js
suite('builder farm: shop tabs and buying', () => {
  test('four tabs; seeds and farm buildings are priced cards; owned fields say "Mỗi loại 1 cái"', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    for (const t of ['Phòng thủ', 'Hạt giống', 'Nông trại', 'Mở rộng']) assert.truthy(html(w).includes(t), 'tab ' + t);
    w.ctx.NightRaid.selectShopTab('seeds');
    assert.truthy(html(w).includes('Bí ngô') && html(w).includes('8 ngày · +120 xu'), 'seed card copy');
    assert.truthy(html(w).includes("nrSelectBuild('pumpkin')"));
    w.ctx.NightRaid.selectShopTab('farm');
    assert.truthy(html(w).includes('Cối xay gió') && html(w).includes('8000 xu'));
    w.ctx.NightRaid.selectShopTab('defense');
    assert.truthy(html(w).includes('Mỗi loại 1 cái'), 'the owned rice field is capped in the shop');
  });
  test('planting a seed puts a crop on the tapped cell with day = farmDayCount, at = today, and charges the price', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectBuild('pumpkin');
    w.ctx.NightRaid.buildCell(10, 10, true);
    const crop = w.state.nightRaidLayout.cells.find(c => c.type === 'pumpkin' && c.gx === 10);
    assert.truthy(crop, 'the pumpkin was planted');
    assert.equal(crop.day, 5); assert.equal(crop.at, TODAY);
    assert.truthy(/^c-/.test(crop.uid));
    assert.equal(w.state.coins, 9000 - 20);
    assert.truthy(w.calls.some(c => c[0] === 'night-raid/home' && c[1] === 'PUT'), 'the layout is synced');
  });
  test('a second rice field is refused; a growing crop cannot be replaced; not enough coins is refused', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectBuild('rice-field');
    w.ctx.NightRaid.buildCell(0, 9, true);
    assert.equal(w.state.nightRaidLayout.cells.filter(c => c.type === 'rice-field').length, 1);
    assert.truthy(w.toasts.some(t => t.includes('Mỗi loại 1')));
    w.ctx.NightRaid.selectBuild('carrot');
    w.ctx.NightRaid.buildCell(1, 1, true);   // the growing tomato
    assert.equal(w.state.nightRaidLayout.cells.find(c => c.gx === 1 && c.gy === 1).type, 'tomato');
    w.state.coins = 2;
    w.ctx.NightRaid.buildCell(11, 11, true);
    assert.falsy(w.state.nightRaidLayout.cells.some(c => c.gx === 11 && c.gy === 11));
    assert.truthy(w.toasts.some(t => t.includes('Chưa đủ')));
  });
  test('removing a farm building refunds half its price', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectBuild('well'); w.ctx.NightRaid.buildCell(10, 4, true);
    assert.equal(w.state.coins, 8000);
    w.ctx.NightRaid.selectBuild('well'); w.ctx.NightRaid.buildCell(10, 4, true);   // same item on itself = remove
    assert.falsy(w.state.nightRaidLayout.cells.some(c => c.type === 'well'));
    assert.equal(w.state.coins, 8500);
  });
});

suite('builder farm: extra farm boards', () => {
  test('the Mở rộng tab sells one plot for 10000 up to three; buying adds a 6x6 board and switches to it', () => {
    const w = mount({ appState: { coins: 25000 } }); w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectShopTab('expand');
    assert.truthy(html(w).includes('Nông trại riêng') && html(w).includes('10000 xu') && html(w).includes('đã có 0/3'));
    w.ctx.NightRaid.buyFarmPlot(true);
    assert.equal(w.state.nightRaidLayout.farms.length, 1);
    assert.equal(w.state.coins, 15000);
    const out = html(w);
    assert.truthy(out.includes('NÔNG TRẠI 1'), 'a zone chip appears');
    assert.truthy(/nr-free-grid size-6/.test(out), 'the new board is 6x6');
    assert.falsy(out.includes('Phòng thủ'), 'no defense tab on a farm board');
    w.ctx.NightRaid.buyFarmPlot(true);
    assert.equal(w.state.nightRaidLayout.farms.length, 2);
    w.state.coins = 5000;
    w.ctx.NightRaid.buyFarmPlot(true);
    assert.equal(w.state.nightRaidLayout.farms.length, 2, 'not enough coins');
  });
  test('planting on a farm board lands in that farm; a defense cannot be placed there', () => {
    const w = mount({ appState: { nightRaidLayout: { cells: [], soldiers: 0, dogLane: 2, farms: [{ cells: [] }] } } });
    w.ctx.NightRaid.renderBuilder();
    w.ctx.NightRaid.selectZone(1);
    w.ctx.NightRaid.selectBuild('lettuce'); w.ctx.NightRaid.buildCell(2, 2, true);
    assert.equal(w.state.nightRaidLayout.farms[0].cells.length, 1);
    assert.equal(w.state.nightRaidLayout.cells.length, 0);
    w.ctx.NightRaid.selectBuild('stone-wall'); w.ctx.NightRaid.buildCell(0, 0, true);
    assert.equal(w.state.nightRaidLayout.farms[0].cells.length, 1, 'no wall on a farm');
    assert.truthy(w.toasts.some(t => t.includes('chỉ trồng cây')));
    w.ctx.NightRaid.selectBuild('barn'); w.ctx.NightRaid.buildCell(4, 4, true);
    assert.equal(w.state.nightRaidLayout.farms[0].cells.length, 2, 'a 2x2 barn fits at (4,4) on a 6x6 board');
    assert.truthy(w.state.nightRaidLayout.farms[0].cells.some(c => c.type === 'barn' && c.gx === 4 && c.gy === 4));
    w.ctx.NightRaid.selectZone(0);
    assert.truthy(/nr-free-grid[^"]*size-12/.test(html(w)) || html(w).includes('Lưới xây dựng 12'), 'back on the castle');
  });
});
```

Run: `node tests/night-raid-builder-farm.test.js`
Expected: FAIL — `selectShopTab is not a function`.

- [ ] **Step 2: Trạng thái khu và khay SHOP**

Trong dòng khai báo `let game=null,...` thêm `,builderZone=0,builderShopTab='defense'`.

Ngay sau helper `anyWilted` (Task 9) thêm:
```js
  // Which board the builder is editing: 0 = the castle grid, n = extra farm n.
  function zoneOf(layout,zone){const farms=layout.farms||[];zone=Math.max(0,Math.min(farms.length,Math.trunc(+zone||0)));return zone===0?{zone:0,cells:layout.cells,grid:NightRaidRules.BUILD_GRID,castle:true}:{zone,cells:farms[zone-1].cells,grid:NightRaidRules.farmRules.FARM_PLOT.size,castle:false};}
  function activeZone(layout){const z=zoneOf(layout,builderZone);builderZone=z.zone;return z;}
  const SHOP_TABS=[['defense','Phòng thủ'],['seeds','Hạt giống'],['farm','Nông trại'],['expand','Mở rộng']];
  function shopItems(tab){const F=NightRaidRules.farmRules;return tab==='defense'?NightRaidRules.DEFENSES:tab==='seeds'?F.CROPS:tab==='farm'?F.FARM_BUILDINGS:[];}
  function ownedCount(layout,id){return allCells(layout).filter(c=>c.type===id).length;}
  function shopCardHtml(d,layout){const capped=!!d.buyMax&&ownedCount(layout,d.id)>=d.buyMax,poor=(+appState.coins||0)<d.price;const stats=d.kind==='crop'?`<b class="producer">${d.days} ngày · +${d.yield} xu</b>`:d.kind==='farm'?`<b class="producer">Trang trí · ${d.footprint===2?'4 ô':'1 ô'}</b>`:buildStatHtml(d);
    return `<button type="button" draggable="${capped?'false':'true'}" class="nr-build-item ${selectedBuild===d.id?'selected':''} ${poor?'unaffordable':''} ${capped?'owned-max':''}" ${capped?'disabled':''} onclick="nrSelectBuild('${d.id}')" onpointerdown="nrBeginBuildDrag(event,'${d.id}')" ondragstart="nrNativeBuildDrag(event,'${d.id}')" aria-pressed="${selectedBuild===d.id}"><img class="nr-build-art" src="${buildAsset(d)}" alt=""><span class="nr-build-copy"><strong>${esc(d.name.vi)}</strong><small class="nr-item-stats">${capped?'<b class="producer">Mỗi loại 1 cái</b>':stats}</small><span class="nr-coin-price">${svg('coin')} ${d.price} xu</span></span></button>`;}
  function expandCardHtml(layout){const P=NightRaidRules.farmRules.FARM_PLOT,have=(layout.farms||[]).length,full=have>=P.max,poor=(+appState.coins||0)<P.price;return `<button type="button" class="nr-build-item nr-expand-item ${poor||full?'unaffordable':''}" ${full?'disabled':''} onclick="nrBuyFarmPlot()"><img class="nr-build-art" src="${buildAsset(P)}" alt=""><span class="nr-build-copy"><strong>${esc(P.name.vi)}</strong><small class="nr-item-stats"><b class="producer">Bàn cờ ${P.size}×${P.size} chỉ trồng cây · đã có ${have}/${P.max}</b></small><span class="nr-coin-price">${svg('coin')} ${P.price} xu</span></span></button>`;}
  function shopTabsHtml(zone){const tabs=SHOP_TABS.filter(([id])=>zone.zone===0||id!=='defense');return `<div class="nr-shop-tabs" role="tablist">${tabs.map(([id,label])=>`<button type="button" role="tab" class="${builderShopTab===id?'active':''}" aria-selected="${builderShopTab===id}" onclick="nrSelectShopTab('${id}')">${label}</button>`).join('')}</div>`;}
  function trayHtml(layout,zone){if(zone.zone>0&&builderShopTab==='defense')builderShopTab='seeds';if(builderShopTab==='expand')return expandCardHtml(layout);return shopItems(builderShopTab).map(d=>shopCardHtml(d,layout)).join('');}
  function zoneChipsHtml(layout){const farms=layout.farms||[];if(!farms.length)return'';const chips=[['LÂU ĐÀI',0]].concat(farms.map((f,i)=>['NÔNG TRẠI '+(i+1),i+1]));return `<div class="nr-zone-chips" role="tablist" aria-label="Chọn khu đất">${chips.map(([label,z])=>`<button type="button" role="tab" class="${builderZone===z?'active':''}" aria-selected="${builderZone===z}" onclick="nrSelectZone(${z})">${label}</button>`).join('')}</div>`;}
  function selectShopTab(tab){if(!SHOP_TABS.some(([id])=>id===tab))return;builderShopTab=tab;builderShopOpen=true;rememberBuilderWorld();renderBuilder();}
  function selectZone(zone){rememberBuilderWorld();builderZone=Math.max(0,Math.trunc(+zone||0));builderEditing=false;renderBuilder();}
```

- [ ] **Step 3: Đặt món theo khu**

Thay `buildSpaceFree` và `footprintOwner`:
```js
  function buildSpaceFree(layout,gx,gy,size,layer,ignoreCell,includeCastle=true){
    const z=activeZone(layout),G=z.grid,candidate={gx:+gx,gy:+gy,size:+size};
    if(candidate.gx<0||candidate.gy<0||candidate.gx+size>G||candidate.gy+size>G)return false;
    if(includeCastle&&z.castle&&layer==='stand'){
      const castle=layout.castleCell||CASTLE_HOME;
      if(NightRaidRules.rectsOverlap(candidate,{gx:+castle.gx,gy:+castle.gy,size:CASTLE_SIZE}))return false;
    }
    return !z.cells.some(cell=>cell!==ignoreCell&&buildRect(cell).layer===layer&&NightRaidRules.rectsOverlap(candidate,buildRect(cell)));
  }
  function footprintOwner(layout,gx,gy,layer){return activeZone(layout).cells.find(cell=>{const box=buildRect(cell);return box.layer===layer&&gx>=box.gx&&gx<box.gx+box.size&&gy>=box.gy&&gy<box.gy+box.size;})||null;}
```

Thay `buildPurchasePlan`:
```js
  function buildPurchasePlan(id,gx,gy){const def=NightRaidRules.itemById(id);if(!def)return null;const layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),z=activeZone(layout),G=z.grid,size=NightRaidRules.footprintFor(def);gx=Math.max(0,Math.min(G-size,Math.trunc(gx)));gy=Math.max(0,Math.min(G-size,Math.trunc(gy)));
    const isDefense=!!NightRaidRules.defenseById(def.id),layer=def.trap?'floor':'stand',cell=footprintOwner(layout,gx,gy,layer),at=cell?z.cells.indexOf(cell):-1,old=cell?NightRaidRules.itemById(cell.type):null,owned=ownedCount(layout,def.id);
    let cost=def.price,refund=0,remove=false,title='Mua '+def.name.vi+'?',detail=def.kind==='crop'?`Chiếm 1 ô · chín sau ${def.days} ngày làm xong nhiệm vụ · hái được ${def.yield} xu`:def.kind==='farm'?`Chiếm ${size===2?'4 ô':'1 ô'} · trang trí, không sản xuất`:def.producer==='soldier'?'Chiếm 4 ô · mỗi ngày làm xong nhiệm vụ cho 1 lính +20 DAM':def.producer==='coins'?`Chiếm 4 ô · thu hoạch ${def.yield} xu sau mỗi 24 giờ`:'Đặt tại hàng '+(gy+1)+', cột '+(gx+1);
    if(isDefense&&z.zone>0)return{error:'Nông trại riêng chỉ trồng cây và dựng công trình nông trại'};
    if(!cell&&!buildSpaceFree(layout,gx,gy,size,layer,null,true))return{error:size===2?'Cần một vùng trống 2 × 2 ô để đặt công trình':'Ô này đã có công trình'};
    if(cell&&(cell.gx!==gx||cell.gy!==gy||NightRaidRules.footprintFor(old)!==size))return{error:'Vùng đặt đang chồng lên công trình khác'};
    if(cell&&old&&old.kind==='crop')return{error:old.name.vi+' đang lớn, chờ hái rồi hãy trồng cây khác'};
    if(def.buyMax&&!cell&&owned>=def.buyMax)return{error:'Mỗi loại 1 cái — con đã có '+def.name.vi};
    if(def.maxOwned&&owned>=def.maxOwned&&(!cell||cell.type!==def.id))return{error:'Chỉ được đặt tối đa '+def.maxOwned+' '+def.name.vi};
    if(cell&&cell.type===def.id){
      if(def.kind==='farm'){remove=true;cost=0;refund=Math.floor(def.price*.5);title='Dỡ '+def.name.vi+'?';detail='Hoàn lại '+refund+' xu, ô này trống ra';}
      else if(def.producer)return{error:def.name.vi+' đang sản xuất, không cần nâng cấp'};
      else if(cell.tier>=3)return{error:def.name.vi+' đã đạt cấp tối đa'};
      else{cost=def.price*(cell.tier+1);title='Nâng '+def.name.vi+' lên cấp '+(cell.tier+1)+'?';detail='Công trình mạnh hơn ngay sau khi xác nhận';}}
    else if(cell){refund=Math.floor((old.kind==='farm'?old.price:totalPaid(old,cell.tier))*.5);title='Đổi sang '+def.name.vi+'?';detail='Thu lại '+refund+' xu từ '+old.name.vi+' hiện tại';}
    const balance=Math.max(0,Math.floor(+appState.coins||0)),balanceAfter=balance+refund-cost;if(balanceAfter<0)return{error:'Chưa đủ '+cost+' xu để mua '+def.name.vi};return{id:def.id,def,gx,gy,layout,zone:z.zone,layer,at,cell,cost,refund,remove,balance,balanceAfter,title,detail};}
```

Trong `showBuildPurchase`, đổi khối giá:
```js
<div class="nr-purchase-price"><span>${plan.remove?'Hoàn lại':'Giá'+(plan.refund?' sau hoàn xu':'')}</span><strong>${svg('coin')}${plan.remove?plan.refund:Math.max(0,plan.cost-plan.refund)} xu</strong></div>
```
và nút xác nhận: `${plan.remove?'Dỡ':'Xác nhận mua'}`.

Thay `buildCell`:
```js
  function buildCell(gx,gy,confirmed){if(!confirmed&&builderSuppressClick){builderSuppressClick=false;return;}if(!builderEditing&&!confirmed)return;const plan=buildPurchasePlan(selectedBuild,gx,gy);if(!plan)return;if(plan.error){if(typeof showToast==='function')showToast(plan.error);return;}if(!confirmed){showBuildPurchase(plan);return;}const {def,layout,at,cell,cost,refund}=plan,z=zoneOf(layout,plan.zone),G=z.grid,lane=Math.round(plan.gy*4/(G-1)),col=1+Math.round(plan.gx*7/(G-1));
    if(plan.remove){appState.coins=Math.max(0,(+appState.coins||0)+refund);z.cells.splice(at,1);}
    else if(cell&&cell.type===def.id){appState.coins-=cost;cell.tier++;}
    else if(cell){appState.coins=Math.max(0,(+appState.coins||0)+refund-cost);z.cells[at]=newBuildCell(def,lane,col,plan.gx,plan.gy);}
    else{appState.coins-=cost;z.cells.push(newBuildCell(def,lane,col,plan.gx,plan.gy));}
    rememberBuilderWorld();appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);builderEditing=false;builderShopOpen=false;save();syncHome();if(typeof showToast==='function')showToast((plan.remove?'Đã dỡ ':'Đã mua ')+def.name.vi+' · còn '+Math.floor(appState.coins)+' xu');announce((plan.remove?'Đã dỡ ':'Đã mua ')+def.name.vi);renderBuilder();}
```

Thay `newBuildCell`:
```js
  function newBuildCell(def,lane,col,gx,gy){const uid=(p)=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,10);
    if(def.kind==='crop')return{type:def.id,gx,gy,uid:uid('c-'),day:farmDay(),at:(farmCtx()&&farmCtx().today)||new Date(Date.now()+7*3600000).toISOString().slice(0,10)};
    if(def.kind==='farm')return{type:def.id,gx,gy,uid:uid('f-')};
    const cell={type:def.id,lane,col,gx,gy,tier:1};if(def.producer){cell.uid=uid('p-');if(def.perTaskDay)cell.lastDay=farmDay();else cell.readyAt=Date.now()+def.productionMs;}return cell;}
```

`selectBuild`: giữ như sau Task 9 (`if(NightRaidRules.itemById(id))`). Món phòng thủ chọn trên khu nông trại vẫn được chọn; `buildPurchasePlan` trả lỗi "Nông trại riêng chỉ trồng cây…" khi đặt, và tab Phòng thủ đã ẩn trên khu đó nên bé hầu như không gặp.

`movePlacedItem`: đổi `const layout=...,sameLayer=...,source=layout.cells.find(...)` thành `...,z=activeZone(layout),G=z.grid,source=z.cells.find(...)`; hai chỗ `NightRaidRules.BUILD_GRID-size` thành `G-size`; hai phép tính `lane`/`col` dùng `G-1`; phần còn lại giữ.

- [ ] **Step 4: Nông trại riêng**

Thêm sau `selectZone`:
```js
  function buyFarmPlot(confirmed){const P=NightRaidRules.farmRules.FARM_PLOT,layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),have=layout.farms.length,balance=Math.max(0,Math.floor(+appState.coins||0));
    if(have>=P.max){if(typeof showToast==='function')showToast('Con đã có đủ '+P.max+' nông trại riêng');return;}
    if(balance<P.price){if(typeof showToast==='function')showToast('Chưa đủ '+P.price+' xu để mua '+P.name.vi);return;}
    const plan={id:P.id,def:P,cost:P.price,refund:0,remove:false,balance,balanceAfter:balance-P.price,title:'Mua '+P.name.vi+' thứ '+(have+1)+'?',detail:`Một bàn cờ ${P.size}×${P.size} riêng, chỉ trồng cây và dựng công trình nông trại. Không bị cướp.`};
    if(!confirmed){showBuildPurchase(plan);return;}
    appState.coins=balance-P.price;layout.farms.push({cells:[]});appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);builderZone=layout.farms.length;builderShopTab='seeds';builderEditing=false;builderShopOpen=false;save();syncHome();if(typeof showToast==='function')showToast('Đã mua '+P.name.vi+' · còn '+Math.floor(appState.coins)+' xu');announce('Đã mua nông trại riêng');renderBuilder();}
```
`confirmBuildPurchase`:
```js
  function confirmBuildPurchase(){const pending=pendingBuildPurchase;if(!pending)return;pendingBuildPurchase=null;document.querySelector('.nr-purchase-backdrop')?.remove();if(pending.id==='farm-plot'){buyFarmPlot(true);return;}selectedBuild=pending.id;buildCell(pending.gx,pending.gy,true);}
```
`showBuildPurchase` đặt `pendingBuildPurchase={id:plan.id,gx:plan.gx,gy:plan.gy}` — giữ, `gx/gy` là `undefined` với nông trại riêng, không sao.

- [ ] **Step 5: `renderBuilder` theo khu**

Trong `renderBuilder`, sau `appState.nightRaidLayout=layout;` thêm `const z=activeZone(layout),G=z.grid;`. Vòng vẽ lưới: hai vòng `for` chạy tới `G`; `cellMap` dựng từ `z.cells`; `castleCovered` chỉ khi `z.castle`. Thay `<div class="nr-free-grid" role="grid" aria-label="Lưới xây dựng 12 nhân 12">` bằng `<div class="nr-free-grid size-${G}" role="grid" aria-label="Lưới xây dựng ${G} nhân ${G}">`. Ảnh lâu đài `<img id="nrEquippedCastle" ...>` thêm ` ${z.castle?'':'hidden'}`. Bảng tên: `<div class="nr-home-level"><span><small>${z.castle?'CẤP NHÀ':'NÔNG TRẠI '+z.zone}</small><strong>${z.castle?homeLevel:'🌱'}</strong></span><span class="nr-skin-name">${z.castle?esc((skin&&skin.name.vi)||'Thành Đá'):'Giá trị nông trại '+NightRaidRules.farmRules.farmValue(layout)}</span></div>`. Ngay sau `</section>` của `nr-builder-world` chèn `${zoneChipsHtml(layout)}`. Dòng `const tray=NightRaidRules.DEFENSES.map(...)` thay bằng `const tray=trayHtml(layout,z);`. Trong `<section class="nr-build-shop ...">`, thay `<span>Tối đa 2 trại · 4 mỗi loại nông trại</span>` bằng `<span>${builderShopTab==='defense'?'Mỗi loại ruộng 1 cái · tối đa 10 trại':builderShopTab==='seeds'?'Cây lớn 1 nấc mỗi ngày xong nhiệm vụ':builderShopTab==='farm'?'Trang trí, không sản xuất':'Thêm đất khi lâu đài hết chỗ'}</span>` và chèn `${shopTabsHtml(z)}` ngay trước `<div class="nr-build-tray"`. Với `paintEquippedCastle()`/`mountCastlePad()`: bọc `if(z.castle){paintEquippedCastle();}` — `mountCastlePad` được gọi ở đâu thì thêm cùng điều kiện (grep `mountCastlePad(`).

`gridCell(gx,gy)` (Task 9) dùng `footprintOwner` nên đã theo khu.

Export thêm `selectShopTab,selectZone,buyFarmPlot,` và wrapper:
```js
function nrSelectShopTab(id){NightRaid.selectShopTab(id);}
function nrSelectZone(z){NightRaid.selectZone(z);}
function nrBuyFarmPlot(){NightRaid.buyFarmPlot(false);}
```

- [ ] **Step 6: CSS**

```css
/* Farm shop tabs, zone chips, 6x6 farm board */
.nr-shop-tabs{display:flex;gap:6px;margin:0 0 10px;overflow-x:auto;scrollbar-width:none}.nr-shop-tabs button{flex:0 0 auto;min-height:36px;padding:0 13px;border:1px solid #d8e2ca;border-radius:999px;background:#fff;color:#4a684d;font-weight:900;cursor:pointer}.nr-shop-tabs button.active{background:linear-gradient(145deg,#ffe89a,#ffc65b);border-color:#e8ad3b;color:#644211}
.nr-zone-chips{position:absolute;z-index:7;left:50%;top:14px;transform:translateX(-50%);display:flex;gap:6px;padding:5px;border-radius:999px;background:rgba(255,251,238,.92);box-shadow:0 8px 20px rgba(74,63,37,.18)}.nr-zone-chips button{min-height:34px;padding:0 12px;border:0;border-radius:999px;background:transparent;color:#5b4a2c;font-size:11px;font-weight:950;letter-spacing:.06em;cursor:pointer}.nr-zone-chips button.active{background:#3f6046;color:#fff}
.nr-free-grid.size-6{grid-template-columns:repeat(6,minmax(0,1fr));grid-template-rows:repeat(6,minmax(0,1fr))}
.nr-free-grid.size-6 .nr-build-grid-cell .nr-placed.farm-item.crop{width:120%;height:120%;bottom:6%}
.nr-free-grid.size-6 .nr-build-grid-cell .nr-placed.farm-item.farm.footprint-2{width:190%;height:190%}
.nr-build-item.owned-max{opacity:.55;cursor:default}
.nr-builder.rotated .nr-zone-chips{top:auto;bottom:14px;left:50%}
```

- [ ] **Step 7: Chạy**

Run: `node tests/night-raid-builder-farm.test.js && node tests/night-raid-screens.test.js && node tests/night-raid-ui.test.js && node tests/home-yard-layout.test.js && node tests/night-raid-rules.test.js`
Expected: PASS. `night-raid-ui.test.js` có thể ghim chuỗi `Tối đa 2 trại · 4 mỗi loại nông trại` hoặc `const tray=NightRaidRules.DEFENSES.map` — đổi kỳ vọng sang chuỗi mới.

- [ ] **Step 8: Commit**

```bash
git add js/night-raid.js css/styles.css tests/night-raid-builder-farm.test.js tests/night-raid-ui.test.js
git commit -m "feat(night-raid): shop tabs sell seeds, farm buildings and extra 6x6 farms; remove refunds half

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Thanh nhiệm vụ, THU HOẠCH khi héo, TRỒNG LẠI NHƯ CŨ, đường vào học

**Files:**
- Modify: `js/night-raid.js` — hàm mới `taskBarHtml`, `goLearn`, `replant`; sửa nút `.nr-collect-all` trong `renderHome`/`renderBuilder`; export và wrapper
- Modify: `css/styles.css`
- Test: `tests/night-raid-builder-farm.test.js` (thêm suite)

- [ ] **Step 1: Thêm test (đỏ)**

```js
suite('builder farm: every screen points at today\'s tasks', () => {
  test('the task bar says how many tasks are left and what finishing does', () => {
    const w = mount(); w.ctx.NightRaid.renderBuilder();
    assert.truthy(html(w).includes('Hôm nay 0/1 nhiệm vụ · xong hết là cây lớn thêm 1 ngày'));
    assert.truthy(html(w).includes('nrGoLearn()'), 'Vào học is offered');
    w.ctx.NightRaid.renderHome();
    assert.truthy(html(w).includes('xong hết là cây lớn thêm 1 ngày'), 'the home stage has the bar too');
  });
  test('no tasks → "chưa có nhiệm vụ"; all done → "đã lớn hôm nay"; wilted → "đang héo"', () => {
    const none = mount({ appState: { dailyTask: { date: TODAY, tasks: [], allDone: false } } }); none.ctx.NightRaid.renderBuilder();
    assert.truthy(html(none).includes('Hôm nay chưa có nhiệm vụ'));
    assert.falsy(html(none).includes('nrGoLearn()'));
    const done = mount({ appState: { dailyTask: { date: TODAY, tasks: [{ id: 1, done: true }], allDone: true }, farmCtx: { today: TODAY, doneYesterday: false, doneToday: true } } }); done.ctx.NightRaid.renderBuilder();
    assert.truthy(html(done).includes('Cây đã lớn hôm nay'));
    const wilt = mount({ appState: { farmCtx: WILT } }); wilt.ctx.NightRaid.renderBuilder();
    assert.truthy(html(wilt).includes('Cây đang héo'));
  });
  test('when plants are wilted the harvest button becomes VÀO HỌC ĐỂ CÂY TƯƠI', () => {
    const w = mount({ appState: { farmCtx: WILT } }); w.ctx.NightRaid.renderBuilder();
    const out = html(w);
    assert.truthy(out.includes('VÀO HỌC ĐỂ CÂY TƯƠI'));
    assert.truthy(/nr-collect-all[^"]*\bwilted\b[^>]*onclick="nrGoLearn\(\)"/.test(out), 'the button leads to the tasks');
    assert.falsy(out.includes('THU HOẠCH 3'), 'nothing wilted counts as harvestable');
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
    const w = mount({ api: p => p === 'night-raid/collect' ? Promise.resolve(reply) : Promise.resolve({ ok: true, data: { ok: true } }) });
    w.ctx.NightRaid.renderBuilder();
    await w.ctx.NightRaid.collectResources();
    assert.truthy(html(w).includes('2 ô · 8 xu'), 'tomato 5 + lettuce 3');
    w.ctx.NightRaid.replant();
    const L = w.state.nightRaidLayout;
    const tomato = L.cells.find(c => c.type === 'tomato' && c.gx === 1 && c.gy === 1);
    const lettuce = L.farms[0].cells.find(c => c.type === 'lettuce' && c.gx === 0 && c.gy === 0);
    assert.truthy(tomato && lettuce, 'both seeds are back where they were');
    assert.equal(tomato.day, 6, 'planted at the dayCount the server just sent');
    assert.equal(w.state.coins, 9026 - 8);
    assert.falsy(html(w).includes('TRỒNG LẠI NHƯ CŨ'), 'the offer is spent');
  });
  test('replant is disabled and says how much is missing when the child is short', async () => {
    const reply = { ok: true, data: { layout: { cells: [], farms: [] }, coins: 3, collectedCoins: 120, collectedSoldiers: 0, harvested: [{ type: 'pumpkin', gx: 2, gy: 2, zone: 0 }], wilted: false, dayCount: 6, ctx: FRESH } };
    const w = mount({ api: p => p === 'night-raid/collect' ? Promise.resolve(reply) : Promise.resolve({ ok: true, data: { ok: true } }) });
    w.ctx.NightRaid.renderBuilder();
    await w.ctx.NightRaid.collectResources();
    assert.truthy(/nr-replant[^>]*disabled/.test(html(w)));
    assert.truthy(html(w).includes('thiếu 17 xu'));
    w.ctx.NightRaid.replant();
    assert.equal(w.state.nightRaidLayout.cells.length, 0, 'nothing planted');
  });
});
```

Run: `node tests/night-raid-builder-farm.test.js`
Expected: FAIL — không có thanh nhiệm vụ, `replant` rỗng.

- [ ] **Step 2: Thanh nhiệm vụ và đường vào học**

Thêm sau `zoneChipsHtml`:
```js
  // The one sentence every farm screen leads with: what today's tasks are
  // doing to the plants. Reads appState.dailyTask (kept fresh by
  // js/daily-task.js) and the wilt context the server sent.
  function taskBarHtml(layout){const s=(typeof DailyTask!=='undefined'&&DailyTask&&typeof DailyTask.state==='function')?DailyTask.state():(appState.dailyTask||null);const tasks=(s&&Array.isArray(s.tasks))?s.tasks:[],done=tasks.filter(t=>t&&t.done).length,allDone=tasks.length>0&&!!(s&&s.allDone),wilted=anyWilted(layout);
    const text=!tasks.length?'Hôm nay chưa có nhiệm vụ — cây đứng chờ':allDone?'Cây đã lớn hôm nay 🌱 · mai làm tiếp':wilted?`Cây đang héo 🥀 · xong ${tasks.length} nhiệm vụ là tươi lại`:`Hôm nay ${done}/${tasks.length} nhiệm vụ · xong hết là cây lớn thêm 1 ngày`;
    const cta=(!allDone&&tasks.length)?`<button type="button" class="nr-task-go" onclick="nrGoLearn()">Vào học</button>`:'';
    return `<div class="nr-task-bar ${allDone?'done':''} ${wilted?'wilted':''}" role="status"><span>${text}</span>${cta}</div>`;}
  // Out of Cướp Đêm and into the task list. A committed raid still asks first.
  function goLearn(){if(!confirmLeaveRaid())return;abandonRaid();cleanup();setNav(false);if(typeof DailyTask!=='undefined'&&DailyTask&&typeof DailyTask.open==='function')DailyTask.open();else if(typeof switchScreen==='function')switchScreen('dailyTaskScreen');}
```
Trong `renderHome` và `renderBuilder`, ngay sau `<div class="nr-builder-hud">…</div>` chèn `${taskBarHtml(layout)}`.

- [ ] **Step 3: Nút thu hoạch khi héo**

Ở cả hai hàm, thay biểu thức nút `.nr-collect-all` bằng (spec 3.8: có cây héo là nút đổi, kể cả khi ruộng hay trại đang sẵn — những thứ đó vẫn thu được bằng chạm riêng):
```js
${production.length?(anyWilted(layout)?`<button class="nr-collect-all wilted" type="button" onclick="nrGoLearn()">${svg('coin')}<span><strong>VÀO HỌC ĐỂ CÂY TƯƠI</strong><small>cây héo không hái được · xong nhiệm vụ là tươi lại</small></span></button>`:`<button class="nr-collect-all ${ready?'ready':''}" type="button" onclick="nrCollectResources()" ${ready?'':'disabled'}>${svg('coin')}<span><strong>${ready?'THU HOẠCH '+ready:'ĐANG SẢN XUẤT'}</strong><small>${power.soldiers} lính · ${production.length} công trình</small></span></button>`)+replantHtml():''}
```
(`replantHtml()` từ Task 9 chuyển vào đây; bỏ chỗ chèn cũ nếu trùng.)

- [ ] **Step 4: `replant`**

Thay hàm tạm `function replant(){}` bằng:
```js
  // Re-buy the seeds the last harvest took, on the same cells, in one PUT.
  function replant(){if(!lastHarvest.length)return;const F=NightRaidRules.farmRules,layout=NightRaidRules.normalizeLayout(appState.nightRaidLayout),plan=lastHarvest.filter(h=>F.cropById(h.type)),cost=plan.reduce((s,h)=>s+F.cropById(h.type).price,0),balance=Math.max(0,Math.floor(+appState.coins||0));
    if(balance<cost){if(typeof showToast==='function')showToast('Thiếu '+(cost-balance)+' xu để trồng lại như cũ');return;}
    let planted=0;for(const h of plan){const z=zoneOf(layout,h.zone);if(z.zone!==h.zone)continue;const def=F.cropById(h.type),saveZone=builderZone;builderZone=z.zone;const free=buildSpaceFree(layout,h.gx,h.gy,1,'stand',null,true);builderZone=saveZone;if(!free)continue;z.cells.push(newBuildCell(def,0,1,h.gx,h.gy));planted++;}
    if(!planted){lastHarvest=[];renderBuilder();return;}
    appState.coins=balance-cost;lastHarvest=[];appState.nightRaidLayout=NightRaidRules.normalizeLayout(layout);save();syncHome();if(typeof showToast==='function')showToast('Đã trồng lại '+planted+' ô · còn '+Math.floor(appState.coins)+' xu');announce('Đã trồng lại');if(view==='builder')renderBuilder();else renderHome();}
```
Export thêm `goLearn,replant,` (nếu `replant` chưa có) và wrapper `function nrGoLearn(){NightRaid.goLearn();}`.

- [ ] **Step 5: CSS**

```css
/* Task bar and wilted harvest button */
.nr-task-bar{position:absolute;z-index:7;left:14px;right:14px;top:74px;display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:44px;padding:6px 8px 6px 14px;border-radius:16px;background:rgba(255,251,238,.94);color:#3f4f2c;font-size:12px;font-weight:850;box-shadow:0 8px 20px rgba(74,63,37,.16)}
.nr-task-bar.done{background:#dcf6bd;color:#2f5d22}.nr-task-bar.wilted{background:#f6e3c6;color:#6b4a1f}
.nr-task-go{flex:0 0 auto;min-height:32px;padding:0 12px;border:0;border-radius:999px;background:#3f6046;color:#fff;font-weight:950;cursor:pointer}
.nr-collect-all.wilted{background:linear-gradient(145deg,#f0b46a,#c97a2a);color:#fff;cursor:pointer}.nr-collect-all.wilted:disabled{opacity:1}
.nr-builder.rotated .nr-task-bar{left:14px;right:96px;top:70px}
@media (max-width:700px){.nr-task-bar{top:70px;font-size:11px}}
```

- [ ] **Step 6: Chạy**

Run: `node tests/night-raid-builder-farm.test.js && node tests/night-raid-screens.test.js && node tests/night-raid-ui.test.js`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add js/night-raid.js css/styles.css tests/night-raid-builder-farm.test.js
git commit -m "feat(night-raid): task bar, wilted harvest button leads to the tasks, replant what was harvested

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phần E — Trang Daily Task

### Task 12: Hero, dải vườn, thẻ Home và khoảnh khắc thưởng nhắc vườn

**Files:**
- Modify: `js/daily-task.js` — `sig`, `refresh`, `celebrate`, `renderHomeCard`, `renderScreen`; hàm mới `farmOf`, `farmStripHtml`, `viewFarm`
- Modify: `css/styles.css`
- Create: `tests/daily-task-farm-ui.test.js`

- [ ] **Step 1: Viết test (đỏ)**

```js
// tests/daily-task-farm-ui.test.js — the task page says, in one glance, that
// finishing today's tasks grows the plants and skipping wilts them. Mounted the
// way tests/daily-task-client.test.js mounts js/daily-task.js.
const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const TODAY = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);

function load(opts) {
  opts = opts || {};
  const html = {}, calls = [];
  const el = id => ({ id, set innerHTML(v) { html[id] = String(v); }, get innerHTML() { return html[id] || ''; }, hidden: false, classList: { add() {}, remove() {}, contains: () => false } });
  const sandbox = {
    console, Date, Math, JSON, Object, Array, Promise, setTimeout, clearTimeout,
    document: { getElementById: id => el(id), querySelectorAll: () => [] },
    appState: opts.appState || {}, currentUser: 'kid',
    saveUserData: () => calls.push(['save']), showToast: m => calls.push(['toast', m]),
    switchScreen: s => { calls.push(['switchScreen', s]); return true; }, setBottomNavActive: () => {},
    openNightRaid: () => calls.push(['openNightRaid']),
    NightRaid: { renderBuilder: () => calls.push(['renderBuilder']) },
    createConfetti: () => {},
    EngAuth: { tokenFor: () => 'tok', api: async (p) => { calls.push(['api', p]); return opts.api ? opts.api(p) : { ok: false, data: null }; }, refreshFlags: () => {} },
  };
  sandbox.globalThis = sandbox; sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/daily-task-catalog.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'js/daily-task.js'), 'utf8'), ctx);
  return { DailyTask: ctx.DailyTask, html, calls, sandbox };
}
const TASKS = [{ id: 1, kind: 'phrases', label: 'Phrases practice', target: 1, count: 0, done: false }];
const farm = over => Object.assign({ crops: 4, ripe: 1, growing: 3, wiltedCount: 0, wilted: false, barracksReady: 0, preview: { id: 'tomato', g: 1, days: 2, wilted: false }, dayCount: 5, ctx: { today: TODAY, doneYesterday: true, doneToday: false } }, over || {});
const stateWith = over => ({ allowBot: true, dailyTask: Object.assign({ fetchedAt: Date.now(), date: TODAY, tasks: TASKS, allDone: false, rewardedToday: false, shields: { count: 0, activeUntil: 0 }, farm: farm() }, over || {}) });

suite('daily task farm ui: the hero and the strip', () => {
  test('growing: the hero promises growth and the strip shows the closest crop', () => {
    const { DailyTask, html } = load({ appState: stateWith() });
    DailyTask.renderScreen();
    const out = html.dailyTaskScreen;
    assert.truthy(out.includes('cây lớn thêm 1 ngày 🌱'), out.slice(0, 400));
    assert.truthy(out.includes('img/farm/tomato-day1.webp'), 'the preview crop at its day');
    assert.truthy(out.includes('3 cây đang lớn, 1 cây chín'));
    assert.truthy(out.includes('DailyTask.viewFarm()'));
  });
  test('wilted: the hero and the strip both say so, with the wilted sprite', () => {
    const { DailyTask, html } = load({ appState: stateWith({ farm: farm({ wilted: true, wiltedCount: 4, preview: { id: 'tomato', g: 1, days: 2, wilted: true }, ctx: { today: TODAY, doneYesterday: false, doneToday: false } }) }) });
    DailyTask.renderScreen();
    const out = html.dailyTaskScreen;
    assert.truthy(out.includes('Cây đang héo 🥀'));
    assert.truthy(out.includes('img/farm/tomato-wilted-old.webp'), 'g=1 of 2 is at half → old');
    assert.truthy(out.includes('4 cây đang héo'));
  });
  test('done: the hero says the plants grew today', () => {
    const { DailyTask, html } = load({ appState: stateWith({ allDone: true, rewardedToday: true, tasks: [{ id: 1, kind: 'phrases', label: 'P', target: 1, count: 1, done: true }], farm: farm({ ctx: { today: TODAY, doneYesterday: true, doneToday: true } }) }) });
    DailyTask.renderScreen();
    assert.truthy(html.dailyTaskScreen.includes('Cây đã lớn hôm nay 🌼'));
  });
  test('empty garden: the strip invites the child to the shop; no flag: no strip, no farm words', () => {
    const empty = load({ appState: stateWith({ farm: farm({ crops: 0, ripe: 0, growing: 0, preview: null }) }) });
    empty.DailyTask.renderScreen();
    assert.truthy(empty.html.dailyTaskScreen.includes('Vườn đang trống'));
    const plain = load({ appState: Object.assign(stateWith(), { allowBot: false }) });
    plain.DailyTask.renderScreen();
    assert.falsy(plain.html.dailyTaskScreen.includes('cây'), 'no farm copy without the flag');
    assert.truthy(plain.html.dailyTaskScreen.includes('+200 xu và 1 món quà'), 'the old hero copy stays');
  });
  test('Xem vườn opens Cướp Đêm and its builder', () => {
    const { DailyTask, calls } = load({ appState: stateWith() });
    DailyTask.viewFarm();
    assert.truthy(calls.some(c => c[0] === 'openNightRaid') && calls.some(c => c[0] === 'renderBuilder'));
  });
});

suite('daily task farm ui: the home card and the celebration', () => {
  test('a wilted garden changes the home card subtitle', () => {
    const { DailyTask, html } = load({ appState: stateWith({ farm: farm({ wilted: true }) }) });
    DailyTask.renderHomeCard();
    assert.truthy(html.dailyTaskCard.includes('Cây đang héo 🥀'));
  });
  test('refresh stores farm from the server and the celebration toast mentions the garden', async () => {
    const { DailyTask, calls, sandbox } = load({ appState: { allowBot: true }, api: () => ({ ok: true, data: { date: TODAY, tasks: [{ id: 1, kind: 'phrases', label: 'P', target: 1, count: 1, done: true }], allDone: true, rewardedToday: true, justRewarded: true, shields: { count: 0, activeUntil: 0 }, swords: { count: 0 }, pending: [TODAY], recent: [], farm: farm({ ripe: 2, ctx: { today: TODAY, doneYesterday: false, doneToday: true } }) } }) });
    await DailyTask.refresh('sync');
    assert.equal(sandbox.appState.dailyTask.farm.ripe, 2);
    const toast = calls.find(c => c[0] === 'toast');
    assert.truthy(toast && toast[1].includes('Cây tươi lại rồi 🌱') && toast[1].includes('2 cây chín'), toast && toast[1]);
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
```

Run: `node tests/daily-task-farm-ui.test.js`
Expected: FAIL — `viewFarm is not a function`, chuỗi vườn không có.

- [ ] **Step 2: Sửa `js/daily-task.js`**

a. Sau `function shieldsOf(s)` thêm:
```js
  // The garden summary the server attaches for early-access children
  // (functions/api/me/daily-tasks.js). Null when the flag is off.
  function farmOf(s) { return (typeof appState !== 'undefined' && appState && appState.allowBot && s && s.farm && typeof s.farm === 'object') ? s.farm : null; }
  function farmSprite(f) {
    if (!f || !f.preview || typeof FarmRules === 'undefined') return '';
    const p = f.preview, ctx = f.ctx || null;
    const cell = { type: p.id, day: 0, at: p.wilted ? '2000-01-01' : ((ctx && ctx.today) || '') };
    const wiltCtx = p.wilted ? { today: (ctx && ctx.today) || '2000-01-02', doneYesterday: false, doneToday: false } : null;
    const src = FarmRules.spriteFor(cell, p.g, wiltCtx);
    return src ? `<img class="dt-farm-art" src="${src}" alt="">` : '';
  }
```
(`spriteFor` chỉ cần `g` và trạng thái héo; `day: 0` với `dayCount = p.g` cho đúng `g`.)

b. `sig(s)`: thêm vào cuối chuỗi ` + '|' + (s.farm ? [s.farm.crops, s.farm.ripe, s.farm.growing, s.farm.wilted ? 1 : 0].join(':') : '')`.

c. Trong `refresh`, trong `Object.assign({ fetchedAt: ..., celebratedDate: ... }, armoryFrom(r.data))` thêm trường `farm: (r.data.farm && typeof r.data.farm === 'object') ? r.data.farm : null,` sau `rewardedToday`.

d. `celebrate(s)`:
```js
  function celebrate(s) {
    const n = Math.max(1, pendingOf(s).length);
    const f = farmOf(s);
    const garden = !f ? '' : (f.ctx && !f.ctx.doneYesterday ? ' · Cây tươi lại rồi 🌱' : ' · Cây lớn thêm 1 ngày 🌱') + (f.ripe ? ` · ${f.ripe} cây chín, đi hái nào` : '');
    toast('🎉 Xong nhiệm vụ hôm nay! +200 xu — có ' + n + ' phần thưởng chờ con chọn!' + garden);
    if (typeof createConfetti === 'function') { try { createConfetti(); } catch (e) {} }
  }
```

e. `renderHomeCard`: dòng `subtitle` — nhánh cuối đổi thành
```js
        : (farmOf(s) && farmOf(s).wilted && !s.allDone)
          ? `${done}/${tasks.length} nhiệm vụ · Cây đang héo 🥀 · làm nhiệm vụ để cứu cây`
          : `${done}/${tasks.length} nhiệm vụ · ${s.allDone ? 'Xong rồi! 🎉' : 'Bấm để xem'}`;
```

f. `renderScreen`: sau `const allDone = ...` thêm `const f = farmOf(s), wilted = !!(f && f.wilted && !allDone);`. Thay `heroSub`:
```js
    const heroSub = !tasks.length ? 'Đợi thầy cô giao bài nhé.'
      : stale ? 'Đang lấy kết quả hôm nay…'
      : allDone ? (f ? '+200 xu đã vào túi. Cây đã lớn hôm nay 🌼' : (pending.length ? 'Có quà đang chờ con mở 🎁' : '+200 xu đã vào túi. Mai lại có tiếp!'))
      : wilted ? 'Cây đang héo 🥀. Xong hết nhiệm vụ là cây tươi lại'
      : f ? 'Xong hết là +200 xu, 1 món quà, và cây lớn thêm 1 ngày 🌱'
      : 'Xong hết là được +200 xu và 1 món quà 🎁';
```
Sau `const hero = ...;` thêm:
```js
    const farmStrip = farmStripHtml(f);
```
và trong `host.innerHTML` chèn `${farmStrip}` ngay sau `${hero}`. Hàm:
```js
  function farmStripHtml(f) {
    if (!f) return '';
    const line = !f.crops ? 'Vườn đang trống. Xong nhiệm vụ rồi ghé SHOP mua hạt nhé'
      : f.wilted ? `${f.wiltedCount} cây đang héo`
      : `${f.growing} cây đang lớn, ${f.ripe} cây chín`;
    return `<section class="dt-farm ${f.wilted ? 'wilted' : ''}" aria-label="Vườn của con">
        ${farmSprite(f) || '<span class="dt-farm-art dt-farm-empty" aria-hidden="true">🌱</span>'}
        <div class="dt-farm-text"><strong>Vườn của con</strong><small>${line}</small></div>
        <button type="button" class="dt-farm-go" onclick="DailyTask.viewFarm()">Xem vườn</button>
      </section>`;
  }
  function viewFarm() {
    if (typeof openNightRaid === 'function') openNightRaid();
    if (typeof NightRaid !== 'undefined' && NightRaid && typeof NightRaid.renderBuilder === 'function') NightRaid.renderBuilder();
  }
```
Thêm `viewFarm` vào object trả về cuối module.

- [ ] **Step 3: CSS**

```css
/* Daily Task: the garden strip */
.dt-farm{display:grid;grid-template-columns:56px minmax(0,1fr) auto;align-items:center;gap:10px;margin:10px 14px 0;padding:10px 12px;border-radius:18px;background:#eef7dd;color:#2f4632}
.dt-farm.wilted{background:#f6e3c6;color:#6b4a1f}
.dt-farm-art{width:56px;height:56px;object-fit:contain;display:grid;place-items:center;font-size:30px}
.dt-farm-text strong{display:block;font-size:13px}.dt-farm-text small{display:block;font-size:12px;opacity:.85}
.dt-farm-go{min-height:36px;padding:0 12px;border:0;border-radius:999px;background:#3f6046;color:#fff;font-weight:950;cursor:pointer}
```

- [ ] **Step 4: Chạy**

Run: `node tests/daily-task-farm-ui.test.js && node tests/daily-task-client.test.js`
Expected: PASS. `daily-task-client.test.js` không có `allowBot` trong `appState` nên chữ cũ giữ nguyên.

- [ ] **Step 5: Commit**

```bash
git add js/daily-task.js css/styles.css tests/daily-task-farm-ui.test.js
git commit -m "feat(daily-task): the task page shows the garden — grow when done, wilt when skipped

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Phần F — Bản kê, toàn suite, ra mắt

### Task 13: `npm run verify` biết nông trại

**Files:**
- Modify: `tests/verify/client.js:526-541` (mục `nightRaidScreen`)
- Modify: `tests/verify/manifest.js:94-98` (mục `night-raid`)

- [ ] **Step 1: Lớp client mở SHOP và thấy tab Hạt giống**

Trong `tests/verify/client.js`, mục `nightRaidScreen`, hàm `prove` đổi thành:
```js
      prove: (h, el) => {
        const text = squash(el.textContent);
        for (const chip of ['DAM', 'DEF', 'LÍNH']) must(text.includes(chip), 'the ' + chip + ' chip is drawn');
        must(wiredTo(el, 'nrShowLiveTargets').length >= 1 || text.includes('CƯỚP ĐÊM'), 'the raid action is offered');
        must(text.includes('nhiệm vụ'), 'the task bar ties the garden to today\'s tasks');
        // The farm lives in the builder's SHOP: seeds, farm buildings, extra farms.
        h.sandbox.nrShowBuilder();
        const shop = squash(el.textContent);
        for (const tab of ['Hạt giống', 'Nông trại', 'Mở rộng']) must(shop.includes(tab), 'SHOP has the ' + tab + ' tab');
        h.sandbox.nrSelectShopTab('seeds');
        const seeds = squash(el.textContent);
        const rules = h.peek('FarmRules');
        const names = rules ? rules.CROPS.map(c => c.name.vi) : ['Rau cải', 'Bí ngô'];
        for (const n of names) must(seeds.includes(n), 'seed ' + n + ' is for sale');
        return 'castle yard with DAM/DEF/LÍNH, task bar, SHOP with ' + names.length + ' seeds';
      },
```
Nếu `h.peek` không tồn tại trong file này, dùng `h.sandbox.FarmRules`.

- [ ] **Step 2: Bản kê tính năng nói rõ vườn thuộc Cướp Đêm**

`tests/verify/manifest.js`, mục `night-raid` đổi `name` thành `'Cướp Đêm và nông trại theo ngày nhiệm vụ'`. Không thêm màn hình hay route: vườn dùng đúng `nightRaidScreen` và các route `night-raid/home`, `night-raid/collect` đã kê.

- [ ] **Step 3: Chạy**

Run: `npm run verify 2>&1 | tail -30`
Expected: mọi lớp xanh. Nếu lớp client đỏ ở `nrSelectShopTab` vì `h.sandbox` chưa có hàm (nạp trước khi `js/night-raid.js` chạy), kiểm thứ tự script trong `index.html`: `farm-rules.js`, `farm-art-manifest.js`, `night-raid-rules.js`, `night-raid.js`.

- [ ] **Step 4: Commit**

```bash
git add tests/verify/client.js tests/verify/manifest.js
git commit -m "test(verify): the client layer proves the farm shop is on the castle builder

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Toàn suite, kiểm tay trên trình duyệt, ra mắt cho vài bé

- [ ] **Step 1: Toàn suite ở HEAD sạch**

```bash
git status --porcelain
npm test 2>&1 | tail -15
```
Expected: cây sạch, dòng tổng kết không có FAIL. Sửa mọi test đỏ còn lại theo tinh thần từng task (bỏ điều cũ, giữ luật), commit riêng `test: settle the last farm references`.

- [ ] **Step 2: Kiểm tay**

Mở preview theo `.claude/launch.json` (server tĩnh), đăng nhập một tài khoản có cờ, vào Arena → Cướp Đêm → XÂY NHÀ:
- SHOP có 4 tab; kéo một hạt vào ô trống → mầm xuất hiện, xu giảm, huy hiệu "còn N ngày".
- Tab Mở rộng → mua Nông trại riêng → chip NÔNG TRẠI 1 và bàn cờ 6×6, tab Phòng thủ biến mất.
- Thanh nhiệm vụ đúng chữ; nút Vào học mở trang Daily Task; trang đó có dải vườn với hình cây vừa trồng.
- Máy chủ local: chạy Pages Functions + D1 theo công thức trong bộ nhớ dự án nếu cần xem `dayCount` đổi sau khi xong nhiệm vụ.

- [ ] **Step 3: Deploy**

Không có migration. Cây sạch rồi mới chạy:
```bash
scripts/deploy.sh -m "feat: nông trại theo ngày nhiệm vụ, gỡ chế độ bot"
```
`deploy.sh` tự bump bốn mốc phiên bản, chạy suite, commit bốn file đó và deploy Cloudflare Pages. Không `git push` lên GitHub.

- [ ] **Step 4: Bật cho vài bé**

Trang admin → bật cờ (nhãn mới "🌱 Chơi trước") cho các bé test, giao cho mỗi bé ít nhất một nhiệm vụ. Ghi lại ngày bật để sau vài tuần đối chiếu `daily_task_rewards` và `layout_json`.

- [ ] **Step 5: Tranh thật**

Khi có ảnh gốc, làm Task 8 Step 5 và deploy lại.

---

## Tự soát kế hoạch theo spec

| Mục spec | Task |
|---|---|
| 3.1–3.2 ba câu, ngày nông trại từ `daily_task_rewards` | 1, 3 |
| 3.3 héo, tươi lại, héo chặn hái | 1 (`isWilted`), 5 (collect), 9 (vẽ, chạm), 11 (nút) |
| 3.4 sáu cây, `days + 1` hình, hai hình héo, nhãn "còn N ngày" | 1, 7, 9 |
| 3.5 trồng trên lưới lâu đài; nông trại riêng 6×6, tối đa 3, 10.000, chip | 2, 4, 10 |
| 3.6 tám công trình, dỡ hoàn 50%, giá trị nông trại, không ảnh hưởng cấp nhà | 1, 2 (`homeLevel` bỏ qua), 10 |
| 3.7 ruộng cũ giữ 24 giờ, mua mới tối đa 1, không xóa ruộng đã có; trại lính theo ngày, trần 10, chuyển đổi | 2, 4, 5 |
| 3.8 THU HOẠCH, hái riêng, VÀO HỌC ĐỂ CÂY TƯƠI, TRỒNG LẠI NHƯ CŨ | 5 (`uid`, `harvested`), 9, 11 |
| 3.9 bỏ chế độ bot | kế hoạch `2026-09-04-remove-bot-modes.md` |
| 4.1–4.6 không bảng mới, `layout_json`, đóng dấu server, `collect`, cờ, mất mạng (`localCollect`) | 2–6, 9 |
| 5.1 màn xây nhà | 9–11 |
| 5.2 trang Daily Task | 6, 12 |
| 5.3 sân chó | 9 (`yardBuildingsHtml` dùng `cellArt`) |
| 6 tranh, bản kê, script, test tồn tại | 7, 8 |
| 7 kiểm thử | mỗi task; `npm run verify` ở 13 |
| 8 ra mắt | 14 |

Tên dùng xuyên các task, kiểm nhất quán: `FarmRules.{CROPS, FARM_BUILDINGS, FARM_PLOT, byId, cropById, isCrop, progress, isWilted, spriteFor, allCells, farmValue, barracksReady, spriteNames, art}`; `NightRaidRules.{itemById, farmRules, normalizeLayout(value, opts)}`; ô cây `{type, gx, gy, uid, day, at}`; trại lính `lastDay`; `layout.farms[i].cells`; `appState.farmDayCount`, `appState.farmCtx`; server `farmClock → { dayCount, ctx }`, `farmSummary`; collect trả `harvested`, `wilted`; client `zoneOf`, `activeZone`, `builderZone`, `builderShopTab`, `selectShopTab`, `selectZone`, `buyFarmPlot(confirmed)`, `taskBarHtml`, `goLearn`, `replant`, `lastHarvest`; wrapper `nrSelectShopTab`, `nrSelectZone`, `nrBuyFarmPlot`, `nrGoLearn`, `nrReplant`; daily-task `farmOf`, `farmStripHtml`, `viewFarm`.

