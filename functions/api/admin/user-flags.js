import { requireAuth, json, err } from '../_lib.js';

// POST /api/admin/user-flags  { userId, clearDevice?, disabled? }
// Per-user switches, set from the admin dashboard.
//   clearDevice  — releases this account's hold on its device's signup slot.
//   disabled     — switches the account off everywhere (see db/005).
// (allowBot and allowChuyen lived here until the 2026-09 cut; the features
// they gated — Cướp Đêm raiding and the Chuyên tier — are gone. The columns
// stay in the schema, unread.)
// Deliberately admin-only — a child must not be able to grant either to
// themselves: clearing a device would reopen the account limit it exists to
// enforce, and a disabled child re-enabling themselves defeats the switch.
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

  const wantsClear = !!body.clearDevice;
  const wantsDisable = typeof body.disabled !== 'undefined';
  if (!wantsClear && !wantsDisable) return err('Nothing to change');

  const user = await env.DB.prepare('SELECT id, role, disabled FROM users WHERE id = ?')
    .bind(userId).first();
  if (!user) return err('User not found', 404);

  // Two ways an admin could lock everyone out of this dashboard forever, both
  // one careless click away. requireAuth refuses a disabled account, so a
  // disabled admin cannot even reach the endpoint that would re-enable them —
  // the only fix would be editing production data by hand.
  if (wantsDisable && body.disabled) {
    if (userId === auth.uid) return err('Không thể tự khoá tài khoản của mình', 400, { code: 'self_disable' });
    if (user.role === 'admin') return err('Không thể khoá tài khoản admin', 400, { code: 'admin_disable' });
  }

  const out = { ok: true, userId, disabled: !!user.disabled };
  if (wantsDisable) {
    const disabled = body.disabled ? 1 : 0;
    await env.DB.prepare('UPDATE users SET disabled = ? WHERE id = ?').bind(disabled, userId).run();
    out.disabled = !!disabled;
  }
  if (wantsClear) {
    // Frees one signup slot on whatever device registered this account. The
    // account itself is untouched — only its claim on that device's quota.
    await env.DB.prepare('UPDATE users SET device_id = NULL WHERE id = ?').bind(userId).run();
    out.deviceCleared = true;
  }
  return json(out);
}
