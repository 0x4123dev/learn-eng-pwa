import { requireAuth, json, err } from '../_lib.js';
import { battleView, hiresJson, normalizeHires, parseHires, TEAM_MAX_HIRES } from '../_battle.js';

// POST /api/battle/hire { battleId, hires }
// Adds paid teammates at a safe point during an active battle. The device
// wallet remains the source of coins (the same model used by the rest of the
// app), so the client charges only after this update succeeds.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const id = Math.trunc(Number(body.battleId) || 0);
  if (!id) return err('Thiếu battleId');

  const additions = normalizeHires(body.hires);
  if (!additions.length || additions.length !== (Array.isArray(body.hires) ? body.hires.length : 0)) {
    return err('Đội hình không hợp lệ');
  }

  const battle = await env.DB.prepare('SELECT * FROM battles WHERE id = ?').bind(id).first();
  if (!battle) return err('Không tìm thấy trận đấu', 404);
  if (battle.status !== 'active') return err('Trận đấu đã kết thúc', 409);

  const challenger = battle.challenger_id === auth.uid;
  if (!challenger && battle.opponent_id !== auth.uid) return err('Forbidden', 403);
  const column = challenger ? 'challenger_hires' : 'opponent_hires';
  const current = parseHires(battle[column]);
  if (current.length + additions.length > TEAM_MAX_HIRES) return err('Lâu đài đã đủ quân', 409);

  await env.DB.prepare(`UPDATE battles SET ${column} = ? WHERE id = ? AND status = 'active'`)
    .bind(hiresJson(current.concat(additions)), id).run();
  const fresh = await env.DB.prepare('SELECT * FROM battles WHERE id = ?').bind(id).first();
  return json({ ok: true, battle: battleView(fresh, auth.uid), hired: additions });
}
