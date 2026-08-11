import { requireAuth, json, err } from '../_lib.js';

// GET /api/admin/users — every user with total activity (exams + lessons/practice)
// count and last-activity timestamp across both tables (admin only).
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  const { results } = await env.DB.prepare(
    `SELECT u.id, u.username, u.role, u.created_at, u.allow_bot, u.disabled,
            (u.device_id IS NOT NULL) AS has_device,
            (SELECT COUNT(*) FROM exam_attempts e WHERE e.user_id = u.id) AS exam_count,
            (SELECT COUNT(*) FROM activities  c WHERE c.user_id = u.id) AS activity_count,
            MAX(
              COALESCE((SELECT MAX(e.created_at) FROM exam_attempts e WHERE e.user_id = u.id), ''),
              COALESCE((SELECT MAX(c.created_at) FROM activities  c WHERE c.user_id = u.id), '')
            ) AS last_activity
       FROM users u
      ORDER BY (last_activity = '' OR last_activity IS NULL), last_activity DESC, u.created_at DESC`
  ).all();

  const users = (results || []).map(u => ({
    id: u.id, username: u.username, role: u.role, created_at: u.created_at,
    allow_bot: !!u.allow_bot,
    disabled: !!u.disabled,
    // Whether this account is holding a slot on some device's 2-account quota
    // — the admin needs to see that before deciding whether clearing helps.
    has_device: !!u.has_device,
    exam_count: u.exam_count || 0,
    activity_count: u.activity_count || 0,
    total_count: (u.exam_count || 0) + (u.activity_count || 0),
    last_activity: u.last_activity || null,
  }));
  return json({ users });
}
