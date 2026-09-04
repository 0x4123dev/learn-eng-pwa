import DailyTaskCatalog from '../../js/daily-task-catalog.js';
import FarmRules from '../../js/farm-rules.js';
import { nightDate } from './_night-raid.js';

// Daily tasks: assigned by an admin, counted from `activities` on read,
// rewarded once per GMT+7 day. Shared by /api/me/daily-tasks, /api/activity
// (so a finished session pays out without the child opening the panel),
// /api/admin/daily-tasks, /api/daily-task/claim(-all) and
// /api/night-raid/shield.
//
// The reward is 200 xu (paid at once, as a coin_grants IOU) plus ONE pick the
// child makes later in Kho Khiên & Kiếm: a Night Raid shield or a sword. The
// `shields` column of daily_task_rewards keeps its db/018 name but since
// db/019 it counts picks, and `claimed_kind` says what the pick became.
export const DAILY_REWARD = { coins: 200, picks: 1 };
export const REWARD_KINDS = Object.freeze(['shield', 'sword']);
// Which users column each kind lands in. Whitelisted here because the column
// name is interpolated into the UPDATE; nothing from a request reaches it.
const KIND_COLUMN = Object.freeze({ shield: 'night_shields', sword: 'night_swords' });
export const SHIELD_MS = 24 * 3600 * 1000;
export const SHIELD_RAID_LOSS = 200;   // what a raider pays for hitting a shielded home
export const MAX_TARGET = 50;
// Every active task costs one COUNT on every activity sync, and allDone
// needs all of them, so a long list only makes the reward unreachable.
export const MAX_ACTIVE_TASKS = 10;
export const SEED_STREAK_GOAL = 2;
export const SEED_CYCLE = Object.freeze(FarmRules.CROPS.map(c => c.id));

function sqlTime(ms) { return new Date(ms).toISOString().replace('T', ' ').slice(0, 19); }

// The GMT+7 calendar day containing `now`, as the UTC bounds `activities`
// rows are stored in.
export function dayWindowUtc(now = Date.now()) {
  const date = nightDate(now);
  const startMs = Date.parse(date + 'T00:00:00Z') - 7 * 3600000;
  return { date, startUtc: sqlTime(startMs), endUtc: sqlTime(startMs + 24 * 3600000) };
}

// What a daily_tasks row stores for a catalog key, or null for an unknown key.
export function taskSpec(kind) {
  const e = DailyTaskCatalog.get(kind);
  if (!e) return null;
  return { kind: e.key, label: e.label, activityType: e.activityType, matchJson: JSON.stringify(e.match) };
}

function escapeLike(s) { return String(s).replace(/[\\%_]/g, ch => '\\' + ch); }
function fieldName(s) { return String(s || '').replace(/[^A-Za-z0-9_]/g, ''); }

// WHERE fragment + binds for one catalog match rule. Field names are
// whitelisted to [A-Za-z0-9_] because they are interpolated into the JSON
// path. A structurally odd rule (a field that whitelists away to nothing, or
// a detail clause with neither a prefix nor a non-null value) degrades to
// '0' — matches nothing — same as an empty rule, rather than throwing or
// binding undefined.
export function matchSql(match) {
  const where = [], binds = [];
  const m = match && typeof match === 'object' ? match : {};
  if (m.titlePrefix) { where.push("title LIKE ? ESCAPE '\\'"); binds.push(escapeLike(m.titlePrefix) + '%'); }
  if (m.titleExact) { where.push('title = ?'); binds.push(String(m.titleExact)); }
  if (m.detail && m.detail.field) {
    const f = fieldName(m.detail.field);
    if (!f) {
      where.push('0');
    } else if (m.detail.prefix != null) {
      where.push(`json_extract(detail_json, '$.${f}') LIKE ? ESCAPE '\\'`);
      binds.push(escapeLike(m.detail.prefix) + '%');
    } else if (m.detail.value != null) {
      where.push(`json_extract(detail_json, '$.${f}') = ?`);
      binds.push(m.detail.value);
    } else {
      where.push('0');
    }
  }
  if (m.noField) {
    const f = fieldName(m.noField);
    where.push(f ? `json_extract(detail_json, '$.${f}') IS NULL` : '0');
  }
  if (!where.length) where.push('0');   // an empty rule matches nothing, never everything
  return { sql: where.join(' AND '), binds };
}

