const { suite, test, assert } = require('./harness');
const fs = require('fs'), path = require('path');
const R = require('../js/night-raid-rules.js');
const C = require('../js/night-raid-choreo.js');

const read = p => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

// Fixed fixtures: a clear win, a narrow win and a heavy loss on real targets.
function fixture(level, damageDelta) {
  const target = R.trainingTarget(level);
  const result = R.resolveAutoBattle(target, target.defense + damageDelta);
  return { target, result };
}
const bigWin = fixture(8, 120), narrowWin = fixture(8, 1), heavyLoss = fixture(8, -140);
const buildOf = (f, soldiers, pet) => C.build(f.result, f.target, soldiers, pet || null, f.target.seed);
const PET = { name: 'Rex', breed: 'corgi', level: 9, cell: 2, atlas: 'small' };

suite('night raid choreography: deterministic battle script', () => {
  test('same inputs build byte-identical scripts', () => {
    const a = buildOf(bigWin, 6, PET), b = buildOf(bigWin, 6, PET);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    const c = buildOf(heavyLoss, 6, PET), d = buildOf(heavyLoss, 6, PET);
    assert.equal(JSON.stringify(c), JSON.stringify(d));
  });

  test('battle lasts seven to sixteen seconds with ordered phases', () => {
    for (const f of [bigWin, narrowWin, heavyLoss]) {
      const s = buildOf(f, 8, PET);
      assert.inRange(s.durationMs, 7000, 16000);
      assert.truthy(s.engageStart < s.engageEnd && s.engageEnd < s.durationMs);
      if (s.won) assert.equal(s.breachAt, s.engageEnd);
      else assert.equal(s.retreatAt, s.engageEnd);
    }
  });

  test('every projectile travels at its real speed and hits on arrival', () => {
    for (const f of [bigWin, heavyLoss]) {
      const s = buildOf(f, 8, PET);
      assert.truthy(s.shots.length >= 3, 'towers must actually fire');
      for (const shot of s.shots) {
        assert.truthy(shot.impactAt > shot.launchAt);
        const d = Math.hypot(shot.to.x - shot.from.x, shot.to.y - shot.from.y);
        const expected = Math.max(120, Math.round(d / C.SPEED[shot.kind] * 1000));
        assert.inRange(shot.impactAt - shot.launchAt, expected - 1, expected + 1);
      }
    }
  });

  test('lethal shots land exactly when their target falls', () => {
    const s = buildOf(heavyLoss, 8, PET);
    const lethal = s.shots.filter(shot => shot.lethal);
    assert.truthy(lethal.length >= 1);
    for (const shot of lethal) {
      const unit = s.units.find(u => u.kind === shot.targetKind && u.index === shot.targetIndex);
      assert.equal(shot.impactAt, unit.fallAt);
    }
  });

  test('casualties scale with the predetermined result', () => {
    const easy = buildOf(bigWin, 8, PET);
    const rout = buildOf(heavyLoss, 8, PET);
    const fallsOf = s => s.units.filter(u => u.fallAt != null).length;
    assert.inRange(fallsOf(easy), 0, 2);
    assert.truthy(fallsOf(rout) >= 4, 'heavy loss must drop at least half the squad');
    assert.truthy(rout.units.some(u => u.fallAt == null), 'someone survives to flee');
  });

  test('on a loss no attacker ever reaches the castle wall', () => {
    const s = buildOf(heavyLoss, 8, PET);
    for (const unit of s.units) {
      for (let t = 0; t <= s.durationMs; t += 100) {
        assert.truthy(C.unitAt(unit, t).x > C.WALL_X, unit.kind + unit.index + ' at ' + t);
      }
    }
  });

  test('the pet leader never falls and flees facing home on a loss', () => {
    const s = buildOf(heavyLoss, 8, PET);
    const pet = s.units.find(u => u.kind === 'pet');
    assert.truthy(pet);
    assert.equal(pet.fallAt, null);
    assert.equal(C.unitAt(pet, s.durationMs).state, 'flee');
    assert.equal(C.unitAt(pet, s.durationMs).facing, 1);
  });

  test('an empty layout still fights back through the castle archer', () => {
    const target = { ...R.trainingTarget(1), layout: { cells: [] } };
    const result = R.resolveAutoBattle(target, target.defense - 30);
    const s = C.build(result, target, 5, null, target.seed);
    assert.truthy(s.towers.some(t => t.virtual));
    assert.truthy(s.shots.length >= 2);
  });

  test('units march with staggered starts and eased arrivals', () => {
    const s = buildOf(bigWin, 8, PET);
    const squad = s.units.filter(u => u.kind === 'squad');
    const departs = squad.map(u => u.keys.find(k => k.state === 'march').t);
    assert.truthy(new Set(departs).size >= 3, 'ranks leave at different times');
    for (const u of squad) {
      const idle = C.unitAt(u, 0);
      assert.equal(idle.state, 'idle');
      const arrive = u.keys.find(k => k.ease);
      assert.truthy(arrive, 'march segment uses easing');
    }
  });

  test('pet leads on a visibly separate track from the first soldier rank', () => {
    const s = buildOf(bigWin, 8, PET);
    const pet = s.units.find(u => u.kind === 'pet');
    const squad = s.units.filter(u => u.kind === 'squad');
    const firstStop = pet.keys.find(k => k.state === 'engage' || k.state === 'charge');
    assert.truthy(firstStop && firstStop.t > 400, 'the dog has a real march-in');
    // During the march-in the dog reads as its own track; once the assault
    // spreads over the yard, paths may legitimately cross near buildings.
    for (let t = 0; t <= firstStop.t; t += 100) {
      const dog = C.unitAt(pet, t);
      const nearest = Math.min(...squad.map(u => {
        const soldier = C.unitAt(u, t);
        return Math.hypot(dog.x - soldier.x, dog.y - soldier.y);
      }));
      assert.truthy(nearest >= 42, 'pet/soldier gap at '+t+'ms was '+nearest);
    }
  });

  test('the dog runs rank one\'s route, gets to each building first, and only engages something that is there', () => {
    const s = buildOf(bigWin, 8, PET);
    const pet = s.units.find(u => u.kind === 'pet');
    const lead = s.units.find(u => u.kind === 'squad' && u.index === 0);
    const real = s.towers.filter(t => !t.virtual);
    const petStops = pet.keys.filter(k => k.state === 'engage');
    const leadStops = lead.keys.filter(k => k.state === 'engage');
    assert.truthy(petStops.length >= 1, 'the dog harasses at least one building');
    // Every dog `engage` stands within one sprite of a real building — it
    // never lunges at empty yard (the old _meet point had nothing at it).
    for (const k of petStops) {
      const near = real.some(t => Math.hypot(k.x - t.x, k.y - t.y) < 70);
      assert.truthy(near, 'dog engages at (' + Math.round(k.x) + ',' + Math.round(k.y) + ') with no building there');
    }
    // It leads: at rank one's buildings (all but the gate) it arrives earlier
    // and stands on the far flank, 40–100 px from the soldier.
    const shared = Math.min(petStops.length, leadStops.length) - 1;   // the last engage of each is the gate
    assert.truthy(shared >= 1);
    for (let i = 0; i < shared; i++) {
      // The level-8 base's first building is 120 px from the muster — rank
      // one barely walks — so the dog may be a beat behind there; from the
      // second building on it is clearly out in front.
      assert.truthy(petStops[i].t <= leadStops[i].t + (i ? 0 : 250), 'dog arrives with or before rank one at building ' + i);
      const gap = Math.hypot(petStops[i].x - leadStops[i].x, petStops[i].y - leadStops[i].y);
      assert.inRange(gap, 40, 100, 'dog/soldier flank gap at building ' + i);
    }
    if (shared >= 2) assert.truthy(petStops[1].t < leadStops[1].t, 'the dog leads to the second building');
    // While it is there it bites between the crew's blows — never before the building exists to bite.
    assert.truthy(pet.blowAt.length >= 2);
    for (const b of pet.blowAt) assert.truthy(b > petStops[0].t, 'a bite before the dog arrived');
  });

  test('towers stand exactly where the defender placed them on the home grid', () => {
    // Same projection as the builder's .nr-free-grid on the 800px board:
    // left 18%, top 25%, 64% square, 12 cells. Spike traps are on the board
    // too — they cost 2000 xu and add DEF, so the raid must show them.
    const s = buildOf(bigWin, 8, PET);
    const cells = R.normalizeLayout(bigWin.target.layout).cells.slice(0, C.MAX_BUILDINGS);
    const real = s.towers.filter(t => !t.virtual);
    assert.equal(real.length, cells.length);
    assert.truthy(real.some(t => t.type === 'spike-trap' && t.trap), 'the level-8 base has traps and they are on the board');
    real.forEach((t, i) => {
      assert.equal(t.x, Math.round(144 + (cells[i].gx + .5) * 512 / 12));
      assert.equal(t.y, Math.round(200 + (cells[i].gy + 1) * 512 / 12));
    });
  });

  test('a won raid breaks the base: every real tower topples before the breach', () => {
    const s = buildOf(bigWin, 8, PET);
    const real = s.towers.filter(t => !t.virtual);
    assert.truthy(real.length >= 1);
    for (const t of real) {
      assert.truthy(t.fallAt != null, t.type + ' must fall');
      assert.inRange(t.fallAt, s.engageStart, s.breachAt, t.type + ' falls while being attacked, not by itself after the breach');
      assert.truthy(s.events.some(e => e.type === 'demolish' && e.t === t.fallAt), 'demolish event fires with the collapse');
    }
    const lost = buildOf(heavyLoss, 8, PET);
    for (const t of lost.towers) assert.equal(t.fallAt, null);
  });

  test('winning survivors reach the castle at the breach, then carry the loot home', () => {
    const s = buildOf(bigWin, 8, PET);
    for (const u of s.units.filter(u => u.fallAt == null)) {
      const atBreach = C.unitAt(u, s.breachAt + 60);
      assert.truthy(atBreach.x < 340, u.kind + u.index + ' is at the castle when it breaks');
      const end = C.unitAt(u, s.durationMs);
      assert.equal(end.state, 'carry', 'the raid ends by CARRYING the loot, not standing around');
      assert.truthy(end.x > 500, u.kind + u.index + ' runs the loot back home');
    }
  });
});

