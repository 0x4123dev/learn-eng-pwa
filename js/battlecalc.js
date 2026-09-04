// battlecalc.js — the pure rules of a pet battle: ammo earned from learning,
// deterministic randomness, terrain, physics and damage. No DOM, no network,
// so both phones (and the tests) compute identical results from the same seed.
// The server re-computes ammo from synced activity — this copy is for showing
// the child what they've earned. Constants are pinned by tests/battle.test.js.

// ---- ammo: earned ONLY by learning in the last 3 days ----
const BATTLE_ROUNDS = 5;
const BARRELS = 4;                 // súng 4 nòng: 1–4 tia mỗi lượt
const AMMO_PER_CORRECT = 20;       // 1 shot per 20 correct answers
const AMMO_VOLUME_MAX = 8;
const AMMO_PERFECT_MAX = 10;       // 1 per perfect (10/10) session
const AMMO_STREAK_BONUS = 2;       // studied all 3 days
const AMMO_CAP = 20;               // = ROUNDS * BARRELS, nothing wasted
// Rounds are not fixed: one poop per turn stretches 20 shots into 20 rounds.
// BATTLE_ROUNDS is now only the MINIMUM a full clip can be spent in (20/4).
// MAX_TURNS is a runaway guard, never a real ending.
const MAX_TURNS = AMMO_CAP * 2 + 4;

// stats: { correct, perfects, days }  → shots (0..20)
function computeAmmo(stats) {
  const correct = Math.max(0, Math.trunc((stats && stats.correct) || 0));
  const perfects = Math.max(0, Math.trunc((stats && stats.perfects) || 0));
  const days = Math.max(0, Math.trunc((stats && stats.days) || 0));
  const volume = Math.min(AMMO_VOLUME_MAX, Math.floor(correct / AMMO_PER_CORRECT));
  const quality = Math.min(AMMO_PERFECT_MAX, perfects);
  const consistency = days >= 3 ? AMMO_STREAK_BONUS : 0;
  return Math.min(AMMO_CAP, volume + quality + consistency);
}

// A readable breakdown for the "how did I earn this?" panel.
//
// Every row must answer two questions a child actually asks: what is the rule,
// and how much more do I need? The old label read "8 câu đúng → +0/8 🚀" —
// two unrelated 8s, no mention that 20 correct answers make one shot, and no
// hint that the next one was 12 answers away.
function ammoBreakdown(stats) {
  const correct = Math.max(0, Math.trunc((stats && stats.correct) || 0));
  const perfects = Math.max(0, Math.trunc((stats && stats.perfects) || 0));
  const days = Math.max(0, Math.trunc((stats && stats.days) || 0));

  const volume = Math.min(AMMO_VOLUME_MAX, Math.floor(correct / AMMO_PER_CORRECT));
  const quality = Math.min(AMMO_PERFECT_MAX, perfects);
  const consistency = days >= 3 ? AMMO_STREAK_BONUS : 0;

  const correctGoal = AMMO_VOLUME_MAX * AMMO_PER_CORRECT;   // 160 for all 8

  // Numbers only — no words. The arena speaks two languages, so the wording
  // lives in the UI layer (PB_STR in js/petbattle.js) and this stays the one
  // place the RULES are defined.
  return [
    {
      key: 'volume',
      have: Math.min(correct, correctGoal), goal: correctGoal,
      toNext: AMMO_PER_CORRECT - (correct % AMMO_PER_CORRECT),
      per: AMMO_PER_CORRECT,
      shots: volume, max: AMMO_VOLUME_MAX, maxed: volume >= AMMO_VOLUME_MAX,
    },
    {
      key: 'perfect',
      have: Math.min(perfects, AMMO_PERFECT_MAX), goal: AMMO_PERFECT_MAX,
      toNext: 1, per: 1,
      shots: quality, max: AMMO_PERFECT_MAX, maxed: quality >= AMMO_PERFECT_MAX,
    },
    {
      key: 'streak',
      have: Math.min(days, 3), goal: 3,
      toNext: 3 - Math.min(days, 3), per: AMMO_STREAK_BONUS,
      shots: consistency, max: AMMO_STREAK_BONUS, maxed: !!consistency,
    },
  ];
}

