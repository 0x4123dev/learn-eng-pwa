// Night Raid rules — deterministic and renderer-free.
// The same snapshot + seed + ordered deploy commands always produces the
// same result. Keep DOM, canvas, Date and network access out of this module.
var NightRaidRules = (() => {
  'use strict';

  // Farm items (crops, farm buildings) are defined in js/farm-rules.js. The
  // browser loads that file first (index.html); Node and the Pages bundle
  // require it. Kept out of DEFENSES on purpose: homeLevel, combatPower and
  // createState only ever look at DEFENSES, so the farm can never change a
  // fight or a matchup.
  const Farm = typeof FarmRules !== 'undefined' ? FarmRules
    : (typeof require === 'function' ? require('./farm-rules.js') : null);

  const RULES_VERSION = 2;
  const TICK_MS = 100;
  const RAID_MS = 120000;
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
  const START_BUDGET = 80;
  const MAX_COMMANDS = 80;
  const PRODUCTION_MS = 24 * 60 * 60 * 1000;
  // Lính KHÔNG còn giới hạn: bé nuôi bao nhiêu cũng được, và không mất lính
  // sau mỗi trận cướp nữa. Chỉ còn hai con số:
  //   ARMY_DISPLAY_CAP   nhiều nhất bấy nhiêu con lính đi lại trên bãi cỏ —
  //                      thuần trình bày, HUD vẫn hiện số thật.
  //   SOLDIER_SANITY_CAP chặn trên phòng dữ liệu hỏng (NaN, Infinity, số rác
  //                      từ localStorage cũ). Đây KHÔNG phải luật chơi.
  const ARMY_DISPLAY_CAP = 10;
  const SOLDIER_SANITY_CAP = 1000000;

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
        row: i % 6,
      });
    }
    return slots;
  }
  // Swords — the daily-task reward a child may take instead of a shield
  // (js/armory.js, functions/api/_daily-task.js). A sword is never spent:
  // every one in stock adds SWORD_DAMAGE to the attack score.
  //
  // KHÔNG CÒN TRẦN. Trước đây chỉ 10 thanh đầu được tính (SWORD_CAP), thanh
  // thứ 11 trở đi là đồ trang trí — bé mở quà ra kiếm mà DAM đứng yên. Nay
  // mọi thanh kiếm đều cộng DAM, giống hệt lính. SWORD_SANITY_CAP chỉ để
  // chặn NaN/Infinity/rác, KHÔNG phải luật chơi; SWORD_METER_PIPS là số ô
  // vẽ trên thanh đo trong kho vũ khí, thuần trình bày.
  //
  // Cỡ giá trị, để biết một thanh kiếm đáng bao nhiêu:
  //   - tài khoản mới (chó cấp 1, chưa có lính, chưa xây gì) có 42 DAM;
  //     chó cấp 7 với 2 lính là 139; chó cấp 20 với 6 lính và 2 pháo là 345.
  //   - một lính +20 DAM, pháo nước 5000 xu +50, cún sỏi 2000 xu +22.
  //   - finish.js cho 2 sao khi margin >= 25 và 3 sao khi margin >= 60.
  // 10 DAM một thanh: hai thanh bằng một lính, nên con số trên HUD nhúc nhích
  // thấy được và một trận thua sát nút có thể lật lại.
  const SWORD_DAMAGE = 10;
  const SWORD_SANITY_CAP = 1000000;
  const SWORD_METER_PIPS = 10;
  const SCENES = Object.freeze(['moonlit-village', 'haunted-forest', 'storm-kingdom']);

  const RAIDERS = Object.freeze([
    Object.freeze({ id:'mouse', name:{en:'Sneaky Mouse',vi:'Chuột Trộm'}, cost:3, hp:20, speed:.72, dps:4, role:'scout', color:'#f6d6a8' }),
    Object.freeze({ id:'goblin', name:{en:'Sack Goblin',vi:'Yêu Tinh Túi Vải'}, cost:6, hp:45, speed:.38, dps:8, role:'frontline', color:'#8fce66' }),
    Object.freeze({ id:'fox', name:{en:'Thief Fox',vi:'Cáo Trộm'}, cost:8, hp:30, speed:.82, dps:0, role:'loot', steal:15, color:'#ff9c4a' }),
    Object.freeze({ id:'bat', name:{en:'Night Bat',vi:'Dơi Đêm'}, cost:8, hp:30, speed:.62, dps:6, flying:true, role:'flying', color:'#b99aff' }),
    Object.freeze({ id:'bomb-rat', name:{en:'Bomb Rat',vi:'Chuột Bom'}, cost:10, hp:25, speed:.66, dps:0, bomb:90, role:'breach', color:'#ff6b6b' }),
  ]);

  const DEFENSES = Object.freeze([
    Object.freeze({ id:'pebble-pup', name:{en:'Pebble Pup',vi:'Cún Bắn Đá'}, price:2000, stat:'damage', attack:22, defense:8, hp:42, damage:8, cooldown:1500, ranged:true, color:'#f5b85c' }),
    Object.freeze({ id:'wood-fence', name:{en:'Wooden Fence',vi:'Hàng Rào Gỗ'}, price:3000, stat:'defense', attack:0, defense:45, hp:120, blocker:true, material:'wood', color:'#a76d3e' }),
    Object.freeze({ id:'stone-wall', name:{en:'Stone Wall',vi:'Tường Đá'}, price:5000, stat:'defense', attack:0, defense:80, hp:300, blocker:true, material:'stone', color:'#91a0b2' }),
    Object.freeze({ id:'spike-trap', name:{en:'Spike Trap',vi:'Bẫy Gai'}, price:3000, stat:'both', attack:16, defense:25, hp:45, trap:true, damage:5, color:'#adb5bd' }),
    Object.freeze({ id:'water-cannon', name:{en:'Water Cannon',vi:'Pháo Nước'}, price:5000, stat:'damage', attack:50, defense:10, hp:48, damage:12, cooldown:2000, ranged:true, splash:true, color:'#50c9ff' }),
    Object.freeze({ id:'training-barracks', asset:'training-barracks.png', name:{en:'Training Barracks',vi:'Trại Huấn Luyện'}, price:8000, stat:'producer', footprint:2, attack:0, defense:0, producer:'soldier', yield:1, perTaskDay:true, maxOwned:10, color:'#d8783d' }),
    Object.freeze({ id:'rice-field', asset:'rice-field.png', name:{en:'Rice Field',vi:'Ruộng Lúa'}, price:6000, stat:'producer', footprint:2, attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, buyMax:1, color:'#e5b93d' }),
    Object.freeze({ id:'tomato-field', asset:'tomato-field.png', name:{en:'Tomato Garden',vi:'Vườn Cà Chua'}, price:6000, stat:'producer', footprint:2, attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, buyMax:1, color:'#ef5544' }),
    Object.freeze({ id:'fish-pond', asset:'fish-pond.png', name:{en:'Koi Fish Pond',vi:'Ao Cá Koi'}, price:6000, stat:'producer', footprint:2, attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, buyMax:1, color:'#38a9d6' }),
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

  function makeRng(seed) {
    let a = (Number(seed) || 1) >>> 0;
    return function rng() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

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
      // Combat still uses five lanes and eight columns. The free builder grid is
      // presentation data mapped deterministically into those battle lanes.
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

  function tierMultiplier(tier) {
    return tier === 3 ? 2.7 : tier === 2 ? 1.75 : 1;
  }

  function petPower(dogLevel) {
    const level=int(dogLevel||1,1,999);
    return {level,damage:20+level*2,defense:30+level*3};
  }

  // Swords in stock → the DAM they add. Anything past the cap adds nothing;
  // a missing or non-numeric count is zero.
  function swordBonus(swordCount) {
    return SWORD_DAMAGE * int(swordCount, 0, SWORD_SANITY_CAP);
  }

  // The builder and the server use this exact score card. Castle skins are
  // deliberately absent: a paid skin changes the home art, never the result.
  // `swordCount` is the child's users.night_swords: the client passes what the
  // last /api/me/daily-tasks reply said, the server reads the column itself
  // (functions/api/night-raid/start.js) — same function, same number.
  function combatPower(layout, dogLevel, soldierCount, swordCount) {
    const clean=normalizeLayout(layout);
    const pet=petPower(dogLevel),soldiers=int(soldierCount==null?clean.soldiers:soldierCount,0,SOLDIER_SANITY_CAP);
    const swords=int(swordCount,0,SWORD_SANITY_CAP),swordDamage=swordBonus(swords);
    let damage=20+pet.damage+soldiers*20+swordDamage;
    let defense=50+pet.defense;
    for(const cell of clean.cells){
      const item=byId(DEFENSES,cell.type), mult=tierMultiplier(cell.tier);
      if(item&&!item.producer){damage+=Math.round((item.attack||0)*mult);defense+=Math.round((item.defense||0)*mult);}
    }
    return {damage:Math.max(1,Math.round(damage)),defense:Math.max(1,Math.round(defense)),petDamage:pet.damage,petDefense:pet.defense,soldiers,soldierDamage:soldiers*20,swords,swordDamage};
  }

  function trainingLayout(level) {
    const n = int(level, 1, 20);
    const rng = makeRng(0x51f15e ^ n * 7919);
    const cells = [];
    const add = (type, lane, col, tier=1) => cells.push({ type, lane, col, tier });
    // Every target has an intentional weak lane plus two readable counters.
    const weak = n % LANES;
    for (let lane = 0; lane < LANES; lane++) {
      if (lane !== weak || n > 10) add(n >= 3 && lane % 2 ? 'stone-wall' : 'wood-fence', lane, 2 + (lane % 2), n >= 14 ? 2 : 1);
      if (n >= 2 && lane !== (weak + 1) % LANES) add('spike-trap', lane, 5 + (lane % 2));
      if (n >= 4 && (lane + n) % 2 === 0) add('pebble-pup', lane, 1);
      if (n >= 7 && lane === (n * 3) % LANES) add('water-cannon', lane, 1, n >= 16 ? 2 : 1);
    }
    // Shuffle visual column choices deterministically without hiding the weak-lane lesson.
    cells.forEach(cell => { if (cell.col > 1 && rng() > .68) cell.col = Math.min(COLS - 1, cell.col + 1); });
    return normalizeLayout({ cells, dogLane:(n + 1) % LANES });
  }

  function trainingTarget(level) {
    const n = int(level, 1, 20);
    const trainingSkins=['forest-fort','desert-citadel','frost-bastion','coral-palace','sakura-castle','clockwork-keep','dragon-fortress','crystal-citadel','celestial-palace'];
    const layout=trainingLayout(n),dogLevel=Math.max(1,n*3),power=combatPower(layout,dogLevel);
    return {
      id:'training-' + n,
      level:n,
      title:{en:'Training Keep ' + n,vi:'Nhà Huấn Luyện ' + n},
      sceneId:SCENES[(n - 1) % SCENES.length],
      seed:(0x9e3779b9 ^ n * 2654435761) >>> 0,
      layout,
      dogLevel,
      castleSkin:trainingSkins[Math.min(trainingSkins.length-1,Math.floor((n-1)/2))],
      castleHp:180 + n * 8,
      budget:Math.min(110, START_BUDGET + Math.floor((n - 1) / 5) * 5),
      reward:Math.min(60, 20 + Math.floor((n - 1) / 4) * 10),
      damage:power.damage,
      defense:power.defense,
    };
  }

  function resolveAutoBattle(snapshot, attackerDamage) {
    const target=snapshot||trainingTarget(1);
    const targetPower=combatPower(target.layout,target.dogLevel);
    const damage=Math.max(1,int(attackerDamage==null?target.attackerDamage:attackerDamage,1,100000));
    const defense=Math.max(1,int(target.defense||targetPower.defense,1,100000));
    const won=damage>defense, margin=Math.abs(damage-defense);
    const durationMs=won?Math.max(3800,5600-Math.min(1400,margin*4)):Math.max(4000,5400-Math.min(900,margin*2));
    const castleMax=int(target.castleHp||200,1,5000);
    const castleHp=won?0:Math.max(1,Math.round(castleMax*Math.min(.92,.32+margin/Math.max(damage,defense))));
    return {status:won?'won':'lost',won,damage,defense,margin,castleHp,budget:0,loot:0,durationMs,timeMs:durationMs};
  }

  function defenseHp(def, tier) {
    return Math.round(def.hp * (tier === 1 ? 1 : tier === 2 ? 1.6 : 2.2));
  }

  function createState(snapshot, seed) {
    const target = snapshot || trainingTarget(1);
    const layout = normalizeLayout(target.layout);
    const defenses = layout.cells.filter(cell=>{const d=byId(DEFENSES,cell.type);return d&&!d.producer;}).map((cell, index) => {
      const def = byId(DEFENSES, cell.type);
      const hp = defenseHp(def, cell.tier);
      return { id:'d' + index, type:def.id, lane:cell.lane, x:cell.col + .05, tier:cell.tier, hp, maxHp:hp, cooldown:0, revealed:!def.trap };
    });
    const dogLevel = int(target.dogLevel || 1, 1, 999);
    defenses.push({ id:'dog', type:'guard-dog', lane:layout.dogLane, x:1.15, hp:70 + dogLevel, maxHp:70 + dogLevel, cooldown:0, revealed:true });
    return {
      rulesVersion:RULES_VERSION,
      seed:(Number(seed == null ? target.seed : seed) || 1) >>> 0,
      timeMs:0,
      maxTimeMs:RAID_MS,
      budget:int(target.budget || START_BUDGET, 1, 200),
      startBudget:int(target.budget || START_BUDGET, 1, 200),
      castleHp:int(target.castleHp || 200, 1, 5000),
      castleMaxHp:int(target.castleHp || 200, 1, 5000),
      loot:0,
      status:'playing',
      raiders:[],
      defenses,
      nextRaiderId:1,
      shots:[],
      events:[],
    };
  }

  function deploy(state, unitId, lane) {
    if (!state || state.status !== 'playing') return { ok:false, reason:'finished' };
    const unit = byId(RAIDERS, unitId);
    if (!unit) return { ok:false, reason:'unit' };
    const safeLane = int(lane, 0, LANES - 1);
    if (state.budget < unit.cost) return { ok:false, reason:'budget', missing:unit.cost - state.budget };
    state.budget -= unit.cost;
    state.raiders.push({ id:'r' + state.nextRaiderId++, type:unit.id, lane:safeLane, x:COLS + .72, hp:unit.hp, maxHp:unit.hp, cooldown:0, dead:false });
    state.events.push({ type:'deploy', unitId:unit.id, lane:safeLane, at:state.timeMs });
    return { ok:true };
  }

  function alive(list) { return list.filter(item => !item.dead && item.hp > 0); }
  function defType(item) { return item.type === 'guard-dog' ? null : byId(DEFENSES, item.type); }
  function raidType(item) { return byId(RAIDERS, item.type); }

  function nearestRaider(state, lane, x, includeFlying=true) {
    return alive(state.raiders)
      .filter(r => r.lane === lane && r.x >= x && (includeFlying || !raidType(r).flying))
      .sort((a,b) => a.x - b.x)[0] || null;
  }

  function hitRaider(state, raider, damage, source, projectile) {
    if (!raider || raider.dead) return;
    raider.hp -= damage;
    if (projectile) state.shots.push({ fromX:source.x, toX:raider.x, lane:raider.lane, kind:projectile, age:0 });
    state.events.push({ type:'hit-raider', id:raider.id, damage, lane:raider.lane, x:raider.x, at:state.timeMs });
    if (raider.hp <= 0) {
      raider.dead = true;
      state.events.push({ type:'raider-down', id:raider.id, lane:raider.lane, x:raider.x, at:state.timeMs });
    }
  }

  function castleDamage(state, amount, raider) {
    const dealt = Math.max(1, Math.round(amount));
    state.castleHp = Math.max(0, state.castleHp - dealt);
    state.events.push({ type:'castle-hit', damage:dealt, lane:raider.lane, at:state.timeMs, hp:state.castleHp });
  }

  function tick(state, deltaMs=TICK_MS) {
    if (!state || state.status !== 'playing') return state;
    const dt = clamp(deltaMs, 1, 500);
    state.timeMs += dt;
    state.events = [];
    state.shots.forEach(s => { s.age += dt; });
    state.shots = state.shots.filter(s => s.age <= 700);

    // Static defenses fire first, giving their drawn anticipation a deterministic impact time.
    alive(state.defenses).forEach(defense => {
      defense.cooldown = Math.max(0, defense.cooldown - dt);
      if (defense.type === 'guard-dog') {
        const foe = alive(state.raiders).filter(r => r.lane === defense.lane && !raidType(r).flying && Math.abs(r.x - defense.x) < .48)[0];
        if (foe && defense.cooldown <= 0) {
          hitRaider(state, foe, 10, defense, 'bite');
          defense.cooldown = 900;
        }
        return;
      }
      const type = defType(defense);
      if (!type || !type.ranged || defense.cooldown > 0) return;
      const foe = nearestRaider(state, defense.lane, defense.x, true);
      if (!foe) return;
      hitRaider(state, foe, Math.round(type.damage * (defense.tier === 1 ? 1 : defense.tier === 2 ? 1.6 : 2.2)), defense, type.splash ? 'water' : 'pebble');
      if (type.splash) alive(state.raiders).filter(r => r !== foe && r.lane === foe.lane && Math.abs(r.x - foe.x) < .7).forEach(r => hitRaider(state, r, 5, defense, null));
      defense.cooldown = type.cooldown;
    });

    alive(state.raiders).forEach(raider => {
      const type = raidType(raider);
      raider.cooldown = Math.max(0, raider.cooldown - dt);
      const blockers = alive(state.defenses)
        .filter(d => d.lane === raider.lane && !type.flying && d.x < raider.x && raider.x - d.x < .48 && !((defType(d) || {}).trap))
        .sort((a,b) => b.x - a.x);
      const blocker = blockers[0];

      // Floor traps reveal on contact. Bombs destroy a same-cell trap as part of the blast.
      alive(state.defenses).filter(d => d.lane === raider.lane && (defType(d) || {}).trap && !type.flying && Math.abs(d.x - raider.x) < .38).forEach(trap => {
        trap.revealed = true;
        raider.hp -= (defType(trap).damage * dt / 1000);
        if (type.bomb) trap.hp = 0;
      });
      if (raider.hp <= 0) { raider.dead = true; return; }

      if (blocker) {
        if (type.bomb) {
          blocker.hp -= type.bomb;
          raider.hp = 0; raider.dead = true;
          state.events.push({ type:'bomb', lane:raider.lane, x:blocker.x, damage:type.bomb, at:state.timeMs });
        } else if (raider.cooldown <= 0) {
          blocker.hp -= type.dps;
          raider.cooldown = 1000;
          state.events.push({ type:'hit-defense', id:blocker.id, lane:blocker.lane, x:blocker.x, damage:type.dps, at:state.timeMs });
        }
      } else {
        raider.x -= type.speed * dt / 1000;
      }

      if (!raider.dead && raider.x <= .72) {
        if (type.steal) {
          state.loot += type.steal;
          raider.dead = true;
          state.events.push({ type:'fox-loot', amount:type.steal, lane:raider.lane, at:state.timeMs });
        } else if (raider.cooldown <= 0) {
          castleDamage(state, type.dps || (type.bomb ? 35 : 5), raider);
          raider.cooldown = 1000;
          if (type.bomb) { raider.dead = true; state.events.push({ type:'bomb-castle', lane:raider.lane, at:state.timeMs }); }
        }
      }
    });

    state.defenses.forEach(d => { if (d.hp <= 0 && !d.dead) { d.dead = true; state.events.push({ type:'defense-down', id:d.id, lane:d.lane, x:d.x, material:(defType(d) || {}).material || 'soft', at:state.timeMs }); } });
    state.raiders = state.raiders.filter(r => !r.dead || state.timeMs - (r.deadAt || (r.deadAt = state.timeMs)) < 400);

    if (state.castleHp <= 0) state.status = 'won';
    else if (state.timeMs >= state.maxTimeMs || (state.budget < RAIDERS[0].cost && alive(state.raiders).length === 0)) state.status = 'lost';
    return state;
  }

  function normalizeCommands(commands) {
    if (!Array.isArray(commands)) return [];
    return commands.slice(0, MAX_COMMANDS).map(command => ({
      at:int(command && command.at, 0, RAID_MS),
      type:'deploy',
      unitId:String(command && command.unitId || ''),
      lane:int(command && command.lane, 0, LANES - 1),
    })).filter(command => byId(RAIDERS, command.unitId)).sort((a,b) => a.at - b.at);
  }

  function simulate(snapshot, commands, options) {
    const state = createState(snapshot, snapshot && snapshot.seed);
    const list = normalizeCommands(commands);
    let index = 0;
    const limit = Math.min(RAID_MS, Number(options && options.maxMs) || RAID_MS);
    while (state.status === 'playing' && state.timeMs < limit) {
      while (index < list.length && list[index].at <= state.timeMs) {
        deploy(state, list[index].unitId, list[index].lane); index++;
      }
      tick(state, TICK_MS);
    }
    return { status:state.status, won:state.status === 'won', castleHp:Math.round(state.castleHp), budget:state.budget, loot:state.loot, durationMs:state.timeMs };
  }

  function trainingStars(state) {
    if (!state || state.status !== 'won') return 0;
    return 1 + (state.budget >= 20 ? 1 : 0) + (state.timeMs <= 90000 ? 1 : 0);
  }

  return Object.freeze({
    RULES_VERSION,TICK_MS,RAID_MS,LANES,COLS,BUILD_GRID,CASTLE_SIZE,START_BUDGET,MAX_COMMANDS,PRODUCTION_MS,ARMY_DISPLAY_CAP,SOLDIER_SANITY_CAP,ARMY_SPRITE_W,ARMY_SPRITE_H,ARMY_GAP,ARMY_ROW_STEP,armySlots,SWORD_DAMAGE,SWORD_SANITY_CAP,SWORD_METER_PIPS,SCENES,
    RAIDERS,DEFENSES,raiderById:id => byId(RAIDERS,id),defenseById:id => byId(DEFENSES,id),itemById,farmRules:Farm,footprintFor,rectsOverlap,
    makeRng,normalizeLayout,homeLevel,tierMultiplier,petPower,swordBonus,combatPower,trainingTarget,resolveAutoBattle,createState,deploy,tick,
    FARM_PLOT_POSITIONS,FARM_PLOT_DOCKS,FARM_PLOT_BOUNDS,nearestFarmPlotDock,
    normalizeCommands,simulate,trainingStars,
  });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NightRaidRules;