suite('night raid choreography: the battle moves like a real raid', () => {
  test('every soldier marches at one believable shared speed', () => {
    const s = buildOf(bigWin, 8, PET);
    const speeds = [];
    for (const u of s.units.filter(u => u.kind === 'squad')) {
      const from = u.keys.find(k => k.state === 'march');
      const to = u.keys[u.keys.indexOf(from) + 1];
      const d = Math.hypot(to.x - from.x, to.y - from.y);
      const v = d / Math.max(1, to.t - from.t) * 1000;
      assert.inRange(v, 70, 150, 'march speed was ' + v.toFixed(0) + ' px/s');
      speeds.push(v);
    }
    const spread = Math.max(...speeds) / Math.min(...speeds);
    assert.truthy(spread <= 1.4,
      'identical soldiers must not move at wildly different speeds (spread ' + spread.toFixed(2) + ')');
  });

  test('a building only breaks while someone is actually smashing it', () => {
    const s = buildOf(bigWin, 8, PET);
    for (const t of s.towers.filter(t => !t.virtual)) {
      const near = s.units.some(u => {
        const pose = C.unitAt(u, t.fallAt - 80);
        return Math.hypot(pose.x - t.x, pose.y - t.y) < 95;
      });
      assert.truthy(near, t.type + ' fell with no attacker anywhere near it');
      assert.truthy(Array.isArray(t.hitAt) && t.hitAt.length >= 2, t.type + ' takes real blows');
      assert.truthy(t.hitAt[t.hitAt.length - 1] <= t.fallAt, 'the last blow lands before the collapse');
      assert.truthy(t.crackAt != null && t.crackAt < t.fallAt, 'damage shows before the fall');
      assert.truthy(s.events.some(e => e.type === 'smash' && e.t === t.hitAt[0]),
        'each blow is a visible smash event');
    }
  });

  test('a stone wall takes visibly longer to break than a wooden fence', () => {
    const target = { ...R.trainingTarget(8), layout: { cells: [
      { type: 'wood-fence', gx: 3, gy: 7, tier: 1 },
      { type: 'stone-wall', gx: 8, gy: 7, tier: 1 },
    ] } };
    const result = R.resolveAutoBattle(target, (target.defense || 100) + 150);
    const s = C.build(result, target, 2, null, target.seed);
    const fence = s.towers.find(t => t.type === 'wood-fence');
    const wall = s.towers.find(t => t.type === 'stone-wall');
    assert.truthy(fence && wall && fence.fallAt != null && wall.fallAt != null);
    const fenceWork = fence.fallAt - fence.hitAt[0];
    const wallWork = wall.fallAt - wall.hitAt[0];
    assert.truthy(wallWork > fenceWork * 1.4,
      'stone (' + wallWork + 'ms) must outlast wood (' + fenceWork + 'ms)');
  });

  test('a won raid has a real looting beat between the breach and going home', () => {
    const s = buildOf(bigWin, 8, PET);
    const loots = s.events.filter(e => e.type === 'loot');
    assert.truthy(loots.length >= 2, 'grabbing the loot is visible');
    for (const e of loots) assert.inRange(e.t, s.breachAt, s.durationMs);
    const survivor = s.units.find(u => u.kind === 'squad' && u.fallAt == null);
    const looting = C.unitAt(survivor, s.breachAt + 400);
    assert.truthy(['charge', 'loot'].includes(looting.state), 'survivors spend time AT the castle looting');
    assert.truthy(s.durationMs - s.breachAt >= 2200,
      'breach -> loot -> carry home needs real time, got ' + (s.durationMs - s.breachAt) + 'ms');
  });

  test('on a loss the same script stays honest: no falls, no loot, a real retreat', () => {
    const s = buildOf(heavyLoss, 8, PET);
    assert.falsy(s.events.some(e => e.type === 'loot'), 'a repelled raid steals nothing');
    for (const u of s.units.filter(u => u.fallAt == null)) {
      const end = C.unitAt(u, s.durationMs);
      assert.equal(end.state, 'flee');
      assert.truthy(end.x > 480, 'survivors make it back off the field');
    }
  });
});

