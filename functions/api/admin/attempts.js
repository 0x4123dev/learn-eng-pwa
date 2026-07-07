import { requireAuth, json, err } from '../_lib.js';

// GET /api/admin/attempts[?user_id=N] — all exam attempts (or one user's), newest
// first, with the username joined in (admin only).
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');

  let stmt;
  if (userId && /^\d+$/.test(userId)) {
    stmt = env.DB.prepare(
      `SELECT a.id, a.user_id, u.username, a.exam_id, a.exam_title, a.score, a.total,
              a.time_spent_sec, a.auto_submitted, a.answers_json, a.created_at
         FROM exam_attempts a JOIN users u ON u.id = a.user_id
        WHERE a.user_id = ? ORDER BY a.created_at DESC LIMIT 1000`
    ).bind(userId);
  } else {
    stmt = env.DB.prepare(
      `SELECT a.id, a.user_id, u.username, a.exam_id, a.exam_title, a.score, a.total,
              a.time_spent_sec, a.auto_submitted, a.created_at
         FROM exam_attempts a JOIN users u ON u.id = a.user_id
        ORDER BY a.created_at DESC LIMIT 1000`
    );
  }
  const { results } = await stmt.all();
  return json({ attempts: results || [] });
}