// Today's progress for every active task. `done` = enough sessions with
// score == total inside the GMT+7 day. Never writes.
export async function progress(env, uid, now = Date.now()) {
  const { date, startUtc, endUtc } = dayWindowUtc(now);
  const { results } = await env.DB.prepare(
    'SELECT id, kind, label, target, activity_type, match_json, created_at FROM daily_tasks WHERE user_id = ? AND active = 1 ORDER BY id'
  ).bind(uid).all();
  const tasks = await Promise.all((results || []).map(async row => {
    let match = {};
    try {
      match = JSON.parse(row.match_json) || {};
    } catch (e) {
      console.warn('daily-task: bad match_json for task ' + row.id);
      match = {};
    }
    const m = matchSql(match);
    const r = await env.DB.prepare(
      `SELECT COUNT(*) AS n FROM activities
        WHERE user_id = ? AND type = ? AND total > 0 AND score = total
          AND created_at >= ? AND created_at < ? AND ${m.sql}`
    ).bind(uid, row.activity_type, startUtc, endUtc, ...m.binds).first();
    const count = Number((r && r.n) || 0);
    const target = Math.min(MAX_TARGET, Math.max(1, Math.trunc(+row.target || 1)));
    return { id: row.id, kind: row.kind, label: row.label, target, count, done: count >= target, created_at: row.created_at };
  }));
  return { date, tasks, allDone: tasks.length > 0 && tasks.every(t => t.done) };
}

export async function rewardedOn(env, uid, date) {
  const row = await env.DB.prepare('SELECT 1 AS x FROM daily_task_rewards WHERE user_id = ? AND task_date = ?')
    .bind(uid, date).first();
  return !!row;
}

// ---- schema tolerance --------------------------------------------------
// db/019 adds daily_task_rewards.claimed_kind/claimed_at and
// users.night_swords. The code must survive the one deploy where it runs
// against a database that does not have them yet (in either order), so every
// reader asks PRAGMA table_info first. A positive answer is cached for the
// life of the isolate, per D1 binding; a negative one is asked again on the
// next request, so the moment the migration lands the code notices without a
// redeploy. Table names are literals from this file, never request data.
const columnCache = new WeakMap();
export async function hasColumn(env, table, column) {
  let known = columnCache.get(env.DB);
  if (!known) { known = new Set(); columnCache.set(env.DB, known); }
  const key = table + '.' + column;
  if (known.has(key)) return true;
  const r = await env.DB.prepare('PRAGMA table_info(' + table + ')').all();
  const ok = ((r && r.results) || []).some(c => c && c.name === column);
  if (ok) known.add(key);
  return ok;
}
// Whether the claim flow can run at all: both halves of db/019 are in.
export async function armoryReady(env) {
  return (await hasColumn(env, 'daily_task_rewards', 'claimed_kind'))
    && (await hasColumn(env, 'users', 'night_swords'));
}

export async function seedRewardsReady(env) {
  return (await hasColumn(env, 'farm_seed_days', 'crop_id'))
    && (await hasColumn(env, 'farm_seed_inventory', 'quantity'));
}

function previousDate(date) {
  const ms = Date.parse(String(date) + 'T12:00:00Z');
  return Number.isFinite(ms) ? new Date(ms - 86400000).toISOString().slice(0, 10) : '';
}

function seedCrop(id) {
  const c = FarmRules.cropById(id);
  return c ? { id: c.id, name: c.name.vi, days: c.days, yield: c.yield } : null;
}

