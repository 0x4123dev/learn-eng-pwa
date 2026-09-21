import { requireAuth, json, err } from '../_lib.js';
import { areFriends, friendBattleReadyAt } from '../_battle.js';
import { MF, currentFight, fightView, mathFightEnabled, pairState, randomFightId, reapStale } from '../_math-fight.js';

// POST /api/math-fight/challenge { friendId, level, foeLevel }
// Opens a 60-second invite. Nobody picks a stake: winning pays MF.PRIZE and
// losing costs the same, so there is nothing here for a child to argue over.
// The rungs are decided HERE and never taken from the client, which is what
// keeps the handicap both silent and unforgeable.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (!(await mathFightEnabled(env))) return err('Đấu Toán chưa được mở cho tài khoản này', 403);
  await reapStale(env);

  let body; try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const friendId = Math.trunc(+body.friendId);
  if (!friendId || friendId === auth.uid) return err('Thiếu bạn để đấu');
  if (!(await areFriends(env, auth.uid, friendId))) return err('Chỉ đấu với bạn bè', 403);

  // The friends list hides switched-off accounts, but the rule lives HERE too:
  // a stale client must not challenge a disabled account by raw id.
  const foe = await env.DB.prepare('SELECT disabled FROM users WHERE id = ?').bind(friendId).first();
  if (!foe || foe.disabled) return err('Chỉ đấu với bạn bè', 403);

  // Same gate as the pet arena: a friendship made minutes ago cannot be farmed.
  const friendReadyAt = await friendBattleReadyAt(env, auth.uid, friendId);
  if (friendReadyAt) return err('Bạn mới quá — vài ngày nữa mới đấu được nhé!', 429, { readyAt: friendReadyAt });

  const pair = await pairState(env, auth.uid, friendId);
  const now = Date.now();
  if (pair.nextReadyAt > now) return err('Cặp này vừa đấu rồi — chờ hết giờ nhé!', 429, { readyAt: pair.nextReadyAt });

  if (await currentFight(env, auth.uid)) return err('Bạn đang ở trong một trận rồi', 409);
  if (await currentFight(env, friendId)) return err('Bạn ấy đang bận một trận khác', 409);

  const base = MF.baseLevel(+body.level || 0, +body.foeLevel || 0);
  const levels = MF.levelsFor(pair, base, auth.uid, friendId);
  const id = randomFightId();
  const seed = (Math.floor(Math.random() * 0x7fffffff) ^ now) >>> 0;

  await env.DB.prepare(
    `INSERT INTO math_fights(id,challenger_id,opponent_id,prize,seed,challenger_level,opponent_level,
                             status,created_at,expires_at)
     VALUES(?,?,?,?,?,?,?,'invited',?,?)`
  ).bind(id, auth.uid, friendId, MF.PRIZE, seed, levels.a, levels.b, now, now + MF.INVITE_TTL_MS).run();

  const row = await env.DB.prepare('SELECT * FROM math_fights WHERE id=?').bind(id).first();
  return json({ fight: fightView(row, auth.uid) });
}
