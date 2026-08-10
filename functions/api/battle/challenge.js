import { requireAuth, json, err } from '../_lib.js';
import { areFriends, ammoStatsFor, nextBattleAt, currentBattle, reapStale, battleView, INVITE_TTL_MS, FIELD_VERSION_NEW, normalizeBattleBackground } from '../_battle.js';

// POST /api/battle/challenge { friendId, level, stage, petName, backgroundId }
// Starts a 60-second invite. Zero ammo ⇒ no battle: you must learn first.
export async function onRequestPost({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  await reapStale(env);

  let body;
  try { body = await request.json(); } catch (e) { return err('Invalid JSON'); }
  const friendId = Math.trunc(+body.friendId);
  if (!friendId) return err('Thiếu friendId');
  if (!(await areFriends(env, auth.uid, friendId))) return err('Chỉ đấu với bạn bè', 403);

  if (await currentBattle(env, auth.uid)) return err('Bạn đang trong một trận đấu', 409);
  if (await currentBattle(env, friendId)) return err('Bạn ấy đang bận đấu trận khác', 409);

  const readyAt = await nextBattleAt(env, auth.uid);
  if (readyAt) return err('Chưa tới lượt đấu — hãy học tiếp!', 429);

  const { ammo } = await ammoStatsFor(env, auth.uid);
  if (ammo <= 0) return err('Chưa có đạn — học bài để nạp đạn nhé! 🚀', 400);

  const me = await env.DB.prepare('SELECT username FROM users WHERE id = ?').bind(auth.uid).first();
  const now = Date.now();
  const seed = (Math.floor(Math.random() * 0x7fffffff) ^ now) >>> 0;
  const backgroundId = normalizeBattleBackground(body.backgroundId);

  const res = await env.DB.prepare(
    `INSERT INTO battles (challenger_id, opponent_id, status, seed, field_version, background_id,
                          challenger_ammo, challenger_level, challenger_stage, challenger_name,
                          created_at, expires_at)
     VALUES (?, ?, 'invited', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    auth.uid, friendId, seed, FIELD_VERSION_NEW, backgroundId, ammo,
    Math.max(1, Math.trunc(+body.level || 1)),
    String(body.stage || 'chihuahua').slice(0, 20),
    String(body.petName || me?.username || 'Pet').slice(0, 20),
    now, now + INVITE_TTL_MS
  ).run();

  const b = await env.DB.prepare('SELECT * FROM battles WHERE id = ?')
    .bind(res.meta.last_row_id).first();
  return json({ ok: true, battle: battleView(b, auth.uid) });
}