// Mirror a completed Daily Task day into the seed ledger, then expose the
// whole seed reward state. The first consecutive day writes crop_id=NULL; the
// second writes the next crop and increments inventory in the SAME D1 batch.
// INSERT OR IGNORE plus changes() makes simultaneous evaluate calls award once.
export async function seedStatus(env, uid, date, rewardedToday) {
  const ready = await seedRewardsReady(env);
  const empty = { ready, progress: 0, goal: SEED_STREAK_GOAL, next: seedCrop(SEED_CYCLE[0]), inventory: [], recent: [], justRewarded: null };
  if (!ready) return empty;
  const day = String(date || '');
  let justRewarded = null;
  if (rewardedToday && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const exists = await env.DB.prepare('SELECT crop_id FROM farm_seed_days WHERE user_id=? AND task_date=?').bind(uid, day).first();
    if (!exists) {
      const latest = await env.DB.prepare('SELECT task_date,crop_id FROM farm_seed_days WHERE user_id=? ORDER BY task_date DESC LIMIT 1').bind(uid).first();
      const awards = await env.DB.prepare('SELECT COUNT(*) AS n FROM farm_seed_days WHERE user_id=? AND crop_id IS NOT NULL').bind(uid).first();
      const completesPair = !!(latest && latest.task_date === previousDate(day) && latest.crop_id == null);
      const cropId = completesPair ? SEED_CYCLE[Math.max(0, Math.trunc(+((awards && awards.n) || 0))) % SEED_CYCLE.length] : null;
      const statements = [
        env.DB.prepare('INSERT OR IGNORE INTO farm_seed_days(user_id,task_date,crop_id) VALUES(?,?,?)').bind(uid, day, cropId),
      ];
      if (cropId) statements.push(env.DB.prepare(
        `INSERT INTO farm_seed_inventory(user_id,crop_id,quantity) SELECT ?,?,1 WHERE changes()>0
         ON CONFLICT(user_id,crop_id) DO UPDATE SET quantity=quantity+1,updated_at=datetime('now')`
      ).bind(uid, cropId));
      const results = await env.DB.batch(statements);
      if (cropId && results && results[0] && results[0].meta && results[0].meta.changes > 0) justRewarded = seedCrop(cropId);
    }
  }
  const [latest, awards, stock, recentRows] = await Promise.all([
    env.DB.prepare('SELECT task_date,crop_id FROM farm_seed_days WHERE user_id=? ORDER BY task_date DESC LIMIT 1').bind(uid).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM farm_seed_days WHERE user_id=? AND crop_id IS NOT NULL').bind(uid).first(),
    env.DB.prepare('SELECT crop_id,quantity FROM farm_seed_inventory WHERE user_id=? AND quantity>0 ORDER BY crop_id').bind(uid).all(),
    env.DB.prepare('SELECT task_date,crop_id FROM farm_seed_days WHERE user_id=? AND crop_id IS NOT NULL ORDER BY task_date DESC LIMIT 6').bind(uid).all(),
  ]);
  const awardCount = Math.max(0, Math.trunc(+((awards && awards.n) || 0)));
  const quantities = new Map(((stock && stock.results) || []).map(r => [String(r.crop_id), Math.max(0, Math.trunc(+r.quantity || 0))]));
  const current = /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : nightDate();
  const progress = latest && latest.crop_id == null && (latest.task_date === current || latest.task_date === previousDate(current)) ? 1 : 0;
  return {
    ready: true, progress, goal: SEED_STREAK_GOAL,
    next: seedCrop(SEED_CYCLE[awardCount % SEED_CYCLE.length]),
    inventory: FarmRules.CROPS.map(c => Object.assign(seedCrop(c.id), { quantity: quantities.get(c.id) || 0 })),
    recent: ((recentRows && recentRows.results) || []).map(r => Object.assign({ date: String(r.task_date) }, seedCrop(r.crop_id))),
    justRewarded,
  };
}

