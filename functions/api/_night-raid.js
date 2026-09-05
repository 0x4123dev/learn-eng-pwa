import NightRaidRules from '../../js/night-raid-rules.js';

export const NR = NightRaidRules;
// How long a started raid stays scoreable. Five minutes was not enough for the
// way children actually play: Phaser sleeps its render loop while the tab is
// hidden (js/night-raid-phaser.js), so answering a message mid-battle and
// coming back put /finish past the deadline and threw the raid away.
export const RAID_TTL_MS = 15 * 60 * 1000;
// Only completed attempts start the per-house retry clock. An active row —
// especially one whose scoring window expired — is never a completed visit.
export const COOLDOWN_RAID_STATUS_SQL = "('done','ruined')";

// ---- the tunable rulebook (db/021-night-raid-rules.sql) -------------------
//
// Every number the Cướp Đêm economy turns on used to be a literal spread over
// three handlers, so retuning the game meant a deploy. They now live in one
// table an admin edits; these are the values a database with no rows — or no
// table yet — plays by, and they are also the answer whenever a stored row is
// unreadable.
//
//   win_cap           most xu one successful robbery can carry home
//   win_pct           % of the victim's lootable pile a robbery takes
//   loss              what a failed raid costs the attacker — and hands to
//                     the defender, so no coin is created or destroyed
//   shield_loss       the same, when the raid broke on a Khiên Đêm
//   seal_hours        "nhà tan hoang": how long a ROBBED house is unraidable
//   retry_hours       how long before the SAME child may hit the SAME house
//                     again — win, loss or ruins alike
//   daily_reward_cap  most xu one child can win from raids in one ICT day
export const RAID_CONFIG_DEFAULTS = {
  win_cap: 100, win_pct: 10, loss: 100, shield_loss: 200,
  seal_hours: 24, retry_hours: 12, daily_reward_cap: 400,
};
// A typo in the admin page must not be able to break the game: every value is
// clamped on the way OUT of the table, so even a row written by hand (or by a
// future admin screen with a bug) can only ever be a sane number. Hours stop
// at a week; coin amounts stop at the 100000 ceiling home.js already puts on a
// wallet, so no single raid can move more money than a wallet can hold.
export const RAID_CONFIG_RANGE = {
  win_cap: [0, 100000], win_pct: [0, 100], loss: [0, 100000], shield_loss: [0, 100000],
  seal_hours: [0, 168], retry_hours: [0, 168], daily_reward_cap: [0, 100000],
};
export const RAID_CONFIG_KEYS = Object.keys(RAID_CONFIG_DEFAULTS);

// One stored value → a safe integer. Anything unparseable (NULL, '', 'abc',
// Infinity) falls back to the default rather than to 0: a broken row must not
// silently turn a rule off.
export function clampRaidConfigValue(key, value) {
  const range = RAID_CONFIG_RANGE[key];
  if (!range) return null;
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return RAID_CONFIG_DEFAULTS[key];
  return Math.max(range[0], Math.min(range[1], n));
}

// db/021 creates night_raid_config, and the code that reads it ships BEFORE
// the migration is applied — same deploy-order problem db/019 has, solved the
// same way (see hasColumn in _daily-task.js): ask SQLite whether the table is
// there. PRAGMA table_info on a missing table answers with no rows instead of
// throwing. A positive answer is cached for the life of the isolate, per D1
// binding; a negative one is asked again next request, so the moment the
// migration lands the config starts working without a redeploy.
const configTableCache = new WeakMap();
async function raidConfigTableExists(env) {
  if (configTableCache.get(env.DB)) return true;
  try {
    const r = await env.DB.prepare('PRAGMA table_info(night_raid_config)').all();
    const ok = (((r && r.results) || []).length > 0);
    if (ok) configTableCache.set(env.DB, true);
    return ok;
  } catch (e) {
    return false;
  }
}