// How many barrels can be loaded this turn.
function maxShotsThisTurn(ammoLeft) {
  // Math.trunc('three') is NaN, and NaN <= 0 is FALSE — so junk ammo slipped
  // past the empty-clip guard and fired a phantom volley. Coerce first.
  const n = Math.trunc(Number(ammoLeft));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(BARRELS, n));
}

// ---- deterministic randomness (mulberry32) ----
function makeRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- battlefield ----
// Two immutable rule sets. v1 is the original single-screen field and must
// NEVER change: active battles and every replay hash depend on it byte for
// byte. v2 is the long world — 2000px wide, viewed through the same 800px
// window — and its constants were chosen by measurement, not by feel:
// 300 seeds × wind -20/0/+20 × both directions = 1800 scenarios, all of them
// reachable, worst case still offering 20 legal angle/power solutions, and
// the practice bot's existing coarse search solving 100% of them (worst miss
// 34px, inside a blast radius). Flight lands at 2.6-3.3s rendered.
const FIELD_RULES = {
  1: {
    version: 1, worldW: 800, viewW: 800, worldH: 450,
    spawnX: [90, 710], gravity: 0.18, windAccel: 0.004,
    v0Base: 4, v0Gain: 0.09, plateau: 46, lane: 150, waveScale: 1,
    groundMin: 250, groundMax: 400, muzzleY: 34, muzzleClearance: 4, maxFrames: 900,
    castle: null,                    // v1 measured damage from the pet's feet
  },
  2: {
    version: 2, worldW: 2000, viewW: 800, worldH: 450,
    spawnX: [140, 1860], gravity: 0.15, windAccel: 0.002,
    v0Base: 4, v0Gain: 0.165, plateau: 92, lane: 300, waveScale: 2.5,
    groundMin: 250, groundMax: 400, muzzleY: 34, muzzleClearance: 4, maxFrames: 2600,
    // The drawn castle spans x ±70 and stands 122px tall. Damage used to be
    // measured from the pet's GROUND ANCHOR with a blast radius of about 21px
    // at level 17 — so a poop could land squarely on the house and deal
    // nothing, because it was 40px from the dog's feet. The castle is now the
    // target it looks like.
    castle: { halfW: 70, height: 122 },
  },
  3: {
    // v3 keeps the proven long-world ballistics, but lets the snapshotted
    // arena choose asymmetric spawn elevations. v1/v2 remain replay-stable.
    //
    // Wind is DOUBLE v2's, and that was a CORRECTION, not a tuning whim. A
    // child reported "sao voi moi huong gio, toi luon dung luc 100 va goc 20
    // deu trung doi thu" — whatever the wind, power 100 / angle 20 hits. The
    // cause was not weak wind but the shape of the target: the castle is a
    // 122px-tall WALL, so a flat shot arriving almost horizontally only has to
    // REACH it, never to drop into a narrow opening. It drifted 11px against a
    // ±91px target while a lob drifted hundreds. Sweeping 10 arenas x 3 seeds found
    // 162 aims that beat every wind at 0.002 and ZERO at 0.004, with every
    // scenario still winnable; 0.006 was measured too and broke reachability
    // (80%). Nerfing the shell's range was NOT needed.
    //
    // Changing a shipped version in place is normally forbidden here — both
    // phones replay a battle from its stored field_version, so a constant that
    // moves under a live battle desyncs it. It was safe exactly once: at the
    // time of the change production D1 held no v3 battle row at all (1 v1 and
    // 3 v2 rows, all done/declined/expired), so no replay could depend on
    // these numbers. v3 is frozen from that point on — the next physics change
    // adds a v4 and bumps FIELD_VERSION_NEW in functions/api/_battle.js.
    version: 3, worldW: 2000, viewW: 800, worldH: 450,
    spawnX: [140, 1860], gravity: 0.15, windAccel: 0.004,
    v0Base: 4, v0Gain: 0.165, plateau: 92, lane: 300, waveScale: 2.5,
    groundMin: 250, groundMax: 400, muzzleY: 34, muzzleClearance: 4, maxFrames: 2600,
    castle: { halfW: 70, height: 122 },
  },
  4: {
    // v4 changes the BUILDING and nothing else: identical ballistics to v3,
    // but the castle becomes the hired đồng đội's home and is drawn — and
    // therefore hit — at fortress scale. The drawn castle and this hitbox are
    // the same shape by rule; v2 shipped with damage measured 40px from where
    // the wall was drawn and a poop could land on the house for nothing.
    //
    // A bigger box is easier to hit for BOTH sides, so the duel stays
    // symmetric and matches run slightly shorter, which suits the added
    // mid-battle decisions. v1–v3 are frozen: a stored battle replays under
    // the version it was fought in.
    version: 4, worldW: 2000, viewW: 800, worldH: 450,
    spawnX: [140, 1860], gravity: 0.15, windAccel: 0.004,
    v0Base: 4, v0Gain: 0.165, plateau: 92, lane: 300, waveScale: 2.5,
    groundMin: 250, groundMax: 400, muzzleY: 34, muzzleClearance: 4, maxFrames: 2600,
    castle: { halfW: 100, height: 165 },
  },
  5: {
    // v5 restores the aiming challenge lost when v4 enlarged the castle. A
    // 200px-wide, 165px-tall wall made a flat 100-power shot intersect the
    // target across too many winds: reaching the far side was often enough.
    // Horizontal wind alone barely changes a low arc because it is airborne
    // for less time, so v5 adds deterministic aerodynamic lift/downforce.
    // Tail/head wind now bends the arc as well as changing its range.
    //
    // Measured across 10 arenas × 10 seeds × 9 winds × both directions:
    // every one of 1,800 scenarios remains reachable (worst: 7 legal aims),
    // while 100 power / 20° is no longer universal in any of 200 matchups.
    // v1–v4 stay frozen for stored battles and deterministic replays.
    version: 5, worldW: 2000, viewW: 800, worldH: 450,
    spawnX: [140, 1860], gravity: 0.15, windAccel: 0.004, windLift: 0.0055,
    v0Base: 4, v0Gain: 0.165, plateau: 92, lane: 300, waveScale: 2.5,
    groundMin: 250, groundMax: 400, muzzleY: 34, muzzleClearance: 4, maxFrames: 2600,
    castle: { halfW: 100, height: 165 },
  },
  6: {
    // v6 keeps v5 aiming, but stretches a duel into several exchanges. The
    // large fortress made a four-shell direct volley visually satisfying but
    // too often fatal. Damage is scaled per shell and the whole volley has a
    // hard ceiling, including hired Gunner rockets: one lucky tap can never
    // erase a fresh 100 HP castle.
    version: 6, worldW: 2000, viewW: 800, worldH: 450,
    spawnX: [140, 1860], gravity: 0.15, windAccel: 0.004, windLift: 0.0055,
    v0Base: 4, v0Gain: 0.165, plateau: 92, lane: 300, waveScale: 2.5,
    groundMin: 250, groundMax: 400, muzzleY: 34, muzzleClearance: 4, maxFrames: 2600,
    castle: { halfW: 100, height: 165 },
    damageScale: 0.4, shellDamageCap: 22, maxVolleyDamage: 85,
  },
  7: {
    // v7 is a compact high-arc battlefield. A battle uses this version only
    // with one of the ten authored obstacle arenas: the solid centre mass is
    // part of this height map, so a flat shell hits it instead of flying
    // through decorative art. The 1200px world is still wider than one phone
    // viewport, but short enough to keep both forts and the obstacle legible.
    version: 7, worldW: 1200, viewW: 800, worldH: 450,
    spawnX: [120, 1080], gravity: 0.15, windAccel: 0.004, windLift: 0.003,
    v0Base: 4, v0Gain: 0.165, plateau: 82, lane: 150, waveScale: 1.5,
    groundMin: 250, groundMax: 400, muzzleY: 34, muzzleClearance: 4, maxFrames: 2200,
    castle: { halfW: 100, height: 165 },
    damageScale: 0.4, shellDamageCap: 22, maxVolleyDamage: 85,
    highArc: true,
  },
};
// Anything unknown, missing or legacy is v1 — an unrecognised version must
// never silently reinterpret a battle that is already in progress.
function fieldRules(v) {
  const n = Number(v);
  return FIELD_RULES[n] || FIELD_RULES[1];
}

