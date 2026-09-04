import { NR, nightDate } from './_night-raid.js';
import { rewardedOn } from './_daily-task.js';

// The farm's clock is the daily-task reward table. One row per GMT+7 day the
// child finished every task; the row count is "how many days the farm has
// grown", and yesterday's/today's rows decide whether the plants are wilted.
// Nothing here writes: the reward row is inserted by _daily-task.js evaluate()
// under its own once-a-day lock, so the farm can never tick twice in a day.
const Farm = NR.farmRules;

export async function dayCount(env, uid) {
  const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM daily_task_rewards WHERE user_id = ?').bind(uid).first();
  return Math.max(0, Math.trunc(Number((r && r.n) || 0)));
}

export async function wiltCtx(env, uid, now = Date.now()) {
  const today = nightDate(now), yesterday = nightDate(now - 86400000);
  const [doneToday, doneYesterday] = await Promise.all([rewardedOn(env, uid, today), rewardedOn(env, uid, yesterday)]);
  return { today, doneYesterday: !!doneYesterday, doneToday: !!doneToday };
}

export async function farmClock(env, uid, now = Date.now()) {
  const [count, ctx] = await Promise.all([dayCount(env, uid), wiltCtx(env, uid, now)]);
  return { dayCount: count, ctx };
}

// What the Daily Task page shows about the garden. Pure: the layout is already
// normalized by the caller.
export function farmSummary(layout, dayCountValue, ctx) {
  const cells = Farm.allCells(layout);
  const crops = cells.filter(c => Farm.isCrop(c));
  let ripe = 0, growing = 0, wiltedCount = 0, preview = null, best = -Infinity;
  for (const c of crops) {
    const p = Farm.progress(c, dayCountValue), w = Farm.isWilted(c, ctx);
    if (w) wiltedCount++;
    if (p.ripe) ripe++; else growing++;
    // Ripe first, then the fewest days left. A ripe crop beats every growing one.
    const score = p.ripe ? 1000 : 100 - p.left;
    if (score > best) { best = score; preview = { id: c.type, g: p.g, days: p.days, wilted: w }; }
  }
  const barracksReady = cells.filter(c => c.type === 'training-barracks' && Farm.barracksReady(c, dayCountValue)).length;
  return { crops: crops.length, ripe, growing, wiltedCount, wilted: wiltedCount > 0, barracksReady, preview, dayCount: dayCountValue };
}
