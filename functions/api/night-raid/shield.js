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

  const home = await env.DB.prepare('SELECT shield_until FROM night_raid_homes WHERE user_id = ?').bind(auth.uid).first();
  if (!home) return err('Hãy mở Cướp Đêm và xây nhà trước', 404, { code: 'no_home' });
  const activeUntil = Math.max(0, Math.trunc(+home.shield_until || 0));
  if (activeUntil > now) return err('Khiên đang bật rồi', 409, { code: 'active', activeUntil });

  const me = await env.DB.prepare('SELECT night_shields FROM users WHERE id = ?').bind(auth.uid).first();
  if (!me || (+me.night_shields || 0) <= 0) return err('Con chưa có khiên nào', 409, { code: 'empty' });

  // Decrement guarded by the count, then set the timer guarded by "not
  // already shielded". If the second guard loses a race, give the shield back.
  const spent = await env.DB.prepare('UPDATE users SET night_shields = night_shields - 1 WHERE id = ? AND night_shields > 0')
    .bind(auth.uid).run();
  if (!(spent.meta && spent.meta.changes > 0)) return err('Con chưa có khiên nào', 409, { code: 'empty' });
  const until = now + SHIELD_MS;
  const set = await env.DB.prepare('UPDATE night_raid_homes SET shield_until = ? WHERE user_id = ? AND COALESCE(shield_until, 0) <= ?')
    .bind(until, auth.uid, now).run();
  if (!(set.meta && set.meta.changes > 0)) {
    await env.DB.prepare('UPDATE users SET night_shields = night_shields + 1 WHERE id = ?').bind(auth.uid).run();
    const current = await shieldStatus(env, auth.uid, now);
    return err('Khiên đang bật rồi', 409, { code: 'active', activeUntil: current.activeUntil });
  }
  return json({ ok: true, shields: await shieldStatus(env, auth.uid, now) });
}