// Smaller y means higher ground. Every arena deliberately tells a different
// tactical story; no v3 match starts with both castles on the same horizon.
// Targets stay inside the proven 250–400 terrain band so all legal winds remain
// playable with the existing long-world ballistics.
const BATTLE_TERRAIN_PROFILES = Object.freeze({
  'cloudstep-meadow': Object.freeze({ spawnY: [366, 286] }),
  'clockwork-canyon': Object.freeze({ spawnY: [278, 366] }),
  'sakura-shrine': Object.freeze({ spawnY: [365, 300] }),
  'aurora-glacier': Object.freeze({ spawnY: [276, 374] }),
  'ember-caldera': Object.freeze({ spawnY: [377, 287] }),
  'pirate-lagoon': Object.freeze({ spawnY: [392, 286] }),
  'firefly-forest': Object.freeze({ spawnY: [292, 374] }),
  'moonlit-rooftops': Object.freeze({ spawnY: [375, 280] }),
  'candy-cloudworks': Object.freeze({ spawnY: [285, 370] }),
  'cosmic-observatory': Object.freeze({ spawnY: [378, 288] }),
  'tropical-monolith': Object.freeze({ spawnY: [350, 305], barrier: { x: 600, halfW: 92, top: 112, shoulder: 48, crown: 32 } }),
  'aurora-ice-spire': Object.freeze({ spawnY: [322, 282], barrier: { x: 565, halfW: 105, top: 108, shoulder: 52, crown: 56 } }),
  'giant-mushroom-grove': Object.freeze({ spawnY: [292, 360], barrier: { x: 600, halfW: 126, top: 132, shoulder: 58, crown: 30 } }),
  'thunder-totem-canyon': Object.freeze({ spawnY: [365, 286], barrier: { x: 650, halfW: 72, top: 122, shoulder: 42, crown: 24 } }),
  'crystal-rift': Object.freeze({ spawnY: [285, 358], barrier: { x: 600, halfW: 128, top: 118, shoulder: 60, crown: 58 } }),
  'sunken-temple-lagoon': Object.freeze({ spawnY: [384, 278], barrier: { x: 560, halfW: 86, top: 112, shoulder: 46, crown: 34 } }),
  'dragonbone-desert': Object.freeze({ spawnY: [360, 282], barrier: { x: 590, halfW: 142, top: 136, shoulder: 62, crown: 55 } }),
  'moon-gate-ruins': Object.freeze({ spawnY: [286, 365], barrier: { x: 600, halfW: 134, top: 108, shoulder: 56, crown: 38 } }),
  'sky-beanstalk': Object.freeze({ spawnY: [370, 278], barrier: { x: 560, halfW: 98, top: 116, shoulder: 48, crown: 46 } }),
  'candy-volcano': Object.freeze({ spawnY: [282, 368], barrier: { x: 650, halfW: 126, top: 104, shoulder: 60, crown: 62 } }),
});

