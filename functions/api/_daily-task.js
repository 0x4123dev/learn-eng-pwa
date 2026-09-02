import DailyTaskCatalog from '../../js/daily-task-catalog.js';
import { nightDate } from './_night-raid.js';

// Daily tasks: assigned by an admin, counted from `activities` on read,
// rewarded once per GMT+7 day. Shared by /api/me/daily-tasks, /api/activity
// (so a finished session pays out without the child opening the panel),
// /api/admin/daily-tasks and /api/night-raid/shield.
export const DAILY_REWARD = { coins: 200, shields: 1 };
export const SHIELD_MS = 24 * 3600 * 1000;
export const SHIELD_RAID_LOSS = 200;   // what a raider pays for hitting a shielded home
export const MAX_TARGET = 50;

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
  const tasks = [];
  for (const row of results || []) {
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
    tasks.push({ id: row.id, kind: row.kind, label: row.label, target, count, done: count >= target, created_at: row.created_at });
  }
  return { date, tasks, allDone: tasks.length > 0 && tasks.every(t => t.done) };
}

export async function rewardedOn(env, uid, date) {
  const row = await env.DB.prepare('SELECT 1 AS x FROM daily_task_rewards WHERE user_id = ? AND task_date = ?')
    .bind(uid, date).first();
  return !!row;
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
// impossible to insert. The shield UPDATE stays chained off the coin
// grant's changes(), so a day that (for any reason) didn't get paid coins
// never gets a shield either.
export async function evaluate(env, uid, now = Date.now()) {
  const p = await progress(env, uid, now);
  if (!p.tasks.length) {
    const rewardedToday = await rewardedOn(env, uid, p.date);
    return Object.assign(p, { rewardedToday, justRewarded: false });
  }
  let rewardedToday = await rewardedOn(env, uid, p.date);
  let justRewarded = false;
  if (p.allDone && !rewardedToday) {
    const note = 'Daily task ' + p.date;
    const results = await env.DB.batch([
      env.DB.prepare('INSERT OR IGNORE INTO daily_task_rewards (user_id, task_date, coins, shields) VALUES (?, ?, ?, ?)')
        .bind(uid, p.date, DAILY_REWARD.coins, DAILY_REWARD.shields),
      // changes() here = rows inserted by the claim above (1 or 0). NOT
      // EXISTS is belt-and-braces on top of that: the note is unique per
      // (user, day) by construction, so this can insert at most once per day
      // no matter what changes() reports.
      env.DB.prepare(
        `INSERT INTO coin_grants (user_id, amount, note, granted_by)
         SELECT ?, ?, ?, 0 WHERE changes() > 0
           AND NOT EXISTS (SELECT 1 FROM coin_grants WHERE user_id = ? AND note = ?)`
      ).bind(uid, DAILY_REWARD.coins, note, uid, note),
      // changes() here = rows inserted by the coin grant above (1 or 0).
      env.DB.prepare('UPDATE users SET night_shields = night_shields + ? WHERE id = ? AND changes() > 0')
        .bind(DAILY_REWARD.shields, uid),
    ]);
    justRewarded = !!(results && results[0] && results[0].meta && results[0].meta.changes > 0);
    rewardedToday = true;
  }
  return Object.assign(p, { rewardedToday, justRewarded });
}

// Inventory + whether the castle is shielded right now.
export async function shieldStatus(env, uid, now = Date.now()) {
  const u = await env.DB.prepare('SELECT night_shields FROM users WHERE id = ?').bind(uid).first();
  const h = await env.DB.prepare('SELECT shield_until FROM night_raid_homes WHERE user_id = ?').bind(uid).first();
  const until = Math.max(0, Math.trunc(+((h && h.shield_until) || 0)));
  return { count: Math.max(0, Math.trunc(+((u && u.night_shields) || 0))), activeUntil: until > now ? until : 0 };
}
