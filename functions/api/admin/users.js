import { requireAuth, json, err } from '../_lib.js';

// GET /api/admin/users — every user with attempt count + last activity (admin only).
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.role, u.created_at,
            COUNT(a.id)          AS attempt_count,
            MAX(a.created_at)    AS last_attempt,
            MAX(a.score * 1000 / NULLIF(a.total,0)) AS best_pct_x10
       FROM users u
       LEFT JOIN exam_attempts a ON a.user_id = u.id
      GROUP BY u.id
      ORDER BY (last_attempt IS NULL), last_attempt DESC, u.created_at DESC`
  ).all();

  return json({ users: results || [] });
}
