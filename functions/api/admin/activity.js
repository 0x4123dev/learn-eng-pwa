import { requireAuth, json, err } from '../_lib.js';

// GET /api/admin/activity[?user_id=N] — unified timeline of ALL activity
// (exam attempts + lessons/practice), newest first, with username joined in.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  const url = new URL(request.url);
  const userId = url.searchParams.get('user_id');
  const filter = (userId && /^\d+$/.test(userId)) ? userId : null;

  // exam_attempts and activities share a shape via UNION ALL. time_spent_sec
  // is the exam's own timer for an attempt and detail.sec (js/auth.js
  // ActivityClock) for an activity — NULL on rows from before either
  // existed, which the admin shows as "—". `retake` is 1
  // when an activities row is a "Làm lại" of the same paper (detail.retake,
  // js/auth.js): admin.html shows it as a tag so the parent can see why a
  // 100% did not move the daily-task counter (_daily-task.js progress()).
  const sql =
    `SELECT * FROM (
        SELECT a.created_at AS created_at, a.user_id AS user_id, u.username AS username,
               'exam' AS kind, a.exam_title AS title, a.exam_id AS ref,
               a.score AS score, a.total AS total, a.time_spent_sec AS time_spent_sec,
               a.auto_submitted AS auto_submitted, 0 AS retake,
               (SELECT s.balance FROM user_coin_snapshots s
                 WHERE s.user_id=a.user_id AND s.snapshot_date=date(a.created_at,'+7 hours')
                 LIMIT 1) AS coin_balance
          FROM exam_attempts a JOIN users u ON u.id = a.user_id
          ${filter ? 'WHERE a.user_id = ?1' : ''}
        UNION ALL
        SELECT c.created_at AS created_at, c.user_id AS user_id, u.username AS username,
               c.type AS kind, c.title AS title, NULL AS ref,
               c.score AS score, c.total AS total,
               json_extract(c.detail_json, '$.sec') AS time_spent_sec,
               0 AS auto_submitted,
               CASE WHEN COALESCE(json_extract(c.detail_json, '$.retake'), 0) = 1 THEN 1 ELSE 0 END AS retake,
               (SELECT s.balance FROM user_coin_snapshots s
                 WHERE s.user_id=c.user_id AND s.snapshot_date=date(c.created_at,'+7 hours')
                 LIMIT 1) AS coin_balance
          FROM activities c JOIN users u ON u.id = c.user_id
          ${filter ? 'WHERE c.user_id = ?1' : ''}
     ) ORDER BY created_at DESC LIMIT 1000`;

  const stmt = filter ? env.DB.prepare(sql).bind(filter) : env.DB.prepare(sql);
  const { results } = await stmt.all();
  return json({ activity: results || [] });
}
