// battle-teammates.js — hired đồng đội: who they are, what they cost, and
// exactly what their always-on ability does.
//
// PURE by design: no DOM, no network, no randomness. Both phones run these
// functions over the same relayed action stream, so a battle stays a
// deterministic replay. A constant that drifted between two app versions
// would desync a live match, which is why every number here is pinned by
// tests/teammates.test.js.
//
// The economy this serves: coins buy either FOOD (permanent pet growth, worth
// a little castle HP) or TROOPS (one battle, then gone). A child has to weigh
// the two, and a big squad is only ever proof of a lot of studying — ammo is
// still earned by learning alone, and the Gunner's rocket rides a shot that
// was already paid for.

// One squad slot per hire, five max — not an economy rule but a screen one:
// the castle interior shows five ledges and the active status chips have to sit
// beside the fire controls on a phone.
const TEAM_MAX_HIRES = 5;

// 200 xu, and the price is set by WHEN the child buys now: hiring moved from
// the pre-battle lobby into the match itself, so this is the button a child
// reaches for when the shells are landing and the castle is nearly down. At
// 600 that rescue cost more than a Royal Feast (550) and a losing child simply
// could not afford it — the feature would exist and never fire. At 200 it is
// about four good practice sessions (~50 xu each), cheap enough to be an
// impulse in the middle of a fight and still dear enough that a five-strong
// squad (1.000 xu) is a real decision, not free.
const TEAM_ROSTER = [
  {
    id: 'gunner', emoji: '🚀', fee: 200,
    // Rides the volley the child already aimed and already paid ammo for:
    // one aim, two projectiles. Good aim is rewarded twice; a miss wastes
    // both, so it sharpens the existing skill instead of replacing it.
    ratio: 0.6,
  },
  { id: 'engineer', emoji: '🔧', fee: 200, repair: 15 },
  { id: 'shield', emoji: '🛡️', fee: 200, factor: 0.5 },
];

const GUNNER_RATIO = 0.6;      // rocket damage, as a share of one shell
const ENGINEER_REPAIR = 15;    // HP restored, never past the castle's own max
const SHIELD_FACTOR = 0.5;     // incoming volley multiplier while raised

// Castle HP: the only place food touches a fight. Deliberately small and
// capped — a well-fed pet should feel rewarded, never unbeatable by a child
// who simply aims better or studied more.
const HP_BASE = 100;
const HP_LEVELS_PER_POINT = 10;
const HP_BONUS_MAX = 15;

const _num = (v) => {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) ? n : 0;
};

function teammateById(id) {
  if (!id || typeof id !== 'string') return null;
  return TEAM_ROSTER.find(t => t.id === id) || null;
}

// A squad as the rest of the app should see it: real ids only, duplicates
// preserved (two Vệ sĩ is a legitimate plan), never longer than the cap.
// Anything unrecognisable is dropped rather than trusted — this runs on data
// that arrived from the other phone.
function normalizeHires(list) {
  if (!Array.isArray(list)) return [];
  return list.filter(id => !!teammateById(id)).slice(0, TEAM_MAX_HIRES);
}

// Always priced on the NORMALIZED squad: a child must never be charged for a
// hire that was dropped for being unknown or over the cap.
function hireCost(list) {
  return normalizeHires(list).reduce((sum, id) => sum + teammateById(id).fee, 0);
}

function hpBonus(level) {
  const lv = Math.max(0, _num(level));
  return Math.min(HP_BONUS_MAX, Math.floor(lv / HP_LEVELS_PER_POINT));
}

function startingHp(level) {
  return HP_BASE + hpBonus(level);
}

// 60% of one shell. A graze still scratches: rounding a 1-damage hit down to
// nothing would make the Gunner feel broken on exactly the shots a child is
// most nervous about.
function rocketDamage(shellDamage) {
  const d = _num(shellDamage);
  if (d <= 0) return 0;
  return Math.max(1, Math.round(d * GUNNER_RATIO));
}

// `maxHp` is the castle's OWN ceiling, which a well-fed pet raises above 100.
function applyRepair(hp, maxHp) {
  const cap = Math.max(0, _num(maxHp));
  return Math.min(cap, Math.max(0, _num(hp)) + ENGINEER_REPAIR);
}

function teammateCount(list, id) {
  return normalizeHires(list).filter(value => value === id).length;
}

function applyRepairs(hp, maxHp, count) {
  let next = hp;
  for (let i = 0; i < Math.max(0, _num(count)); i++) next = applyRepair(next, maxHp);
  return next;
}

// Floored, so ties go to the child who hired the guard — and a 1-damage graze
// is absorbed completely, which is what a shield should feel like.
function shieldedDamage(damage, count) {
  let d = _num(damage);
  if (d <= 0) return 0;
  const guards = Math.max(1, _num(count) || 1);
  for (let i = 0; i < guards; i++) d = Math.floor(d * SHIELD_FACTOR);
  return d;
}

// ---- the lobby's hire cart ----
// Both guards live here rather than in the UI so the button state and the
// actual purchase can never disagree: a card that looks affordable but is
// refused on tap (or worse, one that goes through and overdraws the purse) is
// the kind of bug a child reads as the game cheating.

// Returns a NEW cart, or the original untouched when the hire is not allowed.
function hireAdd(list, id, coins) {
  const cart = normalizeHires(list);
  if (!teammateById(id)) return cart;                   // no such teammate
  if (cart.length >= TEAM_MAX_HIRES) return cart;        // bench is full
  const next = cart.concat([id]);
  if (hireCost(next) > Math.max(0, _num(coins))) return cart;   // cannot afford
  return next;
}

// Dismisses ONE copy — a child with two Vệ sĩ who taps minus once must keep
// the other.
function hireRemove(list, id) {
  const cart = normalizeHires(list);
  const at = cart.indexOf(id);
  if (at === -1) return cart;
  return cart.slice(0, at).concat(cart.slice(at + 1));
}

// One always-active teammate per hire, in the order they were hired.
function buildCharges(list) {
  return normalizeHires(list).map((id, i) => ({ key: `${id}-${i}`, id, active: true }));
}

const BattleTeam = {
  TEAM_MAX_HIRES, TEAM_ROSTER, GUNNER_RATIO, ENGINEER_REPAIR, SHIELD_FACTOR,
  HP_BASE, HP_LEVELS_PER_POINT, HP_BONUS_MAX,
  teammateById, normalizeHires, hireCost, hpBonus, startingHp,
  rocketDamage, applyRepair, applyRepairs, shieldedDamage, teammateCount, buildCharges, hireAdd, hireRemove,
};
if (typeof window !== 'undefined') window.BattleTeam = BattleTeam;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BattleTeam;
}
