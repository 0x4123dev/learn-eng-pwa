import { requireAuth, json, err } from '../_lib.js';
import { MF, currentFight, fightView, pairState, reapStale } from '../_math-fight.js';

// GET /api/math-fight → everything the Đấu Toán tab needs to paint itself:
// the friends it may challenge, each with the clocks that gate them, plus any
// fight this child is already inside.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  await reapStale(env);

  const rows = await env.DB.prepare(
    `SELECT CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END AS friend_id,
            CASE WHEN f.requester_id = ? THEN au.username ELSE ru.username END AS friend_name,
            strftime('%s', COALESCE(f.responded_at, f.created_at)) AS since
       FROM friendships f
       JOIN users ru ON ru.id = f.requester_id
       JOIN users au ON au.id = f.addressee_id
      WHERE (f.requester_id = ? OR f.addressee_id = ?) AND f.status = 'accepted'
        AND ru.disabled = 0 AND au.disabled = 0`
  ).bind(auth.uid, auth.uid, auth.uid, auth.uid).all();

  const friends = [];
  for (const r of (rows.results || [])) {
    const pair = await pairState(env, auth.uid, r.friend_id);
    const busy = await currentFight(env, r.friend_id);
    friends.push({
      userId: r.friend_id,
      username: r.friend_name || 'Bạn',
      // Absolute timestamps only: the client renders countdowns and never
      // holds its own copy of the 3-day rules.
      readyAt: pair.nextReadyAt || null,
      friendReadyAt: Number(r.since) * 1000 + MF.COOLDOWN_MS,
      busy: !!busy,
    });
  }
  friends.sort((a, b) => a.username.localeCompare(b.username, 'vi'));

  const mine = await currentFight(env, auth.uid);
  return json({
    now: Date.now(),
    prize: MF.PRIZE,
    questions: MF.QUESTIONS, seconds: MF.SECONDS,
    heartbeatMs: MF.HEARTBEAT_MS,
    friends,
    fight: fightView(mine, auth.uid),
  });
}
