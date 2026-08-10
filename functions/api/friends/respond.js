import { requireAuth, json, err } from '../_lib.js';

// POST /api/friends/respond { friendshipId, accept } — only the ADDRESSEE of a
// pending invite may answer it.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const id = Math.trunc(+body.friendshipId);
  if (!id) return err('Thiếu friendshipId');

  const row = await env.DB.prepare('SELECT * FROM friendships WHERE id = ?').bind(id).first();
  if (!row) return err('Không tìm thấy lời mời', 404);
  if (row.addressee_id !== auth.uid) return err('Không phải lời mời của bạn', 403);
  if (row.status !== 'pending') return err('Lời mời đã được xử lý', 409);

  const status = body.accept ? 'accepted' : 'declined';
  await env.DB.prepare(
    `UPDATE friendships SET status = ?, responded_at = datetime('now') WHERE id = ?`
  ).bind(status, id).run();
  return json({ ok: true, status });
}
