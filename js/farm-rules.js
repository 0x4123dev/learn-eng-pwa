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
    { id: 'lettuce', kind: 'crop', name: { en: 'Lettuce', vi: 'Rau cải' },  days: 1, price: 3,  yield: 40 },
    { id: 'tomato',  kind: 'crop', name: { en: 'Tomato',  vi: 'Cà chua' },  days: 2, price: 5,  yield: 90 },
    { id: 'carrot',  kind: 'crop', name: { en: 'Carrot',  vi: 'Cà rốt' },   days: 3, price: 8,  yield: 150 },
    { id: 'rice',    kind: 'crop', name: { en: 'Rice',    vi: 'Lúa' },      days: 4, price: 10, yield: 225 },
    { id: 'rose',    kind: 'crop', name: { en: 'Rose',    vi: 'Hoa hồng' }, days: 6, price: 15, yield: 400 },
    { id: 'pumpkin', kind: 'crop', name: { en: 'Pumpkin', vi: 'Bí ngô' },   days: 8, price: 20, yield: 600 },
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
  // The three plots have identical capacity and price. `style` is presentation
  // only, but it belongs in the saved layout so a child's choice survives a
  // refresh, another device and every server-side normalize pass.
  const FARM_PLOT_STYLES = freeze([
    { id: 'stone',  asset: 'farm-plot-stone',  name: { en: 'Royal stone garden', vi: 'Vườn Thành Đá' } },
    { id: 'hedge',  asset: 'farm-plot-hedge',  name: { en: 'Flower hedge garden', vi: 'Vườn Hàng Hoa' } },
    { id: 'clover', asset: 'farm-plot-clover', name: { en: 'Magic clover garden', vi: 'Vườn Cỏ May Mắn' } },
  ]);
  function plotStyle(id) { return FARM_PLOT_STYLES.find(s => s.id === id) || FARM_PLOT_STYLES[0]; }
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
  // The shared barracks clock trains progressively: soldier 1 needs one completed Daily
  // Task day, soldier 2 needs two, then three, four, and five for soldier 5
  // and every soldier after it. `lastDay` is the number of task-days already
  // consumed; `soldierCycles` is how many synchronized batches the account's
  // barracks have produced. Keeping those counters means extra days stay banked if the child
  // does not open the estate immediately after a soldier becomes ready.
  function barracksGoal(cell) {
    return Math.min(5, int(cell && cell.soldierCycles, 0, 1e9) + 1);
  }
  function barracksProgress(cell, dayCount) {
    const goal = barracksGoal(cell);
    const valid = Number.isFinite(+(cell && cell.lastDay));
    const done = valid ? Math.min(goal, Math.max(0, int(dayCount, 0, 1e9) - int(cell.lastDay, 0, 1e9))) : 0;
    return { done, goal, left: goal - done, ready: valid && done >= goal, soldier: int(cell && cell.soldierCycles, 0, 1e9) + 1 };
  }
  // A legacy cell that still carries readyAt and no lastDay is not ready: the
  // server converts it on its next read (night-raid-rules normalizeLayout).
  function barracksReady(cell, dayCount) {
    return barracksProgress(cell, dayCount).ready;
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

  return Object.freeze({ CROPS, FARM_BUILDINGS, FARM_PLOT, FARM_PLOT_STYLES, ITEMS, DATE_RE, byId, cropById, isCrop, isFarmBuilding,
    plotStyle, footprintFor, art, progress, isWilted, spriteFor, allCells, farmValue, barracksGoal, barracksProgress, barracksReady, spriteNames });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = FarmRules;
