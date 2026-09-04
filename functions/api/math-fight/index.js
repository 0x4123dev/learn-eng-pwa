import { requireAuth, json, err } from '../_lib.js';
import { MF, busyIdsAmong, currentFight, fightView, mathFightEnabled, pairStatesFor, reapStale } from '../_math-fight.js';

// GET /api/math-fight → everything the Đấu Toán tab needs to paint itself:
// the friends it may challenge, each with the clocks that gate them, plus any
// fight this child is already inside.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (!(await mathFightEnabled(env))) return err('Đấu Toán chưa được mở cho tài khoản này', 403);
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

  // This screen re-polls every 3 seconds for as long as it is open, so the
  // per-friend fan-out it used to do here — pairState + currentFight inside
  // the loop — cost 2N+2 D1 round trips per poll per device, forty-two of them
  // for a child with twenty friends. Both lookups are now one set-based read
  // each, so the poll costs the same handful of queries whether the child has
  // two friends or fifty.
  const friendRows = rows.results || [];
  const ids = friendRows.map(r => r.friend_id);
  const [pairs, busyIds, mine] = await Promise.all([
    pairStatesFor(env, auth.uid, ids),
    busyIdsAmong(env, ids),
    currentFight(env, auth.uid),
  ]);

  const friends = friendRows.map(r => {
    const id = Math.trunc(Number(r.friend_id) || 0);
    const pair = pairs.get(id);
    return {
      userId: r.friend_id,
      username: r.friend_name || 'Bạn',
      // Absolute timestamps only: the client renders countdowns and never
      // holds its own copy of the 3-day rules.
      readyAt: (pair && pair.nextReadyAt) || null,
      friendReadyAt: Number(r.since) * 1000 + MF.COOLDOWN_MS,
      busy: busyIds.has(id),
    };
  });
  friends.sort((a, b) => a.username.localeCompare(b.username, 'vi'));

  return json({
    now: Date.now(),
    prize: MF.PRIZE,
    questions: MF.QUESTIONS, seconds: MF.SECONDS,
    heartbeatMs: MF.HEARTBEAT_MS,
    friends,
    fight: fightView(mine, auth.uid),
  });
}
