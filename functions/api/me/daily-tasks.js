import { requireAuth, json, err } from '../_lib.js';
import { evaluate, shieldStatus } from '../_daily-task.js';

// GET /api/me/daily-tasks — the child's tasks for today (GMT+7), progress
// counted from `activities`, whether today's reward is paid, and the shield
// inventory. Evaluating here too means a child who finished the last session
// offline still gets paid the moment they look.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  const now = Date.now();
  const p = await evaluate(env, auth.uid, now);
  const shields = await shieldStatus(env, auth.uid, now);
  return json({
    date: p.date,
    tasks: p.tasks.map(t => ({ id: t.id, kind: t.kind, label: t.label, target: t.target, count: t.count, done: t.done })),
    allDone: p.allDone, rewardedToday: p.rewardedToday, justRewarded: p.justRewarded, shields,
  });
}
