import { requireAuth, json, err } from '../_lib.js';
import { progress, progressRange, shieldStatus, taskSpec, rewardedOn, MAX_TARGET, MAX_ACTIVE_TASKS } from '../_daily-task.js';

// Admin-only CRUD for a child's daily tasks.
//   GET    /api/admin/daily-tasks?user_id=N   → tasks with today's progress (read-only, never pays)
//          &days=D (1–31) adds `history`: the same progress for each of the
//          last D GMT+7 days, oldest first, for the who-studied grid
//   POST   /api/admin/daily-tasks { userId, kind, target }
//   DELETE /api/admin/daily-tasks?id=N        → active = 0 (history kept)
async function requireAdmin(request, env) {
  const auth = await requireAuth(request, env);
  if (!auth) return { fail: err('Unauthorized', 401) };
  if (auth.role !== 'admin') return { fail: err('Forbidden', 403) };
  return { auth };
}

// A nonexistent user_id stays 200 with an empty task list, not a 404: the
// admin picks the child from the user list, so an empty list is the
// friendlier contract for a panel than an error it has to special-case.
export async function onRequestGet({ request, env }) {
  const { fail } = await requireAdmin(request, env);
  if (fail) return fail;
  const raw = new URL(request.url).searchParams.get('user_id');
  if (!raw || !/^\d+$/.test(raw)) return err('Bad user_id');
  const uid = Number(raw);
  const now = Date.now();
  const p = await progress(env, uid, now);
  const daysRaw = new URL(request.url).searchParams.get('days');
  const days = daysRaw && /^\d+$/.test(daysRaw) ? Math.max(1, Math.min(31, Number(daysRaw))) : 0;
  return json({
    date: p.date, tasks: p.tasks, allDone: p.allDone,
    rewardedToday: await rewardedOn(env, uid, p.date),
    shields: await shieldStatus(env, uid, now),
    ...(days ? { history: await progressRange(env, uid, days, now) } : {}),
  });
}

export async function onRequestPost({ request, env }) {
  const { auth, fail } = await requireAdmin(request, env);
  if (fail) return fail;
  let body;
  try { body = (await request.json()) || {}; } catch (e) { return err('Invalid JSON'); }

  const userId = Math.trunc(Number(body.userId));
  if (!Number.isFinite(userId) || userId <= 0) return err('Bad userId');
  const target = Number(body.target);
  if (!Number.isInteger(target) || target < 1 || target > MAX_TARGET) return err('Số bài phải từ 1 đến ' + MAX_TARGET);
  const spec = taskSpec(body.kind);
  if (!spec) return err('Loại bài không hợp lệ');

  const user = await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(userId).first();
  if (!user) return err('User not found', 404);
  if (user.role === 'admin') return err('Không giao task cho admin');

  const dup = await env.DB.prepare('SELECT id FROM daily_tasks WHERE user_id = ? AND kind = ? AND active = 1')
    .bind(userId, spec.kind).first();
  if (dup) return err('Bé đã có task này, xoá rồi tạo lại nếu muốn đổi số bài', 409, { code: 'duplicate', id: dup.id });

  const n = await env.DB.prepare('SELECT COUNT(*) AS n FROM daily_tasks WHERE user_id = ? AND active = 1').bind(userId).first();
  if (Number((n && n.n) || 0) >= MAX_ACTIVE_TASKS) return err('Mỗi bé tối đa ' + MAX_ACTIVE_TASKS + ' task', 400, { code: 'too_many' });

  const res = await env.DB.prepare(
    'INSERT INTO daily_tasks (user_id, kind, label, target, activity_type, match_json, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(userId, spec.kind, spec.label, target, spec.activityType, spec.matchJson, auth.uid).run();
  return json({ ok: true, task: { id: res.meta.last_row_id, userId, kind: spec.kind, label: spec.label, target } });
}

export async function onRequestDelete({ request, env }) {
  const { fail } = await requireAdmin(request, env);
  if (fail) return fail;
  const raw = new URL(request.url).searchParams.get('id');
  if (!raw || !/^\d+$/.test(raw)) return err('Bad id');
  const res = await env.DB.prepare("UPDATE daily_tasks SET active = 0, ended_at = datetime('now') WHERE id = ? AND active = 1").bind(Number(raw)).run();
  if (!(res.meta && res.meta.changes > 0)) return err('Task not found', 404);
  return json({ ok: true, id: Number(raw) });
}