// progress() + pay the day's reward if it is due and not yet paid.
// The INSERT OR IGNORE on daily_task_rewards is the once-a-day claim: two
// concurrent callers both see allDone, but only the one whose insert changes
// a row pays out. Claim and payout run in ONE batch (one transaction), with
// the payout statements guarded by SQLite's changes() — the row count of the
// statement that ran just before them — so a crash between claim and payout
// cannot leave a claimed day unpaid, and an ignored claim pays nothing. The
// coin grant additionally checks NOT EXISTS on its own (user, day)-unique
// note as a second lock: even if changes() were ever unreliable (e.g. a
// future D1 quirk), the note makes a duplicate grant for the same day
// impossible to insert.
//
// The reward row itself IS the child's pick (claimed_kind NULL = waiting in
// Kho Khiên & Kiếm). Only while db/019 is not applied yet does the batch
// still push the shield straight into the inventory as 018 did — chained off
// the coin grant's changes(), so a day that didn't get paid coins never gets a
// shield either. db/019's backfill then marks those rows 'shield'.
export async function evaluate(env, uid, now = Date.now()) {
  const p = await progress(env, uid, now);
  if (!p.tasks.length) {
    const rewardedToday = await rewardedOn(env, uid, p.date);
    const seeds = await seedStatus(env, uid, p.date, rewardedToday);
    return Object.assign(p, { rewardedToday, justRewarded: false, seeds });
  }
  let rewardedToday = await rewardedOn(env, uid, p.date);
  let justRewarded = false;
  if (p.allDone && !rewardedToday) {
    const note = 'Daily task ' + p.date;
    const claimable = await armoryReady(env);
    const statements = [
      env.DB.prepare('INSERT OR IGNORE INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?, ?, ?, ?)')
        .bind(uid, p.date, DAILY_REWARD.coins, DAILY_REWARD.picks),
      // changes() here = rows inserted by the claim above (1 or 0). NOT
      // EXISTS is belt-and-braces on top of that: the note is unique per
      // (user, day) by construction, so this can insert at most once per day
      // no matter what changes() reports.
      env.DB.prepare(
        `INSERT INTO coin_grants (user_id, amount, note, granted_by)
         SELECT ?, ?, ?, 0 WHERE changes() > 0
           AND NOT EXISTS (SELECT 1 FROM coin_grants WHERE user_id = ? AND note = ?)`
      ).bind(uid, DAILY_REWARD.coins, note, uid, note),
    ];
    if (!claimable) {
      // Pre-019 database: no column to park the pick in, so it is a shield
      // right away. changes() here = rows inserted by the coin grant above.
      statements.push(
        env.DB.prepare('UPDATE users SET night_shields = night_shields + ? WHERE id = ? AND changes() > 0')
          .bind(DAILY_REWARD.picks, uid)
      );
    }
    const results = await env.DB.batch(statements);
    justRewarded = !!(results && results[0] && results[0].meta && results[0].meta.changes > 0);
    rewardedToday = true;
  }
  const seeds = await seedStatus(env, uid, p.date, rewardedToday);
  return Object.assign(p, { rewardedToday, justRewarded, seeds });
}

// Inventory + whether the castle is shielded right now.
export async function shieldStatus(env, uid, now = Date.now()) {
  const u = await env.DB.prepare('SELECT night_shields FROM users WHERE id = ?').bind(uid).first();
  const h = await env.DB.prepare('SELECT shield_until FROM night_raid_homes WHERE user_id = ?').bind(uid).first();
  const until = Math.max(0, Math.trunc(+((h && h.shield_until) || 0)));
  return { count: Math.max(0, Math.trunc(+((u && u.night_shields) || 0))), activeUntil: until > now ? until : 0 };
}

// Sword stock. Zero — not an error — until db/019 is applied.
export async function swordCount(env, uid) {
  if (!(await hasColumn(env, 'users', 'night_swords'))) return 0;
  const u = await env.DB.prepare('SELECT night_swords FROM users WHERE id = ?').bind(uid).first();
  return Math.max(0, Math.trunc(+((u && u.night_swords) || 0)));
}

// Reward days the child has earned but not yet turned into anything, oldest
// first. Empty until db/019 is applied (nothing can be pending before it).
export async function pendingRewards(env, uid) {
  if (!(await armoryReady(env))) return [];
  const { results } = await env.DB.prepare(
    'SELECT task_date FROM daily_task_rewards WHERE user_id = ? AND claimed_kind IS NULL ORDER BY task_date'
  ).bind(uid).all();
  return (results || []).map(r => String(r.task_date));
}