function terrainProfileFor(id) {
  return BATTLE_TERRAIN_PROFILES[String(id || '')] || BATTLE_TERRAIN_PROFILES['cloudstep-meadow'];
}

const FIELD_W = FIELD_RULES[1].worldW;
const FIELD_H = FIELD_RULES[1].worldH;
const GROUND_MIN = 250;            // highest hills reach this y
const GROUND_MAX = 400;
const SPAWN_LEFT_X = 90;
const SPAWN_RIGHT_X = FIELD_W - 90;
const MUZZLE_Y = 34;               // barrel height above the ground
const MUZZLE_CLEARANCE = 4;        // frames before terrain can be hit
const PLATEAU_R = 46;              // levelled ground each side of a pet
const LANE_LEN = 150;              // clear firing lane in front of a pet

// Rolling hills as a height per x-column, from the shared seed.
function buildTerrain(seed, rules, arenaId) {
  const R = rules || FIELD_RULES[1];
  const rng = makeRng(seed);
  // Wavelengths scale with the world, or a 2000px field would be a picket
  // fence of identical hills instead of readable rolling terrain.
  const k = R.waveScale;
  const waves = [
    { amp: 38 + rng() * 26, len: (260 + rng() * 160) * k, ph: rng() * Math.PI * 2 },
    { amp: 16 + rng() * 14, len: (120 + rng() * 70) * k, ph: rng() * Math.PI * 2 },
    { amp: 7 + rng() * 6, len: (55 + rng() * 30) * k, ph: rng() * Math.PI * 2 },
  ];
  const base = 320 + rng() * 30;
  const h = new Array(R.worldW);
  for (let x = 0; x < R.worldW; x++) {
    let y = base;
    for (const w of waves) y -= Math.sin((x / w.len) * Math.PI * 2 + w.ph) * w.amp;
    h[x] = Math.max(R.groundMin, Math.min(R.groundMax, y));
  }
  const profile = R.version >= 3 ? terrainProfileFor(arenaId) : null;
  if (profile) {
    // Blend each natural hill into its authored platform over a wide shoulder.
    // The easing avoids an artificial vertical cliff at the plateau edge.
    R.spawnX.forEach((cx, index) => {
      const target = profile.spawnY[index];
      const shoulder = R.plateau + 190;
      for (let x = Math.max(0, cx - shoulder); x <= Math.min(R.worldW - 1, cx + shoulder); x++) {
        const d = Math.abs(x - cx);
        const t = Math.max(0, Math.min(1, (shoulder - d) / (shoulder - R.plateau)));
        const eased = t * t * (3 - 2 * t);
        h[x] = h[x] * (1 - eased) + target * eased;
      }
    });
    // Compact arenas have one authored solid obstacle. `top` is intentionally
    // far above the castle roofs: low/direct fire collides with the obstacle,
    // while a deliberate high lob can clear it and descend onto the target.
    // Broad eased shoulders make the visual terrain join the generated art
    // without a one-pixel vertical seam.
    if (R.highArc && profile.barrier) {
      const b = profile.barrier;
      const reach = b.halfW + b.shoulder;
      for (let x = Math.max(0, b.x - reach); x <= Math.min(R.worldW - 1, b.x + reach); x++) {
        const d = Math.abs(x - b.x);
        let obstacleY;
        if (d <= b.halfW) {
          const q = d / b.halfW;
          obstacleY = b.top + b.crown * q * q;
        } else {
          const q = (d - b.halfW) / b.shoulder;
          const edgeY = b.top + b.crown;
          obstacleY = edgeY + (h[x] - edgeY) * (q * q * (3 - 2 * q));
        }
        h[x] = Math.min(h[x], obstacleY);
      }
    }
  }
  // Each pet stands on a levelled peak with a clear firing lane. Without
  // this, ~13% of seeds put a pet in a valley where its own hillside
  // swallowed the first shot — unfair and confusing for a child.
  for (const cx of R.spawnX) {
    let peak = profile ? profile.spawnY[R.spawnX.indexOf(cx)] : h[cx];
    if (!profile) {
      for (let x = cx - R.plateau; x <= cx + R.plateau; x++) {
        if (x >= 0 && x < R.worldW) peak = Math.min(peak, h[x]); // min y = highest ground
      }
    }
    for (let x = cx - R.plateau; x <= cx + R.plateau; x++) {
      if (x >= 0 && x < R.worldW) h[x] = peak;
    }
    // Nothing in the muzzle's path may tower over the pet.
    const dir = cx < R.worldW / 2 ? 1 : -1;
    for (let i = R.plateau; i <= R.lane; i++) {
      const x = cx + dir * i;
      if (x < 0 || x >= R.worldW) break;
      if (h[x] < peak) h[x] = peak;                              // shave the blocker
    }
  }
  return h;
}

