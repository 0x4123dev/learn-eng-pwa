import { requireAuth, json, err } from '../_lib.js';
import { reapStale, battleView, MAX_TURNS, BARRELS, TURN_MS, parseHires, startingHp } from '../_battle.js';

// The most damage a volley could physically do (mirrors battlecalc.shotDamage
// × direct-hit multiplier) — reported damage is clamped to this so a tampered
// client cannot claim more than the rules allow.
function teammateCount(hires, id) {
  return hires.filter(value => value === id).length;
}

function maxTurnDamage(shots, level, gunners) {
  const n = Math.max(0, Math.min(BARRELS, Math.trunc(Number(shots) || 0)));
  // Rounds per shot, exactly as battlecalc.damageAt does. Ceiling the total
  // instead was TIGHTER than the honest maximum and shaved a point off real
  // volleys at some levels.
  const shell = Math.round((12 + 0.12 * Math.max(1, level || 1)) * 1.5);
  return n * shell + Math.max(0, gunners) * Math.max(1, Math.round(shell * 0.6));
}

function guardedDamage(damage, guards) {
  let next = Math.max(0, Math.trunc(Number(damage) || 0));
  for (let i = 0; i < Math.max(0, guards); i++) next = Math.floor(next * 0.5);
  return next;
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
  const myHires = parseHires(meIsChallenger ? b.challenger_hires : b.opponent_hires);
  const foeHires = parseHires(meIsChallenger ? b.opponent_hires : b.challenger_hires);
  const gunners = teammateCount(myHires, 'gunner');
  const guards = teammateCount(foeHires, 'shield');
  const shots = Math.max(0, Math.min(BARRELS, Math.min(myAmmo, Math.trunc(+body.shots || 0))));
  const angle = Math.max(0, Math.min(90, +body.angle || 0));
  const power = Math.max(0, Math.min(100, +body.power || 0));
  const hasRawDamage = Object.prototype.hasOwnProperty.call(body, 'rawDamage');
  const reported = hasRawDamage ? body.rawDamage : body.damage;
  const rawDamage = shots > 0
    ? Math.max(0, Math.min(maxTurnDamage(shots, myLevel, gunners), Math.trunc(+reported || 0)))
    : 0;
  // New clients report pre-guard damage, so the server—not a device—applies
  // permanent Royal Guards. Older clients already reported final damage and
  // remain compatible until their service worker updates.
  const damage = hasRawDamage ? guardedDamage(rawDamage, guards) : rawDamage;
  const abilities = [];
  const rocket = gunners;

  const now = Date.now();
  const myHpBefore = meIsChallenger ? b.challenger_hp : b.opponent_hp;
  const engineers = teammateCount(myHires, 'engineer');
  const myHp = Math.min(startingHp(myLevel), Math.max(0, myHpBefore) + engineers * 15);
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
    `INSERT OR IGNORE INTO battle_turns (battle_id, turn_no, user_id, angle, power, shots, damage, abilities, rocket, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, b.turn_no, auth.uid, angle, power, shots, damage, JSON.stringify(abilities), rocket, now).run();

  const myAmmoLeft = myAmmoAfter;
  const fields = meIsChallenger
    ? { myAmmoCol: 'challenger_ammo', myHpCol: 'challenger_hp', foeHpCol: 'opponent_hp' }
    : { myAmmoCol: 'opponent_ammo', myHpCol: 'opponent_hp', foeHpCol: 'challenger_hp' };

  if (over) {
    let winnerId = null;
    if (foeHp <= 0 && myHp > 0) winnerId = auth.uid;
    else if (myHp > foeHp) winnerId = auth.uid;
    else if (foeHp > myHp) winnerId = meIsChallenger ? b.opponent_id : b.challenger_id;
    await env.DB.prepare(
      `UPDATE battles SET ${fields.myAmmoCol} = ?, ${fields.myHpCol} = ?, ${fields.foeHpCol} = ?,
              status = 'done', winner_id = ?, finished_at = ?, turn_user_id = NULL
        WHERE id = ?`
    ).bind(myAmmoLeft, myHp, foeHp, winnerId, now, id).run();
  } else {
    await env.DB.prepare(
      `UPDATE battles SET ${fields.myAmmoCol} = ?, ${fields.myHpCol} = ?, ${fields.foeHpCol} = ?,
              turn_no = ?, turn_user_id = ?, turn_started_at = ?
        WHERE id = ?`
    ).bind(myAmmoLeft, myHp, foeHp, nextTurnNo, nextUserId, now, id).run();
  }

  const fresh = await env.DB.prepare('SELECT * FROM battles WHERE id = ?').bind(id).first();
  return json({ ok: true, turnMs: TURN_MS, battle: battleView(fresh, auth.uid) });
}
