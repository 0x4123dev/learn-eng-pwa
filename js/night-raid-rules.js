// Home & farm rules — the layout grammar the builder (js/night-raid.js) and
// the server (functions/api/_night-raid.js) share: which items exist, what
// they cost, how big they are, how a saved layout is cleaned, how the home
// level is scored, where extra farm plots dock, how the barracks parade forms.
// Renderer-free and deterministic: keep DOM, canvas, Date and network access
// out of this module. It is a plain UMD file — a browser global here, a
// require() on the server — so no import/export syntax.
// The battle simulation that used to live here (raiders, ticks, training
// targets, combat power, swords) went with the Arena in September 2026.
var NightRaidRules = (() => {
  'use strict';

  // Farm items (crops, farm buildings) are defined in js/farm-rules.js. The
  // browser loads that file first (index.html); Node and the Pages bundle
  // require it. Kept out of DEFENSES on purpose: homeLevel only ever looks
  // at DEFENSES, so planting can never change the home level.
  const Farm = typeof FarmRules !== 'undefined' ? FarmRules
    : (typeof require === 'function' ? require('./farm-rules.js') : null);

  // Old layouts (and buildCell, for compatibility) still carry a lane/col pair
  // per defence, mapped from the free grid; these are the sizes of that
  // legacy 5 × 8 board, kept so a stored cell without gx/gy lands somewhere.
  const LANES = 5;
  const COLS = 8;
  const BUILD_GRID = 12;
  // Extra farms snap into square docks touching the four straight edges of the
  // castle land. The farm is 38% of the board width (and therefore about 51%
  // of its height), so these eight docks never overlap and leave almost no
  // wasted meadow between the two plots.
  const FARM_PLOT_DOCKS = Object.freeze([
    Object.freeze({ x:0, y:-51 }), Object.freeze({ x:62, y:-51 }),
    Object.freeze({ x:100, y:0 }), Object.freeze({ x:100, y:51 }),
    Object.freeze({ x:62, y:100 }), Object.freeze({ x:0, y:100 }),
    Object.freeze({ x:-38, y:51 }), Object.freeze({ x:-38, y:0 }),
  ]);
  const FARM_PLOT_POSITIONS = Object.freeze([
    FARM_PLOT_DOCKS[7], FARM_PLOT_DOCKS[1], FARM_PLOT_DOCKS[3],
  ]);
  const FARM_PLOT_BOUNDS = Object.freeze({ minX:-38, maxX:100, minY:-51, maxY:100 });
  function nearestFarmPlotDock(x,y,taken){
    x=Number.isFinite(+x)?+x:0;y=Number.isFinite(+y)?+y:0;taken=taken||new Set();
    let best=null,bestDistance=Infinity;FARM_PLOT_DOCKS.forEach(dock=>{
      if(taken.has(dock.x+':'+dock.y))return;
      const distance=(dock.x-x)*(dock.x-x)+(dock.y-y)*(dock.y-y);
      if(distance<bestDistance){best=dock;bestDistance=distance;}
    });return best||FARM_PLOT_DOCKS[0];
  }
  // The castle is the one building every other thing is arranged around, so it
  // is the biggest thing on the board: three cells square against the two of a
  // barracks and the one of a trap. Every place that reserves, draws or drags
  // the castle reads this — the footprint used to be the literal 2 in six
  // different files, which is how the drawn castle and its reserved ground
  // drifted apart. Four cells swallowed a sixth of the land and looked bulky;
  // three still towers over everything without crowding the base.
  const CASTLE_SIZE = 3;
  const PRODUCTION_MS = 24 * 60 * 60 * 1000;
  // Lính KHÔNG còn giới hạn: bé nuôi bao nhiêu cũng được. Chỉ còn hai con số:
  //   ARMY_DISPLAY_CAP   nhiều nhất bấy nhiêu con lính đi lại trên bãi cỏ —
  //                      thuần trình bày, HUD vẫn hiện số thật.
  //   SOLDIER_SANITY_CAP chặn trên phòng dữ liệu hỏng (NaN, Infinity, số rác
  //                      từ localStorage cũ). Đây KHÔNG phải luật chơi.
  const ARMY_DISPLAY_CAP = 10;
  const SOLDIER_SANITY_CAP = 1000000;
  // Visual identities trained by the barracks. Production awards one
  // ordinary soldier per owned barracks; the stock index only chooses which
  // complete atlas row represents that soldier on the parade lawn.
  const SOLDIER_VARIANTS = Object.freeze([
    'goblin-swordsman','fox-knight','bat-mage','bomb-rat',
    'puppy-knight','wood-guard','rabbit-lancer','turtle-knight',
    'bear-hammer-guard','lion-axe-captain',
  ]);
  const SOLDIER_VARIANT_COUNT = SOLDIER_VARIANTS.length;
  const soldierVariantFor = index => int(index, 0, SOLDIER_SANITY_CAP) % SOLDIER_VARIANT_COUNT;

  // ---- Parade formation on the home lawn -----------------------------------
  // The soldier sprite is sized in PERCENT of the yard: 6.4% of the width in
  // the full yard, 7.8% in the mini-map (css .nr-home-soldier), and it is 1.5×
  // wider than tall. Both maps are 4:3, so at its largest a soldier covers
  // ARMY_SPRITE_W of the width and ARMY_SPRITE_H of the height.
  //
  // The first version spaced the ranks 4.25% apart horizontally and 4.2%
  // vertically — BELOW the sprite size. Four soldiers overlapped by about a
  // third each and read as two on screen, so a child who had harvested four
  // could only count two. Keep both steps above the widest sprite: the whole
  // point of the parade is that the child can count the army.
  // tests/night-raid-army.test.js pins the no-overlap invariant.
  const ARMY_SPRITE_W = 7.8;
  const ARMY_SPRITE_H = (ARMY_SPRITE_W / 1.5) * (4 / 3);
  const ARMY_GAP = 8.2;
  const ARMY_ROW_STEP = 7.4;

  // Slots are offsets in percent from the squad's anchor point: x from its
  // centre, y downwards. Up to five soldiers stand in one rank; a bigger squad
  // forms a second rank behind, nudged half a step sideways so the back rank
  // shows between the shoulders of the front one.
  function armySlots(count) {
    const n = int(count, 0, ARMY_DISPLAY_CAP);
    const cols = n <= 5 ? Math.max(1, n) : Math.min(5, Math.ceil(n / 2));
    const slots = [];
    for (let i = 0; i < n; i++) {
      const rank = i >= cols ? 1 : 0;
      const col = i % cols;
      const rankCount = rank ? n - cols : Math.min(n, cols);
      slots.push({
        x: (col - (rankCount - 1) / 2) * ARMY_GAP + (rank ? ARMY_GAP * 0.48 : 0),
        y: rank * ARMY_ROW_STEP,
        row: soldierVariantFor(i),
      });
    }
    return slots;
  }
  const DEFENSES = Object.freeze([
    Object.freeze({ id:'pebble-pup', name:{en:'Pebble Pup',vi:'Cún Bắn Đá'}, price:2000, stat:'damage', attack:22, defense:8, hp:42, damage:8, cooldown:1500, ranged:true, color:'#f5b85c' }),
    Object.freeze({ id:'wood-fence', name:{en:'Wooden Fence',vi:'Hàng Rào Gỗ'}, price:3000, stat:'defense', attack:0, defense:45, hp:120, blocker:true, material:'wood', color:'#a76d3e' }),
    Object.freeze({ id:'stone-wall', name:{en:'Stone Wall',vi:'Tường Đá'}, price:5000, stat:'defense', attack:0, defense:80, hp:300, blocker:true, material:'stone', color:'#91a0b2' }),
    Object.freeze({ id:'spike-trap', name:{en:'Spike Trap',vi:'Bẫy Gai'}, price:3000, stat:'both', attack:16, defense:25, hp:45, trap:true, damage:5, color:'#adb5bd' }),
    Object.freeze({ id:'water-cannon', name:{en:'Water Cannon',vi:'Pháo Nước'}, price:5000, stat:'damage', attack:50, defense:10, hp:48, damage:12, cooldown:2000, ranged:true, splash:true, color:'#50c9ff' }),
    Object.freeze({ id:'training-barracks', asset:'training-barracks.webp', name:{en:'Training Barracks',vi:'Trại Huấn Luyện'}, price:8000, stat:'producer', footprint:2, attack:0, defense:0, producer:'soldier', yield:1, perTaskDay:true, maxOwned:10, color:'#d8783d' }),
    Object.freeze({ id:'rice-field', asset:'rice-field.webp', name:{en:'Rice Field',vi:'Ruộng Lúa'}, price:6000, stat:'producer', footprint:2, attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, buyMax:1, color:'#e5b93d' }),
    Object.freeze({ id:'tomato-field', asset:'tomato-field.webp', name:{en:'Tomato Garden',vi:'Vườn Cà Chua'}, price:6000, stat:'producer', footprint:2, attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, buyMax:1, color:'#ef5544' }),
    Object.freeze({ id:'fish-pond', asset:'fish-pond.webp', name:{en:'Koi Fish Pond',vi:'Ao Cá Koi'}, price:6000, stat:'producer', footprint:2, attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, buyMax:1, color:'#38a9d6' }),
  ]);

  const byId = (list, id) => list.find(item => item.id === id) || null;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));
  const int = (n, lo, hi) => Math.trunc(clamp(n, lo, hi));
  const itemById = id => byId(DEFENSES, id) || (Farm ? Farm.byId(id) : null);
  const footprintFor = value => {
    const def=typeof value==='string'?itemById(value):value;
    return def&&def.footprint===2?2:1;
  };
  const rectsOverlap=(a,b)=>a.gx<b.gx+b.size&&a.gx+a.size>b.gx&&a.gy<b.gy+b.size&&a.gy+a.size>b.gy;

  const UID_RE=/^[A-Za-z0-9-]{8,64}$/,DATE_RE=/^\d{4}-\d{2}-\d{2}$/;
  // One board's worth of cells → clean cells. `grid` is the board size (12 for
  // the castle, 6 for an extra farm); `occupied` is seeded with the castle on
  // the main board and empty on a farm; `allowDefense` is false on a farm.
  // `seenUids` is shared across every board of one layout. A uid is a cell's
  // identity: home.js PUT keeps the SERVER's crop/field clocks for a cell whose
  // uid it already knows, and stamps every barracks from the account's shared
  // training clock. A layout carrying the same uid twice once let a
  // client clone one grown plant into a whole field of ripe ones — 20 xu of
  // pumpkin seed harvested as 11,520 xu, and lootable_coins is what other
  // children steal from, so it minted money into the shared economy. A uid may
  // therefore appear at most once in a layout; later claimants are dropped.
  // `now` is the wall clock, and only a caller that HAS one (the server) passes
  // it — it decides whether a legacy barracks timer had already elapsed.
  function normalizeCells(rawCells, grid, occupied, allowDefense, dayCount, today, seenUids, now) {
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
      // Reject a repeated uid HERE, before the cell reserves a grid square or a
      // maxOwned slot — rejecting it later made the clone cost a legitimate cell
      // its place, so a child with five fields and one duplicated uid kept three.
      const claim=String(cell&&cell.uid||'');
      if(claim&&seenUids.has(claim))return;
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
      const uid=claim;
      if(UID_RE.test(uid))seenUids.add(uid);
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
      // The legacy lane/col pair rides along for older readers of the layout.
      const lane = Math.round(gy * (LANES - 1) / (BUILD_GRID - 1));
      const col = 1 + Math.round(gx * (COLS - 1) / (BUILD_GRID - 1));
      const entry={ type:type.id, lane, col, gx, gy, tier:type.producer?1:int(cell.tier || 1, 1, 3) };
      if(type.producer){
        if(UID_RE.test(uid))entry.uid=uid;
        if(type.perTaskDay){
          // Barracks pay on the progressive 1,2,3,4,5,5… task-day schedule.
          // A cell that still carries the
          // old 24h clock converts the first time the SERVER normalizes it
          // (it alone knows dayCount); a client without dayCount leaves the
          // legacy clock in place and FarmRules.barracksReady says "not yet".
          //
          // lastDay = dayCount means "no completed task-day is banked", so converting
          // a barracks whose old 24h timer had ALREADY run out silently threw
          // away a soldier the child had earned and not yet collected. When
          // the caller knows the wall clock, an elapsed timer converts one day
          // BEHIND so that owed soldier is collectable on the very next
          // collect. Without `now` we cannot tell an elapsed timer from a
          // running one, so we keep the safe stamp: a client has no clock the
          // server trusts and must never be able to mint a soldier.
          const legacyAt=Number.isFinite(+(cell&&cell.readyAt))?Math.max(0,Math.trunc(+cell.readyAt)):null;
          if(Number.isFinite(+(cell&&cell.lastDay)))entry.lastDay=int(cell.lastDay,0,1e9);
          else if(dayCount!==null)entry.lastDay=(now!==null&&legacyAt!==null&&legacyAt<=now)?Math.max(0,dayCount-1):dayCount;
          else if(legacyAt!==null)entry.readyAt=legacyAt;
          // Old layouts did not record this counter. They begin the new
          // progression at soldier 1 while keeping their existing lastDay,
          // so rollout neither invents nor discards completed task-days.
          entry.soldierCycles=int(cell&&cell.soldierCycles,0,1e9);
        } else entry.readyAt=Math.max(0,Math.trunc(+cell.readyAt||0));
      }
      clean.push(entry);
    });
    return clean;
  }

  // opts = { dayCount, today, now } — passed by the server (and by a client
  // that has heard dayCount/today from the server). Without them nothing about
  // days changes. `now` is the wall clock and is deliberately SERVER-ONLY: it
  // is what lets a legacy barracks whose 24h timer had already elapsed keep the
  // soldier it earned, so no client may supply it.
  function normalizeLayout(value, opts) {
    opts = opts || {};
    const dayCount = Number.isFinite(+opts.dayCount) ? int(opts.dayCount, 0, 1e9) : null;
    const today = DATE_RE.test(String(opts.today || '')) ? String(opts.today) : null;
    const now = opts.now == null || !Number.isFinite(+opts.now) ? null : Math.max(0, Math.trunc(+opts.now));
    const cells = Array.isArray(value && value.cells) ? value.cells : [];
    const castleRaw=value&&value.castleCell;
    const legacy=value&&value.castlePos;
    const castleCell={
      gx:castleRaw&&Number.isFinite(+castleRaw.gx)?int(castleRaw.gx,0,BUILD_GRID-CASTLE_SIZE):legacy&&Number.isFinite(+legacy.x)?int(Math.round((+legacy.x-12)/76*BUILD_GRID-CASTLE_SIZE/2),0,BUILD_GRID-CASTLE_SIZE):4,
      gy:castleRaw&&Number.isFinite(+castleRaw.gy)?int(castleRaw.gy,0,BUILD_GRID-CASTLE_SIZE):legacy&&Number.isFinite(+legacy.y)?int(Math.round((+legacy.y-8)/81*BUILD_GRID-CASTLE_SIZE/2),0,BUILD_GRID-CASTLE_SIZE):1,
    };
    const occupied={stand:[{gx:castleCell.gx,gy:castleCell.gy,size:CASTLE_SIZE}],floor:[]};
    const seenUids = new Set();
    const clean = normalizeCells(cells, BUILD_GRID, occupied, true, dayCount, today, seenUids, now);
    const plot = Farm ? Farm.FARM_PLOT : null;
    const rawFarms = plot && Array.isArray(value && value.farms) ? value.farms.slice(0, plot.max) : [];
    const occupiedDocks=new Set();
    const farms = rawFarms.map((f,index) => {
      const fallback=FARM_PLOT_POSITIONS[index]||FARM_PLOT_POSITIONS[0];
      const dock=nearestFarmPlotDock(Number.isFinite(Number(f&&f.x))?f.x:fallback.x,Number.isFinite(Number(f&&f.y))?f.y:fallback.y,occupiedDocks);
      occupiedDocks.add(dock.x+':'+dock.y);
      return {
        cells:normalizeCells(Array.isArray(f && f.cells) ? f.cells : [], plot.size, { stand: [], floor: [] }, false, dayCount, today, seenUids, now),
        x:dock.x,
        y:dock.y,
        style:Farm.plotStyle(f && f.style).id,
      };
    });
    return { cells:clean, dogLane:int(value && value.dogLane, 0, LANES - 1), soldiers:int(value&&value.soldiers,0,SOLDIER_SANITY_CAP), gridVersion:3, castleCell, farms };
  }

  function homeLevel(layout, dogLevel) {
    const clean = normalizeLayout(layout);
    const value = clean.cells.reduce((sum, cell) => {
      const d = byId(DEFENSES, cell.type);
      return sum + (d ? d.price * (cell.tier === 1 ? 1 : cell.tier === 2 ? 2 : 4) : 0);
    }, 0);
    return Math.max(1, Math.min(50,
      1 + Math.floor(value / 180) + Math.floor(clamp(dogLevel, 1, 999) / 15)));
  }

  return Object.freeze({
    LANES,COLS,BUILD_GRID,CASTLE_SIZE,PRODUCTION_MS,ARMY_DISPLAY_CAP,SOLDIER_SANITY_CAP,SOLDIER_VARIANTS,SOLDIER_VARIANT_COUNT,soldierVariantFor,ARMY_SPRITE_W,ARMY_SPRITE_H,ARMY_GAP,ARMY_ROW_STEP,armySlots,
    DEFENSES,defenseById:id => byId(DEFENSES,id),itemById,farmRules:Farm,footprintFor,rectsOverlap,
    normalizeLayout,homeLevel,
    FARM_PLOT_POSITIONS,FARM_PLOT_DOCKS,FARM_PLOT_BOUNDS,nearestFarmPlotDock,
  });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NightRaidRules;