// Both pets stand on the terrain, near opposite edges.
function spawnPoints(terrain, rules) {
  const R = rules || FIELD_RULES[1];
  return R.spawnX.map(x => ({ x, y: terrain[x] }));
}

// Wind changes every round: -20..+20 (positive blows right).
function windForRound(seed, roundNo) {
  const rng = makeRng((seed ^ (roundNo * 0x9E3779B1)) >>> 0);
  return Math.round((rng() * 2 - 1) * 20);
}

// ---- physics ----
const GRAVITY = 0.18;              // px per frame²
const WIND_ACCEL = 0.004;          // per wind unit per frame
const FRAME_MS = 1000 / 60;
const MAX_FRAMES = 900;            // ~15s safety cap

// A volley fans out: more barrels ⇒ wider spread, so 4 tia blanket an area
// instead of stacking four identical direct hits.
function volleyAngles(angle, shots, seed, turnNo) {
  const n = Math.max(1, Math.min(BARRELS, shots));
  if (n === 1) return [angle];
  const rng = makeRng((seed ^ (turnNo * 0x85EBCA6B)) >>> 0);
  const spread = 1.6 + n * 1.1;                  // degrees to each side
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : (i / (n - 1)) * 2 - 1;   // -1..1
    out.push(angle + t * spread + (rng() - 0.5) * 0.8);
  }
  return out;
}

