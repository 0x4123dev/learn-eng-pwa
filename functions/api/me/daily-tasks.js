import { requireAuth, json, err } from '../_lib.js';
import { evaluate } from '../_daily-task.js';
import { NR, nightRaidEnabled, safeJson } from '../_night-raid.js';
import { farmClock, farmSummary } from '../_farm.js';

// GET /api/me/daily-tasks — the learner's tasks for today (GMT+7), progress
// counted from `activities`, whether today's 200 xu are paid, the seed
// streak and the farm strip. Evaluating here too means a learner who
// finished the last session offline still gets paid the moment they look —
// but only within the same GMT+7 day: a session finished at 23:58 and synced
// after midnight counts toward the new day, not the one it was played in.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  const now = Date.now();
  const p = await evaluate(env, auth.uid, now);
  // The garden strip is available to every learner; computed AFTER
  // evaluate() so a reward that just landed already counts as today's day.
  let farm = null;
  if (await nightRaidEnabled(env, auth.uid)) {
    const row = await env.DB.prepare('SELECT layout_json FROM night_raid_homes WHERE user_id = ?').bind(auth.uid).first();
    const clock = await farmClock(env, auth.uid, now);
    const layout = NR.normalizeLayout(row ? safeJson(row.layout_json, { cells: [] }) : { cells: [] }, { dayCount: clock.dayCount, today: clock.ctx.today });
    farm = Object.assign(farmSummary(layout, clock.dayCount, clock.ctx), { ctx: clock.ctx });
  }
  return json({
    date: p.date,
    tasks: p.tasks.map(t => ({ id: t.id, kind: t.kind, label: t.label, target: t.target, count: t.count, done: t.done })),
    allDone: p.allDone, rewardedToday: p.rewardedToday, justRewarded: p.justRewarded,
    seeds: p.seeds,
    farm,
  });
}
