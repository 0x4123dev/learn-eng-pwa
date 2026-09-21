import { requireAuth, json, err } from '../_lib.js';
import { SHIELD_MS, shieldStatus } from '../_daily-task.js';

// POST /api/night-raid/shield — spend one shield from users.night_shields to
// make the castle unraidable for 24 h (night_raid_homes.shield_until).
// Refuses while a shield is already up so a double tap cannot burn two.
// Only needs a login: the inventory is the child's regardless of allow_bot;
// the home row is what needs Night Raid to have been opened once.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  const now = Date.now();

  // Friendly pre-checks only — they give a precise error message, but the
  // batch below is the authority on whether the spend actually happens.
  const home = await env.DB.prepare('SELECT shield_until FROM night_raid_homes WHERE user_id = ?').bind(auth.uid).first();
  if (!home) return err('Hãy mở Cướp Đêm và xây nhà trước', 404, { code: 'no_home' });
  const activeUntil = Math.max(0, Math.trunc(+home.shield_until || 0));
  if (activeUntil > now) return err('Khiên đang bật rồi', 409, { code: 'active', activeUntil });

  const me = await env.DB.prepare('SELECT night_shields FROM users WHERE id = ?').bind(auth.uid).first();
  if (!me || (+me.night_shields || 0) <= 0) return err('Bạn chưa có khiên nào', 409, { code: 'empty' });

  // The decrement carries both guards — inventory > 0, and nobody shielded
  // the home since the pre-check above — so it and the timer set below run
  // as one batch (one transaction): a crash or D1 error between the two
  // writes can never burn a shield without setting the timer, and there is
  // no refund path because there is nothing to refund.
  const until = now + SHIELD_MS;
  const res = await env.DB.batch([
    env.DB.prepare(
      `UPDATE users SET night_shields = night_shields - 1
        WHERE id = ? AND night_shields > 0
          AND EXISTS (SELECT 1 FROM night_raid_homes h WHERE h.user_id = ? AND COALESCE(h.shield_until, 0) <= ?)`
    ).bind(auth.uid, auth.uid, now),
    // changes() here = rows touched by the decrement above (1 or 0).
    env.DB.prepare('UPDATE night_raid_homes SET shield_until = ? WHERE user_id = ? AND changes() > 0')
      .bind(until, auth.uid),
  ]);
  if (!(res && res[0] && res[0].meta && res[0].meta.changes > 0)) {
    const s = await shieldStatus(env, auth.uid, now);
    return s.activeUntil
      ? err('Khiên đang bật rồi', 409, { code: 'active', activeUntil: s.activeUntil })
      : err('Bạn chưa có khiên nào', 409, { code: 'empty' });
  }
  return json({ ok: true, shields: await shieldStatus(env, auth.uid, now) });
}
