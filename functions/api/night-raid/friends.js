import { requireAuth, json, err } from '../_lib.js';
import { COOLDOWN_RAID_STATUS_SQL, nightDate, nightRaidEnabled, ticketStats, homeSnapshot, raidLockUntil, readRaidConfig, retryAvailableAt, inFlightRaids} from '../_night-raid.js';

// GET /api/night-raid/friends — "Bạn bè · nhà nào đánh được".
//
// The child's ACCEPTED friends who own a Night Raid home. A row answers ONE
// question, and it is a question about the CHILD, not about the house:
// "may I attack this one right now?" — `retryAt` is 0 for yes, otherwise the
// ms epoch when my own retry_hours cooldown on that house runs out.
//
// Everything else about the state of that house is deliberately withheld:
//   - whether it was already robbed (the 24 h seal). The list used to send
//     `lockedUntil`/`availableAt`/`canRaidNow`, which turned NHÀ THẬT into a
//     lookup — read the list, attack the one green row, win. A child now finds
//     the rubble only after the troops arrive (start.js → `ruined`), and pays
//     for the guess with their own 12 h cooldown on that house.
//   - whether a Khiên Đêm is up. This one was sent as `shielded` on purpose
//     for a while, on the theory that a deterrent should be visible; it is not
//     any more, for the same reason as the seal — a shield the raider can see
//     is a row they simply never click, and the gamble disappears.
// `retryAt` leaks nothing, because it is a fact about MY OWN last attempt on
// that house — I was there, I already know.
//
// Name + level + difficulty + my own clock ONLY. No layout, no power numbers,
// no shield clock, no seal.

// Same rule as targets.js, so a friend's chip and a random target's card agree.
export function difficultyLabel(theirLevel, myLevel) {
  return theirLevel > myLevel + 2 ? 'Khó' : theirLevel < myLevel - 2 ? 'Dễ' : 'Cân bằng';
}

export async function onRequestGet({ request, env }) {
  const auth = await requireAuth(request, env);
  if (!auth) return err('Unauthorized', 401);
  if (!(await nightRaidEnabled(env, auth.uid))) return err('Night Raid Phase 2 is not enabled', 403);

  const now = Date.now(), date = nightDate(now);
  const cfg = await readRaidConfig(env);
  const mine = await env.DB.prepare('SELECT home_level, ruined_until, shield_until FROM night_raid_homes WHERE user_id=?')
    .bind(auth.uid).first();
  const myLevel = Math.max(1, +(mine && mine.home_level) || 1);

  // One row per accepted friend. The friendship may point either
  // way, so the "other" side is picked per row; disabled accounts vanish the
  // same way they do from GET /api/friends. `last_attack` is MY most recent
  // attempt on that house of ANY kind — win, loss or ruins — the one number
  // start.js gates the retry on (idx_night_raids_pair_recent, db/021).
  const rows = await env.DB.prepare(
    `SELECT u.id AS user_id, h.home_level, h.layout_json, h.dog_level, h.castle_skin,
            u.username,
            (SELECT MAX(r.created_at) FROM night_raids r
              WHERE r.attacker_id = ? AND r.defender_id = h.user_id
                AND r.status IN ${COOLDOWN_RAID_STATUS_SQL}) AS last_attack
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.requester_id = ? THEN f.addressee_id ELSE f.requester_id END
       LEFT JOIN night_raid_homes h ON h.user_id = u.id
      WHERE f.status = 'accepted'
        AND (f.requester_id = ? OR f.addressee_id = ?)
        AND u.disabled = 0`
  ).bind(auth.uid, auth.uid, auth.uid, auth.uid).all();

  const friends = (rows.results || []).map(row => {
    // homeSnapshot is the one place a home row becomes numbers; only the
    // harmless ones are copied out of it. `lockedUntil` is NOT one of them.
    const snap = homeSnapshot(row);
    return {
      targetId: row.user_id,
      name: row.username,
      homeLevel: snap.homeLevel,
      difficulty: difficultyLabel(snap.homeLevel, myLevel),
      retryAt: retryAvailableAt(row.last_attack, cfg.retry_hours, now),
    };
  });
  // Attackable first, then whoever opens up soonest, then by name so the order
  // is stable between refreshes. The order says nothing about the houses —
  // only about my own clocks.
  friends.sort((a, b) => (a.retryAt - b.retryAt) || String(a.name).localeCompare(String(b.name), 'vi'));

  const stats = await ticketStats(env, auth.uid, date);
  const inFlight = await inFlightRaids(env, auth.uid);
  return json({
    friends,
    // My OWN house is a different matter: the owner may of course see that it
    // was robbed and whether their shield is up.
    me: {
      hasHome: !!mine,
      homeLevel: myLevel,
      lockedUntil: mine ? raidLockUntil(mine, now) : 0,
      shieldUntil: Math.max(0, Math.trunc(+(mine && mine.shield_until) || 0)),
    },
    ticketsLeft: Math.max(0, stats.allowance - stats.used - inFlight),
    learningBoost: stats.allowance > 3,
  });
}