// Simulate one projectile. shooter: {x,y}, facing: 1 (rightwards) | -1.
// Returns { points:[{x,y}], hit:{x,y}|null, frames }.
function simulateShot(opts) {
  const R = opts.rules || FIELD_RULES[1];
  const terrain = opts.terrain;
  const from = opts.from;
  const facing = opts.facing >= 0 ? 1 : -1;
  const rad = (opts.angle * Math.PI) / 180;
  const v0 = R.v0Base + R.v0Gain * Math.max(0, Math.min(100, opts.power));
  let vx = Math.cos(rad) * v0 * facing;
  let vy = -Math.sin(rad) * v0;
  let x = from.x + facing * 16;
  let y = from.y - R.muzzleY;
  const wind = opts.wind || 0;
  // Castles that can stop this shell. The caller passes the TARGET only, so a
  // shell can never collide with the wall it is fired from.
  const blockers = Array.isArray(opts.blockers) ? opts.blockers : null;
  const points = [];
  let hit = null;
  let f = 0;
  for (; f < R.maxFrames; f++) {
    // v5 wind has a small vertical aerodynamic component. Multiplying by
    // facing makes this head/tail wind rather than privileging one player.
    // Older frozen rules omit windLift and therefore replay byte-for-byte.
    vy += R.gravity + (R.windLift || 0) * wind * facing;
    vx += R.windAccel * wind;
    x += vx; y += vy;
    points.push({ x, y });
    if (x < -60 || x > R.worldW + 60) break;          // flew off the field

    // The castle is a SOLID building, not a decal. Until this existed the
    // shell collided with terrain only, so a flat shot sailed straight
    // through the walls and landed in the field behind — a child watched a
    // poop go through the house and nothing happen. Checked before terrain,
    // so a shell arriving at the base of a wall hits the wall.
    if (R.castle && blockers && f >= R.muzzleClearance) {
      let struck = null;
      for (const b of blockers) {
        if (!b) continue;
        if (Math.abs(x - b.x) <= R.castle.halfW && y <= b.y && y >= b.y - R.castle.height) { struck = { x, y }; break; }
      }
      if (struck) { hit = struck; break; }
    }

    const col = Math.round(x);
    if (f >= R.muzzleClearance && col >= 0 && col < R.worldW && y >= terrain[col]) {
      hit = { x, y: terrain[col] };
      break;
    }
    if (y > R.worldH + 80) break;
  }
  return { points, hit, frames: f };
}

// ---- damage: the pet's level makes shots bigger and hit harder ----
function blastRadius(level) {
  return Math.min(48, 18 + 0.15 * Math.max(1, level || 1));
}
function shotDamage(level) {
  return 12 + 0.12 * Math.max(1, level || 1);
}
function shellSize(level) {
  return Math.min(11, 5 + 0.03 * Math.max(1, level || 1));
}

