import { requireAuth, json, err } from '../_lib.js';
import { reapStale, battleView, MAX_TURNS, BARRELS, TURN_MS } from '../_battle.js';

// The most damage a volley could physically do (mirrors battlecalc.shotDamage
// × direct-hit multiplier) — reported damage is clamped to this so a tampered
// client cannot claim more than the rules allow.
function maxTurnDamage(shots, level) {
  const n = Math.max(0, Math.min(BARRELS, Math.trunc(shots || 0)));
  return Math.ceil(n * (12 + 0.12 * Math.max(1, level || 1)) * 1.5);
}

// POST /api/battle/turn { battleId, angle, power, shots, damage }
// shots = 0 means a skipped turn (timer ran out) and costs no ammo.
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
  if (b.status !== 'active') return err('Trận đấu đã kết thúc', 409);
  const meIsChallenger = b.challenger_id === auth.uid;
  if (!meIsChallenger && b.opponent_id !== auth.uid) return err('Forbidden', 403);
  if (b.turn_user_id !== auth.uid) return err('Chưa tới lượt bạn', 409);

  const myAmmo = meIsChallenger ? b.challenger_ammo : b.opponent_ammo;
  const myLevel = meIsChallenger ? b.challenger_level : b.opponent_level;
  const shots = Math.max(0, Math.min(BARRELS, Math.min(myAmmo, Math.trunc(+body.shots || 0))));
  const angle = Math.max(0, Math.min(90, +body.angle || 0));
  const power = Math.max(0, Math.min(100, +body.power || 0));
  const damage = shots > 0
    ? Math.max(0, Math.min(maxTurnDamage(shots, myLevel), Math.trunc(+body.damage || 0)))
    : 0;

  const now = Date.now();
  const foeHp = Math.max(0, (meIsChallenger ? b.opponent_hp : b.challenger_hp) - damage);
  const nextTurnNo = b.turn_no + 1;
  const myAmmoAfter = myAmmo - shots;
  const foeAmmo = meIsChallenger ? b.opponent_ammo : b.challenger_ammo;
  // No fixed round count: play continues while anyone still has a poop left.
  const over = foeHp <= 0 || (myAmmoAfter <= 0 && foeAmmo <= 0) || nextTurnNo > MAX_TURNS;
  // Whoever still has ammo keeps shooting rather than forcing empty skip turns.
  const foeCanFire = foeAmmo > 0;
  const nextUserId = foeCanFire
    ? (meIsChallenger ? b.opponent_id : b.challenger_id)
    : auth.uid;

  // Record the turn (UNIQUE(battle_id, turn_no) makes a double-submit harmless).
  await env.DB.prepare(
    `INSERT OR IGNORE INTO battle_turns (battle_id, turn_no, user_id, angle, power, shots, damage, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, b.turn_no, auth.uid, angle, power, shots, damage, now).run();

  const myAmmoLeft = myAmmoAfter;
  const fields = meIsChallenger
    ? { myAmmoCol: 'challenger_ammo', foeHpCol: 'opponent_hp' }
    : { myAmmoCol: 'opponent_ammo', foeHpCol: 'challenger_hp' };

  if (over) {
    const myHp = meIsChallenger ? b.challenger_hp : b.opponent_hp;
    let winnerId = null;
    if (foeHp <= 0 && myHp > 0) winnerId = auth.uid;
    else if (myHp > foeHp) winnerId = auth.uid;
    else if (foeHp > myHp) winnerId = meIsChallenger ? b.opponent_id : b.challenger_id;
    await env.DB.prepare(
      `UPDATE battles SET ${fields.myAmmoCol} = ?, ${fields.foeHpCol} = ?,
              status = 'done', winner_id = ?, finished_at = ?, turn_user_id = NULL
        WHERE id = ?`
    ).bind(myAmmoLeft, foeHp, winnerId, now, id).run();
  } else {
    await env.DB.prepare(
      `UPDATE battles SET ${fields.myAmmoCol} = ?, ${fields.foeHpCol} = ?,
              turn_no = ?, turn_user_id = ?, turn_started_at = ?
        WHERE id = ?`
    ).bind(myAmmoLeft, foeHp, nextTurnNo, nextUserId, now, id).run();
  }

  const fresh = await env.DB.prepare('SELECT * FROM battles WHERE id = ?').bind(id).first();
  return json({ ok: true, turnMs: TURN_MS, battle: battleView(fresh, auth.uid) });
}
