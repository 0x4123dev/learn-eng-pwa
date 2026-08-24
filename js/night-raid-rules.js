// Night Raid rules — deterministic and renderer-free.
// The same snapshot + seed + ordered deploy commands always produces the
// same result. Keep DOM, canvas, Date and network access out of this module.
var NightRaidRules = (() => {
  'use strict';

  const RULES_VERSION = 2;
  const TICK_MS = 100;
  const RAID_MS = 120000;
  const LANES = 5;
  const COLS = 8;
  const BUILD_GRID = 12;
  const START_BUDGET = 80;
  const MAX_COMMANDS = 80;
  const PRODUCTION_MS = 24 * 60 * 60 * 1000;
  const MAX_SOLDIERS = 10;
  const SCENES = Object.freeze(['moonlit-village', 'haunted-forest', 'storm-kingdom']);

  const RAIDERS = Object.freeze([
    Object.freeze({ id:'mouse', name:{en:'Sneaky Mouse',vi:'Chuột Trộm'}, cost:3, hp:20, speed:.72, dps:4, role:'scout', color:'#f6d6a8' }),
    Object.freeze({ id:'goblin', name:{en:'Sack Goblin',vi:'Yêu Tinh Túi Vải'}, cost:6, hp:45, speed:.38, dps:8, role:'frontline', color:'#8fce66' }),
    Object.freeze({ id:'fox', name:{en:'Thief Fox',vi:'Cáo Trộm'}, cost:8, hp:30, speed:.82, dps:0, role:'loot', steal:15, color:'#ff9c4a' }),
    Object.freeze({ id:'bat', name:{en:'Night Bat',vi:'Dơi Đêm'}, cost:8, hp:30, speed:.62, dps:6, flying:true, role:'flying', color:'#b99aff' }),
    Object.freeze({ id:'bomb-rat', name:{en:'Bomb Rat',vi:'Chuột Bom'}, cost:10, hp:25, speed:.66, dps:0, bomb:90, role:'breach', color:'#ff6b6b' }),
  ]);

  const DEFENSES = Object.freeze([
    Object.freeze({ id:'pebble-pup', name:{en:'Pebble Pup',vi:'Cún Bắn Đá'}, price:1000, stat:'damage', attack:22, defense:8, hp:42, damage:8, cooldown:1500, ranged:true, color:'#f5b85c' }),
    Object.freeze({ id:'wood-fence', name:{en:'Wooden Fence',vi:'Hàng Rào Gỗ'}, price:1000, stat:'defense', attack:0, defense:45, hp:120, blocker:true, material:'wood', color:'#a76d3e' }),
    Object.freeze({ id:'stone-wall', name:{en:'Stone Wall',vi:'Tường Đá'}, price:1000, stat:'defense', attack:0, defense:80, hp:300, blocker:true, material:'stone', color:'#91a0b2' }),
    Object.freeze({ id:'spike-trap', name:{en:'Spike Trap',vi:'Bẫy Gai'}, price:1000, stat:'both', attack:16, defense:25, hp:45, trap:true, damage:5, color:'#adb5bd' }),
    Object.freeze({ id:'water-cannon', name:{en:'Water Cannon',vi:'Pháo Nước'}, price:1000, stat:'damage', attack:50, defense:10, hp:48, damage:12, cooldown:2000, ranged:true, splash:true, color:'#50c9ff' }),
    Object.freeze({ id:'training-barracks', asset:'training-barracks.png', name:{en:'Training Barracks',vi:'Trại Huấn Luyện'}, price:4000, stat:'producer', attack:0, defense:0, producer:'soldier', yield:1, productionMs:PRODUCTION_MS, maxOwned:2, color:'#d8783d' }),
    Object.freeze({ id:'rice-field', asset:'rice-field.png', name:{en:'Rice Field',vi:'Ruộng Lúa'}, price:2000, stat:'producer', attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, color:'#e5b93d' }),
    Object.freeze({ id:'tomato-field', asset:'tomato-field.png', name:{en:'Tomato Garden',vi:'Vườn Cà Chua'}, price:2000, stat:'producer', attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, color:'#ef5544' }),
    Object.freeze({ id:'fish-pond', asset:'fish-pond.png', name:{en:'Koi Fish Pond',vi:'Ao Cá Koi'}, price:2000, stat:'producer', attack:0, defense:0, producer:'coins', yield:100, productionMs:PRODUCTION_MS, maxOwned:4, color:'#38a9d6' }),
  ]);

  const byId = (list, id) => list.find(item => item.id === id) || null;
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, Number(n) || 0));
  const int = (n, lo, hi) => Math.trunc(clamp(n, lo, hi));

  function makeRng(seed) {
    let a = (Number(seed) || 1) >>> 0;
    return function rng() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function normalizeTeammates(value) {
    if (!Array.isArray(value)) return [];
    return value.filter(id => id === 'gunner' || id === 'engineer' || id === 'shield').slice(0, 5);
  }

  function normalizeLayout(value) {
    const cells = Array.isArray(value && value.cells) ? value.cells : [];
    const seen = new Set();
    const owned = Object.create(null);
    const clean = [];
    cells.slice(0, BUILD_GRID * BUILD_GRID * 2).forEach(cell => {
      const type = byId(DEFENSES, String(cell && cell.type || ''));
      if (!type) return;
      if (type.maxOwned && (owned[type.id] || 0) >= type.maxOwned) return;
      const hasGrid = Number.isFinite(Number(cell && cell.gx)) && Number.isFinite(Number(cell && cell.gy));
      const gx = hasGrid ? int(cell.gx, 0, BUILD_GRID - 1) : Math.round((int(cell.col, 1, COLS) - 1) * (BUILD_GRID - 1) / (COLS - 1));
      const gy = hasGrid ? int(cell.gy, 0, BUILD_GRID - 1) : Math.round(int(cell.lane, 0, LANES - 1) * (BUILD_GRID - 1) / (LANES - 1));
      // Combat still uses five lanes and eight columns. The free builder grid is
      // presentation data mapped deterministically into those battle lanes.
      const lane = Math.round(gy * (LANES - 1) / (BUILD_GRID - 1));
      const col = 1 + Math.round(gx * (COLS - 1) / (BUILD_GRID - 1));
      const layer = type.trap ? 'floor' : 'stand';
      const key = gx + ':' + gy + ':' + layer;
      if (seen.has(key)) return;
      seen.add(key);
      owned[type.id] = (owned[type.id] || 0) + 1;
      const entry={ type:type.id, lane, col, gx, gy, tier:type.producer?1:int(cell.tier || 1, 1, 3) };
      if(type.producer){const uid=String(cell&&cell.uid||'');if(/^[A-Za-z0-9-]{8,64}$/.test(uid))entry.uid=uid;entry.readyAt=Math.max(0,Math.trunc(+cell.readyAt||0));}
      clean.push(entry);
    });
    const result={ cells:clean, dogLane:int(value && value.dogLane, 0, LANES - 1), soldiers:int(value&&value.soldiers,0,MAX_SOLDIERS) };
    // Cosmetic builder metadata travels with the layout so the browser and
    // server agree where the equipped castle sits. It never affects combat.
    const castle=value&&value.castlePos;
    if(castle&&Number.isFinite(+castle.x)&&Number.isFinite(+castle.y)){
      result.castlePos={x:+clamp(castle.x,27,73).toFixed(2),y:+clamp(castle.y,29,41).toFixed(2)};
    }
    return result;
  }

  function homeLevel(layout, dogLevel, teammates) {
    const clean = normalizeLayout(layout);
    const value = clean.cells.reduce((sum, cell) => {
      const d = byId(DEFENSES, cell.type);
      return sum + (d ? d.price * (cell.tier === 1 ? 1 : cell.tier === 2 ? 2 : 4) : 0);
    }, 0);
    return Math.max(1, Math.min(50,
      1 + Math.floor(value / 180) + Math.floor(clamp(dogLevel, 1, 999) / 15) + normalizeTeammates(teammates).length));
  }

  function tierMultiplier(tier) {
    return tier === 3 ? 2.7 : tier === 2 ? 1.75 : 1;
  }

  function petPower(dogLevel) {
    const level=int(dogLevel||1,1,999);
    return {level,damage:20+level*2,defense:30+level*3};
  }

  // The builder and the server use this exact score card. Castle skins are
  // deliberately absent: a paid skin changes the home art, never the result.
  function combatPower(layout, dogLevel, teammates, soldierCount) {
    const clean=normalizeLayout(layout), mates=normalizeTeammates(teammates);
    const pet=petPower(dogLevel),soldiers=int(soldierCount==null?clean.soldiers:soldierCount,0,MAX_SOLDIERS);
    let damage=20+pet.damage+soldiers*20;
    let defense=50+pet.defense;
    for(const id of mates){
      if(id==='gunner')damage+=45;
      else if(id==='engineer'){damage+=15;defense+=30;}
      else if(id==='shield'){damage+=5;defense+=80;}
    }
    for(const cell of clean.cells){
      const item=byId(DEFENSES,cell.type), mult=tierMultiplier(cell.tier);
      if(item&&!item.producer){damage+=Math.round((item.attack||0)*mult);defense+=Math.round((item.defense||0)*mult);}
    }
    return {damage:Math.max(1,Math.round(damage)),defense:Math.max(1,Math.round(defense)),petDamage:pet.damage,petDefense:pet.defense,soldiers,soldierDamage:soldiers*20};
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
    const teammates = n < 6 ? [] : n < 11 ? ['gunner'] : n < 16 ? ['gunner','engineer'] : ['gunner','engineer','shield'];
    const layout=trainingLayout(n),dogLevel=Math.max(1,n*3),power=combatPower(layout,dogLevel,teammates);
    return {
      id:'training-' + n,
      level:n,
      title:{en:'Training Keep ' + n,vi:'Nhà Huấn Luyện ' + n},
      sceneId:SCENES[(n - 1) % SCENES.length],
      seed:(0x9e3779b9 ^ n * 2654435761) >>> 0,
      layout,
      dogLevel,
      teammates,
      castleSkin:trainingSkins[Math.min(trainingSkins.length-1,Math.floor((n-1)/2))],
      castleHp:180 + n * 8 + teammates.filter(id => id === 'shield').length * 25,
      budget:Math.min(110, START_BUDGET + Math.floor((n - 1) / 5) * 5),
      reward:Math.min(60, 20 + Math.floor((n - 1) / 4) * 10),
      damage:power.damage,
      defense:power.defense,
    };
  }

  function resolveAutoBattle(snapshot, attackerDamage) {
    const target=snapshot||trainingTarget(1);
    const targetPower=combatPower(target.layout,target.dogLevel,target.teammates);
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
    const defenses = layout.cells.filter(cell=>!byId(DEFENSES,cell.type).producer).map((cell, index) => {
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
      teammates:normalizeTeammates(target.teammates),
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
    const shields = state.teammates.filter(id => id === 'shield').length;
    const reduction = shields <= 0 ? 0 : shields === 1 ? .35 : shields === 2 ? .50 : .60;
    const dealt = Math.max(1, Math.round(amount * (1 - reduction)));
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

    // Teammates live visibly in the castle and act on deterministic cooldown boundaries.
    if (state.teammates.includes('gunner') && Math.floor((state.timeMs - dt) / 10000) < Math.floor(state.timeMs / 10000)) {
      const target = alive(state.raiders).sort((a,b) => b.hp - a.hp || a.x - b.x)[0];
      if (target) hitRaider(state, target, 25 * state.teammates.filter(id => id === 'gunner').length, {x:.5}, 'rocket');
    }
    if (state.teammates.includes('engineer') && Math.floor((state.timeMs - dt) / 12000) < Math.floor(state.timeMs / 12000)) {
      const count = state.teammates.filter(id => id === 'engineer').length;
      state.castleHp = Math.min(state.castleMaxHp, state.castleHp + 12 * count);
      const weak = alive(state.defenses).sort((a,b) => a.hp/a.maxHp - b.hp/b.maxHp)[0];
      if (weak) weak.hp = Math.min(weak.maxHp, weak.hp + 15 * count);
      state.events.push({ type:'repair', at:state.timeMs });
    }

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
    RULES_VERSION,TICK_MS,RAID_MS,LANES,COLS,BUILD_GRID,START_BUDGET,MAX_COMMANDS,PRODUCTION_MS,MAX_SOLDIERS,SCENES,
    RAIDERS,DEFENSES,raiderById:id => byId(RAIDERS,id),defenseById:id => byId(DEFENSES,id),
    makeRng,normalizeTeammates,normalizeLayout,homeLevel,tierMultiplier,petPower,combatPower,trainingTarget,resolveAutoBattle,createState,deploy,tick,
    normalizeCommands,simulate,trainingStars,
  });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NightRaidRules;