suite('night raid choreography: movement that does not slide, a gate that is not a blob', () => {
  // Load the Phaser layer's pure helpers in Node: it only touches Phaser
  // inside the class, and reads Rules/Choreo from globals like the app does.
  global.NightRaidRules = R; global.NightRaidChoreo = C;
  const P = require('../js/night-raid-phaser.js');

  test('every move ramps up and brakes over ~240 ms with ONE cruise speed in between', () => {
    const s = buildOf(bigWin, 8, PET);
    for (const u of s.units) {
      for (let i = 1; i < u.keys.length; i++) {
        const a = u.keys[i - 1], b = u.keys[i];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 5) continue;         // a wait, not a move
        assert.equal(b.ease, 'ramp', u.kind + u.index + ' segment ' + i + ' uses ' + b.ease);
        const dur = b.t - a.t;
        if (dur < 900) continue;
        // Speed profile in px per 100 ms: slow start, flat middle, slow end.
        const speed = t => C.odometer(u, t + 100) - C.odometer(u, t);
        const first = speed(a.t), last = speed(b.t - 100), cruise = [];
        for (let t = a.t + C.RAMP_MS; t + 100 <= b.t - C.RAMP_MS; t += 100) cruise.push(speed(t));
        const top = Math.max(first, last, ...cruise);
        assert.truthy(first < top * .5, 'launch is gradual: first 100 ms moved ' + first.toFixed(1) + ' of top ' + top.toFixed(1));
        assert.truthy(last < top * .5, 'arrival is gradual: last 100 ms moved ' + last.toFixed(1) + ' of top ' + top.toFixed(1));
        for (const c of cruise) assert.inRange(c, top * .98, top * 1.0001, 'cruise speed is flat');
      }
    }
    // The ramp itself, in isolation: no instantaneous velocity anywhere.
    let prev = 0;
    for (let p = 0; p <= 1.0001; p += .01) { const s2 = C.rampAt(p, 2000); assert.truthy(s2 >= prev - 1e-9); prev = s2; }
    assert.inRange(C.rampAt(.5, 2000), .49, .51);
    assert.equal(C.rampAt(1, 2000), 1);
    assert.truthy(C.rampAt(.01, 2000) < .002, 'the first 20 ms cover almost nothing');
  });

  test('the odometer is what drives the legs: it is monotonic, stops when the body stops and equals the path length at the end', () => {
    const s = buildOf(bigWin, 8, PET);
    for (const u of s.units) {
      let prev = 0, prevMoving = false, len = 0;
      for (let i = 1; i < u.keys.length; i++) len += Math.hypot(u.keys[i].x - u.keys[i - 1].x, u.keys[i].y - u.keys[i - 1].y);
      for (let t = 0; t <= s.durationMs; t += 40) {
        const d = C.odometer(u, t), pose = C.unitAt(u, t);
        assert.truthy(d >= prev - 1e-9, 'odometer ran backwards');
        // Standing for the whole 40 ms window: not one pixel on the clock.
        if (!pose.moving && !prevMoving && t > 0) assert.truthy(d - prev < 1e-6, u.kind + u.index + ' legs cycled ' + (d - prev).toFixed(2) + ' px while standing at ' + t);
        prev = d; prevMoving = pose.moving;
      }
      assert.inRange(C.odometer(u, s.durationMs + 1), len - .01, len + .01);
    }
    // A stride is 70 px on the board: one full 6-frame cycle per stride, so
    // the frame changes every ~11.7 px moved, not every 112 ms.
    assert.equal(C.STRIDE_PX, 70);
  });

  test('gate posts: eleven slots, every pair at least 45 px apart, all at the castle and in front of it', () => {
    const slots = C.GATE_SLOTS;
    assert.equal(slots.length, 11);
    for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++)
      assert.truthy(Math.hypot(slots[i].x - slots[j].x, slots[i].y - slots[j].y) >= 45, 'slots ' + i + ',' + j + ' too close');
    for (const p of slots) { assert.truthy(p.x < 340, 'at the castle'); assert.truthy(p.y >= 340, 'in front of the castle art, never behind it'); }
    // Assigned posts in a full raid keep that spacing (±2 px jitter).
    const s = buildOf(bigWin, 10, PET);
    const gates = s.units.map(u => u._gate);
    assert.equal(gates.length, 11);
    let min = Infinity;
    for (let i = 0; i < gates.length; i++) for (let j = i + 1; j < gates.length; j++) min = Math.min(min, Math.hypot(gates[i].x - gates[j].x, gates[i].y - gates[j].y));
    assert.truthy(min >= 41, 'min gate distance ' + min.toFixed(1));
    // Loot spots step toward the door but stay a crowd, not a point.
    const loots = s.units.filter(u => !u.fallAt).map(u => u.keys.find(k => k.state === 'loot'));
    let lmin = Infinity;
    for (let i = 0; i < loots.length; i++) for (let j = i + 1; j < loots.length; j++) lmin = Math.min(lmin, Math.hypot(loots[i].x - loots[j].x, loots[i].y - loots[j].y));
    assert.truthy(lmin >= 30, 'min loot distance ' + lmin.toFixed(1));
    // Departures for home are staggered, never one block turning at once.
    const carries = s.units.filter(u => !u.fallAt).map(u => u.keys.find(k => k.state === 'carry').t);
    assert.truthy(new Set(carries).size >= carries.length - 1, 'carry departures are staggered');
  });

  test('blows are scheduled per unit, at buildings and at the gate, so the swing frame can anticipate them', () => {
    const s = buildOf(bigWin, 8, PET);
    for (const u of s.units) {
      assert.truthy(Array.isArray(u.blowAt) && u.blowAt.length >= 2, u.kind + u.index + ' has blows');
      for (let i = 1; i < u.blowAt.length; i++) assert.truthy(u.blowAt[i] > u.blowAt[i - 1], 'sorted');
      if (u.fallAt != null) for (const b of u.blowAt) assert.truthy(b < u.fallAt, 'no blows after falling');
      // Every blow lands while the unit is standing (engage), not mid-stride.
      for (const b of u.blowAt) { const p = C.unitAt(u, b); assert.truthy(!p.moving && (p.state === 'engage' || p.state === 'fallen'), u.kind + u.index + ' swings while ' + p.state + (p.moving ? ' moving' : '') + ' at ' + b); }
    }
    const gateHits = s.events.filter(e => e.type === 'gatehit');
    assert.truthy(gateHits.length >= 4, 'the door takes visible blows');
    for (const e of gateHits) assert.inRange(e.t, s.engageStart, s.breachAt);
    // On a loss the crews hack at the FIRST defences on their route — the
    // buildings jolt and spark but never crack — so the towers are seen doing the repelling.
    const lost = buildOf(heavyLoss, 8, PET);
    let stood = 0;
    for (const u of lost.units) {
      assert.truthy(u._post && !u._post.virtual, u.kind + u.index + ' engages at a real defence, not empty yard');
      const stand = u.keys.find(k => k.state === 'engage');
      // A soldier shot down on the way never gets to stand anywhere.
      if (!stand) { assert.truthy(u.fallAt != null, u.kind + u.index + ' has no post and did not fall'); continue; }
      stood++;
      assert.truthy(Math.hypot(stand.x - u._post.x, stand.y - u._post.y) < 110, 'stands AT the building');
      assert.truthy(stand.x > C.WALL_X, 'still never at the castle wall');
    }
    assert.truthy(stood >= 3, 'most of the squad reaches a defence before the volleys start');
    assert.truthy(lost.towers.some(t => t.hitAt.length >= 2), 'the defended building takes blows');
    for (const t of lost.towers) { assert.equal(t.fallAt, null); assert.equal(t.crackAt, null); }
    assert.falsy(lost.events.some(e => e.type === 'gatehit'), 'nobody reaches the door on a loss');
  });

  test('spike traps are on the board and get disarmed; water cannons reload on the rules\' cooldown', () => {
    const s = buildOf(bigWin, 8, PET);
    const traps = s.towers.filter(t => t.type === 'spike-trap');
    assert.truthy(traps.length >= 1, 'the level-8 base has traps');
    for (const t of traps) { assert.truthy(t.trap); assert.truthy(t.fallAt != null && t.fallAt < s.breachAt, 'disarmed before the breach'); assert.equal(t.hitAt.length, 2, 'two blows per trap'); }
    assert.equal(C.TOWER_COOLDOWN.water, R.defenseById('water-cannon').cooldown);
    assert.equal(C.TOWER_COOLDOWN.pebble, R.defenseById('pebble-pup').cooldown);
  });

  test('the camera frame keeps the castle gate AND every standing unit in view for the whole fight, on wins and losses', () => {
    for (const [f, n] of [[bigWin, 8], [narrowWin, 10], [heavyLoss, 8], [bigWin, 1]]) {
      const s = buildOf(f, n, PET);
      for (let T = 0; T <= s.durationMs; T += 50) {
        const cam = P.cameraFrame(s, T), half = P.SIZE / cam.zoom / 2;
        assert.inRange(cam.zoom, P.FRAME_ZOOM_MIN, P.BREACH_ZOOM + 1e-9);
        // The view never leaves the board.
        assert.truthy(cam.x - half >= -1e-6 && cam.x + half <= P.SIZE + 1e-6 && cam.y - half >= -1e-6 && cam.y + half <= P.SIZE + 1e-6, 'view inside board at ' + T);
        const inside = (x, y) => x >= cam.x - half - .01 && x <= cam.x + half + .01 && y >= cam.y - half - .01 && y <= cam.y + half + .01;
        assert.truthy(inside(C.GATE.x, C.GATE.y), 'gate on screen at ' + T);
        for (const u of s.units) {
          if (u.fallAt != null && T > u.fallAt + 1200) continue;
          const p = C.unitAt(u, T);
          assert.truthy(inside(p.x, p.y) && inside(p.x, p.y - 60), u.kind + u.index + ' off screen at ' + T + ' (' + Math.round(p.x) + ',' + Math.round(p.y) + ') view ' + [cam.x - half, cam.x + half, cam.y - half, cam.y + half].map(Math.round));
        }
      }
      // It is a real camera: it moves and it zooms.
      const z = new Set(), xs = new Set();
      for (let T = 0; T <= s.durationMs; T += 500) { const c = P.cameraFrame(s, T); z.add(Math.round(c.zoom * 20)); xs.add(Math.round(c.x / 20)); }
      assert.truthy(z.size >= 2 || xs.size >= 2, 'the camera follows the action');
      if (s.won) assert.truthy(P.cameraFrame(s, s.breachAt + 150).zoom > P.cameraFrame(s, 600).zoom, 'push-in on the breach');
    }
  });

  test('the separation pass keeps bodies apart without moving anyone far', () => {
    const out = P.separate([{ x: 100, y: 100 }, { x: 103, y: 101 }, { x: 300, y: 300 }], 36, 16);
    const d = Math.hypot(out[0].x - out[1].x, out[0].y - out[1].y);
    assert.truthy(d >= 30, 'pushed apart to ' + d.toFixed(1));
    assert.truthy(Math.hypot(out[0].x - 100, out[0].y - 100) <= 16.01 && Math.hypot(out[1].x - 103, out[1].y - 101) <= 16.01, 'each moved at most maxPush');
    // Eleven bodies dumped on one spot end up a crowd, none flung far.
    const pile = P.separate(Array.from({ length: 11 }, (_, i) => ({ x: 200 + (i % 3), y: 300 + (i % 2) })));
    for (let i = 0; i < pile.length; i++) assert.truthy(Math.hypot(pile[i].x - (200 + (i % 3)), pile[i].y - (300 + (i % 2))) <= 16.01);
    assert.deepEqual(out[2], { x: 300, y: 300 }, 'a lone unit is untouched');
    assert.deepEqual(P.separate([]), []);
    // Deterministic — the frame stays a pure function of T.
    assert.deepEqual(P.separate([{ x: 1, y: 2 }, { x: 4, y: 2 }]), P.separate([{ x: 1, y: 2 }, { x: 4, y: 2 }]));
  });

  test('castle ruin frames have per-frame anchors so the footprint stays put as the walls fall', () => {
    for (const atlas of ['a', 'b']) {
      const rows = P.castleAnchors[atlas];
      assert.equal(rows.length, 5);
      for (const row of rows) {
        assert.equal(row.length, 3);
        // The generated ruins sit further LEFT in their cells than the intact
        // castle — the reason the old fixed box made the keep jump sideways.
        assert.truthy(row[0][0] > row[1][0] && row[1][0] > row[2][0], 'base centre drifts left with damage: ' + row.map(a => a[0]).join(' > '));
        for (const [cx, bottom] of row) { assert.inRange(cx, .3, .65); assert.inRange(bottom, .92, 1); }
      }
    }
    assert.deepEqual(P.CASTLE_REF, [.5073, .9951]);
  });
});

