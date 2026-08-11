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
};
// Anything unknown, missing or legacy is v1 — an unrecognised version must
// never silently reinterpret a battle that is already in progress.
function fieldRules(v) { return FIELD_RULES[Number(v) === 2 ? 2 : 1]; }

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
function buildTerrain(seed, rules) {
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
  // Each pet stands on a levelled peak with a clear firing lane. Without
  // this, ~13% of seeds put a pet in a valley where its own hillside
  // swallowed the first shot — unfair and confusing for a child.
  for (const cx of R.spawnX) {
    let peak = h[cx];
    for (let x = cx - R.plateau; x <= cx + R.plateau; x++) {
      if (x >= 0 && x < R.worldW) peak = Math.min(peak, h[x]);   // min y = highest ground
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
    vy += R.gravity;
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
  const base = shotDamage(level);
  const falloff = 1 - (dist / r) * 0.75;            // centre hits hurt most
  const direct = dist <= r * 0.28 ? 1.5 : 1;
  return Math.max(1, Math.round(base * falloff * direct));
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
function maxTurnDamage(shots, level) {
  const n = Math.max(0, Math.min(BARRELS, Math.trunc(Number(shots) || 0)));
  return n * Math.round(shotDamage(level) * 1.5);
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
};
if (typeof window !== 'undefined') window.BattleCalc = BattleCalc;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BATTLE_ROUNDS, BARRELS, AMMO_PER_CORRECT, AMMO_VOLUME_MAX, AMMO_PERFECT_MAX,
    AMMO_STREAK_BONUS, AMMO_CAP, MAX_TURNS, FIELD_W, FIELD_H, GRAVITY, WIND_ACCEL, FRAME_MS,
    FIELD_RULES, fieldRules,
    computeAmmo, ammoBreakdown, maxShotsThisTurn, makeRng, buildTerrain,
    spawnPoints, windForRound, volleyAngles, simulateShot,
    blastRadius, shotDamage, shellSize, damageAt, maxTurnDamage, powerProfile,
    POWER_REF_LEVEL, BattleCalc,
  };
}
