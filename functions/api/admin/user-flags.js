import { requireAuth, json, err } from '../_lib.js';

// POST /api/admin/user-flags  { userId, allowBot }
// Per-user feature switches, set from the admin dashboard. Today there is one:
// allow_bot, which reveals the "practice vs bot" button in the child's arena.
// Deliberately admin-only — a child must not be able to grant it to themselves,
// since practice battles bypass the ammo economy entirely.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const userId = Math.trunc(Number(body.userId));
  if (!Number.isFinite(userId) || userId <= 0) return err('Bad userId');
  if (typeof body.allowBot === 'undefined') return err('Nothing to change');
  const allowBot = body.allowBot ? 1 : 0;

  const user = await env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(userId).first();
  if (!user) return err('User not found', 404);

  await env.DB.prepare('UPDATE users SET allow_bot = ? WHERE id = ?').bind(allowBot, userId).run();
  return json({ ok: true, userId, allowBot: !!allowBot });
}