// The complete rulebook: always all seven keys, always integers, always in
// range. Callers never have to check for a missing key.
export async function readRaidConfig(env) {
  const cfg = Object.assign({}, RAID_CONFIG_DEFAULTS);
  if (!(await raidConfigTableExists(env))) return cfg;
  let rows = null;
  try {
    rows = await env.DB.prepare('SELECT key, value FROM night_raid_config').all();
  } catch (e) {
    return cfg;
  }
  for (const row of (rows && rows.results) || []) {
    const key = String((row && row.key) || '');
    // A stray row can never invent a rule — only overwrite a known one.
    if (!Object.prototype.hasOwnProperty.call(RAID_CONFIG_DEFAULTS, key)) continue;
    cfg[key] = clampRaidConfigValue(key, row.value);
  }
  return cfg;
}

// ---- the two clocks -------------------------------------------------------
//
// A breached home is sealed ("nhà tan hoang") for seal_hours: nobody — not
// even the winner — robs it again until the timer runs out. Only a WON raid
// seals (the home actually got robbed); a failed raid leaves it standing for
// the next child. This used to expire at ICT midnight instead, so a home
// breached at 23:00 got one hour of peace while one breached at 00:30 got
// nearly a full day; it was then 20 h, which let the same attacker come back
// four hours earlier every day.
//
// The seal is now INVISIBLE to everyone but the owner: friends.js and
// targets.js send no trace of it, and a child who attacks a sealed house is
// told only after the troops arrive (start.js → `ruined`). Knowing in advance
// which houses were already robbed is exactly the knowledge that turned the
// raid into a lookup instead of a gamble.

// When this home stops being sealed, or 0 when it is raidable right now.
export function raidLockUntil(row, now = Date.now()) {
  const until = Math.max(0, Math.trunc(+((row && row.ruined_until) || 0)));
  return until > now ? until : 0;
}

// The second clock, and the only one a child is allowed to see: when may I
// attack THIS house again? It starts on my last attempt on it — win, loss or
// ruins alike — and it is per pair, so it never tells me anything about what
// anyone else did to that house. `lastAttackAt` is the created_at of my most
// recent night_raids row against them (0/null = never).
export function retryAvailableAt(lastAttackAt, retryHours, now = Date.now()) {
  const last = Math.max(0, Math.trunc(+lastAttackAt || 0));
  if (!last) return 0;
  const until = last + Math.max(0, Math.trunc(+retryHours || 0)) * 3600000;
  return until > now ? until : 0;
}

export function nightDate(now=Date.now()) {
  return new Date(now + 7 * 3600000).toISOString().slice(0,10);
}
export function safeJson(value, fallback) {
  try { const parsed=JSON.parse(value); return parsed==null?fallback:parsed; } catch(e) { return fallback; }
}
export function randomRaidId() {
  const bytes=new Uint8Array(16);crypto.getRandomValues(bytes);
  return Array.from(bytes).map(v=>v.toString(16).padStart(2,'0')).join('');
}
export async function nightRaidEnabled(env,userId) {
  // Cướp Đêm is a normal part of the game for every authenticated child.
  // Keep this helper while all route callers migrate together, but never tie
  // access to users.allow_bot again: that field is reserved for QA-only event
  // behaviour and must not hide the castle, farm, or raid economy.
  void env; void userId;
  return true;
}
// A raid already in flight is a ticket off the shelf. start.js counts it
// against the allowance, so the two LISTS have to count it the same way or
// they advertise an attack the server is about to refuse — the same dishonesty
// the friend rows were fixed for when the allowance ran out.
export async function inFlightRaids(env,userId,now=Date.now()) {
  const row=await env.DB.prepare("SELECT COUNT(*) AS n FROM night_raids WHERE attacker_id=? AND status='active' AND expires_at>=?").bind(userId,now).first();
  return Math.max(0,Number(row&&row.n||0));
}
export async function ticketStats(env,userId,date=nightDate()) {
  const daily=await env.DB.prepare('SELECT tickets_used, reward_earned FROM night_raid_daily WHERE user_id = ? AND raid_date = ?').bind(userId,date).first();
  // `date` is an ICT calendar day (nightDate) but created_at is UTC, and
  // SQLite reads a bare 'YYYY-MM-DD' as UTC midnight — i.e. 07:00 ICT. The
  // window was therefore shifted seven hours: practice done between midnight
  // and 7 a.m. counted for NO day at all, while an hour after midnight the
  // next morning counted for the day before. ICT day D is [D-1 17:00 UTC,
  // D 17:00 UTC).
  const learned=await env.DB.prepare("SELECT COALESCE(SUM(attempts),0) AS n FROM learning_skill_results WHERE user_id = ? AND created_at >= datetime(?, '-7 hours') AND created_at < datetime(?, '+1 day', '-7 hours')")
    .bind(userId,date,date).first();
  const allowance=3+(Number(learned&&learned.n||0)>=10?1:0);
  return {date,allowance,used:Number(daily&&daily.tickets_used||0),reward:Number(daily&&daily.reward_earned||0)};
}
export function homeSnapshot(row) {
  const layout=NR.normalizeLayout(safeJson(row.layout_json,{cells:[],dogLane:2}));
  const dogLevel=Math.max(1,Math.min(999,Math.trunc(+row.dog_level||1)));
  const castleHp=180+Math.min(50,Math.max(1,+row.home_level||1))*8;
  // Swords live on the users row (db/019), so a caller that wants them in the
  // score has to put `night_swords` on the row first (start.js does, for the
  // attacker). A home row joined without it — every target, and any pre-019
  // database — reads as zero, which is exactly what the client computes too.
  const swords=Math.max(0,Math.trunc(+row.night_swords||0));
  const power=NR.combatPower(layout,dogLevel,layout.soldiers,swords);
  // `lockedUntil` here is for the OWNER's own home only (home.js GET). No
  // list of other people's houses may copy it out — see friends.js.
  return {targetId:row.user_id,name:row.username||'Castle',level:Math.max(1,+row.home_level||1),homeLevel:Math.max(1,+row.home_level||1),sceneId:['moonlit-village','haunted-forest','storm-kingdom'][Math.abs(Number(row.user_id)||0)%3],seed:1,layout,dogLevel,soldiers:layout.soldiers,swords,castleSkin:String(row.castle_skin||'stone-keep'),castleHp,damage:power.damage,defense:power.defense,lootableCoins:Math.max(0,+row.lootable_coins||0),lockedUntil:raidLockUntil(row),budget:0};
}

