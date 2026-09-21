import DailyTaskCatalog from '../../js/daily-task-catalog.js';
import FarmRules from '../../js/farm-rules.js';
import { nightDate } from './_night-raid.js';

// Daily tasks: assigned by an admin, counted from `activities` on read,
// rewarded once per GMT+7 day. Shared by /api/me/daily-tasks, /api/activity
// (so a finished session pays out without the learner opening the panel) and
// /api/admin/daily-tasks.
//
// The reward is 200 xu, paid at once as a coin_grants IOU — nothing else.
// The `shields` column of daily_task_rewards is a db/018 leftover (the
// Armory is gone); every new row leaves it at its default. The row itself
// still matters: functions/api/_farm.js counts daily_task_rewards rows as
// the farm's clock, one tick per fully-done day.
export const DAILY_REWARD = { coins: 200 };
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
  const date = typeof now === 'string' ? now : nightDate(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Invalid daily-task date');
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

// Rows that never move a task counter, whatever they score: a session marked
// as a re-do of the same paper (detail.retake, written by the old exam engine
// and still present on historical rows). A task is completed only by a FRESH
// attempt started from the menu. COALESCE(…, 0) is what keeps every other row
// counting — a detail_json of NULL, or one without the key, extracts to NULL,
// and NULL = 0 would otherwise be neither true nor false and drop the row.
export const NOT_RETAKE_SQL = "COALESCE(json_extract(detail_json, '$.retake'), 0) = 0";

// Today's progress for every active task. `done` = enough sessions with
// score == total inside the GMT+7 day, retakes excluded. Never writes.
export async function progress(env, uid, now = Date.now()) {
  const historical = typeof now === 'string';
  const { date, startUtc, endUtc } = dayWindowUtc(now);
  // Normal reads retain the established "currently active" contract. A
  // delayed sync passes an explicit date and uses the preserved effective
  // interval instead, so today's replacement tasks cannot rewrite yesterday.
  const taskQuery = historical
    ? env.DB.prepare(`SELECT id, kind, label, target, activity_type, match_json, created_at, ended_at
         FROM daily_tasks WHERE user_id = ? AND created_at < ? AND (ended_at IS NULL OR ended_at >= ?) ORDER BY id`)
        .bind(uid, endUtc, startUtc)
    : env.DB.prepare(`SELECT id, kind, label, target, activity_type, match_json, created_at
         FROM daily_tasks WHERE user_id = ? AND active = 1 ORDER BY id`).bind(uid);
  const { results } = await taskQuery.all();
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
          AND created_at >= ? AND created_at < ? AND ${NOT_RETAKE_SQL} AND ${m.sql}`
    ).bind(uid, row.activity_type, startUtc, endUtc, ...m.binds).first();
    const count = Number((r && r.n) || 0);
    const target = Math.min(MAX_TARGET, Math.max(1, Math.trunc(+row.target || 1)));
    return { id: row.id, kind: row.kind, label: row.label, target, count, done: count >= target, created_at: row.created_at };
  }));
  return { date, tasks, allDone: tasks.length > 0 && tasks.every(t => t.done) };
}

// The same progress for each of the last `days` GMT+7 days, for the admin's
// who-studied-who-skipped grid. Batched: ONE count-per-day query for each
// task that was in force at any point in the range (grouped by the learner's
// calendar day), plus one query for the rewards — not one query per task
// per day, which at 7 learners × 30 days × 3 tasks is 630 reads a page
// load. A task counts on a day only if it was in force that day, the same
// effective-interval rule progress() applies to a delayed sync. Never
// writes.
export async function progressRange(env, uid, days, now = Date.now()) {
  const n = Math.max(1, Math.min(31, Math.trunc(+days) || 1));
  const today = nightDate(now);
  const dates = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.parse(today + 'T00:00:00Z') - i * 24 * 3600000);
    dates.push(d.toISOString().slice(0, 10));
  }
  const windows = dates.map(dayWindowUtc);
  const rangeStart = windows[0].startUtc, rangeEnd = windows[windows.length - 1].endUtc;
  const { results } = await env.DB.prepare(
    `SELECT id, kind, label, target, activity_type, match_json, created_at, ended_at
       FROM daily_tasks WHERE user_id = ? AND created_at < ? AND (ended_at IS NULL OR ended_at >= ?) ORDER BY id`
  ).bind(uid, rangeEnd, rangeStart).all();
  const specs = await Promise.all((results || []).map(async row => {
    let match = {};
    try { match = JSON.parse(row.match_json) || {}; } catch (e) { match = {}; }
    const m = matchSql(match);
    const r = await env.DB.prepare(
      `SELECT date(created_at, '+7 hours') AS d, COUNT(*) AS n FROM activities
        WHERE user_id = ? AND type = ? AND total > 0 AND score = total
          AND created_at >= ? AND created_at < ? AND ${NOT_RETAKE_SQL} AND ${m.sql}
        GROUP BY d`
    ).bind(uid, row.activity_type, rangeStart, rangeEnd, ...m.binds).all();
    const byDay = {};
    for (const x of (r.results || [])) byDay[x.d] = Number(x.n) || 0;
    const target = Math.min(MAX_TARGET, Math.max(1, Math.trunc(+row.target || 1)));
    return { row, target, byDay };
  }));
  const rw = await env.DB.prepare(
    'SELECT task_date FROM daily_task_rewards WHERE user_id = ? AND task_date >= ? AND task_date <= ?'
  ).bind(uid, dates[0], dates[dates.length - 1]).all();
  const rewarded = new Set((rw.results || []).map(x => x.task_date));
  return dates.map((date, i) => {
    const w = windows[i];
    const tasks = specs
      .filter(s => s.row.created_at < w.endUtc && (s.row.ended_at == null || s.row.ended_at >= w.startUtc))
      .map(s => {
        const count = s.byDay[date] || 0;
        return { id: s.row.id, kind: s.row.kind, label: s.row.label, target: s.target, count, done: count >= s.target };
      });
    return { date, tasks, allDone: tasks.length > 0 && tasks.every(t => t.done), rewarded: rewarded.has(date) };
  });
}

export async function rewardedOn(env, uid, date) {
  const row = await env.DB.prepare('SELECT 1 AS x FROM daily_task_rewards WHERE user_id = ? AND task_date = ?')
    .bind(uid, date).first();
  return !!row;
}

// ---- schema tolerance --------------------------------------------------
// db/028 adds the farm seed tables. The code must survive the one deploy
// where it runs against a database that does not have them yet, so every
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
// the payout statement guarded by SQLite's changes() — the row count of the
// statement that ran just before it — so a crash between claim and payout
// cannot leave a claimed day unpaid, and an ignored claim pays nothing. The
// coin grant additionally checks NOT EXISTS on its own (user, day)-unique
// note as a second lock: even if changes() were ever unreliable (e.g. a
// future D1 quirk), the note makes a duplicate grant for the same day
// impossible to insert.
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
    const results = await env.DB.batch([
      // `shields` is NOT NULL without a default (db/018) and means nothing
      // any more: always 0. The reward row is the farm's day tick and the
      // coin grant's lock, nothing more.
      env.DB.prepare('INSERT OR IGNORE INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?, ?, ?, 0)')
        .bind(uid, p.date, DAILY_REWARD.coins),
      // changes() here = rows inserted by the claim above (1 or 0). NOT
      // EXISTS is belt-and-braces on top of that: the note is unique per
      // (user, day) by construction, so this can insert at most once per day
      // no matter what changes() reports.
      env.DB.prepare(
        `INSERT INTO coin_grants (user_id, amount, note, granted_by)
         SELECT ?, ?, ?, 0 WHERE changes() > 0
           AND NOT EXISTS (SELECT 1 FROM coin_grants WHERE user_id = ? AND note = ?)`
      ).bind(uid, DAILY_REWARD.coins, note, uid, note),
    ]);
    justRewarded = !!(results && results[0] && results[0].meta && results[0].meta.changes > 0);
    rewardedToday = true;
  }
  const seeds = await seedStatus(env, uid, p.date, rewardedToday);
  return Object.assign(p, { rewardedToday, justRewarded, seeds });
}
