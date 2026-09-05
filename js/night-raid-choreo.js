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
  // The castle door on the 800px board — where every crew ends up hammering.
  const GATE = Object.freeze({ x:CASTLE.x + 58, y:CASTLE.y + 6 });
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
  // Combat tuning mirrors NightRaidRules.DEFENSES; shop prices do not affect battle damage.
  const TOWER_COOLDOWN = Object.freeze({ pebble:1500, water:2000 });
  const MAX_BUILDINGS = 12;                                 // towers, farms AND traps the crews visit

  const lerp = (a,b,p) => a+(b-a)*p;
  const dist = (a,b) => Math.hypot(b.x-a.x, b.y-a.y);
  const EASE = Object.freeze({
    linear:p=>p,
    in:p=>p*p,
    out:p=>1-(1-p)*(1-p),
    inout:p=>p<.5?2*p*p:1-Math.pow(-2*p+2,2)/2,
  });
  // Every move accelerates and brakes over this long. A quadratic ease-out
  // launched a unit from 0 to 200 px/s in one frame and then crept the last
  // 900 ms while the legs still ran; a trapezoid keeps ONE cruise speed with
  // a short ramp at each end, so the feet, the dust and the body agree.
  const RAMP_MS = 240;
  function rampAt(p, durMs) {
    if (p <= 0) return 0;
    if (p >= 1) return 1;
    const r = Math.min(.5, RAMP_MS / Math.max(1, durMs)), v = 1 / (1 - r);
    if (p < r) return v * p * p / (2 * r);
    if (p <= 1 - r) return v * (r / 2 + (p - r));
    return 1 - v * (1 - p) * (1 - p) / (2 * r);
  }
  const easeAt = (name, p, durMs) => name === 'ramp' ? rampAt(p, durMs) : (EASE[name] || EASE.linear)(p);
  // One full six-frame walk cycle covers this much ground. The renderers
  // drive the leg frame from odometer()/STRIDE_PX, never from wall time.
  const STRIDE_PX = 70;

  // Sample one unit's pose at time t: piecewise eased interpolation over keys.
  function unitAt(unit, t) {
    const keys = unit.keys;
    if (t <= keys[0].t) return { x:keys[0].x, y:keys[0].y, state:keys[0].state, facing:-1, moving:false };
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i+1];
      if (t <= b.t) {
        const dur = Math.max(1, b.t - a.t), p = easeAt(b.ease, (t - a.t) / dur, dur);
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

  // Ground distance a unit has covered by time t, along its own eased keys.
  // Legs, footprints and dust are driven by this, so they stop when the body
  // stops and slow when it brakes — a pure function of t like everything else.
  function odometer(unit, t) {
    const keys = unit.keys;
    let d = 0;
    for (let i = 0; i < keys.length - 1; i++) {
      const a = keys[i], b = keys[i+1], len = dist(a, b);
      if (t >= b.t) { d += len; continue; }
      if (t > a.t) { const dur = Math.max(1, b.t - a.t); d += len * easeAt(b.ease, (t - a.t) / dur, dur); }
      break;
    }
    return d;
  }

  // Sample one projectile at time t: linear ground track + parabolic height.
  function shotAt(shot, t) {
    const p = Math.max(0, Math.min(1, (t - shot.launchAt) / Math.max(1, shot.impactAt - shot.launchAt)));
    const x = lerp(shot.from.x, shot.to.x, p), ground = lerp(shot.from.y, shot.to.y, p);
    return { p, x, y:ground - Math.sin(Math.PI * p) * shot.apex, ground };
  }

  function towerMuzzle(tower) { return { x:tower.x - 26, y:tower.y - 56 }; }

  // Eleven posts fanned in front of the castle door: one at the gate's east
  // flank, then three rows curving around the doorstep. Every pair is at
  // least 46 px apart, all sit west of x=340 (at the castle) and below the
  // castle's ground line, so eleven 108-px sprites read as a crowd at the
  // gate rather than one blob painted eleven times in a 16x14 px box.
  const GATE_SLOTS = Object.freeze([
    { x:322, y:348 },
    { x:200, y:388 }, { x:247, y:384 }, { x:294, y:388 },
    { x:176, y:434 }, { x:223, y:428 }, { x:270, y:428 }, { x:317, y:434 },
    { x:200, y:478 }, { x:247, y:472 }, { x:294, y:478 },
  ].map(Object.freeze));
  function gateSlot(k) {
    const s = GATE_SLOTS[k % GATE_SLOTS.length], ring = Math.floor(k / GATE_SLOTS.length);
    return { x:s.x, y:s.y + ring * 44 };
  }
  // Looting means a short step from the post toward the doorway, not eleven
  // units converging on one point.
  function lootSpot(slot) {
    const dx = GATE.x - slot.x, dy = GATE.y - 20 - slot.y, d = Math.hypot(dx, dy) || 1;
    return { x:Math.round(slot.x + dx / d * 14), y:Math.round(slot.y + dy / d * 14) };
  }

  // How many blows it takes to break each building — the material decides:
  // wood splinters fast, stone outlasts everything, farms are soft targets.
  // Each extra tier hardens a building by one more blow.
  const BLOWS = Object.freeze({
    'wood-fence':3, 'stone-wall':6, 'pebble-pup':3, 'water-cannon':4, 'spike-trap':2,
    'training-barracks':3, 'rice-field':2, 'tomato-field':2, 'fish-pond':2,
  });
  const MARCH_SPEED = 108;  // px/s on the 800px board — one believable shared jog
  const CHARGE_MULT = 1.45; // sprinting at the castle / fleeing / carrying home
  const SWING_MS = 620;     // one melee blow
  const MUSTER = Object.freeze({ x:610, y:525 });
  // Where a second, third and fourth raider stand around the same building.
  const FLANKS = Object.freeze([[34,14],[70,-8],[62,42],[96,16]].map(Object.freeze));

  function build(result, target, soldierCount, pet, seed) {
    const rng = Rules.makeRng(((Number(seed) || 1) >>> 0) ^ 0x5eed);
    const won = !!(result && result.won);
    const margin = Math.max(0, Number(result && result.margin) || 0);
    const ratio = margin / Math.max(1, Math.max(Number(result && result.damage) || 1, Number(result && result.defense) || 1));
    const n = Math.max(0, Math.min(Rules.ARMY_DISPLAY_CAP, Math.trunc(Number(soldierCount) || 0)));

    // --- defending buildings: the defender's real home layout on the board --
    // Spike traps cost real coins and add real DEF, so they are on the board
    // and get disarmed like everything else instead of silently vanishing.
    const layoutCells = Rules.normalizeLayout(target && target.layout).cells.slice(0, MAX_BUILDINGS);
    const towers = layoutCells.map(c => {
      const def = Rules.defenseById(c.type), at = cellAnchor(c.gx, c.gy);
      return { type:c.type, x:at.x, y:at.y, gx:c.gx, gy:c.gy, tier:c.tier || 1,
        material:def.material || (def.producer ? 'soft' : 'hard'), trap:!!def.trap,
        ranged:!!def.ranged, kind:c.type === 'water-cannon' ? 'water' : 'pebble',
        fireAt:[], hitAt:[], crackAt:null, fallAt:null };
    });
    const byRoute = (a, b) => dist(a, MUSTER) - dist(b, MUSTER);

    // --- attacker paths: physically consistent, one shared march speed ------
    const units = [];
    const columns = Math.min(4, Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / columns), column = i % columns;
      const rowCount = Math.min(columns, n - row * columns), center = column - (rowCount - 1) / 2;
      const startX = 610 + center * 52 + row * 12 + Math.round(rng() * 10 - 5);
      const startY = 525 + row * 52 - center * 14 + Math.round(rng() * 8 - 4);
      const departAt = Math.round(200 + row * 330 + rng() * 180);
      units.push({ kind:'squad', index:i, fallAt:null, staggerAt:[], blowAt:[],
        _v:MARCH_SPEED * (.95 + rng() * .1), _home:{ x:startX, y:startY },
        _meet:{ x:375 + center * 45 + row * 8, y:360 + row * 36 - center * 10 },
        keys:[ { t:0, x:startX, y:startY, state:'idle' },
               { t:departAt, x:startX, y:startY, state:'march' } ] });
    }
    // The pet leads from its own start ahead of rank one and runs the first
    // crew's route — never a private diagonal to an empty patch of yard.
    if (pet) units.push({ kind:'pet', index:n, fallAt:null, staggerAt:[], blowAt:[],
      _v:MARCH_SPEED * 1.2, _home:{ x:500, y:470 }, _meet:{ x:300, y:322 },
      keys:[ { t:0, x:500, y:470, state:'idle' },
             { t:80, x:500, y:470, state:'march' } ] });

    // Arrival time comes from real distance at the unit's own speed — a rank
    // that leaves later ARRIVES later instead of teleport-marching to a fixed
    // beat. `state` is what the unit starts doing when it gets there. Every
    // segment ramps up and brakes (see rampAt) unless told otherwise.
    const marchTo = (u, x, y, state, mult = 1, ease = 'ramp') => {
      const at = u.keys[u.keys.length - 1];
      const t = Math.max(at.t + 80, Math.round(at.t + dist(at, { x, y }) / (u._v * mult) * 1000));
      u.keys.push({ t, x, y, state, ease });
      return t;
    };
    const squad = units.filter(u => u.kind === 'squad');
    const petU = units.find(u => u.kind === 'pet');
    let engageStart, engageEnd, durationMs, breachAt = null, lootAt = null;

    if (won) {
      // --- assault: every building is smashed by a crew standing AT it ------
      const smashers = squad.length ? squad : units;
      const order = towers.slice().sort(byRoute);
      // Longer chains mean the crew hurries — blows land faster, so twelve
      // buildings against four raiders still finishes inside the battle.
      const hurry = Math.min(2.6, Math.max(1, Math.pow(order.length / Math.max(1, smashers.length), 1.3)));
      const swing = Math.round(SWING_MS / hurry);
      const chains = smashers.map(() => []);
      order.forEach((t, j) => { if (smashers.length) chains[j % smashers.length].push(t); });
      smashers.forEach((u, ci) => {
        for (const tw of chains[ci]) {
          const ax = tw.x + 30 + Math.round(rng() * 12 - 6), ay = tw.y + 16 + Math.round(rng() * 8 - 4);
          const arrive = marchTo(u, ax, ay, 'engage');
          const blows = (BLOWS[tw.type] || 3) + Math.max(0, (tw.tier || 1) - 1);
          for (let b = 0; b < blows; b++) { const h = arrive + 280 + b * swing; tw.hitAt.push(h); u.blowAt.push(h); }
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
      // The leader runs rank one's route: it reaches each of that crew's
      // buildings first, takes the far flank (about 80 px from the soldier,
      // so the two never merge into one bitmap on a phone) and snaps at it
      // between the soldier's blows. It only ever `engage`s a building that
      // is really there.
      if (petU && squad.length) for (const tw of chains[0]) {
        const ax = tw.x - 46 + Math.round(rng() * 8 - 4), ay = tw.y - 8 + Math.round(rng() * 6 - 3);
        const arrive = marchTo(petU, ax, ay, 'engage');
        for (const h of tw.hitAt) if (h > arrive + 100) petU.blowAt.push(h + Math.round(swing / 2));
        petU.keys.push({ t:tw.fallAt + 60, x:ax, y:ay, state:'march' });
      }
      // Units with no building to smash stage at the line, then charge.
      for (const u of squad) if (!u.keys.some(k => k.state === 'engage'))
        marchTo(u, u._meet.x, u._meet.y, 'charge');

      // --- castle assault: everyone converges on the gate and hammers it ----
      let castleStart = Infinity, lastFall = 0;
      for (const tw of towers) lastFall = Math.max(lastFall, tw.fallAt || 0);
      // Whoever will REACH the door first takes the post nearest it; later
      // arrivals fill the rows behind — which are also the rows nearest their
      // approach — so nobody runs through the crowd to a front slot.
      const joiners = units.map(u => {
        const last = u.keys[u.keys.length - 1];
        // The pet harasses at its last building while the squad finishes
        // smashing — it joins the gate charge with the crews, not five
        // seconds ahead of them.
        const joinAt = u.kind === 'pet' && squad.length
          ? Math.max(last.t + 120, Math.round(lastFall * .6)) : last.t + 120;
        const eta = joinAt + dist(last, GATE) / (u._v * CHARGE_MULT) * 1000;
        return { u, joinAt, eta };
      }).sort((a, b) => a.eta - b.eta || a.u.index - b.u.index);
      joiners.forEach(({ u, joinAt }, k) => {
        const last = u.keys[u.keys.length - 1];
        if (last.state !== 'march' && last.state !== 'charge')
          u.keys.push({ t:joinAt, x:last.x, y:last.y, state:'charge' });
        else last.state = 'charge';
        const slot = gateSlot(k);
        u._gate = { x:slot.x + Math.round(rng() * 4 - 2), y:slot.y + Math.round(rng() * 4 - 2) };
        u._gateAt = marchTo(u, u._gate.x, u._gate.y, 'engage', CHARGE_MULT);
        castleStart = Math.min(castleStart, u._gateAt);
      });
      if (!Number.isFinite(castleStart)) castleStart = Math.max(3400, lastFall + 300);
      const castleBlows = 6 - Math.min(3, Math.floor(ratio * 10));
      const cInterval = Math.max(220, Math.round(SWING_MS / Math.max(1, units.length)));
      breachAt = Math.round(Math.max(lastFall + 420, castleStart + 300 + castleBlows * cInterval));
      engageStart = Math.round(Math.min(castleStart,
        units.reduce((m, u) => Math.min(m, (u.keys.find(k => k.ease) || { t:3400 }).t), 3400)));
      engageEnd = breachAt;
      // Every unit at the gate lands real, scheduled blows on the door until
      // it gives; the renderer winds up and strikes on these instants.
      for (const u of units)
        for (let t = u._gateAt + 300 + (u.index % 4) * 150; t < breachAt - 80; t += SWING_MS) u.blowAt.push(t);

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
        const g = lootSpot(u._gate);
        // A straggler that reaches the gate after the breach simply runs
        // straight in — keys stay monotonic for every unit.
        const inAt = Math.max(breachAt + 90 + ui * 70, (u._gateAt || 0) + 80);
        // Hold the post until the door gives, THEN step in: without the hold
        // key the unit crept from post to loot spot for the whole wait.
        const at = u.keys[u.keys.length - 1];
        u.keys.push({ t:Math.max(at.t + 1, inAt - 260), x:at.x, y:at.y, state:'engage' });
        u.keys.push({ t:inAt, x:g.x, y:g.y, state:'loot', ease:'ramp' });
        // Staggered departures: the crowd peels away from the door in ones
        // and twos instead of turning as one block.
        u.keys.push({ t:Math.max(exitAt + ui * 110 + Math.round(rng() * 80), inAt + 600), x:g.x, y:g.y, state:'carry' });
        latestHome = Math.max(latestHome,
          marchTo(u, u._home.x + 14, u._home.y + 10, 'carry', CHARGE_MULT * .9));
      });
      durationMs = latestHome + 260;
    } else {
      // --- repelled at the perimeter: the defense holds the line ------------
      // The crews reach the FIRST defences on their route and hack at them
      // there, so the towers are seen doing the repelling; nobody ever gets
      // as far as the castle wall.
      const posts = towers.filter(t => !t.virtual && t.x + 30 > WALL_X + 12).sort(byRoute)
        .slice(0, Math.max(1, Math.ceil(units.length / 2)));
      let maxArrive = 0;
      units.forEach((u, i) => {
        let x = u._meet.x, y = u._meet.y;
        if (posts.length) {
          const tw = posts[i % posts.length], f = FLANKS[Math.floor(i / posts.length) % FLANKS.length];
          x = tw.x + f[0] + Math.round(rng() * 8 - 4); y = tw.y + f[1] + Math.round(rng() * 6 - 3);
          u._post = tw;
        }
        maxArrive = Math.max(maxArrive, marchTo(u, x, y, 'engage'));
      });
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
      // Blows on the building they reached — it jolts and sparks but never
      // cracks: a repelled raid breaks nothing.
      for (const u of units) {
        if (!u._post) continue;
        const arrive = u.keys[u.keys.length - 1].t, stop = Math.min(u.fallAt || Infinity, engageEnd);
        for (let t = arrive + 280 + (u.index % 3) * 140, b = 0; t < stop - 60 && b < 6; t += SWING_MS, b++) {
          u.blowAt.push(t); u._post.hitAt.push(t);
        }
        u._post.hitAt.sort((a, b) => a - b);
      }
      let latestFlee = engageEnd;
      for (const u of units) {
        if (u.fallAt) continue;
        const at = u.keys[u.keys.length - 1];
        u.keys.push({ t:Math.round(engageEnd + rng() * 220), x:at.x, y:at.y, state:'flee' });
        latestFlee = Math.max(latestFlee,
          marchTo(u, u._home.x + 26, u._home.y + 16, 'flee', CHARGE_MULT * .95));
      }
      durationMs = latestFlee + 240;
    }

    // --- fallen units stop where the shot finds them ------------------------
    // Exactly where: a jittered resting spot turned the wait at the gate into
    // a 7 px "march" lasting seconds, so the doomed soldier walked in place
    // instead of swinging until the shot landed.
    const fallen = units.filter(u => u.fallAt != null);
    for (const u of fallen) {
      const pose = unitAt(u, u.fallAt);
      u.keys = u.keys.filter(k => k.t < u.fallAt);
      u.keys.push({ t:u.fallAt, x:Math.round(pose.x), y:Math.round(pose.y), state:'fallen' });
      u.blowAt = u.blowAt.filter(t => t < u.fallAt);
    }
    for (const u of units) u.blowAt.sort((a, b) => a - b);

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
    // Blows on the castle door: sparks off the ironwork (the renderer
    // throttles the sound so eleven hammers do not become a drum roll).
    if (won) for (const u of units) for (const t of u.blowAt)
      if (u._gateAt != null && t >= u._gateAt)
        events.push({ t, type:'gatehit', x:GATE.x - 22 + ((u.index * 37) % 30), y:GATE.y - 34 - (u.index % 3) * 9 });
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
      units, towers, shots, events, castle:CASTLE, gate:GATE, wallX:WALL_X };
  }

  return Object.freeze({ build, unitAt, odometer, shotAt, towerMuzzle, easeAt, rampAt, gateSlot, lootSpot,
    SPEED, CASTLE, GATE, GATE_SLOTS, WALL_X, RAMP_MS, STRIDE_PX, TOWER_COOLDOWN, MAX_BUILDINGS });
})();
if (typeof module !== 'undefined' && module.exports) module.exports = NightRaidChoreo;