// ---- what an ATTACKER may see of a house ---------------------------------
//
// homeSnapshot builds the payload for the OWNER's own home AND for a house a
// child is about to raid, and a target must reveal nothing about its state —
// the same rule the seal and the shield are kept quiet under, above. Since the
// farm shipped, that payload carried the defender's crops (each with its uid,
// the task-day it was planted on and the calendar date) and every private
// extra farm board. Those are the child's study history and their own boards,
// and a uid is an identity another child must never hold. Master sent
// defences only.
//
// Removing them cannot move a raid result: combatPower and createState read
// DEFENSES exclusively (js/night-raid-rules.js — a farm item is not in that
// list, deliberately), and every combat number in the snapshot — damage,
// defense, soldiers, castleHp — is computed by homeSnapshot BEFORE this runs.
// dogLane, castleCell and soldiers stay, because the fight uses them.
export function attackerLayout(layout) {
  const F = NR.farmRules;
  const out = Object.assign({}, layout);
  // A cell is a farm item when the farm rulebook knows its id; defences are
  // the ones NR.defenseById finds.
  out.cells = ((layout && layout.cells) || []).filter(cell => !(F && F.byId(cell && cell.type)));
  delete out.farms;
  return out;
}
// The snapshot to hand an attacker: homeSnapshot with the garden taken out.
export function raidSnapshot(row) {
  const snap = homeSnapshot(row);
  snap.layout = attackerLayout(snap.layout);
  return snap;
}

// What a successful robbery carries home: win_pct of the victim's pile, never
// more than win_cap, and never more than what is left of today's
// daily_reward_cap. The victim loses EXACTLY this number (finish.js), so the
// raid moves money instead of printing it.
//
// This replaced a "loot + performance bonus, floor 50, hard cap 200/day"
// formula: the floor paid 50 xu for robbing an empty house, which made the
// poorest targets the most profitable ones.
export function winReward(lootableCoins, cfg, dailyReward) {
  const pile = Math.max(0, Math.trunc(+lootableCoins || 0));
  const desired = Math.min(cfg.win_cap, Math.floor(pile * cfg.win_pct / 100));
  const left = Math.max(0, cfg.daily_reward_cap - Math.max(0, Math.trunc(+dailyReward || 0)));
  return Math.max(0, Math.min(left, desired));
}
