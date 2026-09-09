import { requireAuth, json, err } from '../_lib.js';
import { ammoStatsFor, nextBattleAt, currentBattle, reapStale, reapStaleThrottled, battleView, INVITE_TTL_MS } from '../_battle.js';

// GET /api/battle → everything the Battle screen needs to render itself:
// my ammo (earned by learning), the cooldown, and any battle in progress.
//
// ---- why there are two shapes -------------------------------------------
//
// The lobby POLLS this endpoint the whole time it is open, and it was by a
// wide margin the most expensive thing this app does to its database: ~85% of
// every row D1 read, all of it re-answering questions whose answers had not
// changed.
//
// Only two things here move from one second to the next: whether somebody has
// challenged me, and when my cooldown ends. `ammo`/`stats` come from a
// THREE-DAY aggregate over `activities` — 60 rows read per call, to produce a
// number that cannot change unless the child leaves this screen and does a
// practice. `allowBot` is an admin switch that changes a handful of times ever.
//
// So `?light=1` answers only the moving parts, and the client merges it into
// what the full call already gave it. The client still asks for the full shape
// on open, once a minute, and after anything it does itself — see
// `_pbStartPolling` in js/petbattle.js.
export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);

  const light = new URL(request.url).searchParams.get('light') === '1';

  // A polling call reaps at most every 15s; a full call reaps exactly, as it
  // always did. Endpoints that ACT on a battle (respond, turn, challenge) call
  // the un-throttled reaper themselves, so nothing expired can be accepted.
  if (light) await reapStaleThrottled(env);
  else await reapStale(env);

  const readyAt = await nextBattleAt(env, auth.uid);
  const current = await currentBattle(env, auth.uid);

  const out = {
    readyAt,                       // ms epoch, or null when ready now
    now: Date.now(),
    inviteTtlMs: INVITE_TTL_MS,
    battle: battleView(current, auth.uid),
  };
  if (light) return json(out);

  const { stats, ammo } = await ammoStatsFor(env, auth.uid);
  // Practice-vs-bot is an admin-granted switch: the arena only shows the
  // button when the server says so, so a child cannot unlock it themselves.
  const me = await env.DB.prepare('SELECT allow_bot FROM users WHERE id = ?').bind(auth.uid).first();

  out.allowBot = !!(me && me.allow_bot);
  out.ammo = ammo;
  out.stats = stats;
  return json(out);
}