// Damage one landed shell does to a target standing at {x,y}.
//
// `target` is the pet's ground anchor. When the rules describe a castle, the
// shell is measured against that BOX rather than the anchor point: a child who
// lands a poop on the wall has hit the house, and the game has to agree with
// its own drawing. Outside the box the old radial falloff still applies, so a
// near miss still grazes.
function damageAt(hit, target, level, rules) {
  if (!hit) return 0;
  const R = rules || FIELD_RULES[1];
  let dist;
  if (R.castle) {
    const dx = Math.max(0, Math.abs(hit.x - target.x) - R.castle.halfW);
    // Above the roof only; a shell at or below ground level is level with it.
    const dy = Math.max(0, (target.y - R.castle.height) - hit.y);
    dist = Math.sqrt(dx * dx + dy * dy);
  } else {
    const dx = hit.x - target.x;
    const dy = hit.y - target.y;
    dist = Math.sqrt(dx * dx + dy * dy);
  }
  const r = blastRadius(level);
  if (dist > r) return 0;
  const base = shotDamage(level) * (Number.isFinite(R.damageScale) ? R.damageScale : 1);
  const falloff = 1 - (dist / r) * 0.75;            // centre hits hurt most
  const direct = dist <= r * 0.28 ? 1.5 : 1;
  const dealt = Math.max(1, Math.round(base * falloff * direct));
  return Number.isFinite(R.shellDamageCap) ? Math.min(R.shellDamageCap, dealt) : dealt;
}

// Level 200 is where blast radius and shell size hit their caps — the natural
// "fully grown" reference to measure a pet against.
const POWER_REF_LEVEL = 200;

// What the child's level is actually worth in a fight, for the arena card.
// Derived from the same functions the physics uses (never re-typed constants),
// so the numbers shown can never drift from the numbers fired.
function powerProfile(level) {
  const lv = Math.max(1, Math.trunc(level || 1));
  const per10 = (fn) => fn(lv + 10) - fn(lv);
  // Blast radius and shell size stop at level 200, but damage keeps climbing
  // forever — so past 200 a raw "value/max" reads 60.0/36.0 and the bar runs
  // off its track. `ratio` is what the bar uses; `beyond` says to drop the
  // "/max" and celebrate instead of showing a nonsense fraction.
  const stat = (key, icon, fn) => {
    const value = fn(lv);
    const max = fn(POWER_REF_LEVEL);
    return {
      key, icon, value, max,
      per10: per10(fn),
      ratio: max > 0 ? Math.min(1, value / max) : 0,
      beyond: value > max,
    };
  };
  return {
    level: lv,
    refLevel: POWER_REF_LEVEL,
    stats: [
      stat('blast', '💥', blastRadius),
      stat('damage', '🎯', shotDamage),
      stat('shell', '⚫', shellSize),
    ],
  };
}

// The most a turn could possibly do — the server clamps reported damage to
// this so a tampered client can't claim a bigger hit than physics allows.
//
// It must round the SAME WAY damageAt does, per shot, not once at the end.
// Ceiling the aggregate looked safer but was actually tighter: at level 120
// three dead-centre hits legitimately total 120 while ceil(3 × 26.4 × 1.5)
// is 119, so the server quietly shaved a point off an honest volley and the
// child's HP bar jumped back up when the turn reconciled.
function maxTurnDamage(shots, level, rules) {
  const n = Math.max(0, Math.min(BARRELS, Math.trunc(Number(shots) || 0)));
  const R = rules || FIELD_RULES[1];
  const scaled = shotDamage(level) * (Number.isFinite(R.damageScale) ? R.damageScale : 1);
  const perShell = Math.min(Number.isFinite(R.shellDamageCap) ? R.shellDamageCap : Infinity,
    Math.round(scaled * 1.5));
  const volley = n * perShell;
  return Number.isFinite(R.maxVolleyDamage) ? Math.min(R.maxVolleyDamage, volley) : volley;
}

