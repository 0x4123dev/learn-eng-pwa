import { requireAuth, json, err } from '../_lib.js';
import { battleView } from '../_battle.js';

// GET /api/battle/history[?since=<ms>] → the caller's finished battles.
//
// The arena's "📜 Battle history" used to be written by ONE phone: whichever
// client was polling when the last shot landed appended the entry (and paid
// the coins, and shelved the trophy) in finishPetBattle. The server row was
// never read back. So on a shared phone — child A battles child B from A's
// profile, B's profile is opened later — B's history simply did not have the
// battle, and B was never paid for it.
//
// This is the read-back. The `battles` row is the source of truth for who won
// and on what HP; `battle_turns` holds every volley, so the client can rebuild
// the per-battle detail it would have logged had it been watching.
//
// Shape (viewer-relative, the same `me`/`foe` battleView gives the lobby):
//   { battles: [{ ...battleView, turns: [{ turnNo, userId, shots, damage,
//                 angle, power, abilities, rocket }] }],
//     wins, now }
// `wins` is the lifetime win count (the same number GET /api/me/wins gives) so
// the trophy cabinet can be reconciled with the same one-way rule it already
// uses, rather than by counting cups a second time.
//
// Cost: this is NOT polled. The lobby asks once per open, with `since` set to
// the newest finished_at it has already merged, so a steady state answers with
// zero battles and reads a handful of rows through idx_battles_challenger /
// idx_battles_opponent. Even the first call is capped at HISTORY_MAX rows —
// the client keeps at most 100 anyway.
export const HISTORY_MAX = 100;

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  const url = new URL(request.url);
  const since = Math.max(0, Math.trunc(+url.searchParams.get('since') || 0));

  const rows = await env.DB.prepare(
    `SELECT * FROM battles
      WHERE status = 'done' AND finished_at > ?
        AND (challenger_id = ? OR opponent_id = ?)
      ORDER BY finished_at DESC, id DESC
      LIMIT ?`
  ).bind(since, auth.uid, auth.uid, HISTORY_MAX).all();
  const battles = rows.results || [];

  // One query for every turn of every returned battle, grouped in JS. A
  // per-battle query would be up to HISTORY_MAX round trips on a fresh
  // install.
  const turnsById = new Map();
  if (battles.length) {
    const ids = battles.map(b => b.id);
    const marks = ids.map(() => '?').join(',');
    const turns = await env.DB.prepare(
      `SELECT battle_id, turn_no, user_id, angle, power, shots, damage, abilities, rocket
         FROM battle_turns WHERE battle_id IN (${marks})
        ORDER BY battle_id, turn_no`
    ).bind(...ids).all();
    for (const t of (turns.results || [])) {
      if (!turnsById.has(t.battle_id)) turnsById.set(t.battle_id, []);
      let abilities = [];
      try { abilities = JSON.parse(t.abilities || '[]'); } catch (e) { abilities = []; }
      turnsById.get(t.battle_id).push({
        turnNo: t.turn_no,
        userId: t.user_id,
        shots: Math.max(0, Math.trunc(Number(t.shots) || 0)),
        damage: Math.max(0, Math.trunc(Number(t.damage) || 0)),
        angle: t.angle,
        power: t.power,
        abilities: Array.isArray(abilities) ? abilities : [],
        rocket: Math.max(0, Math.trunc(Number(t.rocket) || 0)),
      });
    }
  }

  const wins = await env.DB.prepare(
    "SELECT COUNT(*) AS wins FROM battles WHERE winner_id = ? AND status = 'done'"
  ).bind(auth.uid).first();

  return json({
    battles: battles.map(b => Object.assign(battleView(b, auth.uid), { turns: turnsById.get(b.id) || [] })),
    wins: (wins && wins.wins) || 0,
    now: Date.now(),
  });
}
