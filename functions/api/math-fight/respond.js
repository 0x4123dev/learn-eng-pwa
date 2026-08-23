import { requireAuth, json, err } from '../_lib.js';
import { MF, fightView } from '../_math-fight.js';

// POST /api/math-fight/respond { fightId, accept, coins }
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  let body; try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }

  const id = String(body.fightId || '');
  if (!/^[a-f0-9]{32}$/.test(id)) return err('Invalid fight id');
  const row = await env.DB.prepare('SELECT * FROM math_fights WHERE id=?').bind(id).first();
  if (!row) return err('Không tìm thấy trận', 404);
  if (row.opponent_id !== auth.uid) return err('Forbidden', 403);
  if (row.status !== 'invited') return err('Kèo này không còn hiệu lực', 409);

  const now = Date.now();
  if (row.expires_at < now) {
    await env.DB.prepare("UPDATE math_fights SET status='expired' WHERE id=?").bind(id).run();
    return err('Kèo đã hết hạn', 409);
  }
  if (!body.accept) {
    await env.DB.prepare("UPDATE math_fights SET status='declined' WHERE id=?").bind(id).run();
    return json({ ok: true, declined: true });
  }
  const coins = Math.max(0, Math.trunc(+body.coins || 0));
  if (coins < row.bet) return err('Con chưa đủ ' + row.bet + ' xu để nhận kèo');

  // The clock starts on the server, so neither device can lengthen its own
  // five minutes by stalling the accept. Both pulses start alive, or the very
  // first walk-away check would fire before either child has answered.
  await env.DB.prepare(
    "UPDATE math_fights SET status='active', started_at=?, deadline_at=?, c_beat_at=?, o_beat_at=? WHERE id=? AND status='invited'"
  ).bind(now, now + MF.SECONDS * 1000, now, now, id).run();

  const fresh = await env.DB.prepare('SELECT * FROM math_fights WHERE id=?').bind(id).first();
  return json({ fight: fightView(fresh, auth.uid) });
}