// The last few reward days with what each became (kind null = still pending),
// newest first — the "đã nhận gần đây" list.
export async function recentRewards(env, uid, limit = 7) {
  const ready = await armoryReady(env);
  const { results } = await env.DB.prepare(
    `SELECT task_date${ready ? ', claimed_kind' : ''} FROM daily_task_rewards WHERE user_id = ? ORDER BY task_date DESC LIMIT ?`
  ).bind(uid, Math.max(1, Math.min(31, Math.trunc(+limit || 7)))).all();
  // Before 019 every paid day was a shield, credited on the spot.
  return (results || []).map(r => ({ date: String(r.task_date), kind: ready ? (r.claimed_kind || null) : 'shield' }));
}

// Everything Kho Khiên & Kiếm shows, in one object — also the reply of the
// claim endpoints, so the screen repaints from the response alone.
export async function armoryStatus(env, uid, now = Date.now()) {
  const [shields, swords, pending, recent, ready] = await Promise.all([
    shieldStatus(env, uid, now), swordCount(env, uid), pendingRewards(env, uid), recentRewards(env, uid), armoryReady(env),
  ]);
  return { shields, swords: { count: swords }, pending, recent, ready };
}

// Turn one earned day into a shield or a sword. The UPDATE that marks the
// row claimed is the lock: only the caller whose UPDATE changes a row gets
// the inventory increment, which is chained off changes() in the same batch
// (one transaction). A second tap, a replay after a dropped connection, or a
// second device finds claimed_kind already set, changes nothing and credits
// nothing — and is told so, with what the day became.
//   { ok:true, kind }                    claimed just now
//   { ok:false, code:'bad_kind'|'bad_date' }
//   { ok:false, code:'not_ready' }       db/019 not applied yet
//   { ok:false, code:'no_reward' }       that day was never earned
//   { ok:false, code:'claimed', kind }   already chosen (idempotent no-op)
export async function claimReward(env, uid, date, kind, now = Date.now()) {
  if (!REWARD_KINDS.includes(kind)) return { ok: false, code: 'bad_kind' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return { ok: false, code: 'bad_date' };
  if (!(await armoryReady(env))) return { ok: false, code: 'not_ready' };
  const col = KIND_COLUMN[kind];
  const results = await env.DB.batch([
    env.DB.prepare(
      'UPDATE daily_task_rewards SET claimed_kind = ?, claimed_at = ? WHERE user_id = ? AND task_date = ? AND claimed_kind IS NULL'
    ).bind(kind, sqlTime(now), uid, date),
    // changes() here = rows the claim above marked (1 or 0).
    env.DB.prepare(`UPDATE users SET ${col} = ${col} + 1 WHERE id = ? AND changes() > 0`).bind(uid),
  ]);
  if (results && results[0] && results[0].meta && results[0].meta.changes > 0) return { ok: true, kind };
  const row = await env.DB.prepare('SELECT claimed_kind FROM daily_task_rewards WHERE user_id = ? AND task_date = ?')
    .bind(uid, date).first();
  if (!row) return { ok: false, code: 'no_reward' };
  return { ok: false, code: 'claimed', kind: row.claimed_kind || null };
}

// "Nhận tất cả làm khiên / làm kiếm": every pending day at once. One UPDATE
// claims every unclaimed row of this child; the inventory then grows by
// changes() — exactly the number of rows THAT statement marked, inside the
// same transaction — so a day another device claimed a moment earlier is
// neither re-claimed nor credited twice, and a replay credits nothing.
//   { ok:true, kind, claimed }           claimed = rows turned into `kind` (may be 0)
//   { ok:false, code:'bad_kind'|'not_ready' }
export async function claimAllRewards(env, uid, kind, now = Date.now()) {
  if (!REWARD_KINDS.includes(kind)) return { ok: false, code: 'bad_kind' };
  if (!(await armoryReady(env))) return { ok: false, code: 'not_ready' };
  const col = KIND_COLUMN[kind];
  const results = await env.DB.batch([
    env.DB.prepare(
      'UPDATE daily_task_rewards SET claimed_kind = ?, claimed_at = ? WHERE user_id = ? AND claimed_kind IS NULL'
    ).bind(kind, sqlTime(now), uid),
    env.DB.prepare(`UPDATE users SET ${col} = ${col} + changes() WHERE id = ?`).bind(uid),
  ]);
  const claimed = Number((results && results[0] && results[0].meta && results[0].meta.changes) || 0);
  return { ok: true, kind, claimed };
}