// Top-level `const` in a classic script is script-scoped, NOT a window
// property — the game engine must read the constants through this namespace.
const BattleCalc = {
  BATTLE_ROUNDS, BARRELS, AMMO_PER_CORRECT, AMMO_VOLUME_MAX, AMMO_PERFECT_MAX,
  AMMO_STREAK_BONUS, AMMO_CAP, MAX_TURNS, FIELD_W, FIELD_H, GRAVITY, WIND_ACCEL, FRAME_MS,
  computeAmmo, ammoBreakdown, maxShotsThisTurn, makeRng, buildTerrain,
  spawnPoints, windForRound, volleyAngles, simulateShot,
  blastRadius, shotDamage, shellSize, damageAt, maxTurnDamage, powerProfile,
  FIELD_RULES, fieldRules,
  BATTLE_TERRAIN_PROFILES, terrainProfileFor,
};
if (typeof window !== 'undefined') window.BattleCalc = BattleCalc;

// ---- one volley, one rulebook ---------------------------------------------
// The client animates the shells this returns and the SERVER re-runs it from
// the battle row to check what the client reported. Both call this same
// function, from the same seed, so they cannot drift: turn.js used to accept
// whatever `rawDamage` a device sent and merely clamp it to a theoretical
// ceiling, which meant a modified client that always claimed the maximum hit
// every time without ever having to aim.
//
// `rocketDamage` is passed in (js/battle-teammates.js owns that ratio) so this
// file keeps knowing only about ballistics.
function volleyShots(opts) {
  const rules = opts.rules || FIELD_RULES[1];
  const target = opts.target;
  const level = opts.level;
  const wind = opts.wind || 0;
  const rocketDamageFn = typeof opts.rocketDamage === 'function' ? opts.rocketDamage : (d => d);
  const shots = Math.max(1, Math.min(BARRELS, Math.trunc(Number(opts.shots) || 0) || 1));
  const angles = volleyAngles(opts.angle, shots, opts.seed, opts.turnNo);
  const out = [];
  for (const a of angles) {
    const sim = simulateShot({
      terrain: opts.terrain, from: opts.from, facing: opts.facing,
      angle: a, power: opts.power, wind, rules, blockers: [target],
    });
    out.push({ sim, angle: a, rocket: false, damage: damageAt(sim.hit, target, level, rules) });
  }
  // Every hired Pháo thủ launches on EVERY volley, along the unspread aim line.
  for (let i = 0; i < Math.max(0, Math.trunc(Number(opts.rocket) || 0)); i++) {
    const sim = simulateShot({
      terrain: opts.terrain, from: opts.from, facing: opts.facing,
      angle: opts.angle, power: opts.power, wind, rules, blockers: [target],
    });
    out.push({ sim, angle: opts.angle, rocket: true,
      damage: rocketDamageFn(damageAt(sim.hit, target, level, rules)) });
  }
  return out;
}
function volleyTotal(list, rules) {
  const R = rules || FIELD_RULES[1];
  const sum = (list || []).reduce((total, shot) => total + Math.max(0, Number(shot.damage) || 0), 0);
  return Math.min(Number.isFinite(R.maxVolleyDamage) ? R.maxVolleyDamage : 100, sum);
}
function volleyDamage(opts) {
  const rules = opts.rules || FIELD_RULES[1];
  return volleyTotal(volleyShots(opts), rules);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BATTLE_ROUNDS, BARRELS, AMMO_PER_CORRECT, AMMO_VOLUME_MAX, AMMO_PERFECT_MAX,
    AMMO_STREAK_BONUS, AMMO_CAP, MAX_TURNS, FIELD_W, FIELD_H, GRAVITY, WIND_ACCEL, FRAME_MS,
    FIELD_RULES, fieldRules, BATTLE_TERRAIN_PROFILES, terrainProfileFor,
    computeAmmo, ammoBreakdown, maxShotsThisTurn, makeRng, buildTerrain,
    spawnPoints, windForRound, volleyAngles, simulateShot,
    blastRadius, shotDamage, shellSize, damageAt, maxTurnDamage, powerProfile,
    volleyShots, volleyTotal, volleyDamage,
    POWER_REF_LEVEL, BattleCalc,
  };
}
