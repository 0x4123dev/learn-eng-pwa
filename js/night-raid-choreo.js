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
    return { x:last.x, y:last.y, state:last.state, facing:last.state === 'flee' ? 1 : -1, moving:false };
  }

  // Sample one projectile at time t: linear ground track + parabolic height.
  function shotAt(shot, t) {
    const p = Math.max(0, Math.min(1, (t - shot.launchAt) / Math.max(1, shot.impactAt - shot.launchAt)));
    const x = lerp(shot.from.x, shot.to.x, p), ground = lerp(shot.from.y, shot.to.y, p);
    return { p, x, y:ground - Math.sin(Math.PI * p) * shot.apex, ground };
  }

  function towerMuzzle(tower) { return { x:tower.x - 26, y:tower.y - 56 }; }

  function build(result, target, soldierCount, pet, seed) {
    const rng = Rules.makeRng(((Number(seed) || 1) >>> 0) ^ 0x5eed);
    const won = !!(result && result.won);
    const margin = Math.max(0, Number(result && result.margin) || 0);
    const ratio = margin / Math.max(1, Math.max(Number(result && result.damage) || 1, Number(result && result.defense) || 1));
    const n = Math.max(0, Math.min(Rules.MAX_SOLDIERS, Math.trunc(Number(soldierCount) || 0)));
    const durationMs = Math.round(Math.min(12000, 8000 + n * 250 + Math.min(1500, margin * 6)));
    const engageStart = 3400, engageEnd = Math.round(durationMs * (won ? .72 : .6));

    // --- attacker paths: staggered ranks marching into a battle line --------
    const units = [];
    const columns = Math.min(4, Math.max(1, n));
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / columns), column = i % columns;
      const rowCount = Math.min(columns, n - row * columns), center = column - (rowCount - 1) / 2;
      const startX = 610 + center * 52 + row * 12 + Math.round(rng() * 10 - 5);
      const startY = 525 + row * 52 - center * 14 + Math.round(rng() * 8 - 4);
      const meetX = 375 + center * 45 + row * 8, meetY = 360 + row * 36 - center * 10;
      const departAt = Math.round(200 + row * 330 + rng() * 180);
      const arriveAt = Math.round(Math.min(engageStart, departAt + 2300 + rng() * 500));
      units.push({ kind:'squad', index:i, fallAt:null, staggerAt:[], keys:[
        { t:0, x:startX, y:startY, state:'idle' },
        { t:departAt, x:startX, y:startY, state:'march' },
        { t:arriveAt, x:meetX, y:meetY, state:'engage', ease:'inout' },
      ]});
    }
    if (pet) units.push({ kind:'pet', index:n, fallAt:null, staggerAt:[], keys:[
      { t:0, x:518, y:512, state:'idle' },
      { t:80, x:518, y:512, state:'march' },
      { t:Math.min(engageStart, 2500), x:318, y:352, state:'engage', ease:'inout' },
    ]});

    // --- casualties: squad only, pet always survives ------------------------
    const squad = units.filter(u => u.kind === 'squad');
    const fallCount = won
      ? Math.min(squad.length, ratio > .5 ? 0 : ratio > .22 ? 1 : 2)
      : Math.min(Math.max(0, squad.length - 1), Math.max(1, Math.round(squad.length * (.55 + Math.min(.35, ratio)))));
    const order = squad.slice();
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1)), tmp = order[i]; order[i] = order[j]; order[j] = tmp;
    }
    const fallen = order.slice(0, fallCount);
    fallen.forEach((u, i) => {
      const spread = fallCount < 2 ? .5 : i / (fallCount - 1);
      u.fallAt = Math.round(engageStart + 400 + (engageEnd - engageStart - 800) * spread + rng() * 160 - 80);
    });

    // --- endgame paths: fallen stay down, survivors breach or flee ----------
    for (const u of units) {
      const at = u.keys[u.keys.length - 1];
      if (u.fallAt) {
        u.keys.push({ t:u.fallAt, x:at.x + Math.round(rng() * 12 - 6), y:at.y + Math.round(rng() * 8 - 4), state:'fallen' });
        continue;
      }
      // The hold key carries the next state so sampling inside the final
      // segment already reports the survivors as charging or fleeing.
      u.keys.push({ t:Math.round(engageEnd + rng() * 220), x:at.x, y:at.y, state:won ? 'charge' : 'flee' });
      if (won) {
        const gx = u.kind === 'pet' ? CASTLE.x + 62 : CASTLE.x + 68 + (u.index % 3) * 20;
        const gy = u.kind === 'pet' ? CASTLE.y + 4 : CASTLE.y + 14 + (u.index % 2) * 16;
        u.keys.push({ t:durationMs, x:gx, y:gy, state:'charge', ease:'in' });
      } else {
        u.keys.push({ t:Math.round(durationMs - 100 - rng() * 180), x:u.keys[0].x + 26, y:u.keys[0].y + 16, state:'flee', ease:'in' });
      }
    }

    // --- defending towers: same board slots the renderer already uses -------
    const layoutCells = Rules.normalizeLayout(target && target.layout).cells
      .filter(c => !Rules.defenseById(c.type).trap).slice(0, 7);
    const towers = layoutCells.map((c, i) => {
      const def = Rules.defenseById(c.type);
      return { type:c.type, x:285 + (i % 3) * 54, y:318 + (i % 3) * 34 + Math.floor(i / 3) * 34,
        ranged:!!def.ranged, kind:c.type === 'water-cannon' ? 'water' : 'pebble', fireAt:[] };
    });
    let shooters = towers.filter(t => t.ranged);
    if (!shooters.length) {
      const archer = { type:'castle-archer', x:235, y:262, ranged:true, kind:'pebble', fireAt:[], virtual:true };
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
    fallen.forEach((u, i) => addShot(shooters[i % shooters.length], u.fallAt, u, false));
    // Suppressive volleys on each tower's cooldown; near hits stagger the target.
    const fireStop = won ? engageEnd : Math.round(durationMs - 600);
    shooters.forEach((tower, ti) => {
      let t = Math.round(1900 + ti * 420 + rng() * 300);
      while (t < fireStop && shots.length < 30) {
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

    // --- event feed for particles and screen shake --------------------------
    const events = [];
    for (const s of shots) {
      events.push({ t:s.launchAt, type:'launch', x:s.from.x, y:s.from.y, kind:s.kind });
      events.push({ t:s.impactAt, type:'impact', x:s.to.x, y:s.to.y, kind:s.kind, lethal:s.lethal });
    }
    for (const u of fallen) {
      const k = u.keys[u.keys.length - 1];
      events.push({ t:u.fallAt, type:'fall', x:k.x, y:k.y });
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
