import { requireAuth, json, err } from '../_lib.js';
import { reapStale, battleView, TURN_MS } from '../_battle.js';

// GET /api/battle/state?battleId=N&since=T — the polling transport's read side.
// Returns the battle plus any turns after `since`, so the opponent can replay
// each shot with identical physics.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  await reapStale(env);

  const url = new URL(request.url);
  const id = Math.trunc(+url.searchParams.get('battleId'));
  const since = Math.max(0, Math.trunc(+url.searchParams.get('since') || 0));
  if (!id) return err('Thiếu battleId');

  const b = await env.DB.prepare('SELECT * FROM battles WHERE id = ?').bind(id).first();
  if (!b) return err('Không tìm thấy trận đấu', 404);
  if (b.challenger_id !== auth.uid && b.opponent_id !== auth.uid) return err('Forbidden', 403);

  const turns = await env.DB.prepare(
    `SELECT turn_no, user_id, angle, power, shots, damage, abilities, rocket, created_at
       FROM battle_turns WHERE battle_id = ? AND turn_no > ?
      ORDER BY turn_no`
  ).bind(id, since).all();

  return json({
    battle: battleView(b, auth.uid),
    turns: turns.results || [],
    now: Date.now(),
    turnMs: TURN_MS,
  });
}
