import { requireAuth, json, err } from '../_lib.js';

// POST /api/admin/user-flags  { userId, allowBot?, clearDevice? }
// Per-user switches, set from the admin dashboard.
//   allowBot     — reveals the "practice vs bot" button in the child's arena.
//   clearDevice  — releases this account's hold on its device's signup slot.
// Deliberately admin-only — a child must not be able to grant either to
// themselves: practice battles bypass the ammo economy entirely, and clearing
// a device would reopen the account limit it exists to enforce.
//
// clearDevice is the escape hatch for a real household: a shared iPad with
// three siblings hits MAX_ACCOUNTS_PER_DEVICE legitimately, and without a way
// out the only remedy would be editing production data by hand.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (auth.role !== 'admin') return err('Forbidden', 403);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const userId = Math.trunc(Number(body.userId));
  if (!Number.isFinite(userId) || userId <= 0) return err('Bad userId');

  const wantsBot = typeof body.allowBot !== 'undefined';
  const wantsClear = !!body.clearDevice;
  if (!wantsBot && !wantsClear) return err('Nothing to change');

  const user = await env.DB.prepare('SELECT id, allow_bot FROM users WHERE id = ?').bind(userId).first();
  if (!user) return err('User not found', 404);

  const out = { ok: true, userId, allowBot: !!user.allow_bot };
  if (wantsBot) {
    const allowBot = body.allowBot ? 1 : 0;
    await env.DB.prepare('UPDATE users SET allow_bot = ? WHERE id = ?').bind(allowBot, userId).run();
    out.allowBot = !!allowBot;
  }
  if (wantsClear) {
    // Frees one signup slot on whatever device registered this account. The
    // account itself is untouched — only its claim on that device's quota.
    await env.DB.prepare('UPDATE users SET device_id = NULL WHERE id = ?').bind(userId).run();
    out.deviceCleared = true;
  }
  return json(out);
}