suite('night raid choreography: app integration', () => {
  test('choreo module ships in the app shell between rules and game', () => {
    const html = read('index.html');
    const rules = html.indexOf('night-raid-rules.js');
    const choreo = html.indexOf('night-raid-choreo.js');
    const game = html.indexOf('night-raid-game.js');
    assert.truthy(rules >= 0 && choreo >= 0 && game >= 0);
    assert.truthy(rules < choreo && choreo < game);
  });
  test('choreo module works offline', () => {
    assert.truthy(read('sw.js').includes("'/js/night-raid-choreo.js'"));
  });
  test('AutoBattle renders from the choreography script', () => {
    const game = read('js/night-raid-game.js');
    assert.truthy(game.includes('NightRaidChoreo'));
    assert.truthy(game.includes('class AutoBattle'));
    assert.truthy(game.includes('playReplay(commands,speed=1)'));
  });
  test('marching units leave planted footprints and kicked-up dust', () => {
    // The trail is sampled from the same keyframes the units walk, quantised
    // to a fixed step grid so prints stay where the foot fell and fade there.
    const game = read('js/night-raid-game.js');
    assert.truthy(game.includes('drawTrail'), 'trail pass missing');
    assert.truthy(/Math\.floor\(T\/STEP\)\*STEP/.test(game), 'steps must be quantised, not slide with the sprite');
    assert.truthy(game.includes("u.kind==='pet'"), 'the pet leaves paw prints, soldiers leave boot prints');
    assert.truthy(game.includes('this.drawTrail(ctx,u,T)'));
  });
});

if (require.main === module) require('./harness').runAll().then(code => process.exit(code));
