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
    // During the march-in the dog reads as its own track; once the assault
    // spreads over the yard, paths may legitimately cross near buildings.
    for (const t of [0, 800, 1600]) {
      const dog = C.unitAt(pet, t);
      const nearest = Math.min(...squad.map(u => {
        const soldier = C.unitAt(u, t);
        return Math.hypot(dog.x - soldier.x, dog.y - soldier.y);
      }));
      assert.truthy(nearest >= 42, 'pet/soldier gap at '+t+'ms was '+nearest);
    }
  });

  test('towers stand exactly where the defender placed them on the home grid', () => {
    // Same projection as the builder's .nr-free-grid on the 800px board:
    // left 18%, top 25%, 64% square, 12 cells.
    const s = buildOf(bigWin, 8, PET);
    const cells = R.normalizeLayout(bigWin.target.layout).cells
      .filter(c => !R.defenseById(c.type).trap).slice(0, 10);
    const real = s.towers.filter(t => !t.virtual);
    assert.equal(real.length, cells.length);
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
