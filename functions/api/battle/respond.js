import { requireAuth, json, err } from '../_lib.js';
import { ammoStatsFor, reapStale, battleView, TURN_MS } from '../_battle.js';

// POST /api/battle/respond { battleId, accept, level, stage, petName }
// Accepting snapshots the opponent's ammo/level and starts turn 1.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  await reapStale(env);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const id = Math.trunc(+body.battleId);
  if (!id) return err('Thiếu battleId');

  const b = await env.DB.prepare('SELECT * FROM battles WHERE id = ?').bind(id).first();
  if (!b) return err('Không tìm thấy trận đấu', 404);
  if (b.opponent_id !== auth.uid) return err('Không phải lời mời của bạn', 403);
  if (b.status !== 'invited') return err('Lời mời đã hết hạn', 409);
  if (b.expires_at && b.expires_at < Date.now()) {
    await env.DB.prepare(`UPDATE battles SET status = 'expired' WHERE id = ?`).bind(id).run();
    return err('Lời mời đã hết hạn', 409);
  }

  if (!body.accept) {
    await env.DB.prepare(`UPDATE battles SET status = 'declined' WHERE id = ?`).bind(id).run();
    return json({ ok: true, status: 'declined' });
  }

  const { ammo } = await ammoStatsFor(env, auth.uid);
  if (ammo <= 0) return err('Chưa có đạn — học bài để nạp đạn nhé! 🚀', 400);

  const me = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(auth.uid).first();
  const now = Date.now();
  // The challenger always fires first.
  await env.DB.prepare(
    `UPDATE battles
        SET status = 'active', opponent_ammo = ?, opponent_level = ?, opponent_stage = ?,
            opponent_name = ?, turn_no = 1, turn_user_id = ?, turn_started_at = ?
      WHERE id = ?`
  ).bind(
    ammo,
    Math.max(1, Math.trunc(+body.level || 1)),
    String(body.stage || 'chihuahua').slice(0, 20),
    String(body.petName || me?.username || 'Pet').slice(0, 20),
    b.challenger_id, now, id
  ).run();

  const fresh = await env.DB.prepare('SELECT * FROM battles WHERE id = ?').bind(id).first();
  return json({ ok: true, turnMs: TURN_MS, battle: battleView(fresh, auth.uid) });
}
