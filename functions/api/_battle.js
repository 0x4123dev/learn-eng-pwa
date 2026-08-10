// Shared server helpers for friends + battles. Files starting with "_" are
// not routed by Pages, so this is a safe place for common logic.
// NOTE: the ammo constants here MUST match js/battlecalc.js — tests/battle.test.js
// pins both sources so they can never drift apart.

export const BATTLE_ROUNDS = 5;
export const BARRELS = 4;
export const AMMO_PER_CORRECT = 20;
export const AMMO_VOLUME_MAX = 8;
export const AMMO_PERFECT_MAX = 10;
export const AMMO_STREAK_BONUS = 2;
export const AMMO_CAP = 20;
// Rounds are NOT fixed at BATTLE_ROUNDS any more: a player who fires one poop
// at a time gets one turn per poop, so 20 shots can stretch to 20 rounds. The
// battle ends when a castle falls or both sides are out of ammo. MAX_TURNS is
// only a runaway guard — no legal game can reach it.
export const MAX_TURNS = AMMO_CAP * 2 + 4;

export const COOLDOWN_MS = 72 * 60 * 60 * 1000;   // 3 days between battles
export const INVITE_TTL_MS = 60 * 1000;           // 60s to accept
export const TURN_MS = 20 * 1000;                 // 20s per turn
export const STALE_BATTLE_MS = 10 * 60 * 1000;    // auto-resolve after 10 min

// Ammo is computed here, from activity already synced to D1, so it cannot be
// faked by a tampered client. Base 0: learning is the ONLY source.
export function computeAmmo(stats) {
  const correct = Math.max(0, Math.trunc(stats.correct || 0));
  const perfects = Math.max(0, Math.trunc(stats.perfects || 0));
  const days = Math.max(0, Math.trunc(stats.days || 0));
  const volume = Math.min(AMMO_VOLUME_MAX, Math.floor(correct / AMMO_PER_CORRECT));
  const quality = Math.min(AMMO_PERFECT_MAX, perfects);
  const consistency = days >= 3 ? AMMO_STREAK_BONUS : 0;
  return Math.min(AMMO_CAP, volume + quality + consistency);
}

// The last-3-days learning stats behind a player's ammo.
export async function ammoStatsFor(env, userId) {
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(score), 0) AS correct,
            COALESCE(SUM(CASE WHEN total >= 10 AND score = total THEN 1 ELSE 0 END), 0) AS perfects,
            COUNT(DISTINCT date(created_at)) AS days
       FROM activities
      WHERE user_id = ? AND created_at >= datetime('now', '-3 days')`
  ).bind(userId).first();
  const exams = await env.DB.prepare(
    `SELECT COALESCE(SUM(score), 0) AS correct,
            COALESCE(SUM(CASE WHEN total >= 10 AND score = total THEN 1 ELSE 0 END), 0) AS perfects
       FROM exam_attempts
      WHERE user_id = ? AND created_at >= datetime('now', '-3 days')`
  ).bind(userId).first();
  const stats = {
    correct: (row?.correct || 0) + (exams?.correct || 0),
    perfects: (row?.perfects || 0) + (exams?.perfects || 0),
    days: row?.days || 0,
  };
  return { stats, ammo: computeAmmo(stats) };
}

// Two users are friends only if an accepted row exists in either direction.
export async function areFriends(env, aId, bId) {
  const row = await env.DB.prepare(
    `SELECT id FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))`
  ).bind(aId, bId, bId, aId).first();
  return !!row;
}

// When may this user battle again? (null = right now)
export async function nextBattleAt(env, userId) {
  const row = await env.DB.prepare(
    `SELECT MAX(finished_at) AS last FROM battles
      WHERE status = 'done' AND (challenger_id = ? OR opponent_id = ?)`
  ).bind(userId, userId).first();
  if (!row || !row.last) return null;
  const at = Number(row.last) + COOLDOWN_MS;
  return at > Date.now() ? at : null;
}

// The battle this user is currently in (invited or active), if any.
export async function currentBattle(env, userId) {
  return env.DB.prepare(
    `SELECT * FROM battles
      WHERE (challenger_id = ? OR opponent_id = ?)
        AND status IN ('invited', 'active')
      ORDER BY id DESC LIMIT 1`
  ).bind(userId, userId).first();
}

// Expire stale invites and abandoned battles before reporting state.
export async function reapStale(env) {
  const now = Date.now();
  await env.DB.prepare(
    `UPDATE battles SET status = 'expired'
      WHERE status = 'invited' AND expires_at IS NOT NULL AND expires_at < ?`
  ).bind(now).run();
  // Abandoned mid-battle: resolve on remaining HP so nobody is stuck.
  await env.DB.prepare(
    `UPDATE battles
        SET status = 'done', finished_at = ?,
            winner_id = CASE
              WHEN challenger_hp > opponent_hp THEN challenger_id
              WHEN opponent_hp > challenger_hp THEN opponent_id
              ELSE NULL END
      WHERE status = 'active' AND turn_started_at IS NOT NULL AND turn_started_at < ?`
  ).bind(now, now - STALE_BATTLE_MS).run();
}

// Public shape of a battle row for the client.
export function battleView(b, viewerId) {
  if (!b) return null;
  const meIsChallenger = b.challenger_id === viewerId;
  const me = {
    id: meIsChallenger ? b.challenger_id : b.opponent_id,
    name: meIsChallenger ? b.challenger_name : b.opponent_name,
    ammo: meIsChallenger ? b.challenger_ammo : b.opponent_ammo,
    level: meIsChallenger ? b.challenger_level : b.opponent_level,
    stage: meIsChallenger ? b.challenger_stage : b.opponent_stage,
    hp: meIsChallenger ? b.challenger_hp : b.opponent_hp,
  };
  const foe = {
    id: meIsChallenger ? b.opponent_id : b.challenger_id,
    name: meIsChallenger ? b.opponent_name : b.challenger_name,
    ammo: meIsChallenger ? b.opponent_ammo : b.challenger_ammo,
    level: meIsChallenger ? b.opponent_level : b.challenger_level,
    stage: meIsChallenger ? b.opponent_stage : b.challenger_stage,
    hp: meIsChallenger ? b.opponent_hp : b.challenger_hp,
  };
  return {
    id: b.id,
    status: b.status,
    seed: b.seed,
    // The challenger always stands on the left, whoever is looking.
    iAmChallenger: meIsChallenger,
    me, foe,
    turnNo: b.turn_no,
    myTurn: b.turn_user_id === viewerId,
    turnStartedAt: b.turn_started_at,
    expiresAt: b.expires_at,
    winnerId: b.winner_id,
    finishedAt: b.finished_at,
  };
}
