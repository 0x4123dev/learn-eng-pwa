import { requireAuth, json, err } from '../_lib.js';
import { areFriends, friendBattleReadyAt, ammoStatsFor, nextBattleAt, currentBattle, reapStale, battleView, INVITE_TTL_MS, FIELD_VERSION_NEW, normalizeBattleBackground, normalizeCastleSkin, hiresJson, startingHp } from '../_battle.js';

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

  // A friendship must be 3 days old before it can be fought. This is the gate
  // that makes the ammo economy mean something: otherwise a second account
  // could be registered, befriended and beaten within the same minute. The
  // client greys the friend out and counts down, but the rule lives HERE —
  // the button is a courtesy, this is the enforcement.
  const friendReadyAt = await friendBattleReadyAt(env, auth.uid, friendId);
  if (friendReadyAt) {
    const days = Math.ceil((friendReadyAt - Date.now()) / 86400000);
    return err(`Bạn mới quá! Còn ${days} ngày nữa mới đấu được — học bài để nạp đạn nhé! 🚀`, 429, { readyAt: friendReadyAt });
  }

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
  // The squad is snapshotted on the battle: it was paid for THIS fight, and a
  // replay later must show the bench that actually fought. Normalised here
  // because the list arrived from a device.
  const myLevel = Math.max(1, Math.trunc(+body.level || 1));
  const myHires = hiresJson(body.hires);

  const res = await env.DB.prepare(
    `INSERT INTO battles (challenger_id, opponent_id, status, seed, field_version, background_id,
                          challenger_ammo, challenger_level, challenger_stage, challenger_name,
                          challenger_hires, challenger_hp, challenger_castle_skin,
                          created_at, expires_at)
     VALUES (?, ?, 'invited', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    auth.uid, friendId, seed, FIELD_VERSION_NEW, backgroundId, ammo,
    myLevel,
    String(body.stage || 'chihuahua').slice(0, 20),
    String(body.petName || me?.username || 'Pet').slice(0, 20),
    myHires, startingHp(myLevel), normalizeCastleSkin(body.castleSkin),
    now, now + INVITE_TTL_MS
  ).run();

  const b = await env.DB.prepare('SELECT * FROM battles WHERE id = ?')
    .bind(res.meta.last_row_id).first();
  return json({ ok: true, battle: battleView(b, auth.uid) });
}
