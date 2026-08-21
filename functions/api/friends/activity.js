import { requireAuth, json, err } from '../_lib.js';
import { areFriends } from '../_battle.js';

// GET /api/friends/activity?friendId=N — a friend's 7-day learning card.
// Deliberately a SUMMARY only: counts per day and per skill, never the
// questions they answered or their answers.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const friendId = Math.trunc(+url.searchParams.get('friendId'));
  if (!friendId) return err('Thiếu friendId');
  if (friendId !== auth.uid && !(await areFriends(env, auth.uid, friendId))) {
    return err('Chỉ xem được hoạt động của bạn bè', 403);
  }

  const user = await env.DB.prepare('SELECT id, username FROM users WHERE id = ? AND disabled = 0')
    .bind(friendId).first();
  if (!user) return err('Không tìm thấy người dùng', 404);

  const byDay = await env.DB.prepare(
    `SELECT date(created_at) AS day, COUNT(*) AS sessions, COALESCE(SUM(score), 0) AS correct
       FROM activities
      WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
      GROUP BY date(created_at) ORDER BY day`
  ).bind(friendId).all();

  const bySkill = await env.DB.prepare(
    `SELECT type, COUNT(*) AS sessions,
            COALESCE(SUM(score), 0) AS correct, COALESCE(SUM(total), 0) AS total
       FROM activities
      WHERE user_id = ? AND created_at >= datetime('now', '-7 days')
      GROUP BY type ORDER BY sessions DESC`
  ).bind(friendId).all();

  const totals = await env.DB.prepare(
    `SELECT COUNT(*) AS sessions, COALESCE(SUM(score), 0) AS correct,
            COALESCE(SUM(total), 0) AS total,
            COALESCE(SUM(CASE WHEN total >= 10 AND score = total THEN 1 ELSE 0 END), 0) AS perfects
       FROM activities
      WHERE user_id = ? AND created_at >= datetime('now', '-7 days')`
  ).bind(friendId).first();

  return json({
    user: { id: user.id, username: user.username },
    byDay: byDay.results || [],
    bySkill: bySkill.results || [],
    totals: totals || { sessions: 0, correct: 0, total: 0, perfects: 0 },
  });
}
