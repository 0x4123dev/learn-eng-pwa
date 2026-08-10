import { requireAuth, json, err } from '../_lib.js';
import { ammoStatsFor, nextBattleAt, currentBattle, reapStale, battleView, INVITE_TTL_MS } from '../_battle.js';

// GET /api/battle → everything the Battle screen needs to render itself:
// my ammo (earned by learning), the cooldown, and any battle in progress.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  await reapStale(env);

  const { stats, ammo } = await ammoStatsFor(env, auth.uid);
  const readyAt = await nextBattleAt(env, auth.uid);
  const current = await currentBattle(env, auth.uid);

  // Practice-vs-bot is an admin-granted switch: the arena only shows the
  // button when the server says so, so a child cannot unlock it themselves.
  const me = await env.DB.prepare('SELECT allow_bot FROM users WHERE id = ?').bind(auth.uid).first();

  return json({
    allowBot: !!(me && me.allow_bot),
    ammo,
    stats,
    readyAt,                       // ms epoch, or null when ready now
    now: Date.now(),
    inviteTtlMs: INVITE_TTL_MS,
    battle: battleView(current, auth.uid),
  });
}
