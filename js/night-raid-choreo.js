// Deterministic AutoBattle choreography for Castle Night Raid.
// Pure math and data — no DOM, canvas, Date or network. The same
// (result, target, soldiers, pet, seed) always yields the same battle script,
// so replays match exactly and the sync test harness can assert real numbers.
// The outcome is still decided by NightRaidRules.resolveAutoBattle before this
// module runs; build() only stages HOW that predetermined result plays out.
var NightRaidChoreo = (() => {
  'use strict';

  const Rules = typeof NightRaidRules !== 'undefined' ? NightRaidRules
    : (typeof require === 'function' ? require('./night-raid-rules.js') : null);

  const CASTLE = Object.freeze({ x:205, y:350 });
  const WALL_X = 295;                                       // west of this = at the castle wall
  // The builder grid (.nr-free-grid: left 18%, top 25%, 64% square, 12 cells)
  // projected onto the 800px battle board — towers stand exactly where the
  // defender placed them at home instead of a synthetic strip by the castle.
  const GRID = Object.freeze({ left:144, top:200, size:512, cells:12 });
  const cellAnchor = (gx,gy) => ({
    x: Math.round(GRID.left + (gx + .5) * GRID.size / GRID.cells),
    y: Math.round(GRID.top + (gy + 1) * GRID.size / GRID.cells),
  });
  const SPEED = Object.freeze({ pebble:340, water:520 });   // projectile px/s on the 800px board
  const APEX = Object.freeze({ pebble:.24, water:.07 });    // arc height per px of range
  const TOWER_COOLDOWN = Object.freeze({ pebble:1500, water:2100 });

  const lerp = (a,b,p) => a+(b-a)*p;
  const dist = (a,b) => Math.hypot(b.x-a.x, b.y-a.y);
  const EASE = Object.freeze({
    linear:p=>p,
    in:p=>p*p,
    out:p=>1-(1-p)*(1-p),
    inout:p=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2,
  });

  // Sample one unit's pose at time t: piecewise eased interpolation over keys.
  function unitAt(unit, t) {
    const keys = unit.keys;
    if (t <= keys[0].t) return { x:keys[0].x, y:keys[0].y, state:keys[0].state, facing:-1, moving:false };
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i+1];
      if (t <= b.t) {
        const p = EASE[b.ease || 'linear']((t - a.t) / Math.max(1, b.t - a.t));
        return {
          x:lerp(a.x, b.x, p), y:lerp(a.y, b.y, p), state:a.state,
          facing:b.x > a.x + 1 ? 1 : -1,
          moving:Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 4,
        };
      }
    }
    const last = keys[keys.length - 1];
    return { x:last.x, y:last.y, state:last.state,
      facing:(last.state === 'flee' || last.state === 'carry') ? 1 : -1, moving:false };
  }

  // Sample one projectile at time t: linear ground track + parabolic height.
  function shotAt(shot, t) {
    const p = Math.max(0, Math.min(1, (t - shot.launchAt) / Math.max(1, shot.impactAt - shot.launchAt)));
    const x = lerp(shot.from.x, shot.to.x, p), ground = lerp(shot.from.y, shot.to.y, p);
    return { p, x, y:ground - Math.sin(Math.PI * p) * shot.apex, ground };
  }

  function towerMuzzle(tower) { return { x:tower.x - 26, y:tower.y - 56 }; }

  // How many blows it takes to break each building — the material decides:
  // wood splinters fast, stone outlasts everything, farms are soft targets.
  // Each extra tier hardens a building by one more blow.
  const BLOWS = Object.freeze({
    'wood-fence':3, 'stone-wall':6, 'pebble-pup':3, 'water-cannon':4,
    'training-barracks':3, 'rice-field':2, 'tomato-field':2, 'fish-pond':2,
  });
  const MARCH_SPEED = 108;  // px/s on the 800px board — one believable shared jog
  const CHARGE_MULT = 1.45; // sprinting at the castle / fleeing / carrying home
  const SWING_MS = 620;     // one melee blow

  function build(result, target, soldierCount, pet, seed) {
    const rng = Rules.makeRng(((Number(seed) || 1) >>> 0) ^ 0x5eed);
    const won = !!(result && result.won);
    const margin = Math.max(0, Number(result && result.margin) || 0);
    const ratio = margin / Math.max(1, Math.max(Number(result && result.damage) || 1, Number(result && result.defense) || 1));
    const n = Math.max(0, Math.min(Rules.MAX_SOLDIERS, Math.trunc(Number(soldierCount) || 0)));

    // --- defending towers: the defender's real home layout on the board -----
    const layoutCells = Rules.normalizeLayout(target && target.layout).cells
      .filter(c => !Rules.defenseById(c.type).trap).slice(0, 10);
    const towers = layoutCells.map(c => {
      const def = Rules.defenseById(c.type), at = cellAnchor(c.gx, c.gy);
      return { type:c.type, x:at.x, y:at.y, gx:c.gx, gy:c.gy, tier:c.tier || 1,
        material:def.material || (def.producer ? 'soft' : 'hard'),
        ranged:!!def.ranged, kind:c.type === 'water-cannon' ? 'water' : 'pebble',
        fireAt:[], hitAt:[], crackAt:null, fallAt:null };
    });

    // --- attacker paths: physically consistent, one shared march speed ------
    const units = [];
    const columns = Math.min(4, Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / columns), column = i % columns;
      const rowCount = Math.min(columns, n - row * columns), center = column - (rowCount - 1) / 2;
      const startX = 610 + center * 52 + row * 12 + Math.round(rng() * 10 - 5);
      const startY = 525 + row * 52 - center * 14 + Math.round(rng() * 8 - 4);
      const departAt = Math.round(200 + row * 330 + rng() * 180);
      units.push({ kind:'squad', index:i, fallAt:null, staggerAt:[],
        _v:MARCH_SPEED * (.95 + rng() * .1), _home:{ x:startX, y:startY },
        _meet:{ x:375 + center * 45 + row * 8, y:360 + row * 36 - center * 10 },
        keys:[ { t:0, x:startX, y:startY, state:'idle' },
               { t:departAt, x:startX, y:startY, state:'march' } ] });
    }
    // The pet leads from a separate diagonal track. Keeping a readable gap
    // from rank one prevents the dog and soldiers merging into one dragged
    // bitmap on phone-sized canvases.
    if (pet) units.push({ kind:'pet', index:n, fallAt:null, staggerAt:[],
      _v:MARCH_SPEED * 1.15, _home:{ x:500, y:470 }, _meet:{ x:300, y:322 },
      keys:[ { t:0, x:500, y:470, state:'idle' },
             { t:80, x:500, y:470, state:'march' } ] });

    // Arrival time comes from real distance at the unit's own speed — a rank
    // that leaves later ARRIVES later instead of teleport-marching to a fixed
    // beat. `state` is what the unit starts doing when it gets there.
    const marchTo = (u, x, y, state, mult = 1, ease = 'out') => {
      const at = u.keys[u.keys.length - 1];
      const t = Math.max(at.t + 80, Math.round(at.t + dist(at, { x, y }) / (u._v * mult) * 1000));
      u.keys.push({ t, x, y, state, ease });
      return t;
    };
    const squad = units.filter(u => u.kind === 'squad');
    let engageStart, engageEnd, durationMs, breachAt = null, lootAt = null;

    if (won) {
      // --- assault: every building is smashed by a crew standing AT it ------
      const smashers = squad.length ? squad : units;
      const MUSTER = { x:610, y:525 };
      const order = towers.slice().sort((a, b) =>
        Math.hypot(a.x - MUSTER.x, a.y - MUSTER.y) - Math.hypot(b.x - MUSTER.x, b.y - MUSTER.y));
      // Longer chains mean the crew hurries — blows land faster, so ten
      // buildings against four raiders still finishes inside the battle.
      const hurry = Math.min(2.2, Math.max(1, order.length / Math.max(1, smashers.length)));
      const swing = Math.round(SWING_MS / hurry);
      const chains = smashers.map(() => []);
      order.forEach((t, j) => { if (smashers.length) chains[j % smashers.length].push(t); });
      smashers.forEach((u, ci) => {
        for (const tw of chains[ci]) {
          const ax = tw.x + 30 + Math.round(rng() * 12 - 6), ay = tw.y + 16 + Math.round(rng() * 8 - 4);
          const arrive = marchTo(u, ax, ay, 'engage');
          const blows = (BLOWS[tw.type] || 3) + Math.max(0, (tw.tier || 1) - 1);
          for (let b = 0; b < blows; b++) tw.hitAt.push(arrive + 280 + b * swing);
          tw.crackAt = tw.hitAt[Math.max(0, Math.ceil(blows / 2) - 1)];
          tw.fallAt = tw.hitAt[blows - 1] + 220;
          u.keys.push({ t:tw.fallAt + 140, x:ax, y:ay, state:'march' });
        }
      });
      // No soldiers and no pet: the base still breaks, on a simple cascade.
      if (!units.length) towers.forEach((tw, i) => {
        tw.hitAt = [3400 + i * 300, 3700 + i * 300];
        tw.crackAt = tw.hitAt[1]; tw.fallAt = tw.hitAt[1] + 220;
      });
      const petU = units.find(u => u.kind === 'pet');
      if (petU && squad.length) marchTo(petU, petU._meet.x, petU._meet.y, 'engage');
      // Units with no building to smash stage at the line, then charge.
      for (const u of squad) if (!u.keys.some(k => k.state === 'engage'))
        marchTo(u, u._meet.x, u._meet.y, 'charge');

      // --- castle assault: everyone converges on the gate and hammers it ----
      let castleStart = Infinity, lastFall = 0;
      for (const tw of towers) lastFall = Math.max(lastFall, tw.fallAt || 0);
      for (const u of units) {
        const last = u.keys[u.keys.length - 1];
        // The pet harasses at its rally point while the squad does the
        // smashing — it joins the gate charge with the crews, not five
        // seconds ahead of them.
        const joinAt = u.kind === 'pet' && squad.length
          ? Math.max(last.t + 120, Math.round(lastFall * .6)) : last.t + 120;
        if (last.state !== 'march' && last.state !== 'charge')
          u.keys.push({ t:joinAt, x:last.x, y:last.y, state:'charge' });
        else last.state = 'charge';
        u._gate = { x:CASTLE.x + 58 + (u.index % 3) * 16 + Math.round(rng() * 8 - 4),
                    y:CASTLE.y + 6 + (u.index % 2) * 14 + Math.round(rng() * 6 - 3) };
        u._gateAt = marchTo(u, u._gate.x, u._gate.y, 'engage', CHARGE_MULT, 'in');
        castleStart = Math.min(castleStart, u._gateAt);
      }
      if (!Number.isFinite(castleStart)) castleStart = Math.max(3400, lastFall + 300);
      const castleBlows = 6 - Math.min(3, Math.floor(ratio * 10));
      const cInterval = Math.max(220, Math.round(SWING_MS / Math.max(1, units.length)));
      breachAt = Math.round(Math.max(lastFall + 420, castleStart + 300 + castleBlows * cInterval));
      engageStart = Math.round(Math.min(castleStart,
        units.reduce((m, u) => Math.min(m, (u.keys.find(k => k.ease) || { t:3400 }).t), 3400)));
      engageEnd = breachAt;

      // --- casualties: the defenders' last stand at the gate ----------------
      const fallCount = Math.min(squad.length, ratio > .5 ? 0 : ratio > .22 ? 1 : 2);
      const shuffled = squad.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1)), tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
      }
      shuffled.slice(0, fallCount).forEach((u, i) => {
        // A soldier can only be shot down at the gate it actually reached —
        // never mid-march before its own arrival.
        const lo = Math.max(castleStart + 250, (u._gateAt || 0) + 160);
        const hi = Math.max(lo + 200, breachAt - 260);
        u.fallAt = Math.round(Math.min(hi,
          lo + (fallCount < 2 ? .5 : i / (fallCount - 1)) * (hi - lo) + rng() * 120 - 60));
      });

      // --- the loot: breach, grab, CARRY IT HOME ----------------------------
      lootAt = breachAt;
      const lootMs = 1500 + n * 40, exitAt = breachAt + lootMs;
      let latestHome = breachAt + lootMs;
      units.forEach((u, ui) => {
        if (u.fallAt) return;
        const g = u._gate;
        // A straggler that reaches the gate after the breach simply runs
        // straight in — keys stay monotonic for every unit.
        const inAt = Math.max(breachAt + 90 + ui * 70, (u._gateAt || 0) + 80);
        u.keys.push({ t:inAt, x:g.x - 26, y:g.y - 8, state:'loot', ease:'out' });
        u.keys.push({ t:Math.max(exitAt + ui * 90, inAt + 600), x:g.x - 26, y:g.y - 8, state:'carry' });
        latestHome = Math.max(latestHome,
          marchTo(u, u._home.x + 14, u._home.y + 10, 'carry', CHARGE_MULT * .9, 'out'));
      });
      durationMs = latestHome + 260;
    } else {
      // --- repelled at the perimeter: the defense holds the line ------------
      let maxArrive = 0;
      for (const u of units) maxArrive = Math.max(maxArrive, marchTo(u, u._meet.x, u._meet.y, 'engage'));
      if (!units.length) maxArrive = 3400;
      engageStart = units.length
        ? units.reduce((m, u) => Math.min(m, u.keys[u.keys.length - 1].t), Infinity) : 3400;
      engageEnd = Math.round(maxArrive + 2600 + Math.min(900, margin * 2));
      const fallCount = Math.min(Math.max(0, squad.length - 1),
        Math.max(1, Math.round(squad.length * (.55 + Math.min(.35, ratio)))));
      const shuffled = squad.slice();
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1)), tmp = shuffled[i]; shuffled[i] = shuffled[j]; shuffled[j] = tmp;
      }
      shuffled.slice(0, fallCount).forEach((u, i) => {
        const spread = fallCount < 2 ? .5 : i / (fallCount - 1);
        u.fallAt = Math.round(engageStart + 400 + (engageEnd - engageStart - 800) * spread + rng() * 160 - 80);
      });
      let latestFlee = engageEnd;
      for (const u of units) {
        if (u.fallAt) continue;
        const at = u.keys[u.keys.length - 1];
        u.keys.push({ t:Math.round(engageEnd + rng() * 220), x:at.x, y:at.y, state:'flee' });
        latestFlee = Math.max(latestFlee,
          marchTo(u, u._home.x + 26, u._home.y + 16, 'flee', CHARGE_MULT * .95, 'in'));
      }
      durationMs = latestFlee + 240;
    }

    // --- fallen units stop where the shot finds them ------------------------
    const fallen = units.filter(u => u.fallAt != null);
    for (const u of fallen) {
      const pose = unitAt(u, u.fallAt);
      u.keys = u.keys.filter(k => k.t < u.fallAt);
      u.keys.push({ t:u.fallAt, x:pose.x + Math.round(rng() * 12 - 6),
        y:pose.y + Math.round(rng() * 8 - 4), state:'fallen' });
    }

    let shooters = towers.filter(t => t.ranged);
    if (!shooters.length) {
      const archer = { type:'castle-archer', x:235, y:262, ranged:true, kind:'pebble',
        fireAt:[], hitAt:[], crackAt:null, fallAt:null, virtual:true };
      towers.push(archer); shooters = [archer];
    }

    // --- shots: impact time is launch time plus real flight time ------------
    const shots = [];
    const aliveAt = t => units.filter(u => !u.fallAt || u.fallAt > t);
    function addShot(tower, impactAt, targetUnit, miss) {
      const at = unitAt(targetUnit, impactAt);
      const to = { x:at.x + (miss ? Math.round(rng() * 44 - 22) : 0), y:at.y + (miss ? Math.round(rng() * 20 - 4) : 6) };
      const from = towerMuzzle(tower);
      const d = dist(from, to);
      const flight = Math.max(120, Math.round(d / SPEED[tower.kind] * 1000));
      const launchAt = impactAt - flight;
      if (launchAt < 300) return null;
      const shot = { from, to, kind:tower.kind, launchAt, impactAt,
        apex:Math.max(18, Math.min(90, d * APEX[tower.kind])),
        lethal:!miss, targetKind:targetUnit.kind, targetIndex:targetUnit.index };
      shots.push(shot); tower.fireAt.push(launchAt);
      return shot;
    }
    // The killing blow must come from a tower still standing at that moment —
    // a demolished pile of rubble cannot shoot anyone down.
    fallen.forEach((u, i) => {
      const live = shooters.filter(s => s.fallAt == null || s.fallAt > u.fallAt);
      addShot(live.length ? live[i % live.length] : shooters[i % shooters.length], u.fallAt, u, false);
    });
    // Suppressive volleys on each tower's cooldown; near hits stagger the
    // target. A tower stops firing the moment it is smashed down.
    const fireStop = won ? engageEnd : Math.round(durationMs - 600);
    shooters.forEach((tower, ti) => {
      const myStop = Math.min(fireStop, tower.fallAt == null ? Infinity : tower.fallAt);
      let t = Math.round(1900 + ti * 420 + rng() * 300);
      while (t < myStop && shots.length < 30) {
        const pool = aliveAt(t + 400);
        if (pool.length) {
          const targetUnit = pool[Math.floor(rng() * pool.length)];
          const guess = Math.round(dist(towerMuzzle(tower), unitAt(targetUnit, t)) / SPEED[tower.kind] * 1000);
          const s = addShot(tower, t + Math.max(120, guess), targetUnit, true);
          if (s) {
            const hitPos = unitAt(targetUnit, s.impactAt);
            if (Math.abs(s.to.x - hitPos.x) < 15 && Math.abs(s.to.y - hitPos.y) < 14) targetUnit.staggerAt.push(s.impactAt);
          }
        }
        t += TOWER_COOLDOWN[tower.kind] + Math.round(rng() * 400);
      }
    });
    shots.sort((a,b) => a.launchAt - b.launchAt);

    // --- event feed for particles, sound and screen shake -------------------
    const events = [];
    for (const t of towers) {
      // Every melee blow on a building is a visible, audible smash.
      for (const h of t.hitAt) events.push({ t:h, type:'smash', x:t.x, y:t.y - 26, material:t.material || 'hard' });
      if (t.fallAt != null) events.push({ t:t.fallAt, type:'demolish', x:t.x, y:t.y - 30 });
    }
    for (const s of shots) {
      events.push({ t:s.launchAt, type:'launch', x:s.from.x, y:s.from.y, kind:s.kind });
      events.push({ t:s.impactAt, type:'impact', x:s.to.x, y:s.to.y, kind:s.kind, lethal:s.lethal });
    }
    for (const u of fallen) {
      const k = u.keys[u.keys.length - 1];
      events.push({ t:u.fallAt, type:'fall', x:k.x, y:k.y });
    }
    if (won && lootAt != null) {
      // Grabbing the loot is its own visible beat between breach and exit.
      for (let k = 0; k < 5; k++) events.push({
        t:Math.round(lootAt + 350 + k * 320), type:'loot',
        x:CASTLE.x + 50 + ((k * 37) % 40) - 20, y:CASTLE.y - 24 - (k % 3) * 8 });
    }
    events.push(won
      ? { t:engageEnd, type:'breach', x:CASTLE.x + 60, y:CASTLE.y - 40 }
      : { t:engageEnd, type:'retreat', x:400, y:420 });
    events.sort((a,b) => a.t - b.t);

    return { durationMs, won, engageStart, engageEnd,
      breachAt:won ? engageEnd : null, retreatAt:won ? null : engageEnd,
      units, towers, shots, events, castle:CASTLE, wallX:WALL_X };
  }

  return Object.freeze({ build, unitAt, shotAt, towerMuzzle, SPEED, CASTLE, WALL_X });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NightRaidChoreo;
