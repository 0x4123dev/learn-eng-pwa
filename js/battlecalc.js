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
function ammoBreakdown(stats) {
  const correct = Math.max(0, Math.trunc((stats && stats.correct) || 0));
  const perfects = Math.max(0, Math.trunc((stats && stats.perfects) || 0));
  const days = Math.max(0, Math.trunc((stats && stats.days) || 0));
  return [
    { key: 'volume', label: `${correct} câu đúng`, shots: Math.min(AMMO_VOLUME_MAX, Math.floor(correct / AMMO_PER_CORRECT)), max: AMMO_VOLUME_MAX },
    { key: 'perfect', label: `${perfects} bài 10/10`, shots: Math.min(AMMO_PERFECT_MAX, perfects), max: AMMO_PERFECT_MAX },
    { key: 'streak', label: `Học đủ ${days}/3 ngày`, shots: days >= 3 ? AMMO_STREAK_BONUS : 0, max: AMMO_STREAK_BONUS },
  ];
}

// How many barrels can be loaded this turn.
function maxShotsThisTurn(ammoLeft) {
  return Math.max(0, Math.min(BARRELS, Math.trunc(ammoLeft || 0)));
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
const FIELD_W = 800;
const FIELD_H = 450;
const GROUND_MIN = 250;            // highest hills reach this y
const GROUND_MAX = 400;
const SPAWN_LEFT_X = 90;
const SPAWN_RIGHT_X = FIELD_W - 90;
const MUZZLE_Y = 34;               // barrel height above the ground
const MUZZLE_CLEARANCE = 4;        // frames before terrain can be hit
const PLATEAU_R = 46;              // levelled ground each side of a pet
const LANE_LEN = 150;              // clear firing lane in front of a pet

// Rolling hills as a height per x-column, from the shared seed.
function buildTerrain(seed) {
  const rng = makeRng(seed);
  const waves = [
    { amp: 38 + rng() * 26, len: 260 + rng() * 160, ph: rng() * Math.PI * 2 },
    { amp: 16 + rng() * 14, len: 120 + rng() * 70, ph: rng() * Math.PI * 2 },
    { amp: 7 + rng() * 6, len: 55 + rng() * 30, ph: rng() * Math.PI * 2 },
  ];
  const base = 320 + rng() * 30;
  const h = new Array(FIELD_W);
  for (let x = 0; x < FIELD_W; x++) {
    let y = base;
    for (const w of waves) y -= Math.sin((x / w.len) * Math.PI * 2 + w.ph) * w.amp;
    h[x] = Math.max(GROUND_MIN, Math.min(GROUND_MAX, y));
  }
  // Each pet stands on a levelled peak with a clear firing lane. Without
  // this, ~13% of seeds put a pet in a valley where its own hillside
  // swallowed the first shot — unfair and confusing for a child.
  for (const cx of [SPAWN_LEFT_X, SPAWN_RIGHT_X]) {
    let peak = h[cx];
    for (let x = cx - PLATEAU_R; x <= cx + PLATEAU_R; x++) {
      if (x >= 0 && x < FIELD_W) peak = Math.min(peak, h[x]);   // min y = highest ground
    }
    for (let x = cx - PLATEAU_R; x <= cx + PLATEAU_R; x++) {
      if (x >= 0 && x < FIELD_W) h[x] = peak;
    }
    // Nothing in the muzzle's path may tower over the pet.
    const dir = cx < FIELD_W / 2 ? 1 : -1;
    for (let i = PLATEAU_R; i <= LANE_LEN; i++) {
      const x = cx + dir * i;
      if (x < 0 || x >= FIELD_W) break;
      if (h[x] < peak) h[x] = peak;                              // shave the blocker
    }
  }
  return h;
}

// Both pets stand on the terrain, near opposite edges.
function spawnPoints(terrain) {
  return [
    { x: SPAWN_LEFT_X, y: terrain[SPAWN_LEFT_X] },
    { x: SPAWN_RIGHT_X, y: terrain[SPAWN_RIGHT_X] },
  ];
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
  const terrain = opts.terrain;
  const from = opts.from;
  const facing = opts.facing >= 0 ? 1 : -1;
  const rad = (opts.angle * Math.PI) / 180;
  const v0 = 4 + 0.09 * Math.max(0, Math.min(100, opts.power));
  let vx = Math.cos(rad) * v0 * facing;
  let vy = -Math.sin(rad) * v0;
  let x = from.x + facing * 16;
  let y = from.y - MUZZLE_Y;
  const wind = opts.wind || 0;
  const points = [];
  let hit = null;
  let f = 0;
  for (; f < MAX_FRAMES; f++) {
    vy += GRAVITY;
    vx += WIND_ACCEL * wind;
    x += vx; y += vy;
    points.push({ x, y });
    if (x < -60 || x > FIELD_W + 60) break;          // flew off the field
    const col = Math.round(x);
    if (f >= MUZZLE_CLEARANCE && col >= 0 && col < FIELD_W && y >= terrain[col]) {
      hit = { x, y: terrain[col] };
      break;
    }
    if (y > FIELD_H + 80) break;
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
function damageAt(hit, target, level) {
  if (!hit) return 0;
  const dx = hit.x - target.x;
  const dy = hit.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const r = blastRadius(level);
  if (dist > r) return 0;
  const base = shotDamage(level);
  const falloff = 1 - (dist / r) * 0.75;            // centre hits hurt most
  const direct = dist <= r * 0.28 ? 1.5 : 1;
  return Math.max(1, Math.round(base * falloff * direct));
}

// The most a turn could possibly do — the server clamps reported damage to
// this so a tampered client can't claim a bigger hit than physics allows.
function maxTurnDamage(shots, level) {
  const n = Math.max(0, Math.min(BARRELS, Math.trunc(shots || 0)));
  return Math.ceil(n * shotDamage(level) * 1.5);
}

// Top-level `const` in a classic script is script-scoped, NOT a window
// property — the game engine must read the constants through this namespace.
const BattleCalc = {
  BATTLE_ROUNDS, BARRELS, AMMO_PER_CORRECT, AMMO_VOLUME_MAX, AMMO_PERFECT_MAX,
  AMMO_STREAK_BONUS, AMMO_CAP, FIELD_W, FIELD_H, GRAVITY, WIND_ACCEL, FRAME_MS,
  computeAmmo, ammoBreakdown, maxShotsThisTurn, makeRng, buildTerrain,
  spawnPoints, windForRound, volleyAngles, simulateShot,
  blastRadius, shotDamage, shellSize, damageAt, maxTurnDamage,
};
if (typeof window !== 'undefined') window.BattleCalc = BattleCalc;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    BATTLE_ROUNDS, BARRELS, AMMO_PER_CORRECT, AMMO_VOLUME_MAX, AMMO_PERFECT_MAX,
    AMMO_STREAK_BONUS, AMMO_CAP, FIELD_W, FIELD_H, GRAVITY, WIND_ACCEL, FRAME_MS,
    computeAmmo, ammoBreakdown, maxShotsThisTurn, makeRng, buildTerrain,
    spawnPoints, windForRound, volleyAngles, simulateShot,
    blastRadius, shotDamage, shellSize, damageAt, maxTurnDamage, BattleCalc,
  };
}
