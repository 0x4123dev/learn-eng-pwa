import { requireAuth, json, err } from '../_lib.js';

// POST /api/admin/grant-coins { userId, amount, note? }
// The admin gives coins; the child's device claims them on its next sync
// (POST /api/coins). An IOU row instead of a direct balance write because the
// wallet lives in the device profile, not on the server — see db/010.
const MAX_GRANT = 100000;

export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const userId = Math.trunc(Number(body.userId));
  if (!Number.isFinite(userId) || userId <= 0) return err('Bad userId');
  const amount = Math.trunc(Number(body.amount));
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_GRANT) {
    return err('Số xu phải từ 1 đến ' + MAX_GRANT);
  }

  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) return err('User not found', 404);

  const note = String(body.note || '').slice(0, 120);
  await env.DB.prepare(
    'INSERT INTO coin_grants (user_id, amount, note, granted_by) VALUES (?, ?, ?, ?)'
  ).bind(userId, amount, note, auth.uid).run();

  const pending = await env.DB.prepare(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM coin_grants WHERE user_id = ? AND claimed_at IS NULL'
  ).bind(userId).first();
  return json({ ok: true, userId, amount, pendingTotal: Number((pending && pending.total) || 0) });
}
